// Descanso de los bots solo en zona segura (ciudad o granja): fuera de ella vuelven con Recall; si les pegan, se defienden.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { DEBUG } from "../web/src/shared/systems/debug.js";
import { restSafe } from "../web/src/shared/systems/bot.js";
import { seededRandom } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {}, rng: seededRandom(5) });
DEBUG.enabled = true;
const id = a.addPlayer("Admin", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } });
assert.ok(a.command(id, { t: "dbg", op: "bot", n: 1, level: 25 }));
const [B] = [...a.bots.values()];
B.bot.owner = null;
const w = a.farm, tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
// el centro de la granja no es zona segura; el borde sí
const mid = [Math.floor(w.grid.w / 2), Math.floor(w.grid.h / 2)];
assert.equal(restSafe({ pvp: true, map: { kind: "field" }, safeAt: () => true }, B), false, "Promise Land nunca es sitio de descanso");
assert.equal(restSafe({ pvp: false, map: { kind: "dungeon" }, safeAt: () => true }, B), false, "la cripta tampoco");
assert.equal(restSafe({ pvp: false, map: { kind: "field" }, safeAt: () => true }, B), true, "ciudad o granja sí");
assert.equal(restSafe({ pvp: false, map: { kind: "field" }, safeAt: () => false }, B), false, "campo abierto no");
// herido y fuera de zona segura: usa Recall en vez de quedarse quieto
const spot = w.freeSpotNear(mid[0], mid[1]);
if (!w.safeAt(spot[0], spot[1])) {
  w.grid.release(B.x, B.y, B.id); B.x = B.fx = spot[0]; B.y = B.fy = spot[1]; w.grid.occupy(B.x, B.y, B.id);
  B.bag = B.bag.filter(i => !/Potion/.test(data.item(i.id)?.name || ""));
  B.hp = Math.floor(B.maxHp * 0.4); B.lastCombat = -1e9; B.bot.rest = true; B.bot.recallAt = -1e9; B.bot.next = 0; B.bot.errand = 1e12;
  tick(1500);
  assert.ok(B.bot.log.some(l => /zona segura|Recall/.test(l)) || B.recallTok || w.safeAt(B.x, B.y), "fuera de zona segura pide Recall: " + B.bot.log.slice(-4).join(" | "));
  // si le pegan mientras tanto, deja de descansar y se defiende
  B.lastCombat = w.time; B.bot.next = 0; B.bot.recallAt = w.time; B.recallTok = 0;
  tick(200);
  assert.ok(B.bot.log.some(l => /me defiendo/.test(l)), "se defiende: " + B.bot.log.slice(-4).join(" | "));
}
console.log("OK bot-rest");
