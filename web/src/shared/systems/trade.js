// COMERCIO entre jugadores y habitantes (INVENTO del port, a partir del cuadro de intercambio del original: DEF_COMMONTYPE_EXCHANGEITEMTOCHAR /
// SETEXCHANGEITEM / CONFIRMEXCHANGEITEM / CANCELEXCHANGEITEM en Client/Game.cpp). Sirve para regalar, intercambiar y comprar/vender (con oro).
//   - tradereq {name}: pide comerciar con otro jugador del mismo mapa (≤ 10 casillas, vivo, sin otro trato en curso). El otro acepta o rechaza (tradeanswer).
//   - Con la ventana abierta cada parte pone sus objetos (tradeset/tradeunset: de la mochila, sin equipar, sin summons) y una cantidad de oro (tradegold).
//     Cualquier cambio quita la confirmación de las dos. Cuando las dos confirman (tradeok) se hace el cambio entero o no se hace nada
//     (peso y casillas de la mochila de ambos) y se avisa a los dos. tradecancel, la distancia, la muerte o desconectarse lo cancelan.
// Estado: p.trade = { with, offer: [uid], gold, ok }; p.tradeReq = { to }; p.tradeQuery = { from }. Eventos privados {t:"trade", id, k, ...} y {t:"tradequery", id, from}.
import * as Inv from "../inventory.js";
import { GOLD, MAX_ITEMS, isStack, itemWeight } from "../items.js";
import { itemLevelOf } from "../itemlevel.js";

export const RANGE = 10, MAX_OFFER = 8;
const near = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= RANGE;
const other = (w, p) => (p.trade ? w.ents.get(p.trade.with) : null);

function view(w, p) {
  const t = p.trade;
  return { items: t.offer.map(uid => Inv.instOf(p, uid)).filter(Boolean).map(i => ({ uid: i.uid, id: i.id, count: i.count || 1, attr: i.attr || 0, life: i.life, ilvl: itemLevelOf(w.data, i) })), gold: t.gold, ok: t.ok };
}
function push(w, p) {
  const o = other(w, p); if (!p.trade || !o?.trade) return;
  w.emit({ t: "trade", id: p.id, k: "state", name: o.name, mine: view(w, p), theirs: view(w, o) });
  w.emit({ t: "trade", id: o.id, k: "state", name: p.name, mine: view(w, o), theirs: view(w, p) });
}
export function cancel(w, p, why = "") {
  if (p.tradeReq) { const t = w.ents.get(p.tradeReq.to); delete p.tradeReq; if (t?.tradeQuery?.from === p.id) { delete t.tradeQuery; w.emit({ t: "tradequery", id: t.id, from: null }); } }
  if (p.tradeQuery) { const f = w.ents.get(p.tradeQuery.from); delete p.tradeQuery; if (f) { delete f.tradeReq; w.emit({ t: "trade", id: f.id, k: "refused", name: p.name }); } }
  if (!p.trade) return false;
  const o = other(w, p);
  delete p.trade; w.emit({ t: "trade", id: p.id, k: "cancel", why });
  if (o?.trade) { delete o.trade; w.emit({ t: "trade", id: o.id, k: "cancel", why: why || p.name }); }
  return true;
}
const busy = p => !!(p.trade || p.tradeReq || p.tradeQuery);

