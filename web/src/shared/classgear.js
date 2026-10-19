// Equipo por clase y báculos de escuela (v0.62.0). INVENTO del port: el original no restringe equipo por clase.
//  - Cada casco/armadura/pantalón/hauberk de Item.cfg se reparte entre guerrero, mago e invocador por su nombre (classesOf); lo que no
//    encaja en ninguna regla es libre. tests/classgear.test.mjs lista todos para que no quede ninguno sin clasificar.
//  - Niveles: las armas y armaduras con levelLimit > 30 se comprimen a 31..50 (acto 1, nivel máximo 50): applyGear al construir GameData.
//  - Báculos: BerserkWand = Ice Wand (hielo), ResurWand = Darkness Staff (oscuridad), BlackMageTemple = Hero Staff (fuego). Los summons
//    Las especies superiores con familia (evolutions.js: Demon, Beholder, Liche) exigen en la mano su báculo.
export const CLASSES = ["warrior", "mage", "summoner"];
const W = "warrior", M = "mage", S = "summoner";

// [patrón sobre el nombre, clases] por casilla de equipo; gana la primera que encaja. Sin coincidencia: libre.
const RULES = {
  1: [[/^[ae]HeroCap/, [W]], [/^Master-Cap/, [W, S]], [/^Wizard-Hat/, [W, M]], [/^Wizard-Cap/, [W, S]], [/./, [W]]],
  2: [[/Robe/, [M]], [/Leather|Ledder/, [S]], [/Plate|Chain|Scale|HeroArmor/, [W]], [/Bodice|Tunic/, [W, M, S]]],
  3: [[/^(Wizard|DarkMage)Hauberk/, [M]], [/^(Master)?Hauberk/, [W, S]], [/^(Knight|DarkKnight|SangAh|[ae]Hero)/, [W]], [/Shirt|Chemise/, [W, M, S]]],
  4: [[/^ChainHose/, [W, M, S]], [/^MasterLeggings/, [W]], [/^DarkMageLeggings/, [M]], [/^(PlateLeggings|KnightPlateLeg|DarkKnightLeggings|SangAhLeggings|[ae]HeroLeggings)/, [W]], [/Trousers|Skirt/, [W, M, S]]],
};
export function classesOf(d) {
  if (!d || d.type !== 1) return null;
  for (const [re, cl] of RULES[d.equipPos] || []) if (re.test(d.name)) return cl;
  return null;
}
// v0.85.76 (obs. 33): sin restricción de equipo por clase (como el original: cualquier clase lleva cualquier pieza de Item.cfg). Poner a true para reactivarla.
export const CLASS_GEAR = false;
export const classOk = (p, d) => { if (!CLASS_GEAR) return true; const c = classesOf(d); return !c || c.includes(p.cls || W); };
export const CLASS_NAME = { warrior: "Guerrero", mage: "Mago", summoner: "Invocador" };
export const classLabel = d => { if (!CLASS_GEAR) return ""; const c = classesOf(d); return c && c.length < 3 ? c.map(x => CLASS_NAME[x]).join(" / ") : ""; };

import { MAX_LEVEL } from "./levelcap.js";
export const MAX_GEAR_LEVEL = MAX_LEVEL;
export const remapLevel = L => Math.min(MAX_GEAR_LEVEL, L);   // v0.85.58: con tope 140 el equipo conserva el nivel original (antes se comprimía a 31..50)

// ---- báculos: familia → ids. Los 9xxx son los maestros (nivel 50, 1 de oro, mismo sprite con tinte más fuerte y efecto)
export const FAMILIES = { ice: [861, 862], dark: [865, 866], fire: [746], psychic: [9004] };
// Psychic Controller (invento): la Kloness Wand (863, sprite 17 fotograma 5) como mando de los summons psíquicos. Cualquier clase puede llevarla
// (también el mago: cambia de arma a cambio de control PvP). Sin ella en la mano los summons psíquicos no se mantienen. Se vende en el herrero.
export const PSYCHIC_ITEM = { id: 9004, from: 863, display: "Psychic Controller", family: "psychic", price: 3000 };
export const MASTERS = {};                                                        // v0.85.62 (obs. 6): sin báculos maestros; queda el mapa vacío por compatibilidad
const NORMAL = { 861: ["Ice Wand(MS.20)", 16], 862: ["Ice Wand(MS.10)", 16], 865: ["Darkness Staff(MS.20)", 17], 866: ["Darkness Staff(MS.10)", 17], 746: ["Hero Staff", 18] };
export const familyOf = id => { for (const k in FAMILIES) if (FAMILIES[k].includes(id)) return k; return null; };
export const isMaster = id => id in MASTERS;
// filas para la tienda del herrero (type 2): los tres báculos maestros (la compra exige nivel 50 → shopsys.buy)
export const masterRows = data => Object.keys(MASTERS).map(id => data.items.get ? data.items.get(+id) : data.byId?.get(+id)).filter(Boolean);
export const MASTER_LEVEL = 50;
// Qué báculo exige cada especie de summon
export { STAFF_FOR } from "./systems/evolutions.js";                                  // especie superior → familia de báculo (tabla única)
export const STAFF_MSG = { ice: "necesitas la Ice Wand en la mano", dark: "necesitas el Darkness Staff en la mano", fire: "necesitas el Hero Staff en la mano", psychic: "necesitas el Psychic Controller en la mano" };

// ¿tiene el jugador en la mano el báculo de esa familia? (los bots lo ignoran)
export function staffOk(p, data, family) {
  if (!family || p.bot || p.free) return true;
  const uid = p.equip?.[8], inst = uid !== undefined && p.bag.find(b => b.uid === uid);
  return !!inst && familyOf(inst.id) === family;
}

// Aplica nombres, niveles, tintes y objetos maestros sobre el Item.cfg convertido (objeto id → def). Se llama una vez al construir GameData.
export function applyGear(items) {
  for (const [id, d] of Object.entries(items)) {
    if (d.type === 1 && d.levelLimit > 30 && d.equipPos !== 0) d.levelLimit = remapLevel(d.levelLimit);
    const n = NORMAL[id]; if (n) { d.display = n[0]; d.tint = n[1]; d.family = familyOf(+id); }
    if (CLASS_GEAR) { const c = classesOf(d); if (c) d.cls = c; }
  }
  const pc = PSYCHIC_ITEM, ps = items[pc.from];
  if (ps) items[pc.id] = { ...ps, name: pc.display.replace(/ /g, ""), display: pc.display, family: pc.family, price: pc.price, levelLimit: 1, buyLevel: 0, maxLife: 30000, cls: undefined };
  return items;
}
