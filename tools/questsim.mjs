// Simulación acelerada de las misiones del Acto I con habitantes. node tools/questsim.mjs [bots=9] [minutos=240] [semilla=1] [salida.json]
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
const t0 = Date.now(), done = {}, snap = [];
for (let m = 1; m <= MIN; m++) {
  for (let i = 0; i < 1200; i++) a.tick(50);                                                   // 1 minuto simulado
  if (m % 10 === 0 || m === MIN) {
    const row = rs().map(b => ({ n: b.name, c: b.quests?.cls, lv: b.level, q: b.quests?.n | 0, cur: Q.lineOf(b)[b.quests?.n | 0]?.id, pr: (() => { const cu = Q.lineOf(b)[b.quests?.n | 0]; return cu ? Q.progress(b, cu.goal).join("/") : ""; })(), k: b.delve?.king | 0, dp: b.delve?.deepest | 0, ek: b.ek | 0 }));
    snap.push({ m, row });
    console.log(`[${m} min · ${((Date.now() - t0) / 1000).toFixed(0)} s reales] ` + row.map(r => `${r.n}:${r.c?.[0]}L${r.lv} q${r.q}(${r.cur?.split(".")[1]} ${r.pr})`).join("  "));
  }
}
const out = rs().map(b => ({ name: b.name, cls: b.quests?.cls, level: b.level, n: b.quests?.n, t: b.quests?.t, ek: b.ek, deepest: b.delve?.deepest, king: b.delve?.king, goal: b.res?.goal, ideas: b.res?.ideas }));
if (OUT) writeFileSync(OUT, JSON.stringify({ N, MIN, SEED, out, snap }, null, 1));
// QLOG=Aldric,Doran node tools/questsim.mjs …  → vuelca el diario de esos habitantes (diagnóstico)
for (const b of rs().filter(b => (process.env.QLOG || "").split(",").includes(b.name))) console.log(`== ${b.name} L${b.level} vida ${b.maxHp} dd ${JSON.stringify(b.res.dd)} bossFails ${b.res.bossFails}\n` + (b.bot.log || []).slice(-40).join("\n"));
