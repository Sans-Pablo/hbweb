// Magia: fórmulas del servidor original (PlayerMagicHandler, Effect_Damage_Spot, bCheckResistingMagicSuccess).
import { dice, MIN_HIT, MAX_HIT } from "./rules.js";

const MC_PROB = [0, 300, 250, 200, 150, 100, 80, 70, 60, 50, 40];       // _tmp_iMCProb
const MC_PENALTY = [0, 5, 5, 8, 8, 10, 14, 28, 32, 36, 40];             // _tmp_iMLevelPenalty

export const MAGIC_TYPE = { DAMAGE_SPOT: 1, HPUP_SPOT: 2, DAMAGE_AREA: 3 };
export const SUPPORTED_TYPES = new Set([1, 2, 3]);                      // por ahora: daño, curación y daño en área
export const CAST_MS = 16 * 40;                                         // animación de lanzar: 16 fotogramas x 40 ms
export const CAST_COOLDOWN_MS = 1000;                                   // el servidor expulsa si se lanza más rápido
export const circleOf = id => Math.floor(id / 10) + 1;

// corrección por nivel respecto al círculo del hechizo (se usa dos veces en el original)
function levelAdjust(result, circle, level) {
  const lm = Math.floor(level / 10);
  if (circle === lm) return result;
  if (circle > lm) {
    const v1 = level - lm * 10, v2 = Math.abs(circle - lm) * MC_PENALTY[circle], v3 = Math.abs(circle - lm) * 10;
    return result - Math.abs(v2 - Math.floor((v1 / v3) * v2));
  }
  return result + 5 * Math.abs(circle - lm);
}

// Probabilidad (%) de que el hechizo salga (si < 100 se tira 1d100).
export function castChance(p, id) {
  const circle = circleOf(id), mastery = p.skills[4] || 1;
  let r = Math.floor((mastery / 100) * MC_PROB[circle]);
  if (p.stats.int > 50) r += Math.floor((p.stats.int - 50) / 2);
  r = levelAdjust(r, circle, p.level);
  r += p.eff.castBonus || 0;                                 // atributo "Special" de las varitas
  return r <= 0 ? 1 : r;
}

// Maná que cuesta: el ahorro de maná lo reduce; las varitas tipo 34 suman 20.
export function manaCost(p, spell) {
  let c = spell.mana;
  if (p.eff.manaSave > 0) { c = Math.floor(c - (p.eff.manaSave / 100) * c); if (c <= 0) c = 1; }
  if (p.eff.wtype === 34) c += 20;
  return c;
}

// "Acierto" mágico del lanzador contra la resistencia del objetivo.
export function castPower(p, id) {
  let r = p.skills[4] || 0;
  if (p.stats.mag > 50) r += p.stats.mag - 50;
  r = levelAdjust(r, circleOf(id), p.level);
  r += p.eff.addAR;
  return r <= 0 ? 1 : r;
}

// bCheckResistingMagicSuccess: true si el objetivo resiste.
export function resists(rng, power, resistRatio) {
  if (resistRatio < 1) resistRatio = 1;
  let dest = Math.floor((power / resistRatio) * 50);
  dest = Math.max(MIN_HIT, Math.min(MAX_HIT, dest));
  return dice(rng, 1, 100) > dest;
}

// Daño de un hechizo: dados + bonificación de Magia (mag/3.3 %) + daño mágico añadido.
export function spellDamage(rng, p, n, d, k) {
  let dmg = dice(rng, n, d) + k;
  if (dmg <= 0) dmg = 0;
  dmg = Math.floor(dmg + dmg * ((p.stats.mag / 3.3) / 100) + 0.5);
  dmg += p.eff.addMagic || 0;
  return Math.max(0, dmg);
}
