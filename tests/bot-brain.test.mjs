// El «cerebro» del habitante observado + descenso de cripta con reloj prorrogado + equipo de cripta.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { brainOf, modeOf } from "../web/src/shared/systems/residents.js";
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
  // ficha completa del centro de observación
  assert.ok(b.name === p.name && ["dead","rest","follow","delve-go","delve","pit","trip","pet","travel","flee","fight","farm","idle","trade"].includes(b.mode) && modeOf(a, p, a.worldFor(p.id)) === b.mode);
  assert.ok(Array.isArray(b.quests) && b.quests.every(q => [0, 1, 2].includes(q.st)) && Array.isArray(b.mates) && Array.isArray(b.equip) && Array.isArray(b.skills) && Array.isArray(b.rel));
  assert.ok(b.st && typeof b.ilvl === "number" && b.exp >= 0 && b.exp <= 100 && b.qa && b.qa.pvp && b.qa.pet && "guild" in b && "delveInfo" in b);
}
// party formal: los miembros (bots) salen en la ficha, con el nombre de su mapa
{ const [x, y] = a.residents(); x.party = y.party = { id: 9, names: [x.name, y.name], lvls: [x.level, y.level], maps: ["", ""] };
  const b = brainOf(a, x); assert.deepEqual(b.mates.map(m => m.n).sort(), [x.name, y.name].sort(), "party formal en mates"); assert.ok(b.mates.every(m => typeof m.map === "string" && m.map)); assert.equal(b.party.length, 2); }
console.log("OK bot-brain");
