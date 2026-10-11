import { DUMMY_NAMES } from "../shared/systems/talents.js";
// Nombres y sprites de los objetos (los datos vienen de Item.cfg / ItemName.cfg).
let DATA = null;
export const setData = d => { DATA = d; };
export const itemDef = id => DATA && DATA.item(id);
import { attrPrefix } from "../shared/attributes.js";
export const itemName = (id, attr = 0, comp = null) => comp ? (DUMMY_NAMES[comp.cls] ? DUMMY_NAMES[comp.cls] : comp.sp.replace(/-/g, " ")) + " Ball" : attrPrefix(attr) + ((itemDef(id) || {}).display || "objeto " + id);
// Conjunto de sprites del suelo / mochila para el sprite de Item.cfg (1..19 -> 0..18; 20..22 -> 17..19)
export const itemSet = s => (s <= 19 ? s - 1 : s - 3);
export const groundKey = d => "ig" + itemSet(d.sprite);
export const packKey = d => "ip" + itemSet(d.sprite);
// clave de icono: los báculos de escuela llevan su tinte fijo detrás de «#» (gui.putGame lo separa y tiñe)
export const iconKey = d => packKey(d) + (d.tint ? "#" + d.tint : "");
