// Monstruos: aparición en sus generadores, IA, ataque, muerte y botín.
import { ACT, DX, DY, CORPSE_MS, CHASE_LIMIT, dirTo, dist, mobDurations } from "../const.js";
import * as R from "../rules.js";
import { greedyStep } from "../path.js";
import { rollKillDrop } from "../drops.js";
import { newInst } from "./itemsys.js";
import { groundPush } from "./ground.js";
import { BOSS_UNIQUE } from "../rarity.js";
import { giveExp, npcStrikes, damagePlayer } from "./combatsys.js";
import * as Party from "./party.js";
import { sget } from "./status.js";
import { addField, DYN } from "./fields.js";
import * as Comp from "./companion.js";
import * as Tal from "./talents.js";
import * as Inv from "../inventory.js";
import * as Boss from "./bosses.js";

export function spawnFrom(w, g) {
  const cfg = w.npcDb[g.name];
  if (!cfg) return null;
  const [x1, y1, x2, y2] = g.rect;
  for (let tries = 0; tries < 60; tries++) {
    const x = x1 + Math.floor(w.rng() * (x2 - x1 + 1)), y = y1 + Math.floor(w.rng() * (y2 - y1 + 1));
    if (!w.grid.free(x, y)) continue;
    const n = w.makeEnt("npc", x, y);
    Object.assign(n, {
      name: g.name, type: cfg.type, cfg, gen: g, dur: mobDurations(cfg.type),
      dir: 1 + Math.floor(w.rng() * 8),
      hp: R.npcHP(w.rng, cfg.hitDice), exp: R.npcExp(w.rng, cfg), absDamage: cfg.absDamage,
      target: null, nextAct: w.time + w.rng() * cfg.actionTime, phase: w.rng() * 1000, special: 0,
    });
    if (g.specialProb && R.dice(w.rng, 1, 100) <= g.specialProb) {
      n.special = R.applySpecial(w.rng, n, g.specialKind);
    }
    // Cripta de esqueletos: cada nivel multiplica vida, daño y experiencia (g.scale); los jefes llevan además g.boss (1..4).
    if (g.scale) { n.hp = Math.ceil(n.hp * g.scale.hp); n.exp = Math.ceil(n.exp * g.scale.exp); n.dmgMul = g.scale.dmg; }
    if (g.boss) { n.boss = g.boss; n.cfg = { ...cfg, searchRange: Math.max(cfg.searchRange, 12), attackRange: Math.max(cfg.attackRange, 1) }; }   // los jefes ven de lejos y no se quedan quietos
    n.maxHp = n.hp;
    n.noDieRemainExp = n.exp - Math.floor(n.exp / 3);
    g.alive++;
    w.emit({ t: "spawn", id: n.id });
    return n;
  }
  return null;
}

// Explosivos (Game.cpp ~10919, NpcMagicHandler): al morir lanzan Fire Strike (30) o Mass Fire Strike (61) sobre su casilla, con acierto 100.
function explode(w, n, spell) {
  const sp = w.magic?.[spell]; if (!sp) return;
  w.emit({ t: "explode", id: n.id, x: n.x, y: n.y, spell });
  for (const e of [...w.ents.values()]) {
    if (e.kind !== "player" || e.dead || Math.abs(e.x - n.x) > sp.v2 || Math.abs(e.y - n.y) > sp.v3) continue;
    const pr = sget(w, e, "protect");
    if (pr === 5 || (pr === 2 && R.dice(w.rng, 1, 2) === 1)) continue;
    const centre = e.x === n.x && e.y === n.y;
    let dmg = centre ? R.dice(w.rng, sp.v4, sp.v5) + sp.v6 : R.dice(w.rng, sp.v7, sp.v8) + sp.v9;
    if (pr === 2) dmg = Math.floor(dmg / 2);
    damagePlayer(w, e, Math.max(0, dmg), n, "fire");
  }
}

// casilla libre junto al cadáver para el único (no se apila con el botín normal)
function uniqueSpot(w, n) {
  for (let r = 1; r <= 3; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const x = n.x + i, y = n.y + j; if (w.grid.inside(x, y) && !w.grid.blocked(x, y) && !w.items.get(w.grid.idx(x, y))) return [x, y]; }
  return [n.x, n.y];
}

