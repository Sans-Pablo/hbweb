// Equipo de clase, báculos de escuela y báculos maestros (v0.62.0). node tests/classgear.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { World } from "../web/src/shared/world.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import { toggleCompanion } from "../web/src/shared/systems/npcsys.js";
import * as Inv from "../web/src/shared/inventory.js";
import { classesOf, classOk, remapLevel, MAX_GEAR_LEVEL, MASTERS, FAMILIES, staffOk, masterRows } from "../web/src/shared/classgear.js";

const D = new URL("../web/data/", import.meta.url);
const J = f => JSON.parse(readFileSync(new URL(f, D)));
const npcDb = J("npc.json"), data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const byName = n => data.named(n);

// 1. clasificación: todo lo de cabeza/cuerpo/brazos/piernas está decidido y los casos del usuario salen como pidió
const G = { warrior: "warrior", mage: "mage", summoner: "summoner" };
const ok = (n, cls) => assert.deepEqual(classesOf(byName(n)).slice().sort(), cls.slice().sort(), n);
ok("Robe(M)", [G.mage]); ok("WizardHauberk(M)", [G.mage]); ok("Wizard-Hat(M)", [G.warrior, G.mage]);
ok("LeatherArmor(M)", [G.summoner]); ok("Hauberk(M)", [G.warrior, G.summoner]); ok("Wizard-Cap(M)", [G.warrior, G.summoner]);
ok("ChainHose(M)", [G.warrior, G.mage, G.summoner]); ok("PlateLeggings(M)", [G.warrior]);
let n = 0;
for (const d of data.items.values()) if (d.type === 1 && d.equipPos >= 1 && d.equipPos <= 4 && !d.master) { n++; assert.ok(d.name); }
assert.ok(n > 50, "hay equipo que auditar");
for (const d of data.items.values()) if (d.type === 1 && d.equipPos >= 1 && d.equipPos <= 4 && !d.master) assert.ok(classesOf(d)?.length, "sin clase: " + d.name + " (" + d.id + ")");
ok("aHeroCap(M)", [G.warrior]); ok("Shirt(M)", [G.warrior, G.mage, G.summoner]);

// 2. niveles: máximo 50, lo bajo no cambia
assert.equal(remapLevel(20), 20); assert.equal(remapLevel(30), 30); assert.equal(remapLevel(120), MAX_GEAR_LEVEL);
for (const d of data.items.values()) if (d.type === 1 && d.equipPos && !d.master) assert.ok(d.levelLimit <= MAX_GEAR_LEVEL, d.name + " " + d.levelLimit);

// 3. mundo con un mago, un guerrero y un invocador
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const mk = (nm, cls) => { const p = w.ents.get(w.addPlayer(nm, null, { cls, gender: 1, stats: { str: 200, vit: 200, dex: 200, int: 200, mag: 200, chr: 200 } })); p.level = 60; Object.assign(p.stats, { str: 200, vit: 200, dex: 200, int: 200, mag: 200, chr: 200 }); w.recalc(p); return p; };
const mage = mk("Mago", "mage"), war = mk("Guerr", "warrior"), sum = mk("Invo", "summoner");
const give = (p, nm) => { const i = newInst(w, byName(nm).id); Inv.addToBag(p, data, i); return i; };
assert.ok(!Inv.equip(mage, data, give(mage, "PlateLeggings(M)").uid).ok, "el mago no lleva placas");
assert.match(Inv.equip(mage, data, give(mage, "PlateLeggings(M)").uid).why, /solo para Guerrero/);
{ const r = Inv.equip(mage, data, give(mage, "Robe(M)").uid); assert.ok(r.ok, "el mago lleva túnica: " + r.why); }
assert.ok(!Inv.equip(war, data, give(war, "Robe(M)").uid).ok, "el guerrero no lleva túnica");
assert.ok(Inv.equip(sum, data, give(sum, "LeatherArmor(M)").uid).ok && Inv.equip(sum, data, give(sum, "ChainHose(M)").uid).ok);
assert.ok(!Inv.equip(sum, data, give(sum, "WizardHauberk(M)").uid).ok, "el invocador no lleva el hauberk de mago");
// un bot lo ignora y lo ya puesto de antes no se toca
const bot = mk("Bot", "mage"); bot.bot = true; assert.ok(Inv.equip(bot, data, give(bot, "PlateLeggings(M)").uid).ok);
const old = give(war, "Robe(M)"); war.equip[2] = old.uid; w.recalc(war); assert.equal(war.equip[2], old.uid, "lo equipado de antes se queda");

