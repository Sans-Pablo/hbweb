// Árbol de talentos y hechizos del compañero. INVENTO del port (sin equivalente en el original); los hechizos son los de Magic.cfg
// (ids y fórmulas de dados v4..v6 tal cual) y los lanza el compañero, no el jugador.
//  - 3 ramas como en WoW: Apoyo (support), Daño (damage) y Guerrero/Tanque (tank). Cada nivel del compañero da 1 punto (nivel 1 = 0).
//  - Un talento de fila (tier) t exige haber gastado 2*t puntos en su rama. La rama con más puntos es la ESPECIALIDAD y da las
//    estadísticas de su clase (specStats). Reiniciar los talentos cuesta oro (en el hospital).
import { dice } from "../rules.js";
import { sget } from "./status.js";
import { SCHOOL_OF, MP_BASE, TIER_MULT, isTier2 } from "./schools.js";

export const BRANCHES = ["support", "damage", "tank"];
export const BRANCH_NAMES = { support: "Support", damage: "Damage", tank: "Warrior" };
// id, rama, tier, rangos máximos, spell (id de Magic.cfg) si desbloquea un hechizo
export const TALENTS = [
  { id: "mind", br: "support", tier: 0, max: 5, name: "Clear Mind", desc: "+10% mana per rank (school summons)" },

  { id: "might", br: "damage", tier: 0, max: 5, name: "Brute Force", desc: "+8% damage per rank" },
  { id: "frenzy", br: "damage", tier: 1, max: 3, name: "Frenzy", desc: "+10% school spell damage per rank" },

  { id: "hide", br: "tank", tier: 0, max: 5, name: "Thick Hide", desc: "+10% health per rank" },
  { id: "iron", br: "tank", tier: 2, max: 3, name: "Iron Skin", desc: "-5% damage taken per rank" },
  { id: "taunt", br: "tank", tier: 3, max: 1, name: "Taunt", desc: "Nearby monsters attack it" },
  { id: "regen", br: "tank", tier: 4, max: 1, name: "Fortitude", desc: "Recovers 1% health per second" },
];
// ---- Dummy (summon de apoyo único, systems/dummy.js): 3 clases en lugar de las 3 ramas; la primera magia que se aprende fija la clase.
//  dummy: true · lvl = nivel mínimo del compañero · max = rangos (cada rango potencia la magia)
export const DUMMY_BRANCHES = ["healer", "buffer", "aura"];
export const DUMMY_NAMES = { healer: "Healer", buffer: "Buffer", aura: "Aura" };
export const DUMMY_COLORS = { healer: "#4fe05a", buffer: "#f2d83a", aura: "#4aa0ff" };       // verde, amarillo, azul
TALENTS.push(
  { id: "dheal", br: "healer", tier: 0, max: 5, dummy: true, name: "Heal", spell: 1, desc: "Heals the weakest ally in range" },
  { id: "dgheal", br: "healer", tier: 0, max: 5, dummy: true, lvl: 15, name: "Great Heal", spell: 21, desc: "Big heal on the weakest ally in range" },
  { id: "dmassh", br: "healer", tier: 0, max: 1, dummy: true, lvl: 30, name: "Mass Great Heal", desc: "MASS: Great Heal on the whole party (60 s)" },
  { id: "dward", br: "buffer", tier: 0, max: 5, dummy: true, name: "Defense Shield", spell: 13, desc: "Shields an ally in range (+40 defense)" },
  { id: "dgward", br: "buffer", tier: 0, max: 5, dummy: true, lvl: 15, name: "Great Defense Shield", spell: 44, desc: "Shields an ally in range (+100 defense)" },
  { id: "dpfm", br: "buffer", tier: 0, max: 5, dummy: true, lvl: 20, name: "Protection From Magic", spell: 33, desc: "Reduces magic damage taken by an ally" },
  { id: "dberserk", br: "buffer", tier: 0, max: 5, dummy: true, lvl: 25, name: "Berserk", spell: 50, desc: "Double damage for an ally" },
  { id: "dmassb", br: "buffer", tier: 0, max: 1, dummy: true, lvl: 30, name: "Mass Buff", desc: "MASS: all your buffs on the whole party (60 s)" },
  { id: "dregen", br: "aura", tier: 0, max: 5, dummy: true, name: "Regeneration Aura", desc: "% of max HP regenerated per second" },
  { id: "dexp", br: "aura", tier: 0, max: 5, dummy: true, lvl: 10, name: "Wisdom Aura", desc: "% extra experience" },
  { id: "ddef", br: "aura", tier: 0, max: 5, dummy: true, lvl: 15, name: "Defense Aura", desc: "% less damage taken" },
  { id: "dmana", br: "aura", tier: 0, max: 5, dummy: true, lvl: 20, name: "Mana Aura", desc: "% of max MP regenerated per second" },
  { id: "dstam", br: "aura", tier: 0, max: 5, dummy: true, lvl: 12, name: "Stamina Aura", desc: "% of max stamina regained per second" },
  { id: "dvamp", br: "aura", tier: 0, max: 5, dummy: true, lvl: 25, name: "Vampiric Aura", desc: "% of the damage dealt by allies returns to them as life" },
  { id: "dres", br: "aura", tier: 0, max: 3, dummy: true, lvl: 50, name: "Resurrection", spell: 94, desc: "Max level: raises a fallen ally or you (3 min cooldown, less per rank)" },
  { id: "dmassa", br: "aura", tier: 0, max: 1, dummy: true, lvl: 30, name: "Mass Aura", desc: "MASS: doubles every aura for 20 s (60 s)" },
);
export const isDummy = c => c.sp === "Dummy";
export const branchesOf = c => (isDummy(c) ? DUMMY_BRANCHES : BRANCHES);
export const branchName = (c, b) => (isDummy(c) ? DUMMY_NAMES[b] : BRANCH_NAMES[b]);
const BY_ID = Object.fromEntries(TALENTS.map(t => [t.id, t]));
export const talent = id => BY_ID[id];
export const TIER_COST = 2;                                                        // puntos en la rama por cada fila

