// Cripta de esqueletos: niveles que bajan de uno en uno (1..DUNGEON_LEVELS).
// Cada nivel es una ventana recortada de los mapas originales de dungeon (middled1n y middled1x), con sus acantilados, suelos y antorchas
// tal cual (tools/build_dungeon_palette.py los empaqueta en dungeon_palette.json). Solo el sello del corte de la ventana se dibuja
// con teselas de borde elegidas por la máscara 5x5 de casillas bloqueadas y por lo que el original coloca junto a qué.
import { Grid } from "./grid.js";

export const DUNGEON_LEVELS = 20;
export const DUNGEON_VERSION = 6;
export const BOSS_EVERY = 5;
// La entrada es el teletransportador de la granja hacia middled1n (Adventure.teleport lo convierte en entrada directa a la cripta).
export const DUNGEON_ASSETS = Object.freeze([...Array.from({ length: 10 }, (_, i) => "t" + (300 + i)), "t211", ...Array.from({ length: 40 }, (_, i) => "ske" + i)]);
// Escenario de cada rey (cada tramo de 5 niveles): carmesí = fuego (dglv4, con lava), umbrío = Tower of Hell (Toh1-3), glacial = hielo (icebound)
// y dorado = laberinto (maze). Los mapas vienen de tools/convert_theme_maps.py y entran recortados en la paleta.
export const STAGE_THEMES = Object.freeze(["fuego", "sombra", "hielo", "oro"]);
export const stageTheme = level => STAGE_THEMES[Math.min(3, Math.floor((level - 1) / BOSS_EVERY))];
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
  const pairs = l => new Set(l.map(([a, b]) => a * 4096 + b));
  const sect = (sec, cave) => {                                    // suelo, fondo y bordes de un tema (la cueva solo usa sus hojas 300-302)
    const edge = new Map();
    for (const [k, v] of Object.entries(sec.edge)) edge.set(parseInt(k, 16), v);
    const dark = cave ? sec.deep.filter(d => d[0] === 300 || d[0] === 302 || d[0] === 301) : sec.deep;
    const floor = cave ? sec.floor.filter(f => f[0] === 300) : sec.floor;
    return { edge, keys: [...edge.keys()], near: new Map(), floor: floor.slice(0, 4), dark: dark.slice(0, 3) };
  };
  const themes = { cueva: sect(raw, true) };
  for (const [k, v] of Object.entries(raw.themes || {})) if (v.edge && Object.keys(v.edge).length) themes[k] = sect(v, false);
  PAL = { themes, tiles: raw.tiles, adjH: pairs(raw.adjH), adjV: pairs(raw.adjV), srcTiles: raw.srcTiles, maps: raw.srcMaps, decor: raw.decor };
}
export const hasDungeonPalette = () => !!PAL;

// Teselas posibles para una máscara 5x5: las del original para esa forma exacta o, si no existe, las de las formas más parecidas.
function edgeCandidates(T, mask) {
  const s = T.edge.get(mask);
  if (s) return s;
  let r = T.near.get(mask);
  if (r) return r;
  let bd = 99, best = [];
  for (const k of T.keys) { const d = popcount(k ^ mask); if (d < bd) { bd = d; best = [k]; } else if (d === bd) best.push(k); }
  r = [...new Set(best.slice(0, 6).flatMap(k => T.edge.get(k).slice(0, 2)))];
  T.near.set(mask, r);
  return r;
}
// Entre los candidatos se prefiere el que el original dibuja junto a las teselas ya colocadas a la izquierda y arriba
// (qué sprite va con qué sprite), para que no haya costuras ni piezas ajenas.
function pickEdge(cands, left, up) {
  let best = cands[0], bs = -1;
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    const sc = (left >= 0 && PAL.adjH.has(left * 4096 + c) ? 2 : 0) + (up >= 0 && PAL.adjV.has(up * 4096 + c) ? 2 : 0) - i * 0.1;
    if (sc > bs) { bs = sc; best = c; }
  }
  return best;
}
const texFrame = (t, x, y) => 20 * (t[1] + ((y + t[4]) % 4)) + 6 * t[2] + ((x + t[3]) % 6);

