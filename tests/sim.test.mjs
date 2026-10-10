// Prueba de la simulación sin navegador: un "jugador" automático caza en la granja.
// node tests/sim.test.mjs
import { MAGIC_MODE } from "../web/src/shared/magic.js";
MAGIC_MODE.schools = false; MAGIC_MODE.player = true;   // estas pruebas ejercitan el sistema de hechizos del jugador (cerrado en el juego, ver talents.js)
MAGIC_MODE.free = false;
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
const data = new GameData({ items: JSON.parse(readFileSync(new URL("items.json", D))), magic: JSON.parse(readFileSync(new URL("magic.json", D))), npcs: npcDb });

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

// --- magia: aprender Magic-Missile, quitarse el escudo y matar un slime a hechizos
{
  const w2 = new World({ grid, npcDb, data, spawns, rng, start: meta.start });
  const id2 = w2.addPlayer("mago"), m = w2.ents.get(id2);
  m.stats.int = 30; m.stats.mag = 40; m.gold = 500; w2.recalc(m); m.mp = m.maxMp;
  delete m.magic[0]; assert(w2.command(id2, { t: "learn", spell: 0 }) && m.magic[0] === 1 && m.gold === 400, "aprender Magic Missile cuesta 100 de oro");
  const shield = m.bag.find(i => data.item(i.id).name === "WoodShield");
  w2.tick(100);
  assert(!w2.command(id2, { t: "cast", spell: 0, x: m.x, y: m.y }) , "con escudo no se puede lanzar");
  w2.command(id2, { t: "unequip", uid: shield.uid });
  const slime = [...w2.ents.values()].find(e => e.kind === "npc" && e.name === "Slime");
  [m.x, m.y] = [slime.x - 3, slime.y]; w2.grid.release(m.fx, m.fy, m.id); w2.grid.occupy(m.x, m.y, m.id);
  let hits = 0, mp0 = m.mp;
  for (let i = 0; i < 40 && !slime.dead; i++) { w2.tick(1100); if (w2.command(id2, { t: "cast", spell: 0, x: slime.x, y: slime.y })) hits++; w2.tick(700); }
  assert(hits > 0 && m.mp < mp0, "el hechizo gasta maná");
  assert(w2.drainEvents().some(e => e.t === "spell") || slime.dead, "el hechizo se lanza");
}

