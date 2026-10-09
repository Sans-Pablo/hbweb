// Modo móvil: funciones puras (detección, auto-ataque inicial, joystick, objetivos cercanos). node tests/mobile.test.mjs
import assert from "node:assert/strict";
import { isMobile, initMobileOpts, stickTarget, nearestHostile, nearestItem } from "../web/src/client/mobile.js";

assert.equal(isMobile({ search: "?mobile=1", coarse: false, touchPoints: 0 }), true);
assert.equal(isMobile({ search: "?mobile=0", coarse: true, touchPoints: 5 }), false);
assert.equal(isMobile({ search: "", coarse: true, touchPoints: 5 }), true);
assert.equal(isMobile({ search: "", coarse: true, touchPoints: 0 }), false);
assert.equal(isMobile({ search: "", coarse: false, touchPoints: 5 }), false);

const mem = new Map(); const store = { get: (k, d) => mem.get(k) ?? d, set: (k, v) => mem.set(k, v) };
const opts = { autoAttack: false };
assert.equal(initMobileOpts(opts, store), true); assert.equal(opts.autoAttack, true);
opts.autoAttack = false;
assert.equal(initMobileOpts(opts, store), false); assert.equal(opts.autoAttack, false, "solo la primera vez");

const me = { x: 10, y: 10 };
const open = { blocked: () => false };
assert.equal(stickTarget(me, 0.1, 0.1, open), null, "zona muerta");
assert.deepEqual(stickTarget(me, 1, 0, open), { x: 13, y: 10, run: true });
assert.equal(stickTarget(me, 0.5, 0, open).run, false);
const wall = { blocked: (x) => x >= 12 };
assert.deepEqual(stickTarget(me, 1, 0, wall), { x: 11, y: 10, run: true }, "se detiene antes del muro");
assert.equal(stickTarget(me, 1, 0, { blocked: () => true }), null);

const world = { ents: new Map([
  [1, { id: 1, kind: "npc", x: 14, y: 10 }], [2, { id: 2, kind: "npc", x: 12, y: 10 }],
  [3, { id: 3, kind: "citizen", x: 11, y: 10 }], [4, { id: 4, kind: "npc", x: 11, y: 11, dead: true }],
  [5, { id: 5, kind: "npc", x: 11, y: 10, master: 9 }], [6, { id: 6, kind: "npc", x: 40, y: 40 }],
]), items: new Map([[1, { x: 15, y: 10 }], [2, { x: 11, y: 12 }], [3, { x: 30, y: 30 }]]) };
assert.equal(nearestHostile(world, me).id, 2);
assert.equal(nearestHostile(world, { x: 100, y: 100 }), null);
assert.deepEqual(nearestItem(world, me), { x: 11, y: 12 });
assert.equal(nearestItem(world, { x: 100, y: 100 }), null);
console.log("OK mobile");
