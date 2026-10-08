// Cripta compacta inspirada en las cámaras, cruces y galerías de middled1x.
import { Grid } from "./grid.js";

export const FARM_PORTAL = Object.freeze({ id: "skeleton-entry", x: 134, y: 94, label: "Cripta de esqueletos", target: "dungeon" });
export const DUNGEON_VERSION = 2;
export const DUNGEON_FLOOR_FRAMES = Object.freeze([1, 21, 41, 61]);
export const DUNGEON_ASSETS = Object.freeze(["t301", "t330", "t200", ...Array.from({ length: 40 }, (_, i) => "ske" + i)]);

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
  const rng = seededRandom(seed), w = 112, h = 112;
  const bytes = new Uint8Array(w * h * 10);
  const gallery = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bytes[i * 10 + 8] = 0x80;
  const carve = (x, y) => { if (x > 0 && y > 0 && x < w - 1 && y < h - 1) bytes[(y * w + x) * 10 + 8] = 0; };
  const rooms = [];
  const names = ["Vestíbulo", "Galería de los guardianes", "Osario", "Cripta oeste", "Cámara de los pilares", "Cripta este", "Sepulcros", "Galería profunda", "Santuario final"];
  // Sectores de 36 casillas: cámaras amplias separadas por galerías, sin solapamientos.
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const n = row * 3 + col;
    const rw = n === 4 ? 28 : n === 0 ? 26 : 18 + Math.floor(rng() * 7);
    const rh = n === 4 ? 28 : n === 0 ? 22 : 18 + Math.floor(rng() * 7);
    const x = 3 + col * 36 + Math.floor(rng() * (30 - rw));
    const y = 3 + row * 36 + Math.floor(rng() * (30 - rh));
    const room = { x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1), name: names[n] };
    rooms.push(room);
    for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) carve(i, j);
  }
  const corridors = [];
  const corridor = (a, b) => {
    let x = a.cx, y = a.cy;
    const width = a === rooms[4] || b === rooms[4] ? 8 : 6;
    const pad = width / 2;
    const brush = () => { for (let dy = -pad; dy < pad; dy++) for (let dx = -pad; dx < pad; dx++) { carve(x + dx, y + dy); gallery[(y + dy) * w + x + dx] = 1; } };
    const points = [[x, y]];
    const walkX = () => { while (x !== b.cx) { brush(); x += Math.sign(b.cx - x); } brush(); points.push([x, y]); };
    const walkY = () => { while (y !== b.cy) { brush(); y += Math.sign(b.cy - y); } brush(); points.push([x, y]); };
    if (rng() < .5) { walkX(); walkY(); } else { walkY(); walkX(); }
    corridors.push({ points, width });
  };
  // Doce enlaces garantizan circuitos: se puede explorar por ambos lados y rodear enemigos.
  for (let i = 0; i < rooms.length; i++) {
    if (i % 3 < 2) corridor(rooms[i], rooms[i + 1]);
    if (i < 6) corridor(rooms[i], rooms[i + 3]);
  }
  const start = [rooms[0].x + 5, rooms[0].cy];
  const portals = [
    { id: "return", x: start[0], y: start[1], label: "Regresar a Aresfarm", target: "farm" },
    { id: "finish", x: rooms[8].cx, y: rooms[8].cy, label: "Salida de la cripta", target: "farm" },
  ];
  const spawns = rooms.slice(1).map((r, i) => ({ id: i + 1, name: "Skeleton", max: i === 7 ? 6 : 3 + Math.floor(rng() * 2), rect: [r.x + 4, r.y + 4, r.x + r.w - 5, r.y + r.h - 5], respawn: false }));
  // Dos guardianes en pantalla al entrar, a ocho casillas: visibles sin atacar al aparecer.
  spawns.unshift(...[-2, 2].map((dy, i) => ({ id: 20 + i, name: "Skeleton", max: 1, rect: [start[0] + 8, start[1] + dy, start[0] + 8, start[1] + dy], respawn: false })));
  const dv = new DataView(bytes.buffer);
  for (const r of rooms) {
    for (const [x, y, frame] of [[r.x + 2, r.y + 2, 41], [r.x + r.w - 3, r.y + 2, 42], [r.x + 2, r.y + r.h - 3, 43], [r.x + r.w - 3, r.y + r.h - 3, 41]]) {
      if (gallery[y * w + x]) continue;
      const o = (y * w + x) * 10;
      dv.setInt16(o + 4, 200, true); dv.setInt16(o + 6, frame, true); bytes[o + 8] = 0x80;
    }
    // Antorchas originales: decoración sin bloquear las entradas ni las rutas centrales.
    for (const x of [r.x + 1, r.x + r.w - 2]) {
      const o = ((r.y + 4) * w + x) * 10;
      dv.setInt16(o + 4, 200, true); dv.setInt16(o + 6, 32, true);
    }
  }
  for (let i = 0; i < w * h; i++) {
    const wall = !!(bytes[i * 10 + 8] & 0x80);
    dv.setInt16(i * 10, wall ? 301 : 330, true);
    // t330/0 es transparente y /20, /40, /60 son negros: solo piedra visible.
    const frames = wall ? [0, 1, 20, 21] : DUNGEON_FLOOR_FRAMES;
    dv.setInt16(i * 10 + 2, frames[Math.floor(rng() * frames.length)], true);
  }
  const grid = new Grid(w, h, bytes);
  grid.procedural = true;
  grid.rooms = rooms;
  return { grid, rooms, corridors, start, portals, spawns, seed: seed >>> 0, version: DUNGEON_VERSION };
}
