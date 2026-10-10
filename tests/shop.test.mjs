// Tienda, herrero y almacén: compra, venta, reparación y depósito con las reglas del servidor original.
// node tests/shop.test.mjs
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { buyCost, listPrice } from "../web/src/shared/systems/shopsys.js";
import { MAGIC_MODE } from "../web/src/shared/magic.js";

MAGIC_MODE.free = false;
const D = new URL("../web/data/", import.meta.url);
const J = f => JSON.parse(readFileSync(new URL(f, D)));
const meta = J("map.json"), bytes = new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)));
const npcDb = J("npc.json"), data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const maps = {};
for (const id of Object.keys(J("maps/index.json"))) { const m = J("maps/" + id + ".json"); maps[id] = { meta: m, grid: id === "arefarm" ? null : new Grid(m.w, m.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", D)))) }; }
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };

const A = new Adventure({ grid: new Grid(meta.w, meta.h, bytes), npcDb, data, spawns: [], start: meta.start, maps });
const pid = A.addPlayer("tester");
let w = A.staticWorld("gshop_1f"), p = A.worldFor(pid).ents.get(pid);
assert(A.transfer(p, A.farm, w, [51, 41]), "entrar en la tienda");
assert([...w.ents.values()].some(e => e.kind === "citizen" && e.name === "ShopKeeper-W"), "hay tendero");
assert([...w.ents.values()].some(e => e.kind === "citizen" && e.name === "Gandlf"), "Gandlf (mago) está en la tienda general");
const ev = []; const emit = w.emit.bind(w); w.emit = e => { ev.push(e); emit(e); };
const cmd = c => A.command(pid, c);
const id = n => data.named(n).id;
const count = n => p.bag.filter(i => i.id === id(n)).reduce((a, i) => a + i.count, 0);

// descuento de carisma: (chr-10)/4 por ciento, nunca más de la mitad
assert(buyCost(10, 100) === 100 && buyCost(14, 100) === 99 && buyCost(50, 100) === 90 && buyCost(500, 100) === 51, "descuento de carisma");
assert(listPrice(14, 100) === 99, "precio de lista");

// compra
p.gold = 100; p.stats.chr = 10;
const red = data.named("RedPotion").price;
cmd({ t: "buy", name: "RedPotion", count: 3 });
assert(count("RedPotion") === 3 + 1 && p.gold === 100 - 3 * red, "compra de 3 pociones: " + p.gold);
cmd({ t: "buy", name: "LongSword", count: 1 });
assert(p.gold === 100 - 3 * red && ev.some(e => e.t === "nogold"), "sin oro no se compra");
p.gold = 5000; cmd({ t: "buy", name: "10Arrows", count: 2 });
assert(count("Arrow") === 20 && p.gold === 5000 - 2 * 10 * data.named("Arrow").price, "10Arrows = 10 flechas");
cmd({ t: "buy", name: "CraftingVessel", count: 1 });
assert(count("CraftingVessel") === 0, "lo que no está a la venta no se compra");

// venta: potion = precio/2; arma = según la vida que le queda
const pot = p.bag.find(i => i.id === id("RedPotion"));
ev.length = 0; cmd({ t: "sellreq", uid: pot.uid, count: 1, whom: 15 });
const sp = ev.find(e => e.t === "sellprice"); assert(sp && sp.price === Math.trunc(red / 2), "precio de venta de pociones");
const g0 = p.gold; cmd({ t: "sellconfirm", uid: pot.uid, count: 1 });
assert(p.gold === g0 + sp.price && count("RedPotion") === 3, "venta confirmada");
const dag = p.bag.find(i => i.id === id("Dagger")); const dd = data.item(dag.id);
dag.life = Math.floor(dd.maxLife / 2); ev.length = 0; cmd({ t: "sellreq", uid: dag.uid, count: 1, whom: 24 });
assert(ev.find(e => e.t === "sellprice").price === Math.max(1, Math.trunc(Math.trunc((dag.life / dd.maxLife) * 0.5 * dd.price))), "la daga gastada vale menos");
dag.life = 0; ev.length = 0; cmd({ t: "sellreq", uid: dag.uid, count: 1, whom: 24 });
assert(ev.some(e => e.t === "cantsell" && e.why === 2), "un objeto agotado no se vende");

// reparación: armas con el herrero (24), no con el tendero (15)
dag.life = Math.floor(dd.maxLife / 2); ev.length = 0;
cmd({ t: "repairreq", uid: dag.uid, whom: 15 }); assert(ev.some(e => e.t === "cantrepair" && e.why === 2), "el tendero no repara armas");
ev.length = 0; cmd({ t: "repairreq", uid: dag.uid, whom: 24 });
const rp = ev.find(e => e.t === "repairprice"); assert(rp && rp.price === Math.trunc(dd.price / 2) - Math.trunc(0.5 * 0.5 * dd.price) , "precio de reparación " + (rp && rp.price));
const g1 = p.gold; cmd({ t: "repairconfirm", uid: dag.uid });
assert(dag.life === dd.maxLife && p.gold === g1 - rp.price, "reparada");

// lista de venta
const ws = p.bag.find(i => i.id === id("WoodShield")), bp = p.bag.find(i => i.id === id("BluePotion"));
const g2 = p.gold, n0 = p.bag.length; cmd({ t: "selllist", items: [{ uid: bp.uid, count: 1 }, { uid: ws.uid, count: 1 }] });
assert(p.bag.length === n0 - 2 && p.gold > g2, "vender una lista de objetos");

// almacén
p.bank = []; const arrows = p.bag.find(i => i.id === id("Arrow"));
cmd({ t: "deposit", uid: arrows.uid, count: 5 });
assert(arrows.count === 15 && p.bank.length === 1 && p.bank[0].count === 5, "depositar parte de una pila");
cmd({ t: "deposit", uid: arrows.uid, count: 15 });
assert(p.bank.length === 1 && p.bank[0].count === 20 && count("Arrow") === 0, "las pilas se juntan en el almacén");
const sd = p.bag.find(i => i.id === id("Dagger")); cmd({ t: "deposit", uid: sd.uid });
assert(p.bank.length === 2 && !p.bag.includes(sd), "depositar un arma");
cmd({ t: "withdraw", index: 0 }); assert(count("Arrow") === 20 && p.bank.length === 1, "retirar");
const sv = A.saveOf(pid); assert(sv.bank.length === 1, "el almacén se guarda");
console.log("OK");
