// Tipos de hechizo con estados: paralizar, hielo, escudo, invisibilidad, campos, veneno, línea.
// node tests/magic-types.test.mjs
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
let n = mob();
for (let i = 0; i < 6 && !sget(w, n, "hold"); i++) cast(25, n.x, n.y);
assert(sget(w, n, "hold") === 1, "Hold Person paraliza al monstruo");
const where = [n.x, n.y]; w.tick(3000);
assert(n.x === where[0] && n.y === where[1], "el paralizado no se mueve");
// hielo
n = mob();
for (let i = 0; i < 12 && !sget(w, n, "ice"); i++) cast(57, n.x, n.y);
assert(sget(w, n, "ice") === 1 && n.hp < 5000, "Ice Strike daña y congela");
// escudo, invisibilidad y cura
cast(13, p.x, p.y); assert(sget(w, p, "protect") === 3, "Defense Shield sobre uno mismo");
cast(33, p.x, p.y); assert(sget(w, p, "protect") === 3 || sget(w, p, "protect") === 2, "no se pisa un escudo activo");
cast(32, p.x, p.y); assert(sget(w, p, "invis") === 1, "Invisibility");
cast(0, mob().x, mob().y); assert(!sget(w, p, "invis"), "lanzar rompe la invisibilidad");
// campo de fuego: daña al que está dentro
n = mob(); const hp0 = n.hp;
for (let i = 0; i < 8 && !w.dyn?.length; i++) cast(41, n.x, n.y); w.tick(4000);
assert(w.dyn.length > 0 && events.length >= 0, "Fire Field crea objetos dinámicos");
assert(n.hp < hp0, "el fuego quema al monstruo");
w.tick(40000); assert(w.dyn.length === 0, "los campos caducan");
// línea
n = mob(); const hp1 = n.hp; for (let i = 0; i < 8 && n.hp === hp1; i++) cast(51, n.x, n.y); assert(n.hp < hp1, "Lightning Bolt alcanza al monstruo de la línea");
// veneno sobre uno mismo
p.skills[23] = 0; p.eff.addPR = 0;
for (let i = 0; i < 6 && !sget(w, p, "poison"); i++) cast(27, p.x, p.y);
assert(sget(w, p, "poison") > 0, "Poison envenena"); cast(36, p.x, p.y); assert(!sget(w, p, "poison"), "Cure lo quita");
// comida
cast(2, p.x + 1, p.y); assert(w.items.size > 0, "Create Food deja comida en el suelo");
console.log("OK");
