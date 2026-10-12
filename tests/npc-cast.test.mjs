// El Cíclope lanza Fire Ball / Fire Strike a distancia, gasta maná y no lo hace con melé ni fuera de alcance. node tests/npc-cast.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { spawnFrom, NPC_SPELLS } from "../web/src/shared/systems/npcsys.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: J("npc.json") });
const w = new World({ grid, npcDb: J("npc.json"), data, spawns: [], rng, start: [10, 10] });
const p = w.ents.get(w.addPlayer("T", null, { gender: 1, stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 } }));
p.x = 30; p.y = 30; p.hp = p.maxHp = 5000;
const n = spawnFrom(w, { name: "Cyclops", rect: [35, 30, 35, 30], max: 1, alive: 0 });
assert.ok(n, "cíclope"); assert.deepEqual(NPC_SPELLS.Cyclops, [20, 30]);
const seen = [];
const orig = w.emit.bind(w); w.emit = e => { if (e.t === "spell" && e.id === n.id) seen.push(e.spell); return orig(e); };
n.target = p.id;
for (let i = 0; i < 400; i++) { n.nextAct = 0; n.busyUntil = 0; n.x = 35; n.y = 30; w.tick(1300); }
assert.ok(seen.length >= 3, "lanzó hechizos: " + seen.length);
assert.ok(seen.every(s => s === 20 || s === 30));
assert.ok(p.hp < p.maxHp, "hirió al jugador");
assert.ok(n.mp < 450, "gastó maná");
const before = seen.length; n.x = 31; n.y = 30;                      // cuerpo a cuerpo (alcance 3): no lanza
for (let i = 0; i < 30; i++) { n.nextAct = 0; n.busyUntil = 0; n.x = 31; w.tick(1300); }
assert.equal(seen.length, before, "en melé no lanza");
console.log("OK npc-cast");
