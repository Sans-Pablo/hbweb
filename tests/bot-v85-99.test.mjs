// v0.85.99 bots: sin Magic Missile ni Paralyze a menores (#99), sin hechizos a vecinos de la ciudad (#103/#104), gorro de mago (#70), vender solo en ciudad (#106).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = n => readFileSync(new URL("../web/src/shared/systems/" + n, import.meta.url), "utf8");
const m = src("botmagic.js"), b = src("bot.js");
assert.match(m, /const sameCity = /, "#103/#104: helper sameCity");
assert.match(m, /sameCity\(w, p, t\)\) return false/, "#104: fight no castea a vecinos");
assert.match(m, /!sameCity\(w, p, e\)/, "#103: sin Detect Invisibility a vecinos");
assert.match(m, /MINOR_HP/, "#99: Paralyze solo a monstruos no menores");
assert.match(m, /noMM/, "#99: sin Magic Missile si hay otro ataque");
assert.match(b, /Wizard-Hat/, "#70: gorro/sombrero de mago");
assert.match(b, /obs\. 106/, "#106: viaje a la ciudad a vender");
console.log("OK bot-v85-99");
