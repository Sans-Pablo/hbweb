// Cripta de esqueletos: niveles procedurales que bajan de uno en uno (1..DUNGEON_LEVELS).
// Todo el dibujo sale de teselas que ya existen en los mapas originales de dungeon (middled1n y middled1x):
// tools/build_dungeon_palette.py extrae de ellos el suelo, la roca/agua y los bordes (indexados por la
// máscara 5x5 de casillas bloqueadas alrededor), y aquí se vuelven a colocar según un trazado nuevo.
import { Grid } from "./grid.js";

export const DUNGEON_LEVELS = 20;
export const DUNGEON_VERSION = 4;
export const BOSS_EVERY = 5;
export const FARM_PORTAL = Object.freeze({ id: "skeleton-entry", x: 134, y: 94, label: "Cripta de esqueletos", target: "dungeon" });
// Entrada desde el mapa original middled1n (casilla 100,85).
export const MIDDLE_PORTAL = Object.freeze({ id: "skeleton-entry-n", x: 100, y: 85, label: "Cripta de esqueletos", target: "dungeon" });
export const DUNGEON_ENTRANCES = Object.freeze({ arefarm: FARM_PORTAL, middled1n: MIDDLE_PORTAL });
export const DUNGEON_ASSETS = Object.freeze([...Array.from({ length: 10 }, (_, i) => "t" + (300 + i)), "t211", ...Array.from({ length: 40 }, (_, i) => "ske" + i)]);
export const isBossLevel = level => level % BOSS_EVERY === 0;
export const BOSS_COLORS = Object.freeze({ 1: "#ff3b2e", 2: "#b052ff", 3: "#22d6c4", 4: "#ffc933" });
export const BOSS_NAMES = Object.freeze({ 1: "Rey esqueleto carmesí", 2: "Rey esqueleto umbrío", 3: "Rey esqueleto glacial", 4: "Rey esqueleto dorado" });

export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Semilla de cada nivel a partir de la de la partida.
// Los 3 bits bajos llevan la partida (decide la rotación de temas); el resto mezcla partida y nivel.
export const levelSeed = (run, level) => (((Math.imul((run >>> 0) ^ 0x9E3779B9, 2654435761) + Math.imul(level, 40503) + 12345) & ~7) | ((run >>> 0) % 6)) >>> 0;

// ------------------------------------------------------------------ paleta
let PAL = null;
const popcount = v => { let c = 0; while (v) { v &= v - 1; c++; } return c; };
export function setDungeonPalette(raw) {
  const edge = new Map();
  for (const [k, v] of Object.entries(raw.edge)) edge.set(parseInt(k, 16), v);
  const dark = raw.deep.filter(d => d[0] === 300 || d[0] === 302 || d[0] === 301);
  PAL = { edge, keys: [...edge.keys()], near: new Map(), floor: raw.floor.filter(f => f[0] === 300).slice(0, 4), dark: dark.slice(0, 3), decor: raw.decor };
}
export const hasDungeonPalette = () => !!PAL;

function edgeSample(mask) {
  let s = PAL.edge.get(mask);
  if (s) return s[0];
  if (PAL.near.has(mask)) return PAL.near.get(mask);
  let best = null, bd = 99;
  for (const k of PAL.keys) { const d = popcount(k ^ mask); if (d < bd) { bd = d; best = k; } }
  const r = PAL.edge.get(best)[0];
  PAL.near.set(mask, r);
  return r;
}
const texFrame = (t, x, y) => 20 * (t[1] + ((y + t[4]) % 4)) + 6 * t[2] + ((x + t[3]) % 6);

// ------------------------------------------------------------------ trazados
const THEMES = ["salas", "laberinto", "anillos", "islas", "pilares", "cruz"];

class Plan {
  constructor(w, h) { this.w = w; this.h = h; this.open = new Uint8Array(w * h); }
  at(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.open[y * this.w + x] === 1; }
  rect(x, y, rw, rh, v = 1) {
    for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) if (i > 2 && j > 2 && i < this.w - 3 && j < this.h - 3) this.open[j * this.w + i] = v;
  }
  // pasillo de 4 de ancho entre dos puntos, en L
  link(ax, ay, bx, by, wd = 4, horizFirst = true) {
    const o = wd >> 1;
    if (horizFirst) { this.rect(Math.min(ax, bx) - o, ay - o, Math.abs(bx - ax) + wd, wd); this.rect(bx - o, Math.min(ay, by) - o, wd, Math.abs(by - ay) + wd); }
    else { this.rect(ax - o, Math.min(ay, by) - o, wd, Math.abs(by - ay) + wd); this.rect(Math.min(ax, bx) - o, by - o, Math.abs(bx - ax) + wd, wd); }
  }
}
const even = v => v & ~1;

