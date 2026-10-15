// Cada especie de compañero tiene su propio objeto-bola (ids 2001+, items.json) con su icono en la hoja ip20; GreenBall..PearlBall (651..655) siguen siendo botín.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { SPECIES } from "../web/src/shared/systems/companion.js";
import { setDungeonPalette } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url), J = f => JSON.parse(readFileSync(new URL(f, dir)));
const items = J("items.json"), spr = J("sprites.json"), meta = J("map.json"), npcDb = J("npc.json");
const sp = Object.keys(SPECIES), ids = sp.map(s => SPECIES[s][1]);
assert.equal(new Set(ids).size, sp.length, "una bola distinta por especie");
sp.forEach((s, i) => {
  const d = items[ids[i]]; assert.ok(d, "falta el objeto de " + s); assert.ok(ids[i] > 1913 && ![651, 652, 653, 654, 655].includes(ids[i]), "id propio, sin renumerar los de Item.cfg");
  assert.equal(d.display, s.replace(/-/g, " ") + " Ball"); assert.equal(d.category, 31); assert.equal(d.sprite, 23); assert.ok(d.spriteFrame < spr.ip20.frames.length);
});
assert.equal(items[651].name, "GreenBall"); assert.equal(items[655].name, "PearlBall");   // el botín original queda intacto
assert.equal(spr.ip20.frames.length, sp.length); assert.ok(readFileSync(new URL("sprites/ip20.png", dir)).length > 1000, "hoja de iconos horneada");
// las órdenes que fabrican bolas dan el objeto de la especie
const data = new GameData({ items, magic: J("magic.json"), npcs: npcDb }); setDungeonPalette(J("dungeon_palette.json"));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL(meta.map + ".bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {} });
const id = a.addPlayer("bolas"), p = a.farm.ents.get(id);
a.command(id, { t: "dbg", op: "ball", sp: "Orc", lvl: 3 }); a.command(id, { t: "dbg", op: "ball", sp: "Demon", lvl: 3 });
for (const s of ["Orc", "Demon"]) assert.ok(p.bag.some(i => i.comp && i.comp.sp === s && i.id === SPECIES[s][1]), "bola de " + s);
console.log("OK bolas-especie");
