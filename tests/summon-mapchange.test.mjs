// v0.85.100: las invocaciones y cadáveres del dueño desaparecen al cambiar de mapa
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "gshop_1f", "wrhus_1f"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(21) });
a.spawnResident("Aldric");
const A = a.residents().find(x => x.name === "Aldric"), w = a.farm;
const spot = w.freeSpotNear(A.x + 2, A.y);
const id = 99001; w.ents.set(id, { id, kind: "npc", master: A.id, dead: true, x: spot[0], y: spot[1], hp: 0 });
const to = a.staticWorld("gshop_1f");
assert.ok(a.transfer(A, w, to, to.start), "traspaso");
assert.ok(![...w.ents.values()].some(e => e.master === A.id), "no queda nada del dueño en el mapa que deja");
console.log("OK summon-mapchange");
// Bot ocioso dentro del warehouse: acaba saliendo al exterior
const wh = a.staticWorld("wrhus_1f");
if (wh) {
  const B = a.residents().find(x => x.name === "Aldric");
  a.transfer(B, B.world || a.locations.get(B.id), wh, wh.home || wh.start);
  for (let i = 0; i < 20 * 120; i++) a.tick(50);
  assert.notEqual(a.locations.get(B.id).map.id, "wrhus_1f", "el bot sale del warehouse");
}
