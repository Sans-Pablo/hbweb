// Todas las bolas que vende el hospital se pueden comprar, invocar y previsualizar (incluidas las nuevas de evolutions.js). node tests/summon-buy-all.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { spawnCitizen } from "../web/src/shared/systems/citizens.js";
import * as C from "../web/src/shared/systems/companion.js";
import { isTier2 } from "../web/src/shared/systems/schools.js";
import { infoOf } from "../web/src/shared/systems/summoninfo.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json"), magic = J("magic.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 9; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const w = new World({ grid, npcDb, data: new GameData({ items: J("items.json"), magic, npcs: npcDb }), spawns: [], rng, start: [10, 10] });
const A = w.ents.get(w.addPlayer("Comprador", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }));
A.level = 50; A.stats.str = 400; w.recalc(A); A.gold = 1e6;
const nurse = spawnCitizen(w, C.HOSPITAL.npc, A.x, A.y + 3, C.HOSPITAL.role);
for (const sp of Object.keys(C.SPECIES)) {
  if (isTier2(sp)) { assert.equal(w.command(A.id, { t: "petbuy", npc: nurse.id, sp }), false, sp + " (evolución) no se compra"); continue; }
  if (!npcDb[sp]) continue;                                                  // Orc-Mage: no existe en NPC.cfg, se rechaza a propósito
  A.bag.length = 0;
  assert.ok(w.command(A.id, { t: "petbuy", npc: nurse.id, sp }), "compra de " + sp + " " + JSON.stringify(w.events.slice(-2)));
  const ball = A.bag.find(i => i.comp?.sp === sp); assert.ok(ball, "bola de " + sp + " en la mochila");
  const info = infoOf(A, sp, magic); assert.ok(info && info.lo && info.hi, "ficha de " + sp);
  if (C.SPECIES[sp] && ["Healer", "Buffer", "Aura"].includes(sp)) continue;      // necesitan báculo en la mano (regla propia)
  for (let i = 0; i < 100; i++) w.tick(50);
  assert.ok(w.command(A.id, { t: "use", uid: ball.uid }), "invocar " + sp + " " + JSON.stringify(w.events.slice(-2)));
  assert.ok([...w.ents.values()].some(e => e.comp && e.master === A.id), "el summon de " + sp + " aparece");
  w.command(A.id, { t: "use", uid: ball.uid });
}
console.log("OK summon-buy-all");
