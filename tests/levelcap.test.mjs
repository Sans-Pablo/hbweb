// levelcap.js es la única fuente del tope: todo lo derivado debe ser coherente con MAX_LEVEL.
import assert from "node:assert/strict";
import { MAX_LEVEL, expDecay, intFactor, costFactor, levelUpGold, pointBudget } from "../web/src/shared/levelcap.js";
import * as D from "../web/src/shared/drops.js";
import { MAX_GEAR_LEVEL } from "../web/src/shared/classgear.js";
assert.equal(D.MAX_LEVEL, MAX_LEVEL); assert.equal(MAX_GEAR_LEVEL, MAX_LEVEL);
assert.ok(Math.abs(expDecay(MAX_LEVEL) / expDecay(50) - 0.35) < 1e-9 || MAX_LEVEL <= 50);
assert.ok(intFactor > 0 && intFactor <= 1 && costFactor > 0 && costFactor <= 1);
assert.equal(levelUpGold(40), 70); assert.equal(pointBudget(1), 60);
console.log("OK levelcap");
