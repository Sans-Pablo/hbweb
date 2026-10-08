// Tienda, herrero y almacén (HGServer/Game.cpp): RequestPurchaseItemHandler, ReqSellItemHandler,
// ReqSellItemConfirmHandler, ReqRepairItemHandler, ReqRepairItemCofirmHandler, bSetItemToBankItem y
// RequestRetrieveItemHandler. Los precios, los descuentos por carisma y los mensajes son los del servidor.
import { ITYPE, GOLD, MAX_ITEMS, isStack, itemWeight } from "../items.js";
import * as Inv from "../inventory.js";
import { realStats, parseAttr } from "../attributes.js";
import { newInst } from "./itemsys.js";

export const NPC = { SHOP: 15, MAGE: 19, WAREHOUSE: 20, BLACKSMITH: 24 };
export const MAX_BANK = 200;                       // DEF_MAXBANKITEMS
export const MAX_SELL_LIST = 12;                   // DEF_MAXSELLLIST
const MAX_PRICE = 1000000;

// Precio de compra de `count` unidades: el descuento es (carisma - 10) / 4 por ciento, sin pasar de la mitad.
export function buyCost(chr, unit, count = 1) {
  const cost = unit * count;
  const ratio = Math.trunc((chr - 10) / 4);
  let discount = Math.trunc(cost * (ratio / 100));
  if (discount >= Math.trunc(cost / 2)) discount = Math.trunc(cost / 2) - 1;
  return cost - discount;
}

// Precio de la lista del cliente (DrawDialogBox_Shop): descuento de carisma sobre el precio de contents%d.txt
export function listPrice(chr, price, discountPct = 0) {
  const ratio = Math.trunc((chr - 10) / 4);
  let cost = Math.trunc(price * ((100 + discountPct) / 100)) - Math.trunc(price * (ratio / 100));
  if (cost < Math.trunc(price / 2)) cost = Math.trunc(price / 2) - 1;
  return cost;
}

const SWE_MUL1 = { 6: 2, 8: 2, 5: 3, 1: 4, 7: 5, 2: 6, 3: 15, 9: 20 };
const SWE_VAL = [0, 10, 20, 30, 35, 40, 50, 100, 200, 300, 400, 500, 700, 900];
const sweMul2 = t => (t === 1 || t === 12 ? 2 : t >= 2 && t <= 7 ? 4 : t >= 8 && t <= 11 ? 6 : undefined);

const lifeOf = (inst, d) => Math.abs(inst.life ?? d.maxLife);

// Valor de reventa de un objeto de combate (categorías 1..10): proporcional a la vida que le queda, más los atributos.
function wearPrice(inst, d, count) {
  const maxLife = realStats(d, inst).maxLife || 1;
  let price = Math.trunc((lifeOf(inst, d) / (maxLife || 1)) * 0.5 * d.price) * count;
  let add1 = 0, add2 = 0;
  if (inst.attr) {
    const a = parseAttr(inst.attr);
    if (a.t1) {
      const d1 = price * (SWE_MUL1[a.t1] ?? 1);
      add1 = Math.trunc(d1 + d1 * ((SWE_VAL[a.v1] || 0) / 100));
    }
    const m2 = a.t2 ? sweMul2(a.t2) : undefined;
    if (a.t2 && m2) {
      const d1 = price * m2;
      add2 = Math.trunc(d1 + d1 * ((SWE_VAL[a.v2] || 0) / 100));
    }
  }
  return price + (add1 - Math.trunc(add1 / 3)) + (add2 - Math.trunc(add2 / 3));
}

