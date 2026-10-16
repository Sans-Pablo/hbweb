// Sistema 12: Recall (10 s sin daño, HG.cpp:10908), Summon (mismo bando, tope magery/20, GM exento, HG.cpp:10933). node tests/magic-summon-recall.test.mjs
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
const aid = w.addPlayer("mago"), a = w.ents.get(aid);
for (const u of Object.values(a.equip)) w.command(a.id, { t: "unequip", uid: u });
w.tick(1000);
a.fullMage = true; a.skills[4] = 100; a.stats.int = a.stats.mag = 200; a.level = 100; w.recalc(a);
w.pvp = false; w.safeAt = () => false;
let recalls = 0; w.hooks = { recall: () => { recalls++; } };
const evs = []; const emit = w.emit.bind(w); w.emit = e => { evs.push(e); return emit(e); };
const RECALL = 12, SUMMON = 31;
const cast = (spell, t) => { a.lastCast = -1e9; a.busyUntil = 0; w.tick(1200); a.lastCast = -1e9; a.busyUntil = 0; w.command(aid, { t: "cast", spell, x: (t || a).x, y: (t || a).y }); w.tick(200); };
const retry = (spell, ok) => { for (let i = 0; i < 30 && !ok(); i++) cast(spell); return ok(); };

// Recall: tras recibir daño, 10 s de espera (GM exento)
a.lastDamage = w.time;
const nm0 = evs.filter(e => e.t === "nomagic").length;
for (let i = 0; i < 6; i++) cast(RECALL);
assert(recalls === 0 && evs.filter(e => e.t === "nomagic").length > nm0, "con daño reciente el Recall no sale (HG.cpp:10913)");
a.lastDamage = w.time - 11000;
assert(retry(RECALL, () => recalls > 0), "10 s despues sale el Recall");
recalls = 0; a.lastDamage = w.time; a.gm = true;
assert(retry(RECALL, () => recalls > 0), "el GM no tiene la espera");
a.gm = false; a.lastDamage = -1e9;

// Summon: tope magery/20 = 5 seguidores; otro bando no
a.side = 1;
const followers = () => [...w.ents.values()].filter(e => e.master === a.id && !e.dead && !e.comp).length;
for (let i = 0; i < 40 && followers() < 5; i++) cast(SUMMON);
assert(followers() === 5, "llega al tope magery/20 = 5 (HG.cpp:10958): " + followers());
for (let i = 0; i < 6; i++) cast(SUMMON);
assert(followers() === 5, "con el tope no invoca mas");
a.gm = true; for (let i = 0; i < 40 && followers() < 6; i++) cast(SUMMON);
assert(followers() > 5, "el GM salta el tope");
a.gm = false;
// objetivo de otro bando (otro jugador): no invoca
const bid = w.addPlayer("otro"), b = w.ents.get(bid); b.side = 2;
for (const e of [...w.ents.values()]) if (e.master === a.id) { e.dead = true; e.hp = 0; }
const [x, y] = w.freeSpotNear(a.x + 3, a.y); w.grid.release(b.x, b.y, b.id); b.x = b.fx = x; b.y = b.fy = y; w.grid.occupy(x, y, b.id);
w.tick(3000);   // deja terminar lanzamientos pendientes del GM
for (const e of [...w.ents.values()]) if (e.master === a.id) { e.dead = true; e.hp = 0; }
for (let i = 0; i < 8; i++) cast(SUMMON, b);
assert(followers() === 0, "objetivo de otro bando: no se invoca (HG.cpp:10951)");
console.log("OK magic-summon-recall");
