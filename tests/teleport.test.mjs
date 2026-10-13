import assert from "node:assert";
import { readFileSync } from "node:fs";
import * as T from "../web/src/shared/systems/teleport.js";
const rows = JSON.parse(readFileSync(new URL("../web/data/teleport.json", import.meta.url)));
assert.equal(rows.length, 16); T.setRoutes(rows);
const hr = rows.find(r => r.to === "hrampart" && r.side === "defender"); assert.equal(hr.x, 156); assert.equal(hr.cost, -1);
const p = { level: 50, side: 1, gold: 3000, pkCount: 0 };
assert.ok(T.check(p, "William", "cityhall_1", "dglv2").ok);
assert.ok(!T.check({ ...p, side: 2 }, "William", "cityhall_1", "dglv2").ok);       // bando equivocado
assert.ok(!T.check({ ...p, level: 20 }, "William", "cityhall_1", "dglv2").ok);     // nivel mínimo 40
assert.equal(T.check({ ...p, gold: 10 }, "William", "cityhall_1", "bisle").why, "oro insuficiente");
assert.ok(!T.check({ ...p, pkCount: 2 }, "William", "cityhall_1", "bisle").ok);    // criminal: solo rutas crim
assert.ok(T.check({ ...p, pkCount: 2 }, "William", "cityhall_1", "middleland").ok);
const r = T.check(p, "William", "cityhall_1", "bisle").route; T.pay(p, r); assert.equal(p.gold, 2900);
console.log("OK teleport");