function themeSalas(P, rng) {
  const leaves = [];
  const split = (x, y, w, h, d) => {
    const vert = w > h ? true : h > w ? false : rng() < .5;
    if (d > 3 || (vert ? w : h) < 24 || (d >= 2 && rng() < .25)) { leaves.push({ x, y, w, h }); return; }
    const cut = even(Math.floor((vert ? w : h) * (.4 + rng() * .2)));
    if (vert) { split(x, y, cut, h, d + 1); split(x + cut, y, w - cut, h, d + 1); } else { split(x, y, w, cut, d + 1); split(x, y + cut, w, h - cut, d + 1); }
  };
  const rooms = [];
  split(3, 3, P.w - 6, P.h - 6, 0);
  for (const l of leaves) {
    const rw = even(Math.max(8, l.w - 6 - Math.floor(rng() * 6))), rh = even(Math.max(8, l.h - 6 - Math.floor(rng() * 6)));
    const x = even(l.x + 2 + Math.floor(rng() * Math.max(1, l.w - rw - 3))), y = even(l.y + 2 + Math.floor(rng() * Math.max(1, l.h - rh - 3)));
    P.rect(x, y, rw, rh);
    if (rng() < .4 && rw >= 12 && rh >= 12) { P.rect(x, y, 4, 4, 0); P.rect(x + rw - 4, y + rh - 4, 4, 4, 0); }   // esquinas cortadas
    rooms.push({ cx: even(x + (rw >> 1)), cy: even(y + (rh >> 1)) });
  }
  // cadena + un par de atajos: se puede rodear
  const order = rooms.map((r, i) => [r, i]).sort((a, b) => a[0].cx + a[0].cy - b[0].cx - b[0].cy).map(a => a[0]);
  for (let i = 1; i < order.length; i++) P.link(order[i - 1].cx, order[i - 1].cy, order[i].cx, order[i].cy, 4, rng() < .5);
  for (let k = 0; k < 2 && order.length > 3; k++) { const a = order[Math.floor(rng() * order.length)], b = order[Math.floor(rng() * order.length)]; if (a !== b) P.link(a.cx, a.cy, b.cx, b.cy, 4, rng() < .5); }
}

function themeLaberinto(P, rng) {
  const pitch = 7, n = Math.floor((P.w - 4) / pitch), ox = 4, oy = 4;
  const seen = new Uint8Array(n * n), stack = [[0, 0]];
  const cell = (i, j) => P.rect(ox + i * pitch, oy + j * pitch, 4, 4);
  seen[0] = 1; cell(0, 0);
  while (stack.length) {
    const [i, j] = stack.at(-1);
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b, a, b]).filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !seen[b * n + a]);
    if (!nb.length) { stack.pop(); continue; }
    const [a, b, da, db] = nb[Math.floor(rng() * nb.length)];
    seen[b * n + a] = 1; cell(a, b);
    P.rect(ox + i * pitch + (da > 0 ? 4 : da < 0 ? -3 : 0), oy + j * pitch + (db > 0 ? 4 : db < 0 ? -3 : 0), da ? 3 : 4, db ? 3 : 4);
    stack.push([a, b]);
  }
  for (let k = 0; k < n; k++) {                                      // bucles extra
    const i = Math.floor(rng() * (n - 1)), j = Math.floor(rng() * n);
    if (rng() < .5) P.rect(ox + i * pitch + 4, oy + j * pitch, 3, 4); else P.rect(ox + j * pitch, oy + i * pitch + 4, 4, 3);
  }
}

function themeAnillos(P, rng) {
  const c = even(P.w >> 1), ring = (d, wd) => { P.rect(c - d, c - d, 2 * d, 2 * d); P.rect(c - d + wd, c - d + wd, 2 * d - 2 * wd, 2 * d - 2 * wd, 0); };
  ring(26, 6); ring(14, 6); P.rect(c - 6, c - 6, 12, 12);
  const up = rng() < .5;
  P.rect(c - 3, up ? c - 21 : c + 13, 6, 9);                                // anillo exterior <-> medio
  const left = rng() < .5;
  P.rect(left ? c - 9 : c + 4, c - 3, 5, 6);                                // medio <-> centro
  if (rng() < .6) P.rect(left ? c + 4 : c - 9, c - 3, 5, 6);
  if (rng() < .6) P.rect(c - 3, up ? c + 13 : c - 21, 6, 9);                // segundo acceso: se puede rodear
}

