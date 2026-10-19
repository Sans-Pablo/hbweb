// Oficios fijos de los habitantes (0.76.0): 4 granjeros, 4 pescadores (2+2 por bando) y 4 de apoyo (2 por bando) que buscan grupo.
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
import * as Council from "../web/src/shared/systems/council.js";
a.spawnResident("Aldric");
const P = a.residents().find(x => x.name === "Aldric");
P.hp = P.maxHp;
// 1) con monstruos a su medida, la granja no está "seca"
const home = a.homeOf(P);
const was = Council.farmDry(a, P);
// 2) si todo es trivial para él, está seca y la caza pierde peso
P.level = 60; P.maxHp = P.hp = 5000; P.res._tripAt = P.res._tripAt || 0;
for (const e of [...home.ents.values()]) if (e.kind === "npc" && !e.dead && !e.master) { e.hp = 1; e.maxHp = 1; e.cfg = { ...e.cfg, hp: 1, level: 1 }; }
const dry = Council.farmDry(a, P);
const ev = Council.evaluate(a, P, { cryptNeed: () => 20 }, 1);
console.log("granja seca antes/después:", was, dry, "| hunt", ev.hunt.s.toFixed(2), "crypt", ev.crypt.s.toFixed(2), "pl", ev.pl.s.toFixed(2));
assert.equal(typeof dry, "boolean");
if (dry) assert.ok(ev.hunt.s <= Math.max(ev.crypt.s, ev.pl.s) + 5 || /trivial/.test(ev.hunt.why), "con la granja seca la caza no gana por goleada");
// 3) simulación corta: en qué gasta el tiempo (7,5 min de juego)
const T = {};
for (let i = 0; i < 9000; i++) { a.tick(50); const k = P.res?._leis?.kind || P.res?.trip?.kind || (P.map && P.map !== "arefarm" ? "viaje:" + P.map : "granja"); T[k] = (T[k] || 0) + 50; }
console.log("tiempo (ms) por actividad:", JSON.stringify(T));
console.log("dry:", P.res._dry, "tripAt-time:", P.res._tripAt - a.time, "log:", P.bot.log.slice(-4).join(" / "));
assert.ok(P.res._dry > 0, "se da cuenta de que la granja está seca y sale de expedición");
console.log("OK bot-obs46");
