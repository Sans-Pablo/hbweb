// Sistemas 7-9: Hold (HG.cpp:11102), Confuse (:11337), Ice (:11517). node tests/magic-hold-confuse-ice.test.mjs
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { sset, sget, sclear } from "../web/src/shared/systems/status.js";
import { MAGIC_MODE } from "../web/src/shared/magic.js";
MAGIC_MODE.player = true;
const D = new URL("../web/data/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("map.json", D)));
const bytes = new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)));
const npcDb = JSON.parse(readFileSync(new URL("npc.json", D)));
const data = new GameData({ items: JSON.parse(readFileSync(new URL("items.json", D))), magic: JSON.parse(readFileSync(new URL("magic.json", D))), npcs: npcDb });
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };
const w = new World({ grid: new Grid(meta.w, meta.h, bytes), npcDb, data, spawns: [], rng: Math.random, start: meta.start });
const aid = w.addPlayer("mago"), a = w.ents.get(aid), bid = w.addPlayer("victima"), b = w.ents.get(bid);
for (const e of [a, b]) for (const u of Object.values(e.equip)) w.command(e.id, { t: "unequip", uid: u });
w.tick(1000);
a.fullMage = true; a.skills[4] = 100; a.stats.int = a.stats.mag = 200; a.level = 100; w.recalc(a);
b.stats.mag = 1; b.skills[3] = 0; w.recalc(b); b.hp = b.maxHp = 5000;
const [x, y] = w.freeSpotNear(a.x + 3, a.y);
w.grid.release(b.x, b.y, b.id); b.x = b.fx = x; b.y = b.fy = y; w.grid.occupy(x, y, b.id);
w.pvp = true; w.safeAt = () => false;
const cast = spell => { a.lastCast = -1e9; a.busyUntil = 0; w.tick(1200); a.lastCast = -1e9; a.busyUntil = 0; w.command(aid, { t: "cast", spell, x: b.x, y: b.y }); w.tick(200); };
const until = (spell, key) => { for (let i = 0; i < 12 && !sget(w, b, key); i++) cast(spell); return !!sget(w, b, key); };
const HOLD = 25, CONFUSION = 62, CHILL = 45;

// Hold: jugador contrario, fuera de zona segura -> se inmoviliza
a.side = 1; b.side = 2;
assert(until(HOLD, "hold"), "Hold inmoviliza a un jugador contrario");
// no sobre el ya inmovilizado: no se renueva
const u0 = b.st.hold.until; w.tick(3000); cast(HOLD); assert(b.st.hold.until === u0, "Hold no se renueva sobre un inmovilizado");
// zona segura (lanzador u objetivo)
sclear(w, b, "hold"); w.safeAt = (px, py) => px === b.x && py === b.y;
for (let i = 0; i < 5; i++) cast(HOLD); assert(!sget(w, b, "hold"), "Hold no actua si el objetivo esta en casilla segura (iGetAttribute 0x6)");
w.safeAt = (px, py) => px === a.x && py === a.y;
for (let i = 0; i < 5; i++) cast(HOLD); assert(!sget(w, b, "hold"), "Hold no actua si el lanzador esta en casilla segura");
w.safeAt = () => false;
// mismo grupo
a.party = b.party = { id: 3 };
for (let i = 0; i < 5; i++) cast(HOLD); assert(!sget(w, b, "hold"), "Hold no actua sobre el mismo grupo");
a.party = b.party = null;
// m_iAddPR >= 500
b.eff.addPR = 500; for (let i = 0; i < 5; i++) cast(HOLD); assert(!sget(w, b, "hold"), "Hold no actua con addPR >= 500"); b.eff.addPR = 0;

// Confuse: solo el bando contrario, en area
assert(until(CONFUSION, "confuse"), "Confusion afecta al bando contrario");
sclear(w, b, "confuse"); b.side = 1;
for (let i = 0; i < 6; i++) cast(CONFUSION); assert(!sget(w, b, "confuse"), "Confusion salta a los del propio bando (m_side == caster->m_side)");
// area: un segundo jugador contiguo (radio 2) tambien se confunde
b.side = 2;
const cid = w.addPlayer("vecino"), c = w.ents.get(cid); c.stats.mag = 1; c.skills[3] = 0; w.recalc(c); c.side = 2;
const [cx, cy] = w.freeSpotNear(b.x + 1, b.y);
w.grid.release(c.x, c.y, c.id); c.x = c.fx = cx; c.y = c.fy = cy; w.grid.occupy(cx, cy, c.id);
for (let i = 0; i < 12 && !(sget(w, b, "confuse") && sget(w, c, "confuse")); i++) { sclear(w, b, "confuse"); sclear(w, c, "confuse"); cast(CONFUSION); if (sget(w, b, "confuse") && sget(w, c, "confuse")) break; }
assert(sget(w, c, "confuse"), "Confusion es de area: alcanza al vecino");

// Ice: el neutral no sufre dano ni hielo; el de un bando si se congela
sclear(w, b, "confuse"); sclear(w, c, "confuse"); w.grid.release(c.x, c.y, c.id); c.x = c.fx = -1; 
b.side = 0; b.hp = 5000;
for (let i = 0; i < 6; i++) cast(CHILL);
assert(b.hp === 5000 && !sget(w, b, "ice"), "Ice no afecta a un jugador neutral (IsNeutral)");
b.side = 2;
assert(until(CHILL, "ice"), "Ice congela a un jugador de otro bando"); assert(b.hp < 5000, "Ice daña");
console.log("OK magic-hold-confuse-ice");
