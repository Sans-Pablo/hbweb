// Árbol de talentos y hechizos del compañero. INVENTO del port (sin equivalente en el original); los hechizos son los de Magic.cfg
// (ids y fórmulas de dados v4..v6 tal cual) y los lanza el compañero, no el jugador.
//  - 3 ramas como en WoW: Apoyo (support), Daño (damage) y Guerrero/Tanque (tank). Cada nivel del compañero da 1 punto (nivel 1 = 0).
//  - Un talento de fila (tier) t exige haber gastado 2*t puntos en su rama. La rama con más puntos es la ESPECIALIDAD y da las
//    estadísticas de su clase (specStats). Reiniciar los talentos cuesta oro (en el hospital).
import { dice } from "../rules.js";
import { sget, sset } from "./status.js";

export const BRANCHES = ["support", "damage", "tank"];
export const BRANCH_NAMES = { support: "Support", damage: "Damage", tank: "Warrior" };
// id, rama, tier, rangos máximos, spell (id de Magic.cfg) si desbloquea un hechizo
export const TALENTS = [
  { id: "mind", br: "support", tier: 0, max: 5, name: "Clear Mind", desc: "+10% mana per rank" },
  { id: "heal", br: "support", tier: 1, max: 1, name: "Heal", spell: 1, desc: "Heals the owner" },
  { id: "harmony", br: "support", tier: 2, max: 3, name: "Harmony", desc: "+15% healing per rank" },
  { id: "ward", br: "support", tier: 3, max: 1, name: "Defense Shield", spell: 13, desc: "Shields the owner (+40 defense)" },
  { id: "gheal", br: "support", tier: 4, max: 1, name: "Great Heal", spell: 21, desc: "Big heal on the owner" },
  { id: "gward", br: "support", tier: 5, max: 1, name: "Great Defense Shield", spell: 44, desc: "Shields the owner (+100 defense)" },

  { id: "might", br: "damage", tier: 0, max: 5, name: "Brute Force", desc: "+8% damage per rank" },
  { id: "fireball", br: "damage", tier: 1, max: 1, name: "Fire Ball", spell: 20, desc: "Fire bolt" },
  { id: "frenzy", br: "damage", tier: 2, max: 3, name: "Frenzy", desc: "+10% spell damage per rank" },
  { id: "lightning", br: "damage", tier: 3, max: 1, name: "Lightning", spell: 43, desc: "Heavy lightning bolt" },
  { id: "berserk", br: "damage", tier: 4, max: 1, name: "Berserk", spell: 50, desc: "Double damage for 20 s" },
  { id: "strike", br: "damage", tier: 5, max: 1, name: "Meteor Strike", spell: 81, desc: "Devastating strike" },

  { id: "hide", br: "tank", tier: 0, max: 5, name: "Thick Hide", desc: "+10% health per rank" },
  { id: "shield", br: "tank", tier: 1, max: 1, name: "Defense Shield", spell: 13, desc: "Shields itself (takes half damage)" },
  { id: "iron", br: "tank", tier: 2, max: 3, name: "Iron Skin", desc: "-5% damage taken per rank" },
  { id: "taunt", br: "tank", tier: 3, max: 1, name: "Taunt", desc: "Nearby monsters attack it" },
  { id: "gshield", br: "tank", tier: 4, max: 1, name: "Great Defense Shield", spell: 44, desc: "Takes 35% damage for 30 s" },
  { id: "regen", br: "tank", tier: 5, max: 1, name: "Fortitude", desc: "Recovers 1% health per second" },
];
const BY_ID = Object.fromEntries(TALENTS.map(t => [t.id, t]));
export const talent = id => BY_ID[id];
export const TIER_COST = 2;                                                        // puntos en la rama por cada fila

export const ranks = c => c.tal || {};
export const rankOf = (c, id) => (c.tal && c.tal[id]) || 0;
export const spent = (c, br) => TALENTS.reduce((a, t) => a + (t.br === br ? rankOf(c, t.id) : 0), 0);
export const spentAll = c => BRANCHES.reduce((a, b) => a + spent(c, b), 0);
export const pointsFree = c => Math.max(0, c.lvl - 1 - spentAll(c));
export function spec(c) {
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
  const s = SPEC_STATS[spec(c) || "none"];
  return {
    dmg: s.dmg * (1 + 0.08 * rankOf(c, "might")),
    hp: s.hp * (1 + 0.10 * rankOf(c, "hide")),
    mp: s.mp * (1 + 0.10 * rankOf(c, "mind")),
    taken: Math.max(0.3, 1 - 0.05 * rankOf(c, "iron")),
    heal: 1 + 0.15 * rankOf(c, "harmony"),
    spell: 1 + 0.10 * rankOf(c, "frenzy"),
  };
}
export const maxMp = c => Math.round((20 + 6 * c.lvl) * factors(c).mp);
export function canLearn(c, id) {
  const t = BY_ID[id];
  if (!t) return "no existe";
  if (rankOf(c, id) >= t.max) return "ya está al máximo";
  if (pointsFree(c) <= 0) return "sin puntos de talento";
  if (spent(c, t.br) < TIER_COST * t.tier) return "necesita " + TIER_COST * t.tier + " puntos en la rama";
  return null;
}
export function learn(c, id) {
  const why = canLearn(c, id);
  if (why) return why;
  c.tal = { ...(c.tal || {}), [id]: rankOf(c, id) + 1 };
  return null;
}
export const resetCost = c => 50 * c.lvl;
export const reset = c => { c.tal = {}; };
export const spellsOf = c => TALENTS.filter(t => t.spell != null && rankOf(c, t.id) > 0);

