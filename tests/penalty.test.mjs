// PenaltyItemDrop (Client.cpp): el caído en PvP suelta un objeto al azar (puesto o de la mochila) al suelo.
import assert from "node:assert/strict";
import { penaltyDrop } from "../web/src/shared/systems/combatsys.js";
const ev = [];
const w = { rng: () => 0.5, time: 0, items: new Map(), grid: { idx: (x, y) => y * 100 + x }, emit: e => ev.push(e), recalc() {} };
const v = { id: 1, x: 5, y: 5, equip: { 8: 11 }, bag: [{ uid: 10, id: 90, count: 50 }, { uid: 11, id: 5, count: 1 }, { uid: 12, id: 6, count: 1 }, { uid: 13, id: 7, count: 1, comp: {} }] };
penaltyDrop(w, v, 1);
assert.equal(v.bag.length, 3, "pierde exactamente un objeto");
assert.ok(v.bag.some(i => i.id === 90) && v.bag.some(i => i.comp), "no suelta oro ni la bola de compañero");
assert.equal(w.items.get(5 * 100 + 5).length, 1, "aparece en el suelo");

const dropped = ev.find(e => e.t === "penaltydrop"); assert.ok(dropped);
if (dropped.item === 5) assert.ok(!v.equip[8], "si era el puesto, queda desequipado");
console.log("OK");
