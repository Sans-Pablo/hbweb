// Atributos de los objetos que caen (NpcDeadItemGenerator, _AdjustRareItemValue, bEquipItemHandler).
// attr = tipo1<<20 | valor1<<16 | tipo2<<12 | valor2<<8  (igual que m_dwAttribute del servidor).
import { dice } from "./rules.js";
import { EFFECT } from "./items.js";

export const parseAttr = a => ({ t1: (a >>> 20) & 15, v1: (a >>> 16) & 15, t2: (a >>> 12) & 15, v2: (a >>> 8) & 15 });
const pack = (t1, v1, t2 = 0, v2 = 0) => ((t1 << 20) | (v1 << 16) | (t2 << 12) | (v2 << 8)) >>> 0;

// tabla de valores: 1d30000, con el mismo reparto que el servidor
const VALUE_CUTS = [10000, 17400, 22400, 25400, 27400, 28400, 28900, 29300, 29600, 29800, 29900, 29970];
function rollValue(rng) {
  const r = dice(rng, 1, 30000);
  for (let i = 0; i < VALUE_CUTS.length; i++) if (r < VALUE_CUTS[i]) return i + 1;
  return r >= 29970 ? 13 : 1;
}
// elige por tramos sobre 1d10000: [[límite, resultado], ...]
const band = (rng, table) => { const r = dice(rng, 1, 10000); for (const [lim, v] of table) if (r <= lim) return v; return table[table.length - 1][1]; };

// Devuelve { attr, color } o null si el objeto no admite atributos.
export function rollAttributes(rng, d, gen) {
  const low = v => (gen <= 2 && v > 7 ? 7 : v);
  if (d.effectType === EFFECT.ATTACK) {
    const [t, color] = band(rng, [[299, [6, 2]], [999, [8, 3]], [2499, [1, 5]], [4499, [5, 1]], [6499, [3, 7]], [8099, [2, 4]], [9699, [7, 6]], [10000, [9, 8]]]);
    let v = rollValue(rng);
    if (t === 1 && v <= 5) v = 5;
    else if ((t === 2 || t === 6) && v <= 4) v = 4;
    else if (t === 8 && v <= 2) v = 2;
    v = low(v);
    let t2 = 0, v2 = 0;
    if (dice(rng, 1, 10000) >= 6000) [t2, v2] = subWeapon(rng, low);
    return { attr: pack(t, v, t2, v2), color };
  }
  if (d.effectType === EFFECT.ATTACK_MANASAVE) {
    const v = low(rollValue(rng));
    let t2 = 0, v2 = 0;
    if (dice(rng, 1, 10000) >= 6000) [t2, v2] = subWeapon(rng, low);
    return { attr: pack(10, v, t2, v2), color: 5 };
  }
  if (d.effectType === EFFECT.DEFENSE) {
    const t = band(rng, [[5999, 8], [8999, 6], [9554, 11], [10000, 12]]);
    let v = rollValue(rng);
    if (t === 6 && v <= 4) v = 4;
    else if (t === 8 && v <= 2) v = 2;
    else if (t === 11 || t === 12) { v = Math.max(1, Math.floor((v + 1) / 2)); if (gen <= 3 && v > 2) v = 2; }
    v = low(v);
    let t2 = 0, v2 = 0;
    if (dice(rng, 1, 10000) >= 6000) {
      t2 = band(rng, [[999, 3], [3999, 1], [5499, 5], [6499, 4], [7499, 6], [9399, 7], [9799, 8], [10000, 9]]);
      v2 = rollValue(rng);
      if ([1, 3, 7, 8, 9].includes(t2) && v2 <= 3) v2 = 3;
      v2 = low(v2);
    }
    return { attr: pack(t, v, t2, v2), color: 0 };
  }
  return null;
}

// atributo secundario de armas y varitas
function subWeapon(rng, low) {
  const t = band(rng, [[4999, 2], [8499, 10], [9499, 12], [10000, 11]]);
  let v = rollValue(rng);
  if (t === 2 && v <= 3) v = 3;
  else if (t === 10 && v > 7) v = 7;
  else if (t === 11) v = 2;
  else if (t === 12) v = 5;
  return [t, low(v)];
}

