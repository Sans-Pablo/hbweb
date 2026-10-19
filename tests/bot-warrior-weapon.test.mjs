// v0.85.82: el guerrero apunta a la arma de mayor daño que pueda usar (Barbarian Hammer > Battle Hammer > Battle Axe > Giant Sword; parte con Flameberge)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette } from "../web/src/shared/dungeon.js";
import { errands } from "../web/src/shared/systems/bot.js";
import { weaponDps, weaponScore, isMelee, flamOf, FLAM_SHARE } from "../web/src/shared/systems/botweapon.js";
import { EQUIP } from "../web/src/shared/items.js";
const dir = new URL("../web/data/", import.meta.url), J = f => JSON.parse(readFileSync(new URL(f, dir)));
const meta = J("map.json"), npcDb = J("npc.json");
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
setDungeonPalette(J("dungeon_palette.json"));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL(meta.map + ".bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {} });
const byName = n => [...data.items.values()].find(d => d && d.name === n);
for (const n of ["BarbarianHammer", "BattleHammer", "BattleAxe", "GiantSword", "Flameberge"]) { const d = byName(n); assert.ok(d && isMelee(d) && d.equipPos === 9, `${n} existe y es a dos manos`); }
const mk = (name, o = {}) => {
  const id = a.addPlayer(name), p = a.farm.ents.get(id), w = a.worldFor(id);
  p.res = { arch: "warrior" }; p.level = o.level ?? 140; p.stats.str = o.str ?? 220; p.stats.dex = 100; p.pool = 0; p.gold = o.gold ?? 100000;
  for (const s of [8, 9, 10, 14]) p.skills[s] = 100;
  w.recalc?.(p); return { p, w, b: { bad: new Set(), flam: !!o.flam, wb: o.flam ? "fl59" : "bbh36" } };
};
const wornName = (p, w) => { const u = p.equip[EQUIP.TWOHAND] ?? p.equip[EQUIP.RHAND]; const i = u === undefined ? null : p.bag.find(x => x.uid === u); return i && w.data.item(i.id).name; };
// 1) puntuación: orden de prioridad con Str y habilidad altas
{ const { p, w, b } = mk("w1"); const s = n => weaponScore(w, p, b, byName(n), null);
  assert.ok(weaponDps(p, byName("BarbarianHammer")) > weaponDps(p, byName("BattleAxe")), "el martillo bárbaro pega más");
  assert.ok(s("BarbarianHammer") > s("BattleHammer") && s("BarbarianHammer") > s("BattleAxe") && s("BarbarianHammer") > s("Flameberge"), "el arma de su build (bbh36) puntúa más"); }
// 2) bot sin Flameberge y rico: compra el martillo bárbaro y no lleva escudo
{ const { p, w, b } = mk("w2"); errands(w, p, b, true);
  assert.equal(wornName(p, w), "BarbarianHammer", "equipa Barbarian Hammer"); assert.equal(p.equip[EQUIP.LHAND], undefined, "sin escudo con arma a dos manos"); }
// 3) Str baja (peso del martillo = 200 de Str): cae a una arma que pueda usar
{ const { p, w, b } = mk("w3", { str: 100 }); errands(w, p, b, true);
  const n = wornName(p, w); assert.ok(n && n !== "BarbarianHammer" && n !== "BattleHammer", `con Str 100 no usa ${n}`); }
// 4) nivel bajo: nada con levelLimit mayor
{ const { p, w, b } = mk("w4", { level: 30 }); errands(w, p, b, true); const n = wornName(p, w); assert.ok(!n || (byName(n).levelLimit <= 30), "respeta el nivel"); }
// 5) Flameberge por bot, determinista
{ const { p, w, b } = mk("w5", { flam: true }); errands(w, p, b, true); assert.ok(wornName(p, w)?.startsWith("Flameberge"), "el bot de Flameberge la elige"); }
{ const w = { rng: (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })() }; let n = 0; for (let i = 0; i < 200; i++) if (flamOf(w, {})) n++;
  assert.ok(n > 10 && n < 100, `reparto razonable (~${FLAM_SHARE * 100}%): ${n}/200`);
  const b = {}; const v = flamOf(w, b); assert.equal(flamOf(w, b), v, "se decide una vez"); }
console.log("OK bot-warrior-weapon");
