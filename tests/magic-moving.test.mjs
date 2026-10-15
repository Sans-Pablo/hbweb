// Un monstruo que se mueve durante la animación de lanzar sigue recibiendo el hechizo (HG.cpp PlayerMagicHandler resuelve al recibir la orden).
// node tests/magic-moving.test.mjs
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { MAGIC_MODE } from "../web/src/shared/magic.js";
MAGIC_MODE.player = true;
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
p.magic = { 0: 1 }; p.skills[4] = 100; p.stats.int = p.stats.mag = 200; p.level = 100; w.recalc(p); p.mp = p.maxMp = 9999;
const [x, y] = w.freeSpotNear(p.x + 5, p.y);
const n = w.makeEnt("npc", x, y);
Object.assign(n, { name: "Slime", type: 10, cfg: { ...npcDb.Slime, resistMagic: 1, searchRange: 0, attackRange: 0 }, gen: { alive: 1, max: 0, respawn: false, rect: [x, y, x, y] }, dur: { move: 600, attack: 400, damage: 300, dying: 500 }, hp: 5000, maxHp: 5000, exp: 1, absDamage: 0, noDieRemainExp: 1, target: null, nextAct: 0, special: 0 });
w.tick(1200); p.lastCast = -1e9; p.busyUntil = 0;
assert(w.command(pid, { t: "cast", spell: 0, x: n.x, y: n.y }), "lanza");
// el monstruo da un paso antes de que salga el hechizo
let moved = false; for (let d = 0; d < 8 && !moved; d++) moved = w.tryStep(n, d, 600, 1);
assert(moved, "el monstruo se aparta");
w.tick(1500);
assert(n.hp < 5000, "el hechizo alcanza al monstruo que se movió");
console.log("OK");
