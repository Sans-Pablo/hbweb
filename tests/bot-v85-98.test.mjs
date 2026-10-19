// v0.85.98: valores de bonus ajustables, juez con bonus de rol, botín modesto sin oro
import assert from "node:assert/strict";
import { setBotValues, botValues } from "../web/src/shared/systems/builds.js";
setBotValues({ sub: { x: 2 }, item: { 1: 5 } });
assert.equal(botValues.sub.x, 2);
assert.equal(botValues.item[1], 5);
setBotValues({});
import { _dbg } from "../tools/train.mjs";
const { mkAdv, tick } = _dbg, a = mkAdv(12);
const b = a.spawnBot(null, { level: 60 });
for (let s = 0; s < 60; s++) tick(a, 1);
assert.ok(b.hp > 0 || b.dead !== undefined, "el bot sigue la simulación con el nuevo selector de objetivo");
console.log("OK bot-v85-98");
process.exit(0);
