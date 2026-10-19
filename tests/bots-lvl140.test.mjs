// F1 → Bots nivel 140 y modo «todos contra todos» (v0.85.80).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { canFight, MAX_LEVEL } from "../web/src/shared/systems/combatsys.js";
import { isCaster } from "../web/src/shared/systems/builds.js";
import { DEBUG } from "../web/src/shared/systems/debug.js";
const dir = new URL("../web/data/", import.meta.url), json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: json("arefarm.spawns.json"), maps: {}, rng: seededRandom(5) });
const names = ["Aldric", "Cora", "Brann", "Dana", "Edda", "Finn", "Gaia", "Hugo", "Ilsa", "Joss", "Kira", "Lars", "Mira", "Nils", "Orla", "Pike", "Quin", "Rhea", "Sven", "Tora", "Ulla", "Vera", "Wren", "Xena", "Yara", "Zed", "Abel", "Bea", "Cai", "Dov", "Eli", "Fay", "Gus", "Hal", "Ivo", "Jan", "Kit", "Lea", "Moe", "Ned", "Oz", "Pia"];
for (const n of names) a.spawnResident(n);
for (let i = 0; i < 200; i++) a.tick(50);
const all = () => [...a.bots.keys()].map(id => a.worldFor(id).ents.get(id)).filter(Boolean);
assert.ok(all().length >= 40, "40+ bots");
const n = a.bots140();
assert.ok(n >= 40, "todos subidos");
let mages = 0;
for (const p of all()) {
  assert.equal(p.level, MAX_LEVEL); assert.equal(p.pool, 0, "puntos repartidos");
  assert.ok(p.gold >= 0);
  const w = a.worldFor(p.id);
  for (const id of Object.keys(p.magic || {})) { const sp = w.magic[id]; if (p.magic[id]) assert.ok(p.stats.int >= sp.reqInt, `${p.name} aprendió una magia que su Int no permite`); }
  if (isCaster(p)) { mages++; assert.ok(p.stats.int >= 70 && Object.values(p.magic || {}).filter(Boolean).length > 5, "el mago compró magias"); }
}
assert.ok(mages > 0, "hay magos");
// todos contra todos: sin bandos
const w = a.farm, [x, y] = all().filter(p => a.worldFor(p.id) === w).slice(0, 2);
w.pvp = true; w.safeAt = () => false; w.ffa = false;
w.ffa = true; assert.ok(canFight(w, x, y), "ffa: se atacan");
w.ffa = false; w.pvp = false;
// el interruptor está apagado por defecto y se puede apagar
assert.ok(!a.ffa); a.setFfa(true); assert.ok(a.ffa); a.setFfa(false); assert.ok(!a.ffa);
// rendimiento: 40+ bots a nivel 140
const t0 = performance.now(); for (let i = 0; i < 400; i++) a.tick(50); const ms = (performance.now() - t0) / 400;
assert.ok(ms < 40, "tick medio " + ms.toFixed(1) + " ms");
console.log("OK bots-lvl140 (tick medio " + ms.toFixed(2) + " ms con " + all().length + " bots)");
