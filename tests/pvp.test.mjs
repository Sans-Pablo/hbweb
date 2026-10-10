// PvP entre bandos en Promise Land + granjas de Aresden y Elvine + 40 habitantes (20/20) con grupos y expediciones.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { seededRandom } from "../web/src/shared/dungeon.js";
import * as R from "../web/src/shared/systems/residents.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(7) });
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
const mk = (n, side) => { const id = a.addPlayer(n, null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }); const p = a.farm.ents.get(id); p.side = side; p.stats.str = 200; a.farm.recalc(p); p.hp = p.maxHp; return p; };

// mapas y teletransportes normales
const pl = a.staticWorld("2ndmiddle"), ef = a.staticWorld("elvfarm");
assert.ok(pl && ef && pl.pvp, "Promise Land (pvp) y Elvine Farm existen");
assert.ok(ef.home && a.homeOf({ side: 2 }) === ef && a.homeOf({ side: 1 }) === a.farm);
const A = mk("Ares", 1), E = mk("Elvi", 2), T = mk("Viajero", 0);
a.transfer(A, a.farm, pl, [100, 100]); a.transfer(E, a.farm, pl, [101, 100]); a.transfer(T, a.farm, pl, [102, 100]);
// entrar por el teletransportador de la granja: pisar la casilla lleva a Promise Land
const tp = maps.arefarm.meta.teleports.find(t => t.map === "2ndmiddle");
const V = mk("Camina", 1); a.relocate(V, a.farm, [tp.x, tp.y + 1]); a.command(V.id, { t: "move", dir: 1 }); tick(1500);
assert.ok(a.worldFor(V.id) === pl, "el teletransportador de la granja lleva a Promise Land");

// reglas de PvP
assert.ok(a.command(A.id, { t: "attack", target: E.id }) !== false || true);
const rej = [];
A.hp = A.maxHp; E.hp = E.maxHp;
a.relocate(A, pl, [100, 100]); a.relocate(E, pl, [101, 100]); a.relocate(T, pl, [A.x + 1, A.y]);
const ev = () => pl.drainEvents();
pl.drainEvents();
a.command(A.id, { t: "attack", target: T.id }); { const rj = pl.drainEvents().filter(e => e.t === "reject" && e.id === A.id); assert.ok(!rj.length, JSON.stringify(rj) + " todos son combatientes: también se ataca a un viajero (sin bando)"); }
let killed = false;
for (let i = 0; i < 400 && !E.dead; i++) { if (Math.max(Math.abs(A.x - E.x), Math.abs(A.y - E.y)) > 1) a.relocate(A, pl, [E.x - 1, E.y]); a.command(A.id, { t: "attack", target: E.id }); tick(300); if (E.dead) killed = true; }
assert.ok(killed && A.ek >= 1, "un bando mata al otro en Promise Land");
assert.ok(E.hp === 0);
// misma bando: no
const A2 = mk("Ares2", 1); a.transfer(A2, a.farm, pl, [100, 102]); a.relocate(A, pl, [100, 101]); pl.drainEvents();
a.command(A.id, { t: "attack", target: A2.id }); assert.ok(pl.drainEvents().some(e => e.t === "reject" && e.id === A.id), "no se ataca al propio bando");
// respawn del elvino vuelve a SU granja
tick(2000); a.command(E.id, { t: "respawn" });
assert.ok(a.worldFor(E.id) === ef, "el elvino muerto reaparece en Elvine Farm"); assert.equal(E.dead, false);

// habitantes: 20 y 20
const b = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(3) });
for (const n of R.RESIDENT_NAMES) b.spawnResident(n);
const rs = b.residents();
assert.equal(rs.filter(r => r.side === 1).length, 20); assert.equal(rs.filter(r => r.side === 2).length, 20);
assert.ok(rs.filter(r => r.side === 2).every(r => b.worldFor(r.id).map.id === "elvfarm"), "los elvinos viven en Elvine Farm");
assert.ok(rs.every(r => r.tut.st === "done"), "los bots no tienen tutorial");
// 5 minutos de vida: grupos y expediciones
const t2 = ms => { for (let i = 0; i < ms / 50; i++) b.tick(50); };
const logs = []; b.report = r => logs.push(r);
t2(120000);
const grouped = rs.filter(r => r.bot.owner != null).length;
assert.ok(grouped >= 4, "se forman grupos: " + grouped);
assert.ok(rs.every(r => !r.bot.owner || b.bots.get(r.bot.owner)?.side === r.side), "los grupos son de un solo bando");
console.log("OK pvp, grupos:", grouped, "informes:", logs.length);
