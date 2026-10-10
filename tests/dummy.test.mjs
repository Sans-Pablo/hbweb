// Dummy: summon de apoyo único (3 clases, radio por nivel, auras por nivel, MASS, reflejo de agro). Solo afecta al grupo.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { spawnCitizen } from "../web/src/shared/systems/citizens.js";
import { spawnFrom, spawnCompanion } from "../web/src/shared/systems/npcsys.js";
import * as C from "../web/src/shared/systems/companion.js";
import * as T from "../web/src/shared/systems/talents.js";
import * as D from "../web/src/shared/systems/dummy.js";
import * as Party from "../web/src/shared/systems/party.js";
import { sget } from "../web/src/shared/systems/status.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const mk = n => { const id = w.addPlayer(n, null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }); const e = w.ents.get(id); e.stats.str = 400; e.level = 50; w.recalc(e); e.hp = e.maxHp; return e; };
const A = mk("Alfa"), B = mk("Beta"), Z = mk("Zeta");
const tick = (ms) => { for (let i = 0; i < ms / 50; i++) w.tick(50); };
// grupo Alfa+Beta (Zeta fuera)
w.command(A.id, { t: "partyreq", name: "Beta", auto: true });
assert.equal(A.party?.id, B.party?.id);
for (const [e, x] of [[A, 20], [B, 22], [Z, 24]]) { w.grid.release(e.x, e.y, e.id); e.x = e.fx = x; e.y = e.fy = 20; w.grid.occupy(e.x, e.y, e.id); }

// radio por nivel: 1 → 6
assert.equal(D.radiusOf(1), 1); assert.equal(D.radiusOf(50), 6); assert.ok(D.radiusOf(25) > 1 && D.radiusOf(25) < 6);
// frágil: poca vida que casi no sube
const nurse = spawnCitizen(w, C.HOSPITAL.npc, A.x, A.y + 3, C.HOSPITAL.role); A.gold = 1e6;
{ const ok = w.command(A.id, { t: "petbuy", npc: nurse.id, sp: "Dummy" }); if (!ok) console.log(JSON.stringify(w.events.slice(-3)), nurse.x, nurse.y, nurse.role, A.x, A.y); assert.ok(ok); }
const ball = A.bag.find(i => i.comp?.sp === "Dummy"), c = ball.comp;
assert.ok(C.statsOf(A, c).hp <= 10); c.lvl = 50; assert.ok(C.statsOf(A, c).hp <= 70, "frágil incluso al 50");
c.lvl = 30;
// la primera magia fija la clase; las demás clases quedan cerradas
assert.ok(w.command(A.id, { t: "talent", uid: ball.uid, talent: "dheal" }));
assert.equal(c.cls, "healer");
assert.equal(w.command(A.id, { t: "talent", uid: ball.uid, talent: "dward" }), false, "otra clase");
assert.equal(w.command(A.id, { t: "talent", uid: ball.uid, talent: "dgheal" }), true);
assert.equal(w.command(A.id, { t: "talent", uid: ball.uid, talent: "might" }), false, "talento de combate no sirve al Dummy");
for (let i = 0; i < 3; i++) w.command(A.id, { t: "talent", uid: ball.uid, talent: "dheal" });
assert.equal(T.rankOf(c, "dheal"), 4);

// invocarlo y dejarlo quieto cerca de Alfa, Beta dentro del radio, Zeta fuera
assert.ok(w.command(A.id, { t: "use", uid: ball.uid }));
const dm = [...w.ents.values()].find(e => e.comp && e.master === A.id);
assert.ok(dm && dm.name === "Dummy");
w.command(A.id, { t: "petmode", mode: "peace" });
w.grid.release(dm.x, dm.y, dm.id); dm.x = dm.fx = 21; dm.y = dm.fy = 20; w.grid.occupy(21, 20, dm.id);
tick(500); assert.equal(dm.dcls, "healer");
const rad = D.radiusOf(30);
B.hp = Math.floor(B.maxHp * 0.3); Z.hp = Math.floor(Z.maxHp * 0.3); const zh = Z.hp;
dm.mp = 500; tick(6000);
assert.ok(B.hp > B.maxHp * 0.3, "cura al miembro del grupo dentro del radio");
assert.equal(Z.hp, zh, "no cura a quien no es del grupo");
// su posición no cambia en modo quedarse
assert.equal(dm.x, 21);

// agro: los monstruos prefieren al Dummy y éste avisa
const mob = spawnFrom(w, { name: "Orc", rect: [23, 18, 25, 22], alive: 0, max: 0, respawn: false });
w.grid.release(mob.x, mob.y, mob.id); mob.x = mob.fx = 22; mob.y = mob.fy = 21; w.grid.occupy(22, 21, mob.id);
w.drainEvents(); tick(2000);
assert.equal(mob.target, dm.id, "reflejo de agro");
assert.ok(w.events.concat(w.drainEvents()).length >= 0);
// Buffer en acción (con un monstruo cerca): escudo y PFM al miembro del grupo, nada a Zeta
mob.nextAct = 1e12; c.tal = { dward: 3, dpfm: 2 }; c.cls = "buffer"; dm.maxHp = dm.hp = 9999; dm.mp = 500; dm.cd = {}; dm.castAt = 0;
tick(8000);
assert.equal(sget(w, B, "protect"), 3, "Defense Shield al grupo"); assert.ok(sget(w, B, "pfm") > 0, "PFM al grupo");
assert.equal(sget(w, Z, "protect"), 0, "nada a quien no es del grupo");
mob.dead = true; w.ents.delete(mob.id);

