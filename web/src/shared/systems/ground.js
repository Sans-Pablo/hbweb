// Objetos en el suelo: hasta 12 por casilla, el último en caer queda encima (Map.cpp bSetItem / pGetItem).
import { GROUND_STACK } from "../items.js";
import { rarityOf } from "../rarity.js";

export const LOOT_TTL = 90, LOOT_TTL_RARE = 600;       // segundos que dura en el suelo un botín común / con rareza

// Retira los objetos caducados (solo los que traen `ttl`); w.tick lo llama cada 5 s
export function groundSweep(w) {
  for (const [k, list] of w.items) {
    const keep = list.filter(i => !(i.ttl && w.time - i.born > i.ttl));
    if (keep.length === list.length) continue;
    if (keep.length) w.items.set(k, keep); else w.items.delete(k);
    w.itemsDirty = (w.itemsDirty || 0) + 1;
  }
}

// `announce`: botín de un monstruo; solo entonces el evento lleva la rareza (aviso y sonido en el cliente)
export function groundPush(w, x, y, inst, announce = false) {
  const k = w.grid.idx(x, y);
  let list = w.items.get(k);
  if (!list) w.items.set(k, (list = []));
  inst.x = x; inst.y = y;
  if (announce && inst.ttl == null) inst.ttl = (rarityOf(inst.id, inst.attr) > 0 ? LOOT_TTL_RARE : LOOT_TTL) * 1000;   // el botín de monstruos se limpia solo (INVENTO del port: el suelo no se llena)
  inst.born = w.time;
  list.push(inst);
  if (list.length > GROUND_STACK) list.shift();              // se borra el más antiguo
  w.emit({ t: "drop", x, y, item: inst.id, count: inst.count, r: announce ? rarityOf(inst.id, inst.attr) : 0, attr: announce ? inst.attr : undefined });
}

export function groundTop(w, x, y) {
  const list = w.items.get(w.grid.idx(x, y));
  return list && list.length ? list[list.length - 1] : null;
}

export function groundPop(w, x, y) {
  const k = w.grid.idx(x, y), list = w.items.get(k);
  if (!list || !list.length) return null;
  const it = list.pop();
  if (!list.length) w.items.delete(k);
  return it;
}
