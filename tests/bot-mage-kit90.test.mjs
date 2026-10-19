// v0.85.90: magos de control y soporte usan su kit (Mass Illusion Movement, Paralyze, PFM, AMP) y el soporte lleva Chain Mail + Tower Shield
import assert from "node:assert/strict";
import { _dbg } from "../tools/train.mjs";
import { maxOut } from "../web/src/shared/systems/bot.js";
import { EQUIP } from "../web/src/shared/items.js";
const { mkAdv, tick } = _dbg, a = mkAdv(7), w = a.farm, bots = [], per = {};
const KIT = ["Mass Illusion Movement", "Paralyze", "Protection From Magic", "Absolute Magic Protect."];
for (const mb of ["blizzard", "blizzard", "control", "support", "blizzard", "control"]) { const p = a.spawnBot(null, { level: 1, mage: true }); p.bot.farmer = false; p.bot.mb = mb; maxOut(w, p); bots.push(p); }
const nm = i => w.data.item(i.id)?.name || "";
const sup = bots.find(p => p.bot.mb === "support");
assert.ok(sup.bag.some(i => /^ChainMail/.test(nm(i))), "el soporte compra la Chain Mail");
assert.ok(sup.bag.some(i => /^TowerShield/.test(nm(i))), "el soporte compra la Tower Shield");
const body = sup.bag.find(i => i.uid === sup.equip[EQUIP.BODY]); assert.ok(body && /^ChainMail/.test(nm(body)), "lleva puesta la Chain Mail");
const byId = new Map(bots.map(p => [p.id, p])), orig = a.command.bind(a);
a.command = (id, c) => { const p = byId.get(id); if (p && c.t === "cast") { const n = w.magic[c.spell]?.name || c.spell, k = p.bot.mb; (per[k] ||= {})[n] = (per[k][n] || 0) + 1; } return orig(id, c); };
for (let s = 0; s < 900; s++) tick(a, 1);
const kit = k => KIT.reduce((x, n) => x + ((per[k] || {})[n] || 0), 0);
assert.ok(kit("control") > 0, "el control usa su kit " + JSON.stringify(per.control));
assert.ok(kit("support") > 0, "el soporte usa su kit " + JSON.stringify(per.support));
console.log("OK bot-mage-kit90", JSON.stringify(per));
process.exit(0);
