// Generación determinista v1. Un grafo conectado de salas y pasillos de dos casillas.
import { Grid } from "./grid.js";

export const FARM_PORTAL = Object.freeze({ id: "skeleton-entry", x: 134, y: 94, label: "Cripta de esqueletos", target: "dungeon" });
export const DUNGEON_VERSION = 1;

export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDungeon(seed) {
  const rng = seededRandom(seed), w = 64, h = 64;
  const bytes = new Uint8Array(w * h * 10);
  for (let i = 0; i < w * h; i++) bytes[i * 10 + 8] = 0x80;
  const carve = (x, y) => { if (x > 0 && y > 0 && x < w - 1 && y < h - 1) bytes[(y * w + x) * 10 + 8] = 0; };
  const rooms = [];
  // Nueve sectores evitan solapamientos y garantizan nueve salas aun con seeds adversas.
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const rw = 7 + Math.floor(rng() * 6), rh = 7 + Math.floor(rng() * 6);
    const x = 3 + col * 20 + Math.floor(rng() * (16 - rw));
    const y = 3 + row * 20 + Math.floor(rng() * (16 - rh));
    const room = { x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1) };
    rooms.push(room);
    for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) carve(i, j);
  }
  const corridor = (a, b) => {
    let x = a.cx, y = a.cy;
    const walkX = () => { while (x !== b.cx) { carve(x, y); carve(x, y + 1); x += Math.sign(b.cx - x); } carve(x, y); carve(x, y + 1); };
    const walkY = () => { while (y !== b.cy) { carve(x, y); carve(x + 1, y); y += Math.sign(b.cy - y); } carve(x, y); carve(x + 1, y); };
    if (rng() < .5) { walkX(); walkY(); } else { walkY(); walkX(); }
  };
  // Árbol: cada sala se enlaza con una anterior adyacente; no hay zonas aisladas.
  for (let i = 1; i < rooms.length; i++) {
    const prev = i < 3 ? i - 1 : i % 3 === 0 ? i - 3 : rng() < .5 ? i - 1 : i - 3;
    corridor(rooms[i], rooms[prev]);
  }
  for (let i = 0; i < 6; i++) if (rng() < .4) corridor(rooms[i], rooms[i + 3]);
  const start = [rooms[0].cx, rooms[0].cy];
  const portals = [
    { id: "return", x: start[0], y: start[1], label: "Regresar a Aresfarm", target: "farm" },
    { id: "finish", x: rooms[8].cx, y: rooms[8].cy, label: "Salida de la cripta", target: "farm" },
  ];
  const spawns = rooms.slice(1).map((r, i) => ({ id: i + 1, name: "Skeleton", max: 1 + Math.floor(rng() * 2), rect: [r.x + 1, r.y + 1, r.x + r.w - 2, r.y + r.h - 2], respawn: false }));
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < w * h; i++) {
    const wall = !!(bytes[i * 10 + 8] & 0x80);
    dv.setInt16(i * 10, wall ? 301 : 330, true);
    dv.setInt16(i * 10 + 2, [0, 1, 20, 21][Math.floor(rng() * 4)], true);
  }
  const grid = new Grid(w, h, bytes);
  grid.procedural = true;
  return { grid, rooms, start, portals, spawns, seed: seed >>> 0, version: DUNGEON_VERSION };
}
