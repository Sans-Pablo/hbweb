// Combate contra el original: zona de lucha +1/3 (combat.cpp:781), Lucky (combat.cpp:1015, HG.cpp:18250/21078), alcance 845 (HG.cpp ~6200), bonus 847/848 (+10).
import assert from "node:assert/strict";
import { strikeNpc } from "../web/src/shared/combat.js";
import { luckySave, reachOf, enduStrip, armorLifeDecrement } from "../web/src/shared/systems/combatsys.js";

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

// Desgaste de armadura (EnduStrippingDamage combat.cpp:1593, ArmorLifeDecrement HG.cpp:36384)
const items = { 1: { name: "PlateMail", maxLife: 1000 }, 2: { name: "LegionPlate", maxLife: 1000 }, 621: { name: "MerienPlateMail", maxLife: 1000 } };
const mkW = r => ({ rng: () => r, fightZone: false, data: { item: id => items[id] }, emitted: [], emit(e) { this.emitted.push(e); }, recalc() {} });
const mkT = (id, life, side = 2) => ({ kind: "player", id: "t", side, stats: { str: 10, dex: 10 }, skills: {}, level: 1, equip: { [EQUIP.BODY]: "b" }, bag: [{ uid: "b", id, life }], eff: {} });
const hammer = id => ({ kind: "player", side: 1, eff: { wtype: 30, skill: 14 }, equip: { [EQUIP.TWOHAND]: "h" }, bag: [{ uid: "h", id }] });
let t = mkT(1, 500); enduStrip(mkW(0), hammer(760), t, EQUIP.BODY, 2000);
assert.equal(t.bag[0].life, 490, "martillo 760: -10 de vida");
t = mkT(1, 500); enduStrip(mkW(0), hammer(762), t, EQUIP.BODY, 2000);
assert.equal(t.bag[0].life, 475, "martillo 762: -25");
t = mkT(1, 500); enduStrip(mkW(0), { kind: "player", side: 1, eff: { wtype: 20, skill: 10 }, equip: {}, bag: [] }, t, EQUIP.BODY, 2000);
assert.equal(t.bag[0].life, 497, "hacha: -3");
t = mkT(1, 500); enduStrip(mkW(0), null, t, EQUIP.BODY, 2000);
assert.equal(t.bag[0].life, 499, "monstruo: -1");
t = mkT(1, 500); enduStrip(mkW(0), hammer(760), t, EQUIP.BODY, 2000);   // mismo bando 1 vs 2: cuenta. Mismo bando:
t = mkT(1, 500, 1); enduStrip(mkW(0), hammer(760), t, EQUIP.BODY, 2000);
assert.equal(t.bag[0].life, 499, "mismo bando sin zona: solo 1");
t = mkT(1, 500, 0); enduStrip(mkW(0), null, t, EQUIP.BODY, 2000);
assert.equal(t.bag[0].life, 500, "neutral: no se desgasta");
t = mkT(2, 500); enduStrip(mkW(0), null, t, EQUIP.BODY, 2000);
assert.equal(t.bag[0].life, 500, "Legion: no se desgasta");
t = mkT(1, 1); const w0 = mkW(0); enduStrip(w0, null, t, EQUIP.BODY, 2000);
assert.equal(t.bag[0].life, 0); assert.equal(t.equip[EQUIP.BODY], undefined, "a 0 se suelta"); assert.ok(w0.emitted.some(e => e.t === "broken"));
// arrancado: 0.25 * dice(6, 1000-100=900) con rng=0 -> 0.25*6 = 1.5 < 100: se queda; con rng≈1 -> 0.25*5400 > 100: se suelta
t = mkT(1, 100); enduStrip(mkW(0), hammer(760), t, EQUIP.BODY, 2000); assert.notEqual(t.equip[EQUIP.BODY], undefined, "poca probabilidad: sigue puesta");
t = mkT(1, 100); const w1 = mkW(0.999); enduStrip(w1, hammer(760), t, EQUIP.BODY, 2000); assert.equal(t.equip[EQUIP.BODY], undefined, "suelta por martillo"); assert.ok(w1.emitted.some(e => e.t === "released"));
t = mkT(621, 100); enduStrip(mkW(0.999), hammer(760), t, EQUIP.BODY, 2000); assert.notEqual(t.equip[EQUIP.BODY], undefined, "Merien plate inmune");
// ArmorLifeDecrement
t = mkT(1, 50); armorLifeDecrement(mkW(0), { kind: "player", side: 1 }, t, 20); assert.equal(t.bag[0].life, 30, "rompe-armaduras resta ARMORDEC");
t = mkT(1, 50, 1); armorLifeDecrement(mkW(0), { kind: "player", side: 1 }, t, 20); assert.equal(t.bag[0].life, 50, "aliado sin zona: nada");
t = mkT(1, 10); armorLifeDecrement(mkW(0), { kind: "player", side: 1 }, t, 20); assert.equal(t.equip[EQUIP.BODY], undefined, "a 0 se suelta");
console.log("OK combat-original");