export const ranks = c => c.tal || {};
export const rankOf = (c, id) => (c.tal && c.tal[id]) || 0;
export const spent = (c, br) => TALENTS.reduce((a, t) => a + (t.br === br ? rankOf(c, t.id) : 0), 0);
export const spentAll = c => TALENTS.reduce((a, t) => a + rankOf(c, t.id), 0);
export const pointsFree = c => Math.max(0, c.lvl - 1 - spentAll(c));
export function spec(c) {
  if (isDummy(c)) return c.cls || null;
  let best = null, bp = 0, tie = false;
  for (const b of BRANCHES) { const s = spent(c, b); if (s > bp) { best = b; bp = s; tie = false; } else if (s === bp && s > 0) tie = true; }
  return tie ? null : best;
}
// Estadísticas por clase (multiplican las compartidas del dueño, companion.statsOf)
export const SPEC_STATS = {
  damage: { dmg: 1.35, hp: 0.85, mp: 1.0 },
  tank: { dmg: 0.85, hp: 1.7, mp: 0.8 },
  support: { dmg: 0.6, hp: 1.0, mp: 2.0 },
  none: { dmg: 1, hp: 1, mp: 1 },
};
export function factors(c) {
  const s = SPEC_STATS[isDummy(c) ? "none" : spec(c) || "none"];
  return {
    dmg: s.dmg * (1 + 0.08 * rankOf(c, "might")),
    hp: s.hp * (1 + 0.10 * rankOf(c, "hide")),
    mp: s.mp * (1 + 0.10 * rankOf(c, "mind")),
    taken: Math.max(0.3, 1 - 0.05 * rankOf(c, "iron")),
    heal: 1 + 0.15 * rankOf(c, "harmony"),
    spell: 1 + 0.10 * rankOf(c, "frenzy"),
  };
}
export const isSchool = c => !!SCHOOL_OF[c.sp];                                       // summon de escuela: sin regeneración natural de maná (caramelos azules)
export const maxMp = c => isDummy(c) ? Math.round(40 + 10 * c.lvl)
  : Math.round((20 + 6 * c.lvl) * factors(c).mp * (isSchool(c) ? MP_BASE * (isTier2(c.sp) ? TIER_MULT.mp : 1) : 1));
