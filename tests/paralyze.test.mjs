// Paralyze / Hold Person (char/combat.cpp ~1186, ~1476): un golpe libera Hold Person (tipo 1) pero NO Paralyze (tipo 2) en jugadores.
// node tests/paralyze.test.mjs
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { ACT } from "../web/src/shared/const.js";
const D = new URL("../web/data/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("map.json", D)));
const bytes = new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)));
const npcDb = JSON.parse(readFileSync(new URL("npc.json", D)));
const data = new GameData({ items: JSON.parse(readFileSync(new URL("items.json", D))), magic: JSON.parse(readFileSync(new URL("magic.json", D))), npcs: npcDb });
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };
import { damagePlayer } from "../web/src/shared/systems/combatsys.js";
import { sset, sget } from "../web/src/shared/systems/status.js";
const w = new World({ grid: new Grid(meta.w, meta.h, bytes), npcDb, data, spawns: [], rng: Math.random, start: meta.start });
const aid = w.addPlayer("atacante"), a = w.ents.get(aid), bid = w.addPlayer("victima"), b = w.ents.get(bid);
w.tick(1000);
sset(w, b, "hold", 2, 10000);                       // Paralyze
damagePlayer(w, b, 1, a);
assert(sget(w, b, "hold") === 2, "un golpe no libera a un jugador paralizado (Paralyze)");
w.tick(1000);
assert(!w.command(bid, { t: "move", dir: 3 }), "paralizado no anda");
sset(w, b, "hold", 1, 10000);                       // Hold Person
damagePlayer(w, b, 1, a);
assert(!sget(w, b, "hold"), "un golpe libera Hold Person");
console.log("OK");
