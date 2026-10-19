// ARMA DE DAÑO MÁXIMO DEL GUERRERO (v0.85.82, petición del propietario): el guerrero busca la mejor arma que pueda usar, con prioridad
// Barbarian Hammer > Battle Hammer > Battle Axe > Giant Sword (Item.cfg: todas a dos manos, equipPos 9), y una parte de los bots con Flameberge.
// El daño esperado usa las fórmulas del port: dados pequeño/grande (Item.cfg v1-v6), bono de Str (combat.js playerStrike: +Str/5 %),
// acierto con la maestría del arma + 50 + Dex-50 (hitChance, defensa media 80) y ritmo de golpe (world.js attackMs + speedNib).
import { PLAYER } from "../const.js";
import { hitChance } from "../rules.js";
import { itemLevel } from "../itemlevel.js";
import { warStrOf, warBuildOf } from "./builds.js";

export const WAR_PRIO = { BarbarianHammer: 1.08, BattleHammer: 1.05, BattleAxe: 1.03, GiantSword: 1.01, Hammer: 1.0 };          // desempate: a igualdad de daño, el primero de la lista
export const FLAM = "Flameberge", FLAM_SHARE = 0.25, FLAM_BOOST = 1.7;          // la cuarta parte de los guerreros jura por la Flameberge (barata, sin nivel ni Str altos)
const DEF = 80;                                                                  // defensa media de un monstruo para estimar el acierto
const K = 2.6;                                                                   // escala dps -> item level (itemlevel.js baseLevel ≈ daño*3)
// Armas objetivo del guerrero (la petición las nombra; los +N del botín cuentan): el resto de armas de dos manos (MasterBHammer…) no se compran
const WAR_SET = /^(BarbarianHammer|BattleHammer|BattleAxe|GiantSword|Hammer|Flameberge)(\+\d)?$/;
export const isWarPick = d => isMelee(d) && WAR_SET.test(d.name);
export const isMelee = d => !!d && d.type === 1 && (d.equipPos === 8 || d.equipPos === 9) && d.effectType === 1;

// ¿Este bot sigue la Flameberge? Se decide una sola vez con la tirada del mundo (determinista)
export const flamOf = (w, b) => (b.flam ??= w.rng() < FLAM_SHARE);

// Daño por segundo esperado de `d` en manos de `p` (con Str libre incluida)
export function weaponDps(p, d) {
  const str = (p.stats?.str || 0) + (p.pool || 0), dex = p.stats?.dex || 0;
  const sm = d.v1 * (d.v2 + 1) / 2 + d.v3, lg = d.v4 * (d.v5 + 1) / 2 + d.v6;
  const dmg = (sm + lg) / 2 * (1 + str / 500);
  const hit = (p.skills?.[d.skill] || 0) + 50 + Math.max(0, dex - 50);
  const pct = hitChance(hit, DEF, false) / 100;
  const nib = Math.max(0, d.speed - Math.floor(str / 13));
  return dmg * pct / ((PLAYER.attackMs + nib * 12 * 8) / 1000);
}
// Puntuación comparable con el item level: dps·K más lo que aporte el atributo del objeto concreto, por prioridad y por la Flameberge del bot
export function weaponScore(w, p, b, d, inst) {
  if (!isMelee(d)) return 0;
  const attr = inst ? itemLevel(d, inst.attr, d.id) - itemLevel(d, 0, d.id) : 0;
  const bw = warBuildOf({ ...p, bot: b }).weapons, bn = d.name.replace(/\+\d$/, "");
  const f = bw ? (bw.includes(bn) ? FLAM_BOOST : 0.3) : (bn === FLAM ? 0.3 : (WAR_PRIO[bn] || 1));          // v0.85.88: el build manda (berserker = Flameberge, giant59 = Giant Sword/Hammer)
  return (weaponDps(p, d) * K + attr) * f;
}

// v0.85.86 (petición del propietario): tras el reset/spawn el guerrero reparte la Str que pide su arma OBJETIVO (la primera de la lista de prioridad que su nivel
// permite y a cuya Str llega con lo que tiene + lo que le queda por repartir), no solo la que lleva puesta (builds.weaponStrNeed). Str = max(peso/100, velocidad×13), como swingStr.
const need = (d, build) => warStrOf(d.name, build) || Math.max(Math.ceil(d.weight / 100), d.speed * 13);      // v0.85.87: tabla fija de Pablo (builds.WAR_STR)
export function warTargetNeed(w, p, b) {
  const build = warBuildOf({ ...p, bot: b }), have = (p.stats?.str || 0) + (p.pool || 0), base = d => d.name.replace(/\+\d$/, "");
  const pool = [...w.data.items.values()].filter(d => d && isWarPick(d) && (d.levelLimit || 0) <= p.level && (build.weapons ? build.weapons.includes(base(d)) : base(d) !== FLAM));
  const rank = d => WAR_PRIO[base(d)] || 1;
  for (const d of pool.sort((x, y) => rank(y) - rank(x))) if (need(d, build) <= Math.min(have, 200)) return need(d, build);
  return 0;
}
