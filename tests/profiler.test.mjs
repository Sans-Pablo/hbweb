import { Profiler } from "../web/src/client/profiler.js";
import assert from "assert";
const p = new Profiler(2, 0.5, [{ name: "a", pf: {} }, { name: "b", pf: { fx: 1 } }]);
let t = 0, out = [];
assert.deepEqual(p.pf, {});
while (!p.done && t < 10000) { const r = p.step(t, 20); if (r) out.push(r); t += 20; if (p.name === "b") assert.equal(p.pf.fx, 1); }
assert.equal(out.length, 2); assert.equal(out[0].phase, "a"); assert.equal(out[1].phase, "b");
assert.equal(out[0].fps, 50); assert.equal(out[0].frameMs, 20);
assert.deepEqual(p.pf, {}); assert.equal(p.step(t, 20), null);
console.log("OK profiler");
