// GESTIÓN DE OBJETOS DE LOS BOTS (INVENTO del port, versión 2). Un bot trata sus objetos como un jugador con cabeza: cada uno tiene un VALOR para él
// (¿me mejora? ¿le mejora a un amigo? ¿se cotiza bien para comerciar? ¿cuánto me dan por él?) y según ese valor decide ponérselo, guardarlo en el
// almacén (para un amigo o para comerciar), venderlo o tirarlo; luego ordena la mochila por categorías, como lo haría una persona.
// Además mantiene una LISTA DE DESEOS: la pieza que más le mejoraría y su precio; si no le llega el oro, ahorra para ella (no se gasta lo que tiene en mejoras menores).
import { EQUIP, ITYPE, MAX_ITEMS, GOLD } from "../items.js";
import * as Inv from "../inventory.js";
import * as Shop from "./shopsys.js";
import { itemLevel } from "../itemlevel.js";

export const canWear = (q, d) => !!d && d.type === ITYPE.EQUIP && !(d.levelLimit > q.level) && !(d.gender === 1 && q.gender !== 1) && !(d.gender === 2 && q.gender !== 2) && d.equipPos > 0 && d.equipPos < EQUIP.FULLBODY;
export const slotOf = d => (d.equipPos === EQUIP.TWOHAND ? EQUIP.RHAND : d.equipPos);
export const ilvOf = (w, i) => (i ? itemLevel(w.data.item(i.id), i.attr, i.id) : 0);
// item level de lo que `q` lleva puesto en la casilla de `d` (un arma de dos manos ocupa también la mano derecha)
export function wornLevel(w, q, d) {
  const slot = slotOf(d), uid = q.equip[slot] ?? (slot === EQUIP.RHAND ? q.equip[EQUIP.TWOHAND] : undefined);
  return uid !== undefined ? ilvOf(w, Inv.instOf(q, uid)) : 0;
}
const CAP = { potion: 15, food: 8, other: 30 };
const isConsumable = d => d.type === ITYPE.EAT || d.type === ITYPE.USE_DEPLETE || d.type === ITYPE.ARROW;
const rate = rel => 0.5 + 0.1 * Math.min(8, Math.max(0, rel));                   // cuánto le importa el amigo según la afinidad

// Veredicto sobre un objeto de la mochila. `friends` = [{ q, rel }] (amigos conectados a los que podría ayudar).
// act: keep (me sirve tal cual) · equip (me lo pongo) · store (almacén: amigo o comercio) · sell (basura).  value = lo que vale para mí/otros, en oro.
export function judge(w, p, i, friends = []) {
  const d = w.data.item(i.id), count = i.count || 1;
  if (!d || i.id === GOLD || i.comp) return { act: "keep", value: 0, why: "es mío" };
  const sellPrice = Shop.sellPriceOf(d, i, count) || 0;
  if (isConsumable(d)) {
    const cap = /Potion/.test(d.name) ? CAP.potion : d.type === ITYPE.EAT ? CAP.food : CAP.other;
    if (count <= cap) return { act: "keep", value: sellPrice, why: "consumible que uso" };
    return { act: "sell", value: sellPrice, why: `sobran (llevo ${count}, me bastan ${cap})` };
  }
  if (d.type !== ITYPE.EQUIP) return (d.price || 0) >= 600 ? { act: "store", value: sellPrice, why: "vale mucho y no lo uso" } : { act: "sell", value: sellPrice, why: "no me sirve" };
  if (i.life === 0) return { act: "sell", value: 0, why: "está gastado" };
  const il = ilvOf(w, i), cur = wornLevel(w, p, d), mine = canWear(p, d);
  const useGain = mine ? il - cur : 0;
  if (useGain > cur * 0.08 + 0.5) return { act: "equip", value: useGain * 30, why: `me mejora (item level ${il} frente a ${cur})` };
  let fq = null, fg = 0;
  for (const { q, rel } of friends) { if (!canWear(q, d)) continue; const g = (il - wornLevel(w, q, d)) * rate(rel); if (g > fg && il - wornLevel(w, q, d) > 1 + il * 0.15) { fg = g; fq = q; } }
  const trade = Math.floor((Math.max(5, Math.abs(d.price || 0) * 0.5) + il * 6) * (fq ? 1 : 0.6));
  if (fq && fg * 30 > sellPrice * 0.8) return { act: "store", value: Math.round(fg * 30), for: fq.name, why: `le mejoraría el equipo a ${fq.name} (item level ${il})` };
  if (!mine && il >= 6 && trade > sellPrice * 1.5) return { act: "store", value: trade, why: `no puedo usarlo (nivel/género) pero se cotiza a ${trade} para comerciar` };
  if (mine && il >= cur * 0.85 && il >= 8 && trade > sellPrice * 1.5) return { act: "store", value: trade, why: "recambio casi tan bueno como lo que llevo" };
  return { act: "sell", value: sellPrice, why: `no mejora nada (item level ${il}, llevo ${cur})` };
}

