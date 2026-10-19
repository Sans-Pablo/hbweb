import fs from "node:fs";
import assert from "node:assert/strict";
import { REMOVED_MASTER_IDS } from "../web/src/shared/items.js";
const items = JSON.parse(fs.readFileSync(new URL("../web/data/items.json", import.meta.url)));
assert.equal(REMOVED_MASTER_IDS.length, 25);
for (const id of REMOVED_MASTER_IDS) assert.ok(!(id in items), "sigue el id " + id);
assert.deepEqual(Object.entries(items).filter(([, d]) => /^Master|\(Master\)/.test(d.name)), []);
assert.ok(items[2027], "ElfMasterBall (mascota) se conserva");
console.log("OK master-items");
