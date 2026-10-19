// v0.85.91 (obs. 45-49): sin presas triviales, casters sin equipo de Str ajena, guerrero con placas, reset suave de bots
import assert from "node:assert/strict";
import { _dbg } from "../tools/train.mjs";
import { softReset, trivialPrey, maxOut } from "../web/src/shared/systems/bot.js";
const { mkAdv, tick } = _dbg, a = mkAdv(11), w = a.farm;
const npc = { kind: "npc", exp: 1, cfg: {}, target: "z" }, res = { id: "p", level: 50, res: {}, bot: {} };
assert.ok(trivialPrey(res, npc), "residente de nivel 50 ignora un bicho trivial");
assert.ok(trivialPrey({ ...res, res: null }, npc), "v0.85.97 (obs. 53): también los bots no residentes ignoran presas triviales");
assert.ok(!trivialPrey({ ...res, res: null, bot: null }, npc), "un jugador no cambia");
assert.ok(!trivialPrey({ ...res, level: 5 }, npc), "a nivel bajo caza lo que hay");
const war = a.spawnBot(null, { level: 100 }), mage = a.spawnBot(null, { level: 100, mage: true });
for (const p of [war, mage]) { p.bot.farmer = false; maxOut(w, p); p.bag.push({ uid: "x", id: 1, n: 1 }); }
for (const p of [war, mage]) {
  assert.equal(softReset(w, p), true);
  assert.equal(p.bag.filter(i => i.id === 1 && i.uid === "x").length, 0, "bolsa vaciada y recomprada");
  assert.ok(Object.values(p.skills).every(v => v === 100), "habilidades al 100");
  assert.ok(p.gold > 0 || p.bag.length > 0, "oro o compras");
}
for (let s = 0; s < 120; s++) tick(a, 1);
for (const slot of ["HEAD", "BODY", "ARMS", "LEGGINGS"]) for (const it of Object.values(mage.equip || {})) { const d = it && w.data.item(it.id); if (d && d.reqStr) assert.ok(d.reqStr <= mage.stats.str, "el mago no lleva " + d.name + " sin la Str"); }
console.log("OK bot-obs45-49");
process.exit(0);
