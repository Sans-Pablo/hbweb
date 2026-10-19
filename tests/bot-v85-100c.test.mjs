// v0.85.100: guerrero guardado con poco oro (2-140) compra su arma objetivo; mago PvP mantiene distancia (kite a 5 casillas)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette } from "../web/src/shared/dungeon.js";
import { errands } from "../web/src/shared/systems/bot.js";
import { EQUIP } from "../web/src/shared/items.js";
const dir = new URL("../web/data/", import.meta.url), J = f => JSON.parse(readFileSync(new URL(f, dir)));
const meta = J("map.json"), npcDb = J("npc.json");
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
setDungeonPalette(J("dungeon_palette.json"));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL(meta.map + ".bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {} });
for (const gold of [2, 140]) {
  const id = a.addPlayer("w" + gold), p = a.farm.ents.get(id), w = a.worldFor(id);
  p.res = { arch: "warrior" }; p.level = 140; p.stats.str = 220; p.stats.dex = 100; p.pool = 0; p.gold = gold;
  for (const s of [8, 9, 10, 14]) p.skills[s] = 100;
  w.recalc?.(p);
  errands(w, p, { bad: new Set(), wb: "bbh36" }, true);
  const u = p.equip[EQUIP.TWOHAND] ?? p.equip[EQUIP.RHAND], it = u === undefined ? null : p.bag.find(x => x.uid === u);
  assert.equal(it && w.data.item(it.id).name, "BarbarianHammer", `con ${gold} de oro compra y equipa su arma objetivo`);
}
console.log("OK bot-v85-100c");
