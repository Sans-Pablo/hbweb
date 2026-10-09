// Árbol de talentos del compañero (3 ramas), hechizos del compañero y jugador sin magia.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { followersOf, spawnFrom } from "../web/src/shared/systems/npcsys.js";
import { spawnCitizen } from "../web/src/shared/systems/citizens.js";
import * as C from "../web/src/shared/systems/companion.js";
import * as T from "../web/src/shared/systems/talents.js";
import { sget } from "../web/src/shared/systems/status.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Cazador", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } });
const p = w.ents.get(id); p.stats.str = 400; p.level = 50; w.recalc(p); p.hp = p.maxHp;
const evs = t => w.events.filter(e => e.t === t);

// el jugador ya no lanza hechizos
assert.equal(w.command(id, { t: "cast", spell: 1, x: p.x, y: p.y }), false);
assert.equal(w.command(id, { t: "learn", spell: 1 }), false);
assert.equal(w.command(id, { t: "prepare", spell: 1 }), false);

// compañero nivel 20: 19 puntos
const nurse = spawnCitizen(w, C.HOSPITAL.npc, p.x + 2, p.y, C.HOSPITAL.role); p.gold = 100000;
w.command(id, { t: "petbuy", npc: nurse.id, sp: "Orc" });
const ball = p.bag.find(i => i.comp), c = ball.comp; c.lvl = 20;
assert.equal(T.pointsFree(c), 19);
// requisitos de fila: sin puntos en la rama no se abre la fila 1
assert.equal(w.command(id, { t: "talent", uid: ball.uid, talent: "fireball" }), false);
for (let i = 0; i < 5; i++) assert.equal(w.command(id, { t: "talent", uid: ball.uid, talent: "might" }), true);
assert.equal(w.command(id, { t: "talent", uid: ball.uid, talent: "might" }), false, "máximo 5 rangos");
assert.equal(w.command(id, { t: "talent", uid: ball.uid, talent: "fireball" }), true);
assert.equal(w.command(id, { t: "talent", uid: ball.uid, talent: "heal" }), false, "otra rama: necesita 2 puntos en ella");
assert.equal(T.spec(c), "damage");
// estadísticas de clase: daño sube, vida baja respecto al tanque
const dmgSpec = C.statsOf(p, c);
const tank = { ...c, tal: { hide: 5, shield: 1 } }, sup = { ...c, tal: { mind: 5, heal: 1 } };
assert.ok(dmgSpec.dmg > C.statsOf(p, tank).dmg && C.statsOf(p, tank).hp > dmgSpec.hp, "tanque más vida, daño más daño");
assert.ok(T.maxMp(sup) > T.maxMp(c) && C.statsOf(p, sup).dmg < dmgSpec.dmg, "apoyo: más maná, menos daño");
// reiniciar cuesta oro y hay que estar en el hospital
const g0 = p.gold; assert.equal(w.command(id, { t: "talreset", uid: ball.uid, npc: nurse.id }), true);
assert.equal(p.gold, g0 - T.resetCost(c)); assert.equal(T.spentAll(c), 0);

// lanza Fire Ball a un monstruo
c.tal = { might: 2, fireball: 1 };
w.command(id, { t: "use", uid: ball.uid });
const pet = followersOf(w, p).find(e => e.comp);
const orc = spawnFrom(w, { name: "Orc", rect: [p.x + 5, p.y, p.x + 5, p.y], alive: 0, max: 0, respawn: false });
orc.maxHp = orc.hp = 100000;
for (let i = 0; i < 80; i++) w.tick(100);
assert.ok(evs("spell").some(e => e.id === pet.id && e.spell === 20), "el compañero lanza Fire Ball");
assert.ok(orc.hp < 100000 && pet.mp < T.maxMp(c), "gasta maná y hace daño");

// apoyo: cura al dueño y lo protege
c.tal = { mind: 2, heal: 1, ward: 1 }; c.tal.harmony = 0;
c.tal.mind = 2;
orc.hp = 0; w.killNpc(orc, null);
p.hp = Math.floor(p.maxHp * 0.3);
const orc2 = spawnFrom(w, { name: "Orc", rect: [p.x + 6, p.y, p.x + 6, p.y], alive: 0, max: 0, respawn: false });
orc2.maxHp = orc2.hp = 100000; pet.mp = T.maxMp(c);
w.events.length = 0;
for (let i = 0; i < 40; i++) w.tick(100);
assert.ok(evs("heal").some(e => e.id === p.id), "cura al dueño");
// tanque: se escuda y recibe menos daño
c.tal = { hide: 2, shield: 1, iron: 3 };
assert.ok(T.takenFactor(w, pet, c) < 0.9);
console.log("OK");
