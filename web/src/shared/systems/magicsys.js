// Lanzar y aprender hechizos.
import { ACT, PLAYER, dist, dirTo } from "../const.js";
import { dice } from "../rules.js";
import { gainSSN } from "../skills.js";
import { EQUIP } from "../items.js";
import * as M from "../magic.js";
import { damageNpc } from "./combatsys.js";
import { summonFor, spawnCompanion } from "./npcsys.js";
import { activeBall } from "./companion.js";
import { sget, sset, sclear } from "./status.js";
import { addField, DYN, iceResisted, poison } from "./fields.js";
import { newInst } from "./itemsys.js";
import { groundPush, groundTop, groundPop } from "./ground.js";
import * as Inv from "../inventory.js";
import * as Sch from "./schools.js";
import * as Tal from "./talents.js";

// RequestStudyMagicHandler: hace falta Int >= ReqInt y pagar el coste (negativo = no se vende).
export function learn(w, p, id) {
  const sp = w.magic[id];
  if (!sp) return w.reject(p, { t: "learn" }, "no existe");
  if (p.magic[id]) return w.reject(p, { t: "learn" }, "ya la conoces");
  if (sp.cost < 0) return w.reject(p, { t: "learn" }, "no se vende");
  if (!M.MAGIC_MODE.free && p.stats.int < sp.reqInt) return w.reject(p, { t: "learn" }, "Int " + sp.reqInt + " necesaria");
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
  if (sp && M.MAGIC_MODE.free) p.magic[cmd.spell] = 1;
  const granted = !!sp && M.MAGIC_MODE.schools && !!Sch.spellSchool(sp);        // las magias de escuela las da el summon: no hay que aprenderlas
  if (!sp || (!p.magic[cmd.spell] && !granted)) return w.reject(p, cmd, "no conoces ese hechizo");
  if (!M.SUPPORTED_TYPES.has(sp.type)) return w.reject(p, cmd, "aún no disponible");
  // sin escudo ni arma a dos manos; en la mano derecha, solo varitas (tipos 34-39)
  if (M.MAGIC_MODE.free) return sp;
  if (M.MAGIC_MODE.schools && Sch.isSupportSpell(sp)) return w.reject(p, cmd, "esa magia es de los Dummy");
  const school = M.MAGIC_MODE.schools ? Sch.spellSchool(sp) : null;
  if (M.MAGIC_MODE.schools && !school) return w.reject(p, cmd, "solo se lanza la magia de la escuela de tu summon");
  if (school) {                                                       // magia de escuela: la lanza el summon de esa escuela, con su maná
    const n = Sch.activeSchoolSummon(w, p, school);
    if (!n) return w.reject(p, cmd, "necesitas un summon de la escuela " + Sch.SCHOOL_NAMES[school]);
    const comp = Inv.instOf(p, n.ball)?.comp, need = comp && Sch.spellLevel(w.magic, school, cmd.spell, comp.sp);
    if (need == null) return w.reject(p, cmd, "tu summon no domina esa magia");
    if (comp.lvl < need) return w.reject(p, cmd, "tu summon necesita nivel " + need);
    if ((n.mp ?? 0) < Tal.manaOf(w, cmd.spell)) return w.reject(p, cmd, "tu summon no tiene maná");
    return sp;                                                        // lo lanza el summon: no importan las manos del jugador
  }
  if (p.equip[EQUIP.LHAND] !== undefined || p.equip[EQUIP.TWOHAND] !== undefined) return w.reject(p, cmd, "quítate el escudo y las armas a dos manos");
  if (p.equip[EQUIP.RHAND] !== undefined && !(p.eff.wtype >= 34 && p.eff.wtype <= 39)) return w.reject(p, cmd, "solo se lanza con las manos libres o con una varita");
  if (p.mp < M.manaCost(p, sp)) return w.reject(p, cmd, "maná insuficiente");
  return sp;
}

