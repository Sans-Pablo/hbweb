// Esqueleto fantasma: un esqueleto común puede levantarse al desaparecer su cadáver. node tests/ghost.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { killNpc, GHOST_CHANCE } from "../web/src/shared/systems/npcsys.js";

const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const farm = new Uint8Array(readFileSync(new URL("arefarm.bin", dir)));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, farm), start: meta.start, npcDb, data, spawns: [], maps: {}, rng: seededRandom(11) });
const id = a.addPlayer("fantasma"), p = a.farm.ents.get(id);
assert.ok(a.command(id, { t: "dbg", op: "crypt", level: 1 }));
const w = a.worldFor(id);
p.hp = p.maxHp = 1e6;
const sk = [...w.ents.values()].filter(e => e.kind === "npc" && e.name === "Skeleton" && !e.boss);
assert.ok(sk.length >= 2, "hay esqueletos comunes");
assert.ok(GHOST_CHANCE > 0 && GHOST_CHANCE < 1);

// una tirada baja siempre levanta; el cadáver desaparece y sale el fantasma en el mismo sitio
const real = w.rng; w.rng = () => 0; killNpc(w, sk[0], p); w.rng = real;
const [x, y] = [sk[0].x, sk[0].y];
assert.equal(w.ghostsPending, 1, "el nivel espera al fantasma");
assert.ok(w.map.remainingEnemies !== undefined);
const evs = []; const em = w.emit.bind(w); w.emit = e => { evs.push(e); em(e); };
for (let i = 0; i < 400; i++) a.tick(50);
const gh = [...w.ents.values()].find(e => e.ghost);
assert.ok(gh && !gh.dead, "se levantó un fantasma");
assert.equal(w.ghostsPending, 0);
const ev = evs.find(e => e.t === "ghost");
assert.ok(Math.abs(ev.x - x) <= 1 && Math.abs(ev.y - y) <= 1, "en el lugar del cadáver");
assert.equal(gh.type, sk[0].type);
assert.ok(evs.some(e => e.t === "ghost" && e.id === gh.id), "evento ghost");

// el fantasma no vuelve a levantarse, ni los jefes ni los auxiliares
w.rng = () => 0; killNpc(w, gh, p); w.rng = real;
assert.ok(!w.ghostsPending, "un fantasma no resucita");
const aux = sk[1]; aux.aux = true; w.rng = () => 0; killNpc(w, aux, p); w.rng = real;
assert.ok(!w.ghostsPending, "un auxiliar no resucita");

// sin tirada afortunada no hay fantasma
w.rng = () => 0.99;
const other = [...w.ents.values()].find(e => e.kind === "npc" && e.name === "Skeleton" && !e.boss && !e.dead && !e.aux);
if (other) { killNpc(w, other, p); assert.ok(!w.ghostsPending); }
w.rng = real;
console.log("OK ghost");