// Vende, guarda y ordena. `log(text)` deja constancia (registro de acciones del bot). Devuelve cuántos objetos movió.
export function manage(w, p, { force = false, friends = [], log = () => {} } = {}) {
  const load = Inv.totalWeight(p, w.data) / Math.max(1, Inv.maxLoad(p));
  let moved = 0;
  if (force || load >= 0.5 || p.bag.length >= MAX_ITEMS - 12) {
    const worn = new Set(Object.values(p.equip));
    let sold = 0, gold = 0, stored = 0;
    for (const i of [...p.bag]) {
      if (worn.has(i.uid)) continue;
      const v = judge(w, p, i, friends);
      if (v.act === "keep" || v.act === "equip") continue;
      const d = w.data.item(i.id);
      if (v.act === "store" && (p.bank?.length || 0) < 120 && Shop.deposit(w, p, { uid: i.uid, count: i.count })) { stored++; moved++; log(`Guardo ${d.name} en el almacén: ${v.why}.`); continue; }
      const price = Shop.sellPriceOf(d, i, i.count || 1) || 0;
      p.gold += price; Inv.removeFromBag(p, i.uid); sold++; gold += price; moved++;
    }
    if (sold) log(`Vendo ${sold} objeto(s) que no uso por ${gold} de oro${stored ? " y guardo " + stored : ""}.`);
  }
  tidy(w, p);
  return moved;
}

// ORDENAR LA MOCHILA como lo haría un jugador: pociones y comida en la fila de arriba, luego armas, armadura, summons y el resto; dentro de cada grupo, lo más valioso primero.
const COLS = [0, 34, 68, 102, 136, 170], ROWS = [0, 34, 68];
function groupOf(w, i) {
  const d = w.data.item(i.id); if (!d) return 4;
  if (i.comp) return 3;
  if (isConsumable(d)) return 0;
  if (d.type === ITYPE.EQUIP) return d.equipPos === EQUIP.RHAND || d.equipPos === EQUIP.TWOHAND ? 1 : 2;
  return 4;
}
export function tidy(w, p) {
  const worn = new Set(Object.values(p.equip)), list = p.bag.filter(i => !worn.has(i.uid) && i.id !== GOLD);
  const key = list.map(i => i.uid).join(",");
  if (p._tidyKey === key) return false;
  p._tidyKey = key;
  list.sort((a, b) => groupOf(w, a) - groupOf(w, b) || (ilvOf(w, b) - ilvOf(w, a)) || ((w.data.item(b.id)?.price || 0) - (w.data.item(a.id)?.price || 0)));
  list.forEach((i, n) => { const x = COLS[n % COLS.length], y = ROWS[Math.floor(n / COLS.length) % ROWS.length]; if (i.x !== x || i.y !== y) { i.x = x; i.y = y; } });
  return true;
}

// LISTA DE DESEOS: la mejora de equipo con más ganancia que ofrece la tienda (`gear` = catálogo por casilla). Devuelve { d, gain, slot, price } o null.
export function wish(w, p, gear, bad = new Set(), usableFn = canWear) {
  let best = null;
  for (const [slot, list] of gear) {
    const have = (() => { const uid = p.equip[slot] ?? (slot === EQUIP.RHAND ? p.equip[EQUIP.TWOHAND] : undefined); return uid !== undefined ? ilvOf(w, Inv.instOf(p, uid)) : 0; })();
    for (const d of list) {
      if (bad.has(d.id) || !usableFn(p, d)) continue;
      const gain = itemLevel(d) - have;
      if (gain > have * 0.15 + 1 && (!best || gain - d.price / 400 > best.gain - best.price / 400)) best = { d, gain, slot, price: d.price };
    }
  }
  return best;
}
