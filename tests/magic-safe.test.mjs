// Sistema 6: modo ataque seguro. Original: PlayerMagicHandler (HG.cpp:10337) multiplica el coste de maná por 1,1 (entero)
// cuando m_bIsSafeAttackMode y el mapa no es de zona de lucha.
import assert from "node:assert/strict";
import { manaCost } from "../web/src/shared/magic.js";
const sp = { mana: 25 };
const p = { eff: { manaSave: 0, wtype: 0 }, safeAttack: false };
assert.equal(manaCost(p, sp, 10), 25);
p.safeAttack = true;
assert.equal(manaCost(p, sp, 10), 27, "25*1.1 = 27 (truncado)");
assert.equal(manaCost(p, sp, 10, true), 25, "en zona de lucha no se aplica");
p.eff.manaSave = 10;
assert.equal(manaCost(p, sp, 10), Math.floor(27 - 2.7), "el ahorro de maná se aplica después");
console.log("OK magic-safe");
