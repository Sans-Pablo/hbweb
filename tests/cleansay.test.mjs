// cleanSay: el texto del LLM nunca debe llegar al chat con restos de JSON.
import assert from "node:assert/strict";
import { cleanSay } from "../web/src/shared/systems/residents.js";
assert.equal(cleanSay('{"say":"Party with zzzz, no problem","do":"follow"}'), "Party with zzzz, no problem");
assert.equal(cleanSay('{"say":"hola amigo'), "hola amigo");
assert.ok(!/[{}"]/.test(cleanSay('{"do":"idle"} hola')));
console.log("OK cleansay");
