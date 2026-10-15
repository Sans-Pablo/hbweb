// MODO AUTOMÁTICO del jugador (INVENTO del port; el original no lo trae). Dos modos, ambos solo deciden ADÓNDE ir o A QUIÉN atacar:
// el cliente (controller.js) convierte la decisión en la misma intención que un clic (mover / atacar / recoger), así que el servidor valida
// cada paso igual que siempre y no hay nada que hacer en red. Se cancela con cualquier clic o con «/auto stop».
//   hunt {mob}: caza SOLO esa criatura (nombre de NPC.cfg, glosario en orders.js) donde esté el jugador, recoge el botín cercano y se detiene
//               si la vida baja del 35 %, si no queda ninguna en el mapa durante 20 s, o si mueres.
//   run {place}: anda hasta el habitante de ciudad (almacén, tienda, herrería, mago, granjero, arena, hospital) y le abre su diálogo.
//   decide(w, me, auto) -> { intent?, open?, stop?, msg? } (msg = [es, en])
import { dist } from "../const.js";
import { NPC } from "./shopsys.js";
import { groundTop } from "./ground.js";
import { mobOf } from "./orders.js";

export const HP_STOP = 0.35, IDLE_STOP_MS = 20000, SIGHT = 40, LOOT_RANGE = 7;
// destino -> filtro de habitante (los de rol propio llevan e.role; el resto, e.type de shopsys.js NPC)
export const PLACES = {
  warehouse: { re: /alm[ae]c[ae]n|warehouse|banco|bank|cofre|bodega/, type: NPC.WAREHOUSE, es: "el almacén", en: "the warehouse" },
  shop: { re: /tienda|shop|comprar|vender|sell|buy/, type: NPC.SHOP, es: "la tienda", en: "the shop" },
  smith: { re: /herrer|blacksmith|smith|forja/, type: NPC.BLACKSMITH, es: "la herrería", en: "the blacksmith" },
  mage: { re: /mago|magia|hechic|sorcer|mage|spell/, type: NPC.MAGE, es: "el mago", en: "the sorcerer" },
  farmer: { re: /granj|farmer|semilla|seed/, role: "farmer", es: "el granjero", en: "the farmer" },
  hospital: { re: /hospital|gail|mascota|pet ?heal/, role: "pethospital", es: "el hospital de mascotas", en: "the pet hospital" },
  petmage: { re: /hechicero de mascotas|pet ?sorcerer|pet ?mage|grimorio/, role: "petmage", es: "el hechicero de mascotas", en: "the pet sorcerer" },
};
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
export function placeOf(text) {
  const t = norm(text);
  for (const k of ["petmage", "hospital", "warehouse", "smith", "mage", "farmer", "shop"]) if (PLACES[k].re.test(t)) return k;
  return null;
}
// habitante más cercano de ese destino en el mapa actual (o null)
export function placeEnt(w, me, place) {
  const P = PLACES[place]; let best = null, bd = 1e9;
  if (!P) return null;
  for (const e of w.ents.values()) {
    if (e.kind !== "citizen" || (P.role ? e.role !== P.role : e.role || e.type !== P.type)) continue;
    const d = dist(me, e); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
export function parseAuto(text, names = []) {                                  // «/auto hunt slime», «/auto run almacén», «/auto stop»
  const m = String(text || "").trim().match(/^(hunt|caza|cazar|run|ir|ruta|stop|para|parar|off)\b\s*(.*)$/i);
  if (!m) return null;
  const k = m[1].toLowerCase();
  if (/^(stop|para|parar|off)$/.test(k)) return { kind: "stop" };
  if (/^(hunt|caza|cazar)$/.test(k)) { const mob = mobOf(m[2], names); return mob ? { kind: "hunt", mob } : { kind: "bad", why: m[2] }; }
  const place = placeOf(m[2]); return place ? { kind: "run", place } : { kind: "bad", why: m[2] };
}
export const label = (a, lang = "es") => !a ? "" : a.kind === "hunt" ? a.mob : PLACES[a.place]?.[lang] || "";

export function decide(w, me, a) {
  if (!a) return {};
  if (me.dead) return { stop: true, msg: ["Has muerto: modo automático detenido.", "You died: auto mode stopped."] };
  if (a.kind === "run") {
    const e = placeEnt(w, me, a.place);
    if (!e) return { stop: true, msg: ["No hay " + PLACES[a.place].es + " en este mapa.", "There is no " + PLACES[a.place].en + " on this map."] };
    if (dist(me, e) <= 2) return { stop: true, open: e, msg: ["Llegué a " + PLACES[a.place].es + ".", "Arrived at " + PLACES[a.place].en + "."] };
    const spot = w.freeSpotNear?.(e.x, e.y + 1) || [e.x, e.y + 1];
    return { intent: { t: "move", x: spot[0], y: spot[1] } };
  }
  if (me.hp < me.maxHp * HP_STOP) return { stop: true, msg: ["Vida baja: caza automática detenida.", "Low health: auto hunt stopped."] };
  let t = null, bd = 1e9;
  for (const e of w.ents.values()) {
    if (e.kind !== "npc" || e.dead || e.name !== a.mob) continue;
    const d = dist(me, e); if (d <= SIGHT && d < bd) { bd = d; t = e; }
  }
  if (t) { a.idle = null; return { intent: { t: "attack", id: t.id } }; }
  for (let dx = -LOOT_RANGE; dx <= LOOT_RANGE; dx++) for (let dy = -LOOT_RANGE; dy <= LOOT_RANGE; dy++) {       // sin presas a la vista: botín cercano
    const x = me.x + dx, y = me.y + dy;
    if (!w.grid.inside(x, y) || !groundTop(w, x, y) || a.skip?.has(x + "," + y)) continue;
    const d = Math.max(Math.abs(dx), Math.abs(dy)); if (d < bd) { bd = d; t = { x, y }; }
  }
  if (t) {
    const k = t.x + "," + t.y; a.tries ||= {}; a.skip ||= new Set();
    a.tries[k] ||= 0;
    if (t.x === me.x && t.y === me.y && ++a.tries[k] > 2) a.skip.add(k);       // no cabe en la mochila: no insiste
    return { intent: { t: "pickup", x: t.x, y: t.y } };
  }
  a.idle ??= w.time;
  if (w.time - a.idle > IDLE_STOP_MS) return { stop: true, msg: ["No quedan " + a.mob + " a la vista: caza automática detenida.", "No " + a.mob + " left in sight: auto hunt stopped."] };
  return {};
}
