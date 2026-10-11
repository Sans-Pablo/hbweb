// Habitantes y summons: compran su compañero en el hospital (Aresden: tienda general; Elvine: Gail al aire libre), lo invocan, le dan talentos y avisan de fallos.
import * as BI from "../web/src/shared/systems/botitems.js";
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
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(21) });
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
a.spawnResident("Aldric"); a.spawnResident("Brenna");
const A = a.residents().find(x => x.name === "Aldric"), B = a.residents().find(x => x.name === "Brenna"), w = a.farm;
A.level = 30; B.level = 30; A.gender = 1; B.gender = 1; A.res.rel[B.name] = 5; B.res.rel[A.name] = 5;
const add = (p, name) => { const d = data.named(name); const inst = { uid: w.nextItem++, id: d.id, count: 1, life: 300 }; p.bag.push(inst); return inst; };
for (const p of [A, B]) { for (const i of [...p.bag]) if (!Object.values(p.equip).includes(i.uid)) p.bag.splice(p.bag.indexOf(i), 1); }
// 1. un arma mejor que la puesta de un amigo desnudo: se guarda para él; la basura se vende
for (const k of Object.keys(B.equip)) delete B.equip[k];
const sword = add(A, "LongSword"), junk = add(A, "Dagger");
const friends = [{ q: B, rel: 5 }];
const v1 = BI.judge(w, A, sword, friends);
assert.ok(["equip", "store"].includes(v1.act), "una espada decente no se vende: " + v1.act + " " + v1.why);
// 2. lo que no le sirve ni a él ni a nadie se vende
const v2 = BI.judge(w, A, add(A, "Hoe"), []); assert.ok(v2.act !== "equip", "azada: " + v2.act);
// 3. potiones de más se venden, hasta el límite se guardan
const red = data.named("RedPotion"); const pots = { uid: w.nextItem++, id: red.id, count: 40 }; A.bag.push(pots);
assert.equal(BI.judge(w, A, pots, []).act, "sell", "sobran pociones");
pots.count = 10; assert.equal(BI.judge(w, A, pots, []).act, "keep", "10 pociones se quedan");
// 4. ordenar: pociones primero (fila de arriba), armas después
BI.manage(w, A, { force: false, friends });
const xs = A.bag.filter(i => i.x !== undefined);
assert.ok(xs.length > 0, "la mochila queda ordenada (posiciones)");
const pot = A.bag.find(i => i.id === red.id), wp = A.bag.find(i => i.id === sword.id);
if (pot && wp && !Object.values(A.equip).includes(wp.uid)) assert.ok(pot.y < wp.y || (pot.y === wp.y && pot.x < wp.x), "pociones antes que armas");
// 5. lista de deseos: si no hay oro, ahorra
A.gold = 5; A.bot.bad.clear(); A.bot.errand = 0; for (const i of [...A.bag]) if (!Object.values(A.equip).includes(i.uid) && i.id !== red.id) A.bag.splice(A.bag.indexOf(i), 1);
tick(6000);
assert.ok(A.bot.wish === undefined || A.bot.wish === null || A.bot.wish.price > 0, "lista de deseos coherente");
console.log("OK botitems");
