// Sonidos de arma por tipo (MapData.cpp): el ataque y el golpe recibido dependen del tipo de arma.
import assert from "node:assert";
import { attackSfx, hitSfx } from "../web/src/client/audio.js";
assert.equal(attackSfx({ wt: 0 }), null);
assert.equal(attackSfx({ wt: 1 }), "C1");
assert.equal(attackSfx({ wt: 5 }), "C2");
assert.equal(attackSfx({ wt: 25 }), "C18");
assert.equal(attackSfx({ wt: 45 }), "C3");
assert.equal(attackSfx({ wt: 40, bow: true }), "C3");
assert.equal(hitSfx(0), "C5"); assert.equal(hitSfx(5), "C6"); assert.equal(hitSfx(45), "C7");
console.log("OK sonidos-arma");