export function killNpc(w, n, p) {
  n.hp = 0; n.dead = true;
  w.setAct(n, ACT.DYING, n.dur.dying);
  w.grid.release(n.x, n.y, n.id);
  w.emit({ t: "death", id: n.id, by: p ? p.id : 0 });
  if (n.special === 7 || n.special === 8) explode(w, n, n.special === 7 ? 30 : 61);
  if (p) {                                                       // sin jugador (fuego, nube...) no hay experiencia
    p.kills++;
    let xp = Math.floor(n.exp / 3) + n.noDieRemainExp;           // NpcKilledHandler
    if (p.eff && p.eff.addExp) xp += Math.floor((p.eff.addExp / 100) * xp);
    Party.shareExp(w, p, xp);                                    // con grupo se reparte (GetExp)
    Comp.onKill(w, p, n, xp);                                    // contador de bolas y experiencia del compañero
  }
  n.noDieRemainExp = 0;
  Boss.onDeath(w, n);
  if (n.boss === 1 && !n.aux) w.after(n.dur.dying * 0.6, () => groundPush(w, n.x, n.y, newInst(w, w.data.named("SkeletonBones").id, 1, { color: CRIMSON_COLOR })));   // 100 % de probabilidad
  const depth = w.map?.kind === "dungeon" ? w.map.level || 0 : 0;
  const drop = n.noDrop ? null : rollKillDrop(w.rng, n, { rating: p?.rating || 0, data: w.data, addGold: p?.eff?.addGold || 0, depth, gender: p?.gender });
  if (drop && w.data.item(drop.id)) w.after(n.dur.dying * 0.6, () => groundPush(w, n.x, n.y, newInst(w, drop.id, drop.count, drop), true));
  if (n.boss && !n.aux && !n.clone && BOSS_UNIQUE[n.boss]) {      // cada rey suelta siempre un objeto único (de Item.cfg) ligado a su mecánica
    const list = BOSS_UNIQUE[n.boss], id = list[R.dice(w.rng, 1, list.length) - 1];
    if (w.data.item(id)) w.after(n.dur.dying * 0.6 + 200, () => { const [ux, uy] = uniqueSpot(w, n); groundPush(w, ux, uy, newInst(w, id, 1), true); });
  }
  n.gen.alive--;
  if (n.gen.respawn !== false && !n.master) w.after(n.cfg.regenTime, () => { if (n.gen.alive < n.gen.max) spawnFrom(w, n.gen); });
  // Esqueleto común (no jefe, ni auxiliar, ni fantasma): con GHOST_CHANCE se levanta como fantasma cuando desaparece su cadáver. Se decide al
  // morir (w.ghostsPending retiene la limpieza del nivel de la cripta hasta que el fantasma salga). Invento del port.
  const rise = n.name === "Skeleton" && !n.boss && !n.aux && !n.ghost && !n.master && !n.comp && !n.noDrop && !w.cleared && w.rng() < GHOST_CHANCE;
  if (rise) w.ghostsPending = (w.ghostsPending || 0) + 1;
  w.after(n.dur.dying + CORPSE_MS, () => {
    w.ents.delete(n.id); w.emit({ t: "remove", id: n.id });
    if (!rise) return;
    w.ghostsPending--;
    if (w.cleared) return;
    const g = { ...n.gen, rect: [n.x, n.y, n.x, n.y], alive: 0, max: 0, respawn: false, specialProb: 0, boss: 0 };
    const gh = spawnFrom(w, g) || spawnFrom(w, { ...g, rect: [n.x - 1, n.y - 1, n.x + 1, n.y + 1] });
    if (gh) {
      gh.ghost = true; gh.noDrop = true;                                                      // espectral: sin botín y solo el 20 % de la experiencia
      gh.exp = Math.max(1, Math.ceil(gh.exp * GHOST_EXP)); gh.noDieRemainExp = gh.exp - Math.floor(gh.exp / 3); w.emit({ t: "ghost", id: gh.id, x: gh.x, y: gh.y });
    }
  });
}
export const GHOST_CHANCE = 0.25, GHOST_EXP = 0.2;

