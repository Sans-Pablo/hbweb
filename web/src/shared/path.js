// A* en 8 direcciones con montículo binario.
import { DX, DY } from "./const.js";

// Memoria reutilizable entre búsquedas (sin Map ni objetos por nodo): g, padre y dirección por casilla con "sello" de generación (no hay que limpiar),
// y un montículo binario sobre arrays tipados (clave f + casilla). Mismo resultado que la versión con Map, ~10x más rápido.
let cap = 0, G, CAME, DIRS, SEEN, CLOSED, stamp = 0, HK = new Float32Array(4096), HV = new Int32Array(4096), hn = 0;
function ensure(n) {
  if (n <= cap) return;
  cap = n; G = new Float32Array(n); CAME = new Int32Array(n); DIRS = new Uint8Array(n); SEEN = new Uint32Array(n); CLOSED = new Uint32Array(n); stamp = 0;
}
function hpush(k, v) {
  if (hn === HK.length) { const k2 = new Float32Array(hn * 2), v2 = new Int32Array(hn * 2); k2.set(HK); v2.set(HV); HK = k2; HV = v2; }
  let i = hn++;
  while (i) { const p = (i - 1) >> 1; if (HK[p] <= k) break; HK[i] = HK[p]; HV[i] = HV[p]; i = p; }
  HK[i] = k; HV[i] = v;
}
function hpop() {                                                     // devuelve la casilla de menor f
  const top = HV[0], k = HK[--hn], v = HV[hn];
  if (hn) {
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= hn) break;
      if (c + 1 < hn && HK[c + 1] < HK[c]) c++;
      if (HK[c] >= k) break;
      HK[i] = HK[c]; HV[i] = HV[c]; i = c;
    }
    HK[i] = k; HV[i] = v;
  }
  return top;
}

// Devuelve la lista de direcciones desde (sx,sy) hasta (tx,ty). La casilla de destino puede
// estar ocupada (útil para ir hacia un monstruo); las demás ocupadas se evitan salvo `self`.
export function findPath(grid, sx, sy, tx, ty, self, maxNodes = 40000) {
  if (grid.blocked(tx, ty) || (sx === tx && sy === ty)) return [];
  const W = grid.w, start = sy * W + sx, goal = ty * W + tx;
  ensure(W * grid.h);
  if (++stamp >= 0xFFFFFFF0) { SEEN.fill(0); CLOSED.fill(0); stamp = 1; }
  SEEN[start] = stamp; G[start] = 0; hn = 0; hpush(0, start);
  let n = 0;
  while (hn && n < maxNodes) {
    const cur = hpop();
    if (CLOSED[cur] === stamp) continue;                              // entrada vieja del montículo
    CLOSED[cur] = stamp; n++;
    if (cur === goal) break;
    const x = cur % W, y = (cur / W) | 0, gc = G[cur];
    for (let d = 1; d <= 8; d++) {
      const nx = x + DX[d], ny = y + DY[d], k = ny * W + nx;
      if (grid.blocked(nx, ny) || CLOSED[k] === stamp) continue;
      if (k !== goal) {
        const o = grid.occupant(nx, ny);
        if (o !== undefined && o !== self) continue;
      }
      const c = gc + (d % 2 ? 1 : 1.0001);       // ligera preferencia por líneas rectas
      if (SEEN[k] !== stamp || c < G[k]) {
        SEEN[k] = stamp; G[k] = c; CAME[k] = cur; DIRS[k] = d;
        hpush(c + Math.max(Math.abs(tx - nx), Math.abs(ty - ny)), k);
      }
    }
  }
  if (SEEN[goal] !== stamp) return [];                                 // sin camino (o presupuesto agotado antes de descubrir el destino)
  const path = [];
  for (let cur = goal; cur !== start; cur = CAME[cur]) path.push(DIRS[cur]);
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
