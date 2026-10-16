// v0.85.48: Str de arma (allocate/swingStr) y bonos por clase (bonusScore) de los bots
import assert from "node:assert";
import * as B from "../web/src/shared/systems/builds.js";
const war = { stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10 }, res: { build: "glass" }, bot: {}, equip: {}, bag: [] };
const a = B.allocate(war, 20, 25);
assert.ok(a.str >= 14, "cubre la Str del arma primero");
const mage = { ...war, res: { build: "mage" } };
const attr = (t2, v2) => ((t2 << 12) | (v2 << 8)) >>> 0;
assert.ok(B.bonusScore(mage, {}, attr(6, 5)) > B.bonusScore(mage, {}, attr(9, 5)), "mago: MP > MA");
assert.ok(B.bonusScore(war, {}, attr(9, 5)) > B.bonusScore(war, {}, attr(6, 5)), "guerrero: MA > MP");
assert.ok(B.bonusScore(war, {}, attr(9, 5), "magic") > B.bonusScore(war, {}, attr(9, 5)), "contra magos pesa más MA");
console.log("OK bot-gear");
