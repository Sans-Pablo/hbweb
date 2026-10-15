// Recall forzado: un jugador de otro bando que está en una granja ajena vuelve a la suya (HG.cpp ~1498, ForceRecall = 1).
// node tests/farm-recall.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(5) });
a.report = () => {};
const id = a.addPlayer("viajero"), p = a.farm.ents.get(id);
a.tick(50);
const ef = a.staticWorld("elvfarm");
a.transfer(p, a.farm, ef, ef.home);                    // forzamos estar en la granja de Elvine siendo de Aresden
assert.equal(a.worldFor(id), ef, "colocado en Elvfarm");
for (let i = 0; i < 40; i++) a.tick(50);
assert.equal(a.worldFor(id), a.farm, "recall forzado a Aresfarm");
p.gm = true; a.transfer(p, a.farm, ef, ef.home);
for (let i = 0; i < 40; i++) a.tick(50);
assert.equal(a.worldFor(id), ef, "el GM no es devuelto");
console.log("OK farm-recall");
