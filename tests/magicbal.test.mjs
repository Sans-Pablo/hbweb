// Balance de magias según MAX_LEVEL (levelcap.js): Int mínima alcanzable y oro razonable.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GameData } from "../web/src/shared/data.js";
import { MAX_LEVEL, intFactor, costFactor } from "../web/src/shared/levelcap.js";
import { PRESETS } from "../web/src/shared/systems/player.js";
const J = n => JSON.parse(readFileSync(new URL("../web/data/" + n, import.meta.url)));
const raw = J("magic.json"), d = new GameData({ items: J("items.json"), magic: raw, npcs: J("npc.json") }), m = d.magic;
const maxInt = Math.min(200, PRESETS.mage.int + (MAX_LEVEL - 1) * 3);
for (const [id, s] of Object.entries(m)) if (s.cost >= 0) assert.ok(s.reqInt <= maxInt - 30, `${s.name}: Int ${s.reqInt} inalcanzable a nivel ${MAX_LEVEL}`);
assert.equal(m[0].reqInt, 18); assert.equal(m[0].cost, 100);              // los primeros círculos no cambian
assert.equal(m[91].reqInt, Math.round(30 + (195 - 30) * intFactor), "Blizzard"); assert.ok(m[91].cost <= raw[91].cost);
assert.ok(m[60].reqInt <= raw[60].reqInt && m[74].cost <= raw[74].cost, "reescalado");
assert.equal(raw[91].reqInt, 195, "el JSON original no se toca");
console.log("OK magicbal");
