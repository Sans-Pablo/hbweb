// Combate (iCalculateAttackEffect y compañía, HGServer/Game.cpp:52318+).
import { dice, hitChance } from "./rules.js";
import { EQUIP } from "./items.js";
import { bowHitWithWeather } from "./systems/weather.js";

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
  if (fx.hero === 1) { hit += 100; sm += 5; l += 5; }                  // m_heroArmourBonus == 1 (combat.cpp ~211): conjunto de héroe de guerrero
  return { sm: Math.max(1, sm), l: Math.max(1, l), hit };
}

// Ataque crítico («super ataque», m_bSuperAttackMode) y ataque en carrera (bIsDash). Cifras del original
// (HGServerConsole char/combat.cpp ~222-290; HG.cpp CheckClientResponseTime ~2422; client Game.cpp _iGetAttackType). Ver docs/sistemas/critico-dash.md.
// Cargas: +1 cada 13 pasadas del reloj de 3 s (contador > 12), +1 cada 15 golpes recibidos (contador > 14); tope nivel/10; el crítico exige maestría 100.
export const CRIT = { periodMs: 3000, periodTicks: 13, hitsTaken: 15, mastery: 100, dashHit: 20 };
const SKILL = { ARCHERY: 6, SHORTSWORD: 7, LONGSWORD: 8, AXE: 10, HAMMER: 14, STAFF: 21 };
// Bonos de crítico (nivel/100 del daño + los de cada habilidad) y de dash sobre el golpe {sm, l, hit} (combat.cpp: iAP_SM, iAP_L, iAttackerHitRatio).
export function critDashBonus(a, level, skill, crit, dash) {
  const up = f => { a.sm = f(a.sm); a.l = f(a.l); };
  if (crit) {
    up(v => v + Math.floor(v * (level / 100) + 0.5));
    switch (skill) {
      case SKILL.ARCHERY: case SKILL.LONGSWORD: up(v => v + Math.floor(v / 10)); a.hit += 30; break;
      case SKILL.SHORTSWORD: up(v => v * 2); break;
      case SKILL.AXE: up(v => v + Math.floor(v / 5)); break;
      case SKILL.HAMMER: up(v => v + Math.floor(v / 5)); a.hit += 20; break;
      case SKILL.STAFF: up(v => v + Math.floor(v / 5)); a.hit += 50; break;
    }
    a.hit += 100;
  }
  if (dash) {
    a.hit += CRIT.dashHit;
    if (skill === SKILL.LONGSWORD) up(v => v + Math.floor(v / 10));
    else if (skill === SKILL.AXE || skill === SKILL.HAMMER) up(v => v + Math.floor(v / 5));
  }
  return a;
}
// Tipo de ataque que el cliente manda en OBJECTATTACK (V3) y que los demás usan para dibujar: Game.cpp _iGetAttackType (~20846).
// Sin crítico: 1 (cuerpo a cuerpo), 2 (arco ≥41), 5 (StormBlade, tipo 15); con crítico: 20 puños, 21 daga/espada corta, 22 Esterk (7, 18),
// 23 espada larga (y 29, 33), 24 hacha, 25 arco, 26 martillo, 27 vara, 30 StormBlade.
export function attackType(wt, crit) {
  const w = wt | 0;
  if (w === 0) return crit ? 20 : 1;
  if (w <= 2) return crit ? 21 : 1;
  if (w < 20) return w === 7 || w === 18 ? (crit ? 22 : 1) : w === 15 ? (crit ? 30 : 5) : (crit ? 23 : 1);
  if (w < 29) return crit ? 24 : 1;
  if (w === 29 || w === 33) return crit ? 23 : 1;
  if (w >= 30 && w < 33) return crit ? 26 : 1;
  if (w >= 34 && w < 41) return crit ? 27 : 1;
  if (w >= 41) return crit ? 25 : 2;
  return 0;
}
// Golpe de un jugador a un monstruo. Devuelve {hit, damage}.
// ctx (opcional): { berserk, protect (estado del objetivo, 1..5), bonus (armas especiales) } — ver iCalculateAttackEffect.
export function strikeNpc(rng, p, n, sameDir, ctx = {}) {
  const a = playerStrike(rng, p);
  const miss = () => { p.combo = 0; return { hit: false, damage: 0 }; };
  const bow = p.eff.wtype >= 40;
  if (ctx.crit || ctx.dash) critDashBonus(a, p.level | 0, p.eff.wtype === 0 ? 5 : p.eff.skill, ctx.crit, ctx.dash);
  if (bow && ctx.protect === 1) return { hit: false, damage: 0 };                 // Protección contra flechas: la flecha se pierde sin tocar el combo
  let defense = n.cfg.defenseRatio;
  // escudo de defensa del objetivo: en el original (combat.cpp:617-659) el +40/+100 está dentro de `if (EQUIPPOS_TWOHAND != -1)` del atacante jugador (quirk): solo con arma en la casilla a dos manos
  if (!bow && p.equip?.[EQUIP.TWOHAND] !== undefined) defense += ctx.protect === 3 ? 40 : ctx.protect === 4 ? 100 : 0;
  if (bow && ctx.weather) a.hit = bowHitWithWeather(a.hit, ctx.weather);          // la lluvia estorba a los arcos
  // Orden de calculateAttackEffect (char/combat.cpp): furia x2 (697, solo attackMode<20) -> +AddPhysicalDamage (700) -> ataque cercano /2 (705) ->
  // VIT del objetivo jugador (711: -(dice(1,vit/10)-1), una tirada por cada AP) -> DarkExecutor/LightingBlade +10 (721) -> minimo 1 (734) -> tirada de acierto (742).
  let sm = a.sm + (ctx.bonus || 0), l = a.l + (ctx.bonus || 0) + (ctx.bonusL || 0);   // bonusL: Demonslayer solo daño grande (combat.cpp:566-570); ctx.bonus: anillos 732/738 +1 (propio del port)
  if (ctx.berserk && !ctx.crit) { sm *= 2; l *= 2; }
  sm += p.eff.addPhys; l += p.eff.addPhys;
  if (ctx.near) { sm = Math.trunc(sm / 2); l = Math.trunc(l / 2); }
  if (ctx.targetVit !== undefined) { sm -= dice(rng, 1, Math.floor(ctx.targetVit / 10)) - 1; l -= dice(rng, 1, Math.floor(ctx.targetVit / 10)) - 1; }
  if (ctx.dayNight10) { sm += 10; l += 10; }
  sm = Math.max(1, sm); l = Math.max(1, l);
  if (dice(rng, 1, 100) > hitChance(a.hit, defense, sameDir)) return miss();
  if ((p.hunger <= 10 || p.sp <= 0) && dice(rng, 1, 10) === 5) return miss();   // hambre o sin aliento (combat.cpp:748)
  p.combo = (p.combo || 0) + 1;
  if (p.combo > 4) p.combo = 1;
  const cb = comboBonus(p.eff.wtype === 0 ? 5 : p.eff.skill, p.combo);
  sm += cb; l += cb;
  if (p.combo > 1 && p.eff.addCD) { sm += p.eff.addCD; l += p.eff.addCD; }
  if (ctx.crit && p.eff.critBonus) { sm += p.eff.critBonus; l += p.eff.critBonus; } // ITEMSTAT_CRITICAL con carga y attackMode>=20, tras el combo (combat.cpp:765)
  if (ctx.fightZone) { sm += Math.trunc(sm / 3); l += Math.trunc(l / 3); }        // m_bIsFightZone: +1/3 (combat.cpp:781)
  if (ctx.apocalypse) { sm = Math.trunc(sm * 1.2); l = Math.trunc(l * 1.2); }      // m_bIsApocalypseMap: x1.2 (combat.cpp:787), entero como "*= 1.2" sobre int
  if (ctx.flags) { sm = Math.trunc(sm * 1.3); l = Math.trunc(l * 1.3); }           // CheckNearbyFlags: x1.3 (combat.cpp:792; Client.cpp:1371)
  if (ctx.crusadeLevel !== undefined) {                                            // atacante con crusadeDuty 1 contra jugador en cruzada (combat.cpp:797-815)
    const lv = ctx.crusadeLevel;
    const f = v => lv <= 80 ? v + v : lv <= 100 ? v + Math.trunc(v * 7 / 10) : v + Math.trunc(v / 3);
    sm = f(sm); l = f(l);
  }
  if (n.cfg.actionLimit === 1 || n.cfg.actionLimit === 2 || n.cfg.actionLimit === 6) return { hit: true, damage: 0 };   // combat.cpp:1253-1258: actionLimit 1, 2 y 6 -> return 0 (el 5 SI recibe daño, combat.cpp:1295)
  let dmg = n.cfg.size === 0 ? sm : l;
  if (n.absDamage < 0) {
    dmg = Math.floor(dmg - dmg * (Math.abs(n.absDamage) / 100));
    if (dmg < 0) dmg = 1;
  }
  return { hit: true, damage: dmg };
}

