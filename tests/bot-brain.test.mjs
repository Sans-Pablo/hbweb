// El «cerebro» del habitante observado + descenso de cripta con reloj prorrogado + equipo de cripta.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { brainOf } from "../web/src/shared/systems/residents.js";
const dir = new URL("../web/data/", import.meta.url), json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: json("arefarm.spawns.json"), maps: {}, rng: seededRandom(3) });
for (const n of ["Aldric", "Cora", "Brann"]) a.spawnResident(n);
for (let i = 0; i < 2400; i++) a.tick(50);
for (const p of a.residents()) {
  const b = brainOf(a, p);
  assert.equal(b.id, p.id); assert.ok(b.mode && b.map && b.lv >= 1 && Array.isArray(b.log) && Array.isArray(b.near) && b.goal);
  JSON.stringify(b);
}
console.log("OK bot-brain");
