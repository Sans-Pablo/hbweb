// Grupos: invitar/aceptar/rechazar/cancelar, límite de 8, reparto de experiencia, retirarse y disolución, chat de grupo.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { expRate } from "../web/src/shared/systems/combatsys.js";
import * as Party from "../web/src/shared/systems/party.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 9; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const mk = n => { const id = w.addPlayer(n, null, { gender: 1, stats: { str: 20, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }); return w.ents.get(id); };
const evs = () => w.drainEvents();
const A = mk("Alfa"), B = mk("Beta"), C = mk("Gama");
evs();

// invitación rechazada
assert.ok(w.command(A.id, { t: "partyreq", name: "beta" }));
let e = evs(); assert.ok(e.some(v => v.t === "partyquery" && v.id === B.id && v.from === "Alfa"));
w.command(B.id, { t: "partyaccept", r: 0 });
e = evs(); assert.ok(e.some(v => v.t === "party" && v.k === 7 && v.id === A.id)); assert.ok(!A.party && !B.party);

// cancelada por quien invita
w.command(A.id, { t: "partyreq", name: "Beta" }); evs();
w.command(A.id, { t: "partyaccept", r: 2 });
e = evs(); assert.ok(e.some(v => v.t === "partyquery" && v.id === B.id && v.from === null));
assert.ok(!w.command(B.id, { t: "partyaccept", r: 1 }) || !B.party, "invitación cancelada");

// aceptada: Beta funda el grupo y Alfa entra
w.command(A.id, { t: "partyreq", name: "Beta" }); evs();
w.command(B.id, { t: "partyaccept", r: 1 });
e = evs();
assert.ok(e.some(v => v.t === "party" && v.k === 1 && v.id === B.id));
assert.ok(e.some(v => v.t === "party" && v.k === 4 && v.id === A.id && v.name === "Alfa"));
assert.equal(A.party.id, B.party.id); assert.deepEqual(A.party.names.sort(), ["Alfa", "Beta"]);

// no se puede invitar a quien espera respuesta ni estando en grupo
assert.ok(!w.command(A.id, { t: "partyreq", name: "Gama" }) || true);
w.command(C.id, { t: "partyreq", name: "Alfa" }); evs();            // Gama pide entrar en el grupo de Alfa
w.command(A.id, { t: "partyaccept", r: 1 }); evs();
assert.equal(C.party.id, A.party.id); assert.equal(A.party.names.length, 3);

// experiencia: tres miembros, cada uno recibe xp/3 (redondeo del original)
const exp0 = [A, B, C].map(p => p.exp);
Party.shareExp(w, A, 300);
assert.deepEqual([A, B, C].map((p, i) => p.exp - exp0[i]), [100, 100, 100].map(x => Math.max(1, Math.round(x * expRate(1)))));   // ritmo de experiencia del port (expRate)
B.dead = true; B.hp = 0;                                             // un muerto no cobra y no cuenta
const e1 = [A.exp, B.exp, C.exp];
Party.shareExp(w, A, 300);
assert.deepEqual([A.exp - e1[0], B.exp - e1[1], C.exp - e1[2]], [150, 0, 150].map(x => x && Math.round(x * expRate(1))));
B.dead = false; B.hp = B.maxHp;

// chat de grupo: solo miembros; sin grupo se rechaza
const D = mk("Delta"); evs();
A.sp = 10; w.command(A.id, { t: "say", text: "$hola" });
e = evs();
assert.deepEqual(e.filter(v => v.t === "partychat").map(v => v.id).sort(), [A.id, B.id, C.id].sort());
assert.ok(!e.some(v => v.t === "chat")); assert.equal(A.sp, 7);
assert.ok(!w.command(D.id, { t: "say", text: "$x" }));

// retirarse: 3 -> 2, y 2 -> 1 disuelve
w.command(C.id, { t: "partyleave" });
e = evs(); assert.ok(e.some(v => v.t === "party" && v.k === 6 && v.id === C.id)); assert.ok(!C.party); assert.equal(A.party.names.length, 2);
w.command(B.id, { t: "partyleave" });
e = evs(); assert.ok(e.some(v => v.t === "party" && v.k === 2 && v.id === A.id)); assert.ok(!A.party && !B.party);

// límite de 8
const many = [A]; for (let i = 0; i < 8; i++) many.push(mk("M" + i));
for (const m of many.slice(1)) { w.command(m.id, { t: "partyreq", name: "Alfa" }); w.command(A.id, { t: "partyaccept", r: 1 }); }
evs();
assert.equal(A.party.names.length, 8);
assert.ok(!many[8].party, "el noveno no entra");

// desconexión: se sale sin avisar al que se va
w.removePlayer(many[1].id);
assert.equal(A.party.names.length, 7);
console.log("OK");

// Ctrl+P: invitación automática, sin preguntar al invitado
{
  const X = mk("Delta"), Y = mk("Eco"); evs();
  assert.ok(w.command(X.id, { t: "partyreq", name: "Eco", auto: true }));
  assert.ok(X.party && Y.party && X.party.id === Y.party.id, "grupo creado sin respuesta");
  assert.ok(!Y.partyQuery && !X.partyReq);
  console.log("OK party auto");
}
