// Blizzard (área): no daña a los summons propios, sí a un monstruo ajeno.
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { sget } from "../web/src/shared/systems/status.js";
import { linePoint, MAGIC_MODE } from "../web/src/shared/magic.js";
MAGIC_MODE.schools = false; MAGIC_MODE.player = true;   // estas pruebas ejercitan el sistema de hechizos del jugador (cerrado en el juego, ver talents.js)

const D = new URL("../web/data/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("map.json", D)));
const bytes = new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)));
const npcDb = JSON.parse(readFileSync(new URL("npc.json", D)));
const data = new GameData({ items: JSON.parse(readFileSync(new URL("items.json", D))), magic: JSON.parse(readFileSync(new URL("magic.json", D))), npcs: npcDb });
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };

assert(linePoint(0, 0, 10, 0, 3).join() === "3,0" && linePoint(5, 5, 5, 0, 2).join() === "5,3", "GetPoint2");

const w = new World({ grid: new Grid(meta.w, meta.h, bytes), npcDb, data, spawns: [], rng: Math.random, start: meta.start });
const pid = w.addPlayer("mago"), p = w.ents.get(pid);
for (const u of Object.values(p.equip)) w.command(pid, { t: "unequip", uid: u });
w.tick(1000);
p.magic = {}; for (const k of Object.keys(w.magic)) p.magic[k] = 1;
p.skills[4] = 100; p.stats.int = p.stats.mag = 200; p.level = 100; p.mp = p.maxMp = 9999;
const events = []; const origEmit = w.emit.bind(w); w.emit = e => { events.push(e); origEmit(e); };

const mob = () => {
  const [x, y] = w.freeSpotNear(p.x + 7, p.y);
  const n = w.makeEnt("npc", x, y);
  Object.assign(n, { name: "Slime", type: 10, cfg: { ...npcDb.Slime, resistMagic: 1, searchRange: 0, attackRange: 0 }, gen: { alive: 1, max: 0, respawn: false, rect: [x, y, x, y] }, dur: { move: 600, attack: 400, damage: 300, dying: 500 }, hp: 5000, maxHp: 5000, exp: 100, absDamage: 0, noDieRemainExp: 10, target: null, nextAct: 0, special: 0 });
  return n;
};
const cast = (spell, x, y) => { w.tick(1200); p.lastCast = -1e9; p.busyUntil = 0; p.mp = p.maxMp; events.length = 0; const ok = w.command(pid, { t: "cast", spell, x, y }); w.tick(1500); return ok; };

// paralizar (Hold Person) y que un golpe libere

const foe = mob(), pet = mob();
pet.master = p.id;
pet.x = foe.x + 1; pet.y = foe.y; w.grid.move?.(pet, pet.x, pet.y);
const h0 = foe.hp, ph0 = pet.hp;
cast(91, foe.x, foe.y);
assert(foe.hp < h0, "Blizzard daña al monstruo ajeno");
assert(pet.hp === ph0, "Blizzard no daña al summon propio");
console.log("OK blizzard-friendly");
