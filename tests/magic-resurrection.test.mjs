// Sistema 10: Resurrection (HG.cpp:10416, 38015, 2290). node tests/magic-resurrection.test.mjs
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
w.pvp = true; w.safeAt = () => false;
const RES = 94;
const kill = () => { b.hp = 0; b.dead = true; b.deadAt = w.time; w.grid.release(b.x, b.y, b.id); b.beingResurrected = false; };
const cast = () => { a.lastCast = a.castTry = -1e9; a.busyUntil = 0; w.tick(1200); a.lastCast = a.castTry = -1e9; a.busyUntil = 0; w.command(aid, { t: "cast", spell: RES, x: b.x, y: b.y }); w.tick(200); };
const tryCast = () => { for (let i = 0; i < 12 && !b.beingResurrected && !a.specialAbilityTime; i++) cast(); };
const evs = []; w.on?.("event", e => evs.push(e));
a.side = 1; b.side = 2; kill();
for (let i = 0; i < 4; i++) cast();
assert(!b.beingResurrected && !a.specialAbilityTime, "otro bando: sin efecto (HG.cpp:10419)");
b.side = 1; kill(); a.fullMage = false; a.magic[RES] = 1; a.mp = a.maxMp;
tryCast();
assert(b.beingResurrected && b.dead, "mismo bando: pide confirmacion, aun no revive");
assert(a.specialAbilityTime > 0 && a.specialAbilityTime <= 1200 && !a.magic[RES], "se consume el hechizo y empieza la espera (HG.cpp:10425)");
// espera: segundo lanzamiento no hace nada
const b2 = b.beingResurrected; b.beingResurrected = false; cast(); assert(!b.beingResurrected, "con la espera activa no resucita (HG.cpp:10422)"); b.beingResurrected = b2;
// responder sin peticion
const c = w.addPlayer("otro"), pc = w.ents.get(c); const r0 = w.command(c, { t: "resurrect", accept: true }); assert(r0 === false || pc.hp > 0, "aceptar sin peticion se rechaza");
// rechazar
w.command(bid, { t: "resurrect", accept: false }); assert(b.dead && !b.beingResurrected, "rechazar mantiene el cadaver y limpia la peticion");
// aceptar
b.beingResurrected = true; const bx = b.x, by = b.y;
w.command(bid, { t: "resurrect", accept: true });
assert(!b.dead && b.hp === Math.floor(b.maxHp / 2) && b.x === bx && b.y === by, "acepta: revive en el sitio con maxHp/2 (HG.cpp:38045)");
// cuenta atras: 1 por segundo
const t0 = a.specialAbilityTime; w.tick(5000); assert(a.specialAbilityTime < t0, "la espera baja con el tiempo");
a.specialAbilityTime = 1; w.tick(2500); assert(a.specialAbilityTime === 0, "no baja de 0");
// GM: sin bando ni espera
a.gm = true; a.magic[RES] = 1; a.mp = a.maxMp; a.specialAbilityTime = 500; b.side = 2; kill(); for (let i = 0; i < 12 && !b.beingResurrected; i++) cast();
assert(b.beingResurrected && a.specialAbilityTime > 400 && a.magic[RES] === 1, "GM salta bando y espera, no consume (HG.cpp:10419)");
console.log("OK magic-resurrection");
