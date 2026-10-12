// Summons psíquicos (INVENTO del port): Beholder (Movimiento), Centaurus (Interferencia) y Stalker (Territorio). Control y debilitación para
// cualquier clase, sin daño directo. Lanzan solos, como el Dummy, con su propio maná y recargas; exigen el Psychic Controller en la mano (classgear.js).
// Hechizos de Magic.cfg reutilizados SOLO por su efecto de estado (id 25 Hold, 77 Illusion Movement, 45 Chill Wind, 83 Inhibition, 76 Cancellation,
// 42/62 Confusion, 66 Armor Break, 11 Staminar Drain, 41 Fire Field, 54 Spike Field, 46 Poison Cloud). Los efectos duran poco y no se apilan.
// Prioridad de objetivo: 1) enemigos (jugadores hostiles y monstruos), 2) mascotas enemigas, 3) NPC de ciudad (solo si el dueño lo marcó).
import { dice } from "../rules.js";
import { PSY_OF } from "./evolutions.js";
import { sget, sset, sclear } from "./status.js";
import { addField, DYN } from "./fields.js";
import { canFight } from "./combatsys.js";
import * as Tal from "./talents.js";

export const RANGE = 10;                 // alcance del lanzamiento (casillas)
export const GCD = 2200;
// duración (ms) de cada estado; ninguno se renueva mientras siga activo
export const DUR = { hold: 5000, illusion: 6000, ice: 8000, inhibit: 8000, confuse: 6000, armorbreak: 10000 };
export const ARMOR_BREAK = 25;           // % extra de daño recibido
export const DRAIN = 0.3;                // fracción de la resistencia máxima que roba Staminar Drain

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const isMon = e => e.kind === "npc" && !e.dead && !e.master && !e.cfg.actionLimit && !e.boss;

// resistencia mágica del objetivo (0..100)
function resisted(w, e) {
  const r = e.kind === "npc" ? e.cfg.resistMagic : (e.skills?.[3] || 0) + (e.eff?.addMR || 0);
  return dice(w.rng, 1, 100) <= Math.min(80, r * 0.6);
}

// tabla de hechizos por rama: [id de Magic.cfg, recarga ms, ¿aplica?(w,n,t), efecto(w,n,t)]
const setIf = (key, ms, v = 1) => (w, n, t) => { sset(w, t, key, v, ms); };
const hasAny = (w, t, ks) => ks.some(k => sget(w, t, k));
const TABLE = {
  movement: [
    [25, 14000, (w, n, t) => !sget(w, t, "hold") && !(t.kind === "npc" && t.cfg.magicLevel >= 6) && !(t.kind === "player" && (t.eff?.addPR || 0) >= 500), setIf("hold", DUR.hold)],
    [77, 14000, (w, n, t) => !sget(w, t, "illusion"), (w, n, t) => { sset(w, t, "illusion", 1, DUR.illusion); if (t.kind === "npc") t.target = null; }],
    [45, 10000, (w, n, t) => !sget(w, t, "ice"), setIf("ice", DUR.ice)],
  ],
  interference: [
    [83, 16000, (w, n, t) => t.kind === "player" && !sget(w, t, "inhibit"), setIf("inhibit", DUR.inhibit)],
    [76, 20000, (w, n, t) => hasAny(w, t, ["invis", "protect", "berserk", "pfm"]), (w, n, t) => { for (const k of ["invis", "protect", "berserk", "pfm"]) sclear(w, t, k); }],
    [62, 14000, (w, n, t) => !sget(w, t, "confuse"), setIf("confuse", DUR.confuse)],
    [66, 18000, (w, n, t) => !sget(w, t, "armorbreak"), setIf("armorbreak", DUR.armorbreak, ARMOR_BREAK)],
    [11, 15000, (w, n, t) => t.kind === "player" && t.sp > 0, (w, n, t) => { t.sp = Math.max(0, t.sp - Math.round(t.maxSp * DRAIN)); w.emit({ t: "drain", id: t.id, sp: t.sp }); }],
  ],
  territory: [
    [41, 16000, (w, n, t) => true, (w, n, t) => addField(w, DYN.FIRE, t.x, t.y, 9000, 0, n.id, true)],
    [54, 16000, (w, n, t) => true, (w, n, t) => addField(w, DYN.SPIKE, t.x, t.y, 9000, 0, n.id, true)],
    [46, 18000, (w, n, t) => true, (w, n, t) => addField(w, DYN.PCLOUD, t.x, t.y, 9000, 20, n.id, true)],
  ],
};
export const branchOf = c => PSY_OF[c.sp] || null;
export const spellsOf = br => (TABLE[br] || []).map(r => r[0]);

// Candidatos por prioridad: [enemigos], [mascotas enemigas], [NPC marcado]
export function targets(w, n, m) {
  const t1 = [], t2 = [], t3 = [];
  for (const e of w.ents.values()) {
    if (e.dead || e === n || dist(n, e) > RANGE || dist(m, e) > RANGE + 4) continue;
    if (e.kind === "player") { if (w.pvp && e !== m && canFight(w, m, e) && !sget(w, e, "invis")) t1.push(e); }
    else if (isMon(e)) t1.push(e);
    else if (e.kind === "npc" && e.comp && e.master) { const o = w.ents.get(e.master); if (w.pvp && o && o !== m && o.kind === "player" && canFight(w, m, o)) t2.push(e); }
    else if (e.kind === "citizen" && n.cTarget === e.id) t3.push(e);
  }
  const by = (a, b) => dist(n, a) - dist(n, b);
  return [t1.sort(by), t2.sort(by), t3];
}

// Un pensamiento del summon psíquico: como mucho un hechizo por GCD. Devuelve true si lanzó algo.
export function think(w, n, m, c) {
  const br = branchOf(c), rows = TABLE[br];
  if (!rows || w.time - (n.castAt || 0) < GCD) return false;
  n.cd = n.cd || {};
  for (const group of targets(w, n, m)) {
    for (const t of group) for (const [id, cd, ok, fx] of rows) {
      if (!Tal.ready(w, n, id) || !ok(w, n, t)) continue;
      Tal.pay(w, n, id, cd);
      Tal.emitCast(w, n, id, t.x, t.y);
      if (resisted(w, t)) w.emit({ t: "resist", id: t.id }); else fx(w, n, t);
      return true;
    }
  }
  return false;
}
