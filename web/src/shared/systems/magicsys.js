// Lanzar y aprender hechizos.
import { ACT, PLAYER, dist, dirTo } from "../const.js";
import * as Bal from "../balance.js";
import { dice } from "../rules.js";
import { gainSSN } from "../skills.js";
import * as Feign from "./feign.js";
import { EQUIP } from "../items.js";
import * as M from "../magic.js";
import { damageNpc, damagePlayer, canFight } from "./combatsys.js";
import { summonFor, spawnCompanion } from "./npcsys.js";
import { activeBall } from "./companion.js";
import { sget, sset, sclear } from "./status.js";
import { addField, DYN, iceResisted, poison } from "./fields.js";
import { newInst } from "./itemsys.js";
import { groundPush, groundTop, groundPop } from "./ground.js";
import * as Inv from "../inventory.js";

// RequestStudyMagicHandler: hace falta Int >= ReqInt y pagar el coste (negativo = no se vende).
// (Los hechizos de los compañeros son otro sistema, independiente: petgrimoire.js.)
export function learn(w, p, id) {
  const sp = w.magic[id];
  if (!sp) return w.reject(p, { t: "learn" }, "no existe");
  if (p.magic[id]) return w.reject(p, { t: "learn" }, "ya la conoces");
  if (sp.cost < 0) return w.reject(p, { t: "learn" }, "no se vende");
  if (!M.freeFor(p) && p.stats.int < sp.reqInt) return w.reject(p, { t: "learn" }, "Int " + sp.reqInt + " necesaria");
  if (p.gold < sp.cost) return w.reject(p, { t: "learn" }, "oro insuficiente");
  p.gold -= sp.cost;
  p.magic[id] = 1;
  w.recalc(p);
  w.emit({ t: "learned", id: p.id, spell: id });
  return true;
}

// Comprobaciones comunes de lanzar/preparar (UseMagic del cliente original)
function usable(w, p, cmd) {
  const sp = w.magic[cmd.spell];
  if (sp && M.freeFor(p)) p.magic[cmd.spell] = 1;
  if (!sp || !p.magic[cmd.spell]) return w.reject(p, cmd, "no conoces ese hechizo");
  Feign.stand(w, p);                                     // lanzar también te levanta
  if (!M.SUPPORTED_TYPES.has(sp.type)) return w.reject(p, cmd, "aún no disponible");
  // sin escudo ni arma a dos manos; en la mano derecha, solo varitas (tipos 34-39)
  if (M.freeFor(p)) return sp;
  if (p.equip[EQUIP.LHAND] !== undefined || p.equip[EQUIP.TWOHAND] !== undefined) return w.reject(p, cmd, "quítate el escudo y las armas a dos manos");
  if (p.equip[EQUIP.RHAND] !== undefined && !(p.eff.wtype >= 34 && p.eff.wtype <= 39)) return w.reject(p, cmd, "solo se lanza con las manos libres o con una varita");
  if (p.mp < M.manaCost(p, sp, cmd.spell, !!w.fightZone)) return w.reject(p, cmd, "maná insuficiente");
  return sp;
}

// Elegir el hechizo en el libro: el personaje empieza a lanzarlo (animación) y espera el objetivo.
// Correr/andar y lanzar: el original frena al personaje (cada paso termina antes de empezar el gesto de lanzar, Game.cpp _bCheckMagicCast / m_cCommand=OBJECTSTOP).
// Si lo único que ocupa al jugador es el paso en curso, la orden espera a que acabe y se ejecuta entonces.
function afterStep(w, p, cmd, fn) {
  if (!w.busy(p) || (p.act !== ACT.MOVE && p.act !== ACT.RUN)) return false;
  w.after(Math.max(1, p.busyUntil - w.time), () => { if (!p.dead) fn(w, p, cmd); });
  return true;
}
export function prepare(w, p, cmd) {
  if (!p.dead && afterStep(w, p, cmd, prepare)) return true;
  if (p.dead || w.busy(p)) return w.reject(p, cmd, "ocupado");
  const sp = usable(w, p, cmd); if (!sp) return false;
  p.prep = { spell: cmd.spell, at: w.time };
  p.lastCombat = w.time;
  w.setAct(p, ACT.MAGIC, M.CAST_MS);
  p.busyUntil = w.time + M.CAST_MS;
  w.emit({ t: "prepare", id: p.id, spell: cmd.spell });
  return true;
}

