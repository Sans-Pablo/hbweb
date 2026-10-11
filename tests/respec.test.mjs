// Reset de estadísticas (mago de la tienda) y reparto de puntos por build
import assert from "node:assert/strict";
import { respec, respecCost, RESPEC } from "../web/src/shared/systems/respec.js";
import { allocate, BUILDS, buildOf } from "../web/src/shared/systems/builds.js";
const ev = [];
const mage = { kind: "citizen", type: RESPEC.mageType, x: 10, y: 10 };
const mk = (gold, x = 12) => ({ id: 1, level: 20, gold, x, y: 10, pool: 0, stats: { str: 30, dex: 20, vit: 25, int: 10, mag: 10, chr: 10 }, res: { arch: "warrior" }, dead: false });
const w = (near = true) => ({ ents: new Map(near ? [[9, mage]] : []), reject: (p, c, why) => { ev.push(why); return false; }, emit: e => ev.push(e.t), recalc() {} });
let p = mk(5000, 40); assert.equal(respec(w(false), p, {}), false); assert.ok(ev.includes("acércate al mago"));
p = mk(10); assert.equal(respec(w(), p, {}), false); assert.equal(p.pool, 0, "sin oro no cambia nada");
p = mk(5000); const c = respecCost(p); assert.equal(respec(w(), p, {}), true);
assert.equal(p.gold, 5000 - c); assert.equal(p.pool, 20 + 10 + 15, "devuelve lo que pasa de la base");
assert.ok(Object.values(p.stats).every(v => v === RESPEC.base || v < RESPEC.base) && p.stats.str === RESPEC.base);
assert.equal(respec(w(), p, {}), false, "ya sin puntos que recuperar");
for (const b of Object.keys(BUILDS)) { const q = mk(0); q.res.build = b; const o = allocate(q, 40); assert.equal(Object.values(o).reduce((a, v) => a + v, 0), 40, b); }
console.log("OK");
