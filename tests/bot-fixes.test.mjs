// Arreglos de pulido de bots 0.79.3
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
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
a.spawnResident("Aldric"); a.spawnResident("Brenna");
const A = a.residents().find(x => x.name === "Aldric"), B = a.residents().find(x => x.name === "Brenna"), w = a.farm;
// Arquero sin flechas ni oro: no queda atascado; suelta el arco y sigue (0.79.3)
const B2 = a.residents().find(x => x.name === "Brenna");
const bow = data.named("ShortBow"), inst = { uid: w.nextItem++, id: bow.id, count: 1, life: bow.maxLife };
B2.level = 20; B2.gold = 0; B2.bag = B2.bag.filter(i => data.item(i.id)?.name !== "Arrow"); B2.bag.push(inst); B2.equip[8] = inst.uid; w.recalc(B2);
tick(120000);
const stuckSF = B2.bot?.stuck?.why === "sin flechas" && w.time - B2.bot.stuck.since > 30000;
assert.ok(!stuckSF, "el arquero sin flechas ni oro no se queda atascado");
console.log("bot-fixes OK");