export function canLearn(c, id) {
  const t = BY_ID[id];
  if (!t) return "no existe";
  if (!!t.dummy !== isDummy(c)) return "no es para este compañero";
  if (t.dummy && c.cls && c.cls !== t.br) return "ya eligió otra clase";
  if (t.lvl && c.lvl < t.lvl) return "necesita nivel " + t.lvl;
  if (rankOf(c, id) >= t.max) return "ya está al máximo";
  if (pointsFree(c) <= 0) return "sin puntos de talento";
  if (spent(c, t.br) < TIER_COST * t.tier) return "necesita " + TIER_COST * t.tier + " puntos en la rama";
  return null;
}
export function learn(c, id) {
  const why = canLearn(c, id);
  if (why) return why;
  c.tal = { ...(c.tal || {}), [id]: rankOf(c, id) + 1 };
  if (BY_ID[id].dummy) c.cls = BY_ID[id].br;                                        // la clase queda fijada con la primera magia
  return null;
}
export const resetCost = c => 50 * c.lvl;
export const reset = c => { c.tal = {}; delete c.cls; };
export const spellsOf = c => TALENTS.filter(t => t.spell != null && rankOf(c, t.id) > 0);

// ------------------------------------------------------------------ lanzamiento (IA del compañero)
export const manaOf = (w, id) => (w.magic?.[id]?.mana ?? 20);
export function emitCast(w, n, id, x, y) {
  const sp = w.magic?.[id];
  w.emit({ t: "spell", id: n.id, spell: id, x, y, attr: sp?.attr, type: sp?.type });
}
export function pay(w, n, id, cd) {
  n.mp -= manaOf(w, id);
  n.cd = n.cd || {}; n.cd[id] = w.time + cd;
  n.castAt = w.time;
}
export const ready = (w, n, id) => n.mp >= manaOf(w, id) && w.time >= ((n.cd && n.cd[id]) || 0);
export const GCD = 1800;

// Regeneración de maná y de vida (talento Fortitude); se llama una vez por pensamiento
export function regen(w, n, c) {
  const mx = maxMp(c);
  if (n.mp === undefined) n.mp = isSchool(c) ? Math.min(mx, c.mp ?? mx) : mx;       // el de escuela vuelve con el maná que tenía
  if (!isSchool(c)) n.mp = Math.min(mx, n.mp + mx / 60 * ((w.time - (n.mpAt ?? w.time)) / 1000));
  else n.mp = Math.min(mx, n.mp);
  n.mpAt = w.time;
  c.mp = Math.floor(n.mp); c.mpMax = mx; n.maxMpC = mx;
  if (rankOf(c, "regen") && n.hp < n.maxHp) { const k = (w.time - (n.hpAt ?? w.time)) / 1000; n.hpAcc = (n.hpAcc || 0) + n.maxHp * 0.01 * k; const g = Math.floor(n.hpAcc); if (g > 0) { n.hp = Math.min(n.maxHp, n.hp + g); n.hpAcc -= g; } }
  n.hpAt = w.time;
}

// Daño recibido por un compañero: tamaño del escudo y talentos
export function takenFactor(w, n, c) {
  const p = sget(w, n, "cprot");
  return factors(c).taken * (p === 2 ? 0.35 : p === 1 ? 0.5 : 1);
}
