// Bots v0.85.76 (obs. 34, 37): carisma solo para futuros Guildmasters; compran todas las magias; invisibilidad para huir
import assert from "node:assert/strict";
import { EQUIP } from "../web/src/shared/items.js";
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
import { futureMaster, BOT_STATS } from "../web/src/shared/systems/bot.js";
import * as BM from "../web/src/shared/systems/botmagic.js";
a.spawnResident("Aldric");
const A = a.residents().find(x => x.name === "Aldric"), w = a.farm;
// 34: el carisma base es 10 y solo 1 de cada 5 nombres es futuro Guildmaster
assert.equal(BOT_STATS.chr, 10);
const names = Array.from({ length: 200 }, (_, i) => "Bot" + i), fm = names.filter(futureMaster).length;
assert.ok(fm > 15 && fm < 80, "proporción de futuros guildmasters: " + fm);
assert.equal(futureMaster("Bot3"), futureMaster("Bot3"));
// 37: la lista de estudio incluye todas las magias de Magic.cfg, sin repetir
const list = BM.studyList(w, A);
assert.equal(new Set(list).size, list.length);
for (const id of Object.keys(w.magic)) assert.ok(list.includes(+id), "magia " + id + " en la lista de estudio");
// 37: con Int y oro compra todo lo posible
A.stats.int = 200; A.gold = 5e7; A.level = 60;
const log = []; let n = 0; while (n++ < 200 && BM.study(w, A, A.bot, t => log.push(t)));
assert.ok(Object.keys(A.magic).length >= 20, "aprendió " + Object.keys(A.magic).length + " magias");
// 37: huir con Invisibility
A.mp = A.maxMp = 500; A.bot.cd = {}; A.lastCast = -1e9; A.bot.castAt = -1e9;
for (const s of [EQUIP.RHAND, EQUIP.LHAND, EQUIP.TWOHAND]) delete A.equip[s]; w.recalc(A);
let sent = null; const adv = { command: (id, c) => { sent = c; return true; } };
assert.ok(A.magic[32], "conoce Invisibility");
assert.equal(BM.escapeInvis(adv, w, A, A.bot), true);
assert.equal(sent?.spell, 32);
console.log("bot-obs34-37 OK");
