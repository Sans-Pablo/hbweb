// Observador dividido (0.85.60): los ◀ ▶ solo recorren a quien pelea.
import assert from "node:assert";
import { fighting, ordered } from "../web/src/client/watchpanel.js";
const b = (id, mode, job = "") => ({ id, name: "n" + id, mode, job, grp: 0, lead: "", side: 1 });
assert(fighting(b(1, "fight")) && fighting(b(2, "pit")) && !fighting(b(3, "rest")) && !fighting(b(4, "fight", "farmer")) && !fighting(b(5, "idle", "fisher")));
assert.deepEqual(ordered([b(1, "fight"), b(2, "rest"), b(3, "fight", "farmer"), b(4, "flee")]).map(x => x.id).sort(), [1, 4]);
assert.equal(ordered([b(1, "rest"), b(2, "idle")]).length, 2);   // nadie pelea → todos
const o = JSON.parse((await import("node:fs")).readFileSync(new URL("../docs/observaciones.json", import.meta.url), "utf8"));
assert(Array.isArray(o.tickets));
console.log("OK observer-split");
