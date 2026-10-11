// Habitantes con puesto: con la mochila llena de equipo que no usan van a la tienda, montan un puesto, vuelven, y luego regresan a cobrar y cerrarlo.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import { judge, stallable } from "../web/src/shared/systems/botitems.js";
import { ITYPE } from "../web/src/shared/items.js";
import * as Inv from "../web/src/shared/inventory.js";
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
a.spawnResident("Aldric");
const b = a.residents().find(x => x.name === "Aldric"), home = a.farm;
// equipo que no puede usar (nivel muy alto) para llenar la mochila
const heavy = Object.entries(json("items.json")).filter(([id, d]) => d.type === ITYPE.EQUIP && d.price > 100 && stallable(judge(home, b, newInst(home, +id, 1), []))).slice(0, 24).map(([id]) => +id);
assert.ok(heavy.length >= 6, "hay equipo de nivel alto para el test");
for (const id of heavy) Inv.addToBag(b, data, newInst(home, id, 1));
b.hp = b.maxHp; b.res._stallAt = 1; b.res._petAt = 1e12; b.res._gatherAt = 1e12;
const stallOf = () => a.stallDb.find(s => s.owner === "aldric");
assert.ok(run(120000, () => !!stallOf()), "monta un puesto; registro: " + b.bot.log.slice(-6).join(" | "));
const s = stallOf(); assert.equal(s.map, "gshop_1f"); assert.ok(s.items.length >= 3 && s.items.every(r => r.price >= 1));
assert.ok(run(30000, () => a.worldFor(b.id) === home), "vuelve a la granja");
assert.ok(b.res._stall == null);
// alguien le compra y él vuelve a cobrar
s.gold = 500; b.res._stallAt = 1;
assert.ok(run(180000, () => s.gold === 0 && b.gold >= 500), "regresa a cobrar");
console.log("OK residents-stall");
