// v0.85.79: el golpe sale al recibir la orden (HG.cpp:10202 PlayerMagicHandler), Summon junto al tile objetivo (HG.cpp:10933), Illusion = estado propio (HG.cpp:11360)
// node tests/magic-cast-on-receipt.test.mjs
import { MAGIC_MODE } from "../web/src/shared/magic.js";
MAGIC_MODE.schools = false; MAGIC_MODE.player = true; MAGIC_MODE.free = false;
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { sget } from "../web/src/shared/systems/status.js";
const D = new URL("../web/data/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("map.json", D)));
const bytes = new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)));
const npcDb = JSON.parse(readFileSync(new URL("npc.json", D)));
const data = new GameData({ items: JSON.parse(readFileSync(new URL("items.json", D))), magic: JSON.parse(readFileSync(new URL("magic.json", D))), npcs: npcDb });
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };
const w = new World({ grid: new Grid(meta.w, meta.h, bytes), npcDb, data, spawns: [], rng: Math.random, start: meta.start });
const pid = w.addPlayer("mago"), p = w.ents.get(pid);
for (const u of Object.values(p.equip)) w.command(pid, { t: "unequip", uid: u });
w.tick(1000);
p.fullMage = true; p.skills[4] = 100; p.stats.int = p.stats.mag = 200; p.level = 100; w.recalc(p);
p.magic = { 0: 1, 31: 1, 80: 1 }; p.mp = p.maxMp = 900;
const events = []; const origEmit = w.emit.bind(w); w.emit = e => { events.push(e); origEmit(e); };
const reset = () => { p.lastCast = p.castTry = -1e9; p.busyUntil = 0; w.tick(1800); p.lastCast = p.castTry = -1e9; p.busyUntil = 0; };

// 1) preparado + clic: sale en el mismo tick de la orden, sin esperar castMs
reset(); w.command(pid, { t: "prepare", spell: 0 }); w.tick(2200);
events.length = 0;
w.command(pid, { t: "cast", spell: 0, x: p.x + 2, y: p.y, pre: true }); w.tick(30);
assert(events.some(e => e.t === "spell" || e.t === "castfail"), "con el hechizo preparado se resuelve al recibir la orden");

// 2) Summon: nace junto al jugador objetivo (el tile objetivo), no en el anillo de 2 casillas del lanzador
reset(); const n0 = [...w.ents.values()].filter(e => e.master === pid).length;
w.command(pid, { t: "cast", spell: 31, x: p.x, y: p.y }); w.tick(3000);
const sum = [...w.ents.values()].find(e => e.master === pid);
assert(!sum || Math.max(Math.abs(sum.x - p.x), Math.abs(sum.y - p.y)) <= 1, "Summon aparece en el tile objetivo (anillo contiguo)");

// 3) Illusion (type 16, v4=3) pone el estado illusion, no confuse
const vid = w.addPlayer("victima"), v = w.ents.get(vid); v.stats.mag = 1; v.skills[3] = 0; w.recalc(v); v.hp = v.maxHp = 5000; v.side = 2; p.side = 1;
const [x, y] = w.freeSpotNear(p.x + 3, p.y); w.grid.release(v.x, v.y, v.id); v.x = v.fx = x; v.y = v.fy = y; w.grid.occupy(x, y, v.id);
w.pvp = true; w.safeAt = () => false;
for (let i = 0; i < 12 && !sget(w, v, "illusion"); i++) { reset(); w.command(pid, { t: "cast", spell: 80, x: v.x, y: v.y }); w.tick(3000); }
assert(sget(w, v, "illusion") && !sget(w, v, "confuse"), "Illusion pone el estado illusion");
console.log("OK magic-cast-on-receipt");
