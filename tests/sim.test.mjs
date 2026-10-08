// Prueba de la simulación sin navegador: un "jugador" automático caza en la granja.
// node tests/sim.test.mjs
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { World } from "../web/src/shared/world.js";
import { findPath } from "../web/src/shared/path.js";
import { dist, PLAYER } from "../web/src/shared/const.js";
import * as R from "../web/src/shared/rules.js";
import { GameData } from "../web/src/shared/data.js";
import * as Inv from "../web/src/shared/inventory.js";
import { rollKillDrop } from "../web/src/shared/drops.js";

const D = new URL("../web/data/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("map.json", D)));
const bytes = new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)));
const npcDb = JSON.parse(readFileSync(new URL("npc.json", D)));
const spawns = JSON.parse(readFileSync(new URL(meta.map + ".spawns.json", D)));
const data = new GameData({ items: JSON.parse(readFileSync(new URL("items.json", D))), npcs: npcDb });

let seed = 12345;
const rng = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };

// fórmulas
assert(R.expForLevel(1) === 50 && R.expForLevel(2) === 150, "tabla de experiencia");
assert(R.hitChance(70, 10, false) === 99 && R.hitChance(10, 200, false) === 15, "límites de acierto");
assert(R.hitChance(50, 100, true) === 50, "por la espalda: defensa a la mitad");
const c = { str: 14, vit: 12, dex: 14, int: 10, mag: 10, level: 1 };
assert(R.maxHP(c) === 12 * 3 + 2 + 7, "vida máxima");

const grid = new Grid(meta.w, meta.h, bytes);
const world = new World({ grid, npcDb, data, spawns, rng, start: meta.start });
const pid = world.addPlayer("prueba");
const me = world.ents.get(pid);
const npcs = [...world.ents.values()].filter(e => e.kind === "npc");
console.log("monstruos:", npcs.length, Object.entries(npcs.reduce((a, n) => (a[n.name] = (a[n.name] || 0) + 1, a), {})));

// --- objetos: equipo inicial y reglas de equipar
const dagger = me.bag.find(i => data.item(i.id).name === "Dagger");
assert(me.bag.length === 7 && Object.keys(me.equip).length === 2, "equipo inicial: 7 objetos, escudo y pantalón puestos");
assert(me.eff.wtype === 0 && me.defense === me.stats.dex * 2 + 8 + 1, "defensa: destreza x2 + escudo (8) + pantalón (1)");
assert(world.command(pid, { t: "equip", uid: dagger.uid }) && me.eff.sm[1] === 5, "equipar daga");
const gs = Inv.addToBag(me, data, { uid: 9001, id: data.named("PlateMail(M)").id, count: 1, life: 300 });
assert(!Inv.equip(me, data, 9001).ok, "malla de placas: no hay fuerza suficiente");
me.stats.str = 100; world.recalc(me);
assert(Inv.equip(me, data, 9001).ok && me.eff.armor[2] === 40, "malla de placas absorbe 40 % en el cuerpo");
me.stats.str = 14; world.recalc(me);
assert(Inv.maxLoad(me) === 14 * 500 + 500, "carga máxima");
Inv.removeFromBag(me, 9001); world.recalc(me);
// botín: con las tasas del servidor original (1 / 1) cae algo en cada muerte
let nDrops = 0, golds = 0;
for (let i = 0; i < 2000; i++) { const d = rollKillDrop(rng, npcs[0]); if (d) { nDrops++; if (d.id === 90) golds++; } }
assert(nDrops > 1900, "tasa primaria 1: casi siempre cae algo");
assert(golds / nDrops > 0.55 && golds / nDrops < 0.65, "60 % de lo que cae es oro");

const counts = {};
let target = null;
for (let step = 0; step < 20 * 60 * 20; step++) {          // 20 minutos de juego a 20 Hz
  world.tick(50);
  for (const ev of world.drainEvents()) counts[ev.t] = (counts[ev.t] || 0) + 1;
  if (me.dead) { world.command(pid, { t: "respawn" }); continue; }
  if (me.hp < me.maxHp * 0.4) world.command(pid, { t: "use", item: 91 });
  if (me.pool > 0) world.command(pid, { t: "stat", stat: me.pool % 2 ? "str" : "vit" });
  if (world.busy(me)) continue;
  if (world.items.has(grid.idx(me.x, me.y))) { world.command(pid, { t: "pickup" }); continue; }
  if (!target || target.dead) {
    target = null;
    let best = 1e9;
    for (const e of world.ents.values())
      if (e.kind === "npc" && !e.dead && e.name === "Slime" && dist(e, me) < best) { best = dist(e, me); target = e; }
  }
  if (!target) continue;
  if (dist(me, target) <= 1) {
    if (world.time - me.lastAttack >= PLAYER.attackCooldownMs) world.command(pid, { t: "attack", target: target.id });
    continue;
  }
  const p = findPath(grid, me.x, me.y, target.x, target.y, me.id);
  if (p.length) world.command(pid, { t: "move", dir: p[0], run: false });
  else target = null;
}
console.log("eventos:", counts);
console.log("jugador: nivel", me.level, "exp", me.exp, "oro", me.gold, "muertes de monstruos", me.kills, "mochila", me.bag.length, "stats", me.stats);
assert(me.kills >= 10, "debería matar al menos 10 slimes en 20 minutos");
assert(me.level >= 3, "debería subir de nivel");
assert((counts.drop || 0) > 0 && (counts.pickup || 0) > 0, "botín");
assert(counts.reject === undefined || counts.reject < counts.attack, "pocas órdenes rechazadas");
console.log("OK");
