// Combate contra el original: zona de lucha +1/3 (combat.cpp:781), Lucky (combat.cpp:1015, HG.cpp:18250/21078), alcance 845 (HG.cpp ~6200), bonus 847/848 (+10).
import assert from "node:assert/strict";
import { strikeNpc } from "../web/src/shared/combat.js";
import { luckySave, reachOf } from "../web/src/shared/systems/combatsys.js";

// rng fijo: dice(1,100) devuelve 1 (acierta siempre)
const rng = () => 0;
const mk = () => ({ combo: 0, hunger: 100, sp: 100, level: 1, stats: { str: 10, dex: 10 }, skills: {}, eff: { wtype: 0, skill: 5, sm: [0, 0, 0], l: [0, 0, 0], addPhys: 0, addCD: 0, addAR: 0, critBonus: 0, hero: 0 } });
const npc = { cfg: { defenseRatio: 0, size: 0, actionLimit: 0 }, absDamage: 0 };
const base = strikeNpc(rng, mk(), npc, false, { bonus: 29 }).damage;
const zone = strikeNpc(rng, mk(), npc, false, { bonus: 29, fightZone: true }).damage;
assert.equal(base, 30); assert.equal(zone, 30 + 10, "zona de lucha: +dmg/3");

// Lucky: solo con el flag; 4 de cada 10 tiradas (dice<5) y solo si el golpe mata
const w = { rng: () => 0 };                       // dice(1,10) = 1 < 5
assert.equal(luckySave(w, { eff: { lucky: true }, hp: 5 }, 9), 1, "lucky salva");
assert.equal(luckySave(w, { eff: { lucky: true }, hp: 50 }, 9), 9, "no mata: sin cambio");
assert.equal(luckySave(w, { eff: { lucky: false }, hp: 5 }, 9), 9, "sin objeto de suerte no salva");
assert.equal(luckySave({ rng: () => 0.9 }, { eff: { lucky: true }, hp: 5 }, 9), 9, "dice(1,10)=10: no salva");

// Alcance con 845: 3 + distancia (size<2 → 1)
const p845 = { eff: {}, equip: { 7: "u" }, bag: [{ uid: "u", id: 845 }] };
import { EQUIP } from "../web/src/shared/items.js";
p845.equip = { [EQUIP.TWOHAND]: "u" };
assert.equal(reachOf({}, p845, { cfg: { size: 0 } }, false), 4);
assert.equal(reachOf({}, p845, { cfg: { size: 2 } }, false), 5);
console.log("OK combat-original");
