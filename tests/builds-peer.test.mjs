// Builds: un habitante copia el reparto de puntos que mejor le rinde a otro de su misma personalidad (solo si lo supera con holgura).
import assert from "node:assert/strict";
import { peerBest, BUILDS } from "../web/src/shared/systems/builds.js";
const names = Object.keys(BUILDS), [x, y] = names;
const me = { name: "Yo", res: { arch: "hunter", builds: [{ name: x, rate: 100, n: 2 }] } };
const o1 = { name: "Otro", res: { arch: "hunter", builds: [{ name: y, rate: 180, n: 3 }] } };
const o2 = { name: "Mago", res: { arch: "scholar", builds: [{ name: y, rate: 999, n: 3 }] } };
const o3 = { name: "Flojo", res: { arch: "hunter", builds: [{ name: y, rate: 105, n: 1 }] } };
const r = peerBest(me, [me, o1, o2, o3]);
assert.equal(r?.name, y); assert.equal(r.from, "Otro"); assert.equal(r.rate, 180);
assert.equal(peerBest(me, [o3, o2]), null, "ni otra personalidad ni mejoras pequeñas");
console.log("OK builds-peer");
