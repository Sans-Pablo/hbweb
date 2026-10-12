// Morir y volver a subir no regala puntos de atributo: lo gastado de niveles perdidos se paga con los siguientes niveles.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import * as R from "../web/src/shared/rules.js";
import { deathPenalty, giveExp } from "../web/src/shared/systems/combatsys.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 3; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: J("npc.json") });
const w = new World({ grid, npcDb: J("npc.json"), data, spawns: [], rng, start: [10, 10] });
const p = w.ents.get(w.addPlayer("T", null, { gender: 1, stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 } }));
const total = () => Object.values(p.stats).reduce((a, b) => a + b, 0) + p.pool - p.lvDebt;
p.level = 10; p.exp = R.expForLevel(10); p.pool = 0; p.stats.str += 27; w.recalc(p);   // 9 niveles ya repartidos
const t0 = total();
p.exp = R.expForLevel(10);
for (let i = 0; i < 5; i++) { deathPenalty(w, p); }
assert.ok(p.level < 10, "bajó de nivel");
assert.ok(p.lvDebt > 0, "queda deuda de puntos");
const lost = 10 - p.level;
assert.equal(p.lvDebt, 3 * lost);
while (p.level < 10) giveExp(w, p, 50);
assert.equal(p.level, 10);
assert.equal(p.pool, 0, "volver a subir no da puntos nuevos");
assert.equal(p.lvDebt, 0);
console.log("OK level-debt");
