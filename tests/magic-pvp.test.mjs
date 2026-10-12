// Hechizos solo contra jugadores: Confusion (16), Inhibition Casting (31) y Resurrection (32).
// node tests/magic-pvp.test.mjs
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { sget } from "../web/src/shared/systems/status.js";
import { MAGIC_MODE } from "../web/src/shared/magic.js";
MAGIC_MODE.schools = false; MAGIC_MODE.player = true;

const D = new URL("../web/data/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("map.json", D)));
const bytes = new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)));
const npcDb = JSON.parse(readFileSync(new URL("npc.json", D)));
const magic = JSON.parse(readFileSync(new URL("magic.json", D)));
const data = new GameData({ items: JSON.parse(readFileSync(new URL("items.json", D))), magic, npcs: npcDb });
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };
const id = nm => Object.keys(magic).find(k => magic[k].name === nm);

const w = new World({ grid: new Grid(meta.w, meta.h, bytes), npcDb, data, spawns: [], rng: Math.random, start: meta.start });
const aid = w.addPlayer("mago"), a = w.ents.get(aid), bid = w.addPlayer("victima"), b = w.ents.get(bid);
for (const u of Object.values(a.equip)) w.command(aid, { t: "unequip", uid: u });
w.tick(1000);
a.magic = {}; for (const k of Object.keys(w.magic)) a.magic[k] = 1;
a.skills[4] = 100; a.stats.int = a.stats.mag = 200; a.level = 100; a.mp = a.maxMp = 9999;
const [bx, by] = w.freeSpotNear(a.x + 4, a.y); w.grid.release?.(b.x, b.y, b.id); b.x = b.fx = bx; b.y = b.fy = by; w.grid.occupy(bx, by, bid);
const cast = (spell, x, y) => { w.tick(1200); a.lastCast = -1e9; a.busyUntil = 0; a.mp = a.maxMp; return w.command(aid, { t: "cast", spell, x, y }) && (w.tick(1500), true); };

for (let i = 0; i < 20 && !sget(w, b, "confuse"); i++) cast(id("Confusion"), b.x, b.y);
assert(sget(w, b, "confuse"), "Confusion confunde al jugador");
for (let i = 0; i < 20 && !sget(w, b, "inhibit"); i++) cast(id("Inhibition Casting"), b.x, b.y);
assert(sget(w, b, "inhibit"), "Inhibition Casting inhibe al jugador");
b.magic = { [id("Heal")]: 1 }; b.mp = b.maxMp = 100; b.hp = 1; w.tick(1200); b.lastCast = -1e9; b.busyUntil = 0;
assert(!w.command(bid, { t: "cast", spell: id("Heal"), x: b.x, y: b.y }), "el inhibido no puede lanzar");

b.hp = 0; b.dead = true; w.grid.release?.(b.x, b.y, b.id);
cast(id("Resurrection"), b.x, b.y);
assert(!b.dead && b.hp > 0, "Resurrection levanta al jugador caído");
console.log("OK magic-pvp");
