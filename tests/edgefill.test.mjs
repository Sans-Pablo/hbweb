// Barra inferior hasta los bordes (ticket 11): gui.js la prolonga en Remastered. node tests/edgefill.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s = readFileSync(new URL("../web/src/client/gui.js", import.meta.url), "utf8");
assert.ok(/edgeFill\(\) \{/.test(s) && /this\.edgeFill\(\);/.test(s), "edgeFill definido y llamado desde gauges");
assert.ok(/this\.mobile \|\| !this\.spr\?\.hd/.test(s), "solo en Remastered y no en móvil");
console.log("OK edgefill");
