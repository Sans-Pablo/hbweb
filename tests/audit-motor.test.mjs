// Auditoría motor vs original (docs/AUDITORIA.md): tabla SSN, multiplicador de habilidad, clima en magia.
import assert from "node:assert/strict";
import { ssnTable, skillMultiplier, gainSSN, MAX_TOTAL_MASTERY } from "../web/src/shared/skills.js";
import { weatherCast, weatherBonus, castChance } from "../web/src/shared/magic.js";

assert.equal(ssnTable(1), 1); assert.equal(ssnTable(50), 50);
assert.equal(ssnTable(51), 260); assert.equal(ssnTable(100), 1000);   // HG.cpp:15004
assert.equal(MAX_TOTAL_MASTERY, 900);
assert.equal(skillMultiplier(5), 8); assert.equal(skillMultiplier(2), 2); assert.equal(skillMultiplier(15), 1);

const p = { skills: { 8: 20 }, ssn: {}, stats: { dex: 50, str: 50, mag: 50, int: 50, vit: 50 }, level: 10 };
gainSSN(p, 8, 1);
assert.equal(p.ssn[8], 8, "un uso de espada larga vale x8");
for (let i = 0; i < 3; i++) gainSSN(p, 8, 1);
assert.equal(p.skills[8], 21, "4 usos x8 = 32 > 21: sube");

assert.equal(weatherCast(240, 0), 240); assert.equal(weatherCast(240, 1), 230);
assert.equal(weatherCast(240, 2), 220); assert.equal(weatherCast(240, 3), 192);
assert.equal(weatherBonus(10, 1), 1); assert.equal(weatherBonus(20, 2), -1);
assert.equal(weatherBonus(10, 0), 0); assert.equal(weatherBonus(1, 3), 0);
const m = { skills: { 4: 100 }, stats: { int: 50 }, level: 30, eff: {} };
assert.ok(castChance(m, 10, 3) <= castChance(m, 10, 0));
console.log("OK audit-motor");
