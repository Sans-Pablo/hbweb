// Carga bajo demanda: qué recursos pide cada mapa y que no se baja lo que no hace falta.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { bundleOfWorld, coreKeys, tileKeysOfGrid, isTileKey, mobPrefixes } from "../web/src/client/bundles.js";
import { Streamer } from "../web/src/client/streaming.js";

const root = new URL("../web/data/", import.meta.url);
const J = f => JSON.parse(readFileSync(new URL(f, root)));
const manifest = J("sprites.json"), npcDb = J("npc.json");
const fake = (id, meta, kind = "static") => {
  const mm = J("maps/" + id + ".json");
  const grid = new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", root))));
  return { grid, generators: [], ents: new Map(), meta: meta || mm, map: { id, kind } };
};

// núcleo: sin losetas ni hojas de monstruo
const core = coreKeys(manifest, npcDb), mobs = mobPrefixes(npcDb);
assert.ok(core.length > 0 && core.every(k => !isTileKey(k)));
assert.ok(!core.some(k => /^wyvern\d+$/.test(k) || /^abaddon/.test(k) || /^ske\d+$/.test(k)));
const total = Object.keys(manifest).length;
assert.ok(core.length < total / 5, "el núcleo debe ser una fracción pequeña: " + core.length + "/" + total);

// ciudad: losetas propias, sin dragones
const ares = bundleOfWorld(fake("aresden"), manifest, npcDb);
assert.ok(ares.tiles.length > 5 && ares.tiles.every(isTileKey));
assert.ok(ares.mobs.length < 200, "ciudad: " + ares.mobs.length);
assert.ok(!ares.mobs.some(k => /^(wyvern|firewyvern|demon)\d+$/.test(k)));

// campo de nivel alto: sí lleva sus monstruos y sonidos; la ciudad no
const mid = fake("middleland");
const names = new Set((mid.meta.spawns || []).map(s => s.name));
const midB = bundleOfWorld(mid, manifest, npcDb);
for (const n of names) if (npcDb[n]) assert.ok(midB.mobs.includes(npcDb[n].sprite + "0") || midB.mobs.some(k => k.startsWith(npcDb[n].sprite)), n);
assert.ok(midB.sounds.length > 0);
assert.ok(!ares.sounds.some(s => midB.sounds.includes(s) && !names.size));

// el conjunto de un mapa no es todo el juego
const tiles = new Set([...ares.tiles, ...midB.tiles]);
assert.ok(ares.tiles.length < Object.keys(manifest).filter(isTileKey).length);
assert.ok(tileKeysOfGrid(mid.grid) === tileKeysOfGrid(mid.grid), "se cachea por rejilla");

// criptas: activos fijos
const crypt = bundleOfWorld({ grid: { procedural: true }, generators: [], ents: new Map(), map: { id: "x", kind: "dungeon" } }, manifest, npcDb);
assert.ok(crypt.tiles.length >= 4 && crypt.mobs.filter(k => /^ske/.test(k)).length === 40);

// cola: prioridad, sin duplicados, máximo simultáneo
const started = [];
const spr = { m: { a: 1, b: 1, c: 1, d: 1 }, hd: false, hdm: {}, has: k => k in spr.m, ready: () => false,
  img: new Proxy({}, { get: (_, k) => { started.push(k); return { complete: false, addEventListener: (ev, cb) => { if (ev === "load") setTimeout(cb, 5); } }; } }) };
const st = new Streamer(spr, { max: 1 });
const pa = st.want("a", 0); st.want("b", 0); const pc = st.want("c", 2); st.want("c", 2);
await Promise.all([pa, pc, st.want("d", 1)]);
assert.deepEqual(started, ["a", "c", "d", "b"], "orden por prioridad, c una sola vez: " + started);
console.log("OK");
