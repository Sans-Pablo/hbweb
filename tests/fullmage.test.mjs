// Modo «Full mage» (F1): stats 200, todos los hechizos, sin maná, solo para quien lo activa.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { run } from "../web/src/shared/systems/debug.js";
import { freeFor, manaCost, spellDamage, MAGIC_MODE } from "../web/src/shared/magic.js";
const magic = JSON.parse(readFileSync(new URL("../web/data/magic.json", import.meta.url)));
const mk = () => ({ stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 }, magic: {}, eff: {}, hp: 1, maxHp: 9, mp: 0, maxMp: 9, sp: 0, maxSp: 9 });
const say = []; const w = { magic, recalc() {}, emit: e => say.push(e), hooks: {} };
const p = mk(), q = mk(); p.id = 1; const sp = Object.values(magic).find(s => s && s.mana > 0);
assert.ok(sp && !MAGIC_MODE.free);
assert.ok(manaCost(p, sp) > 0 && !freeFor(p));
run(w, p, { op: "fullmage" });
assert.equal(p.fullMage, true);
assert.ok(Object.values(p.stats).every(v => v === 200), "stats 200");
assert.ok(Object.keys(magic).filter(i => magic[i]).every(i => p.magic[i] === 1), "todas las magias");
assert.equal(manaCost(p, sp), 0, "sin maná");
assert.ok(manaCost(q, sp) > 0 && !freeFor(q), "otro jugador no se ve afectado");
// daño: dados + Mag/3.3 % (HG.cpp Effect_Damage_Spot); Mag 0 cuenta como 1
const rng = () => 0.5; const d200 = spellDamage(rng, p, 2, 6, 0), d10 = spellDamage(rng, q, 2, 6, 0);
assert.ok(d200 > d10, "más Mag, más daño");
run(w, p, { op: "fullmage" });
assert.equal(p.fullMage, false);
console.log("OK");
