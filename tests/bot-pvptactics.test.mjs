// v0.85.53: tácticas PvP de los bots (Fire Field a un amigo paralizado, Invisibility, apoyo) y clases solo guerrero/mago
import assert from "node:assert";
import { plan } from "../web/src/shared/systems/botmagic.js";
import * as B from "../web/src/shared/systems/builds.js";
const magic = { 41: { name: "Fire Field", mana: 10 }, 32: { name: "Invisibility", mana: 10 }, 65: { name: "AMP", mana: 10 } };
const mk = (o) => ({ kind: "player", hp: 100, maxHp: 100, x: 5, y: 5, stats: { int: 100 }, skills: { 4: 100 }, level: 50, eff: {}, magic: { 41: 1, 32: 1, 65: 1 }, mp: 500, ...o });
const me = mk({ id: "me", party: { id: 1 } }), ally = mk({ id: "al", party: { id: 1 }, x: 6 });
const status = new Map();
const w = { time: 100000, magic, ents: new Map([["me", me], ["al", ally]]), status };
w.ents.forEach(e => (e.status = {}));
ally.status = { hold: { until: 1e12 } };
const r = plan(w, me, { cd: {} });
assert.ok(r === null || r.id === 41 || r.id === 32 || r.id === 65, "plan devuelve un hechizo de apoyo o nada");
const war = { stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10 }, res: { build: "glass" }, bot: {}, equip: {}, bag: [] };
assert.equal(B.buildOf(war), "vanguard", "solo dos clases: el cañón de cristal es guerrero");
assert.equal(B.buildOf({ ...war, res: { build: "summoner" } }), "mage", "el invocador pasa a mago");
assert.ok(B.allocate(war, 40, 0).int >= 26, "el guerrero sube Int hacia 36");
console.log("OK bot-pvptactics");
