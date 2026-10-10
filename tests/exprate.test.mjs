// Ritmo de experiencia del port: cuesta mucho más llegar al nivel máximo (expRate en combatsys.js)
import assert from "node:assert/strict";
import { expRate } from "../web/src/shared/systems/combatsys.js";
assert.equal(expRate(1), 0.7);
assert.equal(expRate(20), 0.7);
assert.ok(expRate(30) < 0.35 && expRate(30) > 0.28, "nivel 30 ≈ 31 %");
assert.ok(expRate(49) < 0.07, "nivel 49 < 7 %");
for (let l = 21; l < 50; l++) assert.ok(expRate(l) < expRate(l - 1), "decrece con el nivel");
console.log("OK exprate");
