// Ritmo de experiencia del port: cuesta mucho más llegar al nivel máximo (expRate en combatsys.js, escalado por PACE = 0.3 desde v0.63.0)
import assert from "node:assert/strict";
import { expRate } from "../web/src/shared/systems/combatsys.js";
const K = 0.3;
assert.ok(Math.abs(expRate(1) - 0.7 * K) < 1e-9);
assert.ok(Math.abs(expRate(20) - 0.7 * K) < 1e-9);
assert.ok(expRate(30) < 0.35 * K && expRate(30) > 0.28 * K, "nivel 30 ≈ 31 %");
assert.ok(expRate(49) < 0.07 * K, "nivel 49 < 7 %");
for (let l = 21; l < 50; l++) assert.ok(expRate(l) < expRate(l - 1), "decrece con el nivel");
console.log("OK exprate");
