// v0.85.69: un mago de nivel 40 con hechizos aprendidos daña de verdad a un vanguard (Paralyze + hielo sin reserva) y gasta maná.
import { study } from "../web/src/shared/systems/botmagic.js";
import { _dbg } from "../tools/train.mjs";
import { setGenes } from "../web/src/shared/systems/botgenes.js";
const { mkAdv, tick, meta } = _dbg;
setGenes({ mage: { pvp: { flee: 0.6, potion: 0.527, rested: 0.649, engage: 0.82, ratio: 1.121 } } });
const a = mkAdv(404), w = a.farm; w.pvp = true;
const x = a.spawnBot(null, { level: 40, mage: true }), y = a.spawnBot(null, { level: 40, mage: false });
x.bot.farmer = y.bot.farmer = false; x.gold = 60000; while (study(w, x, x.bot, () => {})) ;
for (const [id, e] of [...w.ents]) if (e.kind === "npc") w.ents.delete(id);
w.spawnOff = true; x.side = 1; y.side = 2; x.bot.pvpTrain = y.bot.pvpTrain = true;
const spot = [...Array(400).keys()].map(i => [meta.start[0] + (i % 20) * 3 - 30, meta.start[1] + Math.floor(i / 20) * 3 - 30]).find(([px, py]) => !w.grid.blocked(px, py) && !w.grid.blocked(px + 9, py) && !w.safeAt(px, py) && !w.safeAt(px + 9, py));
a.relocate(x, w, [spot[0], spot[1]]); a.relocate(y, w, [spot[0] + 9, spot[1]]);
let min = y.hp, minMp = x.mp;
for (let t = 0; t < 90 && !x.dead && !y.dead; t++) { tick(a, 1); min = Math.min(min, y.hp); minMp = Math.min(minMp, x.mp); }
if (!(min < y.maxHp * 0.9)) throw new Error(`el mago no daña al rival (min ${min}/${y.maxHp})`);
if (!(minMp < x.maxMp * 0.7)) throw new Error("el mago no gasta maná");
console.log("OK mage-pvp-damage", min, minMp);
process.exit(0);
