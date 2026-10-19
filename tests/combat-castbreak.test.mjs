// v0.85.83: solo los golpes que aciertan y hacen daño cortan el casteo; los pequeños de jugador con iProb (combat.cpp ~1100-1190); fórmula de acierto (combat.cpp:688)
import assert from "node:assert/strict";
import { hitInterrupts, INTERRUPT_PROB, MOVE_DAMAGE } from "../web/src/shared/systems/combatsys.js";
import { hitChance } from "../web/src/shared/rules.js";
const w = r => ({ rng: () => r });                       // dice(1,10000) = floor(r*10000)+1
const pl = skill => ({ kind: "player", eff: { wtype: 12, skill } }), npc = { kind: "npc" };
assert.equal(MOVE_DAMAGE, 40);
assert.deepEqual(INTERRUPT_PROB, { 6: 3500, 8: 1000, 7: 2900, 10: 2500, 14: 2000, 21: 2000 });
assert.equal(hitInterrupts(w(0.99), 0, npc), false, "sin daño no corta");
assert.equal(hitInterrupts(w(0), 40, pl(6)), true, "daño >= 40 siempre corta");
assert.equal(hitInterrupts(w(0), 5, pl(6), "fire"), true, "magia siempre corta");
assert.equal(hitInterrupts(w(0.9), 10, npc), true, "monstruo: iProb 1");
assert.equal(hitInterrupts(w(0.34), 10, pl(6)), false, "arquería: tirada 3401 < 3500, no corta");
assert.equal(hitInterrupts(w(0.35), 10, pl(6)), true, "arquería: tirada 3501 >= 3500, corta");
assert.equal(hitInterrupts(w(0.09), 10, pl(8)), false, "espada larga: 901 < 1000");
assert.equal(hitInterrupts(w(0.1), 10, pl(8)), true, "espada larga: 1001 >= 1000");
assert.equal(hitInterrupts(w(0.19), 10, pl(14)), false, "martillo 1901 < 2000");
assert.equal(hitInterrupts(w(0.2), 10, pl(14)), true);
// acierto: floor(ar/dr*80) acotado a 15..99
assert.equal(hitChance(100, 80, false), 99); assert.equal(hitChance(50, 100, false), 40); assert.equal(hitChance(1, 100, false), 15);
console.log("OK");