export function cast(w, p, cmd) {
  const pre = !!(cmd.pre && p.prep && p.prep.spell === cmd.spell && w.time - p.prep.at < 120000);
  if (!pre && !p.dead && afterStep(w, p, cmd, cast)) return true;
  if (!pre && w.busy(p)) return w.reject(p, cmd, "ocupado");
  if (w.time - (p.lastCast ?? -1e9) < M.CAST_COOLDOWN_MS) return w.reject(p, cmd, "demasiado rápido");
  const sp = usable(w, p, cmd); if (!sp) return false;
  if (sget(w, p, "inhibit")) return w.reject(p, cmd, "inhibido");
  const x = cmd.x | 0, y = cmd.y | 0;
  if (!w.grid.inside(x, y) || dist(p, { x, y }) > 11) return w.reject(p, cmd, "demasiado lejos");   // alcance 11 (HG.cpp:10241)
  const cost = M.manaCost(p, sp, cmd.spell, !!w.fightZone);
  if (sp.category === 1 && w.safeAt(p.x, p.y)) return w.reject(p, cmd, "zona segura");   // _PlayerMagicHandler: no se lanzan hechizos de ataque desde una zona sin ataque

  p.lastCast = w.time;
  p.lastCombat = w.time;
  if (x !== p.x || y !== p.y) p.dir = dirTo(p.x, p.y, x, y) || p.dir;
  // con el hechizo ya preparado, la animación de lanzar ya se hizo al elegirlo: solo queda soltarlo
  const wait = pre ? Math.max(0, p.busyUntil - w.time) : 0, ms = pre ? (wait || 160) : M.CAST_MS;
  p.prep = null;
  if (!pre || !wait) { w.setAct(p, ACT.MAGIC, ms); p.busyUntil = w.time + ms; }
  w.emit({ t: "cast", id: p.id, spell: cmd.spell, x, y, attr: sp.attr, type: sp.type });
  // HG.cpp PlayerMagicHandler resuelve al recibir la orden; aquí la animación retrasa el golpe, así que se sigue al ocupante de la casilla
  // hasta que sale el hechizo (si no, un monstruo en movimiento lo esquiva)
  const tid = w.grid.occupant(x, y);
  w.after(pre ? wait + 80 : ms, () => {
    const t = tid === undefined ? null : w.ents.get(tid);
    const live = t && !t.dead && !t.feign && t.id !== p.id;
    resolve(w, p, cmd.spell, sp, live ? t.x : x, live ? t.y : y, cost);
  });
  return true;
}

const occ = (w, x, y) => { const oid = w.grid.occupant(x, y); return oid === undefined ? null : w.ents.get(oid) || null; };

// bCheckResistingMagicSuccess: la protección contra magia (2) resiste todo lo normal y la absoluta (5) todo
function resist(w, tgt, power) {
  const pr = sget(w, tgt, "protect");
  if (pr === 5) return true;
  if (power < 1000 && pr === 2) return true;
  if (power >= 10000) power -= 10000;
  let rr;
  if (tgt.kind === "npc") rr = tgt.cfg.resistMagic;
  else {
    rr = (tgt.skills[3] || 0) + (tgt.eff.addMR || 0);
    if (tgt.stats.mag > 50) rr += tgt.stats.mag - 50;
  }
  const r = M.resists(w.rng, power, rr);
  if (r && tgt.kind === "player") gainSSN(tgt, 3, 1);                   // CheckResistingMagicSuccess (combat.cpp:54): SkillUp(MAGICRES, 1)
  return r;
}