// ------------------------------------------------------------------ trazado
// Cada nivel es una ventana (60x60; 36x36 los jefes) recortada de middled1n/middled1x: las paredes, los acantilados y el suelo son los
// que dibujó el original. Lo que queda fuera de la ventana se sella con roca, y solo ahí se eligen teselas de borde por máscara.
class Plan {
  constructor(w, h) { this.w = w; this.h = h; this.open = new Uint8Array(w * h); }
  at(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.open[y * this.w + x] === 1; }
}
const WATER = new Set([305, 306, 307, 308, 309]);
function srcMap(i) {
  const m = PAL.maps[i];
  if (!m.cells) {
    const cells = new Int32Array(m.w * m.h); let k = 0;
    for (let j = 0; j < m.rle.length; j += 2) for (let r = 0; r < m.rle[j + 1]; r++) cells[k++] = m.rle[j];
    m.cells = cells;
    m.bad = new Uint8Array(m.w * m.h);                                   // agua, puentes y casillas especiales: nunca dentro de un nivel
    for (let q = 0; q < cells.length; q++) { const t = PAL.srcTiles[cells[q]]; m.bad[q] = WATER.has(t[0]) || t[4] === 2 ? 1 : 0; }
    m.sum = new Int32Array((m.w + 1) * (m.h + 1));                       // sumas acumuladas de `bad`
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) m.sum[(y + 1) * (m.w + 1) + x + 1] = m.bad[y * m.w + x] + m.sum[y * (m.w + 1) + x + 1] + m.sum[(y + 1) * (m.w + 1) + x] - m.sum[y * (m.w + 1) + x];
  }
  return m;
}
const srcBlocked = (m, x, y) => x < 0 || y < 0 || x >= m.w || y >= m.h || PAL.srcTiles[m.cells[y * m.w + x]][4] !== 0;
const badIn = (m, x0, y0, n) => m.sum[(y0 + n) * (m.w + 1) + x0 + n] - m.sum[y0 * (m.w + 1) + x0 + n] - m.sum[(y0 + n) * (m.w + 1) + x0] + m.sum[y0 * (m.w + 1) + x0];

// componentes conexas del plan (4 vecinos): deja solo la mayor y devuelve su tamaño
function keepLargest(P) {
  const lab = new Int32Array(P.w * P.h), sizes = [0];
  for (let i = 0; i < P.open.length; i++) {
    if (!P.open[i] || lab[i]) continue;
    const id = sizes.length, q = [i]; lab[i] = id; let n = 0;
    for (let k = 0; k < q.length; k++) {
      const c = q[k], x = c % P.w, y = (c / P.w) | 0; n++;
      for (const j of [x > 0 ? c - 1 : -1, x < P.w - 1 ? c + 1 : -1, y > 0 ? c - P.w : -1, y < P.h - 1 ? c + P.w : -1]) if (j >= 0 && P.open[j] && !lab[j]) { lab[j] = id; q.push(j); }
    }
    sizes.push(n);
  }
  let best = 0; for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[best]) best = i;
  for (let i = 0; i < P.open.length; i++) if (P.open[i] && lab[i] !== best) P.open[i] = 0;
  return sizes[best] || 0;
}

