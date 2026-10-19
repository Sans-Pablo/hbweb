// v0.85.55: reparto de stats (guerrero: Str del arma > Dex > Vit; mago: Int > Mag > Vit) y pesos nuevos
import assert from "node:assert";
import * as B from "../web/src/shared/systems/builds.js";
assert.ok(B.BUILDS.vanguard.w.dex > B.BUILDS.vanguard.w.str, "el guerrero prioriza Dex sobre Str extra");
assert.ok(B.BUILDS.vanguard.w.vit > B.BUILDS.vanguard.w.str, "y Vit sobre Str extra");
assert.ok(B.BUILDS.mage.w.int > B.BUILDS.mage.w.mag && B.BUILDS.mage.w.mag > B.BUILDS.mage.w.vit, "mago: Int > Mag > Vit");
const war = { stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10 }, res: { build: "vanguard" }, bot: {}, equip: {}, bag: [] };
const a = B.allocate(war, 200, 30);
assert.ok(a.str >= 20, "reserva la Str que pide el arma");
assert.ok(a.vit > 0, "el resto va a Vit (Dex solo en múltiplos de 10)");
console.log("ok bot-pvp2");
// v0.85.56: ranking de items por segundo stat
const at = (t2, v2) => (t2 << 12) | (v2 << 8);
const warP = { stats: { str: 100 }, res: { build: "vanguard" }, bot: {}, equip: {}, bag: [], hp: 100, maxHp: 100, mp: 10, maxMp: 10 };
const mageP = { ...warP, res: { build: "mage" } };
const armor = { equipPos: 2, v4: 10, v5: 40 };
assert.ok(B.bonusScore(warP, armor, at(4, 10)) > B.bonusScore(warP, armor, at(7, 10)), "guerrero: HP > MR");
assert.ok(B.bonusScore(warP, armor, at(7, 10)) > B.bonusScore(warP, armor, at(8, 10)), "guerrero: MR > PA");
assert.ok(B.bonusScore(mageP, armor, at(6, 10)) > B.bonusScore(mageP, armor, at(4, 10)), "mago: MP > HP");
assert.ok(B.bonusScore(warP, armor, at(4, 10)) > 2 * B.bonusScore(warP, armor, at(4, 5)), "valor convexo en v2");
const wep = { equipPos: 8 };
assert.ok(B.bonusScore(warP, wep, at(2, 5)) > B.bonusScore(warP, wep, at(10, 5)) && B.bonusScore(warP, wep, at(10, 5)) > B.bonusScore(warP, wep, at(12, 5)), "arma: acierto > consecutivo");
assert.ok(B.bonusScore(mageP, { ...armor, v5: 30 }, at(6, 5)) > B.bonusScore(mageP, { ...armor, v5: 90 }, at(6, 5)), "armadura ligera vale más");
warP.hp = 20; assert.ok(B.bonusScore(warP, armor, at(4, 5)) > 40, "set HP con poca vida");
console.log("ok bot-pvp2 items");