// Cuánto pagan por `count` unidades de este objeto. Devuelve { price } o { cannot: motivo } (1 aquí no, 2 gastado, 4 pesa demasiado)
export function sellValue(w, p, inst, count) {
  const d = w.data.item(inst.id);
  const cat = d.category;
  let price;
  if (cat >= 11 && cat <= 50) price = Math.trunc(d.price / 2) * count;
  else if (cat >= 1 && cat <= 10) {
    if (!(inst.life > 0)) return { cannot: 2 };
    price = wearPrice(inst, d, count);
  } else return { cannot: 1 };
  if (price <= 0) price = 1;
  if (price > MAX_PRICE) price = MAX_PRICE;
  if (Inv.totalWeight(p, w.data) + itemWeight(w.data.item(GOLD), price) > Inv.maxLoad(p)) return { cannot: 4 };
  return { price };
}

// Coste de reparar: la mitad del precio menos lo que aún vale por su vida
export function repairCost(inst, d) {
  const life = inst.life ?? d.maxLife;
  if (life === 0) return Math.trunc(d.price / 2);
  const maxLife = realStats(d, inst).maxLife || 1;
  return Math.trunc(d.price / 2) - Math.trunc((Math.abs(life) / Math.abs(maxLife)) * 0.5 * d.price);
}

const instCount = (d, inst) => (isStack(d) ? inst.count : 1);

// ------------------------------------------------------------------ compra
// cmd: { name, count }. "10Arrows" y "100Arrows" son 10 y 100 flechas de una vez.
export function buy(w, p, cmd) {
  let name = String(cmd.name || ""), units = 1;
  if (name.startsWith("10Arrows")) { name = "Arrow"; units = 10; }
  else if (name.startsWith("100Arrows")) { name = "Arrow"; units = 100; }
  const d = w.data.named(name), n = Math.max(1, Math.min(50, cmd.count | 0));
  if (!d || !(d.price > 0)) return false;                          // price < 0: no está a la venta
  let bought = 0;
  for (let i = 0; i < n; i++) {
    const cost = buyCost(p.stats.chr, d.price, units);
    if (p.gold < cost) { w.emit({ t: "nogold", id: p.id }); break; }
    const inst = newInst(w, d.id, isStack(d) ? units : 1);
    const stacked = isStack(d) && p.bag.some(b => b.id === d.id);
    if ((!stacked && p.bag.length >= MAX_ITEMS) || !Inv.canCarry(p, w.data, d, inst.count, inst)) { w.emit({ t: "cantcarry", id: p.id, why: "bag" }); break; }
    Inv.addToBag(p, w.data, inst);
    p.gold -= cost;
    bought++;
    w.recalc(p);
    w.emit({ t: "purchased", id: p.id, item: d.id, count: inst.count, price: cost });
  }
  return bought > 0;
}

// ------------------------------------------------------------------ venta
// Paso 1: el cliente pregunta cuánto le dan. cmd: { uid, count, whom }
export function sellRequest(w, p, cmd) {
  const inst = Inv.instOf(p, cmd.uid), count = cmd.count | 0;
  if (!inst || count <= 0 || (cmd.whom !== NPC.SHOP && cmd.whom !== NPC.BLACKSMITH)) return false;
  const d = w.data.item(inst.id);
  if (isStack(d) ? inst.count < count : count !== 1) return false;
  const r = sellValue(w, p, inst, count);
  if (r.cannot) { w.emit({ t: "cantsell", id: p.id, uid: inst.uid, item: inst.id, why: r.cannot }); return false; }
  w.emit({ t: "sellprice", id: p.id, uid: inst.uid, life: inst.life ?? d.maxLife, price: r.price, count });
  return true;
}

// Paso 2 (ReqSellItemConfirmHandler): se vende y se cobra
export function sellConfirm(w, p, uid, count) {
  const inst = Inv.instOf(p, uid);
  if (!inst || !(count > 0)) return false;
  const d = w.data.item(inst.id);
  if (isStack(d) ? inst.count < count : count !== 1) return false;
  const r = sellValue(w, p, inst, count);
  if (r.cannot) return false;
  if (isStack(d)) { inst.count -= count; if (inst.count <= 0) Inv.removeFromBag(p, uid); }
  else Inv.removeFromBag(p, uid);
  p.gold += r.price;
  w.recalc(p);
  w.emit({ t: "sold", id: p.id, item: inst.id, count, price: r.price });
  return true;
}

