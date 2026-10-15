// Simulador de estadísticas: fórmulas = las del juego, presupuesto de puntos, tope 200.
import assert from "node:assert/strict";
import { maxHP, maxMP, maxSP } from "../web/src/shared/rules.js";
import { maxLoad } from "../web/src/shared/inventory.js";
import { simulate, bump, spent, KEYS, STAT_MAX } from "../web/src/shared/systems/statsim.js";
const base = { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 };
const cur = simulate(base, {}, 10), c = { ...base, level: 10 };
assert.equal(cur.hp, maxHP(c)); assert.equal(cur.mp, maxMP(c)); assert.equal(cur.sp, maxSP(c));
assert.equal(cur.load, maxLoad({ stats: base, level: 10 }), "la carga coincide con inventory.maxLoad");
const add = {};
assert.equal(bump(base, add, "vit", 5, 3), 3, "respeta el presupuesto"); assert.equal(spent(add), 3);
assert.equal(simulate(base, add, 10).hp, maxHP({ ...c, vit: 23 }), "3 de vit = 9 de HP"); assert.equal(simulate(base, add, 10).hp - cur.hp, 9);
assert.equal(bump(base, add, "vit", 1, 3), 0, "sin puntos no sube");
assert.equal(bump(base, add, "vit", -9, 3), -3, "no baja de lo repartido"); assert.equal(spent(add), 0);
assert.equal(bump(base, add, "str", 500, Infinity), STAT_MAX - 30, "tope 200 por atributo");
assert.equal(simulate(base, add, 10).stats.str, STAT_MAX);
assert.ok(simulate(base, {}, 50).hp > cur.hp, "más nivel, más HP");
assert.equal(KEYS.length, 6);
console.log("OK statsim");
