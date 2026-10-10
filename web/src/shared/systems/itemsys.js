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
  else if (extra && extra.color) inst.color = extra.color;                  // objetos teñidos sin atributo (hueso carmesí)
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
  w.emit({ t: "pickup", id: p.id, item: it.id, count: it.count, x: p.x, y: p.y, attr: it.attr || 0, ...(it.comp ? { comp: { sp: it.comp.sp, lvl: it.comp.lvl } } : {}) });
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
// Tintes (ITEMEFFECTTYPE_DYE 17, ARMORDYE 32, WEAPONDYE 34; Game.cpp ~36555): se aplican a otro objeto de la mochila de las categorías permitidas.
// El color es el índice de la tabla del cliente (m_wR[]): el nombre del tinte decide el índice.
const DYE_INDEX = { Indigo: 1, Brown: 2, Gold: 3, "Crimson-Red": 4, CrimsonRed: 4, Green: 5, Gray: 6, Aqua: 7, Pink: 8, Violet: 9, Blue: 10, Tan: 11, Khaki: 12, Yellow: 13, Red: 14, Black: 15 };
const DYE_CATS = { 17: [11, 12], 32: [6, 13, 15], 34: [1, 3, 8] };
function dye(w, p, d, uid, destUid) {
  const dest = Inv.instOf(p, destUid), dd = dest && w.data.item(dest.id);
  if (!dest || destUid === uid) return w.reject(p, { t: "use" }, "elige el objeto que quieres teñir");
  if (!DYE_CATS[d.effectType].includes(dd.category)) return w.reject(p, { t: "use" }, "ese tinte no sirve para este objeto");
  const m = /\((.+)\)/.exec(d.name), color = m ? (DYE_INDEX[m[1]] ?? 0) : 0;
  if (color) dest.color = color; else delete dest.color;
  Inv.removeFromBag(p, uid);
  w.emit({ t: "dyed", id: p.id, uid: destUid, color, item: d.id });
  return true;
}

export function useItem(w, p, uid, destUid) {
  const inst = Inv.instOf(p, uid);
  if (!inst) return w.reject(p, { t: "use" }, "no tienes");
  if (inst.comp) return toggleCompanion(w, p, inst);                 // bola de compañero (companion.js)
  const d = w.data.item(inst.id);
  if (d.effectType === EFFECT.DYE || d.effectType === 32 || d.effectType === 34) return dye(w, p, d, uid, destUid);
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
    case EFFECT.STUDYSKILL: {
      // Manuales (HGServer/Game.cpp ~27249, TrainSkillResponse): v1 = habilidad, v2 = nivel inicial; solo si aún no se tiene (nivel 0).
      // Diferencia con el original, que gasta el manual aunque ya se conozca la habilidad: aquí no se gasta.
      const sk = d.v1, lvl = d.specialEffect > 0 ? d.specialEffect : d.v2;
      if (!(sk >= 0 && sk <= 100)) return w.reject(p, { t: "use" }, "no se puede usar");
      if ((p.skills[sk] || 0) !== 0) return w.reject(p, { t: "use" }, "ya conoces esa habilidad");
      p.skills[sk] = lvl;
      Inv.removeFromBag(p, uid);
      w.recalc(p);
      w.emit({ t: "skilllearn", id: p.id, skill: sk, level: lvl, item: d.id });
      return true;
    }
    default: return w.reject(p, { t: "use" }, "no implementado");
  }
  if (isStack(d) && (inst.count || 1) > 1) inst.count--; else Inv.removeFromBag(p, uid);
  w.recalc(p);
  w.emit({ t: "use", id: p.id, item: d.id, amount, stat });
  return true;
}
