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
function rollKillDropRaw(rng, npc, { rates = DROP_RATES, rating = 0, month = new Date().getMonth() + 1, data = null, addGold = 0 } = {}) {
  const type = npc.type;
  if (type === 21 || type === 34 || type === 64) return null;          // guardia, maniquí, cultivo
  if (dice(rng, 1, 10000) < rates.primary) return null;                // hay objeto si la tirada >= tasa primaria
  if (dice(rng, 1, 10000) <= 6000) {
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
  const gen = GEN_LEVEL[type];
  if (!gen) return null;
  let id;
  if (dice(rng, 1, 10000) <= 6000) id = dice(rng, 1, 10000) <= 8000 ? pick(rng, MELEE[gen]) : WAND[gen];
  else id = resolve(rng, ARMOR[gen]);
  if (!id) return null;
  const d = data && data.item(id), ra = d && rollAttributes(rng, d, gen);
  return ra ? { id, count: 1, attr: ra.attr, color: ra.color } : { id, count: 1 };
}

export function rollKillDrop(rng, npc, opts = {}) {
  const r = rollKillDropRaw(rng, npc, opts);
  return r && BANNED_ITEMS.has(r.id) ? null : r;
}
