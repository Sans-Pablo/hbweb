// Bots magos: stats INT/MAG, aprenden hechizos, lanzan (ataque y apoyo), liberan las manos y puntúan el equipo mágico.
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
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(5) });
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
import * as Inv from "../web/src/shared/inventory.js";
import { errands } from "../web/src/shared/systems/bot.js";
import { SKILL } from "../web/src/shared/skills.js";

import * as BM from "../web/src/shared/systems/botmagic.js";
import * as BotMod from "../web/src/shared/systems/bot.js";
import { isCaster, isMage } from "../web/src/shared/systems/builds.js";
import { EQUIP } from "../web/src/shared/items.js";
const P = a.spawnBot(null, { level: 20, mage: true }), w = a.farm, b = P.bot;
assert.ok(P.stats.int >= BotMod.BOT_MAGE_STATS.int && P.stats.int > P.stats.str, "el bot mago nace con INT");
assert.ok(P.stats.mag >= 12, "y con MAG");
assert.ok(isMage(P) && isCaster(P), "es mago");
// aprende: sin INT/oro no; con ellos sí
const k0 = Object.keys(P.magic || {}).length; P.gold = 0; assert.ok(!BM.study(w, P, b, () => {}) && Object.keys(P.magic).length === k0, "sin oro no aprende");
P.stats.int = 40; P.gold = 5000; w.recalc(P);
let n = 0; while (BM.study(w, P, b, () => {}) && n++ < 20);
assert.ok(P.magic[1] && P.magic[0], "aprende Heal y Magic Missile");
assert.ok(P.gold < 5000, "paga las magias");
// manos: escudo fuera
const sh = data.named("WoodShield") || data.named("LeatherShield");
if (sh) { const inst = { uid: w.nextItem++, id: sh.id, count: 1, life: 300 }; P.bag.push(inst); P.level = Math.max(P.level, sh.levelLimit || 1); Inv.equip(P, data, inst.uid); w.recalc(P);
  if (P.equip[EQUIP.LHAND] !== undefined) { assert.ok(!BM.handsOk(P), "con escudo no puede lanzar"); b.handsAt = -1e9; assert.ok(BM.ensureHands(a, w, P, b, () => {}), "se lo quita"); assert.ok(BM.handsOk(P), "manos libres"); } }
// cura propia
P.mp = P.maxMp; P.hp = Math.floor(P.maxHp * 0.3); P.lastCast = -1e9; b.castAt = -1e9; w.time += 5000;
const hp0 = P.hp, mp0 = P.mp; assert.ok(BM.support(a, w, P, b, () => {}), "lanza la cura"); tick(2000);
assert.ok(P.mp < mp0 || P.hp > hp0, "se cura con magia o gasta maná al intentarlo");
// puntuación de equipo mágico
// ataque: con maná y un monstruo a tiro lanza un hechizo de ataque (no en zona segura)
P.hp = P.maxHp; P.mp = P.maxMp; P.lastCast = -1e9; b.castAt = -1e9; w.time += 5000;
const spot = w.freeSpotNear(P.x + 3, P.y);
const tgt = { name: "Slime", x: spot[0] ?? spot.x ?? P.x + 3, y: spot[1] ?? spot.y ?? P.y, kind: "npc" };
if (!w.safeAt(P.x, P.y)) { const mp1 = P.mp; assert.ok(BM.fight(a, w, P, b, tgt, () => {}), "lanza un ataque"); assert.ok(P.mp <= mp1, "gasta maná"); }
// equipo mágico: un bastón con ahorro de maná vale más para un lanzador
const eff = { effectType: 14, v1: 2, v2: 20, id: 1 };
assert.ok(BM.casterBonus(eff) > 0 && BM.casterBonus({ effectType: 1 }) === 0, "bonus de equipo mágico");
console.log("OK bot-mage");
