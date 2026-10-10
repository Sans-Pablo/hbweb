// A* con arrays tipados: caminos válidos, de coste óptimo (frente a Dijkstra), reutilizables entre búsquedas y rodeando ocupados. node tests/path.test.mjs
import assert from "node:assert/strict";
import { findPath } from "../web/src/shared/path.js";
import { DX, DY } from "../web/src/shared/const.js";
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const W = 40, H = 30;
const mkGrid = (blockP, occ = new Map()) => {
  const wall = new Uint8Array(W * H).map(() => (rng() < blockP ? 1 : 0));
  return { w: W, h: H, blocked: (x, y) => x < 0 || y < 0 || x >= W || y >= H || wall[y * W + x] === 1, occupant: (x, y) => occ.get(y * W + x), wall };
};
const cost = d => (d % 2 ? 1 : 1.0001);
function dijkstra(g, sx, sy, tx, ty) {                         // referencia simple (O(n^2)); mismo coste por paso
  const dist = new Float64Array(W * H).fill(Infinity); dist[sy * W + sx] = 0; const done = new Uint8Array(W * H);
  for (;;) {
    let b = -1, bd = Infinity; for (let i = 0; i < W * H; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; b = i; }
    if (b < 0) break; done[b] = 1; const x = b % W, y = (b / W) | 0;
    for (let d = 1; d <= 8; d++) { const nx = x + DX[d], ny = y + DY[d]; if (g.blocked(nx, ny)) continue; const k = ny * W + nx; if (dist[b] + cost(d) < dist[k]) dist[k] = dist[b] + cost(d); }
  }
  return dist[ty * W + tx];
}
for (let round = 0; round < 40; round++) {                      // muchas búsquedas seguidas con la misma memoria
  const g = mkGrid(0.25);
  const sx = Math.floor(rng() * W), sy = Math.floor(rng() * H), tx = Math.floor(rng() * W), ty = Math.floor(rng() * H);
  if (g.blocked(sx, sy) || g.blocked(tx, ty) || (sx === tx && sy === ty)) continue;
  const p = findPath(g, sx, sy, tx, ty, 0, 1e6), best = dijkstra(g, sx, sy, tx, ty);
  if (best === Infinity) { assert.equal(p.length, 0, "sin camino"); continue; }
  let x = sx, y = sy, c = 0;
  for (const d of p) { x += DX[d]; y += DY[d]; assert.ok(!g.blocked(x, y), "no atraviesa muros"); c += cost(d); }
  assert.deepEqual([x, y], [tx, ty], "llega al destino");
  assert.ok(Math.abs(c - best) < 1e-3, `coste óptimo ${c} vs ${best}`);
}
// ocupadas: se rodean salvo el destino y la propia casilla
{
  const occ = new Map([[5 * W + 6, 99]]), g = mkGrid(0, occ);
  const p = findPath(g, 5, 5, 8, 5, 1, 1e5); let x = 5, y = 5; for (const d of p) { x += DX[d]; y += DY[d]; assert.notEqual(y * W + x, 5 * W + 6, "rodea al ocupado"); }
  assert.deepEqual(findPath(g, 5, 5, 6, 5, 1, 1e5).length, 1, "el destino ocupado sí se alcanza");
  assert.deepEqual(findPath(g, 5, 5, 5, 5, 1), [], "ya está allí");
}
// presupuesto: un destino lejano con pocos nodos no devuelve una ruta falsa
{ const g = mkGrid(0); assert.deepEqual(findPath(g, 0, 0, 39, 29, 0, 5), [], "presupuesto agotado"); }
console.log("OK path");
