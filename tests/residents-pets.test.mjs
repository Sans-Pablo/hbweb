// Habitantes y summons: compran su compañero en el hospital (Aresden: tienda general; Elvine: Gail al aire libre), lo invocan, le dan talentos y avisan de fallos.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n", "gshop_1f"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(21) });
const reports = []; a.report = r => reports.push(r);
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
assert.ok(a.staticWorld("elvfarm") && [...a.staticWorld("elvfarm").ents.values()].some(e => e.role === "pethospital"), "Gail atiende en Elvine Farm");

// el hospital no vende bolas de especies que no existen en NPC.cfg (Orc-Mage)
{
  const id = a.addPlayer("Comprador", null, { gender: 1, stats: { str: 20, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }), p = a.farm.ents.get(id);
  const sh = a.staticWorld("gshop_1f"), gail = [...sh.ents.values()].find(e => e.role === "pethospital");
  a.transfer(p, a.farm, sh, [gail.x, gail.y + 1]); p.gold = 50; sh.drainEvents();
  a.command(id, { t: "petbuy", npc: gail.id, sp: "Orc-Mage" });
  assert.ok(sh.drainEvents().some(e => e.t === "reject" && e.id === id), "Orc-Mage no se vende");
  a.command(id, { t: "petbuy", npc: gail.id, sp: "Troll" });
  assert.ok(p.bag.some(i => i.comp?.sp === "Troll"), "Troll sí");
}

for (const n of ["Aldric", "Cora"]) {                                                  // Aresden y Elvine
  a.spawnResident(n);
  const b = a.residents().find(x => x.name === n);
  b.level = 8; b.exp = 1e5; b.stats.vit = 40; a.homeOf(b).recalc(b); b.hp = b.maxHp; b.gold = 5000; b.res._petAt = 1;
  let ok = false;
  for (let i = 0; i < 20 * 60 * 16 && !ok; i++) { a.tick(50); ok = !!b.bag.find(x => x.comp)?.comp.on && [...a.worldFor(b.id).ents.values()].some(e => e.comp && e.master === b.id); }
  if (n === "Aldric") { b.bot.next = 1e12; b.res.next = 1e12; a.transfer(b, a.worldFor(b.id), a.staticWorld("gshop_1f"), [3, 3]); }   // ya cumplió: que no estorbe a Cora
  assert.ok(ok, n + " consigue y tiene fuera un summon; registro: " + b.bot.log.slice(-6).join(" | "));
}
// el summon vuelve tras morir el dueño y reaparecer
{
  const b = a.residents().find(x => x.name === "Cora"), w = a.worldFor(b.id), live = () => [...w.ents.values()].some(e => e.comp && e.master === b.id && !e.dead);
  assert.ok(live(), "tiene el summon fuera");
  b.res._petUseAt = w.time + 1e9;                                       // que el cerebro no lo re-invoque: lo debe hacer el juego
  b.bot.next = 1e12; b.res.next = 1e12; b.hp = 0; b.dead = true; b.deadAt = w.time; w.emit({ t: "death", id: b.id, by: 0 });
  for (let i = 0; i < 80; i++) a.tick(50);
  assert.ok(!live(), "al morir el dueño el summon desaparece");
  tick(2000); a.command(b.id, { t: "respawn" });
  assert.ok(live(), "al reaparecer vuelve el summon");
}
console.log("OK residents-pets");

// v0.45: el summon alcanza a su dueño si se queda atrás, y la baja del summon se acredita al dueño
{
  const id = a.addPlayer("Corredor", null, { gender: 1, stats: { str: 20, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }), p = a.farm.ents.get(id);
  p.level = 20; a.farm.recalc(p);
  const sh = a.staticWorld("gshop_1f"), gail = [...sh.ents.values()].find(e => e.role === "pethospital");
  a.transfer(p, a.farm, sh, [gail.x, gail.y + 1]); p.gold = 5000;
  a.command(id, { t: "petbuy", npc: gail.id, sp: "Troll" });
  a.transfer(p, sh, a.farm, a.farm.home);
  const ball = p.bag.find(i => i.comp); a.command(id, { t: "use", uid: ball.uid }); tick(1000);
  const pet = [...a.farm.ents.values()].find(e => e.comp && e.master === id);
  assert.ok(pet, "summon fuera");
  const far = a.farm.freeSpotNear(pet.x + 40, pet.y + 40) || a.farm.freeSpotNear(pet.x - 40, pet.y - 40);
  a.relocate(p, a.farm, far); tick(3000);
  const pet2 = [...a.farm.ents.values()].find(e => e.comp && e.master === id);
  assert.ok(pet2 && Math.max(Math.abs(pet2.x - p.x), Math.abs(pet2.y - p.y)) <= 22, "el summon alcanza al dueño");
}
