// v0.85.68: reparto del mago (Int 70 para Ice/Energy Strike, 60 % del resto a Mag), Magic al 100 % al crear y orden de estudio con Ice/Energy Strike pronto
import assert from "node:assert";
import { allocate, MAGE_INT } from "../web/src/shared/systems/builds.js";
import { STUDY_ORDER } from "../web/src/shared/systems/botmagic.js";
const p = { res: { build: "mage" }, stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 } };
const a = allocate(p, 150);
assert.strictEqual(10 + a.int >= MAGE_INT, true, "Int al menos 70");
assert.ok(MAGE_INT >= 67, "Energy Strike pide Int 67");
assert.ok(a.mag >= 50, "Mag recibe la mayor parte: " + a.mag);
assert.strictEqual(Object.values(a).reduce((x, y) => x + y, 0), 150, "reparte todo");
assert.ok(STUDY_ORDER.indexOf(57) < STUDY_ORDER.indexOf(25) && STUDY_ORDER.indexOf(60) < STUDY_ORDER.indexOf(41), "Ice/Energy Strike pronto");
assert.ok(STUDY_ORDER.includes(72) && STUDY_ORDER.includes(91), "hechizos de zona en la lista");
console.log("OK mage-stats");
