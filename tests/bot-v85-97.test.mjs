// v0.85.97: piedras valiosas, ropa del inicio, maná de magos, memoria de ventas
import assert from "node:assert/strict";
import { _dbg } from "../tools/train.mjs";
import { lootValue } from "../web/src/shared/systems/bot.js";
import * as Shop from "../web/src/shared/systems/shopsys.js";
const { mkAdv, tick } = _dbg, a = mkAdv(21), w = a.farm;
const war = a.spawnBot(null, { level: 30 });
for (const id of [650, 656, 657]) {
  const d = w.data.item(id);
  assert.ok(d.price < 0, "precio negativo en datos " + id);
  assert.ok(lootValue(w, war, { id, count: 1 }) > 1, "el bot recoge " + d.name);
  assert.ok(Shop.sellPriceOf(d, { id }, 1) > 1, "se vende por su valor absoluto " + d.name);
}
const mage = a.spawnBot(null, { level: 60, mage: true }); mage.bot.farmer = false;
for (let s = 0; s < 300; s++) tick(a, 1);
const pots = mage.bag.filter(i => /Blue|Mana/i.test(w.data.item(i.id).name)).reduce((n, i) => n + (i.n || i.count || 1), 0);
assert.ok(pots > 0 || mage.gold < 100, "el mago compra pociones de maná (obs. 71)");
console.log("OK bot-v85-97");
process.exit(0);