export function request(w, p, name) {
  const key = String(name || "").toLowerCase();
  const t = [...w.ents.values()].find(e => e.kind === "player" && e !== p && e.name.toLowerCase() === key);
  if (!t || t.dead || p.dead || busy(p) || busy(t) || !near(p, t) || w.pvp && t.side !== p.side) return w.reject(p, { t: "tradereq" }, "no puede comerciar ahora");
  p.tradeReq = { to: t.id, at: w.time }; t.tradeQuery = { from: p.id };
  w.emit({ t: "tradequery", id: t.id, from: p.name });
  return true;
}
export function answer(w, p, yes) {
  const q = p.tradeQuery; if (!q) return false;
  const f = w.ents.get(q.from); delete p.tradeQuery;
  if (!f || f.dead || f.tradeReq?.to !== p.id) return false;
  delete f.tradeReq;
  if (!yes) { w.emit({ t: "trade", id: f.id, k: "refused", name: p.name }); return true; }
  if (!near(p, f)) return w.reject(p, { t: "tradeanswer" }, "está demasiado lejos");
  p.trade = { with: f.id, offer: [], gold: 0, ok: false }; f.trade = { with: p.id, offer: [], gold: 0, ok: false };
  w.emit({ t: "trade", id: p.id, k: "open", name: f.name }); w.emit({ t: "trade", id: f.id, k: "open", name: p.name });
  push(w, p); return true;
}
function changed(w, p) { const o = other(w, p); p.trade.ok = false; if (o?.trade) o.trade.ok = false; push(w, p); }
export function setItem(w, p, uid) {
  const t = p.trade, o = other(w, p); if (!t || !o) return false;
  const i = Inv.instOf(p, uid);
  if (!i || i.comp || Inv.isEquipped(p, uid) || i.id === GOLD || t.offer.includes(uid)) return w.reject(p, { t: "tradeset" }, "no se puede ofrecer");
  if (t.offer.length >= MAX_OFFER) return w.reject(p, { t: "tradeset" }, "demasiados objetos");
  t.offer.push(uid); changed(w, p); return true;
}
export function unsetItem(w, p, uid) { const t = p.trade; if (!t) return false; t.offer = t.offer.filter(u => u !== uid); changed(w, p); return true; }
export function setGold(w, p, n) { const t = p.trade; if (!t) return false; t.gold = Math.max(0, Math.min(p.gold, Math.floor(+n) || 0)); changed(w, p); return true; }

// ¿Cabe todo en la mochila de `to` tras el cambio? (peso y casillas)
function fits(w, to, give, get, goldDelta) {
  let weight = Inv.totalWeight(to, w.data) + itemWeight(w.data.item(GOLD), Math.max(0, goldDelta)) - itemWeight(w.data.item(GOLD), Math.max(0, -goldDelta));
  let slots = to.bag.length - give.length;
  for (const i of give) { const d = w.data.item(i.id); weight -= itemWeight(d, isStack(d) ? i.count : 1); }
  for (const i of get) { const d = w.data.item(i.id); weight += itemWeight(d, isStack(d) ? i.count : 1); if (!(isStack(d) && to.bag.some(x => x.id === i.id))) slots++; }
  return weight <= Inv.maxLoad(to) && slots <= MAX_ITEMS;
}
export function confirm(w, p) {
  const t = p.trade, o = other(w, p); if (!t || !o?.trade) return false;
  if (!near(p, o)) { cancel(w, p, "demasiado lejos"); return false; }
  t.ok = true; push(w, p);
  if (!o.trade.ok) return true;
  const mine = t.offer.map(u => Inv.instOf(p, u)).filter(Boolean), theirs = o.trade.offer.map(u => Inv.instOf(o, u)).filter(Boolean);
  const gm = Math.min(t.gold, p.gold), go = Math.min(o.trade.gold, o.gold);
  if (!fits(w, p, mine, theirs, go - gm) || !fits(w, o, theirs, mine, gm - go)) { t.ok = o.trade.ok = false; push(w, p); w.emit({ t: "trade", id: p.id, k: "nofit" }); w.emit({ t: "trade", id: o.id, k: "nofit" }); return false; }
  for (const i of mine) Inv.removeFromBag(p, i.uid);
  for (const i of theirs) Inv.removeFromBag(o, i.uid);
  for (const i of theirs) Inv.addToBag(p, w.data, i);
  for (const i of mine) Inv.addToBag(o, w.data, i);
  p.gold += go - gm; o.gold += gm - go;
  const sum = (a, g) => ({ items: a.map(i => ({ id: i.id, count: i.count || 1 })), gold: g });
  delete p.trade; delete o.trade;
  w.recalc(p); w.recalc(o);
  w.emit({ t: "trade", id: p.id, k: "done", name: o.name, gave: sum(mine, gm), got: sum(theirs, go) });
  w.emit({ t: "trade", id: o.id, k: "done", name: p.name, gave: sum(theirs, go), got: sum(mine, gm) });
  w.emit({ t: "tradedone", id: p.id, with: o.id, a: sum(mine, gm), b: sum(theirs, go) });          // para la memoria de los habitantes
  return true;
}
// Cada segundo: se cancela el trato si alguien se aleja, muere o se va (lo llama World.tick)
export function tick(w) {
  for (const p of w.ents.values()) {
    if (p.kind !== "player" || !(p.trade || p.tradeReq)) continue;
    const o = p.trade ? w.ents.get(p.trade.with) : w.ents.get(p.tradeReq.to);
    if (!o || o.dead || p.dead || !near(p, o) || (p.tradeReq && w.time - p.tradeReq.at > 30000)) cancel(w, p, "se cancela el trato");
  }
}