// ---------------------------------------------------------------- seguidores (hechizo Summon Creature, DEF_MAGICTYPE_SUMMON)
// Game.cpp ~18660: sale un monstruo según Magery (iV1 = valor 2 del hechizo; 0 -> 1d(magery/10), mínimo magery/20) y sigue al invocador
// (bSetNpcFollowMode). Máximo magery/20 seguidores; desaparece a los 300 s (DEF_SUMMONTIME) o si el invocador muere. No da experiencia.
const SUMMON_BY_MAGERY = ["", "Slime", "Giant-Ant", "Amphis", "Orc", "Skeleton", "Clay-Golem", "Stone-Golem", "Orc-Mage", "Hellbound", "Cyclops"];
const SUMMON_BY_V1 = ["", "Orc", "Skeleton", "Clay-Golem", "Stone-Golem", "Hellbound", "Cyclops", "Troll", "Orge"];
export const SUMMON_MS = 300000;
export const followersOf = (w, p) => [...w.ents.values()].filter(e => e.master === p.id && !e.dead);
export function summonFor(w, p, v1, free) {
  const mag = p.skills[4] || 0, limit = Math.max(free ? 1 : 0, Math.floor(mag / 20));
  if (followersOf(w, p).filter(e => !e.comp).length >= limit) return null;
  let name;
  if (v1 > 0) name = SUMMON_BY_V1[v1];
  else {
    let r = R.dice(w.rng, 1, Math.max(1, Math.floor(mag / 10)));
    if (r < Math.floor(mag / 20)) r = Math.floor(mag / 20);
    name = SUMMON_BY_MAGERY[Math.max(1, Math.min(10, r))];
  }
  if (!w.npcDb[name]) return null;
  const gen = { name, rect: [p.x - 2, p.y - 2, p.x + 2, p.y + 2], alive: 0, max: 0, respawn: false };
  const n = spawnFrom(w, gen);
  if (!n) return null;
  Object.assign(n, { master: p.id, summonedAt: w.time, noDrop: true, side: p.side });
  n.exp = 0; n.noDieRemainExp = 0;
  return n;
}

function followerThink(w, n) {
  if ((n.frozenUntil || 0) > w.time || (n.stunUntil || 0) > w.time) return;     // congelado o aturdido por un jefe
  const m = w.ents.get(n.master);
  if (!m || m.dead || (!n.comp && w.time - n.summonedAt > SUMMON_MS)) return killNpc(w, n, null);
  let tc = null;
  if (n.comp) {
    refreshCompanion(w, n, m); tc = Inv.instOf(m, n.ball)?.comp; if (tc) Tal.regen(w, n, tc);
    if (tc?.evolve) {                                   // cambio de tamaño: tras unos segundos (se lee la frase) se vuelve a invocar con efecto
      if (!n.evolveAt) n.evolveAt = w.time + EVOLVE_MS;
      else if (w.time >= n.evolveAt && !m.dead && !w.fightZone) return evolveCompanion(w, n, m, tc);
    }
  }
  let best = null, bd = 1e9;
  // Objetivo marcado por el dueño (Alt + clic): se ataca aunque el compañero esté en paz; sin objetivo, solo en modo ataque
  const ct = n.comp && n.cTarget && w.ents.get(n.cTarget);
  if (ct && !ct.dead && ct.kind === "npc" && dist(m, ct) <= 18) { best = ct; bd = dist(n, ct); }
  else {
    n.cTarget = null;
    const calm = n.comp && Inv.instOf(m, n.ball)?.comp.mode === "peace";
    if (!calm) for (const e of w.ents.values()) {
      if (e.kind !== "npc" || e.dead || e.master || (e.cfg.actionLimit && !e.crystal)) continue;
      const d = dist(n, e);
      if (d <= Math.max(n.cfg.searchRange, 6) && dist(m, e) <= 12 && d < bd) { best = e; bd = d; }
    }
  }
  if (tc) {                                                                    // hechizos del compañero (talents.js)
    const hostiles = [...w.ents.values()].filter(e => e.kind === "npc" && !e.dead && !e.master && !e.cfg.actionLimit && dist(e, m) <= 8);
    if (Tal.support(w, n, m, tc, hostiles.length ? hostiles : null)) return;
    if (best && bd <= 7 && Tal.hasAttackSpell(tc) && Tal.offense(w, n, tc, best, (t, dmg) => petHurt(w, n, t, dmg, "spell"))) return;
  }
  if (best) {
    if (bd <= n.cfg.attackRange) return followerAttack(w, n, best);
    const d = greedyStep(w.grid, n, best.x, best.y, dirTo);
    if (d) w.tryStep(n, d, n.dur.move, ACT.MOVE);
    return;
  }
  if (dist(n, m) > 2) { const d = greedyStep(w.grid, n, m.x, m.y, dirTo); if (d) w.tryStep(n, d, n.dur.move, ACT.MOVE); }
}

