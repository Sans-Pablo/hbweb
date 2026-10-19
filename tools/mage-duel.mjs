// Diagnóstico: duelo mago vs vanguard (como runPvp) contando hechizos lanzados, maná, estado y resultado.
import { study } from "../web/src/shared/systems/botmagic.js";
import { sget } from "../web/src/shared/systems/status.js";
import { runPvp, _dbg } from "./train.mjs";
import { setGenes } from "../web/src/shared/systems/botgenes.js";
const names = {};
const seeds = (process.argv[2] || "101,202,303,404,505,606").split(",").map(Number), secs = +process.argv[3] || 90;
const tot = {}; let wins = 0, losses = 0, draws = 0;
for (const sd of seeds) {
  const { mkAdv, tick, meta } = _dbg;
  setGenes({ mage: { pvp: { flee: 0.6, potion: 0.527, rested: 0.649, engage: 0.82, ratio: 1.121 } } });
  const a = mkAdv(sd), w = a.farm; w.pvp = true;
  const x = a.spawnBot(null, { level: 40, mage: true }), y = a.spawnBot(null, { level: 40, mage: false });
  x.bot.farmer = y.bot.farmer = false; x.gold = 60000; while (study(w, x, x.bot, () => {})) ;
  for (const [id, e] of [...w.ents]) if (e.kind === "npc") w.ents.delete(id);
  w.spawnOff = true; x.side = 1; y.side = 2; x.bot.pvpTrain = y.bot.pvpTrain = true;
  const spot = [...Array(400).keys()].map(i => [meta.start[0] + (i % 20) * 3 - 30, meta.start[1] + Math.floor(i / 20) * 3 - 30]).find(([px, py]) => !w.grid.blocked(px, py) && !w.grid.blocked(px + 3, py) && !w.safeAt(px, py) && !w.safeAt(px + 3, py));
  a.relocate(x, w, [spot[0], spot[1]]); a.relocate(y, w, [spot[0] + (+process.env.GAP || 3), spot[1]]);
  const casts = {}, states = {}, orig = a.command.bind(a);
  a.command = (id, c) => { if (id === x.id && c.t === "cast") { const n = w.magic[c.spell]?.name || c.spell; casts[n] = (casts[n] || 0) + 1; } return orig(id, c); };
  const holdT = {n:0}; const ev = {}, oe = w.emit.bind(w); w.emit = e => { if (["resist","castbreak","castfail","nomagic"].includes(e.t)) ev[e.t] = (ev[e.t]||0)+1; return oe(e); };
  let t = 0; for (; t < secs && !x.dead && !y.dead; t++) { tick(a, 1); const s = x.bot.state; states[s] = (states[s] || 0) + 1; if (sget(w, y, "hold")) holdT.n++; if (process.env.TR && t < 60 && t % 2 == 0) console.log(t, "d", Math.max(Math.abs(x.x-y.x),Math.abs(x.y-y.y)), "held", !!sget(w,y,"hold"), "mp", x.mp, "act", x.act, "yhp", y.hp, "xhp", x.hp); holdT.min = Math.min(holdT.min ?? 1e9, y.hp); if (y.hp < y.maxHp) holdT.dmg = (holdT.dmg||0)+1; }
  const res = y.dead && !x.dead ? "GANA" : x.dead && !y.dead ? "PIERDE" : "EMPATE";
  if (res === "GANA") wins++; else if (res === "PIERDE") losses++; else draws++;
  for (const k in casts) tot[k] = (tot[k] || 0) + casts[k];
  console.log(`seed ${sd} ${res} t=${t}s mageHP ${x.hp}/${x.maxHp} MP ${x.mp}/${x.maxMp} foeHP ${y.hp}/${y.maxHp} int ${x.int ?? x.stats?.int} mag ${x.mag ?? x.stats?.mag} magicSkill ${x.skills?.[4]} gold ${x.gold}\n   conoce: ${Object.keys(x.magic || {}).map(k => w.magic[k]?.name || k).join(", ")}\n   casts: ${JSON.stringify(casts)} ev: ${JSON.stringify(ev)} hold ${JSON.stringify(holdT)} keys ${Object.keys(y).filter(k=>/stat|eff|hold/i.test(k))}\n   estados(s): ${JSON.stringify(states)}`);
}
console.log(`\nTOTAL gana ${wins} pierde ${losses} empata ${draws}\nhechizos lanzados: ${JSON.stringify(tot)}`);
process.exit(0);
