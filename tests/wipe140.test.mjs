// v0.85.58: tope 140, curva de experiencia y reinicio único de estadísticas/ítems.
import { MAX_LEVEL } from "../web/src/shared/drops.js";
import { MAX_LEVEL as ML2, expRate } from "../web/src/shared/systems/combatsys.js";
import { remapLevel } from "../web/src/shared/classgear.js";
import assert from "node:assert";
assert.equal(MAX_LEVEL, 140); assert.equal(ML2, 140);
assert.equal(remapLevel(100), 100); assert.equal(remapLevel(200), 140);
assert(expRate(140) > expRate(50) * 0.1 && expRate(140) < expRate(50));
console.log("wipe140 OK");
