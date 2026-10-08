// A* en 8 direcciones con montículo binario.
import { DX, DY } from "./const.js";

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a; a.push(n);
    let i = a.length - 1;
    while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

// Devuelve la lista de direcciones desde (sx,sy) hasta (tx,ty). La casilla de destino puede
// estar ocupada (útil para ir hacia un monstruo); las demás ocupadas se evitan salvo `self`.
export function findPath(grid, sx, sy, tx, ty, self, maxNodes = 40000) {
  if (grid.blocked(tx, ty) || (sx === tx && sy === ty)) return [];
  const W = grid.w, start = sy * W + sx, goal = ty * W + tx;
  const g = new Map([[start, 0]]), came = new Map();
  const heap = new Heap();
  heap.push([0, start]);
  let n = 0;
  while (heap.size && n++ < maxNodes) {
    const [, cur] = heap.pop();
    if (cur === goal) break;
    const x = cur % W, y = (cur / W) | 0, gc = g.get(cur);
    for (let d = 1; d <= 8; d++) {
      const nx = x + DX[d], ny = y + DY[d], k = ny * W + nx;
      if (grid.blocked(nx, ny)) continue;
      if (k !== goal) {
        const o = grid.occupant(nx, ny);
        if (o !== undefined && o !== self) continue;
      }
      const c = gc + (d % 2 ? 1 : 1.0001);       // ligera preferencia por líneas rectas
      if (c < (g.get(k) ?? Infinity)) {
        g.set(k, c); came.set(k, [cur, d]);
        heap.push([c + Math.max(Math.abs(tx - nx), Math.abs(ty - ny)), k]);
      }
    }
  }
  if (!came.has(goal)) return [];
  const path = [];
  for (let cur = goal; cur !== start;) { const [prev, d] = came.get(cur); path.push(d); cur = prev; }
  return path.reverse();
}

// Paso "codicioso" de los monstruos hacia un objetivo: la dirección directa y, si está
// ocupada, las dos de al lado (como el servidor: cGetNextMoveDir).
export function greedyStep(grid, e, tx, ty, dirTo) {
  const d0 = dirTo(e.x, e.y, tx, ty);
  if (!d0) return 0;
  for (const d of [d0, (d0 % 8) + 1, ((d0 + 6) % 8) + 1, ((d0 + 1) % 8) + 1, ((d0 + 5) % 8) + 1]) {
    if (grid.free(e.x + DX[d], e.y + DY[d], e.id)) return d;
  }
  return 0;
}