function followerAttack(w, n, t) {
  n.dir = dirTo(n.x, n.y, t.x, t.y);
  w.setAct(n, ACT.ATTACK, n.dur.attack);
  n.busyUntil = w.time + n.dur.attack;
  w.emit({ t: "attack", id: n.id, target: t.id });
  w.after(n.dur.attack * 0.5, () => {
    if (n.dead || t.dead || w.ents.get(t.id) !== t || dist(n, t) > n.cfg.attackRange) return;
    if (R.dice(w.rng, 1, 100) > R.hitChance(n.cfg.hitRatio, t.cfg.defenseRatio, n.dir === t.dir)) return;
    const dmg = n.comp ? Math.max(1, Math.round((n.dmgNow + R.dice(w.rng, 1, 3) - 2) * (sget(w, n, "berserk") ? 2 : 1))) : R.npcMelee(w.rng, n).damage;
    petHurt(w, n, t, dmg);
  });
}

// Daño de un seguidor (golpe o hechizo) a un monstruo. El compañero gana la mitad de la experiencia y el dueño la otra mitad; el botín cae.
function petHurt(w, n, t, dmg, kind = "hit") {
  if (t.dead) return;
  dmg = Boss.mitigate(w, t, dmg, n, kind);
  if (dmg <= 0) return;
  t.hp -= dmg;
  w.emit({ t: "damage", id: t.id, from: n.id, amount: dmg, hp: Math.max(0, t.hp), max: t.maxHp });
  if (t.hp <= 0) {
    t.noDrop = !n.comp; t.noDieRemainExp = 0;
    const m = w.ents.get(n.master), inst = n.comp && m && Inv.instOf(m, n.ball);
    if (inst) { const xp = Math.floor(t.exp / 3 / 2); Comp.addExp(w, m, inst, xp); giveExp(w, m, xp); }
    return killNpc(w, t, null);
  }
  const m = w.ents.get(n.master);
  if (n.comp ? (!t.target || R.dice(w.rng, 1, 3) === 1) : (m && !t.target)) t.target = n.comp ? n.id : m.id;   // el monstruo herido por el compañero se vuelve contra él
  if (!w.busy(t) || t.act === ACT.DAMAGE) { w.setAct(t, ACT.DAMAGE, t.dur.damage); t.busyUntil = w.time + t.dur.damage; }
}

// Rey esqueleto carmesí (jefe 1): cada 20 % de vida perdida enciende un Fire Field (hechizo 41 de Magic.cfg) a su alrededor y es inmune al fuego.
export const CRIMSON_COLOR = 14;          // rojo de la tabla de tintes (m_wR[14])
export const CRIMSON_STEP = 0.2, FIRE_FIELD = 41;
function crimsonPhase(w, n) {
  const stage = Math.min(4, Math.floor((1 - n.hp / n.maxHp) / CRIMSON_STEP + 1e-9));
  if (stage <= (n.bossStage || 0)) return;
  n.bossStage = stage;
  const sp = w.magic?.[FIRE_FIELD], r = 2, ms = 12000;
  w.emit({ t: "spell", id: n.id, spell: FIRE_FIELD, x: n.x, y: n.y, attr: sp?.attr, type: sp?.type });
  for (let ix = n.x - r; ix <= n.x + r; ix++) for (let iy = n.y - r; iy <= n.y + r; iy++) addField(w, DYN.FIRE, ix, iy, ms, 0, n.id);
}
export function npcThink(w, n) {
  if (n.arena) return;                                                         // gladiadores de la arena: los mueve systems/arena.js
  if (n.crystal) return;                                                       // los cristales del jefe glacial no actúan
  if (n.boss === 1 && !n.dead && !n.aux) crimsonPhase(w, n);
  if (n.boss && !n.aux && !n.dead) Boss.bossTick(w, n);
  if (n.dead || w.time < n.nextAct || w.busy(n)) return;
  if (n.master) { n.nextAct = w.time + n.cfg.actionTime * (sget(w, n, "ice") || (n.chillUntil || 0) > w.time ? 1.5 : 1); return followerThink(w, n); }
  n.nextAct = w.time + n.cfg.actionTime * (sget(w, n, "ice") ? 1.5 : 1) * Boss.speedFactor(n);       // hielo: un 50 % más lento; la furia del jefe carmesí acelera
  if (sget(w, n, "hold")) return;                                              // paralizado: ni anda ni ataca
  let t = n.target ? w.ents.get(n.target) : null;
  if (t && (t.dead || dist(n, t) > CHASE_LIMIT || sget(w, t, "invis"))) { n.target = null; t = null; }
  if (!t) {                                                                    // el más cercano entre jugadores y compañeros (los demás seguidores no atraen)
    let bd = 1e9;
    for (const e of w.ents.values()) {
      if (e.dead || !(e.kind === "player" ? !sget(w, e, "invis") : e.comp)) continue;
      const d = dist(n, e);
      if (d <= n.cfg.searchRange && d < bd) { t = e; bd = d; n.target = e.id; }
    }
  }
  if (t) {
    if (dist(n, t) <= n.cfg.attackRange) return npcAttack(w, n, t);
    const d = greedyStep(w.grid, n, t.x, t.y, dirTo);
    if (d) w.tryStep(n, d, n.dur.move, ACT.MOVE);
    return;
  }
  if (w.rng() < 0.35) {                                          // sin objetivo: pasea dentro de su zona
    const d = 1 + Math.floor(w.rng() * 8), nx = n.x + DX[d], ny = n.y + DY[d];
    const [x1, y1, x2, y2] = n.gen.rect;
    if (nx >= x1 - 2 && nx <= x2 + 2 && ny >= y1 - 2 && ny <= y2 + 2) w.tryStep(n, d, n.dur.move, ACT.MOVE);
    else n.dir = d;
  }
}

