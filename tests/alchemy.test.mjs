// Alquimia (HG.cpp ReqCreatePortionHandler 23503): orden por id descendente, coincidencia exacta, límite de habilidad, dificultad, consumo y experiencia.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const potions = J("potion.json");
assert.equal(potions.length, 20);
assert.deepEqual(potions[0], { n: 1, name: "RedPotion", arr: [220, 1, 192, 1, 191, 1, -1, 0, -1, 0, -1, 0], limit: 20, diff: 10 });
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 5, fixed = null; const rng = () => fixed ?? (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: J("npc.json"), potions });
const w = new World({ grid, npcDb: J("npc.json"), data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Alquimista", null, { gender: 1, stats: { str: 10, vit: 10, dex: 10, int: 40, mag: 10, chr: 10 } });
const p = w.ents.get(id);
const give = (n, c = 1) => { const i = newInst(w, n, c); p.bag.push(i); return i; };
const idOf = name => data.byName.get(name).id;
const ev = t => w.events.filter(e => e.t === t);
const brew = (uids) => { w.events.length = 0; return w.command(id, { t: "alchemy", uids }); };
const stock = () => { p.bag.length = 0; return [give(220, 2), give(192), give(191)]; };

// sin maestría suficiente (límite 20)
p.skills[12] = 10; let [a, b, c] = stock();
brew([a.uid, b.uid, c.uid]); assert.equal(ev("potion-lowskill").length, 1); assert.equal(p.bag.length, 3);
// sin coincidencia: el orden de los uids da igual, pero la cantidad no
p.skills[12] = 100;
brew([a.uid, a.uid, b.uid, c.uid]); assert.equal(ev("potion-nomatch").length, 1);
// éxito: se ordena por id, consume 1 de cada, da la poción y experiencia
fixed = 0; const exp0 = p.exp;
brew([c.uid, b.uid, a.uid]);
assert.equal(ev("potion-ok").length, 1);
assert.ok(p.bag.some(i => i.id === idOf("RedPotion")));
assert.equal(p.bag.find(i => i.id === 220).count, 1, "la consumible baja de 1 en 1");
assert.ok(!p.bag.some(i => i.id === 192) && !p.bag.some(i => i.id === 191));
assert.ok(p.exp > exp0, "GetExp(dice(2,dif/3))");
// fallo: dice(1,100) > maestría-dificultad(+5 con 100): con dado 100 y maestría 100, dif 10 → 95 → falla y no gasta nada
[a, b, c] = stock(); fixed = 0.999; const n0 = p.bag.length;
brew([a.uid, b.uid, c.uid]); assert.equal(ev("potion-fail").length, 1); assert.equal(p.bag.length, n0);
// maestría 100 suma 5: dado 95 pasa; con maestría 99 el umbral es 89
fixed = 0.94; p.skills[12] = 100; brew([a.uid, b.uid, c.uid]); assert.equal(ev("potion-ok").length, 1);
[a, b, c] = stock(); p.skills[12] = 99; fixed = 0.94; brew([a.uid, b.uid, c.uid]); assert.equal(ev("potion-fail").length, 1);
console.log("OK");
