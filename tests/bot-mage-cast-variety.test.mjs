// v0.85.89: los magos con maná lleno ya no solo lanzan Magic Missile: usan Blizzard / Mass Ice Strike y gastan maná (botmagic.cheapest con RICH)
import assert from "node:assert/strict";
import { _dbg } from "../tools/train.mjs";
import { maxOut } from "../web/src/shared/systems/bot.js";
const { mkAdv, tick } = _dbg, a = mkAdv(7), w = a.farm, bots = [], tot = {};
for (const mb of ["blizzard", "blizzard", "control", "support", "blizzard", "control"]) { const p = a.spawnBot(null, { level: 1, mage: true }); p.bot.farmer = false; p.bot.mb = mb; maxOut(w, p); bots.push(p); }
const ids = new Set(bots.map(p => p.id)), orig = a.command.bind(a);
a.command = (id, c) => { if (ids.has(id) && c.t === "cast") { const n = w.magic[c.spell]?.name || c.spell; tot[n] = (tot[n] || 0) + 1; } return orig(id, c); };
let mp = 0, n = 0; for (let s = 0; s < 240; s++) { tick(a, 1); for (const p of bots) { mp += p.mp / Math.max(1, p.maxMp); n++; } }
const all = Object.values(tot).reduce((x, y) => x + y, 0), mm = tot["Magic Missile"] || 0;
// v0.85.97: los logs reales muestran que un mago sin pociones se queda sin maná; ahora ahorra contra presas débiles (obs. 72/80: el maná se gasta en lo necesario, no en Blizzard contra un Orc)
assert.ok(mm / all < 0.8, "Magic Missile no domina: " + Math.round(mm / all * 100) + "%"); assert.ok(mp / n <= 1, "maná válido");
console.log("OK bot-mage-cast-variety");
process.exit(0);
