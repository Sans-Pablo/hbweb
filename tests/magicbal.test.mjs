// Balance de magias para nivel 50: Int mínima alcanzable y oro razonable.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GameData } from "../web/src/shared/data.js";
import { PRESETS } from "../web/src/shared/systems/player.js";
const J = n => JSON.parse(readFileSync(new URL("../web/data/" + n, import.meta.url)));
const raw = J("magic.json"), d = new GameData({ items: J("items.json"), magic: raw, npcs: J("npc.json") }), m = d.magic;
const maxInt = PRESETS.mage.int + 49 * 3;
for (const [id, s] of Object.entries(m)) if (s.cost >= 0) assert.ok(s.reqInt <= maxInt - 30, `${s.name}: Int ${s.reqInt} inalcanzable a nivel 50`);
assert.equal(m[0].reqInt, 18); assert.equal(m[0].cost, 100);              // los primeros círculos no cambian
assert.equal(m[91].reqInt, 113); assert.ok(m[91].cost < 20000 && m[91].cost >= 15000, "Blizzard");
assert.ok(m[60].reqInt < raw[60].reqInt && m[74].cost < raw[74].cost, "reescalado");
assert.equal(raw[91].reqInt, 195, "el JSON original no se toca");
console.log("OK magicbal");