function npcAttack(w, n, t) {
  n.dir = dirTo(n.x, n.y, t.x, t.y);
  w.setAct(n, ACT.ATTACK, n.dur.attack);
  n.busyUntil = w.time + n.dur.attack;
  w.emit({ t: "attack", id: n.id, target: t.id });
  w.after(n.dur.attack * 0.5, () => {
    if (w.ents.get(t.id) !== t || n.dead || t.dead || dist(n, t) > n.cfg.attackRange) { w.emit({ t: "miss", id: t.id, from: n.id }); return; }
    if (t.comp) return companionStruck(w, n, t);
    npcStrikes(w, n, t);
  });
}


// ---------------------------------------------------------------- compañeros (companion.js)
function refreshCompanion(w, n, m) {
  const inst = Inv.instOf(m, n.ball);
  if (!inst) return killNpc(w, n, null);
  const c = inst.comp, st = Comp.statsOf(m, c);
  n.dmgNow = st.dmg; n.clvl = c.lvl; n.nick = c.nm;
  n.evoK = Comp.SIZE_STAGES.includes(c.lvl + 1) ? Math.max(0.01, Math.min(1, (c.exp || 0) / Comp.need(c.lvl))) : 0;          // último nivel antes de evolucionar: progreso 0..1 (animación cada vez más viva)
  // La vida es del compañero y viaja con la bola (c.hp): al invocarlo vuelve con la que tenía; al subir de nivel conserva la proporción
  if (!n.hpInit) { n.hpInit = true; n.maxHp = st.hp; n.hp = Math.max(1, Math.min(st.hp, c.hp ?? st.hp)); }
  else if (n.maxHp !== st.hp) { const k = n.hp / n.maxHp; n.maxHp = st.hp; n.hp = Math.max(1, Math.round(st.hp * k)); }
  else if (n.hp < n.maxHp && w.time - (n.hurtAt || -1e9) > 8000 && w.time - (n.regenAt || 0) > 6000) { n.regenAt = w.time; n.hp = Math.min(n.maxHp, n.hp + Math.ceil(n.maxHp * 0.02)); }   // recuperación lenta fuera de combate
  c.hp = n.hp; c.max = n.maxHp;
}
export const EVOLVE_MS = 2500;
// Re-invocación al cambiar de tamaño: el compañero desaparece con un destello y vuelve (más grande) junto al dueño
export function evolveCompanion(w, n, m, tc) {
  const from = { x: n.x, y: n.y }, nm = tc.nm, sp = tc.sp, lvl = tc.lvl;
  delete tc.evolve;
  const nn = spawnCompanion(w, m);
  if (nn) w.emit({ t: "companion-resummon", id: m.id, sp, lvl, nm, fx: from.x, fy: from.y, x: nn.x, y: nn.y, nid: nn.id });
}
export function dismissCompanion(w, p) {
  for (const e of followersOf(w, p)) {
    if (!e.comp) continue;
    const inst = Inv.instOf(p, e.ball); if (inst) inst.comp.hp = e.hp;
    e.dead = true; e.hp = 0; w.grid.release(e.x, e.y, e.id); e.gen.alive--;
    w.ents.delete(e.id); w.emit({ t: "remove", id: e.id });
  }
}
export function spawnCompanion(w, p) {
  const inst = Comp.activeBall(p); if (!inst || p.dead) return null;
  inst.comp.nm = inst.comp.nm || Comp.randomName(w.rng);          // bolas antiguas sin nombre
  delete inst.comp.evolve;
  dismissCompanion(w, p);
  const gen = { name: inst.comp.sp, rect: [p.x - 2, p.y - 2, p.x + 2, p.y + 2], alive: 0, max: 0, respawn: false };
  if (!w.npcDb[gen.name]) return null;
  const n = spawnFrom(w, gen); if (!n) return null;
  Object.assign(n, { master: p.id, summonedAt: w.time, noDrop: true, side: p.side, comp: true, ball: inst.uid, exp: 0, noDieRemainExp: 0 });
  refreshCompanion(w, n, p);
  return n;
}
// Usar una bola: la elige y la invoca (la que estaba elegida se guarda); usar la elegida la guarda. Sin invocación si ya no hay compañero.
export function toggleCompanion(w, p, inst) {
  if (p.dead) return false;
  const c = inst.comp, out = followersOf(w, p).some(e => e.comp && e.ball === inst.uid);
  if (c.down) return w.reject(p, { t: "use" }, "tu compañero está inconsciente: llévalo al hospital de compañeros");
  if (c.on && out) { c.on = false; dismissCompanion(w, p); w.emit({ t: "companion", id: p.id, sp: c.sp, on: false, nm: c.nm }); return true; }
  if (w.fightZone) return w.reject(p, { t: "use" }, "no en zonas de lucha");
  for (const b of p.bag) if (b.comp) b.comp.on = false;
  c.on = true;
  if (!spawnCompanion(w, p)) { c.on = false; return w.reject(p, { t: "use" }, "no hay sitio"); }
  w.emit({ t: "companion", id: p.id, sp: c.sp, on: true, lvl: c.lvl, nm: c.nm });
  return true;
}