// Lista de venta (hasta 12 objetos a la vez): vende por orden hasta el primer hueco
export function sellList(w, p, cmd) {
  const list = Array.isArray(cmd.items) ? cmd.items.slice(0, MAX_SELL_LIST) : [];
  let any = false;
  for (const e of list) { if (!e || !sellConfirm(w, p, e.uid, e.count | 0)) break; any = true; }
  return any;
}

// ------------------------------------------------------------------ reparación
// Las armas y armaduras (1..10) las arregla el herrero; el resto de lo reparable (11, 12, 43..50), el tendero.
const repairer = d => (d.category >= 1 && d.category <= 10 ? NPC.BLACKSMITH : (d.category >= 43 && d.category <= 50) || d.category === 11 || d.category === 12 ? NPC.SHOP : 0);
export function repairRequest(w, p, cmd) {
  const inst = Inv.instOf(p, cmd.uid);
  if (!inst) return false;
  const d = w.data.item(inst.id), who = repairer(d);
  if (!who) { w.emit({ t: "cantrepair", id: p.id, uid: inst.uid, item: inst.id, why: 1 }); return false; }
  if (cmd.whom !== who) { w.emit({ t: "cantrepair", id: p.id, uid: inst.uid, item: inst.id, why: 2 }); return false; }
  w.emit({ t: "repairprice", id: p.id, uid: inst.uid, life: inst.life ?? d.maxLife, price: repairCost(inst, d) });
  return true;
}
export function repairConfirm(w, p, cmd) {
  const inst = Inv.instOf(p, cmd.uid);
  if (!inst) return false;
  const d = w.data.item(inst.id);
  if (!repairer(d)) return false;
  const price = repairCost(inst, d);
  if (p.gold < price) { w.emit({ t: "nogold", id: p.id, uid: inst.uid }); return false; }
  inst.life = realStats(d, inst).maxLife;
  p.gold -= price;
  w.recalc(p);
  w.emit({ t: "repaired", id: p.id, uid: inst.uid, item: inst.id, price });
  return true;
}

// ------------------------------------------------------------------ almacén (Howard)
export function deposit(w, p, cmd) {
  const inst = Inv.instOf(p, cmd.uid);
  if (!inst) return false;
  const d = w.data.item(inst.id);
  const amount = isStack(d) ? Math.max(1, Math.min(inst.count, cmd.count | 0 || inst.count)) : 1;
  if (!p.bank) p.bank = [];
  const same = isStack(d) && p.bank.find(b => b.id === inst.id);
  if (!same && p.bank.length >= MAX_BANK - 1) { w.emit({ t: "bankfull", id: p.id }); return false; }
  let moved;
  if (isStack(d) && amount < inst.count) { inst.count -= amount; moved = { ...inst, uid: w.nextItem++, count: amount }; }
  else moved = Inv.removeFromBag(p, inst.uid);
  if (same) same.count += moved.count; else p.bank.push(moved);
  w.recalc(p);
  w.emit({ t: "banked", id: p.id, item: moved.id, count: moved.count });
  return true;
}

export function withdraw(w, p, cmd) {
  const i = cmd.index | 0, it = p.bank && p.bank[i];
  if (!it) return false;
  const d = w.data.item(it.id);
  if (!Inv.canCarry(p, w.data, d, it.count, it)) { w.emit({ t: "cantcarry", id: p.id, why: "weight" }); return false; }
  const stacked = isStack(d) && p.bag.some(b => b.id === it.id);
  if (!stacked && p.bag.length >= MAX_ITEMS) { w.emit({ t: "cantcarry", id: p.id, why: "slots" }); return false; }
  p.bank.splice(i, 1);
  Inv.addToBag(p, w.data, it);
  w.recalc(p);
  w.emit({ t: "retrieved", id: p.id, item: it.id, count: it.count });
  return true;
}

export { ITYPE };
