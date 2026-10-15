// SIMULADOR DE ESTADÍSTICAS (INVENTO del port, al estilo del simulador de Olympia): prueba un reparto de puntos sin gastarlos.
// Las fórmulas son las del juego (rules.js maxHP/maxMP/maxSP, inventory.js maxLoad); el tope por atributo es el del cuadro Level Up (200).
import { maxHP, maxMP, maxSP } from "../rules.js";
export const KEYS = ["str", "vit", "dex", "int", "mag", "chr"], STAT_MAX = 200, LEVEL_MAX = 200;
export const maxLoadOf = (str, level) => str * 500 + level * 500;                    // inventory.js maxLoad
// base = stats actuales, add = puntos repartidos en la prueba {str:n..}. -> { stats, hp, mp, sp, load }
export function simulate(base, add, level) {
  const stats = {}; for (const k of KEYS) stats[k] = Math.min(STAT_MAX, Math.max(0, (base[k] | 0) + (add[k] | 0)));
  const c = { ...stats, level };
  return { stats, hp: maxHP(c), mp: maxMP(c), sp: maxSP(c), load: maxLoadOf(stats.str, level) };
}
export const spent = add => KEYS.reduce((a, k) => a + (add[k] | 0), 0);
// Suma n puntos a k (n<0 los quita) respetando el presupuesto (budget=Infinity: sin límite), el tope 200 y que no baje de lo repartido.
export function bump(base, add, k, n, budget) {
  const cur = add[k] | 0, room = Math.min(STAT_MAX - ((base[k] | 0) + cur), budget - spent(add));
  const d = n > 0 ? Math.min(n, room) : Math.max(n, -cur);
  if (d) add[k] = cur + d; return d;
}
