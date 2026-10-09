// Summon Creature (Game.cpp ~18660): seguidor según Magery, límite magery/20, ataca monstruos, sin experiencia ni botín.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { summonFor, followersOf } from "../web/src/shared/systems/npcsys.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { MAGIC_MODE } from "../web/src/shared/magic.js";
MAGIC_MODE.player = true;   // estas pruebas ejercitan el sistema de hechizos del jugador (cerrado en el juego, ver talents.js)
MAGIC_MODE.free = false;
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(40, 40, new Uint8Array(40 * 40 * 10));
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const w = new World({ grid, npcDb, data: new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb }), spawns: [], rng, start: [10, 10] });
const p = w.makeEnt("player", 10, 10); Object.assign(p, { kind: "player", skills: { 4: 45 }, side: 0, hp: 50, maxHp: 50 });
w.grid.occupy(10, 10, p.id);
const a = summonFor(w, p, 0, false), b = summonFor(w, p, 0, false), c = summonFor(w, p, 0, false);
assert.ok(a && b && !c, "magery 45 -> 2 seguidores");
assert.equal(followersOf(w, p).length, 2); assert.equal(a.exp, 0); assert.ok(a.noDrop);
p.skills[4] = 5; assert.equal(summonFor(w, p, 0, false), null, "magery 5 -> ninguno");
assert.ok(summonFor(w, p, 0, true) === null, "ya hay 2, el modo libre solo garantiza uno");
console.log("OK");