function resolve(w, p, id, sp, x, y, cost) {
  if (p.dead) return;
  // ¿sale el hechizo?
  const chance = M.castChance(p, id, w.weather | 0);
  const wb = M.weatherBonus(id, w.weather | 0);
  if (!M.freeFor(p) && chance < 100 && dice(w.rng, 1, 100) > chance) { w.emit({ t: "castfail", id: p.id }); return; }
  if (!M.freeFor(p) && (p.hunger <= 10 || p.sp <= 0) && dice(w.rng, 1, 1000) <= 100) { w.emit({ t: "castfail", id: p.id }); return; }
  p.mp = Math.max(0, p.mp - cost);
  gainSSN(p, 4, 1);
  sclear(w, p, "invis");                                              // lanzar un hechizo rompe la invisibilidad
  let power = M.castPower(p, id);
  if (id >= 80 || sp.type === 28) power += 10000;                     // los hechizos de 9º círculo y rompe-armaduras no se resisten
  const secs = (sp.last || 0) * 1000;

  // daño mágico a un monstruo: resistencia, absorción, protección, y la mitad de experiencia en golpes de zona
  const hurt = (tgt, n, d, k, half = false) => {
    if (tgt && tgt.kind === "player") return hurtPlayer(tgt, n, d, k);
    if (!tgt || tgt.kind !== "npc" || tgt.dead) return null;
    if (tgt.master && (tgt.master === p.id || (p.party && w.ents.get(tgt.master)?.party?.id === p.party.id))) return null;   // los hechizos de zona no dañan a tus summons ni a los de tu grupo
    if (resist(w, tgt, power)) { w.emit({ t: "resist", id: tgt.id }); return null; }
    if (tgt.cfg.actionLimit === 1 || tgt.cfg.actionLimit === 2 || tgt.cfg.actionLimit === 4 || tgt.cfg.actionLimit === 5) return null;     // invulnerables
    let dmg = Math.floor(M.spellDamage(w.rng, p, n, d, k + wb, !!w.fightZone) * Bal.spellDmgMul(id));
    if (tgt.absDamage > 0) { dmg = Math.floor(dmg - dmg * (tgt.absDamage / 100)); if (dmg < 0) dmg = 1; }
    if (sget(w, tgt, "protect") === 2) dmg = Math.floor(dmg / 2);
    damageNpc(w, tgt, dmg, p, null, half);
    return tgt;
  };
  // Effect_Damage_Spot (HG.cpp ~18047) contra un jugador: mismo daño base y bonos del lanzador; el objetivo resiste (bCheckResistingMagicSuccess),
  // reduce por dice(1, vit/10)-1, suerte (dice(1,10)<5 y hp<=daño -> 1) y Protect From Magic a la mitad; absorción elemental y PFM dentro de damagePlayer.
  // Solo con canFight (PvP del mapa, fuera de zonas seguras, no party/mismo bando); nunca a uno mismo.
  const hurtPlayer = (tgt, n, d, k) => {
    if (!canFight(w, p, tgt)) return null;
    if (resist(w, tgt, power)) { w.emit({ t: "resist", id: tgt.id }); return null; }
    let dmg = Math.floor(M.spellDamage(w.rng, p, n, d, k + wb, !!w.fightZone) * Bal.spellDmgMul(id));
    if (tgt.stats.vit >= 10) dmg -= Math.max(0, dice(w.rng, 1, Math.floor(tgt.stats.vit / 10)) - 1);
    if (dmg < 0) dmg = 0;
    if (dice(w.rng, 1, 10) < 5 && tgt.hp <= dmg) dmg = 1;
    if (sget(w, tgt, "protect") === 2) dmg = Math.floor(dmg / 2);
    damagePlayer(w, tgt, dmg, p, sp.attr === 3 ? "fire" : sp.attr === 4 ? "ice" : "mag");
    return tgt;
  };
  const freeze = (tgt, s) => {
    if (!tgt || tgt.dead || (tgt.kind !== "npc" && tgt.kind !== "player") || sget(w, tgt, "ice")) return;
    if (!iceResisted(w, tgt)) sset(w, tgt, "ice", 1, s * 1000);
  };
  // ICE (HG.cpp:11517): a un jugador neutral (IsNeutral, :11531) no le afecta ni el daño ni el hielo; el resto como un monstruo.
  const iceHurt = (t, n, d, k, half) => (t && t.kind === "player" && !t.side) ? null : hurt(t, n, d, k, half);
  const area = (rx, ry, fn) => { for (let iy = y - ry; iy <= y + ry; iy++) for (let ix = x - rx; ix <= x + rx; ix++) fn(occ(w, ix, iy), ix, iy); };
  // línea del lanzador al objetivo: cada paso golpea la casilla y sus cuatro vecinas
  const line = fn => {
    for (let i = 2; i < 10; i++) {
      const [tx, ty] = M.linePoint(p.x, p.y, x, y, i);
      for (const [ax, ay] of [[tx, ty], [tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]]) fn(occ(w, ax, ay));
      if (Math.abs(tx - x) <= 1 && Math.abs(ty - y) <= 1) break;
    }
  };
  const target = occ(w, x, y);

  switch (sp.type) {
    case 1:                                                            // daño a un objetivo
      hurt(target, sp.v4, sp.v5, sp.v6);
      break;
    case 2: {                                                          // curación
      const t = target;
      if (t && t.kind === "player" && !t.dead && t.hp < t.maxHp) {
        const heal = Bal.scale(dice(w.rng, sp.v4, sp.v5) + sp.v6, Bal.healMul());
        t.hp = Math.min(t.maxHp, t.hp + heal);
        w.emit({ t: "heal", id: t.id, amount: heal, by: p.id });
      }
      break;
    }
    case 3:                                                            // daño en área con el centro aparte
    case 22:                                                           // temblor: igual que el área en el servidor
      hurt(target, sp.v4, sp.v5, sp.v6);
      area(sp.v2, sp.v3, t => hurt(t, sp.v7, sp.v8, sp.v9, true));
      break;
    case 5:                                                            // baja la resistencia de jugadores (los monstruos no la tienen)
      for (const t of [target]) if (t && t.kind === "player") t.sp = Math.max(0, t.sp - (dice(w.rng, sp.v4, sp.v5) + sp.v6));
      area(sp.v2, sp.v3, t => { if (t && t.kind === "player") t.sp = Math.max(0, t.sp - (dice(w.rng, sp.v7, sp.v8) + sp.v9)); });
      break;
    case 4: case 6: break;
    case 7: {                                                          // recupera resistencia de los jugadores de la zona
      const up = (t, n, d, k) => { if (t && t.kind === "player" && !t.dead) t.sp = Math.min(t.maxSp, t.sp + dice(w.rng, n, d) + k); };
      up(target, sp.v4, sp.v5, sp.v6);
      area(sp.v2, sp.v3, t => up(t, sp.v7, sp.v8, sp.v9));
      break;
    }
    case 8:                                                            // Recall: solo sobre uno mismo
      if (sp.v4 === 1 && target === p && w.hooks?.recall) w.hooks.recall(p);
      break;
    case 10: {                                                         // Create Food
      if (w.grid.blocked(x, y)) break;
      const food = dice(w.rng, 1, 2) === 1 ? 99 : 98;                  // Meat / Baguette
      if (w.data.item(food)) groundPush(w, x, y, newInst(w, food, 1));
      break;
    }
    case 11:                                                           // escudos y protecciones
      if (target && !target.dead && !sget(w, target, "protect") && !(target.kind === "npc" && target.cfg.actionLimit)) sset(w, target, "protect", sp.v4, secs);
      break;
    case 12:                                                           // Hold Person / Paralyze
      if (target && !target.dead && !resist(w, target, power)) {
        if (target.kind === "npc" && (target.cfg.magicLevel >= 6 || sget(w, target, "hold"))) break;
        // HOLDOBJECT (HG.cpp:11102) contra jugador: nada si ya está inmovilizado, si lanzador u objetivo están en casilla segura/sin ataque (iGetAttribute 0x6),
        // si son del mismo grupo (m_iPartyID) o si m_iAddPR >= 500.
        if (target.kind === "player" && ((target.eff.addPR || 0) >= 500 || sget(w, target, "hold") || w.safeAt(p.x, p.y) || w.safeAt(target.x, target.y)
          || (p.party && target.party && p.party.id === target.party.id))) break;
        sset(w, target, "hold", sp.v4, secs);
      } else if (target) w.emit({ t: "resist", id: target.id });
      break;
    case 13:                                                           // Invisibility (1) / Detect Invisibility (2)
      if (sp.v4 === 1) {
        if (target && !target.dead && !sget(w, target, "invis") && !(target.kind === "npc" && target.cfg.actionLimit)) {
          sset(w, target, "invis", 1, secs);
          for (const n of w.ents.values()) if (n.target === target.id) n.target = null;     // RemoveFromTarget
        }
      } else if (sp.v4 === 2) {
        for (let iy = y - 8; iy <= y + 8; iy++) for (let ix = x - 8; ix <= x + 8; ix++) { const t = occ(w, ix, iy); if (t) sclear(w, t, "invis"); }
      }
      break;
    case 14:                                                           // campos: fuego, nube venenosa, tormenta de hielo, pinchos
      field(w, p, sp, x, y, secs);
      break;
    case 15: {                                                         // Possession: trae un objeto del suelo
      if (!p.side || target) break;
      const it = groundTop(w, x, y);
      if (!it) break;
      const d = w.data.item(it.id);
      if (!Inv.canCarry(p, w.data, d, it.count, it)) break;
      groundPop(w, x, y);
      Inv.addToBag(p, w.data, it);
      w.recalc(p);
      w.emit({ t: "pickup", id: p.id, item: it.id, count: it.count, x: p.x, y: p.y, attr: it.attr || 0, ...(it.comp ? { comp: { sp: it.comp.sp, lvl: it.comp.lvl } } : {}) });
      break;
    }
    case 17:                                                           // veneno (1) / curar (0)
      if (sp.v4 === 1) {
        if (target && target.kind === "player" && !target.dead && !resist(w, target, power)) {
          const res = (target.skills[23] || 0) + (target.eff.addPR || 0);
          if (dice(w.rng, 1, 100) >= res) poison(w, target, sp.v5);
          else gainSSN(target, 23, 1);                                 // checkResistingPoisonSuccess (combat.cpp:69): SkillUp(POISONRES, 1)
        }
      } else if (target && target.kind === "player") sclear(w, target, "poison");
      break;
    case 18:                                                           // Berserk
      if (sp.v4 === 1 && target && !target.dead && !sget(w, target, "berserk") && !(target.kind === "npc" && (target.cfg.actionLimit || target.cfg.side !== p.side))) sset(w, target, "berserk", 1, secs);
      break;
    case 19:                                                           // rayo lineal
    case 30:
      line(t => hurt(t, sp.v7, sp.v8, sp.v9, true));
      area(sp.v2, sp.v3, t => hurt(t, sp.v7, sp.v8, sp.v9, true));
      hurt(target, sp.v4, sp.v5, sp.v6);
      break;
    case 21:                                                           // área sin centro aparte
      area(sp.v2, sp.v3, t => hurt(t, sp.v7, sp.v8, sp.v9, true));
      break;
    case 23:                                                           // hielo en área
      area(sp.v2, sp.v3, t => { if (iceHurt(t, sp.v4, sp.v5, sp.v6, true)) freeze(t, sp.v10); });
      break;
    case 25:                                                           // área sin centro, con daño v4..v6
      area(sp.v2, sp.v3, t => hurt(t, sp.v4, sp.v5, sp.v6, true));
      break;
    case 26:                                                           // Blizzard: línea de hielo
      line(t => { if (iceHurt(t, sp.v7, sp.v8, sp.v9, true)) freeze(t, sp.v10); });
      area(sp.v2, sp.v3, t => { if (iceHurt(t, sp.v7, sp.v8, sp.v9, true)) freeze(t, sp.v10); });
      if (iceHurt(target, sp.v4, sp.v5, sp.v6)) freeze(target, sp.v10);
      break;
    case 28:                                                           // rompe-armaduras: daño de zona (el desgaste solo afecta a jugadores)
      area(sp.v2, sp.v3, t => hurt(t, sp.v7, sp.v8, sp.v9, true));
      break;
    case 9: {                                                          // Summon Creature: sobre un jugador (uno mismo); no en zonas de lucha
      if (target && target.kind === "player" && !w.fightZone) {
        const n = activeBall(p) ? spawnCompanion(w, p) : summonFor(w, p, 0, M.freeFor(p));   // con bola elegida: siempre esa especie
        if (!n) w.emit({ t: "nomagic", id: p.id });
      }
      break;
    }
    case 29:                                                           // Cancellation (HG.cpp:10595): cualquier objetivo, jugador o monstruo (polimorfia no existe en el port)
      if (target && !target.dead) for (const k of ["invis", "ice", "hold", "protect", "berserk", "confuse", "inhibit"]) sclear(w, target, k);
      break;
    case 33:                                                           // Scan
      if (target && !resist(w, target, power))
        w.emit({ t: "scan", id: p.id, text: target.kind === "player" ? ` Player: ${target.name} HP:${target.hp} MP:${target.mp}.` : ` NPC: ${target.name} HP:${target.hp} MP:0` });
      break;
    case 16:                                                           // Confusion / Illusion: el jugador se mueve al azar (la mitad de los pasos); no sobre uno mismo
      // CONFUSE (HG.cpp:11337): efecto de área (v2 x v3), solo jugadores; salta a los del propio bando (m_side == caster->m_side) y a los ya confundidos.
      area(sp.v2, sp.v3, t => {
        if (!t || t === p || t.kind !== "player" || t.dead || t.side === p.side || sget(w, t, "confuse")) return;
        if (resist(w, t, power)) w.emit({ t: "resist", id: t.id });
        else sset(w, t, "confuse", sp.v4, secs);
      });
      break;
    case 31:                                                           // Inhibition Casting (HG.cpp:10608): sin tirada de resistencia; solo la anula Protect AMP (5)
      if (target && target !== p && target.kind === "player" && !target.dead && sget(w, target, "protect") !== 5) sset(w, target, "inhibit", 1, (sp.last || sp.v4) * 1000);
      break;
    case 32: {                                                         // Resurrection (HG.cpp:10416): el objetivo debe ser un jugador caído; pide confirmación (RequestResurrectPlayer, HG.cpp:38015)
      const down = [...w.ents.values()].find(e => e.kind === "player" && e.dead && e.x === x && e.y === y && e !== p);
      if (!down) break;
      if (!p.gm) {
        if (down.side !== p.side || p.specialAbilityTime) break;   // otro bando o habilidad especial en espera: MAGIC_NOEFFECT (HG.cpp:10419-10423)
        p.specialAbilityTime = SPECABLTYTIMESEC; p.magic[94] = 0;   // el hechizo se gasta hasta que pase la espera (HG.cpp:10425-10428)
      }
      down.beingResurrected = true;
      w.emit({ t: "resurrectask", id: down.id, by: p.id });         // NOTIFY_RESURRECTPLAYER: "Someone intends to resurrect you. Will you revive here?"
      break;
    }
    default: break;
  }
  w.emit({ t: "spell", id: p.id, spell: id, x, y, attr: sp.attr, type: sp.type });
}

