// v0.85.50: reinicio gratuito de estadísticas de los habitantes (respec.freeReset)
import assert from "node:assert";
import { freeReset } from "../web/src/shared/systems/respec.js";
const w = { recalc() {}, emit() {} }, p = { stats: { str: 30, vit: 25, dex: 10, int: 12, mag: 10 }, pool: 2, lvDebt: 0 };
assert.strictEqual(freeReset(w, p), 20 + 15 + 2);
assert.ok(Object.values(p.stats).every(v => v === 10) && p.pool === 39);
console.log("OK bot-reset");
