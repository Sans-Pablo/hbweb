// Qué recursos hacen falta en cada mapa (carga bajo demanda). Sin DOM: se prueba desde Node.
// El original carga todo el .pak al arrancar; aquí un nivel 1 en la granja solo descarga las losetas del
// mapa y los monstruos que lo habitan (los dragones y demonios llegan al entrar en su mapa).
import { DUNGEON_ASSETS } from "../shared/dungeon.js";

const TILE_KEY = /^t\d+$/;
export const isTileKey = k => TILE_KEY.test(k);

// Prefijos de hoja usados por NPC.cfg (campo sprite): "slm", "wyvern"...
export function mobPrefixes(npcDb) {
  const s = new Set();
  for (const n of Object.values(npcDb)) if (n.sprite) s.add(n.sprite);
  return s;
}

// Hojas de un monstruo/ciudadano: <prefijo><número> (40 por monstruo, 24 los wyvern, 8 los NPC de ciudad)
export function sheetsOf(manifest, prefix, index) {
  let m = index.get(prefix);
  if (!m) {
    const re = new RegExp("^" + prefix + "\\d+$");
    m = Object.keys(manifest).filter(k => re.test(k));
    index.set(prefix, m);
  }
  return m;
}

// Todo lo que no son losetas ni monstruos: objetos del suelo, interfaz del mundo... (poco, 1 MB)
export function coreKeys(manifest, npcDb) {
  const mobs = mobPrefixes(npcDb), out = [];
  for (const k of Object.keys(manifest)) {
    if (isTileKey(k)) continue;
    const p = /^[a-z]+/i.exec(k)?.[0];
    if (mobs.has(p) && k.slice(p.length) !== "" && /^\d+$/.test(k.slice(p.length))) continue;
    out.push(k);
  }
  return out;
}

// Losetas y objetos que aparecen en un mapa (Client/MapData.cpp: sprite y objeto de cada casilla; los árboles, obj 100..149, añaden su sombra +50)
const tileCache = new WeakMap();
export function tileKeysOfGrid(grid) {
  if (tileCache.has(grid)) return tileCache.get(grid);
  const keys = new Set();
  {
    const seen = new Set(), n = grid.w * grid.h;
    for (let i = 0; i < n; i++) {
      const o = i * 10, spr = grid.dv.getInt16(o, true), obj = grid.dv.getInt16(o + 4, true);
      if (spr > 0) seen.add(spr);
      if (obj > 0) { seen.add(obj); if (obj >= 100 && obj < 150) seen.add(obj + 50); }
    }
    for (const s of seen) keys.add("t" + s);
  }
  tileCache.set(grid, keys);
  return keys;
}

// Nombres de monstruos/ciudadanos de un mundo: generadores, habitantes y lo que haya vivo ahora
export function mobNamesOf(world, meta) {
  const names = new Set();
  for (const g of world.generators || []) if (g.name) names.add(g.name);
  for (const s of meta?.spawns || []) if (s.name) names.add(s.name);
  for (const n of meta?.npcs || []) if (n.name) names.add(n.name);
  for (const e of world.ents.values()) if (e.kind !== "player" && e.name) names.add(e.name);
  return names;
}

// Recursos de un mundo: { tiles, mobs, sounds }
export function bundleOfWorld(world, manifest, npcDb, index = new Map()) {
  const tiles = [...tileKeysOfGrid(world.grid)].filter(k => manifest[k]);
  const mobs = [], sounds = new Set();
  if (world.map?.kind === "dungeon") for (const k of DUNGEON_ASSETS) if (manifest[k] && !isTileKey(k)) mobs.push(k);
  for (const name of mobNamesOf(world, world.meta)) {
    const cfg = npcDb[name];
    if (!cfg) continue;
    mobs.push(...sheetsOf(manifest, cfg.sprite, index));
    if (cfg.sound) for (let i = 0; i <= 3; i++) sounds.add("M" + (cfg.sound + i));   // M<n>: reposo, golpe, daño, muerte (HGServer/Game.cpp, sonidos de NPC)
  }
  if (world.map?.kind === "dungeon") sounds.add("M" + (npcDb.Skeleton?.sound ?? 0));
  return { tiles, mobs: [...new Set(mobs)], sounds: [...sounds] };
}

// Destinos de teleport de un mapa. Con `me`, solo los que están a menos de `near` casillas del jugador
// (precargar lo que se puede pisar a continuación, no todo el mapamundi).
export function destinations(meta, me = null, near = Infinity) {
  const out = new Set();
  for (const tp of meta?.teleports || []) {
    if (!tp.map) continue;
    if (me && Math.max(Math.abs(tp.x - me.x), Math.abs(tp.y - me.y)) > near) continue;
    out.add(tp.map.toLowerCase());
  }
  return [...out];
}
