// PUESTOS de jugador (INVENTO del port): un personaje deja objetos a la venta en un puesto fijo dentro de las tiendas (shop, warehouse, herrería)
// y otros jugadores (o habitantes) los compran aunque el dueño esté desconectado. Comisión 0.
//   - stallopen {title, items:[{uid, price, count}]}: abre un puesto en una casilla libre junto al dueño; los objetos salen de la mochila (depósito).
//   - stallview {sid} → evento privado {t:"stall", k:"view"}; stallbuy {sid, uid, count}; stalltake (el dueño recoge el oro); stallclose (devuelve objetos y oro).
// Estado: adventure.stallDb = [{ sid, owner (minúsculas), name, map, x, y, title, items:[{inst, price}], gold }]; la entidad (citizen, role "stall") apunta a su registro (e.stall).
import * as Inv from "../inventory.js";
import { GOLD, MAX_ITEMS, isStack, itemWeight } from "../items.js";
import { spawnCitizen } from "./citizens.js";
import { gold as ledger } from "./ledger.js";

export const MAPS = new Set(["wrhus_1f"]);          // solo en los warehouses (los más grandes: así los puestos no bloquean las entradas)
export const TTL = 24 * 3600 * 1000;                // un puesto dura 24 h; al caducar (o al quedar vacío) se cierra y lo suyo vuelve al dueño
export const MAX_ITEMS_STALL = 8, MAX_PER_MAP = 12, RANGE = 4, MAX_PRICE = 10000000, SKIN = "Howard";
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const db = w => w.hooks?.stalls?.() || null;
const find = (w, sid) => { for (const e of w.ents.values()) if (e.role === "stall" && e.stall?.sid === sid) return e; return null; };
const say = (w, p, k, extra = {}) => w.emit({ t: "stall", id: p.id, k, ...extra });
const view = (w, p, e) => {
  const s = e.stall;
  return { sid: s.sid, owner: s.name, title: s.title, mine: s.owner === p.name.toLowerCase(), gold: s.owner === p.name.toLowerCase() ? s.gold : 0,
    items: s.items.map(({ inst: i, price }) => ({ uid: i.uid, id: i.id, count: i.count || 1, attr: i.attr || 0, life: i.life, price })) };
};

// cierra el puesto (sin objetos o caducado): quita la entidad y deja el registro «closed» con lo que quede; tick() se lo entrega al dueño cuando esté en el mundo
function shut(w, s) {
  s.closed = true;
  const e = find(w, s.sid);
  if (e) { e.dead = true; w.grid.release(e.x, e.y, e.id); w.ents.delete(e.id); w.emit({ t: "remove", id: e.id }); }
}
function settle(w, s) {                                            // entrega un puesto cerrado al dueño si está aquí y le caben los objetos
  const p = [...w.ents.values()].find(e => e.kind === "player" && e.name.toLowerCase() === s.owner); if (!p || p.dead) return;
  const list = db(w);
  if (s.items.length) {
    let weight = 0, slots = p.bag.length;
    for (const { inst: i } of s.items) { const d = w.data.item(i.id); weight += itemWeight(d, isStack(d) ? i.count : 1); if (!(isStack(d) && p.bag.some(x => x.id === i.id))) slots++; }
    if (slots > MAX_ITEMS || Inv.totalWeight(p, w.data) + weight > Inv.maxLoad(p)) return;
    for (const { inst } of s.items) Inv.addToBag(p, w.data, inst);
  }
  ledger(w, p, s.gold, "stall_collect", { cls: "transfer" }); w.recalc(p);
  say(w, p, "expired", { gold: s.gold, items: s.items.length });
  list.splice(list.indexOf(s), 1);
}
export function tick(w) {
  const list = db(w); if (!list) return;
  for (const s of [...list]) {
    if (s.map === w.map.id && !s.closed) {
      if (s.until > w.time + TTL) s.until = w.time + TTL;           // el reloj del mundo puede haber vuelto atrás tras reiniciar el servidor
      if (w.time >= (s.until ?? (s.until = w.time + TTL)) || !MAPS.has(s.map)) shut(w, s);
    }
    if (s.closed) settle(w, s);
  }
}

export function spawn(w, s) {
  if (s.closed) return null;
  const n = spawnCitizen(w, SKIN, s.x, s.y, "stall");
  if (!n) return null;
  s.x = n.x; s.y = n.y; n.stall = s;
  return n;
}