// Hechizos de campo (DEF_MAGICTYPE_CREATE_DYNAMIC)
function field(w, p, sp, x, y, secs) {
  const dyn = sp.v10;
  if (dyn === DYN.ICESTORM) { addField(w, dyn, x, y, secs, p.skills[4] || 0, p.id); return; }
  if (![DYN.FIRE, DYN.SPIKE, DYN.PCLOUD].includes(dyn)) return;
  if (sp.v11 === 1) {                                                  // muro: casilla central y v12 a cada lado
    const rx = [0, 1, 1, 0, -1, 1, -1, 0, 1][dirTo(p.x, p.y, x, y)] ?? 1, ry = [0, 0, 1, 1, 1, 0, -1, -1, -1][dirTo(p.x, p.y, x, y)] ?? 0;
    addField(w, dyn, x, y, secs, 0, p.id);
    for (let i = 1; i <= sp.v12; i++) { addField(w, dyn, x + i * rx, y + i * ry, secs, 0, p.id); addField(w, dyn, x - i * rx, y - i * ry, secs, 0, p.id); }
  } else if (sp.v11 === 2) {                                           // campo cuadrado de radio v12
    for (let ix = x - sp.v12; ix <= x + sp.v12; ix++) for (let iy = y - sp.v12; iy <= y + sp.v12; iy++) addField(w, dyn, ix, iy, secs, sp.v5, p.id);
  }
}

