// v0.85.89: tabla aprobada por Pablo (nivel 140, 417 puntos, tope 200): Str por arma, Int 10/36/59, Dex 120, Mag 10, resto Vit; builds de mago
import assert from "node:assert/strict";
import { WAR_BUILDS, WAR_DEX_MIN, MAGE_BUILDS, warStrOf, allocate } from "../web/src/shared/systems/builds.js";
import * as R from "../web/src/shared/rules.js";
const TABLA = { bh: [182, 10], bh36: [182, 36], bbh: [200, 10], bbh36: [200, 36], gs: [160, 10], gs36: [160, 36], gs59: [160, 59], ba: [170, 10], ba36: [170, 36], fl: [130, 10], fl36: [130, 36], fl59: [130, 59] };
assert.deepEqual(Object.keys(WAR_BUILDS).sort(), Object.keys(TABLA).sort());
assert.equal(WAR_DEX_MIN, 120);
const base = { str: 14, vit: 12, dex: 12, int: 10, mag: 10, chr: 10 }, pool = 139 * R.LEVELUP_POINTS;
for (const [id, [str, int]] of Object.entries(TABLA)) {
  assert.equal(WAR_BUILDS[id].int, int, id + " Int de la tabla");
  const p = { id: "x", level: 140, stats: { ...base }, res: { build: "vanguard" }, bot: { wb: id } }, o = allocate(p, pool, warStrOf(WAR_BUILDS[id].weapons[0], WAR_BUILDS[id]));
  const f = k => base[k] + (o[k] || 0);
  assert.equal(f("str"), str, id + " Str"); assert.equal(f("int"), int, id + " Int"); assert.ok(f("dex") >= 120, id + " Dex " + f("dex")); assert.equal(f("mag"), 10, id + " Mag"); assert.equal(f("chr"), 10, id + " Chr");
  assert.ok(f("vit") <= 200 && f("vit") >= 100, id + " Vit " + f("vit")); assert.equal(Object.values(o).reduce((a, c) => a + c, 0), pool, id + " gasta todo");
}
assert.deepEqual(Object.fromEntries(Object.entries(MAGE_BUILDS).map(([k,v])=>[k,{str:v.str,int:v.int,mag:v.mag}])), { blizzard: { str: 40, int: 195, mag: 100 }, control: { str: 40, int: 200, mag: 100 }, support: { str: 40, int: 133, mag: 200 } });
const ms = { str: 14, vit: 12, dex: 12, int: 10, mag: 10, chr: 10 };
for (const [id, b] of Object.entries(MAGE_BUILDS)) {
  const p = { id: "m", level: 140, stats: { ...ms }, res: { build: "mage" }, bot: { mb: id } }, o = allocate(p, pool, 0, 0), f = k => ms[k] + (o[k] || 0);
  assert.equal(f("int"), b.int, id + " Int"); assert.equal(f("mag"), b.mag, id + " Mag"); assert.ok(f("str") >= Math.min(14, b.str) && (id !== "support" || f("str") === 40), id + " Str"); assert.ok(f("vit") > 80 && f("vit") <= 200, id + " Vit");
  assert.equal(Object.values(o).reduce((a, c) => a + c, 0), pool);
}
console.log("OK war-str-table");
