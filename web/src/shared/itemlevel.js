// ITEM LEVEL (INVENTO del port): una sola cifra para comparar objetos de la MISMA casilla de equipo (la usan los bots para decidir qué
// se ponen y qué compran, y el cliente la muestra en la descripción). Sale de los datos de Item.cfg (dados de daño, defensa, velocidad,
// protección) y de los atributos que trae cada objeto (attr, ver attributes.js). No cambia ninguna regla del juego.
import { EFFECT, EQUIP, ITYPE } from "./items.js";
import { parseAttr, } from "./attributes.js";
import { BOSS_UNIQUE } from "./rarity.js";

const UNIQUE = new Set(Object.values(BOSS_UNIQUE).flat());
const avg = (n, r, b) => n * (r + 1) / 2 + (b || 0);

// Valor base del tipo de objeto (sin atributos)
function baseLevel(d) {
  switch (d.effectType) {
    case EFFECT.ATTACK: case EFFECT.ATTACK_MANASAVE: case EFFECT.ATTACK_ARROW: case EFFECT.ATTACK_MAXHPDOWN: case EFFECT.ATTACK_DEFENSE: case EFFECT.ATTACK_SPECABLTY: {
      const dmg = (avg(d.v1, d.v2, d.v3) + avg(d.v4, d.v5, d.v6)) / 2;
      return dmg * 3 - (d.speed || 0) * 0.6 + (d.effectType === EFFECT.ATTACK_SPECABLTY ? 10 : 0);
    }
    case EFFECT.DEFENSE: case EFFECT.DEFENSE_SPECABLTY:
      return d.v1 * 1.6 + (d.v2 || 0) * (d.equipPos === EQUIP.LHAND ? 0 : 0.25) + (d.effectType === EFFECT.DEFENSE_SPECABLTY ? 10 : 0);
    default:                                                  // collares, anillos y amuletos (efecto 14/15/…): el valor sale del precio original, sin signo
      return Math.max(1, Math.abs(d.price || 0) / 450);
  }
}
// Peso de cada atributo en item level (por punto de valor). INVENTO: antes todos valían igual (2.2·v1 + 1.4·v2) y un «Light» o «Agile» (sin efecto
// real de combate) puntuaba como un «Critical»; ahora cuenta lo que hace cada uno (applyEquipAttr): daño añadido/crítico/veneno en armas,
// absorción/defensa/resistencia mágica en armaduras, y los secundarios según su efecto (v2·7 %, o v2·3 % en absorciones).
const W1 = { 1: 2.6, 2: 2, 3: 1, 5: 4, 6: 1.5, 7: 9, 8: 1, 9: 18, 10: 2 };      // armas: crítico, veneno, justo, ágil (fijo), ligero, afilado (fijo), fuerte, antiguo (fijo), especial
const D1 = { 6: 1, 8: 1.4, 11: 1.5, 12: 2.2 };                                  // armaduras: ligero, fuerte, conversión de maná, crítico de carga
const FLAT1 = new Set(["w5", "w7", "w9"]);                                       // su valor no depende de v1 (la tirada solo decide el color)
const SUB = { 1: 0.8, 2: 1.4, 3: 2, 4: 1, 5: 1, 6: 1, 7: 2, 8: 2.6, 9: 2.6, 10: 4, 11: 3, 12: 1.4 };
// Item level de un objeto (d = definición, attr = atributos del objeto concreto, opcional)
export function itemLevel(d, attr = 0, id = d?.id) {
  if (!d || d.type !== ITYPE.EQUIP) return 0;
  let v = baseLevel(d);
  if (attr) {
    const a = parseAttr(attr), weapon = d.effectType === EFFECT.ATTACK || d.effectType === EFFECT.ATTACK_MANASAVE;
    v += ((weapon ? W1 : D1)[a.t1] || 0) * (FLAT1.has(weapon ? "w" + a.t1 : "") ? 1 : a.v1) + (SUB[a.t2] || 0) * a.v2;
  }
  if (UNIQUE.has(id)) v += 25;
  v += (d.levelLimit || 0) * 0.15;
  return Math.max(1, Math.round(v));
}
export const itemLevelOf = (data, inst) => (inst ? itemLevel(data.item(inst.id), inst.attr, inst.id) : 0);
