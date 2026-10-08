// Ciudad de Aresden: teletransportes entre mapas (teleport-loc del servidor original).
// node tests/maps.test.mjs
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";

const D = new URL("../web/data/", import.meta.url);
const j = n => JSON.parse(readFileSync(new URL(n, D)));
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };
const meta = j("map.json"), npcDb = j("npc.json");
const data = new GameData({ items: j("items.json"), magic: j("magic.json"), npcs: npcDb });
const maps = {};
for (const id of Object.keys(j("maps/index.json"))) {
  const mm = j("maps/" + id + ".json");
  maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", D)))) };
}
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)))), npcDb, data, spawns: [], start: meta.start, maps });
const id = a.addPlayer("viajero"), p = a.farm.ents.get(id);
a.tick(1000);
const put = (w, x, y) => { w.grid.release(p.x, p.y, p.id); p.x = p.fx = x; p.y = p.fy = y; w.grid.occupy(x, y, p.id); };
const step = (dir) => { a.tick(600); p.busyUntil = 0; p.lastMove = -1e9; return a.command(id, { t: "move", dir }); };

// la granja lleva a la ciudad: pisar (20,23) (teleport a aresden 275,205)
const tp = maps.arefarm.meta.teleports[0];
put(a.farm, tp.x + 1, tp.y);
assert(step(7), "andar hacia el teletransporte");              // dir 7 = oeste
a.tick(800);
const w = a.worldFor(id);
assert(w.map.id === "aresden", "la granja lleva a Aresden: " + w.map.id);
assert(Math.abs(p.x - tp.dx) <= 3 && Math.abs(p.y - tp.dy) <= 3, "llega cerca del destino " + p.x + "," + p.y);
// una tienda: de la ciudad a la herrería
const sm = maps.aresden.meta.teleports.find(t => t.map === "bsmith_1");
put(w, sm.x, sm.y + 1);
a.tick(10);
assert(step(1), "andar hacia la puerta");                      // norte
a.tick(800);
assert(a.worldFor(id).map.id === "bsmith_1", "la puerta lleva a la herrería: " + a.worldFor(id).map.id);
// salir de la herrería de vuelta a la ciudad
const inw = a.worldFor(id), out = maps.bsmith_1.meta.teleports[0];
put(inw, out.x, out.y + 1);
assert(step(1), "andar hacia la salida");
a.tick(800);
assert(a.worldFor(id).map.id === out.map, "la salida lleva a " + out.map + ": " + a.worldFor(id).map.id);
console.log("OK");
