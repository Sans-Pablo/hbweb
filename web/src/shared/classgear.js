// Equipo por clase y báculos de escuela (v0.62.0). INVENTO del port: el original no restringe equipo por clase.
//  - Cada casco/armadura/pantalón/hauberk de Item.cfg se reparte entre guerrero, mago e invocador por su nombre (classesOf); lo que no
//    encaja en ninguna regla es libre. tests/classgear.test.mjs lista todos para que no quede ninguno sin clasificar.
//  - Niveles: las armas y armaduras con levelLimit > 30 se comprimen a 31..50 (acto 1, nivel máximo 50): applyGear al construir GameData.
//  - Báculos: BerserkWand = Ice Wand (hielo), ResurWand = Darkness Staff (oscuridad), BlackMageTemple = Hero Staff (fuego). Los summons
//    Frost/Tentocle, Liche y Demon exigen en la mano su báculo (o el maestro de su familia, ids 9001..9003 inventados).
export const CLASSES = ["warrior", "mage", "summoner"];
const W = "warrior", M = "mage", S = "summoner";

// [patrón sobre el nombre, clases] por casilla de equipo; gana la primera que encaja. Sin coincidencia: libre.
const RULES = {
  1: [[/^[ae]HeroCap/, null], [/^Wizard-Hat/, [W, M]], [/^Wizard-Cap/, [W, S]], [/./, [W]]],
  2: [[/Robe/, [M]], [/Leather|Ledder/, [S]], [/Plate|Chain|Scale|HeroArmor/, [W]]],
  3: [[/^(Wizard|DarkMage)Hauberk/, [M]], [/^Hauberk/, [W, S]], [/^(Knight|DarkKnight|SangAh)/, [W]]],
  4: [[/^ChainHose/, [W, M, S]], [/^DarkMageLeggings/, [M]], [/^(PlateLeggings|KnightPlateLeg|DarkKnightLeggings|SangAhLeggings)/, [W]]],
};
export function classesOf(d) {
  if (!d || d.type !== 1) return null;
  for (const [re, cl] of RULES[d.equipPos] || []) if (re.test(d.name)) return cl;
  return null;
}
export const classOk = (p, d) => { const c = classesOf(d); return !c || c.includes(p.cls || W); };
export const CLASS_NAME = { warrior: "Guerrero", mage: "Mago", summoner: "Invocador" };
export const classLabel = d => { const c = classesOf(d); return c && c.length < 3 ? c.map(x => CLASS_NAME[x]).join(" / ") : ""; };

export const MAX_GEAR_LEVEL = 50;
export const remapLevel = L => (L <= 30 ? L : Math.min(MAX_GEAR_LEVEL, 30 + Math.round((L - 30) * (MAX_GEAR_LEVEL - 30) / 90)));

// ---- báculos: familia → ids. Los 9xxx son los maestros (nivel 50, 1 de oro, mismo sprite con tinte más fuerte y efecto)
export const FAMILIES = { ice: [861, 862, 9001], dark: [865, 866, 9002], fire: [746, 9003] };
export const MASTERS = {
  9001: { from: 861, family: "ice", display: "Master Ice Wand", tint: 19 },
  9002: { from: 865, family: "dark", display: "Master Darkness Staff", tint: 20 },
  9003: { from: 746, family: "fire", display: "Master Hero Staff", tint: 21 },
};
const NORMAL = { 861: ["Ice Wand(MS.20)", 16], 862: ["Ice Wand(MS.10)", 16], 865: ["Darkness Staff(MS.20)", 17], 866: ["Darkness Staff(MS.10)", 17], 746: ["Hero Staff", 18] };
export const familyOf = id => { for (const k in FAMILIES) if (FAMILIES[k].includes(id)) return k; return null; };
export const isMaster = id => id in MASTERS;
// filas para la tienda del herrero (type 2): los tres báculos maestros (la compra exige nivel 50 → shopsys.buy)
export const masterRows = data => Object.keys(MASTERS).map(id => data.items.get ? data.items.get(+id) : data.byId?.get(+id)).filter(Boolean);
export const MASTER_LEVEL = 50;
// Qué báculo exige cada especie de summon
export const STAFF_FOR = { Frost: "ice", Tentocle: "ice", Liche: "dark", Demon: "fire" };
export const STAFF_MSG = { ice: "necesitas la Ice Wand en la mano", dark: "necesitas el Darkness Staff en la mano", fire: "necesitas el Hero Staff en la mano" };

// ¿tiene el jugador en la mano el báculo de esa familia? (los bots lo ignoran)
export function staffOk(p, data, family) {
  if (!family || p.bot) return true;
  const uid = p.equip?.[8], inst = uid !== undefined && p.bag.find(b => b.uid === uid);
  return !!inst && familyOf(inst.id) === family;
}

// Aplica nombres, niveles, tintes y objetos maestros sobre el Item.cfg convertido (objeto id → def). Se llama una vez al construir GameData.
export function applyGear(items) {
  for (const [id, d] of Object.entries(items)) {
    if (d.type === 1 && d.levelLimit > 30 && d.equipPos !== 0) d.levelLimit = remapLevel(d.levelLimit);
    const n = NORMAL[id]; if (n) { d.display = n[0]; d.tint = n[1]; d.family = familyOf(+id); }
    const c = classesOf(d); if (c) d.cls = c;
  }
  for (const [id, m] of Object.entries(MASTERS)) {
    const src = items[m.from]; if (!src) continue;
    items[id] = { ...src, name: m.display.replace(/ /g, ""), display: m.display, tint: m.tint, family: m.family, master: true, price: 1, levelLimit: MASTER_LEVEL, buyLevel: MASTER_LEVEL, v4: 30, maxLife: 30000 };
  }
  return items;
}
