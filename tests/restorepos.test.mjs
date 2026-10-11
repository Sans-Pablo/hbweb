// Al volver a entrar, el jugador reaparece donde cerró sesión (mapa fijo).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { seededRandom } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
const maps = {};
for (const id of ["arefarm", "2ndmiddle"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const mk = () => new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(3) });
const a = mk(), id = a.addPlayer("Ana", null, { gender: 1, stats: { str: 20, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } });
const p = a.farm.ents.get(id), pl = a.staticWorld("2ndmiddle");
a.transfer(p, a.farm, pl, [100, 100]);
const s = a.saveOf(id); assert.equal(s.pos.map, "2ndmiddle");
const b = mk(), id2 = b.addPlayer("Ana", JSON.parse(JSON.stringify(s)));
assert.equal(b.worldFor(id2).map.id, "2ndmiddle", "reaparece en el mapa donde salió");
const q = b.worldFor(id2).ents.get(id2); assert.ok(Math.abs(q.x - s.pos.x) <= 3 && Math.abs(q.y - s.pos.y) <= 3, "y cerca de su casilla");
console.log("OK restorepos");
