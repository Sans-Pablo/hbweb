// Arco (HGServer/Game.cpp iClientMotion_Attack_Handler + iCalculateAttackEffect): dispara a cualquier distancia, gasta una
// flecha por disparo, sin flechas no hay daño; el cuerpo a cuerpo sigue limitado a 1 casilla.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import * as Inv from "../web/src/shared/inventory.js";
import { mobDurations } from "../web/src/shared/const.js";
import { MAGIC_MODE } from "../web/src/shared/magic.js";
MAGIC_MODE.free = false;
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
let seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = () => {
  const w = new World({ grid: new Grid(60, 60, new Uint8Array(60 * 60 * 10)), npcDb, data: new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb }), spawns: [], rng, start: [10, 10] });
  const p = w.makeEnt("player", 10, 10);
  Object.assign(p, { kind: "player", hp: 100, maxHp: 100, side: 1, level: 10, gender: 1, stats: { str: 60, dex: 80, vit: 20, int: 10, mag: 10, chr: 10 }, skills: { 6: 80 }, ssn: {}, bag: [], equip: {} });
  w.grid.occupy(10, 10, p.id);
  const n = w.makeEnt("npc", 18, 10); Object.assign(n, { name: "Slime", type: 10, cfg: npcDb.Slime, hp: 5000, maxHp: 5000, dir: 1, special: 0, kind: "npc", nextAct: 1e12, dur: mobDurations(10), phase: 0, noDieRemainExp: 0, exp: 0, gen: { rect: [0, 0, 59, 59], alive: 1 } });
  w.grid.occupy(18, 10, n.id);
  return { w, p, n };
};
const add = (w, p, id, count = 1) => { const inst = { uid: w.nextItem++, id, count, life: w.data.item(id).maxLife }; Inv.addToBag(p, w.data, inst); return inst; };
const run = (w, ms) => { for (let i = 0; i < ms / 50; i++) w.tick(50); };

// con arco y 3 flechas: dispara a 8 casillas, gasta una por disparo
{
  const { w, p, n } = mk();
  const bow = add(w, p, 75), arrows = add(w, p, 77, 3);
  assert.ok(Inv.equip(p, w.data, bow.uid).ok); w.recalc(p);
  assert.ok(p.eff.bow);
  const ev = []; w.emit = (e => m => { ev.push(m); return e.call(w, m); })(w.emit);
  assert.ok(w.command(p.id, { t: "attack", target: n.id }), "el arco no tiene límite de distancia");
  assert.ok(ev.find(e => e.t === "attack" && e.bow && e.tx === 18), "el evento lleva el aviso de flecha y el blanco");
  run(w, 600);
  assert.equal(arrows.count, 2, "una flecha por disparo");
  for (let i = 0; i < 2; i++) { run(w, 800); w.command(p.id, { t: "attack", target: n.id }); run(w, 600); }
  assert.equal(p.bag.some(i => i.id === 77), false, "sin flechas se quita el montón");
  const hp = n.hp; run(w, 800);
  assert.ok(w.command(p.id, { t: "attack", target: n.id }), "sin flechas el gesto se hace");
  run(w, 600); assert.equal(n.hp, hp, "pero no hay daño");
}
// sin arco: a 8 casillas se rechaza
{
  const { w, p, n } = mk();
  assert.equal(w.command(p.id, { t: "attack", target: n.id }), false);
}
console.log("OK");