// Peso, velocidad y durabilidad máxima reales de un objeto concreto (_AdjustRareItemValue).
export function realStats(d, inst) {
  let weight = d.weight, speed = d.speed, maxLife = d.maxLife;
  if (inst && inst.attr) {
    const { t1, v1 } = parseAttr(inst.attr);
    if (t1 === 5) speed = Math.max(0, speed - 1);
    else if (t1 === 6) { weight -= Math.floor(weight * (v1 * 4) / 100); if (weight < 1) weight = 1; }
    else if (t1 === 8 || t1 === 9) maxLife += Math.floor(maxLife * (v1 * 7) / 100);
  }
  return { weight, speed, maxLife };
}

// Lo que el atributo suma al jugador mientras el objeto está puesto. `pos` = casilla de equipo.
export function applyEquipAttr(fx, attr, d, pos) {
  if (!attr) return;
  const { t1, v1, t2, v2 } = parseAttr(attr);
  const isWeapon = d.effectType === EFFECT.ATTACK || d.effectType === EFFECT.ATTACK_MANASAVE;
  if (isWeapon) {
    if (t1 === 7) { fx.sm[1]++; fx.l[1]++; }
    else if (t1 === 9) { fx.sm[1] += 2; fx.l[1] += 2; }
    if (t1 === 1) fx.critBonus = v1;
    if (t1 === 2) fx.poison = v1 * 5;
    if (t1 === 10) fx.castBonus += v1 * 3;
  } else {
    if (t1 === 11) fx.transMana = Math.min(13, fx.transMana + v1);
    if (t1 === 12) fx.chargeCrit = Math.min(20, fx.chargeCrit + v1);
  }
  switch (t2) {
    case 1: fx.addPR += v2 * 7; break;
    case 2: fx.addAR += v2 * 7; break;
    case 3: fx.addDR += v2 * 7; break;
    case 4: fx.addHP += v2 * 7; break;
    case 5: fx.addSP += v2 * 7; break;
    case 6: fx.addMP += v2 * 7; break;
    case 7: fx.addMR += v2 * 7; break;
    case 8: fx.armor[pos] = (fx.armor[pos] || 0) + v2 * 3; break;
    case 9: fx.addAbsMD = Math.min(80, fx.addAbsMD + v2 * 3); break;
    case 10: fx.addCD += v2; break;
    case 11: fx.addExp += v2 * 10; break;
    case 12: fx.addGold += v2 * 10; break;
  }
}

// Textos como en el cliente original (Game.cpp, LAN_ENG.H).
const MAIN_PREFIX = { 1: "Critical ", 2: "Poisoning ", 3: "Righteous ", 5: "Agile ", 6: "Light ", 7: "Sharp ", 8: "Strong ", 9: "Ancient ", 10: "Special ", 11: "Mana Converting ", 12: "Critical " };
export const attrPrefix = attr => (attr ? MAIN_PREFIX[parseAttr(attr).t1] || "" : "");
export function attrLines(attr) {
  if (!attr) return [];
  const { t1, v1, t2, v2 } = parseAttr(attr), L = [];
  const main = {
    1: `Daño crítico +${v1}`, 2: `Daño de veneno +${v1 * 5}`, 5: "Velocidad de ataque -1", 6: `${v1 * 4} % más ligero`,
    7: "Daño añadido", 8: `Resistencia +${v1 * 7} %`, 9: "Daño extra añadido", 10: `Probabilidad de lanzar magia +${v1 * 3} %`,
    11: `Convierte ${v1} % del daño en MP`, 12: `Probabilidad de crítico +${v1} %`,
  }[t1];
  if (main) L.push(main);
  const sub = {
    1: `Resistencia al veneno +${v2 * 7} %`, 2: `Probabilidad de acierto +${v2 * 7}`, 3: `Defensa +${v2 * 7}`, 4: `Recuperación de HP ${v2 * 7} %`,
    5: `Recuperación de SP ${v2 * 7} %`, 6: `Recuperación de MP ${v2 * 7} %`, 7: `Resistencia mágica +${v2 * 7} %`,
    8: `Absorción física +${v2 * 3} %`, 9: `Absorción mágica +${v2 * 3} %`, 10: `Daño de ataques seguidos +${v2}`,
    11: `Experiencia +${v2 * 10} %`, 12: `Oro +${v2 * 10} %`,
  }[t2];
  if (sub) L.push(sub);
  return L;
}
