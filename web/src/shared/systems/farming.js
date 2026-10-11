// Agricultura, tal cual el servidor original (HGServer): sembrar con una bolsa de semillas, cuidar con la azada y cosechar.
//  - Sembrar: HG.cpp ITEMEFFECTTYPE_ITEMFARM -> __bSetAgricultureItem (casilla de cultivo, tope por mapa, maestría >= nivel de la semilla).
//  - Cuidar: char/combat.cpp (arma tipo 27 contra un NPC "Crops" con actionLimit 5 y buildCount > 0), tablas de char/Skill.cpp.
//  - Cosecha: HG.cpp bCropsItemDrop (producto y experiencia según el tipo de cultivo).
import { DX, DY, dist } from "../const.js";
import { dice } from "../rules.js";
import * as Inv from "../inventory.js";
import { gainSSN, SKILL } from "../skills.js";
import { groundPush } from "./ground.js";
import { newInst } from "./itemsys.js";
import { giveExp, wear } from "./combatsys.js";
import { EQUIP } from "../items.js";

export const MAX_CROPS = 200;                    // MAXAGRICULTURE
export const EFFECT_FARM = 30;                   // ITEMEFFECTTYPE_ITEMFARM
export const HOE_WTYPE = 27;
export const GROW = 30;                          // buildCount inicial = minBravery de "Crops" (Npc.cpp)
// Skill.cpp: filas = maestría del jugador, columnas = nivel de la semilla (20, 30 ... 100)
const CROPS = [
  [42, 34, 27, 21, 16, 12, 9, 7, 6], [43, 40, 33, 27, 22, 18, 15, 13, 10], [44, 41, 38, 32, 27, 23, 20, 18, 13],
  [45, 42, 39, 36, 31, 27, 24, 22, 15], [46, 43, 40, 37, 34, 30, 27, 25, 16], [47, 44, 41, 38, 35, 32, 29, 27, 20],
  [48, 45, 42, 39, 36, 33, 30, 28, 23], [49, 46, 43, 40, 37, 34, 31, 28, 25], [50, 47, 44, 41, 38, 35, 32, 29, 26],
];
const DROP = [
  [40, 0, 0, 0, 0, 0, 0, 0, 0], [41, 38, 0, 0, 0, 0, 0, 0, 0], [43, 40, 36, 0, 0, 0, 0, 0, 0],
  [46, 42, 38, 35, 0, 0, 0, 0, 0], [50, 45, 41, 37, 33, 0, 0, 0, 0], [55, 49, 44, 40, 35, 31, 0, 0, 0],
  [61, 54, 48, 43, 38, 33, 30, 0, 0], [68, 60, 53, 47, 42, 37, 32, 28, 0], [76, 67, 59, 52, 46, 41, 35, 29, 24],
];
// probabilityTable: devuelve la probabilidad si la tirada 1d100 la cumple, 0 si no
export function probability(w, mastery, level, table) {
  const x = Math.floor((mastery - 20) / 10), y = Math.floor((level - 20) / 10);
  if (x < 0 || x > 8 || y < 0 || y > 8) return 0;
  const v = (table === 1 ? CROPS : DROP)[x][y];
  return v >= dice(w.rng, 1, 100) ? v : 0;
}
// bCropsItemDrop: tipo de cultivo -> [producto, dados de experiencia]. El Ginseng original es 731; en el port es el 721.
export const PRODUCT = { 1: [820, 3], 2: [821, 3], 3: [822, 4], 4: [823, 4], 5: [824, 5], 6: [825, 5], 7: [826, 6], 8: [827, 6], 9: [828, 7], 10: [829, 7], 11: [830, 8], 12: [831, 8], 13: [832, 9], 14: [721, 10] };
export const CROP_NAMES = { 1: "WaterMelon", 2: "Pumpkin", 3: "Garlic", 4: "Barley", 5: "Carrot", 6: "Radish", 7: "Corn", 8: "Chinese Bellflower", 9: "Melon", 10: "Tomato", 11: "Grapes", 12: "Blue Grapes", 13: "Mushroom", 14: "Ginseng" };

const cropCount = w => { let n = 0; for (const e of w.ents.values()) if (e.crop && !e.dead) n++; return n; };

// Usar una bolsa de semillas (effectType 30) sobre la casilla que se mira.
export function plant(w, p, d) {
  const tx = p.x + DX[p.dir], ty = p.y + DY[p.dir];
  if (cropCount(w) >= MAX_CROPS) return w.reject(p, { t: "use" }, "You cannot farm any more.");
  if (d.v2 > (p.skills[SKILL.FARMING] || 0)) return w.reject(p, { t: "use" }, "Farming is not possible with your current farming skill.");
  const occ = w.grid.occupant(tx, ty), o = occ !== undefined && w.ents.get(occ);
  if ((o && o.crop) || !w.grid.farm(tx, ty) || !w.grid.free(tx, ty)) return w.reject(p, { t: "use" }, "This is not an area to farm.");
  const cfg = w.npcDb.Crops;
  if (!cfg) return w.reject(p, { t: "use" }, "This is not an area to farm.");
  const n = w.makeEnt("npc", tx, ty);
  Object.assign(n, {
    name: "Crops", type: cfg.type, cfg, dur: { stopFrame: 1e9 }, dir: 1, hp: cfg.hitDice, maxHp: cfg.hitDice, exp: 0, absDamage: 0,
    target: null, nextAct: Infinity, phase: 0, special: 0, crop: d.v1, cropLv: d.v2, build: GROW, a2: d.v1 << 8 | 1, noDrop: true, noDieRemainExp: 0,
  });
  w.emit({ t: "spawn", id: n.id });
  return true;
}

const remove = (w, n) => { n.dead = true; w.grid.release(n.x, n.y, n.id); w.ents.delete(n.id); w.emit({ t: "remove", id: n.id }); };
function drop(w, p, n, atCrop) {
  const pr = PRODUCT[n.crop]; if (!pr) return;
  giveExp(w, p, dice(w.rng, pr[1], 10));
  groundPush(w, atCrop ? n.x : p.x, atCrop ? n.y : p.y, newInst(w, pr[0], 1), true);
}

// Un golpe de azada (arma tipo 27) contra un cultivo: char/combat.cpp. Devuelve true si se ha atendido como cultivo.
export function hoe(w, p, n) {
  if (p.eff?.wtype !== HOE_WTYPE || p.dead || n.dead || dist(p, n) > 1) return false;
  const lv = p.skills[SKILL.FARMING] || 0, lim = n.cropLv;
  if (lv < 20 || p.level < 20) return true;
  const up = () => { if (lv <= lim + 10) gainSSN(p, SKILL.FARMING, 1); };
  switch (n.build) {
    case 1: n.a2 = n.crop << 8 | 3; up(); if (probability(w, lv, lim, 2) > 0) drop(w, p, n, true); remove(w, n); return true;
    case 8: n.a2 = n.crop << 8 | 3; up(); if (probability(w, lv, lim, 2) > 0) { up(); drop(w, p, n, false); } break;
    case 18: n.a2 = n.crop << 8 | 2; up(); if (probability(w, lv, lim, 2) > 0) { up(); drop(w, p, n, false); } break;
  }
  if (probability(w, lv, lim, 1) > 0 || n.build === 1 || n.build === 8 || n.build === 18) {
    const uid = p.equip[EQUIP.RHAND] ?? p.equip[EQUIP.TWOHAND];
    if (uid !== undefined) wear(w, p, uid, 1);
    n.build = Math.max(0, n.build - 1);
  }
  return true;
}
