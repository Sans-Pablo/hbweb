// FÓRMULAS QUE CONOCEN LOS BOTS (v0.85.54): las del original (rules.js, combat.js, magic.js, magicsys.js) en forma de predicción, para decidir sin tirar dados.
//  - Acierto cuerpo a cuerpo: floor(ataque / defensa * 80) entre 15 y 99 (rules.js hitChance); por la espalda la defensa se divide por 2.
//  - Daño cuerpo a cuerpo: dados del arma + Str/5 % (combat.js damageRange).
//  - Resistir magia: el hechizo entra si dado(1..100) <= floor(poder / MR * 50) entre 15 y 99 (magic.js resists), con poder = skill Magia + (Mag-50) + addAR
//    y MR = skill Resistencia + addMR + (Mag-50) del objetivo (magicsys.js). Lanzar bien: castChance (Int > 50 suma (Int-50)/2).
import * as R from "../rules.js";
import * as M from "../magic.js";
import { damageRange } from "../combat.js";

// MR efectiva de un objetivo jugador (magicsys.js)
export function resistRatio(t) {
  let rr = (t.skills?.[3] || 0) + (t.eff?.addMR || 0);
  if ((t.stats?.mag || 0) > 50) rr += t.stats.mag - 50;
  return Math.max(1, rr);
}
// % de que el hechizo supere la resistencia del objetivo
export function passChance(p, id, t) {
  return Math.max(R.MIN_HIT, Math.min(R.MAX_HIT, Math.floor(M.castPower(p, id) / resistRatio(t) * 50)));
}
// % de que un hechizo de p entre en t: lanzarlo bien × no ser resistido
export const landChance = (p, id, t) => Math.min(100, M.castChance(p, id)) * passChance(p, id, t) / 100;
// % de acierto de un golpe de p sobre t
export function meleeChance(p, t, behind = false) {
  const atk = p.eff?.wtype ? (p.eff.hit || 0) : (p.skills?.[5] || 0);
  return R.hitChance(atk, t.defense || 1, behind);
}
export function meleeAvg(p) { const [a, b] = damageRange(p); return (a + b) / 2; }
// Daño esperado por golpe = acierto × daño medio
export const meleeExpected = (p, t) => meleeChance(p, t) / 100 * meleeAvg(p);

// Valor de un punto más en cada estadística según las fórmulas (por encima de 50 la Mag da poder y resistencia; la Int, probabilidad de lanzar).
export function pointGain(p, stat) {
  const s = p.stats[stat] || 0, mage = p.res?.build === "mage" || p.bot?.mage;
  if (stat === "mag") return s >= 50 ? 1.3 : 0.3;
  if (stat === "int") return s >= 50 ? 0.5 : s < 36 ? 0.8 : 0.1;
  if (stat === "str") return mage ? 0.1 : 0.2;
  if (stat === "dex") return mage ? 0.05 : 0.15;
  return 0.1;
}
