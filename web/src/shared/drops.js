// Botín al morir un monstruo: NpcDeadItemGenerator (HGServer/Game.cpp:47297).
// Las tasas salen de GameConfigs/Settings.cfg: el servidor original las trae a 1 (primary/secondary-drop-rate).
import { dice } from "./rules.js";
import { GOLD, BANNED_ITEMS } from "./items.js";
import { rollAttributes } from "./attributes.js";

export const DROP_RATES = { primary: 1, secondary: 1, repModifier: 5 };

const GEN_LEVEL = {};
const lv = (n, ...types) => types.forEach(t => (GEN_LEVEL[t] = n));
lv(1, 10, 16, 22, 55, 56);
lv(2, 11, 14, 17, 18);
lv(3, 12, 23);
lv(4, 27, 61);
lv(5, 72, 76, 74, 13, 28, 53, 60, 62);
lv(6, 29, 33, 48, 54, 65, 78);
lv(7, 70, 71, 30, 63, 79);
lv(8, 31, 32, 49, 50, 52);
lv(9, 58);
lv(10, 77, 59, 75);

// Botín de la cripta (propio del port): objetos REALES de Item.cfg que un guerrero de nivel 50 puede usar
// (nivel exigido <= 50, peso <= 161 de fuerza). Un array [h, m] = variante de hombre / mujer. Ver docs/sistemas/botin.md.
export const MAX_LEVEL = 50, MAX_STR = 161;
export const CRYPT_LOOT = [
  { common: [15, 23, 25, 28, 31, 34, 62, 65, [454, 472], [455, 475], [457, 477], [461, 482], 79, 80, 81, 82, 83], uncommon: [16, [456, 476], 632], rare: [32] },             // 1-5
  { common: [18, 26, 35, 66, 39, 46, 71, [456, 476], [462, 483], [600, 602], 84, 85, 451, 402], uncommon: [29, 43, 632, 300, 1098], rare: [[458, 478]] },                   // 6-10
  { common: [47, 69, 50, 54, 560, 760, [458, 478], [601, 603], 86, 87], uncommon: [[712, 730], [711, 729], [713, 731], 717, 718, 630, 1099, 1100], rare: [700, 701, 702, 703, 704] },   // 11-15
  { common: [51, 19, 54, 87, [458, 478]], uncommon: [709, 727, [710, 728], [707, 725], [706, 724], [708, 726], 311, 1101, 630],
    rare: [20, [411, 412], [403, 404], [419, 420], [423, 424], 848, 850] },                                                                                                  // 16-20
];
export const cryptBand = depth => Math.min(3, Math.max(0, Math.ceil(depth / 5) - 1));
export const usable = d => !!d && d.levelLimit <= MAX_LEVEL && d.weight <= MAX_STR * 100;

const pick = (rng, list) => list[dice(rng, 1, list.length) - 1];

const MELEE = {
  1: [1, 8, 59],
  2: [12, 15, 65, 62, 23, 31],
  3: [50, 68, 23, 31],
  4: [25, 28, 31, 34, 71],
  5: [31, 34, 72, 844],
  6: [47, 51, 55, 34, 74, 848, 924],
  7: [47, 50, 54, 74, 850, 923],
  8: [50, 560, 615, 56, 846],
  9: [55, 615, 761, 762, 857],
  10: [50, 51, 55, 56, 615, 761, 762, 843, 853],
};
const WAND = { 2: 258, 3: 258, 4: 257, 5: 257, 6: 257, 7: 256, 8: 256 };