// Un monstruo golpea a un compañero: vida y defensa del compañero; al caer pierde experiencia y quizá un nivel (companion.penalize)
function companionStruck(w, n, t) {
  const miss = () => w.emit({ t: "miss", id: t.id, from: n.id });
  if (R.dice(w.rng, 1, 100) > R.hitChance(n.cfg.hitRatio, t.cfg.defenseRatio, n.dir === t.dir)) return miss();
  const tc = Inv.instOf(w.ents.get(t.master), t.ball)?.comp;
  const dmg = Math.max(1, Math.round(R.npcMelee(w.rng, n).damage * (tc ? Tal.takenFactor(w, t, tc) : 1)));
  Boss.onBossHit(w, n);
  companionHurt(w, n, t, dmg);
}
// Daño directo a un compañero (golpe de monstruo, brasas, drenaje, reflejo...). Al caer pierde experiencia y quizá un nivel (companion.penalize)
export function companionHurt(w, n, t, dmg) {
  if (t.dead) return;
  t.hp -= dmg; t.hurtAt = w.time;
  w.emit({ t: "damage", id: t.id, from: n.id, amount: dmg, hp: Math.max(0, t.hp), max: t.maxHp });
  if (t.hp > 0) {
    if (!w.busy(t) || t.act === ACT.DAMAGE) { w.setAct(t, ACT.DAMAGE, t.dur.damage); t.busyUntil = w.time + t.dur.damage; }
    return;
  }
  const m = w.ents.get(t.master), inst = m && Inv.instOf(m, t.ball);
  if (inst) { inst.comp.on = false; inst.comp.down = true; inst.comp.hp = 0; Comp.penalize(w, m, inst); w.emit({ t: "companion", id: m.id, sp: inst.comp.sp, on: false, fainted: true, nm: inst.comp.nm }); }
  t.noDrop = true; t.noDieRemainExp = 0;
  for (const e of w.ents.values()) if (e.target === t.id) e.target = null;
  killNpc(w, t, null);
}
