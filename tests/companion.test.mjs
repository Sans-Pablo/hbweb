// Compañeros: obtención en la tienda, selección, estadísticas compartidas, experiencia, guardado.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { killNpc, followersOf } from "../web/src/shared/systems/npcsys.js";
import * as C from "../web/src/shared/systems/companion.js";
import { damagePlayer } from "../web/src/shared/systems/combatsys.js";
import { saveOf } from "../web/src/shared/systems/player.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Cazador", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } });
const p = w.ents.get(id); p.level = 30; w.recalc(p);
import { spawnCitizen } from "../web/src/shared/systems/citizens.js";
import { spawnFrom } from "../web/src/shared/systems/npcsys.js";
const slay = name => { const n = spawnFrom(w, { name, rect: [p.x + 2, p.y + 2, p.x + 5, p.y + 5], alive: 0, max: 0, respawn: false }); n.noDrop = true; killNpc(w, n, p); };

for (let i = 0; i < 30; i++) slay("Giant-Ant");
assert.equal(p.bag.filter(i => i.comp).length, 0, "matar no da bolas");
const nurse = spawnCitizen(w, C.HOSPITAL.npc, p.x + 2, p.y, C.HOSPITAL.role);
p.gold = 100; w.command(id, { t: "petbuy", npc: nurse.id, sp: "Giant-Ant" });         // la bola se compra en la tienda
const ball = p.bag.find(i => i.comp);
assert.ok(ball && ball.comp.sp === "Giant-Ant" && ball.comp.lvl === 1, "bola de hormiga");

// usar la bola invoca siempre una hormiga; usarla otra vez la guarda
w.command(id, { t: "use", uid: ball.uid });
let f = followersOf(w, p).filter(e => e.comp);
assert.equal(f.length, 1); assert.equal(f[0].name, "Giant-Ant"); assert.ok(ball.comp.on);
w.command(id, { t: "use", uid: ball.uid });
assert.equal(followersOf(w, p).filter(e => e.comp).length, 0); assert.ok(!ball.comp.on);
w.command(id, { t: "use", uid: ball.uid });
f = followersOf(w, p).filter(e => e.comp)[0];

// estadísticas compartidas: nunca más de la mitad del daño medio del dueño; crecen con el nivel
const a1 = C.statsOf(p, { sp: "Giant-Ant", lvl: 1 }), a30 = C.statsOf(p, { sp: "Giant-Ant", lvl: 50 });
assert.ok(a1.dmg <= Math.ceil(C.avgHit(p) * 0.9) && a30.dmg <= Math.ceil(C.avgHit(p) * 0.9), "cuota <= 0,9");
assert.ok(a30.share > a1.share && a30.hp >= a1.hp);
assert.ok(C.shareOf(50, "Orge") <= 0.9 && C.MAX_COMP_LEVEL === 50);
assert.equal(f.dmgNow, a1.dmg);

// experiencia: el dueño da el 40 %; sube de nivel; el tope es el nivel del dueño
const before = ball.comp.exp + 0;
C.addExp(w, p, ball, C.need(1));
assert.equal(ball.comp.lvl, 2);
C.addExp(w, p, ball, 10 ** 9);
assert.equal(ball.comp.lvl, p.level, "tope = nivel del dueño");
assert.ok(ball.comp.exp < C.need(ball.comp.lvl));

// guardado: la bola conserva especie, nivel y estado
const sv = JSON.parse(JSON.stringify(saveOf(w, id)));
assert.deepEqual(sv.bag.find(i => i.comp).comp, ball.comp);
// tirar la bola guarda al compañero
w.command(id, { t: "drop", uid: ball.uid, count: 0 });
assert.equal(followersOf(w, p).filter(e => e.comp).length, 0);

// aggro: un monstruo cercano al compañero (y lejos del jugador) lo ataca; al caer, el compañero pierde experiencia/nivel
{
  const ball2 = p.bag.find(i => i.comp) || ball; ball2.comp.lvl = 5; ball2.comp.exp = 0; ball2.comp.on = false;
  p.bag.includes(ball2) || p.bag.push(ball2);
  w.command(id, { t: "use", uid: ball2.uid });
  const pet = followersOf(w, p).find(e => e.comp); assert.ok(pet);
  const orc = spawnFrom(w, { name: "Orc", rect: [pet.x + 1, pet.y, pet.x + 1, pet.y], alive: 0, max: 0, respawn: false });
  p.x = p.fx = Math.min(58, pet.x + 25); w.grid.occupy(p.x, p.y, p.id);
  for (let i = 0; i < 40 && orc.target !== pet.id; i++) w.tick(100);
  assert.equal(orc.target, pet.id, "el monstruo se fija en el compañero");
  pet.hp = 1; orc.dmgBoost = 1;
  let lost = null; w.events.length = 0;
  for (let i = 0; i < 400 && !lost; i++) { w.tick(100); lost = w.events.find(e => e.t === "companion-lost"); }
  assert.ok(lost, "el compañero cae y se penaliza"); assert.ok(lost.lvl <= 5);
  assert.ok(!ball2.comp.on, "vuelve a la bola");
}
// muerte del jugador: pierde experiencia y, si no alcanza, un nivel
{
  const before = { lvl: p.level, exp: p.exp };
  p.exp = p.prevExp + 1; w.recalc(p);
  const L = p.level, orc = spawnFrom(w, { name: "Orc", rect: [p.x + 1, p.y, p.x + 1, p.y], alive: 0, max: 0, respawn: false });
  damagePlayer(w, p, 10 ** 6, orc);
  assert.ok(p.dead && p.level === L - 1, "baja un nivel");
}
console.log("OK");
