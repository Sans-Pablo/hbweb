// Grimorio de los summons de escuela: sistema PROPIO, separado de la magia del jugador (magicsys.js / Magic.cfg del jugador intactos).
// INVENTO del port (petición del diseñador). Los datos de cada hechizo (dados, áreas, congelación) son los de Magic.cfg tal cual.
//  - El Hechicero de mascotas (rol "petmage") enseña al summon hechizos de ataque de SU escuela (fuego/hielo/rayo): comando `pgteach`.
//  - El summon fuera los lanza él, con su maná y desde su casilla: comando `pgcast`. El jugador no gasta maná ni usa su libro.
//  - Lo aprendido se guarda en la bola (comp.grim); las bolas de versiones anteriores (comp.spells) se migran al leerlas.
import { ACT, dist, dirTo } from "../const.js";
import * as Bal from "../balance.js";
import { dice } from "../rules.js";
import * as M from "../magic.js";
import { SCHOOL_OF, TIER2_SET } from "./evolutions.js";
import { look } from "./evolutions.js";
import { damageNpc } from "./combatsys.js";
import { sget, sset } from "./status.js";
import { addField, DYN, iceResisted } from "./fields.js";
import { activeBall } from "./companion.js";
import * as Tal from "./talents.js";
import * as Inv from "../inventory.js";

export const PETMAGE = { role: "petmage", name: "Pet Sorcerer", skin: "Gandlf", reach: 8 };
export const TIER_DMG = 1.25;                                    // especie superior: +25 % de daño mágico
export const COOLDOWN_MS = 1200;                                 // entre dos hechizos del mismo summon
export const RANGE = 14;
export const SCHOOL_NAMES = { fire: "Fire", ice: "Ice", lightning: "Lightning" };

const ATTR = { 2: "lightning", 3: "fire", 4: "ice" };            // Magic.cfg: atributo del hechizo
const OFFENSIVE = new Set([1, 3, 14, 19, 21, 22, 23, 25, 26, 28, 30]);
export const schoolOfSpell = sp => (sp && OFFENSIVE.has(sp.type) ? ATTR[sp.attr] || null : null);
export const schoolOf = species => SCHOOL_OF[species] || null;
export const isTier2 = species => TIER2_SET.has(species);

// ---- catálogo: los hechizos de ataque que se venden, por escuela, ordenados por maná y repartidos entre el nivel 1 y el 50
const cache = new WeakMap();
export function catalog(magic, school) {
  let m = cache.get(magic);
  if (!m) cache.set(magic, (m = {}));
  if (m[school]) return m[school];
  const list = Object.entries(magic).filter(([, sp]) => schoolOfSpell(sp) === school && sp.cost >= 0).sort((a, b) => a[1].mana - b[1].mana || a[0] - b[0]);
  const out = {};
  list.forEach(([id], i) => { out[id] = list.length < 2 ? 1 : Math.round(1 + 49 * i / (list.length - 1)); });
  return (m[school] = out);
}
const base = (magic, school, id) => catalog(magic, school)[id];
// nivel mínimo del summon (la especie superior los desbloquea antes: 80 %)
export const needLevel = (magic, school, id, species) => {
  const b = base(magic, school, id);
  return b === undefined ? null : isTier2(species) ? Math.max(1, Math.round(b * 0.8)) : b;
};
export const intNeeded = (magic, school, id) => { const l = base(magic, school, id); return l === undefined ? null : Math.max(10, 2 * l); };
export const goldCost = (magic, school, id) => { const l = base(magic, school, id); return l === undefined ? null : Math.round(25 * Math.pow(l, 1.7) / 10) * 10; };
export const manaCost = (magic, school, id) => { const l = base(magic, school, id); return l === undefined ? null : Math.round(4 + 1.5 * (l - 1)); };
export const levelPower = lvl => 0.6 + 0.8 * Math.min(50, Math.max(1, lvl)) / 50;           // daño según el nivel del summon (0,6 → 1,4)
export const hitPower = lvl => 40 + 3 * Math.min(50, Math.max(1, lvl));                      // "acierto" contra la resistencia mágica

// ---- lo aprendido (comp.grim; migra comp.spells de versiones anteriores)
export function grimOf(c) {
  if (!c) return [];
  if (!c.grim) c.grim = Array.isArray(c.spells) ? c.spells.map(Number) : [];
  return c.grim;
}
export const knows = (c, id) => grimOf(c).includes(+id);

const near = (w, p, id) => {
  if (p.bot) return true;                                          // los residentes (bots) compran sin desplazarse
  const e = w.ents.get(id); return !!e && e.role === PETMAGE.role && Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= PETMAGE.reach; };