// Busca una ventana válida: sin agua, con una componente grande y despejada y el menor corte posible (así hay menos pared que inventar).
function pickWindow(rng, n, boss, theme) {
  const pool = PAL.maps.map((m, i) => i).filter(i => PAL.maps[i].theme === theme);
  if (!pool.length) return null;
  const found = [];
  for (let t = 0; t < 260; t++) {
    const mi = pool[Math.floor(rng() * pool.length)], m = srcMap(mi);
    if (m.w < n || m.h < n) continue;
    const x0 = Math.floor(rng() * (m.w - n)), y0 = Math.floor(rng() * (m.h - n));
    if (badIn(m, x0, y0, n)) continue;
    const P = new Plan(n, n); let cut = 0;
    for (let y = 3; y < n - 3; y++) for (let x = 3; x < n - 3; x++) {
      if (srcBlocked(m, x0 + x, y0 + y)) continue;
      P.open[y * n + x] = 1;
      if (x < 5 || y < 5 || x >= n - 5 || y >= n - 5) cut++;
    }
    const size = keepLargest(P);
    if (size < (boss ? 380 : 700)) continue;
    let roomyN = 0;
    for (let y = 3; y < n - 3; y++) for (let x = 3; x < n - 3; x++) if (roomy(P, x, y, 1)) roomyN++;
    if (roomyN < (boss ? 120 : 260)) continue;
    const d = bfs(P, ...firstRoomy(P)); let ecc = 0; for (let i = 0; i < d.length; i++) if (d[i] > ecc) ecc = d[i];
    if (ecc < (boss ? 22 : 44)) continue;
    const score = cut * 3 - Math.min(size, 1500) * 0.02 - Math.min(ecc, 90) + rng() * 60;       // el azar evita que todas las semillas den la misma ventana
    found.push({ score, P, m, x0, y0, mi });
    if (found.length >= 14) break;
  }
  found.sort((a, b) => a.score - b.score);
  const best = found.length ? found[Math.floor(rng() * Math.min(5, found.length))] : null;
  return best;
}
const firstRoomy = P => { for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (roomy(P, x, y, 1)) return [x, y]; return [P.w >> 1, P.h >> 1]; };

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
  let theme = PAL.themes[stageTheme(level)] ? stageTheme(level) : "cueva";
  let win = pickWindow(rng, w, boss, theme);
  if (!win && theme !== "cueva") { theme = "cueva"; win = pickWindow(rng, w, boss, theme); }
  if (!win) throw new Error("No hay ventana válida en los mapas originales");
  const { P, m: src, x0, y0 } = win;
  const TH = PAL.themes[theme] || PAL.themes.cueva;
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (roomy(P, x, y, 1)) cells.push([x, y]);
  const open3 = cells.filter(([x, y]) => roomy(P, x, y, 3)), spots = open3.length > 30 ? open3 : cells;      // la puerta es alta: lejos de las paredes
  // inicio: la esquina más cercana al origen (jefes: la parte baja); meta: lo más lejos posible por el camino
  let sp = boss ? spots.reduce((a, c) => (c[1] - c[0] * .01 > a[1] - a[0] * .01 ? c : a), spots[0]) : spots.reduce((a, c) => (c[0] + c[1] < a[0] + a[1] ? c : a), spots[0]);
  let dist = bfs(P, sp[0], sp[1]);
  for (let i = 0; i < P.open.length; i++) if (P.open[i] && dist[i] < 0) P.open[i] = 0;
  let fin = sp, far = -1;
  for (const [x, y] of spots) { const d = dist[y * w + x]; if (d > far) { far = d; fin = [x, y]; } }
  const last = level >= DUNGEON_LEVELS;
  const portals = [
    { id: "return", x: sp[0], y: sp[1], label: "Salir de la cripta", target: "origin" },
    last ? { id: "finish", x: fin[0], y: fin[1], label: "Salida de la cripta · ¡victoria!", target: "origin", locked: true }
      : { id: "down", x: fin[0], y: fin[1], label: "Bajar al nivel " + (level + 1), target: "down", locked: true },
  ];

  // ---- teselas
  const bytes = new Uint8Array(w * h * 10), dv = new DataView(bytes.buffer);
  const floorT = TH.floor[Math.floor(rng() * Math.min(3, TH.floor.length))];
  const deepAt = () => TH.dark[0];         // el agua de middled1n se dibuja con hojas animadas: no se reutiliza
  const blockedAt = (x, y) => !P.at(x, y);
  // decorado suelto: obstáculos aislados sobre suelo despejado, lejos de portales
  const decor = new Map();                                                    // los obstáculos sueltos ya vienen en las ventanas del original
  const chosen = new Int16Array(w * h).fill(-1);
  const maskOf = (blk, x, y) => { let m = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) m = m * 2 + (blk(x + dx, y + dy) ? 1 : 0); return m; };
  const srcBlk = (x, y) => srcBlocked(src, x0 + x, y0 + y);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const m = maskOf(blockedAt, x, y), o = (y * w + x) * 10, self = blockedAt(x, y);
    let spr, frame, obj = 0, of = 0;
    if (m === maskOf(srcBlk, x, y) && !self === !srcBlk(x, y)) {            // igual que en el original: se copia su tesela tal cual
      [spr, frame, obj, of] = PAL.srcTiles[src.cells[(y0 + y) * src.w + x0 + x]];
    } else if (m === (1 << 25) - 1) { const t = deepAt(x, y); spr = t[0]; frame = texFrame(t, x, y); }
    else if (m === 0) { spr = floorT[0]; frame = texFrame(floorT, x, y); }
    else { const ti = pickEdge(edgeCandidates(TH, m), x > 0 ? chosen[y * w + x - 1] : -1, y > 0 ? chosen[(y - 1) * w + x] : -1); chosen[y * w + x] = ti; [spr, frame, obj, of] = PAL.tiles[ti]; }
    dv.setInt16(o, spr, true); dv.setInt16(o + 2, frame, true); dv.setInt16(o + 4, obj, true); dv.setInt16(o + 6, of, true);
    bytes[o + 8] = self ? 0x80 : 0;
  }
  const grid = new Grid(w, h, bytes);

  // ---- enemigos
  const spawns = [];
  const scale = { hp: 1 + .22 * (level - 1), dmg: 1 + .1 * (level - 1), exp: 1 + .15 * (level - 1) };
  const minD = d => cells.filter(([x, y]) => dist[y * w + x] >= d && Math.max(Math.abs(x - fin[0]), Math.abs(y - fin[1])) > 3).length;
  const dmin = boss ? 8 : minD(14) >= 40 ? 14 : 6;
  const free = cells.filter(([x, y]) => dist[y * w + x] >= dmin && roomy(P, x, y, 1) && !decor.has(y * w + x) && Math.max(Math.abs(x - fin[0]), Math.abs(y - fin[1])) > 3);
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
    let bc = fin, bdiff = 1e9;                                       // el jefe espera a tres cuartos del camino, antes de la salida
    for (const [x, y] of cells) { const d = Math.abs(dist[y * w + x] - far * .75); if (d < bdiff && roomy(P, x, y, 1)) { bdiff = d; bc = [x, y]; } }
    spawns.push({ id: id++, name: "Skeleton", max: 1, rect: [bc[0], bc[1], bc[0], bc[1]], respawn: false, boss: bossTier, scale: { hp: scale.hp * (6 + 2 * bossTier), dmg: scale.dmg * (1.6 + .2 * bossTier), exp: scale.exp * (8 + 3 * bossTier) } });
  }
  return {
    grid, start: sp, portals, spawns, seed: seed >>> 0, level, theme, boss: bossTier, version: DUNGEON_VERSION,
    name: boss ? "Cámara del " + BOSS_NAMES[bossTier].toLowerCase() : "Cuevas del osario",
  };
}
