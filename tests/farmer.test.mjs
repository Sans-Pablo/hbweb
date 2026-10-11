// BUG-013: granjero de Aresfarm en (77,106) con rol "farmer" y aspecto de tendero (tipo 15).
import assert from "node:assert/strict";
import { EXTRA_CITIZENS } from "../web/src/shared/systems/citizens.js";
const f = EXTRA_CITIZENS.arefarm.find(c => c.role === "farmer");
assert.ok(f && f.x === 77 && f.y === 106, "granjero en 77,106");

import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
const dir = new URL("../web/data/", import.meta.url), J = x => JSON.parse(readFileSync(new URL(x, dir)));
const meta = J("map.json"), npcDb = J("npc.json");
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL(meta.map + ".bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {} });
const n = [...a.farm.ents.values()].find(e => e.kind === "citizen" && e.role === "farmer");
assert.ok(n, "granjero presente en Aresfarm"); assert.equal(n.type, 15, "se ve como tendero");
console.log("OK");