// pgteach {npc, spell}: compra de un hechizo para el summon elegido
export function teach(w, p, cmd) {
  if (!near(w, p, cmd.npc)) return w.reject(p, cmd, "acércate al Hechicero de mascotas");
  const ball = activeBall(p), c = ball?.comp, school = c && schoolOf(c.sp), id = +cmd.spell, sp = w.magic[id];
  if (!school) return w.reject(p, cmd, "elige primero un summon de escuela (fuego, hielo o rayo)");
  if (!sp || schoolOfSpell(sp) !== school) return w.reject(p, cmd, "esa magia no es de la escuela de tu summon");
  const need = needLevel(w.magic, school, id, c.sp), int = intNeeded(w.magic, school, id), gold = goldCost(w.magic, school, id);
  if (need == null) return w.reject(p, cmd, "no se vende");
  if (knows(c, id)) return w.reject(p, cmd, "tu summon ya la conoce");
  if (c.lvl < need) return w.reject(p, cmd, "tu summon necesita nivel " + need);
  if (p.stats.int < int) return w.reject(p, cmd, "Int " + int + " necesaria");
  if (p.gold < gold) { w.emit({ t: "nogold", id: p.id }); return false; }
  p.gold -= gold;
  grimOf(c).push(id);
  w.recalc(p);
  w.emit({ t: "pglearned", id: p.id, spell: id, nm: c.nm, uid: ball.uid, gold });
  return true;
}

// summon del jugador, vivo y fuera, de la escuela dada
export function summonOut(w, p) {
  const act = activeBall(p)?.uid;                                  // el de la bola elegida; si no, cualquiera de escuela
  let any = null;
  for (const e of w.ents.values()) if (e.comp && e.master === p.id && !e.dead && schoolOf(e.name)) { if (e.ball === act) return e; any = any || e; }
  return any;
}

// frases del summon al lanzar (es, en), según su especie; el resto usa la genérica
const LINES = {
  Demon: [["¡Que arda todo!", "Let it all burn!"], ["¡Cenizas y gritos!", "Ashes and screams!"], ["¡El infierno responde!", "Hell answers!"]],
  Frost: [["¡Congélense!", "Freeze!"], ["El invierno ha llegado…", "Winter has come…"], ["Frío eterno:", "Eternal cold:"]],
  Liche: [["Las sombras obedecen…", "The shadows obey…"], ["Tu alma es mía.", "Your soul is mine."], ["Muere…", "Die…"]],
  _: [["¡Allá voy!", "Here I go!"], ["¡Toma esto!", "Take this!"], ["¡Con todo mi poder!", "With all my might!"]],
};

// pgcast {spell, x, y}: el summon fuera lanza un hechizo que conoce
export function cast(w, p, cmd) {
  const n = summonOut(w, p), id = +cmd.spell, sp = w.magic[id];
  if (!n) return w.reject(p, cmd, "saca primero un summon de escuela");
  const comp = Inv.instOf(p, n.ball)?.comp, school = schoolOf(n.name);
  if (!comp || !sp || schoolOfSpell(sp) !== school) return w.reject(p, cmd, "esa magia no es de la escuela de tu summon");
  const need = needLevel(w.magic, school, id, comp.sp);
  if (need == null || !knows(comp, id)) return w.reject(p, cmd, "enséñasela a tu summon en el Hechicero de mascotas");
  if (comp.lvl < need) return w.reject(p, cmd, "tu summon necesita nivel " + need);
  if (p.dead) return false;
  if (w.time - (n.castAt || 0) < COOLDOWN_MS || n.busyUntil > w.time || n.frozenUntil > w.time) return w.reject(p, cmd, "tu summon está ocupado");
  const mana = manaCost(w.magic, school, id);
  if ((n.mp ?? 0) < mana) { w.emit({ t: "nomagic", id: p.id }); return false; }
  const x = cmd.x | 0, y = cmd.y | 0;
  if (!w.grid.inside(x, y) || dist(n, { x, y }) > RANGE) return w.reject(p, cmd, "demasiado lejos");
  if (w.safeAt(n.x, n.y)) return w.reject(p, cmd, "zona segura");
  n.mp -= Tal.saved(w, n, mana);
  comp.mp = Math.floor(n.mp);
  n.castAt = w.time;
  p.lastCombat = w.time;
  if (x !== n.x || y !== n.y) n.dir = dirTo(n.x, n.y, x, y) || n.dir;
  if (n.dur) { w.setAct(n, ACT.ATTACK, n.dur.attack); n.busyUntil = w.time + n.dur.attack; }
  const nm = sp.name.replace(/-/g, " "), L = LINES[look(n.name)] || LINES._, l = L[Math.floor(w.rng() * L.length)];
  w.emit({ t: "dummy-cast", id: p.id, nid: n.id, max: (n.clvl || 0) >= 50, lvl: n.clvl || 0, sc: n.name, txt: nm + "!", es: l[0] + " ¡" + nm + "!", en: l[1] + " " + nm + "!" });
  const mult = Tal.factors(comp).spell * (isTier2(comp.sp) ? TIER_DMG : 1) * levelPower(comp.lvl);
  w.after(n.dur ? n.dur.attack : 400, () => resolve(w, p, n, id, sp, x, y, mult, hitPower(comp.lvl)));
  return true;
}

const occ = (w, x, y) => { const oid = w.grid.occupant(x, y); return oid === undefined ? null : w.ents.get(oid) || null; };

