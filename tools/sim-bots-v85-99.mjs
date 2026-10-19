// Simulación de 10 min (12000 ticks) con los 40 residentes a nv140: cuenta los comportamientos de v0.85.99 y los bots quietos. Uso: node tools/sim-bots-v85-99.mjs [semilla]
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import * as Residents from "../web/src/shared/systems/residents.js";
const dir = new URL("../web/data/", import.meta.url), json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n", "gshop_1f", "wrhus_1", "bsmith_1"]) { try { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; } catch {} }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: json("arefarm.spawns.json"), maps, rng: seededRandom(+process.argv[2] || 11) });
for (const n of Residents.RESIDENT_NAMES) a.spawnResident(n);
for (let i = 0; i < 200; i++) a.tick(50);
a.bots140(); a.botsSoft();
const C = { castMM: 0, castParMinor: 0, castSameCity: 0, castDetSame: 0, potFullMana: 0, potUse: 0, townTrips: 0, sold: 0 };
const orig = a.command.bind(a);
const TR = process.env.TRACE;
a.command = (id, cmd) => {
  const w = a.worldFor(id), p = w?.ents.get(id);
  if (TR && p?.name === TR) console.log(w.time, JSON.stringify(cmd).slice(0,80), p.x, p.y, w.map.id);
  if (p?.bot && cmd.t === "cast") {
    const t = [...w.ents.values()].find(e => e !== p && !e.dead && e.x === cmd.x && e.y === cmd.y && (e.kind === "player" || e.kind === "npc"));
    const hasOther = [91, 81, 74, 72, 63, 60, 57, 47, 43, 45, 30, 20, 10].some(h => p.magic?.[h]);
    if (cmd.spell === 0 && hasOther) C.castMM++;
    if ([35, 25].includes(cmd.spell) && t?.kind === "npc" && (t.maxHp || t.hp) < 150) C.castParMinor++;
    if (t?.kind === "player" && p.side > 0 && t.side === p.side && !w.fightZone) { (C.sameSpells ||= {})[cmd.spell + ":" + (w.magic[cmd.spell]?.name || "")] = (C.sameSpells[cmd.spell + ":" + (w.magic[cmd.spell]?.name || "")] || 0) + 1; C.castSameCity++; if (cmd.spell === 59 || cmd.spell === 44) C.castDetSame++; }
  }
  if (p?.bot && cmd.t === "use") { const it = p.bag.find(i => i.uid === cmd.uid), d = it && w.data.item(it.id); if (d && it.id === data.named("BluePotion")?.id) { C.potUse++; if (p.mp >= p.maxMp) C.potFullMana++; } }
  return orig(id, cmd);
};
const all = () => [...a.bots.keys()].map(id => a.worldFor(id)?.ents.get(id)).filter(p => p && p.kind === "player");
const bots = all(), last = new Map(), still = new Map(), kinds = new Map(), cap = new Map();
for (const p of bots) { last.set(p.id, [p.x, p.y, a.worldFor(p.id).time]); still.set(p.id, 0); kinds.set(p.id, new Set()); }
const REP = {}; a.report = r => { const k = r.kind + ":" + r.topic; (REP[k] ||= []).push(r.bot + "@t" + (globalThis.__i * 50 / 1000 | 0) + "@" + r.map + "(" + r.x + "," + r.y + ")"); };
const TICKS = Math.round((+process.env.HOURS || 1 / 6) * 72000);
const POS = {};
let town = 0;
for (let i = 0; i < TICKS; i++) { globalThis.__i = i;
  a.tick(50); if (process.env.DBG && i % 100 === 0) { const p = bots.find(q => q.name === process.env.DBG), w = a.worldFor(p.id), b = p.bot; if (w.time > (+process.env.T0 || 185000) && w.time < (+process.env.T1 || 260000)) console.log("DBG", w.time, p.x, p.y, "tg", b.target?.name, b.target && Math.round(Math.hypot(b.target.x - p.x, b.target.y - p.y)), "hold", b.hold - w.time, "rest", b.rest, "mode", b.mode, b.think?.what, "pt", p.recallTok, "mp", p.mp, p.maxMp, "hp", p.hp, p.maxHp, "lc", p.lastCast, "cA", b.castAt, "tgHold", JSON.stringify(b.target && w.ents.get(b.target.id)?.eff?.hold), "tgkind", b.target?.kind, b.target?.target); }
  if (i % 100 !== 99) continue;
  for (const p of bots) {
    const w = a.worldFor(p.id), k = w.map.kind; const pk = [...kinds.get(p.id)].pop(); if ((k === "town" || k === "indoor") && pk && pk !== "town" && pk !== "indoor") C.townTrips++; if (process.env.MAPLOG && process.env.MAPLOG.split(",").includes(p.name) && p._ml !== (w.map.id||k)) { p._ml = w.map.id||k; console.log("MAP", p.name, w.time, p._ml, p.x, p.y); } kinds.get(p.id).delete(k); kinds.get(p.id).add(k);
    const [x, y] = last.get(p.id);
    if (p.dead || p.x !== x || p.y !== y || p.bot?.fish || p.bot?.rest || (p.res?.job && k === "farm")) { last.set(p.id, [p.x, p.y]); still.set(p.id, 0); } else still.set(p.id, still.get(p.id) + 5);
    if (still.get(p.id) >= 60 && still.get(p.id) > (cap.get(p.id) || 0)) POS[p.name] = w.map.id + "(" + p.x + "," + p.y + ") " + (p.bot?.think?.what || p.bot?.mode || "");
    cap.set(p.id, Math.max(cap.get(p.id) || 0, still.get(p.id)));
  }
}
const stuck = bots.filter(p => cap.get(p.id) >= 60).map(p => p.name + ":" + cap.get(p.id) + "s:" + (p.bot?.think?.what || p.bot?.mode || p.bot?.fixed || "") + ":" + a.worldFor(p.id).map.kind);
const mages = bots.filter(p => (p.stats?.int || 0) >= 70);
function w0(p) { const w = a.worldFor(p.id), u = p.equip[1]; const it = p.bag.find(i => i.uid === u); return it ? (w.data.item(it.id)?.name || "") : ""; }
const visitedTown = bots.filter(p => [...kinds.get(p.id)].some(k => k === "town" || k === "indoor")).length;
const withHat = mages.filter(p => /^Wizard-(Hat|Cap)/.test(w0(p))).length;
console.log("horas simuladas", TICKS / 72000, "avisos", JSON.stringify(Object.fromEntries(Object.entries(REP).map(([k, v]) => [k, v.length + " " + v.slice(0, 5).join(" ")])), null, 1), "posQuietos", JSON.stringify(POS, null, 1));
console.log(JSON.stringify({ bots: bots.length, mages: mages.length, magesConGorroMago: withHat, botsQueVisitaronCiudad: visitedTown, quietos60s: stuck, ...C }, null, 1));
if (process.env.WHO) for (const p of bots.filter(q => process.env.WHO.split(",").includes(q.name))) { const b = p.bot, w = a.worldFor(p.id); console.log(p.name, w.map.id || w.map.kind, p.x, p.y, p.hp, "/", p.maxHp, JSON.stringify({ think: b.think, rest: b.rest, goal: b.goal && {x:b.goal.x,y:b.goal.y}, path: b.path?.length, fails: b.fails, fix: b.fixed, wander: !!b.wander, act: b.act, owner: b.owner, travel: !!b.travel, hold: b.hold, noFight: b.noFight, target: b.target?.name, leave: p.res?._leaveAt, t: w.time }).slice(0, 300), "OWNER", (()=>{const o=b.owner&&a.worldFor(b.owner)?.ents.get(b.owner);return o?[o.name,a.worldFor(o.id).map.id,o.x,o.y,o.dead,o.hp].join(","):"-"})()); }
process.exit(0);
