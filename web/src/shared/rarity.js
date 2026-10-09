// Rareza del botín (propia del port; los atributos y los objetos salen del original).
// Únicos de los reyes: objetos REALES de Item.cfg (IDs sin tocar) ligados a la mecánica de cada rey.
//   1 carmesí (fuego): 645 NecklaceOfEfreet, 638 KnecklaceOfFirePro
//   2 umbrío (nigromante): 633 RingofDemonpower, 648 NecklaceOfLiche
//   3 glacial (hielo): 643 KnecklaceOfIceEle, 642 KnecklaceOfIcePro
//   4 dorado (final): 631 RingoftheAbaddon, 735 RingofDragonpower, 860 NecklaceOfXelima
import { parseAttr } from "./attributes.js";

export const BOSS_UNIQUE = { 1: [645, 638], 2: [633, 648], 3: [643, 642], 4: [631, 735, 860] };
const UNIQUE_IDS = new Set(Object.values(BOSS_UNIQUE).flat());

export const RARITY = ["normal", "mágico", "raro", "único"];
export const RARITY_COLOR = ["#e8e2d0", "#7fb2ff", "#f0d060", "#ff9a3c"];
export const RARITY_EN = ["normal", "magic", "rare", "unique"];

// 0 normal, 1 mágico (algún atributo), 2 raro (dos atributos o uno muy alto), 3 único
export function rarityOf(id, attr) {
  if (UNIQUE_IDS.has(id)) return 3;
  if (!attr) return 0;
  const a = parseAttr(attr);
  if (a.t2 && a.v1 + a.v2 >= 12) return 2;
  if (a.v1 >= 10) return 2;
  return 1;
}

// protección elemental del equipo: ADDEFFECT de Item.cfg (v1 7 luz/aire, 9 fuego, 10 hielo, 11 veneno), tope 90 %
export const ELEM = { 7: "light", 9: "fire", 10: "ice", 11: "poison" };
export const PROT_CAP = 90;
// dos escalones de protección (ajuste del port pedido por los testers; Item.cfg trae 25/50): «Pro» 50 %, «Efreet/IceEle» 90 %
export const PROT_OVERRIDE = { 638: 50, 642: 50, 645: 90, 643: 90 };
