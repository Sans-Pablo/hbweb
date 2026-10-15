// Quitar la capa: el aspecto no debe conservar su color ni compartir imagen en caché con otra pieza del mismo tinte (composed.js keyOf, appearance.js).
import assert from "node:assert/strict";
import { apparelOf } from "../web/src/shared/appearance.js";
import { PersonCache } from "../web/src/client/composed.js";
const defs = { 402: { appr: 3 }, 451: { appr: 2 }, 687: { appr: 102 }, 860: { appr: -1 } };
const bag = [{ uid: 1, id: 402, color: 9 }, { uid: 2, id: 451, color: 9 }, { uid: 3, id: 687, color: 11 }, { uid: 4, id: 860, color: 5 }];
const e = { bag, equip: { 12: 1, 5: 2, 2: 3, 6: 4 }, guild: { name: "S", cape: 7, boots: 9 } };
const on = apparelOf(e, id => defs[id]);
assert.equal(on.mantle, 3); assert.equal(on.col.mantle, 7);
delete e.equip[12];
const off = apparelOf(e, id => defs[id]);
assert.equal(off.mantle, undefined); assert.equal(off.col.mantle, undefined, "sin capa no queda su color");
assert.equal(off.armor, 2); assert.deepEqual(off.col, { armor: 11, boots: 9 });
const k = PersonCache.prototype.keyOf, ctx = { spr: { hd: false } }, look = { skin: 1, under: 0, hair: 4, hairCol: 3 };
const a = { armor: 0, boots: 0, mantle: 3, col: { mantle: 9 } }, b = { armor: 0, boots: 0, mantle: 3, col: { boots: 9 } };
assert.notEqual(k.call(ctx, 1, look, 6, 0, 0, a), k.call(ctx, 1, look, 6, 0, 0, b), "mismo tinte en otra ranura = otra clave");
console.log("OK apariencia-capa");
