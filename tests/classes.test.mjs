// Clases (guerrero/mago/invocador): atributos iniciales, guardado y varios summons a la vez según la carisma.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { followersOf } from "../web/src/shared/systems/npcsys.js";
import * as C from "../web/src/shared/systems/companion.js";
import { saveOf, sanitizeCreate, PRESETS } from "../web/src/shared/systems/player.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import * as Inv from "../web/src/shared/inventory.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });

assert.equal(sanitizeCreate({}).cls, "warrior"); assert.equal(sanitizeCreate({ cls: "x" }).cls, "warrior");
assert.equal(sanitizeCreate({ cls: "summoner" }).cls, "summoner");
for (const k in PRESETS) assert.ok(Object.values(PRESETS[k]).reduce((a, b) => a + b) <= 70 && Object.values(PRESETS[k]).every(v => v >= 10 && v <= 14), k);

const id = w.addPlayer("Invo", null, { cls: "summoner", gender: 1, stats: PRESETS.summoner });
const p = w.ents.get(id); p.level = 30; p.maxMp = p.mp = 1000; w.recalc(p); p.mp = p.maxMp;
assert.equal(p.cls, "summoner"); assert.equal(saveOf(w, id).cls, "summoner");
const w2 = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const q = w2.ents.get(w2.addPlayer("Viejo", { level: 1, exp: 0 }, null)); assert.equal(q.cls, "warrior", "partida antigua = guerrero");
const r = w2.ents.get(w2.addPlayer("Rest", saveOf(w, id), null)); assert.equal(r.cls, "summoner");

const ball = sp => { const b = newInst(w, C.SPECIES[sp][1]); b.comp = { sp, lvl: 5, exp: 0, on: false, nm: sp, mode: "attack" }; Inv.addToBag(p, w.data, b); return b; };
const out = () => followersOf(w, p).filter(e => e.comp).length;
const [a, b, c, d, a2] = ["Slime", "Giant-Ant", "Amphis", "Orc", "Slime"].map(ball);
const use = x => { p.mp = p.maxMp; w.command(id, { t: "use", uid: x.uid }); };
for (const [chr, max] of [[99, 1], [100, 2], [199, 2], [200, 3]]) { p.stats.chr = chr; assert.equal(C.maxSummons(p), max, "chr " + chr); }
p.stats.chr = 100;
use(a); use(b); assert.equal(out(), 2); assert.ok(a.comp.on && b.comp.on);
use(a2); assert.equal(out(), 2, "misma especie rechazada"); assert.ok(!a2.comp.on);
use(c); assert.equal(out(), 2, "el límite expulsa al más antiguo"); assert.ok(!a.comp.on && b.comp.on && c.comp.on);
p.stats.chr = 200; use(d); assert.equal(out(), 3);
use(b); assert.equal(out(), 2); assert.ok(!b.comp.on);
w.recalc(p);
p.cls = "warrior"; p.stats.chr = 200; assert.equal(C.maxSummons(p), 1);
console.log("OK");
