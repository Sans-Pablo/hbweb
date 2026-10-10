// Banco de pruebas de la simulación: N jugadores + N bots cazando en la granja con los generadores reales. node tools/bench.mjs [jugadores=20] [segundos=60]
// Con perfil de CPU: node --cpu-prof --cpu-prof-dir=/tmp/prof tools/bench.mjs
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { DEBUG } from "../web/src/shared/systems/debug.js";
import { seededRandom } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
const n = +process.argv[2] || 20, secs = +process.argv[3] || 60;
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: json(meta.map + ".spawns.json"), maps: {}, rng: seededRandom(5) });
DEBUG.enabled = true;
const id = a.addPlayer("Admin", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } });
for (let k = 0; k < n; k += 10) a.command(id, { t: "dbg", op: "bot", n: Math.min(10, n - k), level: 20 });
for (let i = 0; i < 100; i++) a.tick(50);                                       // calentar
const N = secs * 20, ms = new Float64Array(N);
for (let i = 0; i < N; i++) { const t0 = performance.now(); a.tick(50); ms[i] = performance.now() - t0; }
ms.sort();
const avg = ms.reduce((x, y) => x + y, 0) / N;
console.log(`bots reales: ${a.bots.size}`); console.log(`${n} bots · ${a.farm.ents.size} entidades · tick medio ${avg.toFixed(2)} ms · p95 ${ms[Math.floor(N * 0.95)].toFixed(2)} ms · máx ${ms[N - 1].toFixed(2)} ms (presupuesto 50 ms)`);
