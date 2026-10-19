// v0.85.100 bots: summons con talentos (#107), sin yelmos (#108), Berserk no a magos (#109), Berserk en granja + plate sin bucle (#110), magias inútiles en PvE (#113), 1.000.000 de oro (#114).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = n => readFileSync(new URL("../web/src/shared/systems/" + n, import.meta.url), "utf8");
const m = src("botmagic.js"), b = src("bot.js"), r = src("residents.js");
const bi = await import("../web/src/shared/systems/botitems.js");
const bm = await import("../web/src/shared/systems/botmagic.js");
const bt = await import("../web/src/shared/systems/bot.js");
// #114
assert.equal(bt.BOT_GOLD, 1000000); assert.ok(bt.BOT_GOLD_MIN < bt.BOT_GOLD);
assert.match(b, /ledger\(w, p, BOT_GOLD - p\.gold, "bot_grant"/, "#114: reposición de oro");
assert.match(r, /p\.gold > 20000 && !p\.bot/, "#114: sin aviso goldsink para bots");
// #108
const H = { equipPos: 0, name: "Full-Helm" }; // EQUIP.HEAD se comprueba en isHelm
assert.equal(typeof bi.isHelm, "function");
assert.equal(bi.isHelm(null), false);
assert.equal(bi.isHelm({ equipPos: -1, name: "Full-Helm" }), false);
assert.match(b, /bot_refund/, "#108: migración retira yelmos de la mochila");
assert.match(b, /ya no llevan yelmo/, "#108: desequipa yelmo");
assert.match(src("botitems.js"), /!isHelm\(d\)/, "#108: canWear rechaza yelmos");
// #109 / #110
assert.match(m, /id === BERSERK && isCaster\(q\)/, "#109: sin Berserk a magos");
assert.ok(m.includes("!isCaster(q) && dist(p, q) <= HEAL_RANGE && !sget(w, q, \"berserk\")"), "#110: Berserk a aliados no casters en la granja");
assert.match(b, /ilv\(cw\) \* 1\.08/, "#110: histéresis de plate");
// #113
assert.equal(typeof bm.pveUseless, "function");
const w = { magic: { 95: { type: 16 }, 10: { type: 5 } } };
assert.equal(bm.pveUseless(w, 95, { kind: "npc" }), true, "Mass Illusion inútil contra monstruos");
assert.equal(bm.pveUseless(w, 95, { kind: "player" }), false);
assert.equal(bm.pveUseless(w, 10, { kind: "npc" }), false);
assert.equal(bm.pveUseless(w, 95, null), false);
assert.match(m, /!pveUseless\(w, 95, t\)/, "#113: mageKit no usa Mass Illusion");
// #107
assert.match(r, /\(#107\)[^\n]*\n\s*for \(const bl of balls\(p\)\)/, "#107: talentos a todos los summons");
assert.ok(src("magicsys.js").includes("tgt.dead || tgt.crop"), "cultivos fuera de los hechizos de zona");
console.log("OK bot-v85-100");
