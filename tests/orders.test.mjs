// Habitantes sociales: comercian (regalo, venta, compra) con jugadores y entre ellos, aceptan/piden grupo, se reúnen en la tienda, equipan por item level y aprenden de sus muertes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import * as Inv from "../web/src/shared/inventory.js";
import { itemLevel } from "../web/src/shared/itemlevel.js";

const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n", "gshop_1f"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(5) });
import { parse, mobOf } from "../web/src/shared/systems/orders.js";
// ---- glosario
assert.deepEqual(parse("vamos a matar slimes"), { kind: "hunt", mob: "Slime" });
assert.deepEqual(parse("Vamos a cazar golems de piedra"), { kind: "hunt", mob: "Stone-Golem" });
assert.deepEqual(parse("let's kill some orcs"), { kind: "hunt", mob: "Orc" });
assert.deepEqual(parse("vamos a hacer EK"), { kind: "ek" });
assert.equal(parse("vamos a matar a la mama de pedro").kind, "unsure");
assert.equal(parse("hola, qué tal"), null);
for (const v of Object.values({ ...(await import("../web/src/shared/systems/orders.js")).ALIAS })) assert.ok(npcDb[v], "el alias apunta a un NPC real: " + v);
// ---- el habitante obedece
const tickN = ms => { for (let i = 0; i < ms / 50; i++) { for (const r of a.residents()) { r.res.next = 0; r.bot.next = 0; } a.tick(50); } };
const w = a.farm; a.spawnResident("Aldric");
const A = a.residents().find(x => x.name === "Aldric");
const hid = a.addPlayer("Humano", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }), H = w.ents.get(hid);
H.x = A.x + 1; H.y = A.y; H.side = A.side; A.res.rel.Humano = 2;
const tickets = []; a.order = o => tickets.push(o);
const say = t => { w.drainEvents(); a.command(hid, { t: "say", text: t + " Aldric" }); tickN(4000); };
say("vamos a matar slimes");
assert.equal(A.bot.only, "Slime", "solo ataca slimes"); assert.equal(A.bot.owner, hid, "sigue al jugador");
say("vamos a hacer EK"); assert.equal(A.bot.only, "@ek");
say("vamos a matar a la mama de pedro"); assert.equal(tickets.length, 0, "primero pregunta");
say("no se"); assert.equal(tickets.length, 1, "no lo entiende: ticket"); assert.match(tickets[0].text, /mama de pedro/);
say("vamos a matar a la mama de pedro"); say("orcos"); assert.equal(A.bot.only, "Orc", "la aclaración se entiende"); assert.equal(tickets.length, 1);
console.log("OK orders");
