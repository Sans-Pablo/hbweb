// Botín al morir un monstruo: NpcDeadItemGenerator (HelbreathOriginal HGServerConsole/HG.cpp:29315-29990; llamada en NpcKilledHandler, HG.cpp:6586).
// Constantes: DropConfig.h (DROP_RATE_BONUS_MULTIPLIER 0.8, GOLD_DROP_CHANCE_MODIFIER 6000, NORMAL_ITEM_DROP_CHANCE_MODIFIER 5000).
// Decisiones del port: el oro no cae (todo es compra/venta); la cripta (depth>0) usa su tabla propia; los casos en que el original
// deja iItemID sin definir (varitas de nivel 1, 9 y 10; armaduras de 9 y 10; banda 9 fuera de diciembre) no sueltan nada.
import { dice } from "./rules.js";
import { GOLD, BANNED_ITEMS } from "./items.js";
import { rollAttributes } from "./attributes.js";

const DROP_RATE_BONUS_MULTIPLIER = 0.8, GOLD_DROP_CHANCE = 6000, NORMAL_ITEM_DROP_CHANCE = 5000;


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
import { MAX_LEVEL } from "./levelcap.js";
export { MAX_LEVEL };
export const MAX_STR = 161;
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

// Armas cuerpo a cuerpo por nivel de generación (HG.cpp:29504-29640, orden de los case)
const MELEE = {
  1: [1, 8, 59],
  2: [12, 15, 65, 62, 23, 31],
  3: [17, 68, 23, 31],
  4: [23, 25, 28, 31, 34],
  5: [31, 34, 71],
  6: [50, 54, 46, 31, 34, 617],
  7: [50, 54, 31, 34],
  8: [50, 54, 560, 31, 34, 55, 615],
  9: [23, 25, 28, 31, 34, 760],
  10: [46, 31, 34, 760, 761],
};
// Varitas (HG.cpp:29640-29665)
const WAND = { 2: 258, 3: 258, 4: 257, 5: 257, 6: 257, 7: 256, 8: 256 };
// Armaduras y escudos (HG.cpp:29668-29860); un array anidado es otra tirada uniforme
const ARMOR = {
  1: [79, 81], 2: [79, 81], 3: [81],
  4: [454, 472, 461, 482, 83],
  5: [455, 475, 84],
  6: [[456, 476], [458, 478], 85, [750, 751, 754, 755, 752, 753, 756, 757], [454, 472], [461, 482]],
  7: [[457, 477], [458, 478], 86, 87, [600, 602], [601, 603]],
  8: [402],
};
const resolve = (rng, e) => (Array.isArray(e) ? resolve(rng, pick(rng, e)) : e);

// Botín estándar, 12000 tiradas (HG.cpp:29393-29450)
const STANDARD = [[3000, 95], [4000, 91], [5500, 93], [7000, 96], [8500, 92], [9200, 94]];
const DYES = [881, 882, 883, 884, 885, 886, 887, 888, 889, 890, 655];
function standardDrop(rng, month) {
  const r = dice(rng, 1, 12000);
  for (const [lim, id] of STANDARD) if (r <= lim) return id;
  if (r <= 9800) return pick(rng, [390, 95]);
  if (r <= 10000) {
    const k = dice(rng, 1, 6);
    if (k <= 4) return [391, 650, 656, 657][k - 1];
    if (k === 5) return 95;
    const b = dice(rng, 1, 5);
    return b <= 4 ? 650 + b : pick(rng, DYES);                 // 651-654 bolas, 5 → tintes/perla
  }
  return month === 12 ? pick(rng, [780, 781, 782, 91]) : 0;    // el `|| 55` del original hace la condición de tipo siempre cierta
}

