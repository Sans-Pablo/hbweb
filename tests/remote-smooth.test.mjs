// Suavizado de pasos de otros jugadores online (connection.js: smoothRemote). node tests/remote-smooth.test.mjs
import { smoothRemote, REMOTE_DELAY } from "../web/src/client/connection.js";
import { ACT } from "../web/src/shared/const.js";
import assert from "node:assert/strict";

// paso nuevo: arranca con retardo fijo
let e = { act: ACT.STOP, actStart: 0, actDur: 0, x: 5, y: 5 };
let r = smoothRemote(e, { act: ACT.RUN, s: 1000, d: 230, fx: 5, fy: 5, x: 6, y: 5 }, 1000);
assert.equal(r.keep, false); assert.equal(r.start, 1000 + REMOTE_DELAY);

// segundo paso (server: s=1200) mientras el primero se ve hasta 1350: se encadena, no se solapa
e = { act: ACT.RUN, actStart: 1000 + REMOTE_DELAY, actDur: 230, x: 6, y: 5 };
r = smoothRemote(e, { act: ACT.RUN, s: 1200, d: 230, fx: 6, fy: 5, x: 7, y: 5 }, 1250);
assert.equal(r.start, 1000 + REMOTE_DELAY + 230);

// si el siguiente ya empieza después de acabar el visible, no se retrasa más
e = { act: ACT.RUN, actStart: 1120, actDur: 230, x: 6, y: 5 };
r = smoothRemote(e, { act: ACT.RUN, s: 1300, d: 230, fx: 6, fy: 5, x: 7, y: 5 }, 1300);
assert.equal(r.start, 1300 + REMOTE_DELAY);

// "parado" en el destino mientras aún se ve el paso: no lo corta
e = { act: ACT.RUN, actStart: 1120, actDur: 230, x: 6, y: 5 };
assert.equal(smoothRemote(e, { act: ACT.STOP, s: 1230, d: 0, x: 6, y: 5 }, 1250).keep, true);
// ...pero si ya terminó, o el destino es otro, se aplica
assert.equal(smoothRemote(e, { act: ACT.STOP, s: 1500, d: 0, x: 6, y: 5 }, 1400).keep, false);
assert.equal(smoothRemote(e, { act: ACT.STOP, s: 1230, d: 0, x: 9, y: 5 }, 1250).keep, false);
// otros actos (golpe, daño) se aplican tal cual, sin retardo
r = smoothRemote(e, { act: ACT.ATTACK, s: 1250, d: 400, x: 6, y: 5 }, 1250);
assert.equal(r.keep, false); assert.equal(r.start, 1250);
console.log("OK remote-smooth");
