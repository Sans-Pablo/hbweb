// Arena de apuestas: simulación, cuotas con margen de la casa, combate en directo y cobro. node tests/arena.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import * as Inv from "../web/src/shared/inventory.js";
import { ARENA, simulate, oddsFor, maxBet } from "../web/src/shared/systems/arena.js";
import { saveOf } from "../web/src/shared/systems/player.js";

const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const farm = new Uint8Array(readFileSync(new URL("arefarm.bin", dir)));
const mk = seed => new Adventure({ grid: new Grid(meta.w, meta.h, farm), start: meta.start, npcDb, data, spawns: [], maps: {}, rng: seededRandom(seed) });

// ---- el rectángulo de la arena es suelo despejado y el corredor está en el mapa
{
  const g = new Grid(meta.w, meta.h, farm), [x0, y0, x1, y1] = ARENA.rect;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) assert.ok(!g.blocked(x, y), `arena despejada ${x},${y}`);
  const a = mk(1); assert.ok([...a.farm.ents.values()].some(e => e.kind === "citizen" && e.name === ARENA.npc && e.role === ARENA.role), "McGaffin en la granja");
}

// ---- simulación: determinista, simétrica y con margen de la casa
{
  const f = (key, over = {}) => ({ key, sp: "Orc", nm: key, lvl: 10, role: "none", hp: 300, dmg: 20, period: 1000, hit: 100, def: 40, ...over });
  const s1 = simulate(f("a"), f("b"), seededRandom(9)), s2 = simulate(f("a"), f("b"), seededRandom(9));
  assert.deepEqual(s1, s2, "misma semilla, mismo combate");
  const od = oddsFor(f("a"), f("b"), 3);
  assert.ok(Math.abs(od.pa - 0.5) < 0.08, "iguales: ~50 % (" + od.pa + ")");
  const strong = oddsFor(f("a", { dmg: 40 }), f("b"), 4);
  assert.ok(strong.pa > 0.9 && strong.oa < strong.ob, "el fuerte es favorito y paga menos");
  // valor esperado de cada lado < 1 (la casa gana): con 3000 combates independientes
  let w = 0; const rng = seededRandom(77), A = f("a", { dmg: 21, hp: 290 }), B = f("b"), od2 = oddsFor(A, B, 5);
  for (let i = 0; i < 3000; i++) if (simulate(A, B, rng).winner === "a") w++;
  const pa = w / 3000;
  assert.ok(pa * od2.oa < 1 && (1 - pa) * od2.ob < 1, `EV < 1: ${pa * od2.oa} / ${(1 - pa) * od2.ob}`);
  assert.ok(pa > 0.1 && pa < 0.9, 'partido no trivial ' + pa); assert.ok(od2.oa >= ARENA.minOdds && od2.ob <= ARENA.maxOdds);
}

// ---- combate completo
const a = mk(11), id = a.addPlayer("apostador"), p = a.farm.ents.get(id), w = a.farm;
const npc = [...w.ents.values()].find(e => e.role === ARENA.role);
const evs = []; const em = w.emit.bind(w); w.emit = e => { evs.push(e); em(e); };
p.gold = 100000; p.level = 30; p.hp = p.maxHp = 1e6; p.god = true;
const say = (t, o = {}) => a.command(id, { t, npc: npc.id, ...o });

assert.equal(say("arenainfo"), true); assert.ok(evs.find(e => e.t === "arenaoffer").none, "sin compañero no hay combate");
const ball = newInst(w, 653); ball.comp = { sp: "Skeleton", lvl: 12, exp: 0, on: false, nm: "Bruboto", mode: "attack" };
Inv.addToBag(p, data, ball);
evs.length = 0; assert.ok(say("arenainfo"));
const offer = evs.find(e => e.t === "arenaoffer");
assert.ok(offer.offer && offer.a.nm === "Bruboto" && offer.b.nm && offer.oa >= 1.05 && offer.ob >= 1.05 && offer.min === ARENA.minBet && offer.max === maxBet(p), JSON.stringify(offer));
assert.ok(offer.pa + offer.pb > 0.999 && offer.pa + offer.pb < 1.001);

