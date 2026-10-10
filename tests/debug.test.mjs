// Herramientas de prueba (F1 → Herramientas): órdenes dbg.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { DEBUG } from "../web/src/shared/systems/debug.js";
import { followersOf } from "../web/src/shared/systems/npcsys.js";
import * as T from "../web/src/shared/systems/talents.js";
import { setDungeonPalette } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url), J = f => JSON.parse(readFileSync(new URL(f, dir)));
const meta = J("map.json"), npcDb = J("npc.json");
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
setDungeonPalette(J("dungeon_palette.json"));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL(meta.map + ".bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {} });
const id = a.addPlayer("probador"), p = a.farm.ents.get(id);
const dbg = c => a.command(id, { t: "dbg", ...c });
const w = () => a.worldFor(id);

assert.ok(dbg({ op: "level", n: 30 })); assert.equal(p.level, 30); assert.ok(p.pool >= 87);
dbg({ op: "gold", n: 5000 }); assert.ok(p.gold >= 5000);
dbg({ op: "give", name: "RedPotion", count: 20 }); assert.ok(p.bag.some(i => i.id === data.named("RedPotion").id && i.count >= 20));
dbg({ op: "spawn", name: "Orc", count: 3 }); assert.equal([...w().ents.values()].filter(e => e.name === "Orc").length, 3);
dbg({ op: "killall" }); a.tick(100); assert.equal([...w().ents.values()].filter(e => e.kind === "npc" && !e.dead).length, 0);
dbg({ op: "ball", sp: "Orc", lvl: 40 }); const ball = p.bag.find(i => i.comp); assert.equal(ball.comp.lvl, 40);
dbg({ op: "petspec", br: "damage" }); assert.equal(T.spec(ball.comp), "damage"); assert.ok(T.spent(ball.comp, "damage") === 8);
dbg({ op: "petlvl", n: 10 }); assert.equal(ball.comp.lvl, 10);
a.command(id, { t: "use", uid: ball.uid }); assert.equal(followersOf(w(), p).filter(e => e.comp).length, 1);
p.hp = 1; dbg({ op: "god" }); w().ents.get(id).hp = p.maxHp;
// viajar: mapa y cripta
assert.ok(dbg({ op: "crypt", level: 7 })); assert.equal(w().map.level, 7); assert.ok(w().map.kind === "dungeon");
dbg({ op: "clear" }); assert.ok(w().cleared);
assert.ok(dbg({ op: "goto", map: "arefarm" })); assert.equal(w(), a.farm);
dbg({ op: "sky", day: 2, weather: 1 }); a.tick(100); assert.equal(w().dayOrNight, 2);
// desactivadas
DEBUG.enabled = false; assert.equal(dbg({ op: "level", n: 5 }), false); DEBUG.enabled = true;
console.log("OK");
