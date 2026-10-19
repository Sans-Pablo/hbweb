// v0.85.89: tras maxOut cada bot llega a la tabla aprobada, lleva su arma y compra los hechizos que su Int permite
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette } from "../web/src/shared/dungeon.js";
import { maxOut } from "../web/src/shared/systems/bot.js";
import { WAR_BUILDS } from "../web/src/shared/systems/builds.js";
import { EQUIP } from "../web/src/shared/items.js";
const dir = new URL("../web/data/", import.meta.url), J = f => JSON.parse(readFileSync(new URL(f, dir)));
const meta = J("map.json"), npcDb = J("npc.json");
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
setDungeonPalette(J("dungeon_palette.json"));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL(meta.map + ".bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {} });
const held = (p, w) => { const u = p.equip[EQUIP.TWOHAND] ?? p.equip[EQUIP.RHAND]; const i = u === undefined ? null : p.bag.find(x => x.uid === u); return i && w.data.item(i.id).name.replace(/\+\d$/, ""); };
const TABLA = { bh: [182, 10], bh36: [182, 36], bbh: [200, 10], bbh36: [200, 36], gs: [160, 10], gs36: [160, 36], gs59: [160, 59], ba: [170, 10], ba36: [170, 36], fl: [130, 10], fl36: [130, 36], fl59: [130, 59] };
for (const [wb, [str, int]] of Object.entries(TABLA)) {
  const p = a.spawnBot(null, { level: 1 }); p.bot.wb = wb; p.bot.flam = wb.startsWith("fl"); p.bot.farmer = false; maxOut(a.farm, p);
  assert.equal(p.stats.str, str, wb + " Str " + p.stats.str); assert.equal(p.stats.int, int, wb + " Int"); assert.ok(p.stats.dex >= 120, wb + " Dex"); assert.equal(p.stats.mag, 10);
  assert.ok(WAR_BUILDS[wb].weapons.includes(held(p, a.farm)), wb + " -> " + held(p, a.farm));
  if (int >= 36) assert.ok(p.magic[35], wb + " Paralyze"); if (int === 59) assert.ok(p.magic[50], wb + " Berserk"); }
for (const [mb, int, mag, spell] of [["blizzard", 195, 100, 91], ["control", 200, 100, 95], ["support", 133, 200, 72]]) {
  const p = a.spawnBot(null, { level: 1, mage: true }); p.bot.farmer = false; p.bot.mb = mb; maxOut(a.farm, p);
  assert.equal(p.stats.int, int, mb + " Int"); assert.equal(p.stats.mag, mag, mb + " Mag"); assert.ok(p.magic[spell], mb + " compra " + spell);
  if (mb === "support") assert.equal(p.stats.str, 40, "soporte Str 40 (cota + escudo torre)"); }
console.log("OK bot-builds88");
