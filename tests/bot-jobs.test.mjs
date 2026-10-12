// Oficios fijos de los habitantes (0.76.0): 2 granjeros, 2 pescadores y 4 de apoyo (2 por bando) que buscan grupo.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { RESIDENT_NAMES } from "../web/src/shared/systems/residents.js";
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
import { JOBS } from "../web/src/shared/systems/residents.js";
import { isSupport } from "../web/src/shared/systems/bot.js";
const count = j => Object.values(JOBS).filter(x => x === j).length;
assert.equal(count("farmer"), 2); assert.equal(count("fisher"), 2); assert.equal(count("support"), 4);
const bySide = { 1: 0, 2: 0 };
for (const n of Object.keys(JOBS)) if (JOBS[n] === "support") bySide[RESIDENT_NAMES.indexOf(n) >= 20 ? 2 : 1]++;
assert.deepEqual(bySide, { 1: 2, 2: 2 }, "2 de apoyo por bando");
for (const n of Object.keys(JOBS)) a.spawnResident(n);
a.spawnResident("Aldric"); a.spawnResident("Brenna");
const get = n => a.residents().find(x => x.name === n);
for (const n of Object.keys(JOBS)) assert.equal(get(n).res.job, JOBS[n], n + " tiene su oficio");
assert.equal(get("Helga").bot.farmer, true, "granjero fijo");
assert.equal(get("Ivo").bot.farmer, false);
assert.ok(isSupport(get("Petra")), "apoyo fijo");
assert.equal(get("Aldric").res.job, null);
// el pescador pesca casi sin parar
const F = get("Ivo"); F.hp = F.maxHp; F.gold = 500; F.res._lzAt = 1; F.res._petAt = F.res._gatherAt = F.res._stallAt = 1e12;
assert.ok(run(30000, () => F.res._leis?.kind === "fish"), "el pescador empieza a pescar enseguida; log: " + F.bot.log.slice(-5).join(" | "));
// el de apoyo busca grupo con un compañero de su bando
const P = get("Petra"), L = get("Aldric"); L.level = Math.max(L.level, 10);
assert.ok(run(120000, () => P.bot.owner != null || P.res.followUntil), "el de apoyo se une a un grupo; log: " + P.bot.log.slice(-5).join(" | "));
console.log("OK bot-jobs");