// ------------------------------------------------------------------ lanzamiento (IA del compañero)
const manaOf = (w, id) => (w.magic?.[id]?.mana ?? 20);
function emitCast(w, n, id, x, y) {
  const sp = w.magic?.[id];
  w.emit({ t: "spell", id: n.id, spell: id, x, y, attr: sp?.attr, type: sp?.type });
}
function pay(w, n, id, cd) {
  n.mp -= manaOf(w, id);
  n.cd = n.cd || {}; n.cd[id] = w.time + cd;
  n.castAt = w.time;
}
const ready = (w, n, id) => n.mp >= manaOf(w, id) && w.time >= ((n.cd && n.cd[id]) || 0);
const GCD = 1800;

// Regeneración de maná y de vida (talento Fortitude); se llama una vez por pensamiento
export function regen(w, n, c) {
  const mx = maxMp(c);
  if (n.mp === undefined) n.mp = mx;
  n.mp = Math.min(mx, n.mp + mx / 60 * ((w.time - (n.mpAt ?? w.time)) / 1000));
  n.mpAt = w.time;
  c.mp = Math.floor(n.mp); c.mpMax = mx;
  if (rankOf(c, "regen") && n.hp < n.maxHp) { const k = (w.time - (n.hpAt ?? w.time)) / 1000; n.hpAcc = (n.hpAcc || 0) + n.maxHp * 0.01 * k; const g = Math.floor(n.hpAcc); if (g > 0) { n.hp = Math.min(n.maxHp, n.hp + g); n.hpAcc -= g; } }
  n.hpAt = w.time;
}

// Hechizos de apoyo/tanque sobre sí mismo o el dueño. Devuelve true si gastó el turno.
export function support(w, n, m, c, hostiles) {
  if (w.time - (n.castAt || 0) < GCD) return false;
  const f = factors(c);
  const heal = (id, who) => {
    const sp = w.magic[id];
    const amount = Math.round((dice(w.rng, sp.v4, sp.v5) + sp.v6 + c.lvl) * f.heal);
    who.hp = Math.min(who.maxHp, who.hp + amount);
    emitCast(w, n, id, who.x, who.y); pay(w, n, id, 2500);
    w.emit({ t: "heal", id: who.id, amount, by: n.id });
    return true;
  };
  if (rankOf(c, "gheal") && m.hp < m.maxHp * 0.4 && ready(w, n, 21)) return heal(21, m);
  if (rankOf(c, "heal") && m.hp < m.maxHp * 0.65 && ready(w, n, 1)) return heal(1, m);
  if (rankOf(c, "heal") && n.hp < n.maxHp * 0.5 && ready(w, n, 1)) return heal(1, n);
  if (hostiles) {
    if (rankOf(c, "gward") && sget(w, m, "protect") < 4 && ready(w, n, 44)) { sset(w, m, "protect", 4, 40000); emitCast(w, n, 44, m.x, m.y); pay(w, n, 44, 40000); return true; }
    if (rankOf(c, "ward") && !sget(w, m, "protect") && ready(w, n, 13)) { sset(w, m, "protect", 3, 30000); emitCast(w, n, 13, m.x, m.y); pay(w, n, 13, 30000); return true; }
    if (rankOf(c, "gshield") && sget(w, n, "cprot") < 2 && ready(w, n, 44)) { sset(w, n, "cprot", 2, 30000); emitCast(w, n, 44, n.x, n.y); pay(w, n, 44, 30000); return true; }
    if (rankOf(c, "shield") && !sget(w, n, "cprot") && ready(w, n, 13)) { sset(w, n, "cprot", 1, 30000); emitCast(w, n, 13, n.x, n.y); pay(w, n, 13, 30000); return true; }
    if (rankOf(c, "taunt") && w.time >= ((n.cd && n.cd.taunt) || 0)) {
      n.cd = n.cd || {}; n.cd.taunt = w.time + 12000; n.castAt = w.time;
      for (const e of hostiles) if (!e.dead) e.target = n.id;
      w.emit({ t: "spell", id: n.id, spell: 33, x: n.x, y: n.y });
      return true;
    }
    if (rankOf(c, "berserk") && !sget(w, n, "berserk") && ready(w, n, 50)) { sset(w, n, "berserk", 1, 20000); emitCast(w, n, 50, n.x, n.y); pay(w, n, 50, 40000); return true; }
  }
  return false;
}

// Daño recibido por un compañero: tamaño del escudo y talentos
export function takenFactor(w, n, c) {
  const p = sget(w, n, "cprot");
  return factors(c).taken * (p === 2 ? 0.35 : p === 1 ? 0.5 : 1);
}

// Hechizo de ataque contra `t` (a distancia). `hurt(t, dmg)` aplica el daño. Devuelve true si lanzó.
export function offense(w, n, c, t, hurt) {
  if (w.time - (n.castAt || 0) < GCD) return false;
  const f = factors(c);
  const order = [[81, "strike"], [43, "lightning"], [20, "fireball"]];
  for (const [id, key] of order) {
    if (!rankOf(c, key) || !ready(w, n, id)) continue;
    const sp = w.magic[id];
    const base = dice(w.rng, sp.v4, sp.v5) + sp.v6 + Math.floor(c.lvl / 2);
    const dmg = Math.max(1, Math.round(base * f.spell * f.dmg * (sget(w, n, "berserk") ? 2 : 1)));
    emitCast(w, n, id, t.x, t.y); pay(w, n, id, 3500);
    w.after(450, () => { if (!n.dead && !t.dead) hurt(t, dmg); });
    return true;
  }
  return false;
}
export const hasAttackSpell = c => rankOf(c, "fireball") || rankOf(c, "lightning") || rankOf(c, "strike");