// Elegir el hechizo en el libro: el personaje empieza a lanzarlo (animación) y espera el objetivo.
export function prepare(w, p, cmd) {
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
  if (!pre && w.busy(p)) return w.reject(p, cmd, "ocupado");
  if (w.time - (p.lastCast ?? -1e9) < M.CAST_COOLDOWN_MS) return w.reject(p, cmd, "demasiado rápido");
  const sp = usable(w, p, cmd); if (!sp) return false;
  const x = cmd.x | 0, y = cmd.y | 0;
  if (!w.grid.inside(x, y) || dist(p, { x, y }) > 14) return w.reject(p, cmd, "demasiado lejos");
  const cost = M.manaCost(p, sp);
  if (sp.category === 1 && w.safeAt(p.x, p.y)) return w.reject(p, cmd, "zona segura");   // _PlayerMagicHandler: no se lanzan hechizos de ataque desde una zona sin ataque

  p.lastCast = w.time;
  p.lastCombat = w.time;
  if (x !== p.x || y !== p.y) p.dir = dirTo(p.x, p.y, x, y) || p.dir;
  // con el hechizo ya preparado, la animación de lanzar ya se hizo al elegirlo: solo queda soltarlo
  const wait = pre ? Math.max(0, p.busyUntil - w.time) : 0, ms = pre ? (wait || 160) : M.CAST_MS;
  p.prep = null;
  if (!pre || !wait) { w.setAct(p, ACT.MAGIC, ms); p.busyUntil = w.time + ms; }
  w.emit({ t: "cast", id: p.id, spell: cmd.spell, x, y, attr: sp.attr, type: sp.type });
  command(w, p, sp, cmd.spell, x, y);
  w.after(pre ? wait + 80 : ms, () => resolve(w, p, cmd.spell, sp, x, y, cost));
  return true;
}

// Estilo «comando»: el summon de la escuela se gira hacia el objetivo, hace el gesto y dice el nombre de la magia sobre su cabeza
function command(w, p, sp, id, x, y) {
  const school = M.MAGIC_MODE.schools ? Sch.spellSchool(sp) : null, n = school && Sch.activeSchoolSummon(w, p, school);
  if (!n) return;
  if (x !== n.x || y !== n.y) n.dir = dirTo(n.x, n.y, x, y) || n.dir;
  if (n.dur && !(n.frozenUntil > w.time)) { w.setAct(n, ACT.ATTACK, n.dur.attack); n.busyUntil = w.time + n.dur.attack; }
  w.emit({ t: "dummy-cast", id: p.id, nid: n.id, txt: sp.name.replace(/-/g, " ") + "!" });
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
  return M.resists(w.rng, power, rr);
}