// Buffer: escudos al grupo (no a Zeta)
{
  const c2 = { sp: "Dummy", lvl: 30, exp: 0, tal: {} }; assert.equal(T.canLearn(c2, "dward"), null);
  T.learn(c2, "dward"); assert.equal(c2.cls, "buffer"); assert.ok(T.canLearn(c2, "dheal")); assert.ok(T.canLearn(c2, "dgward") === null);
  T.reset(c2); assert.equal(c2.cls, undefined);
}
// Auras: porcentaje proporcional al nivel
{
  const lo = { sp: "Dummy", lvl: 10, tal: { dregen: 5, dexp: 5 } }, hi = { ...lo, lvl: 50 };
  assert.ok(D.auraPct(hi, "dregen") > D.auraPct(lo, "dregen") * 4, "el % crece con el nivel");
  assert.equal(D.auraPct({ sp: "Dummy", lvl: 50, tal: {} }, "dregen"), 0);
  assert.ok(D.auraPct(hi, "dexp") <= 40 + 1e-9);
}
console.log("OK dummy");
// Caramelos: rojo cura, verde revive, azul da maná; Alt+clic derecho (petgo) lleva al compañero a una casilla
{
  const w2 = w, A2 = A, cc = c;
  const red = (id) => ({ id, name: id === 780 ? "RedCandy" : id === 781 ? "BlueCandy" : "GreenCandy", effectType: id - 776 });
  dm.hp = 3; const before = dm.hp;
  const got = C.candy(w2, A2, red(780), null, () => 5);
  assert.ok(got > 0 && dm.hp > before, "caramelo rojo cura");
  cc.down = true; dm.dead = false;
  assert.equal(C.candy(w2, A2, red(780), null, () => 5), false, "inconsciente: solo el verde");
  assert.ok(C.candy(w2, A2, red(782), null, () => 5) > 0 && !cc.down, "caramelo verde revive");
  w2.command(A2.id, { t: "petmode", mode: "attack" });
  assert.ok(w2.command(A2.id, { t: "petgo", x: dm.x + 3, y: dm.y + 2 }));
  const gx = dm.x + 3; tick(14000);
  assert.ok(Math.abs(dm.x - gx) <= 1 && Math.abs(dm.y - (A.y + 2)) <= 1 && dm.holdAt, "el compañero llegó y se queda");
  console.log("OK dummy candy/petgo");
}
// Vampiric Aura y Resurrection (Dummy de aura)
{
  assert.ok(D.auraPct({ sp: "Dummy", lvl: 50, tal: { dvamp: 5 } }, "dvamp") <= 8 + 1e-9);
  assert.equal(T.canLearn({ sp: "Dummy", lvl: 20, tal: {}, cls: "aura" }, "dvamp"), "necesita nivel 25");
  assert.equal(T.canLearn({ sp: "Dummy", lvl: 39, tal: {}, cls: "aura" }, "dres"), "necesita nivel 40");
  c.lvl = 50; c.cls = "aura"; c.tal = { dvamp: 5, dres: 2, dregen: 1 }; dm.maxHp = dm.hp = 9999; dm.mp = 900; dm.cd = {}; dm.castAt = 0; dm.dcls = "aura";
  w.grid.release(dm.x, dm.y, dm.id); dm.x = dm.fx = 21; dm.y = dm.fy = 20; w.grid.occupy(21, 20, dm.id);
  // vampiro: Beta (en el grupo) cura al golpear
  const m3 = spawnFrom(w, { name: "Slime", rect: [24, 18, 26, 22], alive: 0, max: 0, respawn: false }); m3.hp = m3.maxHp = 5000; m3.nextAct = 1e12;
  tick(1500);
  B.hp = Math.floor(B.maxHp * 0.5); const hb = B.hp;
  const { damageNpc } = await import("../web/src/shared/systems/combatsys.js");
  damageNpc(w, m3, 100, B, null);
  assert.ok(B.hp > hb, "Vampiric Aura devuelve vida");
  // Zeta (fuera del grupo) no
  Z.hp = Math.floor(Z.maxHp * 0.5); const hz = Z.hp; damageNpc(w, m3, 100, Z, null); assert.equal(Z.hp, hz);
  // resurrección: Beta cae y el Dummy lo levanta
  B.hp = 0; B.dead = true; B.deadAt = w.time; w.grid.release(B.x, B.y, B.id);
  w.events.length = 0; tick(4000);
  assert.ok(!B.dead && B.hp > 0, "Resurrection levanta al aliado");
  assert.ok(w.events.some(e => e.t === "resurrected" && e.id === B.id));
  // recarga: no vuelve a levantarlo enseguida
  B.hp = 0; B.dead = true; w.grid.release(B.x, B.y, B.id); tick(3000);
  assert.ok(B.dead, "recarga de Resurrection");
  B.dead = false; B.hp = B.maxHp; w.grid.occupy(B.x, B.y, B.id);
  console.log("OK dummy vamp/res");
}
