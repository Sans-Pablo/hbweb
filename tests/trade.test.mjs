// Comercio entre jugadores (systems/trade.js) e item level (itemlevel.js): invitar, ofrecer, confirmar, cambio atómico, cancelar, peso y distancia.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import * as Inv from "../web/src/shared/inventory.js";
import { itemLevel } from "../web/src/shared/itemlevel.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 9; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const mk = n => { const id = w.addPlayer(n, null, { gender: 1, stats: { str: 40, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }); return w.ents.get(id); };
const A = mk("Alfa"), B = mk("Beta");
w.drainEvents();
const give = (p, name, n = 1) => { const inst = newInst(w, data.named(name).id, n); Inv.addToBag(p, data, inst); return inst; };

// item level: un arma mejor vale más; los atributos suman
const ll = itemLevel(data.named("LongSword")), dg = itemLevel(data.named("Dagger"));
assert.ok(ll > dg, "LongSword > Dagger"); assert.ok(itemLevel(data.named("LongSword"), (7 << 20) | (5 << 16)) > ll, "los atributos suman");

const sword = give(A, "LongSword"); A.gold = 500; B.gold = 300; give(B, "RedPotion", 3); const potion = B.bag.find(i => i.id === data.named("RedPotion").id), pc = potion.count;
const goldA = A.gold, goldB = B.gold;
// petición y rechazo
assert.ok(w.command(A.id, { t: "tradereq", name: "beta" }));
assert.ok(w.drainEvents().some(v => v.t === "tradequery" && v.id === B.id && v.from === "Alfa"));
w.command(B.id, { t: "tradeanswer", r: 0 });
assert.ok(w.drainEvents().some(v => v.t === "trade" && v.k === "refused" && v.id === A.id)); assert.ok(!A.trade && !B.trade);
// aceptada: ventana abierta
w.command(A.id, { t: "tradereq", name: "Beta" }); w.drainEvents(); w.command(B.id, { t: "tradeanswer", r: 1 });
assert.ok(w.drainEvents().some(v => v.t === "trade" && v.k === "open" && v.id === A.id)); assert.ok(A.trade && B.trade);
// no se ofrece lo equipado ni se confirma solo uno
w.command(A.id, { t: "tradeset", uid: sword.uid }); w.command(B.id, { t: "tradeset", uid: potion.uid }); w.command(B.id, { t: "tradegold", n: 120 });
w.command(A.id, { t: "tradeok" }); assert.ok(A.trade.ok && !B.trade.ok && A.bag.some(i => i.uid === sword.uid));
// un cambio quita la confirmación de los dos
w.command(B.id, { t: "tradegold", n: 100 }); assert.ok(!A.trade.ok);
w.command(A.id, { t: "tradeok" }); w.command(B.id, { t: "tradeok" });
const done = w.drainEvents().filter(v => v.t === "trade" && v.k === "done");
assert.equal(done.length, 2); assert.ok(!A.trade && !B.trade);
assert.ok(B.bag.some(i => i.uid === sword.uid) && !A.bag.some(i => i.uid === sword.uid), "la espada pasó a Beta");
assert.ok(A.bag.some(i => i.id === potion.id && i.count >= pc), "las pociones pasaron a Alfa");
assert.equal(A.gold, goldA + 100); assert.equal(B.gold, goldB - 100);
// cancelar y distancia
w.command(A.id, { t: "tradereq", name: "Beta" }); w.drainEvents(); w.command(B.id, { t: "tradeanswer", r: 1 }); w.drainEvents();
w.command(A.id, { t: "tradecancel" }); assert.ok(!A.trade && !B.trade);
w.command(A.id, { t: "tradereq", name: "Beta" }); w.command(B.id, { t: "tradeanswer", r: 1 }); w.drainEvents();
B.x += 30; w.tick(1100); assert.ok(!A.trade && !B.trade, "se cancela al alejarse");
B.x -= 30;
// arrastrar un objeto sobre el jugador (estilo Olympia): tradereq con uid -> ya viene ofrecido al aceptar
const gift = give(B, "Dagger");
w.command(B.id, { t: "tradereq", name: "Alfa", uid: gift.uid }); w.drainEvents(); w.command(A.id, { t: "tradeanswer", r: 1 }); w.drainEvents();
assert.deepEqual(B.trade.offer, [gift.uid], "el objeto arrastrado queda ofrecido"); assert.ok(A.trade);
w.command(A.id, { t: "tradecancel" });
// un objeto equipado o ajeno no se pre-ofrece
w.command(B.id, { t: "tradereq", name: "Alfa", uid: 999999 }); w.command(A.id, { t: "tradeanswer", r: 1 }); assert.deepEqual(B.trade.offer, []); w.command(A.id, { t: "tradecancel" }); w.drainEvents();
// mochila llena: no se cancela, el objeto espera en la cola de recepción y entra cuando hay hueco
for (let k = 0; A.bag.length < 50; k++) { const r = newInst(w, data.named("Dagger").id, 1); Inv.addToBag(A, data, r); if (k > 200) break; }
const full = A.bag.length;
w.command(B.id, { t: "tradereq", name: "Alfa", uid: gift.uid }); w.command(A.id, { t: "tradeanswer", r: 1 }); w.drainEvents();
w.command(A.id, { t: "tradeok" }); w.command(B.id, { t: "tradeok" });
const ev = w.drainEvents();
assert.ok(ev.some(v => v.t === "trade" && v.k === "done" && v.id === A.id) && ev.some(v => v.k === "queued" && v.id === A.id), "se hizo el trato y avisó de la cola");
assert.equal(A.bag.length, full, "la mochila llena no recibe nada"); assert.equal(A.pending?.length, 1); assert.ok(!B.bag.some(i => i.uid === gift.uid));
w.tick(1100); assert.equal(A.pending?.length, 1, "sigue en cola mientras no haya sitio");
for (let k = 0; k < 30; k++) Inv.removeFromBag(A, A.bag[A.bag.length - 1].uid); w.recalc(A); w.tick(1100);
assert.ok(!A.pending && A.bag.some(i => i.id === gift.id) && w.drainEvents().some(v => v.k === "delivered" && v.id === A.id), "al liberar hueco entra solo");
console.log("OK");
