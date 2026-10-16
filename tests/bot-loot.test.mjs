// Botín de los bots: no recogen basura; sí lo que juzgan útil, y los atributos puntúan según lo que hacen (itemlevel.js).
import { lootValue } from "../web/src/shared/systems/bot.js";
import { itemLevel } from "../web/src/shared/itemlevel.js";
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
const A2 = A;
const pk = (t1, v1, t2 = 0, v2 = 0) => ((t1 << 20) | (v1 << 16) | (t2 << 12) | (v2 << 8)) >>> 0;
const ground = (name, attr = 0) => { const d = data.named(name); return { uid: 1, id: d.id, count: 1, attr, life: d.maxLife }; };
// 1. los atributos puntúan por lo que hacen: un arma con daño añadido/crítico supera a la básica; «Light» apenas suma; el secundario de absorción pesa
const base = data.named("LongSword"), plain = itemLevel(base, 0, base.id);
assert.ok(itemLevel(base, pk(9, 5), base.id) > plain + 15, "Ancient suma mucho");
assert.ok(itemLevel(base, pk(1, 8), base.id) > itemLevel(base, pk(6, 8), base.id), "Critical > Light");
assert.ok(itemLevel(base, pk(5, 3), base.id) === itemLevel(base, pk(5, 9), base.id), "Agile no depende de v1");
const arm = data.named("Hauberk(M)"), pa = itemLevel(arm, 0, arm.id);
assert.ok(itemLevel(arm, pk(8, 3, 8, 6), arm.id) > pa + 15, "armadura Strong con absorción física");
assert.ok(Number.isFinite(itemLevel(arm, pk(0, 0, 0, 0), arm.id)) && Number.isFinite(itemLevel(arm, pk(12, 4, 3, 5), arm.id)), "sin NaN");
// 2. con un equipo bueno, la basura del suelo no se recoge y lo bueno sí
A2.level = 60; A2.gender = 1; A2.res.build = "vanguard"; A2.res.arch = "warrior"; if (A2.bot) A2.bot.mage = false;      // v0.85.53: solo hay guerrero y mago
for (const [k, n] of [[2, "Excaliber"]]) { try { const d = data.named(n); const inst = { uid: w.nextItem++, id: d.id, count: 1, life: d.maxLife }; A2.bag.push(inst); A2.equip[d.equipPos === 8 ? 8 : d.equipPos] = inst.uid; } catch {} }
w.recalc(A2);
{ const hf = w.hooks?.friends; if (w.hooks) w.hooks.friends = () => []; var restoreFriends = () => { if (w.hooks) w.hooks.friends = hf; }; }      // sin amigos que se beneficien del puñal (la clase de los vecinos cambió en v0.85.53)
assert.equal(lootValue(w, A2, ground("Dagger")), 0, "un puñal básico es basura");
assert.ok(lootValue(w, A2, ground("RedPotion")) > 0, "las pociones sí");
delete A2.equip[3]; delete A2.equip[4];
const good = lootValue(w, A2, ground("Hauberk(M)", pk(8, 5, 8, 6)));
assert.ok(good >= 500, "una armadura con atributos que le mejora el equipo se recoge con prioridad: " + good);
console.log("OK");
