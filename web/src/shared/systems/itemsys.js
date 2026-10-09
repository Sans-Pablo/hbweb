// Recoger, tirar, equipar y usar objetos (iClientMotion_GetItem_Handler, DropItemHandler, UseItemHandler).
import { dice } from "../rules.js";
import { ITYPE, EFFECT, GOLD, MAX_ITEMS, isStack } from "../items.js";
import { PLAYER, ACT } from "../const.js";
import * as Inv from "../inventory.js";
import { groundPush, groundTop, groundPop } from "./ground.js";
import { toggleCompanion, dismissCompanion } from "./npcsys.js";

export const newInst = (w, id, count = 1, extra = null) => {
  const d = w.data.item(id);
  const inst = { uid: w.nextItem++, id, count, life: d ? d.maxLife : 1 };
  if (extra && extra.attr) { inst.attr = extra.attr; inst.color = extra.color || 0; }
  return inst;
};

export function startPickup(w, p) {
  if (w.busy(p)) return w.reject(p, { t: "pickup" }, "ocupado");
  if (!groundTop(w, p.x, p.y)) return w.reject(p, { t: "pickup" }, "nada que recoger");
  w.setAct(p, ACT.GETITEM, PLAYER.getItemMs);
  p.busyUntil = w.time + PLAYER.getItemMs;
  w.after(PLAYER.getItemMs, () => takeItem(w, p));
  return true;
}

function takeItem(w, p) {
  const it = groundTop(w, p.x, p.y);
  if (!it || p.dead) return;
  const d = w.data.item(it.id);
  if (!Inv.canCarry(p, w.data, d, it.count, it)) { w.emit({ t: "cantcarry", id: p.id, why: "weight" }); return; }
  if (it.id !== GOLD && !(isStack(d) && p.bag.some(i => i.id === it.id)) && p.bag.length >= MAX_ITEMS) {
    w.emit({ t: "cantcarry", id: p.id, why: "slots" }); return;
  }
  groundPop(w, p.x, p.y);
  Inv.addToBag(p, w.data, it);
  w.recalc(p);
  w.emit({ t: "pickup", id: p.id, item: it.id, count: it.count, x: p.x, y: p.y, attr: it.attr || 0 });
}

// tirar un objeto de la mochila a la casilla propia (amount < count divide una pila)
export function dropItem(w, p, uid, amount) {
  const inst = Inv.instOf(p, uid);
  if (!inst) return w.reject(p, { t: "drop" }, "no tienes");
  if (inst.comp?.on) { inst.comp.on = false; dismissCompanion(w, p); }      // soltar la bola guarda al compañero
  const d = w.data.item(inst.id);
  let out;
  if (isStack(d) && amount > 0 && amount < inst.count) { inst.count -= amount; out = { ...inst, uid: w.nextItem++, count: amount }; }
  else out = Inv.removeFromBag(p, uid);
  w.recalc(p);
  groundPush(w, p.x, p.y, out);
  return true;
}

export function dropGold(w, p, amount) {
  amount = Math.min(p.gold, Math.floor(amount));
  if (!(amount > 0)) return w.reject(p, { t: "drop" }, "sin oro");
  p.gold -= amount;
  groundPush(w, p.x, p.y, newInst(w, GOLD, amount));
  return true;
}

export function equipCmd(w, p, uid) {
  const inst = Inv.instOf(p, uid);
  if (!inst) return w.reject(p, { t: "equip" }, "no tienes");
  const r = Inv.equip(p, w.data, uid);
  w.recalc(p);
  if (!r.ok) w.emit({ t: "equipfail", id: p.id, why: r.why });
  else w.emit({ t: "equip", id: p.id, uid });
  return r.ok;
}

export function unequipCmd(w, p, uid) {
  const ok = Inv.unequip(p, w.data, uid);
  w.recalc(p);
  if (ok) w.emit({ t: "unequip", id: p.id, uid });
  return ok;
}

// UseItemHandler: pociones y comida. Los de tipo comer / gastar se consumen siempre.
export function useItem(w, p, uid) {
  const inst = Inv.instOf(p, uid);
  if (!inst) return w.reject(p, { t: "use" }, "no tienes");
  if (inst.comp) return toggleCompanion(w, p, inst);                 // bola de compañero (companion.js)
  const d = w.data.item(inst.id);
  if (d.type !== ITYPE.EAT && d.type !== ITYPE.USE_DEPLETE) return w.reject(p, { t: "use" }, "no se puede usar");
  const roll = () => dice(w.rng, d.v1, d.v2) + d.v3;
  let amount = 0, stat = null;
  switch (d.effectType) {
    case EFFECT.HP: amount = roll(); stat = "hp"; if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + amount); break;
    case EFFECT.MP: amount = roll(); stat = "mp"; p.mp = Math.min(p.maxMp, p.mp + amount); break;
    case EFFECT.SP: amount = roll(); stat = "sp"; p.sp = Math.min(p.maxSp, p.sp + amount); break;
    case EFFECT.HPSTOCK:
      amount = roll(); stat = "food";
      p.hpStock = Math.min(500, p.hpStock + amount);
      p.hunger = Math.max(0, Math.min(100, p.hunger + roll()));
      break;
    default: return w.reject(p, { t: "use" }, "no implementado");
  }
  Inv.removeFromBag(p, uid);
  w.recalc(p);
  w.emit({ t: "use", id: p.id, item: d.id, amount, stat });
  return true;
}
