// Líneas de misiones (shared/systems/quests.js): estructura, encadenado sin doble conteo, profundidad persistente, permisos y guardado. node tests/quests.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import * as Q from "../web/src/shared/systems/quests.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const mk = () => { let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return new World({ grid: new Grid(60, 60, new Uint8Array(3600 * 10)), npcDb, data: new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb }), spawns: [], rng, start: [10, 10] }); };

// estructura: tres líneas de 22 misiones con textos bilingües, objetivos válidos y Acto I = 19
for (const cls of ["warrior", "mage", "summoner"]) {
  const L = Q.LINES[cls]; assert.equal(L.length, 22, cls); assert.equal(Q.TOTAL(cls), 22);
  const ids = new Set(L.map(m => m.id)); assert.equal(ids.size, L.length, "ids únicos");
  for (const m of L) { assert.ok(m.title.es && m.title.en && m.text.es && m.text.en, m.id); assert.ok(m.goal.k, m.id); }
  assert.equal(L[Q.ACT1_END - 1].goal.k, "final");
}
const w = mk(), id = w.addPlayer("Qtest", null, { gender: 1, cls: "warrior" }), p = w.ents.get(id);
assert.equal(p.quests.n, 0); assert.equal(Q.cryptCap(p), 5, "sin misiones solo hasta el nivel 5");
assert.ok(!Q.canTrade(p) && !Q.dropsStaff(p));

// la misión 1 cuenta bajas de Slime y no se cuenta dos veces aunque check se reentre
for (let i = 0; i < 40; i++) Q.onKill(w, p, { name: "Slime" });
for (let i = 0; i < 20; i++) w.tick(50);
assert.equal(p.quests.n >= 1, true, "la primera misión se cumple a las 40 bajas");
const n1 = p.quests.n; Q.check(w, p); Q.check(w, p); assert.equal(p.quests.n, n1, "check repetido no avanza de más");
assert.ok(p.bag.some(i => i.id === Q.EMBLEM.warrior), "recompensa: emblema de la clase");

// subir de nivel encadena misiones ya cumplidas, sin pasar nunca de TOTAL
p.level = 50; p.kinds = { a: 1, b: 1, c: 1, d: 1, e: 1 }; Q.onLevel(w, p);
assert.ok(p.quests.n <= Q.TOTAL("warrior"), "n nunca supera el total");
assert.ok(p.quests.t.length === p.quests.n, "un tiempo por misión terminada");

// profundidad: sobrevive a «reiniciar la cripta» (delve.deepest vuelve a 1)
const w2 = mk(), p2 = w2.ents.get(w2.addPlayer("Qdepth", null, { gender: 1, cls: "mage" }));
Q.onDepth(w2, p2, 7); assert.equal(p2.quests.d, 7); p2.delve = { deepest: 1 }; assert.equal(Q.progress(p2, { k: "depth", n: 3 })[0], 7);

// permisos: las misiones suben el tope de cripta, nunca lo bajan; el guardado lo conserva
const w3 = mk(), p3 = w3.ents.get(w3.addPlayer("Qsave", null, { gender: 1, cls: "summoner" }));
p3.quests.u.crypt = 15; p3.quests.d = 9; p3.quests.n = 4;
const s = Q.toSave(p3), p4 = { cls: "summoner" }; Q.restore(p4, { quests: JSON.parse(JSON.stringify(s)) });
assert.equal(p4.quests.u.crypt, 15); assert.equal(p4.quests.d, 9); assert.equal(p4.quests.n, 4);
const bad = { cls: "mage" }; Q.restore(bad, { quests: { n: 999, d: 999, cls: "mage" } }); assert.ok(bad.quests.n <= 22 && bad.quests.d <= 20);

// recorrido completo: cumpliendo cada objetivo en orden se llega al final de las tres líneas sin callejones sin salida
import { newInst } from "../web/src/shared/systems/itemsys.js";
for (const cls of ["warrior", "mage", "summoner"]) {
  const wz = mk(), pz = wz.ents.get(wz.addPlayer("Walk" + cls, null, { gender: 1, cls })), P = Q.PATH[cls];
  const ball = sp => { let b = pz.bag.find(i => i.comp?.sp === sp); if (!b) { b = newInst(wz, 1); b.comp = { sp, lvl: 1, exp: 0, on: false, nm: "x", mode: "attack" }; pz.bag.push(b); } return b; };
  for (let guard = 0; guard < 60 && pz.quests.n < Q.TOTAL(cls); guard++) {
    const m = Q.lineOf(pz)[pz.quests.n], g = m.goal;
    switch (g.k) {
      case "lvl": pz.level = g.n; break;
      case "kill": for (let i = 0; i < g.n; i++) Q.onKill(wz, pz, { name: g.mon === "*" ? "Slime" : g.mon }); break;
      case "kinds": pz.kinds = Object.fromEntries(Array.from({ length: g.n }, (_, i) => ["k" + i, 1])); break;
      case "depth": Q.onDepth(wz, pz, g.n); break;
      case "boss": pz.quests.b[g.tier - 1] += g.n; break;
      case "ek": pz.ek = g.n; break;
      case "pet": ball(P.sp).comp.lvl = g.n; break;
      case "staff": if (!pz.bag.some(i => i.id === P.staff)) pz.bag.push(newInst(wz, P.staff)); break;
      case "trade": Q.onTrade(wz, pz); break;
      case "final": ball(P.final).comp.lvl = g.n; break;
      case "king": pz.delve = { ...(pz.delve || {}), king: g.n }; break;
      case "gold": pz.gold = g.n; break;
    }
    for (let i = 0; i < 20; i++) wz.tick(50); Q.check(wz, pz);
  }
  assert.equal(pz.quests.n, Q.TOTAL(cls), "recorre la línea de " + cls + " hasta el final");
  assert.ok(Q.cryptCap(pz) === 20 && Q.canTrade(pz), "permisos finales de " + cls);
}

// objetos de hito: existen en los datos y son llaves/trofeos
const d = w.data; for (const k of Object.keys(Q.ITEMS)) assert.ok(d.item(+k), "item " + k);
console.log("OK quests");