// Espera de la habilidad especial (m_iSpecialAbilityTime, Client.h:34 SPECABLTYTIMESEC): HG.cpp:2290 la baja 3 cada 3 s; aquí 1 por segundo.
export const SPECABLTYTIMESEC = 1200;
const WANDS = new Set([865, 866]);                                   // ResurWand MS.20 / MS.10
export function tickResurrection(w, p) {
  if (p.specialAbilityTime > 0) p.specialAbilityTime = Math.max(0, p.specialAbilityTime - 1);
  const it = p.equip[EQUIP.RHAND] !== undefined && Inv.instOf(p, p.equip[EQUIP.RHAND]);
  const wand = it && WANDS.has(it.id) && p.stats.int >= 100 && p.stats.mag >= 100;     // HG.cpp:7973 / 2300
  if (wand && !p.specialAbilityTime) { p.magic[94] = 1; p.wandRes = true; }
  else if (!it || !WANDS.has(it.id)) { if (p.wandRes) { p.magic[94] = 0; p.wandRes = false; } }  // HG.cpp:9502: al quitar la varita se pierde
}

// RequestResurrectPlayer (HG.cpp:38015): acepta o rechaza; sin petición previa no hace nada (el original expulsa)
export function answerResurrect(w, p, cmd) {
  if (!p.beingResurrected) return w.reject(p, cmd, "nadie te resucita");
  p.beingResurrected = false;
  if (!cmd.accept || !p.dead) return true;
  p.dead = false; p.st = {};
  p.hp = Math.floor(p.maxHp / 2);                                    // GetMaxHP() / 2
  if (!w.grid.free(p.x, p.y, p.id)) { const spot = w.freeSpotNear(p.x, p.y); if (spot) { p.x = p.fx = spot[0]; p.y = p.fy = spot[1]; } }
  w.grid.occupy(p.x, p.y, p.id);                                     // revive en el mismo sitio (RequestTeleportHandler a la misma casilla)
  w.setAct(p, 0, 0); p.busyUntil = 0;
  w.emit({ t: "respawn", id: p.id });
  w.emit({ t: "resurrected", id: p.id });
  return true;
}
