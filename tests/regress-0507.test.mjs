// 0.50.7: frases de bot sin LLM (saludo/idle/admirar), jefe glacial con tormentas, F4 se reinicia al cambiar de summon.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const rd = f => readFileSync(new URL("../web/src/" + f, import.meta.url), "utf8");
const res = rd("shared/systems/residents.js"), bos = rd("shared/systems/bosses.js"), hud = rd("client/hud.js");
for (const k of ["greet:", "again:", "idle:", "admire:"]) assert.ok(res.includes("  " + k + " [["), "CANNED " + k);
assert.ok(res.includes('say2(adv, w, p, "admire"'), "los bots admiran un summon al máximo");
assert.ok(bos.includes("DYN.ICESTORM") && !bos.includes('kind: "frost"'), "el jefe glacial usa Tormentas de Hielo, sin suelo");
assert.ok(hud.includes("this.ballUid !== bu"), "cambiar de summon reinicia F4");
console.log("OK regress-0507");
