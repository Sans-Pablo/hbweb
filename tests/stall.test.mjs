// Puestos de jugador (systems/stall.js): abrir en shop/warehouse/herrería, comprar sin comisión, recoger oro, cerrar y persistir.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import * as Inv from "../web/src/shared/inventory.js";
import * as Stall from "../web/src/shared/systems/stall.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 9; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const db = [];
const mkWorld = id => { const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] }); w.map = { id, kind: "indoor", portals: [] }; w.hooks = { ...(w.hooks || {}), stalls: () => db }; return w; };
const w = mkWorld("gshop_1f");
const mk = n => { const id = w.addPlayer(n, null, { gender: 1, stats: { str: 40, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }); return w.ents.get(id); };
const A = mk("Alfa"), B = mk("Beta");
B.x = A.x + 1; B.y = A.y; w.drainEvents();
const give = (p, name, n = 1) => { const inst = newInst(w, data.named(name).id, n); Inv.addToBag(p, data, inst); return inst; };
const sword = give(A, "LongSword"); give(A, "RedPotion", 10); const pots = A.bag.find(i => i.id === 91);
const potsBase = pots.count;
A.gold = 0; B.gold = 1000;

// fuera de las tiendas permitidas no se abre
const other = mkWorld("aresden"); other.hooks.stalls = () => db;
assert.ok(!Stall.open(other, A, { items: [{ uid: sword.uid, price: 10 }] }), "mapa no permitido");
// precio inválido y sin objetos
assert.ok(!w.command(A.id, { t: "stallopen", items: [{ uid: sword.uid, price: 0 }] }));
assert.ok(!w.command(A.id, { t: "stallopen", items: [] }));
// abrir: sword + 4 de 10 pociones
{ const k = w.grid.idx(A.x + 2, A.y); w.teleports.set(k, { x: A.x + 2, y: A.y, map: "x" }); assert.ok(!w.command(A.id, { t: "stallopen", items: [{ uid: sword.uid, price: 300 }] }), "BUG-012: junto a un teletransporte no"); w.teleports.delete(k); }
{ const k = w.grid.idx(A.x + 7, A.y + 7); w.teleports.set(k, { x: A.x + 7, y: A.y + 7, map: "x" }); assert.ok(!w.command(A.id, { t: "stallopen", items: [{ uid: sword.uid, price: 300 }] }), "el aura de exclusión de la puerta llega a 8 casillas"); w.teleports.delete(k); }
w.drainEvents(); const okOpen = w.command(A.id, { t: "stallopen", title: "Armas!", items: [{ uid: sword.uid, price: 300 }, { uid: pots.uid, price: 20, count: 4 }] }); if (!okOpen) console.log(w.drainEvents()); assert.ok(okOpen);
assert.equal(db.length, 1); assert.ok(!A.bag.some(i => i.uid === sword.uid), "el objeto sale de la mochila");
assert.equal(A.bag.find(i => i.id === pots.id).count, potsBase - 4);
const ent = [...w.ents.values()].find(e => e.role === "stall"); assert.ok(ent && ent.stall === db[0] && ent.kind === "citizen");
assert.ok(!w.command(A.id, { t: "stallopen", items: [{ uid: pots.uid, price: 5 }] }), "solo un puesto por jugador");
// ver y comprar
w.drainEvents(); assert.ok(w.command(B.id, { t: "stallview", sid: db[0].sid }));
const v = w.drainEvents().find(e => e.t === "stall" && e.k === "view"); assert.equal(v.items.length, 2); assert.equal(v.mine, false);
assert.ok(w.command(B.id, { t: "stallbuy", sid: db[0].sid, uid: sword.uid, count: 1 }));
assert.equal(B.gold, 700); assert.equal(db[0].gold, 300, "comisión 0"); assert.ok(B.bag.some(i => i.id === sword.id));
const bPots = B.bag.find(i => i.id === 91)?.count || 0;
const pu = db[0].items.find(r => r.inst.id === 91).inst.uid;
assert.ok(w.command(B.id, { t: "stallbuy", sid: db[0].sid, uid: pu, count: 3 }));
assert.equal(B.gold, 640); assert.equal(db[0].items.find(r => r.inst.id === 91).inst.count, 1); assert.equal(B.bag.find(i => i.id === 91).count, bPots + 3);
B.gold = 5; w.drainEvents(); w.command(B.id, { t: "stallbuy", sid: db[0].sid, uid: pu, count: 1 });
assert.ok(w.drainEvents().some(e => e.k === "nogold")); assert.equal(db[0].items.find(r => r.inst.id === 91).inst.count, 1, "sin oro no se vende");
assert.ok(!w.command(A.id, { t: "stallbuy", sid: db[0].sid, uid: pu, count: 1 }), "no compras en tu puesto");
// persistencia: el registro se serializa y se vuelve a levantar en otro mundo
const saved = JSON.parse(JSON.stringify(db)), w2 = mkWorld("gshop_1f");
assert.ok(Stall.spawn(w2, saved[0]) && [...w2.ents.values()].some(e => e.role === "stall"));
// recoger oro y cerrar
assert.ok(w.command(A.id, { t: "stalltake" })); assert.equal(A.gold, 360); assert.equal(db[0].gold, 0);
assert.ok(w.command(A.id, { t: "stallclose" })); assert.equal(db.length, 0);
assert.ok(![...w.ents.values()].some(e => e.role === "stall")); assert.equal(A.bag.find(i => i.id === pots.id).count, potsBase - 3);
console.log("OK stall");
