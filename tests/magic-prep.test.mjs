// Elegir un hechizo en el libro empieza la animación de lanzar; el clic lo suelta sobre el objetivo.
// node tests/magic-prep.test.mjs
import { MAGIC_MODE } from "../web/src/shared/magic.js";
MAGIC_MODE.player = true;   // estas pruebas ejercitan el sistema de hechizos del jugador (cerrado en el juego, ver talents.js)
MAGIC_MODE.free = false;
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { ACT } from "../web/src/shared/const.js";

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
p.magic = { 0: 1, 20: 1 }; p.mp = p.maxMp = 200;
const events = []; const origEmit = w.emit.bind(w); w.emit = e => { events.push(e); origEmit(e); };

assert(w.command(pid, { t: "prepare", spell: 0 }) === true, "prepare acepta el hechizo");
assert(p.act === ACT.MAGIC, "al elegirlo empieza la animación de lanzar");
assert(events.some(e => e.t === "prepare"), "evento prepare");
assert(w.command(pid, { t: "cast", spell: 0, x: p.x + 2, y: p.y, pre: true }) === true, "el clic lanza con la animación ya hecha");
w.tick(1500);
assert(events.some(e => e.t === "spell" && e.spell === 0) || events.some(e => e.t === "castfail"), "el hechizo se resuelve");
// sin preparar, lanzar sigue funcionando con su propia animación
w.tick(1500);
assert(w.command(pid, { t: "cast", spell: 0, x: p.x + 2, y: p.y }) === true, "lanzar sin preparar");
// preparar otro hechizo e intentar lanzar uno distinto con pre: no cuenta como preparado
w.tick(1500);
assert(w.command(pid, { t: "prepare", spell: 20 }) === true, "preparar fuego");
w.tick(1500);
assert(w.command(pid, { t: "cast", spell: 0, x: p.x + 2, y: p.y, pre: true }) === true, "otro hechizo cae al camino normal");
console.log("OK");
