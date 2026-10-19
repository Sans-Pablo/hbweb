// Censo de hechizos (v0.85.89): mages nivel 140 de cada build cazando en la granja; cuenta los {t:"cast"} por hechizo y por bot, y el maná medio.
// node tools/cast-census.mjs [segundos=300] [semilla=7]
import { _dbg } from "./train.mjs";
import { maxOut } from "../web/src/shared/systems/bot.js";
const secs = +process.argv[2] || 300, seed = +process.argv[3] || 7, { mkAdv, tick } = _dbg;
const a = mkAdv(seed), w = a.farm, bots = [];
for (const mb of ["blizzard", "blizzard", "control", "support", "blizzard", "control"]) { const p = a.spawnBot(null, { level: 1, mage: true }); p.bot.farmer = false; p.bot.mb = mb; maxOut(w, p); bots.push(p); }
const cnt = new Map(bots.map(p => [p.id, {}])), mpSum = new Map(bots.map(p => [p.id, 0])), orig = a.command.bind(a);
a.command = (id, c) => { const m = cnt.get(id); if (m && c.t === "cast") { const n = w.magic[c.spell]?.name || c.spell; m[n] = (m[n] || 0) + 1; } return orig(id, c); };
let n = 0; for (let s = 0; s < secs; s++) { tick(a, 1); n++; for (const p of bots) mpSum.set(p.id, mpSum.get(p.id) + p.mp / Math.max(1, p.maxMp)); }
const tot = {};
for (const p of bots) { const m = cnt.get(p.id); for (const k in m) tot[k] = (tot[k] || 0) + m[k];
  console.log(`${p.name} ${p.bot.mb} lv${p.level} int${p.stats.int} mag${p.stats.mag} skill4=${p.skills[4]} maxMp${p.maxMp} mpMedio ${Math.round(mpSum.get(p.id) / n * 100)}% conoce ${Object.keys(p.magic || {}).length} exp+${p.exp}\n   casts ${JSON.stringify(m)}`); }
console.log("TOTAL", JSON.stringify(tot));
process.exit(0);
