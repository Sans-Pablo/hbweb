// Habitantes y summons: compran su compañero en el hospital (Aresden: tienda general; Elvine: Gail al aire libre), lo invocan, le dan talentos y avisan de fallos.
import * as R from "../web/src/shared/systems/residents.js";
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
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(21) });
const reports = []; a.report = r => reports.push(r);
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
// Aprendizaje con el modelo: el habitante reflexiona, guarda la lección y aplica los ajustes (evitar / priorizar / prudencia).
a.spawnResident("Aldric");
const b = a.residents().find(x => x.name === "Aldric");
b.kinds = { Slime: 20, Scorpion: 3 }; b.res.qa.deaths.Orc = 2; b.level = 6;
const asks = [];
a.llm = async req => { asks.push(req.task); return req.task === "reflect" ? '{"lesson":"Los Orc me matan, debo subir de nivel antes.","avoid":["Orc","Dragon"],"focus":["Scorpion"],"caution":2}' : "ok"; };
for (let i = 0; i < 20 * 60 * 8 && !b.res.insights?.length; i++) { a.tick(50); if (i % 40 === 0) await new Promise(r => setImmediate(r)); }
assert.ok(asks.includes("reflect"), "pidió reflexión al modelo");
assert.ok(b.res.insights?.length, "guardó la lección");
assert.ok((b.res.dlv?.Orc || 0) >= b.res.insights[0].lv, "evita los Orc");
assert.ok(!("Dragon" in (b.res.dlv || {})), "ignora nombres que no conoce");
assert.ok(b.res.focus?.Scorpion > 0, "prioriza escorpiones");
assert.ok((b.res.scare | 0) >= 2, "más prudente");
assert.match(R.describe(b, "en"), /What I have learned/);
console.log("OK residents-learn");
