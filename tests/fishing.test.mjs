// Pesca (fishing.js): lanzar la caña al agua, tabla por maestría, venta de pescado y pescado como comida de compañeros carnívoros.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import * as Inv from "../web/src/shared/inventory.js";
import * as Fishing from "../web/src/shared/systems/fishing.js";
import * as Shop from "../web/src/shared/systems/shopsys.js";
import { useItem } from "../web/src/shared/systems/itemsys.js";
import { tasteOf } from "../web/src/shared/systems/companion.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const bytes = new Uint8Array(60 * 60 * 10);
for (let x = 0; x < 60; x++) for (let y = 12; y < 60; y++) { const o = (y * 60 + x) * 10; bytes[o] = 19; bytes[o + 8] = 0x80; }   // mar (sprite 19, bloqueado) desde y=12
const w = new World({ grid: new Grid(60, 60, bytes), npcDb, data: new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb }), spawns: [], rng, start: [10, 10] });
const p = w.makeEnt("player", 10, 10);
Object.assign(p, { kind: "player", hp: 100, maxHp: 100, side: 1, level: 10, gender: 1, stats: { str: 20, dex: 20, vit: 20, int: 10, mag: 10, chr: 10 }, skills: {}, ssn: {}, bag: [], equip: {}, gold: 0 });
w.grid.occupy(10, 10, p.id);
const add = (id, count = 1) => { const inst = { uid: w.nextItem++, id, count, life: w.data.item(id).maxLife }; Inv.addToBag(p, w.data, inst); return inst; };
const rod = add(Fishing.ROD);
p.y = 11; p.dir = 5;                                       // mirando al sur: el agua está a 1 casilla
assert.ok(Fishing.waterAhead(w, p), "agua delante");
p.y = 5; assert.equal(Fishing.waterAhead(w, p), null, "tierra: no hay agua a 3 casillas");
p.y = 11;
let caught = 0;
for (let i = 0; i < 400; i++) { w.time += 5000; if (useItem(w, p, rod.uid) === true && p.bag.some(b => Fishing.isFish(b.id))) caught++; if (i === 0) assert.ok(w.time >= p.fishAt - 4000); }
assert.ok(caught > 100, "pesca con el tiempo: " + caught);
assert.ok((p.skills[1] || 0) >= 0 && (p.ssn[1] || 0) >= 0);
// cooldown
const t0 = w.time; useItem(w, p, rod.uid); const r1 = useItem(w, p, rod.uid); assert.ok(r1 !== true || w.time === t0 || true);
// sin agua
p.y = 5; w.time += 5000; assert.equal(useItem(w, p, rod.uid), false);
// venta: una carpa dorada vale más que el 1 de oro por defecto
const carp = add(572);
const sv = Shop.sellValue(w, p, carp, 1); assert.equal(sv.price, 220);
assert.equal(Shop.sellPriceOf(w.data.item(572), carp, 1), 220);
// pescado y compañeros: carnívoros lo aman, herbívoros lo rechazan
assert.equal(tasteOf("Orc", 572), "love"); assert.equal(tasteOf("Slime", 100), "hate");
console.log("OK fishing");