function resolve(w, p, id, sp, x, y, cost) {
  if (p.dead) return;
  // ¿sale el hechizo?
  const sch = M.MAGIC_MODE.free || !M.MAGIC_MODE.schools ? null : Sch.spellSchool(sp), sm = sch && Sch.activeSchoolSummon(w, p, sch);
  const chance = M.castChance(p, id);                                  // las magias de escuela las lanza el summon: no fallan por la habilidad del jugador
  if (!sch && !M.MAGIC_MODE.free && chance < 100 && dice(w.rng, 1, 100) > chance) { w.emit({ t: "castfail", id: p.id }); return; }
  if (!sch && !M.MAGIC_MODE.free && (p.hunger <= 10 || p.sp <= 0) && dice(w.rng, 1, 1000) <= 100) { w.emit({ t: "castfail", id: p.id }); return; }
  let schoolMult = 1;
  if (sch) {                                                          // paga y lanza el summon de la escuela
    const mana = Tal.manaOf(w, id);
    if (!sm || (sm.mp ?? 0) < mana) { w.emit({ t: "nomagic", id: p.id }); return; }
    sm.mp -= mana;
    const comp = Inv.instOf(p, sm.ball)?.comp;
    if (comp) { comp.mp = Math.floor(sm.mp); schoolMult = Tal.factors(comp).spell * (Sch.isTier2(comp.sp) ? Sch.TIER_MULT.dmg : 1) * Sch.levelPower(comp.lvl); }
    sm.castAt = w.time;
  } else p.mp = Math.max(0, p.mp - cost);
  gainSSN(p, 4, 1);
  sclear(w, p, "invis");                                              // lanzar un hechizo rompe la invisibilidad
  let power = M.castPower(p, id);
  if (id >= 80 || sp.type === 28) power += 10000;                     // los hechizos de 9º círculo y rompe-armaduras no se resisten
  const secs = (sp.last || 0) * 1000;

  // daño mágico a un monstruo: resistencia, absorción, protección, y la mitad de experiencia en golpes de zona
  const hurt = (tgt, n, d, k, half = false) => {
    if (!tgt || tgt.kind !== "npc" || tgt.dead) return null;
    if (resist(w, tgt, power)) { w.emit({ t: "resist", id: tgt.id }); return null; }
    if (tgt.cfg.actionLimit === 1 || tgt.cfg.actionLimit === 2 || tgt.cfg.actionLimit === 4) return null;     // invulnerables
    let dmg = Math.floor(M.spellDamage(w.rng, p, n, d, k) * schoolMult);
    if (tgt.absDamage > 0) { dmg = Math.floor(dmg - dmg * (tgt.absDamage / 100)); if (dmg < 0) dmg = 1; }
    if (sget(w, tgt, "protect") === 2) dmg = Math.floor(dmg / 2);
    damageNpc(w, tgt, dmg, p, null, half);
    return tgt;
  };
  const freeze = (tgt, s) => {
    if (!tgt || tgt.dead || tgt.kind !== "npc" || sget(w, tgt, "ice")) return;
    if (!iceResisted(w, tgt)) sset(w, tgt, "ice", 1, s * 1000);
  };
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
        const heal = dice(w.rng, sp.v4, sp.v5) + sp.v6;
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
        if (target.kind === "player" && ((target.eff.addPR || 0) >= 500 || sget(w, target, "hold"))) break;
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
      area(sp.v2, sp.v3, t => { if (hurt(t, sp.v4, sp.v5, sp.v6, true)) freeze(t, sp.v10); });
      break;
    case 25:                                                           // área sin centro, con daño v4..v6
      area(sp.v2, sp.v3, t => hurt(t, sp.v4, sp.v5, sp.v6, true));
      break;
    case 26:                                                           // Blizzard: línea de hielo
      line(t => { if (hurt(t, sp.v7, sp.v8, sp.v9, true)) freeze(t, sp.v10); });
      area(sp.v2, sp.v3, t => { if (hurt(t, sp.v7, sp.v8, sp.v9, true)) freeze(t, sp.v10); });
      if (hurt(target, sp.v4, sp.v5, sp.v6)) freeze(target, sp.v10);
      break;
    case 28:                                                           // rompe-armaduras: daño de zona (el desgaste solo afecta a jugadores)
      area(sp.v2, sp.v3, t => hurt(t, sp.v7, sp.v8, sp.v9, true));
      break;
    case 9: {                                                          // Summon Creature: sobre un jugador (uno mismo); no en zonas de lucha
      if (target && target.kind === "player" && !w.fightZone) {
        const n = activeBall(p) ? spawnCompanion(w, p) : summonFor(w, p, 0, M.MAGIC_MODE.free);   // con bola elegida: siempre esa especie
        if (!n) w.emit({ t: "nomagic", id: p.id });
      }
      break;
    }
    case 29:                                                           // Cancellation: quita los efectos a un jugador
      if (target && target.kind === "player" && !target.dead) for (const k of ["invis", "ice", "hold", "protect", "berserk", "confuse"]) sclear(w, target, k);
      break;
    case 33:                                                           // Scan
      if (target && !resist(w, target, power))
        w.emit({ t: "scan", id: p.id, text: target.kind === "player" ? ` Player: ${target.name} HP:${target.hp} MP:${target.mp}.` : ` NPC: ${target.name} HP:${target.hp} MP:0` });
      break;
    default: break;                                                    // 16, 31, 32: solo afectan a otros jugadores
  }
  w.emit({ t: "spell", id: sm ? sm.id : p.id, spell: id, x, y, attr: sp.attr, type: sp.type });
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
