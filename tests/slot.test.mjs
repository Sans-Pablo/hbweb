// drawSlot: casilla neutra que se enciende al pasar el ratón. node tests/slot.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../web/src/client/window.js", import.meta.url), "utf8");
assert.match(src, /export function drawSlot\(c, x, y, s, on = false, sel = false\)/);
const cd = readFileSync(new URL("../web/src/client/classicdialog.js", import.meta.url), "utf8");
assert.match(cd, /drawSlot\(g\.ctx, this\.mx - 1, y - 2, 18, over\)/, "las bolas usan la casilla común");
console.log("OK slot");