// rechazos
const rej = (cmd, why) => { const n = evs.length; say(cmd.t, cmd); assert.ok(evs.slice(n).some(e => e.t === "reject" || e.t === "nogold"), why); };
rej({ t: "arenabet", offer: offer.offer, side: "a", amount: 10 }, "menos que la mínima");
rej({ t: "arenabet", offer: offer.offer, side: "a", amount: maxBet(p) + 1 }, "más que la máxima");
rej({ t: "arenabet", offer: offer.offer + 5, side: "a", amount: 200 }, "oferta inexistente");
const far = p.x; p.x += 30; rej({ t: "arenabet", offer: offer.offer, side: "a", amount: 200 }, "lejos del corredor"); p.x = far;
assert.equal(p.gold, 100000, "nada se cobró");

// apuesta válida: se descuenta, hay dos gladiadores y no se pueden atacar
const side = "b", amount = 1000;
evs.length = 0; assert.ok(say("arenabet", { offer: offer.offer, side, amount }));
assert.equal(p.gold, 100000 - amount);
assert.ok(p.bet && typeof p.bet.win === "boolean", "resultado fijado al apostar");
const glads = [...w.ents.values()].filter(e => e.arena);
assert.equal(glads.length, 2);
assert.ok(glads.every(g => g.cfg.actionLimit && g.noDrop && g.nick), "gladiadores intocables, sin botín, con nombre");
assert.equal(ball.comp.hp, undefined, "el compañero real no se toca");
rej({ t: "arenabet", offer: offer.offer, side: "a", amount: 200 }, "no se apuesta con un combate en curso");

const fixed = { ...p.bet };
let ticks = 0;
while (!evs.some(e => e.t === "arenaend") && ticks++ < 3000) a.tick(50);
const end = evs.find(e => e.t === "arenaend");
assert.ok(end, "el combate termina (" + ticks * 50 + " ms)");
assert.equal(end.win, fixed.win); assert.equal(end.payout, fixed.payout); assert.equal(end.net, fixed.payout - amount);
assert.equal(p.gold, 100000 - amount + fixed.payout, "oro final = apuesta fijada");
assert.equal(p.bet, null);
assert.ok(evs.some(e => e.t === "attack" && glads.some(g => g.id === e.id)), "se vieron golpes");
assert.ok(evs.some(e => e.t === "damage" && glads.some(g => g.id === e.id)), "se vieron daños");
assert.ok(evs.some(e => e.t === "death" && glads.some(g => g.id === e.id)), "uno muere");
// el ganador de la línea de tiempo es el que queda en pie
const dead = evs.find(e => e.t === "death" && glads.some(g => g.id === e.id));
const winner = fixed.win ? side : side === "a" ? "b" : "a", loser = winner === "a" ? glads[1] : glads[0];
assert.equal(dead.id, loser.id, "muere el perdedor de la simulación");
for (let i = 0; i < 200; i++) a.tick(50);
assert.equal([...w.ents.values()].filter(e => e.arena).length, 0, "la arena se limpia");
assert.equal(p.arenaHist.length, 1);

// ---- apuesta pendiente + recarga: el resultado fijado se cobra igual
{
  evs.length = 0; say("arenainfo"); const o = evs.find(e => e.t === "arenaoffer");
  const g0 = p.gold; say("arenabet", { offer: o.offer, side: "a", amount: 500 });
  const pend = { ...p.bet }, save = saveOf(w, id);
  assert.ok(save.bet && save.bet.payout === pend.payout, "la apuesta pendiente se guarda");
  const b = mk(12), id2 = b.addPlayer("apostador2", save), p2 = b.farm.ents.get(id2);
  assert.equal(p2.bet, null);
  assert.equal(p2.gold, g0 - 500 + pend.payout, "se cobra el resultado fijado al cargar");
  assert.equal(p2.arenaHist.length, 2);
}
console.log("OK arena");
