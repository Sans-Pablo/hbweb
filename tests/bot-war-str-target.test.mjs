// v0.85.86: tras el reset el guerrero bot reparte la Str de su arma objetivo y llega a Barbarian Hammer / Battle Hammer / Battle Axe / Giant Sword / Flameberge
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette } from "../web/src/shared/dungeon.js";
import { errands, BOT_STATS } from "../web/src/shared/systems/bot.js";
import { resetCharacter } from "../web/src/shared/systems/player.js";
import { warTargetNeed } from "../web/src/shared/systems/botweapon.js";
import { EQUIP } from "../web/src/shared/items.js";
import * as R from "../web/src/shared/rules.js";
const dir = new URL("../web/data/", import.meta.url), J = f => JSON.parse(readFileSync(new URL(f, dir)));
const meta = J("map.json"), npcDb = J("npc.json");
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
setDungeonPalette(J("dungeon_palette.json"));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL(meta.map + ".bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {} });
const held = (p, w) => { const u = p.equip[EQUIP.TWOHAND] ?? p.equip[EQUIP.RHAND]; const i = u === undefined ? null : p.bag.find(x => x.uid === u); return i && w.data.item(i.id).name; };
const run = (lvl, flam, wb) => {
  const p = a.spawnBot(null, { level: 1 }), w = a.farm, b = p.bot; b.flam = flam; b.wb = wb || (flam ? "fl59" : "bbh36");
  resetCharacter(w, p, BOT_STATS);                                     // reset: vuelve a Str 14 y recupera los puntos
  p.level = lvl; p.pool = (lvl - 1) * R.LEVELUP_POINTS; p.gold = 100000; for (const s of [8, 9, 10, 14]) p.skills[s] = 100; w.recalc(p);
  for (let i = 0; i < 6; i++) { errands(w, p, b, true); w.recalc(p); }
  return { p, w, n: held(p, w), str: p.stats.str };
};
{ const r = run(140, false); assert.ok(r.str >= 200, "reparte Str 200 para el Barbarian Hammer: " + r.str); assert.equal(r.n, "BarbarianHammer", "nv 140 -> " + r.n); }
{ const r = run(140, true); assert.ok(r.n?.startsWith("Flameberge"), "bot Flameberge -> " + r.n); assert.ok(r.str >= 60); }
{ const r = run(105, false, "gs"); assert.ok(["GiantSword", "BattleAxe"].includes(r.n?.replace(/\+\d$/, "")), "nv 105 (sin Battle/Barbarian, nivel 110) -> " + r.n); }
{ const p = a.spawnBot(null, { level: 1 }); p.pool = 0; assert.equal(warTargetNeed(a.farm, p, p.bot), 0, "sin puntos ni nivel no hay objetivo alcanzable"); }
console.log("OK bot-war-str-target");
