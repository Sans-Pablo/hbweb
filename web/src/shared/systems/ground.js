// Objetos en el suelo: hasta 12 por casilla, el último en caer queda encima (Map.cpp bSetItem / pGetItem).
import { GROUND_STACK } from "../items.js";

export function groundPush(w, x, y, inst) {
  const k = w.grid.idx(x, y);
  let list = w.items.get(k);
  if (!list) w.items.set(k, (list = []));
  inst.x = x; inst.y = y;
  list.push(inst);
  if (list.length > GROUND_STACK) list.shift();              // se borra el más antiguo
  w.emit({ t: "drop", x, y, item: inst.id, count: inst.count });
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
