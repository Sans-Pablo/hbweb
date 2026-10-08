// Cripta compacta inspirada en las cámaras, cruces y galerías de middled1x.
import { Grid } from "./grid.js";

export const FARM_PORTAL = Object.freeze({ id: "skeleton-entry", x: 134, y: 94, label: "Cripta de esqueletos", target: "dungeon" });
export const DUNGEON_VERSION = 3;
export const DUNGEON_FLOOR_FRAMES = Object.freeze([1, 21, 41, 61]);
export const DUNGEON_FLOORS = Object.freeze([{ spr: 330, frames: DUNGEON_FLOOR_FRAMES }, { spr: 363, frames: [1, 21] }, { spr: 365, frames: [1, 21] }]);
export const DUNGEON_ASSETS = Object.freeze(["t301", "t330", "t363", "t365", "t200", "t216", "t219", "t223", ...Array.from({ length: 40 }, (_, i) => "ske" + i)]);

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
  const soil = new Uint8Array(w * h);
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
    const shape = n === 0 ? "hall" : [2, 6, 8].includes(n) ? "round" : n === 4 ? "octagon" : n === 7 ? "alcove" : "cross";
    const room = { x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1), name: names[n], shape };
    rooms.push(room);
    for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) {
      const dx = Math.abs((i - x + .5) / rw * 2 - 1), dy = Math.abs((j - y + .5) / rh * 2 - 1);
      const open = shape === "round" ? dx * dx + dy * dy <= 1 : shape === "cross" ? dx < .65 || dy < .65 : shape === "octagon" ? Math.min(i - x, x + rw - 1 - i) + Math.min(j - y, y + rh - 1 - j) >= 6 : shape === "alcove" ? !(i > x + rw - 6 && j < y + 5) : true;
      if (open) { carve(i, j); if (n === 2 || n === 6) soil[j * w + i] = 1; }
    }
  }
  const corridors = [];
  const corridor = (a, b, forcedWidth = null) => {
    const width = forcedWidth ?? (corridors.length === 0 ? 6 : a === rooms[4] || b === rooms[4] ? 7 : [3, 4, 5, 6][Math.floor(rng() * 4)]);
    const horizontal = Math.abs(b.cx - a.cx) > Math.abs(b.cy - a.cy);
    const bend = (rng() < .5 ? -1 : 1) * (forcedWidth ? 3 : 5 + Math.floor(rng() * 8));
    const p0 = [a.cx, a.cy], p3 = [b.cx, b.cy];
    const p1 = horizontal ? [a.cx + (b.cx - a.cx) * .35, a.cy + bend] : [a.cx + bend, a.cy + (b.cy - a.cy) * .35];
    const p2 = horizontal ? [b.cx - (b.cx - a.cx) * .35, b.cy - bend] : [b.cx - bend, b.cy - (b.cy - a.cy) * .35];
    const cells = [], pad = Math.floor(width / 2), steps = Math.ceil(Math.hypot(b.cx - a.cx, b.cy - a.cy) * 4);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, s = 1 - t;
      const x = Math.round(s*s*s*p0[0] + 3*s*s*t*p1[0] + 3*s*t*t*p2[0] + t*t*t*p3[0]);
      const y = Math.round(s*s*s*p0[1] + 3*s*s*t*p1[1] + 3*s*t*t*p2[1] + t*t*t*p3[1]);
      if (cells.length && cells.at(-1)[0] === x && cells.at(-1)[1] === y) continue;
      cells.push([x, y]);
      for (let dy = -pad; dy < width - pad; dy++) for (let dx = -pad; dx < width - pad; dx++) { carve(x + dx, y + dy); gallery[(y + dy) * w + x + dx] = 1; }
    }
    corridors.push({ points: [p0, p1, p2, p3], cells, width });
  };
  // Doce enlaces garantizan circuitos: se puede explorar por ambos lados y rodear enemigos.
  for (let i = 0; i < rooms.length; i++) {
    if (i % 3 < 2) corridor(rooms[i], rooms[i + 1]);
    if (i < 6) corridor(rooms[i], rooms[i + 3]);
  }
  // Ramales cortos a cámaras de excavación: desvíos para explorar, fuera del circuito principal.
  const alcoves = [];
  for (const c of corridors.filter((_, i) => i % 3 === 1)) {
    const [x, y] = c.cells[Math.floor(c.cells.length / 2)], horizontal = Math.abs(c.cells.at(-1)[0] - c.cells[0][0]) > Math.abs(c.cells.at(-1)[1] - c.cells[0][1]);
    const side = rng() < .5 ? -1 : 1, ax = Math.max(7, Math.min(w - 8, x + (horizontal ? 0 : side * 9))), ay = Math.max(7, Math.min(h - 8, y + (horizontal ? side * 9 : 0)));
    corridor({ cx: x, cy: y }, { cx: ax, cy: ay }, 3);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) if (dx*dx/25 + dy*dy/16 <= 1) { carve(ax + dx, ay + dy); soil[(ay + dy) * w + ax + dx] = 1; }
    alcoves.push({ x: ax, y: ay });
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
  const prop = (x, y, spr, frame, blocked = true) => {
    if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1 || gallery[y*w+x] || bytes[(y*w+x)*10+8] & 0x80) return;
    if (portals.some(p => Math.max(Math.abs(x-p.x),Math.abs(y-p.y)) <= 2) || Math.max(Math.abs(x-start[0]),Math.abs(y-start[1])) <= 10) return;
    const o = (y * w + x) * 10;
    if (dv.getInt16(o + 4, true)) return;
    // Un obstáculo aislado necesita un anillo libre: no cortar puntas ni cuellos de una curva.
    if (blocked) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (bytes[((y + dy) * w + x + dx) * 10 + 8] & 0x80) return;
    dv.setInt16(o + 4, spr, true); dv.setInt16(o + 6, frame, true);
    if (blocked) bytes[o + 8] = 0x80;
  };
  for (const r of rooms) {
    for (const [x, y, frame] of [[r.x + 2, r.y + 2, 41], [r.x + r.w - 3, r.y + 2, 42], [r.x + 2, r.y + r.h - 3, 43], [r.x + r.w - 3, r.y + r.h - 3, 41]]) {
      prop(x, y, 200, frame);
    }
    // Antorchas originales: decoración sin bloquear las entradas ni las rutas centrales.
    for (const x of [r.x + 1, r.x + r.w - 2]) {
      const o = ((r.y + 4) * w + x) * 10;
      dv.setInt16(o + 4, 200, true); dv.setInt16(o + 6, 32, true);
    }
    if (r.shape === "round") for (const dx of [-5, 5]) for (const dy of [-4, 4]) prop(r.cx + dx, r.cy + dy, 200, 8 + Math.floor(rng() * 8));
    if (r.shape === "octagon") for (const dx of [-7, 7]) for (const dy of [-7, 7]) prop(r.cx + dx, r.cy + dy, 200, 41 + Math.floor(rng() * 3));
    if (r.shape === "alcove") prop(r.x + r.w - 6, r.y + 6, 223, 2);
  }
  for (const a of alcoves) { prop(a.x - 2, a.y + 1, 219, 5); prop(a.x + 3, a.y - 2, 216, 3, false); }
  for (let i = 0; i < w * h; i++) {
    const wall = !!(bytes[i * 10 + 8] & 0x80);
    const floor = soil[i] ? DUNGEON_FLOORS[(i + (seed >>> 0)) % 23 === 0 ? 2 : 1] : DUNGEON_FLOORS[0];
    dv.setInt16(i * 10, wall ? 301 : floor.spr, true);
    // t330/0 es transparente y /20, /40, /60 son negros: solo piedra visible.
    const frames = wall ? [0, 1, 20, 21] : floor.frames;
    dv.setInt16(i * 10 + 2, frames[Math.floor(rng() * frames.length)], true);
  }
  const grid = new Grid(w, h, bytes);
  grid.procedural = true;
  grid.rooms = rooms;
  return { grid, rooms, corridors, alcoves, start, portals, spawns, seed: seed >>> 0, version: DUNGEON_VERSION };
}
