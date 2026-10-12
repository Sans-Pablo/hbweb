// v0.77.0: defender aliados (allyBonus) y sin flechas
import { allyBonus } from "../web/src/shared/systems/bot.js";
import assert from "node:assert";
const me = { id: 1, x: 0, y: 0, kind: "player" }, ally = { id: 2, x: 3, y: 0, kind: "player" };
const w = { ents: new Map([[1, me], [2, ally]]), pvp: false, map: { kind: "farm" }, safeAt: () => false };
const mob = hp => ({ kind: "npc", target: 2, hp, maxHp: 100 });
const b1 = allyBonus(w, me, mob(100)), b2 = allyBonus(w, me, mob(20));
assert.ok(b1 > 0 && b2 > b1, "prefiere al que ataca a un aliado y al casi muerto");
assert.equal(allyBonus(w, me, { kind: "npc", target: 1, hp: 5, maxHp: 100 }), 0);
console.log("OK bot-arrows-allies");
