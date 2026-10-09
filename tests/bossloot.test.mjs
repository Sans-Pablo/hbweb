// Cada rey suelta siempre un único de Item.cfg. node tests/bossloot.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { killNpc } from "../web/src/shared/systems/npcsys.js";
import { BOSS_UNIQUE } from "../web/src/shared/rarity.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const farm = new Uint8Array(readFileSync(new URL("arefarm.bin", dir)));
for (const k of [1, 2, 3, 4]) {
  const a = new Adventure({ grid: new Grid(meta.w, meta.h, farm), start: meta.start, npcDb, data, spawns: [], maps: {}, rng: seededRandom(30 + k) });
  const id = a.addPlayer("rey" + k), p = a.farm.ents.get(id);
  assert.ok(a.command(id, { t: "dbg", op: "crypt", level: k * 5 }));
  const w = a.worldFor(id); p.hp = p.maxHp = 1e6;
  const boss = [...w.ents.values()].find(e => e.boss === k && !e.aux);
  assert.ok(boss, "rey " + k);
  const evs = []; const em = w.emit.bind(w); w.emit = e => { evs.push(e); em(e); };
  killNpc(w, boss, p);
  for (let i = 0; i < 200; i++) a.tick(50);
  const d = evs.find(e => e.t === "drop" && e.r === 3);
  assert.ok(d && BOSS_UNIQUE[k].includes(d.item), "único del rey " + k + ": " + JSON.stringify(d));
}
console.log("OK");
