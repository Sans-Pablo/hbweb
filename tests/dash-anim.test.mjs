// Animación del dash (OBJECTATTACKMOVE, Game.cpp DrawObject_OnAttackMove): 13 fotogramas (0..12), cuerpo 32/26/16/0 px detrás de la casilla nueva, fantasma 26/16 px.
import assert from "node:assert/strict";
import { posOf, playerSprite, dashGhost, dashFrame } from "../web/src/client/anim.js";
import { ACT } from "../web/src/shared/const.js";
const e = { act: ACT.ATTACKMOVE, actStart: 0, actDur: 1014, x: 10, y: 10, fx: 9, fy: 10, dir: 7, lastCombat: 0 };   // dir 7: hacia +x
const at = f => 78 * f + 1;
assert.equal(dashFrame(e, at(0)), 0); assert.equal(dashFrame(e, at(12)), 12); assert.equal(dashFrame(e, 1014), -1);
assert.equal(posOf(e, at(0))[0], 10 * 32 + 16 - 32, "fotograma 0: en la casilla de origen");
assert.equal(posOf(e, at(1))[0], 10 * 32 + 16 - 26);
assert.equal(posOf(e, at(2))[0], 10 * 32 + 16 - 16);
assert.equal(posOf(e, at(3))[0], 10 * 32 + 16);
assert.equal(posOf(e, at(2))[1] - (10 * 32 + 16), 2, "dy extra +2 px en el fotograma 2");
assert.deepEqual([0, 1, 2, 3, 4, 9, 10, 11, 12].map(i => playerSprite(e, at(i)).f), [0, 1, 2, 3, 4, 4, 5, 6, 7]);
assert.equal(playerSprite(e, at(5)).group, 6); assert.equal(playerSprite(e, at(5), true).group, 7);
assert.equal(dashGhost(e, at(2)) + 16, 26); assert.equal(dashGhost(e, at(3)), 16); assert.equal(dashGhost(e, at(4)), 0);
console.log("OK dash-anim");
