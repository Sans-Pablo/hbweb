// Artesanos (0.78.0): los granjeros y pescadores venden en un puesto lo que cosechan/pescan al precio de Item.cfg; otros bots con summon les compran la comida.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import * as Inv from "../web/src/shared/inventory.js";
import * as C from "../web/src/shared/systems/companion.js";
import { produceStock, foodWanted } from "../web/src/shared/systems/residents.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n", "wrhus_1f"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(33) });
a.report = () => {};
const run = (ms, f) => { for (let i = 0; i < ms / 50; i++) { a.tick(50); if (f?.()) return true; } return false; };
a.spawnResident("Helga"); a.spawnResident("Aldric");
const get = n => a.residents().find(x => x.name === n), H = get("Helga"), A = get("Aldric"), home = a.farm;
// el productor solo vende comida que cosechó (la que lleva), a precio de Item.cfg
for (const id of [829, 830]) Inv.addToBag(H, data, newInst(home, id, 4));
const st = produceStock(home, H);
assert.ok(st.length === 2 && st.every(r => r.price === Math.abs(data.item(r.i.id).price) && r.price >= 1), "precio del original");
H.hp = H.maxHp; H.res._stallAt = 1; H.res._petAt = H.res._gatherAt = 1e12;
const stallOf = () => a.stallDb.find(s => s.owner === "helga");
assert.ok(run(150000, () => !!stallOf()), "el granjero abre puesto; log: " + H.bot.log.slice(-5).join(" | "));
const s = stallOf(); assert.equal(s.map, "wrhus_1f"); assert.ok(s.items.length === 2 && s.items.every(r => !H.bag.some(i => i.uid === r.inst.uid)));
// un bot con summon que ama el champiñón (832) quiere esa fila y no la de otro
const ball = { uid: 9101, id: C.SPECIES["Amphis"][1], count: 1, comp: { sp: "Amphis", lvl: 12, exp: 0, on: true, nm: "Amphis", mode: "attack" } };
A.bag = A.bag.filter(i => !i.comp); A.bag.push(ball); A.gold = 5000;
const row = (id, count = 9, price = 20) => ({ inst: { id, count, uid: 1 }, price });
assert.ok(foodWanted(home, A, row(832)) > 0 && foodWanted(home, A, row(832)) <= 4, "compra hasta PER_ERRAND");
assert.equal(foodWanted(home, A, row(820)), 0, "no le gusta");
A.gold = 100; assert.equal(foodWanted(home, A, row(832)), 0, "respeta la reserva de oro");
assert.equal(foodWanted(home, H, row(832)), 0, "los artesanos no compran comida de summon");
console.log("OK craft-stall");
