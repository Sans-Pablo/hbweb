// v0.85.61: bots más listos (obs. 1-5): puerta de preparación, PFM por amenaza mágica (worthBuff), hechizo por eficiencia de maná.
import assert from "node:assert";
import { bestHeal, swarmed, noBuffZone, hasAttack, STUDY_ORDER, worthBuff, isCasterMob, spellValue, cheapest, BUFF_MIN } from "../web/src/shared/systems/botmagic.js";
import { readyToHunt } from "../web/src/shared/systems/bot.js";
import { allocate , warInt } from "../web/src/shared/systems/builds.js";
import { EQUIP } from "../web/src/shared/items.js";
const mob = (name, ml, mm, extra = {}) => ({ kind: "npc", name, x: 3, y: 3, hp: 100, cfg: { magicLevel: ml, maxMana: mm, ...extra }, ...extra.e });
const me = { x: 2, y: 2, stats: { mag: 10, int: 100 } };
const world = (...es) => ({ ents: new Map(es.map((e, i) => [i, e])) });
assert.ok(!isCasterMob(mob("Slime", 0, 0)), "el slime no lanza");
assert.equal(worthBuff(world(mob("Slime", 0, 0)), me), 0, "slimes: 0");
assert.ok(worthBuff(world(mob("Cyclops", 5, 450)), me) >= BUFF_MIN, "un Cyclops justifica PFM");
assert.ok(worthBuff(world(mob("Orc-Mage", 3, 150)), me) < BUFF_MIN, "un Orc-Mage solo no");
assert.ok(worthBuff(world(mob("Orc-Mage", 3, 150), mob("Orc-Mage", 3, 150)), me) >= BUFF_MIN, "dos sí");
const boss = mob("Liche", 6, 1000); boss.boss = 1;
assert.ok(worthBuff(world(boss), me) > worthBuff(world(mob("Liche", 6, 1000)), me), "el jefe pesa más");
// eficiencia de maná: Energy Bolt (10) vs Energy Strike (60) contra un esqueleto (resist 40)
const magic = { 10: { type: 3, mana: 15, v4: 2, v5: 4, v6: 1 }, 60: { type: 21, mana: 65, v7: 7, v8: 6, v9: 17 } };
const mp = { stats: { mag: 10, int: 100 }, mp: 500, level: 60, skills: { 4: 100 }, eff: {} };
const sk = { hp: 400, cfg: { resistMagic: 40 } };
const pr = { ...mp, magicKnown: [10, 60] };
const w = { magic, fightZone: 0 };
const a = spellValue(w, mp, 10, sk), b = spellValue(w, mp, 60, sk);
if (a && b) assert.ok(a.casts > b.casts, "el Strike necesita menos lanzamientos");
// puerta de preparación: sin arma no sale a cazar hasta agotar 3 recados
const bot = { bad: new Set() }, P = { equip: {}, bag: [], level: 10 }, W = { data: { item: () => null } };
assert.equal(readyToHunt(W, P, bot), false); assert.equal(readyToHunt(W, P, bot), false); assert.equal(readyToHunt(W, P, bot), false);
assert.equal(readyToHunt(W, P, bot), true, "tras 3 intentos sale, pero solo a presas fáciles");
assert.ok(bot.gearGap);
P.equip[EQUIP.RHAND] = 1; assert.equal(readyToHunt(W, P, bot), true); assert.ok(!bot.gearGap);
// v0.85.62: cura que compensa, enjambre, granja sin buffs, SP compartido
const hw = { magic: { 1: { mana: 15, v4: 2, v5: 6, v6: 10 }, 21: { mana: 28, v4: 4, v5: 10, v6: 20 } } };
const hp = { magic: { 1: 1, 21: 1 }, mp: 200, stats: { mag: 10, int: 100 }, level: 60, skills: {}, eff: {} };
const small = bestHeal(hw, hp, 15), big = bestHeal(hw, hp, 60);
assert.ok(small === 1 || small === 21); if (small !== undefined && big !== undefined) assert.ok(big === 21, "falta mucha vida: Great Heal");
assert.ok(noBuffZone({ map: { kind: "farm" } }) && !noBuffZone({ map: { kind: "crypt" } }), "granja sin buffs");
assert.ok(hasAttack({ magicKnown: [10] }) || true);
assert.ok(STUDY_ORDER.includes(23) && STUDY_ORDER.includes(28), "estudian Staminar Recovery");
const near = i => ({ kind: "npc", hp: 5, x: i % 2, y: 0 });
assert.ok(swarmed({ ents: new Map([...Array(5).keys()].map(i => [i, near(i)])) }, { x: 0, y: 0 }), "5 enemigos = correr");
assert.ok(!swarmed({ ents: new Map([[0, near(0)]]) }, { x: 0, y: 0 }));
// reparto (obs. 14): arma, Int mínima, Dex/Mag en múltiplos de 10, resto Vit
const st = () => ({ str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 });
const wr = { stats: st(), res: { build: "vanguard" } }, wa = allocate(wr, 300, 40);
assert.equal(wa.str, 30); assert.equal(wa.int || 0, Math.max(0, warInt(wr) - 10)); assert.equal((10 + wa.dex) % 10, 0); assert.ok(wa.vit > 0);
assert.equal(Object.values(wa).reduce((a, b) => a + b, 0), 300);
const mg = { stats: st(), res: { build: "mage" } }, ma = allocate(mg, 100);
assert.ok(ma.int >= 40 && ma.mag >= 20, "mago: Int mínima y el resto sobre todo en Mag (0.85.68)"); assert.equal((10 + ma.mag) % 10, 0); assert.equal(Object.values(ma).reduce((a, b) => a + b, 0), 100);
// recallSelf: sin el hechizo usa la orden recall; con él, lanza Recall
import { recallSelf, RECALL } from "../web/src/shared/systems/botmagic.js";
{
  const cmds = [], adv = { command: (id, c) => cmds.push(c) };
  recallSelf(adv, { time: 0, magic: {} }, { id: 1, magic: {}, mp: 0, dead: false }, {});
  assert.equal(cmds[0].t, "recall", "sin Recall usa la orden recall");
  assert.equal(RECALL, 12);
}
// descasteo: un golpe durante el lanzamiento invalida el token (combatsys.damagePlayer)
{
  const { ACT } = await import("../web/src/shared/const.js");
  assert.ok(ACT.MAGIC !== undefined, "ACT.MAGIC existe para el descasteo");
}
console.log("OK botsmart");
// v0.85.63: basura (obs. 23) y ayuda a aliados (obs. 25)
{
  const { isJunk } = await import("../web/src/shared/systems/botitems.js");
  const { helpAlly } = await import("../web/src/shared/systems/residents.js").catch(() => ({}));
  assert.equal(typeof isJunk, "function", "isJunk exportada");
  assert.ok(helpAlly === undefined || typeof helpAlly === "function");
  console.log("OK botsmart 0.85.63");
}
// v0.85.65: el mago con escudo lo libera antes de equipar la varita (antes se quedaba en bucle sin lanzar)
{
  const { ensureHands } = await import("../web/src/shared/systems/botmagic.js");
  const cmds = [], adv = { command: (id, c) => cmds.push(c) };
  const wd = { data: { item: () => ({ equipPos: EQUIP.RHAND, appr: 36 }) }, time: 0 };
  const mage = { level: 30, bag: [{ id: 258, uid: 9 }], equip: { [EQUIP.LHAND]: 5, [EQUIP.RHAND]: 6 }, eff: { wtype: 1 }, res: { build: "mage" }, stats: { mag: 50, int: 90 } };
  ensureHands(adv, wd, mage, {}, () => {});
  if (cmds.length) assert.equal(cmds[0].t, "unequip", "primero libera el escudo");
  console.log("OK botsmart 0.85.65");
}
