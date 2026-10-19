// Mago de apoyo: un estudioso del grupo de apoyo compra una varita mágica, se la equipa y no la vende (la exige el summon Healer/Buffer/Aura).
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
import * as Inv from "../web/src/shared/inventory.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import { errands, isSupport } from "../web/src/shared/systems/bot.js";
let b, w = a.farm;
for (const nm of ["Aldric", "Brenna", "Cael", "Dorna", "Edric", "Fenna"]) { a.spawnResident(nm); const c = a.residents().find(x => x.name === nm); c.res.arch = "scholar"; if (isSupport(c)) { b = c; break; } }
assert.ok(b, "algún mago es de apoyo");
b.res.resetV = 5; b.res.mageV = 1; b.res.build = "mage"; b.level = 30; b.gold = 4000; b.hp = b.maxHp;
b.res._petAt = 1e12; b.res._gatherAt = 1e12; b.res._stallAt = 1e12; b.res._lzAt = 1e12;
for (let k = 0; k < 6; k++) errands(w, b, b.bot, k === 0);
w.recalc(b);
console.log("wtype", b.eff?.wtype, "gold", b.gold, "log", b.bot.log.slice(-4));
assert.ok(b.eff.wtype >= 34 && b.eff.wtype < 40, "se equipa una varita mágica");
run(60000);
assert.ok(b.eff.wtype >= 34 && b.eff.wtype < 40, "no vende ni cambia la varita");
console.log("OK support-bot");
