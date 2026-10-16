// Cárcel fiel: ApplyPKPenalty (Client.cpp:1184), bloqueo 180 s en la cárcel del bando (HG.cpp 11661-11810, 2323).
// node tests/jail.test.mjs
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
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "arejail", "elvjail"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(5) });
import * as PK from "../web/src/shared/systems/pk.js";
a.report = () => {};
const id = a.addPlayer("asesino"), p = a.farm.ents.get(id);
const vid = a.addPlayer("victima"), v = a.farm.ents.get(vid);
a.tick(50);
// matar a un inocente de tu bando dentro de tu ciudad (granja) -> cárcel de tu bando 180 s
PK.onPlayerKilled(a.farm, p, v);
assert.ok(p.jailUntil > a.time + 179000 && p.jailUntil <= a.time + 180000, "180 s de condena");
for (let i = 0; i < 40; i++) a.tick(50);
assert.equal(a.worldFor(id).map.id, "arejail", "teletransportado a arejail");
// recall / teletransporte mientras dura: de vuelta a la cárcel
a.recall(p, a.worldFor(id));
for (let i = 0; i < 40; i++) a.tick(50);
assert.equal(a.worldFor(id).map.id, "arejail", "el recall no libera");
// cumplida la condena ya se puede salir
p.jailUntil = a.time - 1;
a.recall(p, a.worldFor(id));
for (let i = 0; i < 40; i++) a.tick(50);
assert.equal(a.worldFor(id), a.farm, "libre al acabar");
// bando 2 -> elvjail; neutral no se encarcela
const e = a.staticWorld("elvfarm"); a.transfer(p, a.farm, e, e.home); p.side = 2; v.side = 2;
PK.onPlayerKilled(e, p, v); assert.ok(p.jailUntil > a.time);
for (let i = 0; i < 40; i++) a.tick(50);
assert.equal(a.worldFor(id).map.id, "elvjail", "bando 2 -> elvjail");
const n = { id: 99, side: 0, level: 30, exp: 5000, name: "n" }; PK.onPlayerKilled(a.farm, n, { id: 98, side: 0, level: 30, exp: 1, name: "m" });
assert.ok(!n.jailUntil, "el neutral no va a la cárcel");
// fuera de la ciudad propia (Promise Land) no hay cárcel
const q = { id: 97, side: 1, level: 30, exp: 5000, name: "q" }; PK.onPlayerKilled({ ...a.farm, map: { id: "2ndmiddle" }, rng: a.farm.rng, time: 0, emit() {} }, q, { id: 96, side: 1, level: 30, exp: 1, name: "r" });
assert.ok(!q.jailUntil, "fuera de tu ciudad no se encarcela");
console.log("OK jail");
