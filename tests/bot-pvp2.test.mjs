// v0.85.55: reparto de stats (guerrero: Str del arma > Dex > Vit; mago: Int > Mag > Vit) y pesos nuevos
import assert from "node:assert";
import * as B from "../web/src/shared/systems/builds.js";
assert.ok(B.BUILDS.vanguard.w.dex > B.BUILDS.vanguard.w.str, "el guerrero prioriza Dex sobre Str extra");
assert.ok(B.BUILDS.vanguard.w.vit > B.BUILDS.vanguard.w.str, "y Vit sobre Str extra");
assert.ok(B.BUILDS.mage.w.int > B.BUILDS.mage.w.mag && B.BUILDS.mage.w.mag > B.BUILDS.mage.w.vit, "mago: Int > Mag > Vit");
const war = { stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10 }, res: { build: "vanguard" }, bot: {}, equip: {}, bag: [] };
const a = B.allocate(war, 60, 30);
assert.ok(a.str >= 20, "reserva la Str que pide el arma");
assert.ok(a.dex > 0 && a.vit > 0, "el resto va a Dex y Vit");
console.log("ok bot-pvp2");
