import { DUMMY_NAMES } from "../shared/systems/talents.js";
import { shown } from "../shared/systems/evolutions.js";
// Nombres y sprites de los objetos (los datos vienen de Item.cfg / ItemName.cfg).
let DATA = null;
export const setData = d => { DATA = d; };
export const itemDef = id => DATA && DATA.item(id);
import { attrPrefix } from "../shared/attributes.js";
export const itemName = (id, attr = 0, comp = null) => comp ? (DUMMY_NAMES[comp.cls] ? DUMMY_NAMES[comp.cls] : shown(comp.sp)) + " Ball" : attrPrefix(attr) + ((itemDef(id) || {}).display || "objeto " + id);
// Conjunto de sprites del suelo / mochila para el sprite de Item.cfg (1..19 -> 0..18; 20..22 -> 17..19)
export const itemSet = s => (s <= 19 ? s - 1 : s - 3);
export const groundKey = d => "ig" + itemSet(d.sprite);
export const packKey = d => "ip" + itemSet(d.sprite);
// clave de icono: los báculos de escuela llevan su tinte fijo detrás de «#» (gui.putGame lo separa y tiñe)
// it: la instancia; su color en un arma usa la paleta aditiva del original (WEAPON_RGB), con prefijo «w»
export const iconKey = (d, it) => packKey(d) + (it && it.color > 0 && it.color <= 10 && (d.equipPos === 8 || d.equipPos === 9) ? "#w" + it.color : d.tint ? "#" + d.tint : "");