// Devuelve { id, count } o null. `rating` = reputación del jugador; `party`: bonus de grupo (+15 %).
function rollKillDropRaw(rng, npc, { rating = 0, month = new Date().getMonth() + 1, data = null, addGold = 0, depth = 0, party = false } = {}) {
  const type = npc.type;
  if (type === 21 || type === 34 || type === 64) return null;          // guardia, maniquí, cultivo
  let prob = 5500 + (party ? 1500 : 0);                                // HG.cpp:29340-29350
  prob = 10000 - (10000 - prob) * (1 - DROP_RATE_BONUS_MULTIPLIER);    // HG.cpp:29354
  if (dice(rng, 1, 10000) > prob) return null;
  if (dice(rng, 1, 10000) <= (depth ? Math.max(3500, GOLD_DROP_CHANCE - 100 * depth) : GOLD_DROP_CHANCE)) {   // en la cripta, cuanto más hondo menos oro
    const g = npc.cfg.gold ?? npc.cfg.goldMax;                                         // HG.cpp:29369-29386
    let count = !g ? 0 : g <= 4 ? dice(rng, 1, g) : dice(rng, 1, 2) === 1 ? g + dice(rng, 1, Math.floor(g / 5)) : g - dice(rng, 1, Math.floor(g / 5));
    if (addGold) count += Math.floor((addGold / 100) * count);
    return count ? { id: GOLD, count } : null;
  }
  const t = NORMAL_ITEM_DROP_CHANCE - Math.max(-3000, Math.min(3000, rating));   // HG.cpp:29396-29401
  if (dice(rng, 1, 10000) <= t) { const id = standardDrop(rng, month); return id ? { id, count: 1 } : null; }
  let gen = GEN_LEVEL[type];
  if (!gen) return null;
  if (depth) gen = Math.min(10, Math.max(gen, 1 + Math.ceil(depth / 2.2)));     // nivel de generación mínimo según el piso (calidad de atributos)
  let id;
  if (depth) {                                                                    // cripta: tabla propia, 70 % común / 25 % poco común / 5 % codiciado
    const t = CRYPT_LOOT[cryptBand(depth)], r = dice(rng, 1, 100);
    const e = pick(rng, r <= 70 ? t.common : r <= 95 ? t.uncommon : t.rare);
    id = Array.isArray(e) ? pick(rng, e) : e;
  } else if (dice(rng, 1, 10000) <= 6000) id = dice(rng, 1, 10000) <= 8000 ? pick(rng, MELEE[gen]) : WAND[gen];   // arma 60 % (cuerpo a cuerpo 80 %, varita 20 %)
  else id = resolve(rng, ARMOR[gen]);                                            // armadura/escudo 40 %
  if (!id) return null;
  const d = data && data.item(id), ra = d && rollAttributes(rng, d, gen, Math.floor(depth / 5));
  return ra ? { id, count: 1, attr: ra.attr, color: ra.color } : { id, count: 1 };
}

const NEVER_DROP = /Knight|Hero|SangAh/;

export function rollKillDrop(rng, npc, opts = {}) {
  const r = rollKillDropRaw(rng, npc, opts);
  if (!r || r.id === GOLD || BANNED_ITEMS.has(r.id)) return null;                // el oro ya no cae: todo es compra, venta e intercambio
  const d = opts.data && opts.data.item(r.id);
  if (d && NEVER_DROP.test(d.name)) return null;                              // equipo Knight, Hero y Sang-Ah: nunca cae de un monstruo
  return d && !usable(d) ? null : r;                                          // red de seguridad: nada que un nivel 50 no pueda usar
}

// Resumen del botín posible de un tipo de monstruo (para el panel del menú automático): nivel de generación y ids de objeto.
export function dropInfo(type) {
  const gen = GEN_LEVEL[type] || 0, flat = a => (a || []).flat(2).filter(Boolean);
  return { gen, weak: false, items: [...new Set([...(MELEE[gen] || []), ...(WAND[gen] ? [WAND[gen]] : []), ...flat(ARMOR[gen])])] };
}
