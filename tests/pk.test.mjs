import assert from "node:assert";
import * as PK from "../web/src/shared/systems/pk.js";
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ev = []; const w = { rng, time: 0, emit: e => ev.push(e) };
const mk = (side, level = 30) => ({ id: Math.random(), side, level, exp: 5000, name: "x" });
// categorías
assert.equal(PK.pkRank(0), "innocent"); assert.equal(PK.pkRank(3), "criminal"); assert.equal(PK.pkRank(4), "murderer"); assert.equal(PK.pkRank(12), "slaughterer");
assert.equal(PK.penaltyLevel(0), 1); assert.equal(PK.penaltyLevel(5), 6);
// matar a un inocente del propio bando: el asesino se vuelve criminal
const k = mk(1), v = mk(1); const exp0 = k.exp;
PK.onPlayerKilled(w, k, v);
assert.equal(k.pkCount, 1); assert.equal(k.reputation, -5); assert.ok(k.exp < exp0); assert.equal(w.crimes[1], 1); assert.ok(k.jailUntil > 0);
assert.ok(ev.some(e => e.t === "pkpenalty"));
// matar a un criminal del propio bando: recompensa, sin pena
const k2 = mk(1), c = mk(1); PK.ensure(c); c.pkCount = 2;
PK.onPlayerKilled(w, k2, c); assert.equal(k2.pkCount, 0); assert.equal(k2.rewardGold, c.level * 3);
// matar a un enemigo de nivel >=30: experiencia, oro, contador y elo
const k3 = mk(1), e = mk(2, 40); const x0 = k3.exp;
PK.onPlayerKilled(w, k3, e); assert.ok(k3.exp > x0); assert.equal(k3.enemyKillCount, 1); assert.ok(k3.elo > 1500 && e.elo < 1500); assert.ok(k3.rewardGold >= 1);
// un criminal que mata a un enemigo no cobra
const k4 = mk(1); PK.ensure(k4); k4.pkCount = 1; PK.onPlayerKilled(w, k4, mk(2)); assert.equal(k4.enemyKillCount, 0);
// decPK
PK.decPK(w, k4); assert.equal(k4.pkCount, 0); PK.decPK(w, k4); assert.equal(k4.pkCount, 0);
// hostilidad
assert.ok(!PK.hostileTo(mk(1), mk(1))); assert.ok(PK.hostileTo(mk(1), c)); assert.ok(PK.hostileTo(mk(0), mk(1)));
console.log("OK pk");