// Parte del cuerpo alcanzada y absorción de armadura y escudo cuando un monstruo golpea a un jugador.
// Devuelve { damage, part, shielded } (part = posiciones de equipo que se desgastan).
// sameDir: atacante y objetivo miran igual (cAttackerDir == cTargetDir): entonces el escudo no cuenta (combat.cpp ~907).
export function absorbOnHit(rng, p, ap, sameDir = false) {
  const fx = p.eff, A = fx.armor;
  const r = dice(rng, 1, 10000);
  let abs, parts;
  if (r <= 4999) { abs = A[EQUIP.BODY] || 0; parts = [EQUIP.BODY]; }
  else if (r <= 7499) { abs = (A[EQUIP.PANTS] || 0) + (A[EQUIP.LEGGINGS] || 0); parts = [EQUIP.PANTS, EQUIP.LEGGINGS]; }
  else if (r <= 8999) { abs = A[EQUIP.ARMS] || 0; parts = [EQUIP.ARMS]; }
  else { abs = A[EQUIP.HEAD] || 0; parts = [EQUIP.HEAD]; }
  const absArmor = Math.floor((Math.min(abs, 80) / 100) * ap);
  let absShield = 0, shielded = false;
  if (!sameDir && fx.shield > 0 && dice(rng, 1, 100) <= (p.skills[11] || 0)) {
    absShield = Math.floor((Math.min(fx.shield, 80) / 100) * (ap - absArmor));   // el escudo se calcula sobre lo que deja la armadura
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
