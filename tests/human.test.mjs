// Humanización: horarios de conexión (admin: pins y mínimo), AFK, erratas, charla y llegadas con experiencia
import * as H from "../web/src/shared/systems/human.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { RESIDENT_NAMES } from "../web/src/shared/systems/residents.js";
const dir = new URL("../web/data/", import.meta.url), json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n", "gshop_1f"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(5) });
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
// weight: 1 en su hora punta, bajo de madrugada
const hum = { peak: 20 }; assert.equal(H.weight(hum, 20), 1); assert.equal(H.weight(hum, 23), 1); assert.ok(H.weight(hum, 8) <= 0.13); assert.ok(H.weight(hum, 0) > 0.5);
// apagado por defecto: nadie se va
for (const n of RESIDENT_NAMES.slice(0, 8)) a.spawnResident(n);
tick(30000); assert.equal(a.residents().length, 8, "sin activar nadie se desconecta");
// activado: se van hasta el mínimo y vuelven al fijarlos «on»
const cfg = H.cfgOf(a); cfg.on = true; cfg.minOnline = 3; cfg.afk = false;
a.hourFn = () => 5; for (const p of a.residents()) { const h = H.traits(p.res, p.name); h.peak = 17; h.until = 1; }
for (let k = 0; k < 30 && a.residents().length > 3; k++) { for (const p of a.residents()) H.traits(p.res, p.name).until = 1; tick(20000); }
assert.equal(a.residents().length, 3, "se queda el mínimo conectado: " + a.residents().length); assert.equal(a.offline.size, 5);
const gone = [...a.offline.keys()][0]; assert.ok(a.offline.get(gone).save?.res, "su partida queda guardada");
H.configure(a, { pins: { [gone]: "on" } }); tick(10000);
assert.ok(a.residents().some(p => p.name === gone), "el admin lo fuerza a conectarse"); assert.ok(!a.offline.has(gone));
H.configure(a, { pins: { [gone]: "off" } }); for (let k = 0; k < 90 && a.residents().some(p => p.name === gone); k++) tick(20000);   // si está en un encargo (hospital de compañeros) termina antes de irse
assert.ok(!a.residents().some(p => p.name === gone), "y también a salir");
const st = H.status(a); assert.equal(st.online + st.offline, 8); assert.equal(st.bots.find(b => b.name === gone).pin, "off");
// AFK: se queda quieto y vuelve
H.configure(a, { all: "auto", on: true }); cfg.minOnline = 0; cfg.afk = true;
const p0 = a.residents().find(p => a.worldFor(p.id) === a.homeOf(p)) || a.residents()[0]; const r0 = p0.res; { const wf = a.worldFor(p0.id), hm = a.homeOf(p0); if (wf !== hm) a.transfer(p0, wf, hm, hm.home); } const w0 = a.worldFor(p0.id); H.traits(r0, p0.name).afkNext = 1; H.traits(r0, p0.name).afk = 5; p0.bot.target = null; p0.bot.travel = null; r0._trip = r0._delve = r0._pet = r0._plan = null; p0.bot.owner = null; p0.hp = p0.maxHp; p0.lastCombat = 0;
w0.time += 10000; let afk = false; for (let i = 0; i < 40 && !afk; i++) { H.traits(r0, p0.name).afkNext = 1; afk = H.afk(a, w0, p0, r0); w0.time += 500; }
assert.ok(afk && r0._afk, "entra en pausa AFK");
w0.time = r0._afk.until + 1; assert.equal(H.afk(a, w0, p0, r0), false); assert.equal(r0._afk, null);
// erratas: con rasgo alto salen y se corrigen
let bad = 0; const q = a.residents()[1]; H.traits(q.res, q.name).typo = 1; for (let i = 0; i < 200; i++) if (H.typo(a, q, "esto funciona bastante bien") !== "esto funciona bastante bien") bad++;
assert.ok(bad > 5 && bad < 80, "erratas ocasionales: " + bad);
// llegadas con experiencia
let vets = 0; for (let i = 0; i < 100; i++) if (H.arrivalLevel(a, "N" + i, i * 7919) > 7) vets++; assert.ok(vets > 10 && vets < 60, "recién llegados con nivel: " + vets);
console.log("OK");
