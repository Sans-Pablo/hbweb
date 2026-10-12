// v0.77.0: la clase por ítems y el tope diario de reinicios (builds.js)
import * as B from "../web/src/shared/systems/builds.js";
import assert from "node:assert";
const p = (eff, extra = {}) => ({ eff, res: { arch: "warrior" }, stats: {}, ...extra });
assert.equal(B.fitByItems(p({ bow: true })).arch, "hunter");
assert.equal(B.fitByItems(p({ wtype: 35 })).build, "arcane");
assert.equal(B.fitByItems(p({ wtype: 8 })).build, "glass");
assert.equal(B.fitByItems(p({ wtype: 8 }, { quests: { cls: "warrior" } })).build, "vanguard");
assert.notEqual(B.itemSig(p({ bow: true })), B.itemSig(p({ wtype: 8 })));
const r = {}, w = { time: 5 * 86400000 };
assert.ok(B.canRespecToday(r, w)); r.rsN = B.DAILY_CAP; assert.ok(!B.canRespecToday(r, w));
w.time += 86400000; assert.ok(B.canRespecToday(r, w));
console.log("OK bot-forced-respec");
