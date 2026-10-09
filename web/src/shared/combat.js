// Combate (iCalculateAttackEffect y compañía, HGServer/Game.cpp:52318+).
import { dice, hitChance } from "./rules.js";
import { EQUIP } from "./items.js";

// bonificación de combo por habilidad y nº de golpe seguido (___iCAB*)
const CAB = { 5: [0, 0, 0, 1, 2], 6: [0, 0, 0, 0, 0], 7: [0, 0, 1, 2, 3], 8: [0, 0, 1, 3, 5], 9: [0, 0, 2, 4, 8], 10: [0, 0, 1, 2, 3] };
export function comboBonus(skill, count) {
  if (count <= 1 || count > 6) return 0;
  const t = CAB[skill === 14 ? 6 : skill === 21 ? 10 : skill];
  return t ? t[count] || 0 : 0;
}

// Dados de ataque del jugador: pequeño/mediano y grande, y su valor de acierto.
export function playerStrike(rng, p) {
  const fx = p.eff, str = p.stats.str, dex = p.stats.dex;
  let sm, l, hit;
  if (fx.wtype === 0) {                                      // sin arma
    sm = l = Math.max(1, dice(rng, 1, Math.floor(str / 12)));
    hit = p.skills[5] || 0;
  } else if (fx.wtype < 40) {                                // cuerpo a cuerpo
    sm = dice(rng, fx.sm[0], fx.sm[1]) + fx.sm[2];
    l = dice(rng, fx.l[0], fx.l[1]) + fx.l[2];
    const k = (str / 5) / 100;
    sm = Math.floor(sm + sm * k + 0.5);
    l = Math.floor(l + l * k + 0.5);
    hit = fx.hit;
  } else {                                                   // arco
    const extra = dice(rng, 1, Math.floor(str / 20));
    sm = dice(rng, fx.sm[0], fx.sm[1]) + fx.sm[2] + extra;
    l = dice(rng, fx.l[0], fx.l[1]) + fx.l[2] + extra;
    hit = fx.hit;
  }
  hit += 50;
  if (dex > 50) hit += dex - 50;
  hit += fx.addAR;
  return { sm: Math.max(1, sm), l: Math.max(1, l), hit };
}

// Golpe de un jugador a un monstruo. Devuelve {hit, damage}.
// ctx (opcional): { berserk, protect (estado del objetivo, 1..5), bonus (armas especiales) } — ver iCalculateAttackEffect.
export function strikeNpc(rng, p, n, sameDir, ctx = {}) {
  const a = playerStrike(rng, p);
  const miss = () => { p.combo = 0; return { hit: false, damage: 0 }; };
  const bow = p.eff.wtype >= 40;
  if (bow && ctx.protect === 1) return { hit: false, damage: 0 };                 // Protección contra flechas: la flecha se pierde sin tocar el combo
  let defense = n.cfg.defenseRatio;
  if (!bow) defense += ctx.protect === 3 ? 40 : ctx.protect === 4 ? 100 : 0;     // escudo de defensa del objetivo
  if (dice(rng, 1, 100) > hitChance(a.hit, defense, sameDir)) return miss();
  if ((p.hunger <= 10 || p.sp <= 0) && dice(rng, 1, 10) === 5) return miss();   // hambre o sin aliento
  let sm = a.sm + (ctx.bonus || 0), l = a.l + (ctx.bonus || 0);
  if (ctx.berserk) { sm *= 2; l *= 2; }                                           // furia: el doble de daño (golpes normales)
  sm = Math.max(1, sm + p.eff.addPhys); l = Math.max(1, l + p.eff.addPhys);
  p.combo = (p.combo || 0) + 1;
  if (p.combo > 4) p.combo = 1;
  const cb = comboBonus(p.eff.wtype === 0 ? 5 : p.eff.skill, p.combo);
  sm += cb; l += cb;
  if (p.combo > 1 && p.eff.addCD) { sm += p.eff.addCD; l += p.eff.addCD; }
  if (n.cfg.actionLimit === 1 || n.cfg.actionLimit === 2) return { hit: true, damage: 0 };   // invulnerables
  let dmg = n.cfg.size === 0 ? sm : l;
  if (n.absDamage < 0) {
    dmg = Math.floor(dmg - dmg * (Math.abs(n.absDamage) / 100));
    if (dmg < 0) dmg = 1;
  }
  return { hit: true, damage: dmg };
}

// Parte del cuerpo alcanzada y absorción de armadura y escudo cuando un monstruo golpea a un jugador.
// Devuelve { damage, part, shielded } (part = posiciones de equipo que se desgastan).
export function absorbOnHit(rng, p, ap) {
  const fx = p.eff, A = fx.armor;
  const r = dice(rng, 1, 10000);
  let abs, parts;
  if (r <= 4999) { abs = A[EQUIP.BODY] || 0; parts = [EQUIP.BODY]; }
  else if (r <= 7499) { abs = (A[EQUIP.PANTS] || 0) + (A[EQUIP.LEGGINGS] || 0); parts = [EQUIP.PANTS, EQUIP.LEGGINGS]; }
  else if (r <= 8999) { abs = A[EQUIP.ARMS] || 0; parts = [EQUIP.ARMS]; }
  else { abs = A[EQUIP.HEAD] || 0; parts = [EQUIP.HEAD]; }
  const absArmor = Math.floor((Math.min(abs, 80) / 100) * ap);
  let absShield = 0, shielded = false;
  if (fx.shield > 0 && dice(rng, 1, 100) <= (p.skills[11] || 0)) {
    absShield = Math.floor((Math.min(fx.shield, 80) / 100) * ap);
    shielded = true;
  }
  let damage = ap - (absArmor + absShield);
  if (damage <= 0) damage = 1;
  return { damage, parts, shielded };
}

// Rango de daño (pequeño/mediano) con el arma actual, para mostrarlo en pantalla.
export function damageRange(p) {
  const fx = p.eff, str = p.stats.str;
  if (fx.wtype === 0) return [1, Math.max(1, Math.floor(str / 12))];
  const k = fx.wtype < 40 ? (str / 5) / 100 : 0;
  const ext = fx.wtype >= 40 ? Math.floor(str / 20) : 0;
  const f = x => Math.floor(x + x * k + 0.5);
  return [Math.max(1, f(fx.sm[0] + fx.sm[2]) + (ext ? 1 : 0)), Math.max(1, f(fx.sm[0] * fx.sm[1] + fx.sm[2]) + ext)];
}
