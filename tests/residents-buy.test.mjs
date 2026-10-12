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
a.report = (...x) => {}; 
const run = (ms, f) => { for (let i = 0; i < ms / 50; i++) { a.tick(50); if (f?.()) return true; } return false; };
// Un habitante con oro viaja a la tienda y compra en el puesto de otro lo que le mejora el equipo.
a.spawnResident("Aldric"); a.spawnResident("Brenna");
const [s1, buyer] = ["Aldric", "Brenna"].map(n => a.residents().find(x => x.name === n));const home = a.farm;
buyer.gold = 20000; buyer.bag.length = 0; home.recalc(buyer); buyer.hp = buyer.maxHp;
const pick = Object.entries(json("items.json")).find(([id, d]) => d.type === ITYPE.EQUIP && (d.price || 0) > 50 && Inv.canCarry(buyer, data, d, 1) && judge(home, buyer, newInst(home, +id, 1), []).act === "equip");
assert.ok(pick, "hay un objeto que mejora el equipo del comprador");
Inv.addToBag(s1, data, newInst(home, +pick[0], 1));
const tp = (a.maps.arefarm.meta.teleports || []).find(t => t.map === "gshop_1f"); assert.ok(tp);
const sw = a.worldFor(s1.id); const shop = a.staticWorld ? a.staticWorld("gshop_1f") : null;
a.transfer(s1, sw, shop, shop.freeSpotNear(62, 50) || [62, 50]);
assert.ok(a.command(s1.id, { t: "stallopen", title: "Ocasion", items: [{ uid: s1.bag.find(i => i.id === +pick[0]).uid, price: 100, count: 1 }] }), "el vendedor abre el puesto");
s1.res._stall = { until: a.time + 5000, done: true, back: a.time + 1 };
buyer.res._buyAt = 1; buyer.res._stallAt = 1e12; buyer.res._petAt = 1e12; buyer.res._gatherAt = 1e12;


assert.ok(run(240000, () => a.stallDb.find(x => x.owner === "aldric").items.length === 0 && buyer.gold < 20000), "el comprador adquiere el objeto; registro: " + buyer.bot.log.filter(l => /tienda|puesto|Cambio/.test(l)).join(" | ") + " map=" + a.worldFor(buyer.id).map.id + " st=" + JSON.stringify(buyer.res._stall));
console.log("OK residents-buy");
