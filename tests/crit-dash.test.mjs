// Crítico (Alt + clic) y dash (atacar corriendo) — 0.78.0. Números de diseño (el Game.cpp original no estaba disponible): ver docs/sistemas/critico-dash.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { spawnFrom } from "../web/src/shared/systems/npcsys.js";
import { chargeCrit } from "../web/src/shared/systems/combatsys.js";
import { strikeNpc, CRIT } from "../web/src/shared/combat.js";
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

// la barra de crítico se carga con los golpes y da una carga de super ataque al llenarse (máx. nivel/10)
p.critBar = 0; p.superAttack = 0;
for (let i = 0; i < Math.ceil(CRIT.barFull / CRIT.barPerHit); i++) chargeCrit(p);
assert.equal(p.superAttack, 1, "la barra llena da una carga");
p.level = 5; p.superAttack = 1; p.critBar = 99; chargeCrit(p); assert.equal(p.superAttack, 1, "tope nivel/10 (mínimo 1)");

// el crítico ignora parte de la defensa y multiplica; el dash suma su bono
{
  
  const mkr = () => { let i = 0; return () => 0.001 + 0 * i++; };
  const pl = { stats: { str: 50, dex: 50 }, hunger: 100, sp: 50, skills: { 7: 40 }, combo: 0, eff: { wtype: 5, skill: 7, sm: [20, 5, 0], l: [20, 5, 0], hit: 40, addAR: 0, addPhys: 0, addCD: 0, armor: {} } };
  const nn = () => ({ cfg: { defenseRatio: 20, size: 1, actionLimit: 0 }, absDamage: 0 });
  const base = strikeNpc(mkr(), { ...pl }, nn(), false, {}).damage, cr = strikeNpc(mkr(), { ...pl }, nn(), false, { crit: true }).damage, ds = strikeNpc(mkr(), { ...pl }, nn(), false, { dash: true }).damage;
  assert.ok(base > 0 && cr > base && ds > base, `base ${base} crit ${cr} dash ${ds}`);
}

// comando: sin carga el crit no se gasta ni se aplica; con carga gasta una
{
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
  const n = spawn(30, 30); put(p, 28, 30); p.sp = 50; p.lastAttack = -1e9; p.busyUntil = 0; p.lastRun = -1e9;
  assert.ok(!w.command(id, { t: "attack", target: n.id, dash: true }), "sin correr no hay dash");
  p.lastRun = w.time; p.busyUntil = 0;
  const sp0 = p.sp, evs = w.events.length;
  assert.ok(w.command(id, { t: "attack", target: n.id, dash: true }), "corriendo sí");
  tick(1500);
  assert.equal(p.x, 29, "avanza una casilla"); assert.ok(p.sp < sp0, "cuesta aliento");
  assert.ok(w.events.slice(evs).some(e => e.t === "crit" && e.dash), "evento dash");
  put(p, 20, 40); p.lastRun = w.time; p.busyUntil = 0; p.lastAttack = -1e9;
  assert.ok(!w.command(id, { t: "attack", target: n.id, dash: true }), "más lejos no hay dash");
}
console.log("OK crit-dash");
