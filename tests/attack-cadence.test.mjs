// Ticket #66: cadencia de ataque = original (8 fotogramas x 78 ms + 12 ms por punto de velocidad del arma, MapData.cpp).
import assert from "node:assert/strict";
import fs from "node:fs";
import { attackMs } from "../web/src/shared/world.js";
import { PLAYER } from "../web/src/shared/const.js";
assert.equal(PLAYER.attackMs, 8 * 78);
assert.equal(PLAYER.attackGapMs, 350);
for (const nib of [0, 1, 4, 8]) assert.equal(attackMs({ eff: { speedNib: nib } }), 8 * (78 + 12 * nib));
// el servidor fecha el golpe en su instante de llegada, sin cuantizarlo al tick
assert.ok(/arrived = Math\.max\(readyAt, world\.time - Math\.min\(Date\.now\(\) - q\.at, 50\)\)/.test(fs.readFileSync(new URL("../server/server.mjs", import.meta.url), "utf8")));
console.log("attack-cadence ok");
