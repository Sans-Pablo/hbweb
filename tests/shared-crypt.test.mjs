// Criptas: pisos privados por party (sin intrusos) y pisos compartidos (≥15) entre bandos con PvP. node tests/shared-crypt.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { Adventure, SHARED_FROM } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { canFight } from "../web/src/shared/systems/combatsys.js";
import * as Party from "../web/src/shared/systems/party.js";

const dir = new URL("../web/data/", import.meta.url), json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const mj = json("maps/middled1n.json"), af = json("maps/arefarm.json"), e2 = json("maps/2ndmiddle.json");
const maps = { middled1n: { meta: mj, grid: new Grid(mj.w, mj.h, new Uint8Array(readFileSync(new URL("maps/middled1n.bin", dir)))) }, "2ndmiddle": { meta: e2, grid: new Grid(e2.w, e2.h, new Uint8Array(readFileSync(new URL("maps/2ndmiddle.bin", dir)))) } };
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(9) });
const mk = (name, side) => { const id = a.addPlayer(name); const p = a.worldFor(id).ents.get(id); p.side = side; p.level = 60; p.delve = { deepest: 15 }; p.quests = { ...(p.quests || {}), cls: "w", n: 20, t: [], u: { crypt: 20, trade: 1, staff: 1 } }; return p; };
const A1 = mk("A1", 1), A2 = mk("A2", 1), E1 = mk("E1", 2), E2 = mk("E2", 2);
const wOf = p => a.worldFor(p.id);
const party = (x, y) => { const w = wOf(x); assert.ok(Party.request(w, y, x.name, true)); assert.equal(x.party?.id, y.party?.id); };
party(A1, A2); party(E1, E2);

// 1) por debajo del 15 la cripta es privada: dos parties distintas no comparten piso
for (const p of [A1, E1]) assert.ok(a.debugTravel(p, wOf(p), { op: "crypt", level: 3 }));
assert.notEqual(wOf(A1), wOf(E1), "dos parties, dos criptas");
assert.equal(wOf(A1).pvp, undefined);
assert.ok(!canFight(wOf(A1), A1, A2));

// 2) un seguidor sin party entra en la cripta de su líder, no en una propia
const F = mk("F", 1); F.bot = { owner: A1.id };
F.delve = { deepest: 3 };
a.debugTravel(F, wOf(F), { op: "goto", map: "arefarm" });
{ const w = wOf(F); const g = { id: "mid-entry", x: F.x, y: F.y }; assert.ok(a.enterCrypt(F, w, g, { restart: false })); assert.equal(wOf(F), wOf(A1), "el seguidor está en la cripta del líder"); }

// 3) quien deja la party dentro de una cripta privada es expulsado
Party.leave(wOf(A2), A2, true);
for (let i = 0; i < 40; i++) a.tick(50);
assert.notEqual(wOf(A2).map.kind, "dungeon", "el que dejó la party sale de su cripta");

// 4) desde el 15 el piso es de todos: Aresden y Elvine en el mismo mundo, con PvP
assert.equal(SHARED_FROM, 15);
for (const p of [A1, E1, E2]) { a.debugTravel(p, wOf(p), { op: "goto", map: "arefarm" }); }
for (const p of [A1, E1]) assert.ok(a.debugTravel(p, wOf(p), { op: "crypt", level: 14 }));
const clear = (w, p) => { for (let i = 0; i < 12 && !w.cleared; i++) { for (const n of [...w.ents.values()]) if (n.kind === "npc" && !n.dead) w.killNpc(n, p); for (let k = 0; k < 400 && !w.cleared; k++) a.tick(50); } assert.ok(w.cleared, "piso despejado"); };
for (const p of [A1, E1]) clear(wOf(p), p);
// ambos bajan al 15
for (const p of [A1, E1]) { const w = wOf(p), g = w.map.portals.find(x => x.id === "down"); w.grid.release(p.x, p.y, p.id); p.x = p.fx = g.x; p.y = p.fy = g.y; w.grid.occupy(g.x, g.y, p.id); assert.ok(a.command(p.id, { t: "portal", portal: "down" })); }
const sh = wOf(A1);
assert.equal(wOf(E1), sh, "los dos bandos comparten el piso 15");
assert.ok(sh.pvp && sh.map.shared);
assert.ok(canFight(sh, A1, E1) && canFight(sh, E1, A1), "se pueden atacar");
assert.ok(!canFight(sh, A1, A1));

// 5) otra party enemiga entra al mismo mundo; bajar al 16 solo arrastra a tu party
a.debugTravel(E2, wOf(E2), { op: "crypt", level: 15 });
assert.equal(wOf(E2), sh);
assert.equal([...sh.ents.values()].filter(e => e.kind === "player").length, 3);
clear(sh, E1);
{ const g = sh.map.portals.find(x => x.id === "down"); sh.grid.release(E1.x, E1.y, E1.id); E1.x = E1.fx = g.x; E1.y = E1.fy = g.y; sh.grid.occupy(g.x, g.y, E1.id); assert.ok(a.command(E1.id, { t: "portal", portal: "down" })); }
assert.equal(wOf(E1).map.level, 16);
assert.equal(wOf(E2), wOf(E1), "su party baja con él");
assert.equal(wOf(A1), sh, "el rival se queda en el 15");
assert.ok(a.worlds.has(sh.map.id), "el piso sigue vivo mientras haya alguien");

// 6) la salida lleva a cada uno a su sitio y el piso vacío se descarta
for (const p of [A1]) { const g = wOf(p).map.portals.find(x => x.id === "up") || wOf(p).map.portals[0]; wOf(p).grid.release(p.x, p.y, p.id); p.x = p.fx = g.x; p.y = p.fy = g.y; wOf(p).grid.occupy(g.x, g.y, p.id); assert.ok(a.command(p.id, { t: "portal", portal: g.id })); }
assert.notEqual(wOf(A1).map.kind, "dungeon");
assert.ok(!a.worlds.has(sh.map.id) && !a.instances.has("S15"), "piso compartido vacío descartado");
console.log("OK shared-crypt");
