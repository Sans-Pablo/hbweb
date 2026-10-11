// Agricultura (systems/farming.js): siembra, azada, cosecha, reglas del servidor original.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { SKILL } from "../web/src/shared/skills.js";
import * as F from "../web/src/shared/systems/farming.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const raw = new Uint8Array(60 * 60 * 10);
const grid = new Grid(60, 60, raw);
let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Granjero", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 30, mag: 10, chr: 10 } });
const p = w.ents.get(id); p.level = 40; p.dir = 3; w.recalc(p);   // mira al este
const fx = p.x + 1, fy = p.y;
const give = it => { const i = newInst(w, it, 1); p.bag.push(i); return i; };
const events = []; const emit = w.emit.bind(w); w.emit = e => { events.push(e); emit(e); };
const lastReject = () => events.filter(e => e.t === "reject").pop()?.text || events.filter(e => e.t === "reject").pop()?.why;

// sin casilla de cultivo no se siembra
let seedBag = give(801);
w.command(id, { t: "use", uid: seedBag.uid });
assert.ok(![...w.ents.values()].some(e => e.crop), "no se siembra fuera de casilla de cultivo");
// sin habilidad tampoco
raw[(fy * 60 + fx) * 10 + 8] |= 0x20;
assert.ok(grid.farm(fx, fy));
w.command(id, { t: "use", uid: seedBag.uid });
assert.ok(![...w.ents.values()].some(e => e.crop), "sin habilidad no se siembra");
// con habilidad: se siembra y se consume la bolsa
p.skills[SKILL.FARMING] = 50;
w.command(id, { t: "use", uid: seedBag.uid });
const crop = [...w.ents.values()].find(e => e.crop);
assert.ok(crop, "cultivo sembrado"); assert.equal(crop.build, F.GROW); assert.equal(crop.a2 & 255, 1);
assert.ok(!p.bag.includes(seedBag), "la bolsa de semillas se consume");
// ocupada: no se siembra dos veces
const s2 = give(801); w.command(id, { t: "use", uid: s2.uid });
assert.equal([...w.ents.values()].filter(e => e.crop).length, 1);

// azada: crece por etapas y acaba en cosecha
p.eff.wtype = F.HOE_WTYPE; p.skills[SKILL.FARMING] = 90;
let guard = 0;
while (w.ents.has(crop.id) && guard++ < 200) { w.command(id, { t: "attack", target: crop.id }); for (let k = 0; k < 40; k++) w.tick(50); if (crop.build < 18 && crop.build > 8) assert.equal(crop.a2 & 255, 2); if (crop.build < 8 && crop.build > 0) assert.equal(crop.a2 & 255, 3); }
assert.ok(!w.ents.has(crop.id), "el cultivo desaparece al terminar");
assert.ok(guard < 200);
assert.equal(F.PRODUCT[14][0], 721);
// tabla de probabilidad: fuera de rango = 0
assert.equal(F.probability(w, 10, 20, 1), 0);
console.log("farming OK");

// Comida de compañeros: tomate +1 vida, uvas +1 maná, seta +1 ataque
import * as C from "../web/src/shared/systems/companion.js";
const ball = newInst(w, 1, 1); ball.comp = { sp: "Giant-Ant", lvl: 5, exp: 0, on: false }; p.bag.push(ball);
const base = C.statsOf(p, ball.comp);
for (const it of [829, 830, 832]) { const f = give(it); w.command(id, { t: "use", uid: f.uid, dest: ball.uid }); }
const after = C.statsOf(p, ball.comp);
assert.equal(after.hp, base.hp + 1); assert.equal(after.mp, base.mp + 1); assert.equal(after.dmg, base.dmg + 1);
assert.deepEqual(ball.comp.fb, { hp: 1, mp: 1, atk: 1 });
console.log("farming feed OK");

// Bots granjeros: siembran y cosechan solos
{
  const Bot = await import("../web/src/shared/systems/bot.js");
  const raw2 = new Uint8Array(60 * 60 * 10), g2 = new Grid(60, 60, raw2);
  for (let y = 20; y < 26; y++) for (let x = 20; x < 26; x++) raw2[(y * 60 + x) * 10 + 8] |= 0x20;
  const w2 = new World({ grid: g2, npcDb, data, spawns: [], rng, start: [22, 22] });
  const bid = w2.addPlayer("Campesino", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 30, mag: 10, chr: 10 } });
  const bp = w2.ents.get(bid); bp.level = 40; w2.recalc(bp);
  Bot.init(w2, bp, { level: 40 }); bp.bot.farmer = true;
  const adv = { time: 0, command: (i, c) => w2.command(i, c), worldFor: () => w2 };
  let sowed = false, harvested = false;
  for (let k = 0; k < 4000 && !harvested; k++) {
    w2.tick(50); adv.time = w2.time; Bot.think(adv, bp);
    if ([...w2.ents.values()].some(e => e.crop)) sowed = true;
    if (sowed && ![...w2.ents.values()].some(e => e.crop)) harvested = true;
  }
  assert.ok(sowed, "el bot granjero siembra"); assert.ok(harvested, "el bot granjero cuida y cosecha");
  console.log("farming bot OK");
}
