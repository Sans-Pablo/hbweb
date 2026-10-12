// Los magos de apoyo (Healer/Buffer/Aura) llegan a invocar un summon de apoyo (0.78.0: antes la bola de la misión o la de escuela lo impedían y no se les veía invocar apoyo).
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
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n", "gshop_1f"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(33) });
a.report = () => {};
const run = (ms, f) => { for (let i = 0; i < ms / 50; i++) { a.tick(50); if (f?.()) return true; } return false; };
import { errands } from "../web/src/shared/systems/bot.js";
for (const n of ["Petra","Lyra","Olga","Yara"]) a.spawnResident(n);
const sup = ["Petra","Lyra","Olga","Yara"].map(n => a.residents().find(x => x.name === n));
for (const s of sup) { s.level = 30; s.gold = 8000; s.hp = s.maxHp; s.res._petAt = 1; }
import * as Tal from "../web/src/shared/systems/talents.js";
const seen = new Set();
for (let m = 1; m <= 12; m++) { run(60000); for (const s of sup) if (s.bag.some(i => i.comp?.on && Tal.CLS_OF[i.comp.sp])) seen.add(s.name); }
assert.ok(seen.size >= 2, "al menos dos magos de apoyo invocan un summon de apoyo (vistos: " + [...seen] + ")");
console.log("OK support-summon", [...seen].join(","));
