// Alquimia (HG.cpp ReqCreatePortionHandler ~23503, mensajes del cliente NOTIFY_*PORTION*). Receta = tabla Potion.cfg (web/data/potion.json).
// Se mandan hasta 6 casillas de la mochila (una casilla repetida = unidades); se ordenan por id descendente y se compara con la receta.
import { dice } from "../rules.js";
import { ITYPE } from "../items.js";
import * as Inv from "../inventory.js";
import { gainSSN } from "../skills.js";
import { giveExp } from "./combatsys.js";
import { groundPush } from "./ground.js";
import { newInst } from "./itemsys.js";

export const SKILL_ALCHEMY = 12;

// Recetas: w.data.potions (potion.json, GameData). Sin tabla no hay recetas.
export function craft(w, p, cmd) {
  const recipes = w.data.potions || [];
  const idx = Array.isArray(cmd.uids) ? cmd.uids.slice(0, 6) : [];
  if (!idx.length) return false;
  const slots = [], cnt = [];
  for (const uid of idx) {
    const inst = Inv.instOf(p, uid); if (!inst) return false;
    const k = slots.indexOf(inst); if (k >= 0) cnt[k]++; else { slots.push(inst); cnt.push(1); }
  }
  for (let i = 0; i < slots.length; i++) if (slots[i].count < cnt[i]) return false;
  const order = slots.map((s, i) => i).sort((a, b) => slots[b].id - slots[a].id);      // burbuja por id descendente (estable)
  const arr = [];
  for (let i = 0; i < 6; i++) { const k = order[i]; arr.push(k === undefined ? -1 : slots[k].id, k === undefined ? 0 : cnt[k]); }
  let rec = null;
  for (const r of recipes) if (r.arr.every((v, j) => v === arr[j])) rec = r;            // gana la última coincidencia
  if (!rec) { w.emit({ t: "potion-nomatch", id: p.id }); return false; }
  const mastery = p.skills[SKILL_ALCHEMY] || 0;
  if (rec.limit > mastery) { w.emit({ t: "potion-lowskill", id: p.id, name: rec.name }); return false; }
  let skill = mastery - rec.diff; if (skill <= 0) skill = 1;
  if (mastery === 100) skill += 5;
  if (dice(w.rng, 1, 100) > skill) { w.emit({ t: "potion-fail", id: p.id, name: rec.name }); return false; }
  gainSSN(p, SKILL_ALCHEMY, 1);
  for (let k = 0; k < slots.length; k++) {
    const s = slots[k];
    if (w.data.item(s.id).type === ITYPE.CONSUME) { s.count -= cnt[k]; if (s.count <= 0) Inv.removeFromBag(p, s.uid); }
    else Inv.removeFromBag(p, s.uid);
  }
  w.emit({ t: "potion-ok", id: p.id, name: rec.name });
  giveExp(w, p, dice(w.rng, 2, Math.floor(rec.diff / 3)));
  const def = w.data.byName.get(rec.name);
  if (def) {
    const inst = newInst(w, def.id, 1);
    if (!Inv.addToBag(p, w.data, inst)) { groundPush(w, p.x, p.y, inst); w.emit({ t: "cantcarry", id: p.id }); }
  }
  w.recalc(p);
  return true;
}
