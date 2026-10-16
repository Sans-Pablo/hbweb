// Estado de guerra y detalles de combate.cpp/HG.cpp: Apocalypse x1.2 (combat.cpp:787), banderas Heldenian x1.3 (:792), Crusade duty 1 (:797-815),
// ataque cercano /2 (:705), VIT antes de la tirada (:711), anillos 335/337 (HG.cpp:18211/18702) e inmunidad de habilidad especial 50/51/52 (combat.cpp:995).
import assert from "node:assert/strict";
import { strikeNpc } from "../web/src/shared/combat.js";
import { absorbOnPlayer } from "../web/src/shared/rules.js";
import { magicDamageSave, specialAbilityHit, strikeCtx, nearFlag } from "../web/src/shared/systems/combatsys.js";
import { EQUIP } from "../web/src/shared/items.js";

const rng = () => 0;
const mk = () => ({ combo: 0, hunger: 100, sp: 100, level: 1, stats: { str: 10, dex: 10 }, skills: {}, eff: { wtype: 0, skill: 5, sm: [0, 0, 0], l: [0, 0, 0], addPhys: 0, addCD: 0, addAR: 0, critBonus: 0, hero: 0 } });
const npc = { cfg: { defenseRatio: 0, size: 0, actionLimit: 0 }, absDamage: 0 };
const dmg = ctx => strikeNpc(rng, mk(), npc, false, { bonus: 29, ...ctx }).damage;

assert.equal(dmg({}), 30);
assert.equal(dmg({ apocalypse: true }), 36, "apocalypse x1.2 truncado");
assert.equal(dmg({ flags: true }), 39, "banderas x1.3 truncado");
assert.equal(dmg({ crusadeLevel: 50 }), 60, "crusade nivel <= 80: x2");
assert.equal(dmg({ crusadeLevel: 80 }), 60);
assert.equal(dmg({ crusadeLevel: 90 }), 51, "nivel <= 100: +70 %");
assert.equal(dmg({ crusadeLevel: 120 }), 40, "mas de 100: +1/3");
assert.equal(dmg({ near: true }), 15, "ataque cercano: mitad");
assert.equal(dmg({ targetVit: 5 }), 31, "vit < 10: dice() = 0 y el daño sube 1");
assert.equal(dmg({ targetVit: 50 }), 30, "vit 50 con tirada 1: sin cambio");
assert.equal(absorbOnPlayer(rng, 10, { vit: 5 }), 11, "absorbOnPlayer con vit < 10 suma 1");

// VIT antes de la tirada: con vit alta y un golpe mínimo, el daño llega a 0 -> el clamp (>=1 jugador) ocurre antes del acierto
const hi = strikeNpc(() => 0.99, mk(), npc, false, { bonus: 0, targetVit: 200 });
assert.ok(hi.damage >= 0);

// Estado del mundo apagado por defecto y strikeCtx
const w = { crusade: false, apocalypse: false, heldenian: null, time: 0 };
const p = { kind: "player", level: 50, crusadeDuty: 1, x: 5, y: 5, side: 1, dir: 1, equip: {}, bag: [], eff: {} }, t = { kind: "player", x: 6, y: 5, vit: 5, stats: { vit: 5 } };
let c = strikeCtx(w, p, t, {});
assert.ok(!c.apocalypse && !c.flags && c.crusadeLevel === undefined, "apagado por defecto");
w.apocalypse = true; w.crusade = true;
c = strikeCtx(w, p, t, {});
assert.ok(c.apocalypse); assert.equal(c.crusadeLevel, 50);
c = strikeCtx(w, p, { kind: "npc", x: 6, y: 5 }, {});
assert.equal(c.crusadeLevel, undefined, "la cruzada solo cuenta contra jugadores");
c = strikeCtx(w, { ...p, crusadeDuty: 2 }, t, {});
assert.equal(c.crusadeLevel, undefined, "solo duty 1");
assert.equal(nearFlag({ heldenian: null }, p), false);

// Anillos 335/337
const items = { 335: { effectType: 15, maxLife: 300 }, 337: { effectType: 15, maxLife: 300 }, 9: { effectType: 1 } };
const mkW = () => ({ data: { item: id => items[id] }, emitted: [], emit(e) { this.emitted.push(e); }, recalc() {} });
const ring = (id, life) => ({ kind: "player", id: "t", equip: { [EQUIP.LFINGER ?? 8]: "r" }, bag: [{ uid: "r", id, life }], eff: {}, stats: { str: 10, dex: 10, vit: 10, int: 10, mag: 10, chr: 10 }, skills: {}, level: 1 });
let tg = ring(335, 100); let ww = mkW();
assert.equal(magicDamageSave(ww, tg, 10), 8, "335: -20 %");
assert.equal(tg.bag[0].life, 92, "el anillo pierde vida igual al daño tras reducir");
tg = ring(337, 100);
assert.equal(magicDamageSave(mkW(), tg, 10), 9, "337: -10 %");
assert.equal(tg.bag[0].life, 91);
tg = ring(335, 5); ww = mkW();
assert.equal(magicDamageSave(ww, tg, 10), 8);
assert.equal(tg.bag[0].life, 0); assert.ok(ww.emitted.some(e => e.t === "broken"), "vida <= daño: se agota");
assert.equal(Object.keys(tg.equip).length, 0, "el anillo agotado se suelta");
assert.equal(magicDamageSave(mkW(), { kind: "player", equip: {}, bag: [], eff: {} }, 10), 10, "sin anillo: igual");

// Habilidad especial del objetivo
const att = { kind: "player", id: "a", equip: { [EQUIP.RHAND]: "s" }, bag: [{ uid: "s", id: 9, life: 50 }], eff: {}, stats: { str: 10, dex: 10, vit: 10, int: 10, mag: 10, chr: 10 }, skills: {}, level: 1 };
assert.equal(specialAbilityHit(mkW(), att, { saActive: false, saType: 52 }, []), false, "inactiva: nada");
assert.equal(specialAbilityHit(mkW(), att, { saActive: true, saType: 52 }, []), true, "52: anula");
assert.equal(specialAbilityHit(mkW(), att, { saActive: true, saType: 51, saEquipPos: 3 }, [3]), true, "51: pieza coincide");
assert.equal(specialAbilityHit(mkW(), att, { saActive: true, saType: 51, saEquipPos: 3 }, [4]), false, "51: otra pieza");
assert.equal(specialAbilityHit(mkW(), { kind: "npc" }, { saActive: true, saType: 52 }, []), false, "solo si atacan jugadores");
specialAbilityHit(mkW(), att, { saActive: true, saType: 50 }, []);
assert.equal(att.bag[0].life, 0, "50: el arma del atacante se queda sin vida");
console.log("OK");
