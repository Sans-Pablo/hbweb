// Modo automático del jugador (autoplay.js): caza de una criatura, recogida de botín, parada por vida baja / sin presas, y ruta a un habitante de ciudad.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { seededRandom, setDungeonPalette } from "../web/src/shared/dungeon.js";
import { decide, parseAuto, placeOf, placeEnt, PLACES, IDLE_STOP_MS } from "../web/src/shared/systems/autoplay.js";
import { groundPush } from "../web/src/shared/systems/ground.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";

// ---- análisis del comando
assert.deepEqual(parseAuto("hunt slime"), { kind: "hunt", mob: "Slime" });
assert.deepEqual(parseAuto("caza orcos"), { kind: "hunt", mob: "Orc" });
assert.equal(parseAuto("hunt patata").kind, "bad");
assert.deepEqual(parseAuto("run almacén"), { kind: "run", place: "warehouse" });
assert.deepEqual(parseAuto("ir tienda"), { kind: "run", place: "shop" });
assert.deepEqual(parseAuto("run herrería"), { kind: "run", place: "smith" });
assert.equal(placeOf("hechicero de mascotas"), "petmage");
assert.deepEqual(parseAuto("stop"), { kind: "stop" });
assert.equal(parseAuto("nada"), null);

const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {}, rng: seededRandom(7) });
const w = a.farm, pid = a.addPlayer("Auto", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }), me = w.ents.get(pid);
const spot = (dx, dy) => w.freeSpotNear(me.x + dx, me.y + dy);
// ---- caza: elige la presa del tipo pedido más cercana
const [sx, sy] = spot(5, 0), [ox, oy] = spot(0, 3);
const slime = w.spawnNpc?.("Slime", sx, sy) || (() => { const n = w.makeEnt("npc", sx, sy); n.name = "Slime"; return n; })();
const orc = w.spawnNpc?.("Orc", ox, oy) || (() => { const n = w.makeEnt("npc", ox, oy); n.name = "Orc"; return n; })();
slime.name = "Slime"; orc.name = "Orc";
let d = decide(w, me, { kind: "hunt", mob: "Slime" });
assert.deepEqual(d.intent, { t: "attack", id: slime.id }, "ataca al slime y no al orco, aunque el orco esté más cerca");
// ---- sin presas: recoge el botín cercano
slime.dead = true;
const [lx, ly] = spot(2, 2); groundPush(w, lx, ly, newInst(w, 1, 1));
const au = { kind: "hunt", mob: "Slime" };
d = decide(w, me, au); assert.deepEqual(d.intent, { t: "pickup", x: lx, y: ly }, "va a por el botín");
// no cabe: tras unos intentos encima de la casilla deja de insistir
me.x = lx; me.y = ly; for (let i = 0; i < 4; i++) d = decide(w, me, au);
assert.ok(au.skip.has(lx + "," + ly), "no insiste con lo que no puede recoger");
// ---- sin presas ni botín: se para tras 20 s
w.items.clear(); d = decide(w, me, au); assert.ok(!d.stop && !d.intent);
w.time += IDLE_STOP_MS + 1000; d = decide(w, me, au); assert.ok(d.stop, "sin presas se detiene");
// ---- vida baja y muerte
me.hp = 1; assert.ok(decide(w, me, { kind: "hunt", mob: "Slime" }).stop, "vida baja: para");
me.hp = me.maxHp; me.dead = true; assert.ok(decide(w, me, { kind: "hunt", mob: "Slime" }).stop); me.dead = false;
// ---- ruta: habitante más cercano, intención de andar junto a él, y al llegar abre su diálogo
const e = placeEnt(w, me, "farmer"); assert.ok(e && e.role === "farmer", "el granjero existe en Aresfarm");
me.x = e.x + 10; me.y = e.y;
d = decide(w, me, { kind: "run", place: "farmer" }); assert.equal(d.intent.t, "move");
me.x = e.x + 1; me.y = e.y; d = decide(w, me, { kind: "run", place: "farmer" });
assert.ok(d.stop && d.open === e, "al llegar abre el diálogo y termina");
d = decide(w, me, { kind: "run", place: "warehouse" }); assert.ok(d.stop && d.msg && !d.open, "sin almacén en el mapa lo dice");
for (const k of Object.keys(PLACES)) assert.ok(PLACES[k].es && PLACES[k].en);
console.log("OK autoplay");