function themeIslas(P, rng) {
  const pitch = 20, n = 3, islands = [];
  const start = even((P.w - (n * pitch - 6)) >> 1);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const s = 10 + 2 * Math.floor(rng() * 3), x = start + i * pitch + (12 - s >> 1), y = start + j * pitch + (12 - s >> 1);
    P.rect(even(x), even(y), s, s);
    if (rng() < .5) P.rect(even(x), even(y), 4, 4, 0);
    islands.push({ i, j, cx: even(x + (s >> 1)), cy: even(y + (s >> 1)) });
  }
  const link = (a, b) => P.link(a.cx, a.cy, b.cx, b.cy, 4, a.j === b.j);
  const at = (i, j) => islands.find(o => o.i === i && o.j === j);
  const done = new Set([0]), seen = [at(0, 0)];
  while (seen.length < islands.length) {
    const a = seen[Math.floor(rng() * seen.length)], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => at(a.i + x, a.j + y)).filter(o => o && !seen.includes(o));
    if (!dirs.length) continue;
    const b = dirs[Math.floor(rng() * dirs.length)]; link(a, b); seen.push(b);
  }
  for (let k = 0; k < 2; k++) { const a = at(Math.floor(rng() * 2), Math.floor(rng() * 3)); if (a) link(a, at(a.i + 1, a.j)); }
}

function themePilares(P, rng) {
  P.rect(6, 6, P.w - 12, P.h - 12);
  for (let y = 12; y < P.h - 14; y += 10) for (let x = 12; x < P.w - 14; x += 10) if (rng() < .85) P.rect(x, y, 4, 4, 0);
  P.rect(3, 26, 4, 8); P.rect(P.w - 7, 26, 4, 8);
  for (const [x, y] of [[10, 10], [P.w - 14, P.h - 14]]) P.rect(x, y, 4, 4, 0);
}

function themeCruz(P, rng) {
  const c = even(P.w >> 1);
  P.rect(c - 4, 6, 8, P.h - 12); P.rect(6, c - 4, P.w - 12, 8);
  P.rect(c - 8, c - 8, 16, 16);
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = sx > 0 ? P.w - 22 : 8, y = sy > 0 ? P.h - 22 : 8;
    P.rect(x, y, 14, 14);
    P.link(x + 6, y + 6, sx > 0 ? c + 4 : c - 4, sy > 0 ? c + 20 : c - 20, 4, rng() < .5);
    if (rng() < .5) P.rect(x + 4, y + 4, 6, 6, 0);
  }
}
const BUILDERS = { salas: themeSalas, laberinto: themeLaberinto, anillos: themeAnillos, islas: themeIslas, pilares: themePilares, cruz: themeCruz };
const THEME_NAMES = { salas: "Salas olvidadas", laberinto: "Laberinto de osarios", anillos: "Galerías concéntricas", islas: "Islas sobre el lago", pilares: "Sala de los pilares", cruz: "Cruce de las cuatro criptas" };

function themeJefe(P, rng) {
  const c = even(P.w >> 1);
  // sala de entrada pequeña al sur, pasillo, y la arena grande (octógono rectilíneo)
  P.rect(c - 4, P.h - 14, 8, 8);
  P.rect(c - 2, P.h - 26, 4, 14);
  P.rect(c - 10, 6, 20, 20);
  P.rect(c - 12, 10, 24, 12);
  P.rect(c - 12, 10, 4, 4, 0); P.rect(c + 8, 10, 4, 4, 0);
  for (const [dx, dy] of [[-6, 10], [4, 10], [-6, 18], [4, 18]]) P.rect(c + dx, dy, 2, 2, 0);
}

// ------------------------------------------------------------------ generación
function bfs(P, sx, sy) {
  const d = new Int32Array(P.w * P.h).fill(-1), q = [sx, sy];
  d[sy * P.w + sx] = 0;
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i], y = q[i + 1];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (P.at(nx, ny) && d[ny * P.w + nx] < 0) { d[ny * P.w + nx] = d[y * P.w + x] + 1; q.push(nx, ny); }
    }
  }
  return d;
}
const roomy = (P, x, y, r = 1) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (!P.at(x + i, y + j)) return false; return true; };

