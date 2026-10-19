// v0.85.65: saber de ítems — los bots aprenden qué piezas rinden más y corrigen el item level.
import assert from "node:assert";
import { sample, factor, summary } from "../web/src/shared/systems/botlore.js";
const w = { time: 0 };
const mk = (id, exp0) => ({ exp: exp0, hp: 10, equip: { 1: 1 }, bag: [{ uid: 1, id }], res: { qa: { deaths: {} } } });
assert.equal(factor(w, 5), 1, "sin datos = 1");
// 10 bots: la pieza 5 da el doble de exp/min que la 6
for (let k = 0; k < 10; k++) for (const [id, rate] of [[5, 200], [6, 100]]) {
  const p = mk(id, 0), b = {}; w.time = 0; sample(w, p, b);
  for (let m = 1; m <= 10; m++) { w.time = m * 60000; p.exp += rate; sample(w, p, b); }
}
assert.ok(factor(w, 5) > 1.1, "la buena sube " + factor(w, 5));
assert.ok(factor(w, 6) < 1 && factor(w, 6) >= 0.8, "la mala baja " + factor(w, 6));
assert.equal(summary(w)[0].id, 5);
// las muertes penalizan
const q = mk(7, 0), bq = {}; w.time = 0; sample(w, q, bq);
for (let m = 1; m <= 10; m++) { w.time = m * 60000; q.exp += 200; q.res.qa.deaths.x = m; sample(w, q, bq); }
assert.ok(factor(w, 7) < factor(w, 5), "morir resta");
console.log("OK botlore 0.85.65");
