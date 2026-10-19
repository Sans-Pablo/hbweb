// v0.85.81: log de acciones admin (dbgact) y gestión de maná/horda de los bots (replay zzzz_620)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette } from "../web/src/shared/dungeon.js";
import { manaFloor, hordeAround, npcsNear } from "../web/src/shared/systems/botmagic.js";
const dir = new URL("../web/data/", import.meta.url), J = f => JSON.parse(readFileSync(new URL(f, dir)));
const meta = J("map.json"), npcDb = J("npc.json");
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
setDungeonPalette(J("dungeon_palette.json"));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL(meta.map + ".bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {} });
const id = a.addPlayer("probador"), p = a.farm.ents.get(id), w = a.worldFor(id);
// 1) dbgact: antes/después de cada orden admin
const ev = []; const emit = w.emit.bind(w); w.emit = e => { if (e.t === "dbgact") ev.push(e); return emit(e); };
p.stats.vit = 200; a.command(id, { t: "dbg", op: "gold", n: 777 });
assert.equal(ev.length, 1, "una orden dbg emite un dbgact");
assert.equal(ev[0].op, "gold"); assert.ok(ev[0].change.gold, "cambio de oro registrado"); assert.equal(ev[0].change.gold[1] - ev[0].change.gold[0], 777);
a.command(id, { t: "dbg", op: "level", n: 30 });
assert.ok(ev[1].change.lvl, "nivel antes/después"); assert.equal(ev[1].after.lvl, 30);
// 2) maná y horda
const mk = (o = {}) => ({ kind: "npc", hp: 50, x: 5, y: 5, ...o });
const me = { id: "m", kind: "player", x: 5, y: 5, maxMp: 780, mp: 100, stats: { int: 200, mag: 200 }, skills: { 4: 100 }, magic: { 91: 1 }, eff: {} };
const fw = { time: 1e5, magic: { 91: { name: "Blizzard", mana: 170 } }, fightZone: false, ents: new Map([["a", mk()], ["b", mk({ x: 6 })], ["c", mk({ x: 7 })], ["d", mk({ x: 20 })], ["e", mk({ dead: true })]]) };
assert.equal(hordeAround(fw, me, 3), 3, "cuenta los vivos a <=3 casillas");
assert.equal(npcsNear(fw, me, 30).length, 4);
assert.ok(manaFloor(fw, me) >= 0 && manaFloor(fw, me) <= 780 * 0.6, "reserva acotada al 60 % del maná");
console.log("OK bot-mana-dbgact");