export function generateLevel(seed, level) {
  if (!PAL) throw new Error("Falta la paleta de la cripta");
  const rng = seededRandom(seed), boss = isBossLevel(level);
  const w = boss ? 36 : 60, h = w;
  const P = new Plan(w, h);
  let theme;
  if (boss) { theme = "jefe"; themeJefe(P, rng); }
  else {
    // la partida (3 bits bajos de la semilla) rota el orden de los temas; dos niveles seguidos nunca repiten trazado
    theme = THEMES[(level * 5 + (seed & 7)) % THEMES.length];
    BUILDERS[theme](P, rng);
  }
  // inicio / meta: extremos de la componente conexa mayor
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (roomy(P, x, y, 1)) cells.push([x, y]);
  let sp = boss ? [w >> 1, h - 10] : cells.reduce((a, c) => (c[0] + c[1] < a[0] + a[1] ? c : a), cells[0]);
  if (!roomy(P, sp[0], sp[1], 1)) sp = cells[0];
  let dist = bfs(P, sp[0], sp[1]);
  for (let i = 0; i < P.open.length; i++) if (P.open[i] && dist[i] < 0) P.open[i] = 0;      // se tapan las zonas sueltas
  let fin = boss ? [w >> 1, 12] : sp, far = -1;
  if (!boss) for (const [x, y] of cells) { const d = dist[y * w + x]; if (d > far && roomy(P, x, y, 1)) { far = d; fin = [x, y]; } }
  const last = level >= DUNGEON_LEVELS;
  const portals = [
    { id: "return", x: sp[0], y: sp[1], label: "Salir de la cripta", target: "origin" },
    last ? { id: "finish", x: fin[0], y: fin[1], label: "Salida de la cripta · ¡victoria!", target: "origin", locked: true }
      : { id: "down", x: fin[0], y: fin[1], label: "Bajar al nivel " + (level + 1), target: "down", locked: true },
  ];

  // ---- teselas
  const bytes = new Uint8Array(w * h * 10), dv = new DataView(bytes.buffer);
  const floorT = PAL.floor[Math.floor(rng() * Math.min(3, PAL.floor.length))];
  const deepAt = () => PAL.dark[0];         // el agua de middled1n se dibuja con hojas animadas: no se reutiliza
  const blockedAt = (x, y) => !P.at(x, y);
  // decorado suelto: obstáculos aislados sobre suelo despejado, lejos de portales
  const decor = new Map();
  const far2 = (x, y) => [sp, fin].every(p => Math.max(Math.abs(x - p[0]), Math.abs(y - p[1])) > 6);
  for (const [x, y] of cells) if (rng() < .012 && far2(x, y) && roomy(P, x, y, 2)) decor.set(y * w + x, PAL.decor[Math.floor(rng() * PAL.decor.length)]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) m = m * 2 + (blockedAt(x + dx, y + dy) ? 1 : 0);
    const o = (y * w + x) * 10, self = blockedAt(x, y);
    let spr, frame, obj = 0, of = 0;
    if (m === 0) { spr = floorT[0]; frame = texFrame(floorT, x, y); }
    else if (m === (1 << 25) - 1) { const t = deepAt(x, y); spr = t[0]; frame = texFrame(t, x, y); }
    else { const s = edgeSample(m); [spr, frame, obj, of] = s; }
    const dec = decor.get(y * w + x);
    if (dec) { obj = dec[0]; of = dec[1]; }
    dv.setInt16(o, spr, true); dv.setInt16(o + 2, frame, true); dv.setInt16(o + 4, obj, true); dv.setInt16(o + 6, of, true);
    bytes[o + 8] = self || dec ? 0x80 : 0;
  }
  const grid = new Grid(w, h, bytes);

  // ---- enemigos
  const spawns = [];
  const scale = { hp: 1 + .22 * (level - 1), dmg: 1 + .1 * (level - 1), exp: 1 + .15 * (level - 1) };
  const free = cells.filter(([x, y]) => dist[y * w + x] >= (boss ? 8 : 14) && roomy(P, x, y, 1) && !decor.has(y * w + x) && Math.max(Math.abs(x - fin[0]), Math.abs(y - fin[1])) > 3);
  let want = boss ? 6 : Math.min(26, 8 + level), id = 1;
  const taken = [];
  for (let tries = 0; want > 0 && tries < 600 && free.length; tries++) {
    const [x, y] = free[Math.floor(rng() * free.length)];
    if (taken.some(t => Math.abs(t[0] - x) + Math.abs(t[1] - y) < (boss ? 5 : 9))) continue;
    const max = Math.min(want, 2 + Math.floor(rng() * 2));
    taken.push([x, y]); want -= max;
    spawns.push({ id: id++, name: "Skeleton", max, rect: [x - 2, y - 2, x + 2, y + 2], respawn: false, scale, specialProb: Math.min(60, 4 + 3 * level), specialKind: 1 });
  }
  let bossTier = 0;
  if (boss) {
    bossTier = Math.min(4, level / BOSS_EVERY);
    spawns.push({ id: id++, name: "Skeleton", max: 1, rect: [w >> 1, 15, w >> 1, 15], respawn: false, boss: bossTier, scale: { hp: scale.hp * (6 + 2 * bossTier), dmg: scale.dmg * (1.6 + .2 * bossTier), exp: scale.exp * (8 + 3 * bossTier) } });
  }
  return {
    grid, start: sp, portals, spawns, seed: seed >>> 0, level, theme, boss: bossTier, version: DUNGEON_VERSION,
    name: boss ? "Cámara del " + BOSS_NAMES[bossTier].toLowerCase() : THEME_NAMES[theme],
  };
}