// armaduras y escudos: lista de opciones uniformes; un array anidado es otra tirada (1dN)
const ARMOR = {
  1: [79, 81], 2: [79, 81],
  3: [85, 454, 472, 461, 482],
  4: [454, 472, 461, 482, 86],
  5: [455, 475, 87, 454, 472, 461, 482],
  6: [[456, 476], [458, 478], 87, [750, 751, 754, 755, 752, 753, 756, 757], [454, 472], [461, 482]],
  7: [[457, 477, 454, 472, 461, 482], [458, 478], 86, 87, [600, 602], [601, 603]],
  8: [402, 451, 926, 927],
  9: [402, 451],
  10: [457, 477, null, 600],            // en el original, 3 no tiene objeto y 5 (602) no se puede tirar
};
const resolve = (rng, e) => (Array.isArray(e) ? resolve(rng, pick(rng, e)) : e);

const STANDARD = [
  [3000, 95], [4000, 91], [5500, 93], [7000, 96], [8500, 92], [9200, 94],
];

// Devuelve { id, count } o null. `rating` = reputación del jugador (0 hoy).
function rollKillDropRaw(rng, npc, { rates = DROP_RATES, rating = 0, month = new Date().getMonth() + 1, data = null, addGold = 0, depth = 0, gender = 1 } = {}) {
  const type = npc.type;
  if (type === 21 || type === 34 || type === 64) return null;          // guardia, maniquí, cultivo
  if (dice(rng, 1, 10000) < rates.primary) return null;                // hay objeto si la tirada >= tasa primaria
  if (dice(rng, 1, 10000) <= Math.max(3500, 6000 - 100 * depth)) {     // en la cripta, cuanto más hondo menos oro y más equipo
    let count = dice(rng, 1, npc.cfg.goldMax - npc.cfg.goldMin) + npc.cfg.goldMin;
    if (addGold) count += Math.floor((addGold / 100) * count);                // atributo "Oro +%" del equipo
    return { id: GOLD, count };
  }
  const t = rates.secondary - Math.max(-1000, Math.min(1000, rating * rates.repModifier));
  if (dice(rng, 1, 10000) <= t) {
    const r = dice(rng, 1, 12000);
    for (const [lim, id] of STANDARD) if (r <= lim) return { id, count: 1 };
    if (r <= 9800) return { id: pick(rng, [390, 95, 780, 781, 782, 970]), count: 1 };
    if (r <= 10000) {
      const id = pick(rng, [391, 650, 656, 657, 95, 868, 869, 870, 871, 0]);
      return { id: id === 0 ? pick(rng, [651, 652, 653, 654, 655]) : id, count: 1 };
    }
    if (month === 12) return { id: pick(rng, [780, 781, 782]), count: 1 };
    return null;
  }
  let gen = GEN_LEVEL[type];
  if (!gen) return null;
  if (depth) gen = Math.min(10, Math.max(gen, 1 + Math.ceil(depth / 2.2)));     // nivel de generación mínimo según el piso (calidad de atributos)
  let id;
  if (depth) {                                                                    // cripta: tabla propia, 70 % común / 25 % poco común / 5 % codiciado
    const t = CRYPT_LOOT[cryptBand(depth)], r = dice(rng, 1, 100);
    const e = pick(rng, r <= 70 ? t.common : r <= 95 ? t.uncommon : t.rare);
    id = Array.isArray(e) ? pick(rng, e) : e;                                       // sin límite de sexo: el botín cae de cualquier variante y los objetos que no se pueden usar se comercian
  } else if (dice(rng, 1, 10000) <= 6000) id = dice(rng, 1, 10000) <= 8000 ? pick(rng, MELEE[gen]) : WAND[gen];
  else id = resolve(rng, ARMOR[gen]);
  if (!id) return null;
  const d = data && data.item(id), ra = d && rollAttributes(rng, d, gen, Math.floor(depth / 5));
  return ra ? { id, count: 1, attr: ra.attr, color: ra.color } : { id, count: 1 };
}

export function rollKillDrop(rng, npc, opts = {}) {
  const r = rollKillDropRaw(rng, npc, opts);
  if (!r || BANNED_ITEMS.has(r.id)) return null;
  const d = opts.data && opts.data.item(r.id);
  return r.id !== GOLD && d && !usable(d) ? null : r;                         // red de seguridad: nada que un nivel 50 no pueda usar
}
