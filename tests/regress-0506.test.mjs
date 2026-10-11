// Regresiones 0.50.6: tratos de bots con frases fijas sin modelo de lenguaje.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s = readFileSync(new URL("../web/src/shared/systems/residents.js", import.meta.url), "utf8");
assert.ok(/const CANNED = \{/.test(s) && /typeof adv\.llm !== "function"/.test(s), "say2 tiene frases fijas de trato");
const m = readFileSync(new URL("../web/src/shared/systems/magicsys.js", import.meta.url), "utf8");
assert.ok(/tgt\.master === p\.id/.test(m), "áreas no dañan a los summons propios");
console.log("OK regress-0506");
