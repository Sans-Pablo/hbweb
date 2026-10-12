// Simulación acelerada de las misiones del Acto I con habitantes. node tools/questsim.mjs [bots=9] [minutos=240] [semilla=1] [salida.json]
import { EQUIP as EQ } from "../web/src/shared/items.js";
import { readFileSync, writeFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import * as Q from "../web/src/shared/systems/quests.js";
const dir = new URL("../web/data/", import.meta.url), json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const N = +(process.argv[2] || 9), MIN = +(process.argv[3] || 240), SEED = +(process.argv[4] || 1), OUT = process.argv[5];
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: json("arefarm.spawns.json"), maps, rng: seededRandom(SEED) });
const NAMES = ["Aldric", "Cora", "Brann", "Isolde", "Doran", "Mira", "Kael", "Sorcha", "Tamsin", "Orin", "Vesna", "Hale", "Nyra", "Garrick", "Lysa", "Perrin", "Edda", "Torvald"];
for (const n of NAMES.slice(0, N)) a.spawnResident(n);
const rs = () => a.residents();
// QFULL=Mira → diario completo (con minuto) filtrado por QGREP, volcado al final
const FULL = (process.env.QFULL || "").split(",").filter(Boolean), flog = {};
if (FULL.length) a.logSink = (p, t, time) => { if (FULL.includes(p.name) && (!process.env.QGREP || new RegExp(process.env.QGREP).test(t))) (flog[p.name] ||= []).push(Math.round(time / 60000) + "m " + t.slice(0, 200)); };
const t0 = Date.now(), done = {}, snap = [];
for (let m = 1; m <= MIN; m++) {
  for (let i = 0; i < 1200; i++) { a.tick(50); if (process.env.TRACE && m >= +process.env.TRACEFROM && i % 70 === 0) { const b = rs().find(x => x.name === process.env.TRACE); if (b) { const sig = Object.entries(b.equip).map(([sl, u]) => sl + ":" + (data.item(b.bag.find(x => x.uid === u)?.id)?.name)).join(" ") + " g" + b.gold; if (sig !== b._sig) { b._sig = sig; console.log("TRACE m" + m + "." + i + " " + sig); } } } }                                                   // 1 minuto simulado
  if (process.env.WATCH) for (const b of rs()) { const has = b.equip[8] !== undefined || b.equip[9] !== undefined; if (b._had && !has) console.log('LOSTWEAPON ' + b.name + ' m' + m + ' ' + JSON.stringify(b.bot.log.slice(-4))); b._had = has; }
  if (m % 10 === 0 || m === MIN) {
    const row = rs().map(b => ({ n: b.name, c: b.quests?.cls, lv: b.level, q: b.quests?.n | 0, cur: Q.lineOf(b)[b.quests?.n | 0]?.id, pr: (() => { const cu = Q.lineOf(b)[b.quests?.n | 0]; return cu ? Q.progress(b, cu.goal).join("/") : ""; })(), k: b.delve?.king | 0, dp: b.delve?.deepest | 0, ek: b.ek | 0 }));
    snap.push({ m, row });
    console.log(`[${m} min · ${((Date.now() - t0) / 1000).toFixed(0)} s reales] ` + row.map(r => `${r.n}:${r.c?.[0]}L${r.lv} q${r.q}(${r.cur?.split(".")[1]} ${r.pr})`).join("  "));
  }
}
const out = rs().map(b => ({ name: b.name, cls: b.quests?.cls, level: b.level, n: b.quests?.n, t: b.quests?.t, ek: b.ek, deepest: b.delve?.deepest, king: b.delve?.king, goal: b.res?.goal, ideas: b.res?.ideas }));
if (OUT) writeFileSync(OUT, JSON.stringify({ N, MIN, SEED, out, snap }, null, 1));
// QLOG=Aldric,Doran node tools/questsim.mjs …  → vuelca el diario de esos habitantes (diagnóstico)
for (const b of rs().filter(b => (process.env.QLOG || "").split(",").includes(b.name))) console.log(`== ${b.name} L${b.level} vida ${b.maxHp} dd ${JSON.stringify(b.res.dd)} bossFails ${b.res.bossFails}\n` + (b.bot.log || []).filter(l => !process.env.QGREP || new RegExp(process.env.QGREP).test(l)).slice(-(+process.env.QN || 40)).join("\n"));
// DIAG=1 → por habitante: poder frente al jefe del piso 5 (dps, vida, objeto medio, oro, pociones)
if (process.env.DIAG) {
  const { fightEstimate, bossPreview, dpsOf } = await import("../web/src/shared/systems/bot.js"), { avgIlvl } = await import("../web/src/shared/systems/residents.js");
  for (const b of rs()) { const w = a.worldFor(b.id), bp = bossPreview(w, 5), e = fightEstimate(w, b, bp, true), red = data.named("RedPotion"), pots = b.bag.reduce((s, i) => s + (red && i.id === red.id ? i.count || 1 : 0), 0);
    console.log(`DIAG ${b.name} ${b.quests?.cls} L${b.level} hp${b.maxHp} dps${dpsOf(b).toFixed(1)} ilvl${avgIlvl(w, b).toFixed(0)} oro${b.gold} pots${pots} bossHp${bp.hp} ttk${e.ttk.toFixed(0)}s taken${e.taken.toFixed(0)} ratio${e.ratio.toFixed(2)} str${b.stats.str} vit${b.stats.vit} dex${b.stats.dex} int${b.stats.int} mag${b.stats.mag}`); }
}
for (const n of FULL) console.log("== LOG " + n + String.fromCharCode(10) + (flog[n] || []).slice(-(+process.env.QN || 60)).join(String.fromCharCode(10)));
// GEAR=1 → equipo puesto de cada habitante
if (process.env.GEAR) for (const b of rs()) { const w = a.worldFor(b.id); console.log("GEAR " + b.name + " L" + b.level + " " + Object.entries(b.equip).map(([s, u]) => { const i = b.bag.find(x => x.uid === u), d = i && data.item(i.id); return d ? d.name + "(" + (d.damage ? JSON.stringify(d.damage) : "") + ")" : null; }).filter(Boolean).join(", ") + " dmg " + JSON.stringify(Object.keys(b.eff||{}).length ? b.eff.sm : "")); }
if (process.env.BAG) { const Inv2 = await import("../web/src/shared/inventory.js"); for (const n of process.env.BAG.split(",")) { const b = rs().find(x => x.name === n); if (b) console.log("WEIGHT " + n + " " + JSON.stringify(Object.fromEntries(Object.entries(Inv2).filter(([k]) => /weight|Weight/.test(k)).map(([k, v]) => [k, typeof v === "function" ? (() => { try { return v(b, data); } catch (e) { return "err"; } })() : v]))) + " str" + b.stats.str + " items" + b.bag.length); } }
if (process.env.BAG) for (const n of process.env.BAG.split(",")) { const b = rs().find(x => x.name === n); if (b) console.log("BAG " + n + " oro" + b.gold + " equip " + JSON.stringify(b.equip) + " cls " + b.quests?.cls + ": " + b.bag.map(i => data.item(i.id)?.name + (i.count > 1 ? "x" + i.count : "")).join(", ")); }
if (process.env.WHY) { const Inv = await import("../web/src/shared/inventory.js"); for (const n of process.env.WHY.split(",")) { const b = rs().find(x => x.name === n); if (!b) continue; console.log("WHY " + n + " str" + b.stats.str + " lv" + b.level + " g" + b.gender); for (const i of b.bag) { const d = data.item(i.id); if (d && (d.equipPos === 8 || d.equipPos === 9)) { const eq = JSON.parse(JSON.stringify(b.equip)); const r = Inv.equip(b, data, i.uid); console.log("  " + d.name + " pos" + d.equipPos + " lvl" + d.levelLimit + " -> " + r.ok + " " + r.why); } } } }
if (process.env.WHY2) { const { itemLevel } = await import("../web/src/shared/itemlevel.js"); const SK = process.env.WHY2; const b = rs().find(x => x.name === SK); console.log("badUid", [...(b.bot.badUid||[])].length, "bad", [...(b.bot.bad||[])].join(",")); for (const i of b.bag) { const d = data.item(i.id); if (d && (d.equipPos === 8 || d.equipPos === 9)) console.log(d.name, "ilv", itemLevel(d, i.attr, i.id), "life", i.life, "bad", b.bot.badUid?.has(i.uid), "spec", d.effectType); } }