// --- atributos de los objetos que caen
{
  const A = await import("../web/src/shared/attributes.js");
  const sword = data.named("GreatSword"), plate = data.named("PlateMail(M)"), wand = data.item(256);
  const tally = {}; let n2 = 0;
  for (let i = 0; i < 20000; i++) {
    const r = A.rollAttributes(rng, sword, 8), a = A.parseAttr(r.attr);
    tally[a.t1] = (tally[a.t1] || 0) + 1;
    assert(a.t1 !== 1 || a.v1 >= 5, "crítico: valor mínimo 5");
    assert((a.t1 !== 2 && a.t1 !== 6) || a.v1 >= 4, "veneno/ligero: valor mínimo 4");
    assert(a.t1 !== 8 || a.v1 >= 2, "fuerte: valor mínimo 2");
    if (a.t2) { n2++; assert([2, 10, 11, 12].includes(a.t2), "secundario de arma válido"); }
    const low = A.rollAttributes(rng, sword, 1);
    assert(A.parseAttr(low.attr).v1 <= 7 && A.parseAttr(low.attr).v2 <= 7, "monstruos de nivel bajo: valores hasta 7");
  }
  assert(Math.abs(tally[8] / 20000 - 0.07) < 0.012 && Math.abs(tally[5] / 20000 - 0.20) < 0.015, "reparto de tipos principales de arma");
  assert(Math.abs(n2 / 20000 - 0.40) < 0.02, "40 % lleva atributo secundario");
  const w2 = A.rollAttributes(rng, wand, 7); assert(A.parseAttr(w2.attr).t1 === 10 && w2.color === 5, "varita: atributo Special");
  const pa = A.rollAttributes(rng, plate, 7), pp = A.parseAttr(pa.attr);
  assert([6, 8, 11, 12].includes(pp.t1), "armadura: ligero, fuerte, convierte maná o crítico");
  // _AdjustRareItemValue
  const light = (4 << 16 | 6 << 20) >>> 0, rs = A.realStats(plate, { attr: light });
  assert(rs.weight === plate.weight - Math.floor(plate.weight * 16 / 100), "ligero: -4 % por punto de peso");
  assert(A.realStats(sword, { attr: (5 << 20 | 1 << 16) >>> 0 }).speed === Math.max(0, sword.speed - 1), "ágil: velocidad -1");
  assert(A.realStats(sword, { attr: (8 << 20 | 3 << 16) >>> 0 }).maxLife === sword.maxLife + Math.floor(sword.maxLife * 21 / 100), "fuerte: durabilidad +7 % por punto");
  // efecto al equipar: Sharp (+1 al dado) y secundario "Hitting Probability +"
  const w3 = new World({ grid, npcDb, data, spawns, rng, start: meta.start });
  const id3 = w3.addPlayer("atr"), q = w3.ents.get(id3);
  const inst = { uid: 9100, id: sword.id, count: 1, life: sword.maxLife, attr: (7 << 20 | 1 << 16 | 2 << 12 | 3 << 8) >>> 0, color: 6 };
  q.bag.push(inst); q.stats.str = 100; w3.recalc(q);
  const before = q.eff.addAR;
  assert(Inv.equip(q, data, 9100).ok && q.eff.addAR === before + 21 && q.eff.sm[1] === sword.v2 + 1, "arma Sharp con acierto +21");
}

const counts = {};
let target = null;
// --- creación de personaje
{
  const P = await import("../web/src/shared/systems/player.js");
  assert(P.validCharName("Pablo1") && !P.validCharName("Pa blo") && !P.validCharName("a_b") && !P.validCharName("") && !P.validCharName("12345678901"), "nombres válidos como en el original");
  const mk = c => { const w = new World({ grid, npcDb, data, spawns, rng, start: meta.start }); const id = w.addPlayer("Mago", null, c); return w.ents.get(id); };
  const m = mk({ stats: P.PRESETS.mage, gender: 2, skin: 3, hair: 5, hairCol: 9, under: 4 });
  assert(m.stats.int === 14 && m.stats.mag === 14 && m.stats.str === 10 && m.gender === 2, "plantilla de mago");
  assert(m.look.skin === 3 && m.look.hair === 5 && m.look.hairCol === 9 && m.look.under === 4, "aspecto elegido");
  assert(m.skills[4] === 14 + 10 && m.skills[5] === 10 + 10, "habilidades iniciales según los atributos");
  assert(Object.keys(m.equip).length === 2 && m.bag.some(i => data.item(i.id).name === "Chemise(W)"), "mujer: lleva Chemise(W)");
  const bad = mk({ stats: { str: 14, vit: 14, dex: 14, int: 14, mag: 14, chr: 14 }, gender: 7, skin: 9 });   // 84 puntos: se ignora
  assert(bad.stats.str === 14 && bad.stats.dex === 14 && bad.stats.int === 10 && bad.gender === 1 && bad.look.skin === 2, "valores fuera de regla vuelven a los de por defecto");
  const sv = mk({ gender: 2, hair: 3 }), w5 = new World({ grid, npcDb, data, spawns, rng, start: meta.start });
  const back = w5.ents.get(w5.addPlayer("Otro", { gender: 2, look: { hair: 3 }, charName: "Elfa", stats: { str: 12 } }));
  assert(back.name === "Elfa" && back.look.hair === 3 && sv.look.hair === 3, "guardado conserva nombre y aspecto");
}

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
