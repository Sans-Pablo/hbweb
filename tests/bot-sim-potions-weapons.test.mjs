// v0.85.86: simulación corta de bots (mago + guerrero nv 140): las armas son las de daño máximo y no se bebe con maná/vida llenos
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
const used = [], w0 = a.farm, cmd0 = a.command.bind(a);
a.command = (id, c) => { if (c?.t === "use") { const p = a.farm.ents.get(id); const it = p?.bag.find(i => i.uid === c.uid); if (it) used.push({ id, name: data.item(it.id).name, hp: p.hp / p.maxHp, mp: p.mp / (p.maxMp || 1) }); } return cmd0(id, c); };
const M = a.spawnBot(null, { level: 60, mage: true }), W = a.spawnBot(null, { level: 140 });
for (const p of [M, W]) { p.gold = 100000; p.hp = p.maxHp; p.mp = p.maxMp; }
// guerrero: compra y equipa el arma de máximo daño de su lista
W.stats.str = 220; W.stats.dex = 100; for (const s of [8, 9, 10, 14]) W.skills[s] = 100; a.farm.recalc(W);
errands(a.farm, W, W.bot, true);
const u = W.equip[EQUIP.TWOHAND], held = u === undefined ? null : data.item(W.bag.find(i => i.uid === u).id).name;
assert.ok(/^(BarbarianHammer|BattleHammer|BattleAxe|GiantSword|Flameberge)/.test(held || ""), `guerrero con arma de la lista: ${held}`);
// 60 s con todo lleno, sin enemigos: ninguna poción
for (let i = 0; i < 1200; i++) a.tick(50);
const bad = used.filter(x => (x.id === M.id || x.id === W.id) && /Potion/.test(x.name) && (x.mp > 0.95 || x.hp > 0.95));
assert.equal(bad.length, 0, "ninguna bebida con depósito lleno: " + JSON.stringify(bad.slice(0, 3)));
console.log("OK bot-sim-potions-weapons (arma: " + held + ", bebidas: " + used.length + ")");
