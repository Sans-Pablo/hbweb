import assert from "node:assert";
import * as Bal from "../web/src/shared/balance.js";
import { TIER_MULT } from "../web/src/shared/systems/schools.js";
const base = { ...Bal.TIER_BASE };
// por defecto todo vale 1 y scale no toca el valor (mismo redondeo que el original)
Bal.setBalance({});
assert.equal(Bal.scale(7.4, 1), 7.4); assert.equal(Bal.scale(7.4, 1, Math.round), 7.4);
assert.equal(Bal.spellDmgMul(10), 1); assert.equal(Bal.spellManaMul(10), 1); assert.equal(Bal.meleeMul(), 1);
assert.equal(Bal.monsterDmgMul("Orc"), 1); assert.equal(Bal.petHpMul("Slime"), 1);
assert.deepEqual(TIER_MULT, base);
// cada mando escala lo suyo
Bal.setBalance({ global: { playerSpell: 2, spellMana: 0.5, pvp: 0.5 }, spells: { 61: { dmg: 0.5, mana: 2 } }, npcs: { Orc: { dmg: 3, hp: 2 } } });
assert.equal(Bal.spellDmgMul(10), 2); assert.equal(Bal.spellDmgMul(61), 1);   // 2 (global) * 0.5 (hechizo)
assert.equal(Bal.spellManaMul(10), 0.5); assert.equal(Bal.spellManaMul(61), 1);
assert.equal(Bal.pvpMul(), 0.5); assert.equal(Bal.monsterDmgMul("Orc"), 3); assert.equal(Bal.monsterHpMul("Orc"), 2);
assert.equal(Bal.scale(10, 0.5), 5); assert.equal(Bal.scale(5, 1.5, Math.ceil), 8);
// se limpia: valores raros, fuera de rango o negativos
const b = Bal.setBalance({ global: { playerMelee: "x", monsterDmg: 999, heal: -3 }, spells: { 5: { dmg: 1 } }, schools: { hp: 2 } });
assert.equal(b.global.playerMelee, 1); assert.equal(b.global.monsterDmg, 20); assert.equal(b.global.heal, 0);
assert.deepEqual(b.spells, {}); assert.equal(TIER_MULT.hp, 2);
// volver a vacío restaura las escuelas
Bal.setBalance({}); assert.deepEqual(TIER_MULT, base);
console.log("OK balance");
