// Protection From Magic y similares (efecto 133 -> 52 «Protection Ring», Game.cpp DrawEffects case 52) se dibujan con el efecto 24.
// node tests/spellfx-ring.test.mjs
import { readFileSync } from "node:fs";
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };
const src = readFileSync(new URL("../web/src/client/spellfx.js", import.meta.url), "utf8");
assert(/case 52: if \(f >= 0\) P\(24,/.test(src), "el dibujado del efecto 52 usa el sprite 24");
const fx = JSON.parse(readFileSync(new URL("../web/data/fx.json", import.meta.url), "utf8"));
assert((fx.fx24?.frames?.length || 0) >= 15, "el sprite fx24 tiene los 15+ fotogramas del anillo");
console.log("OK spellfx-ring");
