// Habitantes y summons: compran su compañero en el hospital (Aresden: tienda general; Elvine: Gail al aire libre), lo invocan, le dan talentos y avisan de fallos.
import * as BI from "../web/src/shared/systems/botitems.js";
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
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(5) });
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
import * as Inv from "../web/src/shared/inventory.js";
import { errands } from "../web/src/shared/systems/bot.js";
import { SKILL } from "../web/src/shared/skills.js";
a.spawnResident("Aldric");
const A = a.residents()[0], w = a.farm;
A.level = 30; A.gender = 1; A.stats.str = 60; A.stats.dex = 60;
for (const i of [...A.bag]) if (!Object.values(A.equip).includes(i.uid)) A.bag.splice(A.bag.indexOf(i), 1);
const d = data.named("LongSword"), inst = { uid: w.nextItem++, id: d.id, count: 1, life: 300 };
A.bag.push(inst); assert.ok(Inv.equip(A, data, inst.uid).ok, "espada puesta"); w.recalc(A);
A.skills[SKILL.LONG_SWORD] = 0; A.gold = 500;
assert.equal(A.eff.skill, SKILL.LONG_SWORD, "la espada larga usa Espada larga");
errands(w, A, A.bot);
assert.equal(A.skills[SKILL.LONG_SWORD], 100, "compra y estudia el manual de su arma");
assert.ok(A.gold < 500, "paga el manual");
assert.ok(!A.bag.some(i => i.id === data.named("LongSwordManual").id), "el manual se gasta al estudiarlo");
errands(w, A, A.bot); assert.equal(A.skills[SKILL.LONG_SWORD], 100, "sigue al 100");
// sin oro: no compra y no falla
A.skills[SKILL.LONG_SWORD] = 0; A.gold = 20; errands(w, A, A.bot);
assert.equal(A.skills[SKILL.LONG_SWORD], 0, "sin oro no hay manual");
console.log("OK bot-manuals");