function resolve(w, p, n, id, sp, x, y, mult, power) {
  if (n.dead || p.dead) return;
  const secs = (sp.last || 0) * 1000;
  const hurt = (tgt, a, d, k, half = false) => {
    if (!tgt || tgt.kind !== "npc" || tgt.dead || tgt.id === n.id) return null;
    if (tgt.master && (tgt.master === p.id || (p.party && w.ents.get(tgt.master)?.party?.id === p.party.id))) return null;     // no dañan a summons propios ni del grupo
    const pr = sget(w, tgt, "protect");
    if (pr === 5 || (pr === 2) || M.resists(w.rng, power, tgt.cfg.resistMagic)) { w.emit({ t: "resist", id: tgt.id }); return null; }
    if ([1, 2, 4, 5].includes(tgt.cfg.actionLimit)) return null;                                                              // invulnerables
    let dmg = Math.floor((dice(w.rng, a, d) + k) * mult * Bal.spellDmgMul(id));
    if (tgt.absDamage > 0) { dmg = Math.floor(dmg - dmg * (tgt.absDamage / 100)); if (dmg < 0) dmg = 1; }
    damageNpc(w, tgt, Math.max(1, dmg), p, null, half);
    return tgt;
  };
  const freeze = (tgt, s) => { if (tgt && !tgt.dead && tgt.kind === "npc" && !sget(w, tgt, "ice") && !iceResisted(w, tgt)) sset(w, tgt, "ice", 1, s * 1000); };
  const area = (rx, ry, fn) => { for (let iy = y - ry; iy <= y + ry; iy++) for (let ix = x - rx; ix <= x + rx; ix++) fn(occ(w, ix, iy)); };
  const line = fn => {                                                       // del summon al objetivo: cada paso golpea la casilla y sus cuatro vecinas
    for (let i = 2; i < 10; i++) {
      const [tx, ty] = M.linePoint(n.x, n.y, x, y, i);
      for (const [ax, ay] of [[tx, ty], [tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]]) fn(occ(w, ax, ay));
      if (Math.abs(tx - x) <= 1 && Math.abs(ty - y) <= 1) break;
    }
  };
  const target = occ(w, x, y);
  switch (sp.type) {
    case 1: hurt(target, sp.v4, sp.v5, sp.v6); break;
    case 3: case 22: hurt(target, sp.v4, sp.v5, sp.v6); area(sp.v2, sp.v3, t => hurt(t, sp.v7, sp.v8, sp.v9, true)); break;
    case 19: case 30: line(t => hurt(t, sp.v7, sp.v8, sp.v9, true)); area(sp.v2, sp.v3, t => hurt(t, sp.v7, sp.v8, sp.v9, true)); hurt(target, sp.v4, sp.v5, sp.v6); break;
    case 21: case 28: area(sp.v2, sp.v3, t => hurt(t, sp.v7, sp.v8, sp.v9, true)); break;
    case 25: area(sp.v2, sp.v3, t => hurt(t, sp.v4, sp.v5, sp.v6, true)); break;
    case 23: area(sp.v2, sp.v3, t => { if (hurt(t, sp.v4, sp.v5, sp.v6, true)) freeze(t, sp.v10); }); break;
    case 26:
      line(t => { if (hurt(t, sp.v7, sp.v8, sp.v9, true)) freeze(t, sp.v10); });
      area(sp.v2, sp.v3, t => { if (hurt(t, sp.v7, sp.v8, sp.v9, true)) freeze(t, sp.v10); });
      if (hurt(target, sp.v4, sp.v5, sp.v6)) freeze(target, sp.v10);
      break;
    case 14: field(w, p, n, sp, x, y, secs); break;
    default: break;
  }
  w.emit({ t: "spell", id: n.id, spell: id, x, y, attr: sp.attr, type: sp.type });
}

function field(w, p, n, sp, x, y, secs) {
  const dyn = sp.v10;
  if (dyn === DYN.ICESTORM) { addField(w, dyn, x, y, secs, 0, p.id); return; }
  if (![DYN.FIRE, DYN.SPIKE, DYN.PCLOUD].includes(dyn)) return;
  if (sp.v11 === 1) {
    const d = dirTo(n.x, n.y, x, y), rx = [0, 1, 1, 0, -1, 1, -1, 0, 1][d] ?? 1, ry = [0, 0, 1, 1, 1, 0, -1, -1, -1][d] ?? 0;
    addField(w, dyn, x, y, secs, 0, p.id);
    for (let i = 1; i <= sp.v12; i++) { addField(w, dyn, x + i * rx, y + i * ry, secs, 0, p.id); addField(w, dyn, x - i * rx, y - i * ry, secs, 0, p.id); }
  } else if (sp.v11 === 2) {
    for (let ix = x - sp.v12; ix <= x + sp.v12; ix++) for (let iy = y - sp.v12; iy <= y + sp.v12; iy++) addField(w, dyn, ix, iy, secs, sp.v5, p.id);
  }
}
