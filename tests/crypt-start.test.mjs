// Cripta: piso de inicio elegible entre los despejados; tras despejar el 10 y salir se entra en el 11 (sin repetir el jefe)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const mj = json("maps/middled1n.json");
const maps = { middled1n: { meta: mj, grid: new Grid(mj.w, mj.h, new Uint8Array(readFileSync(new URL("maps/middled1n.bin", dir)))) } };
const session = () => new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(54) });
function enter(a, id, cmd) {
  const w = a.worldFor(id), p = w.ents.get(id);
  w.grid.release(p.x, p.y, p.id); p.x = p.fx = 79; p.y = p.fy = 70; w.grid.occupy(79, 70, p.id);
  return a.command(id, { t: "portal", portal: "mid-entry", ...cmd });
}
const fresh = () => { const a = session(), id = a.addPlayer("cs"), p = a.farm.ents.get(id); p.quests.u.crypt = 20; p.quests.u.trade = 1; return { a, id, p }; };
test("despejó el 10 y salió: continuar entra en el 11", () => {
  const { a, id, p } = fresh(); p.delve = { deepest: 10, cleared: 10 };
  assert.ok(enter(a, id, { restart: false }));
  assert.equal(a.worldFor(id).map.level, 11);
});
test("sin despejar el 10 (deepest 10, cleared 9) continúa en el 10", () => {
  const { a, id, p } = fresh(); p.delve = { deepest: 10, cleared: 9 };
  assert.ok(enter(a, id, { restart: false }));
  assert.equal(a.worldFor(id).map.level, 10);
});
test("level elige el piso de inicio (acotado al máximo) y restart vuelve al 1", () => {
  const { a, id, p } = fresh(); p.delve = { deepest: 10, cleared: 10 };
  enter(a, id, { level: 6 }); assert.equal(a.worldFor(id).map.level, 6);
  const f = fresh(); f.p.delve = { deepest: 4, cleared: 3 };
  enter(f.a, f.id, { level: 15 }); assert.equal(f.a.worldFor(f.id).map.level, 4);
  const g = fresh(); g.p.delve = { deepest: 10, cleared: 10 };
  enter(g.a, g.id, { restart: true }); assert.equal(g.a.worldFor(g.id).map.level, 1);
});
test("cleared se guarda y se carga", () => {
  const { a, id, p } = fresh(); p.delve = { deepest: 7, cleared: 6 };
  assert.equal(a.saveOf(id).delve.cleared, 6);
});
