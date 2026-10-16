// v0.85.54: fórmulas de daño/acierto/MR que usan los bots (botformulas.js)
import assert from "node:assert";
import * as F from "../web/src/shared/systems/botformulas.js";
import * as B from "../web/src/shared/systems/builds.js";
const t = (mag, mr) => ({ stats: { mag }, skills: { 3: mr }, eff: {}, defense: 100 });
assert.equal(F.resistRatio(t(50, 40)), 40, "con Mag <= 50 la MR es la del skill");
assert.equal(F.resistRatio(t(80, 40)), 70, "por encima de 50 la Mag suma a la MR");
const me = { stats: { str: 50, mag: 50, int: 60 }, skills: { 4: 100 }, eff: { wtype: 1, hit: 100, sm: [1, 8, 0], l: [1, 6, 0] }, level: 50, res: { build: "glass" } };
assert.ok(F.meleeChance(me, { defense: 50 }) > F.meleeChance(me, { defense: 200 }), "más defensa, menos acierto");
assert.equal(F.meleeChance(me, { defense: 1e6 }), 15, "mínimo 15 %");
assert.ok(F.meleeAvg(me) > 4.5, "la Str suma al daño medio");
assert.ok(F.pointGain({ ...me, stats: { mag: 60 } }, "mag") > F.pointGain({ ...me, stats: { int: 60 } }, "int"), "Mag > 50 rinde más que Int");
const mage = { stats: { str: 10, vit: 10, dex: 10, int: 60, mag: 10 }, res: { build: "mage" }, bot: {}, equip: {}, bag: [] };
const lo = B.allocate({ ...mage, stats: { ...mage.stats, int: 20 } }, 40, 0), hi = B.allocate(mage, 40, 0);
assert.ok(hi.mag > lo.mag, "con Int >= 50 el mago manda más puntos a Mag");
console.log("OK bot-formulas");
