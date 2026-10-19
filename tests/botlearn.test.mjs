// v0.85.64: bots que aprenden. Genes por arquetipo/modo, calibración online y regresión contra la línea base entrenada.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { DEFAULTS, KEYS, BOUNDS, setGenes, genesOf, learnFight, learnDeath } from "../web/src/shared/systems/botgenes.js";
import { runPve, runPvp } from "../tools/train.mjs";
// 1. sin tabla: genes = comportamiento anterior
setGenes({});
const w = { pvp: false }, p = { res: { build: "vanguard" } };
for (const k of KEYS) assert.equal(genesOf(w, p)[k], DEFAULTS[k], "defecto " + k);
// 2. tabla por arquetipo y modo
setGenes({ vanguard: { pve: { flee: 0.2 }, pvp: { flee: 0.5 } } });
assert.equal(genesOf(w, p).flee, 0.2); assert.equal(genesOf({ pvp: true }, p).flee, 0.5);
assert.equal(genesOf(w, { res: { build: "mage" } }).flee, DEFAULTS.flee, "el mago no hereda");
// 3. calibración online: si recibe el triple de lo previsto, el factor sube; nunca sale de límites
setGenes({});
for (let i = 0; i < 400; i++) learnFight(w, p, "Orc", 10, 100);
assert.ok(w.learn.cal.vanguard > 1.3 && w.learn.cal.vanguard <= BOUNDS.cal[1], "cal sube " + w.learn.cal.vanguard);
learnDeath(w, "Orc"); assert.equal(w.learn.mobs.Orc.deaths, 1);
assert.ok(w.learn.mobs.Orc.n === 400);
// 4. regresión: los genes entrenados no pueden rendir peor que los de fábrica (mismas semillas)
const T = JSON.parse(readFileSync(new URL("../web/data/botgenes.json", import.meta.url)));
for (const cls of Object.keys(T.genes)) for (const mode of Object.keys(T.genes[cls])) {
  const run = mode === "pvp" ? runPvp : runPve, secs = 60, sd = [101, 202];
  const f = g => sd.reduce((s, x) => s + run(g, cls, secs, x).fitness, 0) / sd.length;
  const base = f({ ...DEFAULTS }), got = f(T.genes[cls][mode]);
  assert.ok(got >= base * 0.9, `${cls}/${mode}: genes entrenados ${got.toFixed(2)} < base ${base.toFixed(2)} (-10%)`);
}
console.log("OK botlearn");
