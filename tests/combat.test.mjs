// Fórmulas de combate contra HGServer/Game.cpp iCalculateAttackEffect (jugador -> monstruo).
import assert from "node:assert/strict";
import { strikeNpc, playerStrike, absorbOnHit, comboBonus } from "../web/src/shared/combat.js";
import { hitChance, dice, absorbOnPlayer } from "../web/src/shared/rules.js";

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };      // rng determinista: valores en [0,1)
const player = (over = {}) => ({
  stats: { str: 50, dex: 50 }, hunger: 100, sp: 50, skills: { 7: 40 }, combo: 0,
  eff: { wtype: 5, skill: 7, sm: [2, 5, 0], l: [2, 5, 0], hit: 40, addAR: 0, addPhys: 0, addCD: 0, armor: {} }, ...over,
});
const npc = (over = {}) => ({ cfg: { defenseRatio: 1, size: 1, actionLimit: 0 }, absDamage: 0, ...over });

// hitChance: (ataque / defensa) * 50 entre 15 y 99; por la espalda la defensa se reduce a la mitad
assert.equal(hitChance(100, 100, false), 50);
assert.equal(hitChance(100, 100, true), 99);
assert.equal(hitChance(1, 1000, false), 15);
assert.equal(hitChance(500, 1, false), 99);

// dados: 1 + floor(rng*r) por tirada
assert.equal(dice(seq(0.999), 1, 6), 6);
assert.equal(dice(seq(0), 3, 6), 3);

// sin arma: 1d(str/12), acierto = maestría de puños
{
  const p = player({ stats: { str: 24, dex: 50 }, eff: { ...player().eff, wtype: 0, hit: 0 }, skills: { 5: 30 } });
  const a = playerStrike(seq(0.999), p);
  assert.equal(a.sm, 2);                                  // 1d2 con 0.999 -> 2
  assert.equal(a.hit, 30 + 50);                           // +50 base, dex 50 no suma
}

// cuerpo a cuerpo: dados + bonus, luego + str/5 %
{
  const p = player();
  const a = playerStrike(seq(0.999), p);                  // 2d5 = 10, +10 % de str/5 -> 10 + 10*0.1 + 0.5 = 11
  assert.equal(a.sm, 11);
  assert.equal(a.hit, 40 + 50);
}

// golpe seguro (rng 0 acierta siempre: d100 = 1)
{
  const p = player();
  const r = strikeNpc(seq(0), p, npc(), false);
  assert.equal(r.hit, true);
  assert.ok(r.damage >= 1);
}

// furia duplica el daño; escudo de defensa del objetivo lo hace fallar con más facilidad
{
  const base = strikeNpc(seq(0.5, 0.5, 0.5, 0.5, 0), player(), npc(), false).damage;
  const rage = strikeNpc(seq(0.5, 0.5, 0.5, 0.5, 0), player(), npc(), false, { berserk: true }).damage;
  assert.ok(rage >= base * 2 - 1 && rage <= base * 2 + 1, `furia ${rage} vs ${base}`);
  // defensa 1 + 100 con ataque 90 -> (90/101)*50 = 44 %: un d100 de 60 falla, sin escudo (99 %) acierta
  const rng = () => seq(0.5, 0.5, 0.5, 0.5, 0.59)();
  const free = strikeNpc(seq(0.5, 0.5, 0.5, 0.5, 0.59), player(), npc(), false);
  const shield = strikeNpc(seq(0.5, 0.5, 0.5, 0.5, 0.59), player(), npc(), false, { protect: 4 });
  assert.equal(free.hit, true);
  assert.equal(shield.hit, false);
  void rng;
}

// protección contra flechas: el arco falla siempre, la espada no se ve afectada
{
  const bow = player({ eff: { ...player().eff, wtype: 40, bow: true } });
  assert.equal(strikeNpc(seq(0), bow, npc(), false, { protect: 1 }).hit, false);
  assert.equal(strikeNpc(seq(0), player(), npc(), false, { protect: 1 }).hit, true);
}

// bonus de arma fija (varitas de furia, espadón de día/noche) se suma antes de la furia
{
  const a = strikeNpc(seq(0.5, 0.5, 0.5, 0.5, 0), player(), npc(), false, { bonus: 4 }).damage;
  const b = strikeNpc(seq(0.5, 0.5, 0.5, 0.5, 0), player(), npc(), false).damage;
  assert.ok(a > b);
}

// daño nunca menor que 1 aunque el daño físico sea negativo
{
  const p = player(); p.eff.addPhys = -100;
  const r = strikeNpc(seq(0), p, npc(), false);
  assert.equal(r.damage, 1);
}

// combo: golpes seguidos suman bonus, un fallo lo reinicia
assert.equal(comboBonus(7, 1), 0);
assert.equal(comboBonus(7, 3), 2);
assert.equal(comboBonus(9, 4), 8);

// absorción por parte del cuerpo y tope del 80 %
{
  const p = { eff: { armor: { 1: 100 }, shield: 0 }, skills: {} };
  // BODY depende de EQUIP; rng bajo = parte 1 (cuerpo)
  const r = absorbOnHit(seq(0), p, 100);
  assert.ok(r.damage >= 1 && r.damage <= 100);
}
assert.equal(absorbOnPlayer(seq(0.999), 10, { vit: 100 }), 1);   // 10 - (1d10 - 1) = 1

console.log("OK");