export const DOOR_GAP = 8;          // un puesto no se abre a menos de 8 casillas de una entrada (antes 4: seguía tapando la salida)
export function open(w, p, cmd) {
  const list = db(w); if (!list) return false;
  const rej = why => w.reject(p, { t: "stallopen" }, why);
  if (!MAPS.has(w.map.id)) return rej("aquí no se pueden abrir puestos (solo en los warehouses)");
  // BUG-012: ni sobre una entrada/teletransporte ni cerca (el puesto taparía la puerta); el hueco del puesto queda a ≥ 2 casillas
  for (const t of w.teleports.values()) if (Math.max(Math.abs(t.x - p.x), Math.abs(t.y - p.y)) <= DOOR_GAP) return rej("no puedes abrir un puesto junto a una entrada o teletransporte");
  const key = p.name.toLowerCase();
  if (p.dead || p.trade) return rej("ahora no puedes abrir un puesto");
  if (list.some(s => s.owner === key && !s.closed)) return rej("ya tienes un puesto abierto");
  if (list.filter(s => s.map === w.map.id && !s.closed).length >= MAX_PER_MAP) return rej("no queda sitio para más puestos aquí");
  const want = Array.isArray(cmd.items) ? cmd.items.slice(0, MAX_ITEMS_STALL) : [];
  const seen = new Set(), take = [];
  for (const o of want) {
    const i = Inv.instOf(p, o.uid), price = Math.floor(+o.price);
    if (!i || i.comp || i.id === GOLD || Inv.isEquipped(p, i.uid) || seen.has(i.uid)) return rej("objeto no válido");
    if (!(price >= 1 && price <= MAX_PRICE)) return rej("precio no válido");
    seen.add(i.uid);
    const d = w.data.item(i.id), n = isStack(d) ? Math.max(1, Math.min(i.count || 1, Math.floor(+o.count) || i.count || 1)) : 1;
    take.push({ i, n, price, d });
  }
  if (!take.length) return rej("pon algún objeto a la venta");
  const spot = w.freeSpotNear(p.x, p.y, 2); if (!spot) return rej("no hay sitio libre junto a ti");
  const s = { sid: w.nextItem++, owner: key, name: p.name, map: w.map.id, x: spot[0], y: spot[1], title: String(cmd.title || "").replace(/[^\p{L}\p{N} .,!'-]/gu, "").slice(0, 24) || "En venta", items: [], gold: 0, until: w.time + TTL };
  for (const { i, n, price, d } of take) {
    let inst = i;
    if (isStack(d) && n < (i.count || 1)) { i.count -= n; inst = { ...i, uid: w.nextItem++, count: n }; } else Inv.removeFromBag(p, i.uid);
    s.items.push({ inst, price });
  }
  list.push(s);
  if (!spawn(w, s)) { for (const { inst } of s.items) Inv.addToBag(p, w.data, inst); list.pop(); return rej("no hay sitio libre junto a ti"); }
  w.recalc(p);
  say(w, p, "opened", { sid: s.sid });
  return true;
}

export function viewCmd(w, p, sid) {
  const e = find(w, sid | 0);
  if (!e || dist(p, e) > RANGE) return w.reject(p, { t: "stallview" }, "el puesto queda lejos");
  say(w, p, "view", view(w, p, e));
  return true;
}

export function buy(w, p, cmd) {
  const e = find(w, cmd.sid | 0), rej = why => w.reject(p, { t: "stallbuy" }, why);
  if (!e || dist(p, e) > RANGE || p.dead) return rej("el puesto queda lejos");
  const s = e.stall;
  if (s.owner === p.name.toLowerCase()) return rej("es tu puesto");
  const row = s.items.find(r => r.inst.uid === cmd.uid); if (!row) return rej("ya no está a la venta");
  const d = w.data.item(row.inst.id), have = row.inst.count || 1, n = isStack(d) ? Math.max(1, Math.min(have, Math.floor(+cmd.count) || 1)) : 1;
  const cost = row.price * n;
  if (p.gold < cost) return say(w, p, "nogold");
  if (!Inv.canCarry(p, w.data, d, n, row.inst)) return say(w, p, "cantcarry");
  if (!(isStack(d) && p.bag.some(i => i.id === row.inst.id)) && p.bag.length >= MAX_ITEMS) return say(w, p, "cantcarry");
  let got;
  if (n < have) { row.inst.count -= n; got = { ...row.inst, uid: w.nextItem++, count: n }; } else { s.items.splice(s.items.indexOf(row), 1); got = row.inst; }
  ledger(w, p, -cost, "stall_buy", { cls: "transfer", peer: s.owner }); s.gold += cost;
  Inv.addToBag(p, w.data, got); w.recalc(p);
  w.emit({ t: "stallsale", id: p.id, item: got.id, count: n, price: cost, owner: s.name, seller: s.owner });
  if (!s.items.length) shut(w, s); else say(w, p, "view", view(w, p, e));
  return true;
}

export function take(w, p) {
  const s = (db(w) || []).find(x => x.owner === p.name.toLowerCase() && x.map === w.map.id && !x.closed);
  if (!s) return w.reject(p, { t: "stalltake" }, "no tienes puesto aquí");
  if (!s.gold) return true;
  ledger(w, p, s.gold, "stall_collect", { cls: "transfer" }); say(w, p, "took", { gold: s.gold }); s.gold = 0;
  const e = find(w, s.sid); if (e) say(w, p, "view", view(w, p, e));
  return true;
}

export function close(w, p) {
  const list = db(w), key = p.name.toLowerCase(), s = list?.find(x => x.owner === key && x.map === w.map.id && !x.closed);
  if (!s) return w.reject(p, { t: "stallclose" }, "no tienes puesto aquí");
  const inst = s.items.map(r => r.inst);
  let weight = 0, slots = p.bag.length;
  for (const i of inst) { const d = w.data.item(i.id); weight += itemWeight(d, isStack(d) ? i.count : 1); if (!(isStack(d) && p.bag.some(x => x.id === i.id))) slots++; }
  if (slots > MAX_ITEMS || Inv.totalWeight(p, w.data) + weight > Inv.maxLoad(p)) return say(w, p, "cantcarry");
  for (const i of inst) Inv.addToBag(p, w.data, i);
  ledger(w, p, s.gold, "stall_collect", { cls: "transfer" });
  list.splice(list.indexOf(s), 1);
  const e = find(w, s.sid);
  if (e) { e.dead = true; w.grid.release(e.x, e.y, e.id); w.ents.delete(e.id); w.emit({ t: "remove", id: e.id }); }
  w.recalc(p);
  say(w, p, "closed", { gold: s.gold });
  return true;
}

// Para los habitantes: puestos de este mapa con algo a la venta
export const stallsOf = (w) => [...w.ents.values()].filter(e => e.role === "stall" && e.stall?.items.length && !e.stall.closed);
