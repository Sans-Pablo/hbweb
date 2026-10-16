// Compañeros: al aparecer emiten companion-spawn (brillos del recall, efecto 112 = Summon 131); la evolución usa solo companion-resummon.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { followersOf } from "../web/src/shared/systems/npcsys.js";
import * as C from "../web/src/shared/systems/companion.js";
import { spawnCitizen } from "../web/src/shared/systems/citizens.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Cazador", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } });
const p = w.ents.get(id); p.level = 50; w.recalc(p);

assert.deepEqual(C.SIZE_STAGES, [25, 50]);
assert.deepEqual([1, 10, 24, 25, 49, 50].map(C.sizeStep), [0, 0, 0, 1, 1, 2]);

const nurse = spawnCitizen(w, C.HOSPITAL.npc, p.x + 2, p.y, C.HOSPITAL.role);
p.gold = 100; w.command(id, { t: "petbuy", npc: nurse.id, sp: "Giant-Ant" });
const ball = p.bag.find(i => i.comp);
ball.comp.lvl = 23; ball.comp.exp = 0; p.mp = 9999;
w.events.length = 0;
w.command(id, { t: "use", uid: ball.uid });
const c = followersOf(w, p).find(e => e.comp); assert.ok(c);
const sp = w.events.filter(e => e.t === "companion-spawn");
assert.equal(sp.length, 1, "un aviso al aparecer");
assert.deepEqual([sp[0].id, sp[0].nid, sp[0].x, sp[0].y], [id, c.id, c.x, c.y]);

// evolución: solo el efecto de re-invocación, sin duplicar brillos
ball.comp.lvl = 24; ball.comp.exp = 1e9;
w.events.length = 0;
for (let i = 0; i < 200; i++) w.tick(100);
if (w.events.some(e => e.t === "companion-resummon")) assert.ok(!w.events.some(e => e.t === "companion-spawn"), "evolución sin spawn");
console.log("OK summon-spawn-fx");