// 4. báculos: sin él no hay Frost / Liche / Demon; el maestro vale como el normal
const ball = (p, sp) => { const i = { uid: 90000 + Math.floor(rng() * 1e6), id: byName("Robe(M)").id, comp: { sp, lvl: 1, on: false, hp: 100 } }; p.bag.push(i); return i; };
const staffOf = (p, id) => { const i = newInst(w, id); Inv.addToBag(p, data, i); Inv.equip(p, data, i.uid); w.recalc(p); return i; };
for (const [sp, fam] of [["Frost", "ice"], ["Liche", "dark"], ["Demon", "fire"]]) {
  const p = mk("S" + sp, "summoner"); p.mp = p.maxMp = 9999;
  assert.equal(staffOk(p, data, fam), false);
  assert.equal(toggleCompanion(w, p, ball(p, sp)), false, sp + " sin báculo");
  assert.ok(FAMILIES[fam].length >= 2);
  staffOf(p, FAMILIES[fam][0]); assert.equal(staffOk(p, data, fam), true, "el normal vale");
  assert.ok(Object.keys(MASTERS).some(id => FAMILIES[fam].includes(+id)));
  const q = mk("M" + sp, "summoner"); staffOf(q, FAMILIES[fam].find(id => id >= 9000)); assert.equal(staffOk(q, data, fam), true, "el maestro vale");
  const r = mk("N" + sp, "summoner"); staffOf(r, FAMILIES[fam === "ice" ? "dark" : "ice"][0]); assert.equal(staffOk(r, data, fam), false, "el de otra escuela no vale");
}

// 5. maestros: nivel 50, 1 de oro, tinte propio
for (const [id, m] of Object.entries(MASTERS)) { const d = data.item(+id); assert.ok(d && d.master && d.price === 1 && d.levelLimit === 50 && d.buyLevel === 50 && d.tint >= 19); assert.equal(d.family, m.family); }
assert.equal(masterRows(data).length, 3);

// 6. compra en el herrero solo con nivel 50
const meta = J("map.json"), bytes = new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)));
const maps = {};
for (const id of Object.keys(J("maps/index.json"))) { const m = J("maps/" + id + ".json"); maps[id] = { meta: m, grid: id === "arefarm" ? null : new Grid(m.w, m.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", D)))) }; }
const A = new Adventure({ grid: new Grid(meta.w, meta.h, bytes), npcDb, data, spawns: [], start: meta.start, maps });
const pid = A.addPlayer("comprador");
const sw = A.staticWorld("gshop_1f"), bp = A.worldFor(pid).ents.get(pid);
assert.ok(A.transfer(bp, A.farm, sw, [51, 41]));
const evs = []; const emit = sw.emit.bind(sw); sw.emit = e => { evs.push(e); emit(e); };
bp.gold = 10; bp.level = 49; A.command(pid, { t: "buy", name: "MasterIceWand", count: 1 });
assert.ok(!bp.bag.some(i => i.id === 9001), "nivel 49 no compra");
bp.level = 50; A.command(pid, { t: "buy", name: "MasterIceWand", count: 1 });
assert.ok(bp.bag.some(i => i.id === 9001), "nivel 50 compra"); assert.equal(bp.gold, 9, "cuesta 1 de oro");
console.log("OK classgear");
