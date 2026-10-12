// Mago de rango (0.78.0): un estudioso (no de apoyo) con summon de escuela vivo y con maná mantiene la distancia y retrocede; sin maná en el summon pelea cuerpo a cuerpo.
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
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n", "gshop_1f"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(33) });
a.report = () => {};
const run = (ms) => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
import { rangedMage, isSupport, MAGE_RANGE } from "../web/src/shared/systems/bot.js";
import { dist } from "../web/src/shared/const.js";
for (const n of ["Garrick","Korin","Talia"]) a.spawnResident(n);
const mages = ["Garrick","Korin","Talia"].map(n => a.residents().find(x => x.name === n)).filter(s => s.res.arch === "scholar" && !isSupport(s));
for (const s of mages) { s.level = 30; s.gold = 8000; s.hp = s.maxHp; s.res._petAt = 1; }
assert.ok(mages.length > 0, "hay algún mago que no es de apoyo");
let near = 0, far = 0, seen = 0;
for (let m = 0; m < 9 * 60 * 2; m++) {
  run(500);
  for (const s of mages) { const w = a.worldFor(s.id), t = s.bot.target; if (!t || t.dead || t.kind !== "npc") continue; const d = dist(s, t);
    if (rangedMage(w, s)) { seen++; if (d <= MAGE_RANGE.max) far++; if (d <= 1) near++; } }
}
console.log({ seen, far, near });
assert.ok(seen > 0, "algún mago llegó a combatir a rango con su summon");
assert.ok(far > 0, "se mantuvo a 8 casillas o menos del monstruo");
assert.ok(near < seen * 0.2, "con maná en el summon casi nunca pelea pegado al monstruo");
console.log("OK mage-kite");
