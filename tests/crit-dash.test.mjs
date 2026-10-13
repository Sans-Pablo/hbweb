// Crítico (Alt + clic) y dash (atacar corriendo). Cifras del original (combat.cpp, HG.cpp, Game.cpp): ver docs/sistemas/critico-dash.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { spawnFrom } from "../web/src/shared/systems/npcsys.js";
import { chargeCritTick, damagePlayer } from "../web/src/shared/systems/combatsys.js";
import { strikeNpc, critDashBonus, CRIT } from "../web/src/shared/combat.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Crit", null, { gender: 1, stats: { str: 60, vit: 30, dex: 30, int: 10, mag: 10, chr: 10 } });
const p = w.ents.get(id); p.level = 40; w.recalc(p); p.hp = p.maxHp; p.sp = p.maxSp || 100;
const put = (e, x, y) => { w.grid.release(e.x, e.y, e.id); e.x = e.fx = x; e.y = e.fy = y; w.grid.occupy(x, y, e.id); };
const tick = ms => { for (let i = 0; i < ms / 50; i++) w.tick(50); };
const spawn = (x, y) => { const n = spawnFrom(w, { name: "Slime", rect: [x, y, x, y], max: 1 }); n.hp = n.maxHp = 1e6; n.target = null; n.nextAct = w.time + 1e9; return n; };

// cargas: una cada 13 pasadas del reloj de 3 s y una cada 15 golpes recibidos; tope nivel/10
p.superAttack = 0; p.critCount = 0; p.critHits = 0; p.tCrit = w.time;
for (let i = 0; i < 12; i++) { p.tCrit -= 3000; chargeCritTick(w, p); }
assert.equal(p.superAttack, 0, "12 pasadas no bastan");
p.tCrit -= 3000; chargeCritTick(w, p); assert.equal(p.superAttack, 1, "a la 13.ª, una carga");
{ const src = { id: -1 }; for (let i = 0; i < 14; i++) damagePlayer(w, p, 1, src); assert.equal(p.superAttack, 1, "14 golpes no bastan"); damagePlayer(w, p, 1, src); assert.equal(p.superAttack, 2, "al 15.º, otra carga"); p.hp = p.maxHp; }
p.level = 25; p.superAttack = 2; p.critCount = 12; p.tCrit -= 3000; chargeCritTick(w, p); assert.equal(p.superAttack, 2, "tope nivel/10"); p.level = 40;

// bonos del original: nivel/100 + los de cada habilidad; el dash suma +20 de puntería y daño por habilidad
{
  const f = (skill, crit, dash, level = 50) => critDashBonus({ sm: 20, l: 20, hit: 0 }, level, skill, crit, dash);
  assert.deepEqual(f(7, true, false), { sm: 60, l: 60, hit: 100 }, "espada corta: (20+10)*2");
  assert.deepEqual(f(8, true, false), { sm: 33, l: 33, hit: 130 }, "espada larga: 30 + 3, +30 de puntería");
  assert.deepEqual(f(14, true, false), { sm: 36, l: 36, hit: 120 }, "martillo: 30 + 6");
  assert.deepEqual(f(21, true, false), { sm: 36, l: 36, hit: 150 }, "báculo");
  assert.deepEqual(f(8, false, true), { sm: 22, l: 22, hit: 20 }, "dash con espada larga: +10 %");
  assert.deepEqual(f(10, false, true), { sm: 24, l: 24, hit: 20 }, "dash con hacha: +20 %");
  assert.deepEqual(f(7, false, true), { sm: 20, l: 20, hit: 20 }, "dash con espada corta: solo puntería");
}

// maestría 100 requerida
{
  const n = spawn(21, 20); put(p, 20, 20); p.superAttack = 2; p.lastAttack = -1e9; p.busyUntil = 0;
  const sk = p.eff.wtype === 0 ? 5 : p.eff.skill; p.skills[sk] = 99;
  w.command(id, { t: "attack", target: n.id, crit: true });
  assert.equal(p.superAttack, 2, "sin maestría 100 no se gasta carga");
  tick(1500); p.skills[sk] = 100; p.lastAttack = -1e9; p.busyUntil = 0; p.superAttack = 2;
  w.command(id, { t: "attack", target: n.id, crit: true });
  assert.equal(p.superAttack, 1, "con maestría 100 sí");
  tick(1500); n.dead = true; w.grid.release(n.x, n.y, n.id); w.ents.delete(n.id);
}

// comando: sin carga el crit no se gasta ni se aplica; con carga gasta una
{
  p.skills[p.eff.wtype === 0 ? 5 : p.eff.skill] = 100;
  const n = spawn(21, 20); put(p, 20, 20); p.superAttack = 0; p.lastAttack = -1e9; p.busyUntil = 0;
  assert.ok(w.command(id, { t: "attack", target: n.id, crit: true }));
  assert.equal(p.superAttack, 0);
  tick(1500);
  const evs = w.events.length; p.superAttack = 2; p.lastAttack = -1e9; p.busyUntil = 0;
  assert.ok(w.command(id, { t: "attack", target: n.id, crit: true }));
  assert.equal(p.superAttack, 1, "el crítico gasta una carga");
  tick(1500);
  assert.ok(w.events.slice(evs).some(e => e.t === "crit" && e.crit), "evento crit");
  n.dead = true; w.grid.release(n.x, n.y, n.id); w.ents.delete(n.id);
}

// dash: a una casilla más allá del alcance, solo si se venía corriendo; avanza y golpea
{
  const n = spawn(30, 30); put(p, 28, 30); p.sp = 50; p.skills[p.eff.wtype === 0 ? 5 : p.eff.skill] = 100; p.lastAttack = -1e9; p.busyUntil = 0; p.lastRun = -1e9;
  p.busyUntil = 0;                                   // el original no exige haber corrido antes
  const sp0 = p.sp, evs = w.events.length;
  assert.ok(w.command(id, { t: "attack", target: n.id, dash: true }), "corriendo sí");
  tick(1500);
  assert.equal(p.x, 29, "avanza una casilla"); assert.ok(p.sp < sp0, "cuesta aliento");
  assert.ok(w.events.slice(evs).some(e => e.t === "crit" && e.dash), "evento dash");
  put(p, 28, 31); p.busyUntil = 0; p.lastAttack = -1e9; n.x = 30; n.y = 30; p.sp = 50;
  assert.ok(!w.command(id, { t: "attack", target: n.id, dash: true }), "salto de caballo: sin dash");
  put(p, 20, 40); p.lastRun = w.time; p.busyUntil = 0; p.lastAttack = -1e9;
  assert.ok(!w.command(id, { t: "attack", target: n.id, dash: true }), "más lejos no hay dash");
}
console.log("OK crit-dash");
