// Modo automático del jugador (autoplay.js): caza de una criatura, recogida de botín, parada por vida baja / sin presas, y ruta a un habitante de ciudad.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { seededRandom, setDungeonPalette } from "../web/src/shared/dungeon.js";
import { decide, parseAuto, placeOf, placeEnt, approach, viaTeleport, PLACES, IDLE_STOP_MS, FARM_HOME, BAG_MAX } from "../web/src/shared/systems/autoplay.js";
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
// ---- menú AUTO: granja, aproximación junto a un habitante, caza por zona y vuelta con la mochila llena
assert.equal(placeOf("granja"), "farm"); assert.deepEqual(parseAuto("run granja"), { kind: "run", place: "farm" });
me.x = e.x + 6; me.y = e.y; const ap = approach(w, me, e);
assert.ok(ap && Math.max(Math.abs(ap[0] - e.x), Math.abs(ap[1] - e.y)) <= 2 && !w.grid.blocked(ap[0], ap[1]), "approach: casilla libre a <=2 del habitante");
assert.equal(viaTeleport(w, me, "aresden_farm_nope")?.stop ?? true, true, "sin teletransportador no inventa camino");
const [fx, fy] = FARM_HOME; me.x = fx + 15; me.y = fy;
d = decide(w, me, { kind: "run", place: "farm" }); assert.equal(d.intent?.t, "move", "run farm: anda hacia la casa");
me.x = fx; me.y = fy; d = decide(w, me, { kind: "run", place: "farm" }); assert.ok(d.stop, "run farm: al llegar termina");
const zone = { map: "arefarm", rect: [me.x - 2, me.y - 2, me.x + 2, me.y + 2] };
const zau = { kind: "hunt", mob: "Slime", zone };
w.items.clear(); const [zx, zy] = spot(1, 1); const zs = w.makeEnt("npc", zx, zy); zs.name = "Slime";
d = decide(w, me, zau); assert.deepEqual(d.intent, { t: "attack", id: zs.id }, "caza dentro de la zona");
zs.x = me.x + 30; zs.y = me.y; d = decide(w, me, zau); assert.ok(!d.intent || d.intent.t !== "attack", "ignora presas fuera de la zona");
me.bag = new Array(BAG_MAX).fill(1); me.x = fx + 20; zau.full = false;
d = decide(w, me, zau); assert.ok(zau.full, "mochila llena: marca el ciclo de vuelta"); assert.equal(d.intent?.t, "move", "y vuelve a la granja");
me.x = fx; me.y = fy; d = decide(w, me, zau); assert.ok(d.stop, "en la granja con la mochila llena termina el ciclo");
// ---- «No recoger objetos»: con botín a la vista y sin presas, no lo pisa
zs.dead = true; me.x = fx; me.y = fy; w.items.clear(); { const [bx, by] = spot(2, 2); groundPush(w, bx, by, newInst(w, 1, 1));
  assert.equal(decide(w, me, { kind: "hunt", mob: "Slime" }).intent?.t, "pickup", "sin nopick recoge");
  assert.ok(!decide(w, me, { kind: "hunt", mob: "Slime", nopick: true }).intent, "nopick: no recoge"); w.items.clear(); }
// ---- almacén con dos entradas: elige la de camino más corto y la aproximación no pisa casillas de teletransporte
{ const [ax, ay] = spot(3, 0), [bx, by] = spot(0, 12), tp = new Map();
  tp.set(w.grid.idx(ax, ay), { x: ax, y: ay, map: "wrhus_1f" }); tp.set(w.grid.idx(bx, by), { x: bx, y: by, map: "wrhus_1f" });
  const fw = Object.create(w); fw.teleports = tp; me.x = fx; me.y = fy;
  const v = viaTeleport(fw, me, "wrhus_1f"); assert.equal(v.intent?.t, "move"); assert.deepEqual([v.intent.x, v.intent.y], [ax, ay], "entrada más corta");
  const c = w.makeEnt("citizen", ax + 1, ay); const sp = approach(fw, me, c);
  assert.ok(sp && !tp.has(w.grid.idx(sp[0], sp[1])), "approach no elige una casilla de teletransporte"); }
for (const k of Object.keys(PLACES)) assert.ok(PLACES[k].es && PLACES[k].en);
console.log("OK autoplay");
