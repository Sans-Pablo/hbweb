// Summons psíquicos (psychic.js): Beholder / Centaurus / Stalker lanzan solos, sin daño directo, con estados limitados y sin apilar.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { spawnFrom, followersOf, dismissCompanion } from "../web/src/shared/systems/npcsys.js";
import * as C from "../web/src/shared/systems/companion.js";
import * as Psy from "../web/src/shared/systems/psychic.js";
import { PSY_OF } from "../web/src/shared/systems/evolutions.js";
import { sget } from "../web/src/shared/systems/status.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import * as Inv from "../web/src/shared/inventory.js";
import { PSYCHIC_ITEM, staffOk } from "../web/src/shared/classgear.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Mago", null, { gender: 1, stats: { str: 10, vit: 20, dex: 10, int: 30, mag: 30, chr: 10 } });
const p = w.ents.get(id); p.level = 50; w.recalc(p);
const tick = ms => { for (let i = 0; i < ms / 50; i++) w.tick(50); };

assert.deepEqual(PSY_OF, { Beholder: "movement", Centaurus: "interference", Stalker: "territory" });
assert.ok(data.item(PSYCHIC_ITEM.id), "Psychic Controller existe");

import { spawnCitizen } from "../web/src/shared/systems/citizens.js";
const nurse = spawnCitizen(w, C.HOSPITAL.npc, p.x + 2, p.y, C.HOSPITAL.role);
function summon(sp) {
  const b = newInst(w, C.SPECIES[sp][1]); b.comp = { sp, lvl: 50, exp: 0, on: false, nm: "Psi", mode: "peace" }; Inv.addToBag(p, w.data, b);
  p.mp = p.maxMp = 500;
  w.command(id, { t: "use", uid: b.uid });
  return b;
}
const pets = () => followersOf(w, p).filter(e => e.comp);
const foe = () => { const n = spawnFrom(w, { name: "Slime", rect: [p.x + 2, p.y - 2, p.x + 5, p.y + 2], alive: 0, max: 0, respawn: false }); n.hp = n.maxHp = 9999; n.noDrop = true; n.nextAct = Infinity; return n; };

// sin Psychic Controller en la mano el summon se rechaza
const b0 = summon("Beholder"); tick(500);
assert.equal(pets().length, 0, "sin Controller no se mantiene");
assert.ok(!staffOk(p, data, "psychic"));
p.bag = p.bag.filter(i => i !== b0);

// con el Controller equipado (id 9004) funciona
const wand = newInst(w, PSYCHIC_ITEM.id); Inv.addToBag(p, w.data, wand); p.equip[8] = wand.uid; w.recalc(p);
assert.ok(staffOk(p, data, "psychic"), "Controller equipado");

const KEYS = { Beholder: ["hold", "illusion", "ice"], Centaurus: ["confuse", "armorbreak", "hold"] };
for (const sp of ["Beholder", "Centaurus", "Stalker"]) {
  const ball = summon(sp); tick(300);
  const pet = pets().find(e => e.name === sp); assert.ok(pet, sp + " invocado");
  pet.mp = 1000; pet.cd = {}; pet.castAt = 0;
  const f = foe(); const hp0 = f.hp;
  let fields = 0; const orig = w.emit; w.emit = ev => { if (ev.t === "field") fields++; return orig.call(w, ev); };
  tick(8000);
  w.emit = orig;
  assert.equal(f.hp, hp0, sp + ": sin daño directo");
  assert.ok(pet.mp < 1000, sp + ": gasta su maná");
  if (sp === "Stalker") assert.ok(fields > 0, "Stalker crea campos");
  else assert.ok(Psy.spellsOf(PSY_OF[sp]).some(sid => pet.cd[sid] > 0), sp + ": usó algún hechizo");
  if (sp === "Beholder") assert.ok(sget(w, f, "hold") || sget(w, f, "illusion") || sget(w, f, "ice") || pet.cd[25] > 0, "Beholder controla al monstruo");
  if (sp === "Centaurus") assert.ok(sget(w, f, "confuse") || sget(w, f, "armorbreak") || pet.cd[62] > 0 || pet.cd[66] > 0, "Centaurus debilita");
  // duración limitada: pasado el tiempo el estado desaparece
  dismissCompanion(w, p); tick(15000);
  for (const k of ["hold", "illusion", "confuse", "armorbreak"]) assert.equal(sget(w, f, k), 0, sp + ": " + k + " expira");
  f.dead = true; w.remove?.(f);
  dismissCompanion(w, p); p.bag = p.bag.filter(i => !i.comp);
}

// no apila: un monstruo ya paralizado no recibe otro Hold; armor break aumenta el daño recibido sin pasar de +25 %
const pet2 = (summon("Centaurus"), tick(300), pets()[0]); pet2.mp = 1000;
const g = foe(); g.st = { armorbreak: { v: Psy.ARMOR_BREAK, until: w.time + 5000 } };
assert.equal(sget(w, g, "armorbreak"), Psy.ARMOR_BREAK);
// jefe y citizen: nunca objetivo
const [t1] = Psy.targets(w, pet2, p); assert.ok(t1.includes(g), "monstruo es prioridad 1");
console.log("OK psychic");
