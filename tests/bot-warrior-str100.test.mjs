// v0.85.93 (Pablo): ningún guerrero (bot, residente o pescador/cazador) a nivel 140 baja de Str 100, y la Str cubre el peso de su arma
import assert from "node:assert/strict";
import { _dbg } from "../tools/train.mjs";
import { maxOut } from "../web/src/shared/systems/bot.js";
import * as Residents from "../web/src/shared/systems/residents.js";
import { buildOf, allocate, WAR_STR_MIN } from "../web/src/shared/systems/builds.js";
import { EQUIP } from "../web/src/shared/items.js";
const a = _dbg.mkAdv(7), w = a.farm, ps = [];
for (let i = 0; i < 8; i++) { const p = a.spawnBot(null, { level: 1 }); p.bot.farmer = false; maxOut(w, p); ps.push(p); }
for (const n of Residents.RESIDENT_NAMES) { const p = a.spawnResident(n, null); maxOut(w, p); ps.push(p); }
let war = 0;
for (const p of ps) {
  if (buildOf(p) === "mage") continue;
  war++;
  assert.ok(p.stats.str >= WAR_STR_MIN, `${p.name} (${p.res?.job || p.res?.arch || "bot"}) Str ${p.stats.str} < ${WAR_STR_MIN}`);
  const u = p.equip[EQUIP.RHAND] ?? p.equip[EQUIP.TWOHAND], i = u !== undefined && p.bag.find(x => x.uid === u), d = i && w.data.item(i.id);
  if (d) assert.ok(d.weight <= p.stats.str * 100 + 99, `${p.name}: ${d.name} (peso ${d.weight}) con Str ${p.stats.str}`);
}
assert.ok(war >= 12, "hay guerreros que comprobar: " + war);
// allocate: aunque la arma no pida Str, un guerrero de nivel 140 con pozo completo llega a 100
const q = ps.find(p => buildOf(p) !== "mage"); q.level = 140; q.stats = { str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 };
assert.ok((allocate(q, 417, 0).str || 0) + 10 >= 100, "allocate sin arma pesada deja Str >= 100");
// v0.85.95: guerrero guardado sin arma pesada ni oro rehace sus puntos con la Str de su arma OBJETIVO, y el pescador guardado como mago pasa a guerrero con arco
import * as Respec from "../web/src/shared/systems/respec.js";
{
  const j = a.spawnResident("Jessa", null); maxOut(w, j);
  Object.assign(j.res, { warV: 1, strV: 0, resetV: 5, arch: "warrior", build: "vanguard" });
  j.bag.length = 0; j.equip = {}; j.gold = 20; Respec.freeReset(w, j); j.stats = { str: 29, vit: 200, dex: 200, int: 36, mag: 10, chr: 10 }; j.pool = 0; w.recalc(j);
  const f = a.spawnResident("Ivo", null); maxOut(w, f);
  Object.assign(f.res, { warV: 1, strV: 0, resetV: 5, mageV: 2, build: "mage", arch: "hunter" });
  Respec.freeReset(w, f); f.stats = { str: 39, vit: 126, dex: 10, int: 200, mag: 100, chr: 10 }; f.pool = 0; w.recalc(f);
  for (let i = 0; i < 400; i++) a.tick(100);
  assert.ok(j.stats.str >= 160, "Jessa pobre: Str de su arma objetivo, no " + j.stats.str);
  assert.ok(j.stats.dex <= 130, "Jessa: Dex no 200");
  { const u = j.equip[EQUIP.RHAND] ?? j.equip[EQUIP.TWOHAND], it = u !== undefined && j.bag.find(x => x.uid === u); assert.ok(it, "Jessa lleva arma (kit)"); const nm = w.data.item(it.id).name; assert.ok(/Flameberge|BarbarianHammer|BattleHammer|BattleAxe|GiantSword|Hammer/.test(nm), "arma de guerrero: " + nm); }          // v0.85.96: kit
  assert.equal(buildOf(f), "vanguard"); assert.ok(f.stats.str >= 100, "pescador-mago: guerrero con Str >= 100");
}
console.log("OK bot-warrior-str100", war);
process.exit(0);
