// Los bots usan crítico (Alt+clic) y dash con maestría 100
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
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(21) });
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
a.spawnResident("Aldric");
import { spawnFrom } from "../web/src/shared/systems/npcsys.js";
const A = a.residents().find(x => x.name === "Aldric"), w = a.farm;
const sword = data.named("LongSword");
const inst = { uid: w.nextItem++, id: sword.id, count: 1, life: sword.maxLife };
A.level = 60; A.bag.push(inst); A.equip[sword.equipPos ?? 8] = inst.uid; w.recalc(A);
for (const k of [3,4,5,6,7,8,9,10,11,12]) A.skills[k] = 100;  A.superAttack = 3; A.sp = A.maxSp;   // cualquier arma que se equipe el bot tiene maestría
const seen = { crit: 0, dash: 0 };
for (let i = 0; i < 40; i++) {
  const g = { name: "Slime", rect: [A.x + 2, A.y, A.x + 2, A.y], alive: 0, max: 0, respawn: false };
  spawnFrom(w, g);
  const n0 = w.events.length;
  tick(8000);
  for (const e of w.events.slice(n0)) if (e.t === "crit" && e.id === A.id) { if (e.crit) seen.crit++; if (e.dash) seen.dash++; }
  A.superAttack = 3; A.sp = A.maxSp;
  if (seen.crit && seen.dash) break;
}
assert.ok(seen.crit > 0 || seen.dash > 0, "el bot usa crítico o dash: " + JSON.stringify(seen));
console.log("OK bot-crit", JSON.stringify(seen));
