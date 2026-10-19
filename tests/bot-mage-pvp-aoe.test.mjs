// v0.85.78: mago bot en PvP segun el replay de 'zzzz': area contra grupos, paralizar al mas peligroso, curar con margen
import assert from "node:assert";
import { pvpArea, mostThreatening, healSafe, threat } from "../web/src/shared/systems/botmagic.js";
const magic = { 91: { name: "Blizzard", mana: 170 }, 96: { name: "Earth Shock Wave", mana: 180 }, 70: { name: "Bloody Shock Wave", mana: 120 } };
const mk = (id, x, o = {}) => ({ id, kind: "player", hp: 100, maxHp: 100, x, y: 5, level: 100, stats: { int: 200, mag: 200 }, skills: { 4: 100 }, eff: {}, magic: { 91: 1, 96: 1, 70: 1 }, mp: 900, ...o });
const me = mk("me", 0), a = mk("a", 8, { mp: 10 }), b2 = mk("b", 9, { mp: 10 }), c = mk("c", 9, { eff: { wtype: 36 } });
const w = { time: 1e5, magic, ents: new Map([["me", me], ["a", a], ["b", b2]]), fightZone: false };
assert.ok(pvpArea(w, me, { cd: {} }, a, 0) !== undefined, "grupo de 2 juntos: area");
w.ents.delete("b");
assert.equal(pvpArea(w, me, { cd: {} }, a, 0), undefined, "uno solo: no area");
w.ents.set("c", c); w.ents.set("b", b2);
assert.equal(mostThreatening(w, me, { cd: {} }, a, 4).id, "c", "el mago rival es la mayor amenaza");
assert.ok(threat(c) > threat(a));
assert.equal(healSafe(w, me, { cd: {} }), true, "sin rivales encima se cura");
const w2 = { ...w, ents: new Map([["me", me], ["a", mk("a", 1)], ["b", mk("b", 2)]]) };
assert.equal(healSafe(w2, me, { cd: {} }), false, "con 2 encima se huye antes");
console.log("OK bot-mage-pvp-aoe");
