// Monstruos: aparición en sus generadores, IA, ataque, muerte y botín.
import { ACT, DX, DY, CORPSE_MS, CHASE_LIMIT, dirTo, dist, mobDurations } from "../const.js";
import * as R from "../rules.js";
import { greedyStep } from "../path.js";
import { rollKillDrop } from "../drops.js";
import { newInst } from "./itemsys.js";
import { groundPush } from "./ground.js";
import { giveExp, npcStrikes, damagePlayer } from "./combatsys.js";
import { sget } from "./status.js";
import * as Comp from "./companion.js";
import * as Inv from "../inventory.js";

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
    if (g.boss) n.boss = g.boss;
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
    damagePlayer(w, e, Math.max(0, dmg), n);
  }
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
    giveExp(w, p, xp);
    Comp.onKill(w, p, n, xp);                                    // contador de bolas y experiencia del compañero
  }
  n.noDieRemainExp = 0;
  const drop = n.noDrop ? null : rollKillDrop(w.rng, n, { rating: p?.rating || 0, data: w.data, addGold: p?.eff?.addGold || 0 });
  if (drop && w.data.item(drop.id)) w.after(n.dur.dying * 0.6, () => groundPush(w, n.x, n.y, newInst(w, drop.id, drop.count, drop)));
  n.gen.alive--;
  if (n.gen.respawn !== false && !n.master) w.after(n.cfg.regenTime, () => { if (n.gen.alive < n.gen.max) spawnFrom(w, n.gen); });
  w.after(n.dur.dying + CORPSE_MS, () => { w.ents.delete(n.id); w.emit({ t: "remove", id: n.id }); });
}

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
  const m = w.ents.get(n.master);
  if (!m || m.dead || (!n.comp && w.time - n.summonedAt > SUMMON_MS)) return killNpc(w, n, null);
  if (n.comp) refreshCompanion(w, n, m);
  let best = null, bd = 1e9;
  // Objetivo marcado por el dueño (Ctrl+Q): se ataca aunque el compañero esté en paz; sin objetivo, solo en modo ataque
  const ct = n.comp && n.cTarget && w.ents.get(n.cTarget);
  if (ct && !ct.dead && ct.kind === "npc" && dist(m, ct) <= 18) { best = ct; bd = dist(n, ct); }
  else {
    n.cTarget = null;
    const calm = n.comp && Inv.instOf(m, n.ball)?.comp.mode === "peace";
    if (!calm) for (const e of w.ents.values()) {
      if (e.kind !== "npc" || e.dead || e.master || e.cfg.actionLimit) continue;
      const d = dist(n, e);
      if (d <= Math.max(n.cfg.searchRange, 6) && dist(m, e) <= 12 && d < bd) { best = e; bd = d; }
    }
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
    const dmg = n.comp ? Math.max(1, n.dmgNow + R.dice(w.rng, 1, 3) - 2) : R.npcMelee(w.rng, n).damage;
    t.hp -= dmg;
    w.emit({ t: "damage", id: t.id, from: n.id, amount: dmg, hp: Math.max(0, t.hp), max: t.maxHp });
    if (t.hp <= 0) {
      t.noDrop = true; t.noDieRemainExp = 0;
      const m = w.ents.get(n.master), inst = n.comp && m && Inv.instOf(m, n.ball);
      if (inst) Comp.addExp(w, m, inst, Math.floor(t.exp / 3 / 2));       // el compañero gana la mitad; el dueño nada
      return killNpc(w, t, null);
    }
    const m = w.ents.get(n.master);
    if (n.comp ? (!t.target || R.dice(w.rng, 1, 3) === 1) : (m && !t.target)) t.target = n.comp ? n.id : m.id;   // el monstruo herido por el compañero se vuelve contra él
    if (!w.busy(t) || t.act === ACT.DAMAGE) { w.setAct(t, ACT.DAMAGE, t.dur.damage); t.busyUntil = w.time + t.dur.damage; }
  });
}

export function npcThink(w, n) {
  if (n.dead || w.time < n.nextAct || w.busy(n)) return;
  if (n.master) { n.nextAct = w.time + n.cfg.actionTime; return followerThink(w, n); }
  n.nextAct = w.time + n.cfg.actionTime * (sget(w, n, "ice") ? 1.5 : 1);       // hielo: un 50 % más lento
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
  // La vida es del compañero y viaja con la bola (c.hp): al invocarlo vuelve con la que tenía; al subir de nivel conserva la proporción
  if (!n.hpInit) { n.hpInit = true; n.maxHp = st.hp; n.hp = Math.max(1, Math.min(st.hp, c.hp ?? st.hp)); }
  else if (n.maxHp !== st.hp) { const k = n.hp / n.maxHp; n.maxHp = st.hp; n.hp = Math.max(1, Math.round(st.hp * k)); }
  else if (n.hp < n.maxHp && w.time - (n.hurtAt || -1e9) > 8000 && w.time - (n.regenAt || 0) > 6000) { n.regenAt = w.time; n.hp = Math.min(n.maxHp, n.hp + Math.ceil(n.maxHp * 0.02)); }   // recuperación lenta fuera de combate
  c.hp = n.hp; c.max = n.maxHp;
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
  const dmg = R.npcMelee(w.rng, n).damage;
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
