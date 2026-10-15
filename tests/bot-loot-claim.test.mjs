// Botín de los bots: no recogen basura; sí lo que juzgan útil, y los atributos puntúan según lo que hacen (itemlevel.js).

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
// Arbitraje: con un botín en el suelo, solo un bot va a por él; lo tirado por un jugador no lo toca nadie.
import { groundPush } from "../web/src/shared/systems/ground.js";
a.spawnResident("Cora");
const C = a.residents().find(x => x.name === "Cora");
const bots = [A, B, C];
bots.forEach((b, i) => { b.level = 30; b.x = w.grid.inside(A.x + i, A.y) ? A.x + i : A.x; b.y = A.y; });
const place = (dropBy) => { const d = data.named("RedPotion"); const inst = { uid: w.nextItem++, id: d.id, count: 1, life: d.maxLife }; if (dropBy) inst.dropBy = dropBy; groundPush(w, A.x + 3, A.y, inst, !dropBy); return inst; };
const count = () => { let n = 0; for (const v of w.lootClaims?.values() || []) if (v.until > w.time) n++; return n; };
place(0); tick(500);
const claims = [...(w.lootClaims?.values() || [])];
assert.ok(claims.length >= 1, "alguien reclama el botín");
assert.equal(count(), 1, "una sola casilla reclamada y por un único bot");
w.lootClaims.clear(); w.items.clear();
place(A.id); tick(500);
assert.equal(count(), 0, "lo tirado por un jugador no se reclama");
console.log("OK");
