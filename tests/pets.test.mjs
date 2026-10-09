// Hospital de compañeros, modo paz/ataque, Ctrl+Q (objetivo), compañero caído y manuales de habilidad.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { followersOf, spawnFrom } from "../web/src/shared/systems/npcsys.js";
import { spawnCitizen } from "../web/src/shared/systems/citizens.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import * as C from "../web/src/shared/systems/companion.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Cazador", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } });
const p = w.ents.get(id); p.level = 30; w.recalc(p);
const evs = t => w.events.filter(e => e.t === t);

// manual de habilidad (HGServer: STUDYSKILL): da la habilidad a su nivel inicial y se gasta; si ya se tiene, no
const man = newInst(w, data.named("ArcheryManual").id);
p.bag.push(man);
assert.ok(!p.skills[6]);
assert.equal(w.command(id, { t: "use", uid: man.uid }), true);
assert.equal(p.skills[6], 20); assert.ok(!p.bag.some(i => i.uid === man.uid), "manual gastado");
assert.equal(evs("skilllearn").length, 1);
const man2 = newInst(w, data.named("ArcheryManual").id); p.bag.push(man2);
assert.equal(w.command(id, { t: "use", uid: man2.uid }), false); assert.ok(p.bag.some(i => i.uid === man2.uid), "no se gasta si ya se conoce");

// hospital: comprar bola por 1 de oro
const nurse = spawnCitizen(w, C.HOSPITAL.npc, p.x + 2, p.y, C.HOSPITAL.role);
assert.ok(nurse && nurse.role === C.HOSPITAL.role);
p.gold = 3;
assert.equal(w.command(id, { t: "petbuy", npc: nurse.id, sp: "Slime" }), true);
assert.equal(p.gold, 2);
const ball = p.bag.find(i => i.comp && i.comp.sp === "Slime");
assert.ok(ball && ball.comp.nm && ball.comp.mode === "attack");
assert.equal(w.command(id, { t: "petbuy", npc: nurse.id, sp: "Dragon" }), false);

// invocar, caer y quedar inconsciente: no se puede invocar hasta revivirlo (caro)
w.command(id, { t: "use", uid: ball.uid });
assert.equal(followersOf(w, p).filter(e => e.comp).length, 1);
const pet = followersOf(w, p).find(e => e.comp);
const orc = spawnFrom(w, { name: "Orc", rect: [p.x + 1, p.y, p.x + 1, p.y], alive: 0, max: 0, respawn: false });
pet.hp = 1; orc.dmgBoost = 1; orc.target = pet.id;
for (let i = 0; i < 400 && !ball.comp.down; i++) w.tick(100);
assert.ok(ball.comp.down && !ball.comp.on, "queda inconsciente");
w.command(id, { t: "use", uid: ball.uid });
assert.equal(followersOf(w, p).filter(e => e.comp).length, 0, "no se puede invocar caído");
const cost = C.reviveCost(ball.comp);
assert.ok(cost >= 1500, "revivir es caro: " + cost);
assert.equal(w.command(id, { t: "petheal", npc: nurse.id, uid: ball.uid }), false);        // sin oro
assert.ok(evs("nogold").length >= 1);
p.gold = cost + 5;
assert.equal(w.command(id, { t: "petheal", npc: nurse.id, uid: ball.uid }), true);
assert.equal(p.gold, 5); assert.ok(!ball.comp.down);
w.command(id, { t: "use", uid: ball.uid });
assert.equal(followersOf(w, p).filter(e => e.comp).length, 1, "revivido, se puede invocar");
// lejos de la enfermera no funciona
p.x += 20; ball.comp.down = true; p.gold = 10 ** 6;
assert.equal(w.command(id, { t: "petheal", npc: nurse.id, uid: ball.uid }), false); p.x -= 20;
ball.comp.down = false;

// modo paz: solo sigue; Ctrl+Q marca un objetivo y lo ataca aunque esté en paz
const pet2 = followersOf(w, p).find(e => e.comp) || (w.command(id, { t: "use", uid: ball.uid }), followersOf(w, p).find(e => e.comp));
for (const e of [...w.ents.values()]) if (e.kind === "npc" && !e.master && !e.dead) { e.dead = true; w.grid.release(e.x, e.y, e.id); w.ents.delete(e.id); }
w.command(id, { t: "petmode", mode: "peace" });
assert.equal(ball.comp.mode, "peace");
const foe = spawnFrom(w, { name: "Slime", rect: [p.x + 3, p.y + 1, p.x + 3, p.y + 1], alive: 0, max: 0, respawn: false });
foe.cfg = { ...foe.cfg, actionLimit: 0 }; foe.target = null; foe.nextAct = w.time + 1e9;      // inmóvil: se mide solo al compañero
const hp0 = foe.hp;
for (let i = 0; i < 40; i++) w.tick(100);
assert.equal(foe.hp, hp0, "en paz no ataca");
assert.equal(w.command(id, { t: "pettarget", target: foe.id }), true);
assert.equal(pet2.cTarget, foe.id);
for (let i = 0; i < 80 && !foe.dead; i++) w.tick(100);
assert.ok(foe.dead || foe.hp < hp0, "con objetivo marcado ataca");
assert.equal(w.command(id, { t: "pettarget", target: 99999 }), false);
w.command(id, { t: "petmode", mode: "attack" }); assert.equal(ball.comp.mode, "attack");
console.log("OK");
