// Todas las magias de escuela se pueden enseñar y lanzar con un summon de nivel 50, y hacen daño. node tests/petgrimoire-all.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { spawnCitizen } from "../web/src/shared/systems/citizens.js";
import { spawnFrom } from "../web/src/shared/systems/npcsys.js";
import * as C from "../web/src/shared/systems/companion.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import * as Inv from "../web/src/shared/inventory.js";
import * as S from "../web/src/shared/systems/schools.js";
import * as PG from "../web/src/shared/systems/petgrimoire.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json"), magic = J("magic.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 9; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const w = new World({ grid, npcDb, data: new GameData({ items: J("items.json"), magic, npcs: npcDb }), spawns: [], rng, start: [10, 10] });
const A = w.ents.get(w.addPlayer("Mago", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }));
A.level = 50; A.stats.str = 400; A.stats.int = 100; A.stats.mag = 100; w.recalc(A); A.hp = A.maxHp; A.gold = 1e6; A.quests.u.trade = 1;
{ const st = newInst(w, 861); Inv.addToBag(A, w.data, st); assert.ok(Inv.equip(A, w.data, st.uid).ok, "Ice Wand en la mano"); w.recalc(A); A.hp = A.maxHp; }
const nurse = spawnCitizen(w, C.HOSPITAL.npc, A.x, A.y + 3, C.HOSPITAL.role);
const mage = spawnCitizen(w, PG.PETMAGE.name, A.x + 2, A.y + 3, PG.PETMAGE.role, PG.PETMAGE.skin);
const tick = ms => { for (let i = 0; i < ms / 50; i++) w.tick(50); };
for (const [school, sp] of [["fire", "Orc"], ["ice", "Tutelary-Angel"], ["lightning", "Skeleton"]]) {
  { const r = w.command(A.id, { t: "petbuy", npc: nurse.id, sp }); assert.ok(r); }
  const ball = A.bag.filter(i => i.comp?.sp === sp).pop(); ball.comp.lvl = 50;
  for (const b of A.bag) if (b.comp) b.comp.on = false;
  A.mp = A.maxMp;
  { const r = w.command(A.id, { t: "use", uid: ball.uid }); assert.ok(r); } w.command(A.id, { t: "petmode", mode: "peace" });
  for (const id of Object.keys(PG.catalog(magic, school)).map(Number)) {
    assert.ok(w.command(A.id, { t: "pgteach", npc: mage.id, spell: id }), sp + " aprende " + magic[id].name);
    const pet = [...w.ents.values()].find(e => e.comp && e.master === A.id && e.ball === ball.uid); tick(2000);
    const gen = { name: "Slime", rect: [A.x + 3, A.y, A.x + 3, A.y], alive: 0, max: 0, respawn: false }, tgt = spawnFrom(w, gen); tgt.hp = tgt.maxHp = 5000;
    const hp0 = tgt.hp; let paid = 0, dmg = false;
    for (let tries = 0; tries < 6 && !dmg; tries++) {                               // un monstruo puede resistir la magia: se repite
      A.lastCast = -1e9; pet.mp = 9999; w.tick(50); const mp0 = pet.mp;
      const ok = w.command(A.id, { t: "pgcast", spell: id, x: tgt.x, y: tgt.y });
      assert.ok(ok, sp + " lanza " + magic[id].name + " " + JSON.stringify(w.events.slice(-1)));
      tick(2500); paid = mp0 - pet.mp; dmg = tgt.hp < hp0; if (!dmg) tick(3000);     // si resistió, se espera a que acabe la espera entre lanzamientos (COOLDOWN_MS)
    }
    if (paid < PG.manaCost(magic, school, id) - 1) console.log("DBG", magic[id].name, paid, pet.mp, PG.manaCost(magic, school, id), pet.name);
    assert.ok(paid >= PG.manaCost(magic, school, id) - 1, "paga el maná de nivel de " + magic[id].name);
    assert.ok(dmg, magic[id].name + " hace daño");
    tgt.dead = true; w.grid.release(tgt.x, tgt.y, tgt.id); w.ents.delete(tgt.id);
  }
}
console.log("OK petgrimoire-all");
