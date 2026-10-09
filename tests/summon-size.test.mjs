// Compañeros: tamaño por etapas (niveles 10/25/40/50), aviso y re-invocación con efecto al cruzar un nivel de cambio.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { followersOf } from "../web/src/shared/systems/npcsys.js";
import * as C from "../web/src/shared/systems/companion.js";
import { spawnCitizen } from "../web/src/shared/systems/citizens.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Cazador", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } });
const p = w.ents.get(id); p.level = 50; w.recalc(p);

assert.deepEqual(C.SIZE_STAGES, [10, 25, 40, 50]);
assert.deepEqual([1, 9, 10, 24, 25, 39, 40, 49, 50].map(C.sizeStep), [0, 0, 1, 1, 2, 2, 3, 3, 4]);

const nurse = spawnCitizen(w, C.HOSPITAL.npc, p.x + 2, p.y, C.HOSPITAL.role);
p.gold = 100; w.command(id, { t: "petbuy", npc: nurse.id, sp: "Giant-Ant" });
const ball = p.bag.find(i => i.comp);
ball.comp.lvl = 8; ball.comp.exp = 0;
w.command(id, { t: "use", uid: ball.uid });
const first = followersOf(w, p).find(e => e.comp); assert.ok(first);
const ev = () => w.events.slice();

// niveles sin cambio de tamaño: no hay evolución
w.events.length = 0;
C.addExp(w, p, ball, C.need(8));                         // 8 -> 9
assert.equal(ball.comp.lvl, 9); assert.ok(!ball.comp.evolve);
assert.ok(!ev().some(e => e.t === "companion-evolve"));

// nivel 10: aviso inmediato y re-invocación pasado un momento
w.events.length = 0;
C.addExp(w, p, ball, C.need(9));                         // 9 -> 10
assert.equal(ball.comp.lvl, 10);
const evo = ev().find(e => e.t === "companion-evolve");
assert.ok(evo && evo.step === 1 && evo.lvl === 10 && evo.id === id, "aviso de cambio de tamaño");
assert.ok(ball.comp.evolve);
let resummon = null;
for (let i = 0; i < 80 && !resummon; i++) { w.tick(100); resummon = w.events.find(e => e.t === "companion-resummon"); }
assert.ok(resummon, "se vuelve a invocar");
assert.ok(!ball.comp.evolve, "la marca se limpia");
const now = followersOf(w, p).filter(e => e.comp);
assert.equal(now.length, 1, "un solo compañero");
assert.equal(now[0].id, resummon.nid); assert.notEqual(now[0].id, first.id, "es una entidad nueva");
assert.equal(now[0].clvl, 10); assert.ok(now[0].hp > 0);
assert.ok(resummon.fx !== undefined && resummon.x !== undefined, "trae las posiciones para el efecto");

// guardado en la bola, sin el compañero fuera: no se re-invoca solo
w.command(id, { t: "use", uid: ball.uid });             // lo guarda
assert.equal(followersOf(w, p).filter(e => e.comp).length, 0);
w.events.length = 0;
C.addExp(w, p, ball, C.need(10) * 20);                   // sube hasta el nivel 25 como mínimo
for (let i = 0; i < 50; i++) w.tick(100);
assert.ok(!w.events.some(e => e.t === "companion-resummon"), "guardado: no hay re-invocación");
w.command(id, { t: "use", uid: ball.uid });             // al invocarlo ya sale con el tamaño nuevo y sin marca pendiente
assert.ok(!ball.comp.evolve);
console.log("OK summon-size");
