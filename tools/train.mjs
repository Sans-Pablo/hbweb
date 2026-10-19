// ENTRENADOR EVOLUTIVO de bots (v0.85.64). node tools/train.mjs [generaciones=6] [poblacion=8] [segundos=90] [clases=vanguard,mage] [modos=pve,pvp]
// Simula peleas aceleradas sin navegador (shared/ corre en Node), puntúa cada juego de genes (botgenes.js) y guarda el mejor en web/data/botgenes.json
// con la curva de fitness por generación. Todo determinista con semilla: misma semilla → mismo resultado.
import { Worker, isMainThread } from "node:worker_threads";
import { cpus } from "node:os";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { study } from "../web/src/shared/systems/botmagic.js";
import { DEBUG } from "../web/src/shared/systems/debug.js";
import { seededRandom } from "../web/src/shared/dungeon.js";
import { DEFAULTS, KEYS, clamp, setGenes } from "../web/src/shared/systems/botgenes.js";
const dir = new URL("../web/data/", import.meta.url), OUT = new URL("../web/data/botgenes.json", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json"), spawns = json(meta.map + ".spawns.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
const grid = new Uint8Array(readFileSync(new URL("arefarm.bin", dir)));
DEBUG.enabled = true;
const mkAdv = seed => new Adventure({ grid: new Grid(meta.w, meta.h, grid.slice()), start: meta.start, npcDb, data, spawns, maps: {}, rng: seededRandom(seed) });
const tick = (a, secs) => { for (let i = 0; i < secs * 20; i++) a.tick(50); };

// PvE: un bot en la granja con los generadores reales; fitness = exp/min con penalización por muerte
export function runPve(genes, cls, secs, seed, level = 25) {
  setGenes({ [cls]: { pve: genes } });
  const a = mkAdv(seed); const p = a.spawnBot(null, { level, mage: cls === "mage" }); p.bot.farmer = false;   // 30% de los bots nacen granjeros (no cazan): ruido puro en el entrenamiento
  tick(a, 5); const exp0 = p.exp; let deaths = 0, was = false, pots = 0, lastGold = p.gold;
  for (let s = 0; s < secs; s++) { tick(a, 1); if (p.dead && !was) deaths++; was = p.dead; }
  if (process.env.DBG) console.log("lv", p.level, "hp", p.hp, "mp", p.mp, "/", p.maxMp, "magic", JSON.stringify(Object.keys(p.magic || {})), "bot", JSON.stringify({ st: p.bot.state, tgt: !!p.bot.target, mode: p.bot.mode }), "pos", p.x, p.y, "map", p.mapId);
  const mins = secs / 60, xp = (p.exp - exp0) / mins;
  return { fitness: xp / (1 + 0.6 * deaths), xp: Math.round(xp), deaths };
}
// PvP: dos bots de bandos contrarios en terreno abierto, un duelo; fitness = ganar (1), empatar (0.4), perder (0) + vida restante
export function runPvp(genes, cls, secs, seed, level = 40) {
  setGenes({ [cls]: { pvp: genes } });
  const a = mkAdv(seed), w = a.farm; w.pvp = true;
  const x = a.spawnBot(null, { level, mage: cls === "mage" }), y = a.spawnBot(null, { level, mage: cls === "mage" ? false : seed % 2 === 0 }); x.bot.farmer = y.bot.farmer = false;
  if (cls === "mage") { x.gold = 60000; while (study(w, x, x.bot, () => {})) ; }   // como los residentes: oro y hechizos de ataque ya aprendidos (0.85.69)
  for (const [id, e] of [...w.ents]) if (e.kind === "npc") w.ents.delete(id);
  w.spawnOff = true; x.side = 1; y.side = 2; x.bot.pvpTrain = y.bot.pvpTrain = true;
  const spot = [...Array(400).keys()].map(i => [meta.start[0] + (i % 20) * 3 - 30, meta.start[1] + Math.floor(i / 20) * 3 - 30]).find(([px, py]) => !w.grid.blocked(px, py) && !w.grid.blocked(px + 3, py) && !w.safeAt(px, py) && !w.safeAt(px + 3, py));
  if (spot) { a.relocate(x, w, [spot[0], spot[1]]); a.relocate(y, w, [spot[0] + 3, spot[1]]); }
  // el rival es de la clase contraria y juega siempre con los genes por defecto (referencia fija)
  if (process.env.DBG) console.log("pos", x.x, x.y, y.x, y.y, !!spot, w.safeAt(x.x, x.y), w.canFight ? 1 : 0);
  let t = 0; for (; t < secs && !x.dead && !y.dead; t++) tick(a, 1);
  if (process.env.DBG) console.log("end", x.x, x.y, x.hp, y.x, y.y, y.hp, x.bot.target?.id, x.bot.state);
  const win = y.dead && !x.dead ? 1 : x.dead && !y.dead ? 0 : 0.4, d = x.hp / x.maxHp - y.hp / y.maxHp;
  return { fitness: win + 0.6 * d, win, deaths: x.dead ? 1 : 0 };
}
// PvE: nivel bajo (vanguardia 8-16; mago 24-40 porque antes no tiene hechizos de ataque), según semilla y 120s mínimo: con nivel 25 los genes no cambian nada (sin riesgo no hay gradiente)
export const run = (mode, g, cls, secs, sd) => mode === "pvp" ? runPvp(g, cls, secs, sd) : runPve(g, cls, Math.max(secs, 120), sd, (cls === "mage" ? [24, 32, 40] : [8, 12, 16])[sd % 3]);

// Pool de hilos: todas las partidas (genes x semillas) se reparten entre los núcleos (HB_THREADS para limitar)
const NT = Math.max(1, +process.env.HB_THREADS || cpus().length - 1); let pool = null, jid = 0; const pend = new Map(), idle = [], queue = [];
const feed = w => { const j = queue.shift(); if (j) { pend.set(j.id, [j.res, w]); w.postMessage({ id: j.id, mode: j.mode, g: j.g, cls: j.cls, secs: j.secs, sd: j.sd }); } else idle.push(w); };
function sim(mode, g, cls, secs, sd) { if (!pool) { pool = Array.from({ length: NT }, () => { const w = new Worker(new URL("./train-worker.mjs", import.meta.url)); w.on("message", m => { const [res, ww] = pend.get(m.id); pend.delete(m.id); res(m.f); feed(ww); }); idle.push(w); return w; }); } return new Promise(res => { const j = { id: ++jid, mode, g, cls, secs, sd }; j.res = res; queue.push(j); const w = idle.pop(); if (w) feed(w); }); }
const scoreAll = (mode, cls, secs, gs, seeds) => Promise.all(gs.map(g => Promise.all(seeds.map(sd => sim(mode, g, cls, secs, sd))).then(avg)));
function mutate(g, rng, s = 0.15) { const o = { ...g }; for (const k of KEYS) if (rng() < 0.5) o[k] = +clamp(k, o[k] * (1 + (rng() * 2 - 1) * s)).toFixed(3); return o; }
const avg = a => a.reduce((x, y) => x + y, 0) / a.length, pick = g => { const o = {}; for (const k of KEYS) o[k] = g[k]; return o; };
const diffTxt = (a, b) => KEYS.filter(k => Math.abs(a[k] - b[k]) > 0.0005).map(k => k + " " + a[k] + "→" + b[k]).join(", ") || "sin cambios";
const diffEn = diffTxt;
async function evolve(cls, mode, gens, pop, secs, rng, prev, seeds = [101, 202, 303], step = 0.15) {
  let best = { ...DEFAULTS, ...(prev || {}) }, history = [];
  const [base, bf0] = await scoreAll(mode, cls, secs, [{ ...DEFAULTS }, best], seeds); let bestFit = bf0;
  for (let gen = 0; gen < gens; gen++) {
    const gs = [best, ...Array.from({ length: pop - 1 }, () => mutate(best, rng, step))], sc = await scoreAll(mode, cls, secs, gs, seeds), cand = gs.map((g, i) => [g, sc[i]]).sort((a, b) => b[1] - a[1]);
    if (cand[0][1] > bestFit) { best = cand[0][0]; bestFit = cand[0][1]; }
    history.push({ gen: gen + 1, best: +bestFit.toFixed(3), avg: +avg(cand.map(c => c[1])).toFixed(3), worst: +cand.at(-1)[1].toFixed(3) });
    console.log(`${cls}/${mode} gen ${gen + 1}: mejor ${bestFit.toFixed(2)} (base ${base.toFixed(2)})`);
  }
  return { genes: pick(best), base: +base.toFixed(3), fitness: +bestFit.toFixed(3), history };
}
const LOG = new URL("../web/data/botlearn-log.json", import.meta.url), STOP = new URL("./train.stop", import.meta.url);
const say = (es, en, extra = {}) => { const d = existsSync(LOG) ? JSON.parse(readFileSync(LOG)) : { entries: [] }; d.entries.push({ at: new Date().toISOString().slice(0, 19).replace("T", " "), es, en, ...extra }); d.entries = d.entries.slice(-400); writeFileSync(LOG, JSON.stringify(d, null, 1)); console.log(es); };
const num = (v, d) => v == null ? d : v;
// Bucle continuo: ronda = para cada clase/modo evoluciona con semillas nuevas, VALIDA con semillas aparte y solo adopta si no empeora
async function loop(gens, pop, secs, classes, modes) {
  const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT)) : { genes: {}, runs: {}, version: 0 };
  const stall = {};
  say(`Arranco el entrenamiento continuo: ${classes.join("+")} en ${modes.join("+")}, ${gens} generaciones x ${pop} variantes, duelos/partidas de ${secs}s. Cada ronda uso semillas nuevas para no memorizar un escenario, y los genes nuevos solo se adoptan si ganan en una validación con otras 6 semillas.`, `Continuous training started: ${classes.join("+")} in ${modes.join("+")}, ${gens} generations x ${pop} variants, ${secs}s runs. Each round uses fresh seeds to avoid memorising one scenario; new genes are only adopted if they win a validation on 6 other seeds.`);
  for (let round = 1; !existsSync(STOP); round++) {
    for (const cls of classes) for (const mode of modes) {
      if (existsSync(STOP)) break;
      const key = cls + "/" + mode, st = stall[key] || 0, step = Math.min(0.5, 0.15 * (1 + st * 0.5));
      const seeds = [1, 2, 3].map(i => 1000 * round + 17 * i + 5), vseeds = [1, 2, 3, 4, 5, 6].map(i => 900000 + 31 * i + round);
      const rng = seededRandom(round * 977 + cls.length * 31 + mode.length), cur = old.genes[cls]?.[mode] ? { ...DEFAULTS, ...old.genes[cls][mode] } : { ...DEFAULTS };
      const r = await evolve(cls, mode, gens, pop, secs, rng, cur, seeds, step);
      const [vNew, vCur, vBase] = await scoreAll(mode, cls, secs, [r.genes, cur, { ...DEFAULTS }], vseeds);
      const ok = vNew > vCur * 1.01 + 1e-9, pc = (a, b) => b ? ((a / b - 1) * 100).toFixed(1) + "%" : "–";
      const cambio = diffTxt(cur, r.genes);
      if (ok) { (old.genes[cls] ||= {})[mode] = r.genes; stall[key] = 0; } else stall[key] = st + 1;
      const R = old.runs[key] ||= { history: [] }, n0 = R.history.length;
      R.base = +vBase.toFixed(3); R.fitness = +(ok ? vNew : vCur).toFixed(3); R.history.push(...r.history.map(h => ({ ...h, gen: n0 + h.gen }))); R.history = R.history.slice(-400);
      old.version++; old.at = new Date().toISOString().slice(0, 16); old.secs = secs; writeFileSync(OUT, JSON.stringify(old, null, 1));
      say(`Ronda ${round} · ${key}: probé ${gens * (pop - 1)} variantes con mutación ±${Math.round(step * 100)}%. Mejor candidato: ${cambio}. Validación (6 semillas nuevas): candidato ${vNew.toFixed(2)} · actuales ${vCur.toFixed(2)} (${pc(vNew, vCur)}) · fábrica ${vBase.toFixed(2)}. ${ok ? "ADOPTADO: gana a los actuales." : "RECHAZADO: no mejora a los actuales" + (st + 1 >= 2 ? `; llevo ${st + 1} rondas sin mejora en ${key}, aumento la mutación a ±${Math.round(Math.min(0.5, 0.15 * (1 + (st + 1) * 0.5)) * 100)}% para explorar más lejos.` : ".")}`,
        `Round ${round} · ${key}: tried ${gens * (pop - 1)} variants with ±${Math.round(step * 100)}% mutation. Best candidate: ${cambio}. Validation (6 fresh seeds): candidate ${vNew.toFixed(2)} · current ${vCur.toFixed(2)} (${pc(vNew, vCur)}) · factory ${vBase.toFixed(2)}. ${ok ? "ADOPTED: beats the current genes." : "REJECTED: does not beat the current genes" + (st + 1 >= 2 ? `; ${st + 1} rounds without improvement in ${key}, raising mutation to explore further.` : ".")}`,
        { round, key, vNew: +vNew.toFixed(3), vCur: +vCur.toFixed(3), vBase: +vBase.toFixed(3), ok });
    }
  }
  say("Entrenamiento detenido por tools/train.stop.", "Training stopped by tools/train.stop.");
}
if (isMainThread && (process.argv[1] || "").endsWith("train.mjs")) {
  const args = process.argv.slice(2), lp = args.includes("--loop"), a = args.filter(x => x !== "--loop");
  const [gens = 6, pop = 8, secs = 90] = a.slice(0, 3).map(Number), classes = (a[3] || "vanguard,mage").split(","), modes = (a[4] || "pve,pvp").split(",");
  if (lp) await loop(gens, pop, secs, classes, modes);
  else {
    const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT)) : { genes: {}, runs: {}, version: 0 }, rng = seededRandom(7 + old.version);
    for (const cls of classes) for (const mode of modes) {
      const r = await evolve(cls, mode, gens, pop, secs, rng, old.genes[cls]?.[mode]);
      (old.genes[cls] ||= {})[mode] = r.genes; const R = old.runs[cls + "/" + mode] ||= { history: [] }, n0 = R.history.length;
      old.runs[cls + "/" + mode] = { base: r.base, fitness: r.fitness, history: [...R.history, ...r.history.map(h => ({ ...h, gen: n0 + h.gen }))] };
    }
    old.version++; old.at = new Date().toISOString().slice(0, 16); old.secs = secs;
    writeFileSync(OUT, JSON.stringify(old, null, 1)); console.log("guardado botgenes.json v" + old.version);
  }
}
export const _dbg = { mkAdv, tick, meta };
