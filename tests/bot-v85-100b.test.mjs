// v0.85.100 bots (revisión): sumidero de oro #116, rotación de magos #117, histéresis #118, mapa por nivel/bando #119, build–hechizos #120, huecos de equipo #121, huida PvP #122.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = n => readFileSync(new URL("../web/src/shared/systems/" + n, import.meta.url), "utf8");
const m = src("botmagic.js"), b = src("bot.js"), r = src("residents.js"), bmg = src("botmanuals.js".replace("botmanuals", "botmagic"));
const bt = await import("../web/src/shared/systems/bot.js");
const bm = await import("../web/src/shared/systems/botmagic.js");
const rs = await import("../web/src/shared/systems/residents.js");
// #116
assert.ok(bt.GOLD_RICH > 0 && bt.GOLD_GIFT > bt.GOLD_RICH);
assert.match(b, /bot_gift/); assert.match(b, /potCap = rich \? 40/); assert.match(b, /SKILL\.MAGIC_RES/);
// #117: rotación determinista, cambia de hechizo cada ROT_EVERY lanzamientos
const w = { magic: {}, fightZone: false }, p = { mp: 100, maxMp: 100, x: 0, y: 0 }, t = { x: 2, y: 0 };
const ok = id => [91, 81, 74].includes(id);
const seq = n => bm.rotateAttack(w, p, t, { atkN: n }, ok);
assert.equal(bm.ROT_EVERY, 6);
assert.equal(seq(0), 91); assert.equal(seq(5), 91); assert.equal(seq(6), 81); assert.equal(seq(12), 74); assert.equal(seq(18), 91);
assert.equal(bm.rotateAttack(w, { ...p, x: 20 }, t, { atkN: 7 }, ok), 91, "lejos: el más potente");
assert.equal(bm.rotateAttack(w, p, t, { atkN: 0 }, () => false), undefined);
assert.match(m, /b\.pv\.atkN/);
// #118
assert.equal(bt.EQ_SETTLE_MS, 300000);
const bag = { eqAt: { 3: 310000 } };
assert.equal(bt.eqFresh({ time: 320000 }, bag, 3), true); assert.equal(bt.eqFresh({ time: 700000 }, bag, 3), false); assert.equal(bt.eqFresh({ time: 320000 }, bag, 5), false); assert.equal(bt.eqFresh({ time: 2000 }, { eqAt: { 3: 1000 } }, 3), false, "los primeros 5 min: equipo inicial libre");
// #119
assert.equal(rs.cryptTooLow({ level: 140 }), true); assert.equal(rs.cryptTooLow({ level: 20 }), false);
assert.match(r, /cryptTooLow\(p\)\) kind = "pl"/); assert.match(r, /plSideFull\(adv, p\)\) kind = "hunt"/);
const mk = (side, map) => ({ id: side + map + Math.random(), side, res: {}, map });
const ents = [], mkAdv = L => { const bots = new Map(), ws = new Map(); L.forEach((q, i) => { bots.set(i, 1); ws.set(i, { map: { id: q.map }, ents: new Map([[i, q]]) }); }); return { bots, worldFor: i => ws.get(i) }; };
const me = { side: 1, res: {} };
assert.equal(rs.plSideFull(mkAdv([mk(1, "2ndmiddle"), mk(1, "2ndmiddle"), mk(1, "2ndmiddle"), mk(2, "2ndmiddle")]), me), false);
assert.equal(rs.plSideFull(mkAdv([mk(1, "2ndmiddle"), mk(1, "2ndmiddle"), mk(1, "2ndmiddle"), mk(1, "2ndmiddle")]), me), true);
// #120: no aprende hechizos con INT insuficiente
assert.match(src("botmagic.js"), /stats\.int < sp\.reqInt/);
// #121
assert.match(b, /\/Hauberk\//); assert.match(b, /\^LongBoots/);
// #122: huida PvP ~45 %
assert.match(src("bot.js"), /\(w\.pvp \? 0\.13 : 0\)/);
console.log("OK bot-v85-100b");
