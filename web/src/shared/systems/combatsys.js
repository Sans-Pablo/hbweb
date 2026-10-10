// Golpes, daño, experiencia y muerte de jugadores y monstruos.
import * as Boss from "./bosses.js";
import { ACT, PLAYER, dist, dirTo } from "../const.js";
import * as R from "../rules.js";
import * as Inv from "../inventory.js";
import { EQUIP, ITYPE } from "../items.js";
import { strikeNpc, absorbOnHit } from "../combat.js";
import { gainSSN } from "../skills.js";
import { sget, sclear } from "./status.js";
import { extraWeaponWear } from "./weather.js";
import { auraDefense, auraExp, auraVamp } from "./dummy.js";

// El golpe del jugador "conecta" a mitad de la animación.
// Flechas (iCalculateAttackEffect, HGServer/Game.cpp ~52836): cada disparo con un blanco gasta una flecha del primer montón
// de la mochila (_iGetArrowItemIndex); sin flechas el arco no hace nada (_CheckAttackType: wType 0).
export const arrowOf = (w, p) => p.bag.find(i => i.count > 0 && w.data.item(i.id).type === ITYPE.ARROW);
export function useArrow(w, p) {
  const a = arrowOf(w, p);
  if (!a) return false;
  a.count--;
  if (a.count <= 0) Inv.removeFromBag(p, a.uid);
  w.emit({ t: "arrows", id: p.id, uid: a.uid, count: Math.max(0, a.count) });      // DEF_NOTIFY_SETITEMCOUNT
  w.recalc(p);                                                                       // el peso y el daño dependen de que queden flechas
  return true;
}
// Alcance de un golpe cuerpo a cuerpo: 1 casilla; 4 con el arma 845 (HGServer/Game.cpp, iClientMotion_Attack_Handler); el cliente
// también permite golpear a monstruos grandes (tipos 66, 73, 81, 91) desde 2 casillas.
export const BIG_MOBS = new Set([66, 73, 81, 91]);
export function reachOf(w, p, t) {
  if (p.eff?.bow) return Infinity;                                  // arco: el cliente manda el disparo a la casilla elegida
  const two = p.equip[EQUIP.TWOHAND], inst = two !== undefined && Inv.instOf(p, two);
  if (inst && inst.id === 845) return 4;
  return BIG_MOBS.has(t.type) ? 2 : 1;
}

export function playerHit(w, p, t) {
  if (p.dead || t.dead || dist(p, t) > reachOf(w, p, t)) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  if (p.eff?.bow && !useArrow(w, p)) return;                        // sin flechas: la animación se hace pero no hay daño ni mensaje
  const r = strikeNpc(w.rng, p, t, p.dir === t.dir, { berserk: !!sget(w, p, "berserk"), protect: sget(w, t, "protect"), bonus: weaponBonus(w, p), weather: w.weather });
  if (!r.hit) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  // desgaste del arma y experiencia de habilidad (solo con bando; los viajeros no gastan equipo)
  const skill = p.eff.wtype === 0 ? 5 : p.eff.skill;
  const lethal = t.hp - r.damage <= 0;
  if (!lethal) gainSSN(p, skill, 1);
  wearWeapon(w, p);
  damageNpc(w, t, r.damage, p, skill);
}

// ---- PvP (INVENTO del port: el original calcula el golpe contra jugadores en iCalculateAttackEffect con las mismas piezas que contra monstruos).
// Solo en mapas con `w.pvp` (Promise Land) y fuera de las zonas sin ataque. Todos los jugadores son combatientes siempre: pelean los de bandos
// distintos y también los viajeros (bando 0, sin bando) contra cualquiera; no se golpean entre sí los del mismo bando (1 o 2) ni los de la misma party.
export function canFight(w, p, t) {
  if (!w.pvp || t === p || t.kind !== "player" || p.dead || t.dead || w.safeAt(p.x, p.y) || w.safeAt(t.x, t.y)) return false;
  if (p.side > 0 && p.side === t.side) return false;
  return !(p.party && t.party && p.party.id === t.party.id);
}
export function hitPlayer(w, p, t) {
  if (p.dead || t.dead || dist(p, t) > reachOf(w, p, t) || !canFight(w, p, t)) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  if (p.eff?.bow && !useArrow(w, p)) return;
  const dummy = { cfg: { defenseRatio: t.defense, size: 0, actionLimit: 0 }, absDamage: 0 };
  const r = strikeNpc(w.rng, p, dummy, p.dir === t.dir, { berserk: !!sget(w, p, "berserk"), protect: sget(w, t, "protect"), bonus: weaponBonus(w, p), weather: w.weather });
  if (!r.hit) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  gainSSN(p, p.eff.wtype === 0 ? 5 : p.eff.skill, 1);
  wearWeapon(w, p);
  const ap = R.absorbOnPlayer(w.rng, r.damage, t.stats);
  if (ap <= 0) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  const a = absorbOnHit(w.rng, t, ap);
  for (const pos of a.parts) if (t.equip[pos] !== undefined) { wear(w, t, t.equip[pos], 1); break; }
  const wasAlive = !t.dead;
  damagePlayer(w, t, a.damage, p);
  if (wasAlive && t.dead) { p.ek = (p.ek || 0) + 1; p.kills = (p.kills || 0) + 1; w.emit({ t: "pvpkill", id: p.id, victim: t.id, name: t.name }); }
  else knockback(w, p, t, a.damage);
}

// Armas con bonificación fija (iCalculateAttackEffect): varitas de furia +1; espadón/hacha 847 de noche y 848 de día +4
// (m_cDayOrNight: 1 día, 2 noche). Las de Kloness dependen de la reputación (aún sin portar).
function weaponBonus(w, p) {
  const id = uid => { const i = uid !== undefined && Inv.instOf(p, uid); return i ? i.id : 0; };
  const right = id(p.equip[EQUIP.RHAND]), two = id(p.equip[EQUIP.TWOHAND]);
  let b = 0;
  if (right === 732 || right === 738) b += 1;
  if (two === 847 && w.dayOrNight === 2) b += 4;
  if (two === 848 && w.dayOrNight === 1) b += 4;
  return b;
}

function wearWeapon(w, p) {
  if (p.side === 0) return;
  const uid = p.equip[EQUIP.TWOHAND] ?? p.equip[EQUIP.RHAND];
  const melee = p.eff.wtype >= 1 && p.eff.wtype < 40;
  wear(w, p, uid, 1 + (melee ? extraWeaponWear(w) : 0));          // con lluvia las armas cuerpo a cuerpo se gastan más
}

// resta durabilidad; a 0 se desequipa (sigue en la mochila)
export function wear(w, p, uid, n) {
  const inst = uid !== undefined && Inv.instOf(p, uid);
  if (!inst) return;
  const d = w.data.item(inst.id);
  if (!d.maxLife) return;
  inst.life = Math.max(0, inst.life - n);
  w.emit({ t: "life", id: p.id, uid, life: inst.life });
  if (inst.life === 0) { Inv.unequip(p, w.data, uid); w.recalc(p); w.emit({ t: "broken", id: p.id, uid }); }
}

export const MAX_LEVEL = 50;
// Ritmo de experiencia (INVENTO del port, a petición del propietario: llegar al nivel máximo debe costar mucho más). La tabla de niveles es la del original;
// lo que baja es la experiencia que se gana: 70 % hasta el nivel 20 y, desde ahí, un 8 % menos por cada nivel (nivel 30: ~31 %, nivel 49: ~6 %).
export const expRate = level => 0.7 * Math.pow(0.92, Math.max(0, level - 20));
export function giveExp(w, p, amount) {
  if (amount <= 0) return;
  const ax = auraExp(w, p); if (ax) amount = Math.round(amount * (1 + ax / 100));                // aura de sabiduría del Dummy
  if (p.level >= MAX_LEVEL) { p.exp = Math.min(p.exp, p.nextExp - 1); return; }
  amount = Math.max(1, Math.round(amount * expRate(p.level)));
  p.exp += amount;
  w.emit({ t: "exp", id: p.id, amount });
  while (p.exp >= p.nextExp && p.level < MAX_LEVEL) {            // bCheckLevelUp (el original llega a 180; en esta versión el tope es 50)
    p.level++;
    p.pool += R.LEVELUP_POINTS;
    w.recalc(p);
    w.emit({ t: "levelup", id: p.id, level: p.level });
  }
}

export function damagePlayer(w, p, dmg, from, elem) {
  if (p.god) return;                                                   // herramientas de prueba: inmortal
  if (elem && p.eff?.prot?.[elem]) dmg = Math.max(0, Math.round(dmg * (100 - p.eff.prot[elem]) / 100));     // protección elemental del equipo
  if (elem) { const pf = sget(w, p, "pfm"); if (pf) dmg = Math.max(0, Math.round(dmg * (100 - pf) / 100)); }       // Protection From Magic (Dummy buffer)
  const ad = auraDefense(w, p); if (ad) dmg = Math.max(0, Math.round(dmg * (100 - ad) / 100));              // aura de defensa del Dummy
  p.hp -= dmg;
  p.lastCombat = w.time;
  w.emit({ t: "damage", id: p.id, from: from.id, amount: dmg, hp: Math.max(0, p.hp), max: p.maxHp });
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true; p.deadAt = w.time;
    w.setAct(p, ACT.DYING, PLAYER.dyingMs);
    w.grid.release(p.x, p.y, p.id);
    w.emit({ t: "death", id: p.id, by: from.id });
    deathPenalty(w, p);
    return;
  }
  if (!w.busy(p) || p.act === ACT.DAMAGE) {
    w.setAct(p, ACT.DAMAGE, PLAYER.damageMs);
    p.busyUntil = w.time + PLAYER.damageMs;
  }
}

// Retroceso (iCalculateAttackEffect, CAE_SKIPDAMAGEMOVE): un golpe físico de 40 o más empuja una casilla al jugador en
// dirección contraria al atacante (DEF_NOTIFY_DAMAGEMOVE); en zona de lucha hacen falta 60. El cliente anima DEF_OBJECTDAMAGEMOVE (4 x 24 ms).
export const KNOCK_MS = 96;
export function knockback(w, n, t, damage) {
  if (t.dead || damage < 40 || (n.x === t.x && n.y === t.y)) return;
  const d = dirTo(n.x, n.y, t.x, t.y);
  const face = t.dir, busy = t.busyUntil;
  if (w.tryStep(t, d, KNOCK_MS, ACT.DAMAGE)) { t.dir = face; t.busyUntil = Math.max(busy, t.busyUntil); t.knockAt = t.actStart; w.emit({ t: "knock", id: t.id, dir: d }); }
}

// El monstruo golpea: acierto contra la defensa del jugador, absorción por la parte del cuerpo, desgaste.
export function npcStrikes(w, n, t) {
  const miss = () => w.emit({ t: "miss", id: t.id, from: n.id });
  let { damage, hitRatio } = R.npcMelee(w.rng, n);
  const prot = sget(w, t, "protect");                                  // escudo de defensa (3) / gran escudo (4): +40 / +100 de defensa
  const defense = t.defense + (prot === 3 ? 40 : prot === 4 ? 100 : 0);
  if (R.dice(w.rng, 1, 100) > R.hitChance(hitRatio, defense, n.dir === t.dir)) return miss();
  if (sget(w, n, "berserk")) damage *= 2;                              // furia: el doble de daño
  let ap = R.absorbOnPlayer(w.rng, damage, t.stats);
  if (ap <= 0) return miss();
  const a = absorbOnHit(w.rng, t, ap);
  if (t.side !== 0) {
    if (a.shielded) wear(w, t, t.equip[EQUIP.LHAND], 1);
    for (const pos of a.parts) if (t.equip[pos] !== undefined) { wear(w, t, t.equip[pos], 1); break; }
  }
  if (a.shielded) gainSSN(t, 11, 1);
  damagePlayer(w, t, a.damage, n);
  if (a.damage > 0) Boss.onBossHit(w, n);
  knockback(w, n, t, a.damage);
  // atributos de armadura: parte del daño se convierte en maná; probabilidad de cargar un golpe crítico
  if (!t.dead && a.damage > 0 && t.eff.transMana > 0) t.mp = Math.min(t.maxMp, t.mp + Math.floor((t.eff.transMana / 100) * a.damage));
  if (!t.dead && t.eff.chargeCrit > 0 && R.dice(w.rng, 1, 100) < t.eff.chargeCrit) t.superAttack = Math.min(Math.floor(t.level / 10), (t.superAttack || 0) + 1);
}

// Contraataque (iCalculateAttackEffect): con 1/3 de probabilidad un monstruo herido se vuelve contra el atacante;
// si ya persigue a otro, solo cambia cuando el atacante está igual o más cerca.
function retarget(w, n, p) {
  if (n.cfg.actionLimit !== 0 && n.cfg.actionLimit !== undefined) return;
  if (R.dice(w.rng, 1, 3) !== 2) return;
  const cur = n.target && w.ents.get(n.target);
  if (cur && !cur.dead) {
    const d = e => (n.x - e.x) ** 2 + (n.y - e.y) ** 2;
    if (d(p) <= d(cur)) n.target = p.id;
  } else n.target = p.id;
}

export function damageNpc(w, n, dmg, p, skill, half = false) {
  dmg = Boss.mitigate(w, n, dmg, p, skill == null ? "spell" : "hit");     // jefes: escudo, clones, reflejo
  if (dmg <= 0) return;
  n.hp -= dmg;
  p.lastCombat = w.time;
  const vamp = auraVamp(w, p);                                          // Vampiric Aura del Dummy: parte del daño vuelve como vida
  if (vamp > 0 && p.hp < p.maxHp && !p.dead) { const heal = Math.max(1, Math.round(dmg * vamp / 100)); p.hp = Math.min(p.maxHp, p.hp + heal); w.emit({ t: "heal", id: p.id, amount: heal, by: p.id }); }
  w.emit({ t: "damage", id: n.id, from: p.id, amount: dmg, hp: Math.max(0, n.hp), max: n.maxHp });
  // experiencia por golpe: el daño hecho, hasta agotar los 2/3 de la experiencia del monstruo
  if (n.noDieRemainExp > 0) {
    const gain = Math.min(dmg, n.noDieRemainExp);
    n.noDieRemainExp -= gain;
    let xp = gain + (p.eff.addExp ? Math.floor((p.eff.addExp / 100) * gain) : 0);              // atributo "Experiencia +%"
    giveExp(w, p, half ? Math.floor(xp / 2) : xp);                                            // los golpes de zona dan la mitad
  }
  if (n.hp <= 0) {
    // experiencia de habilidad por matar: 1d(dados de golpe del monstruo), doble con poca vida
    if (skill != null) gainSSN(p, skill, R.dice(w.rng, 1, n.cfg.hitDice) * (p.hp <= 3 ? 2 : 1));
    return w.killNpc(n, p);
  }
  retarget(w, n, p);
  if (R.dice(w.rng, 1, 3) === 2 && !n.cfg.actionLimit) {
    n.nextAct = w.time + n.cfg.actionTime;
    if (sget(w, n, "hold")) sclear(w, n, "hold");              // un golpe libera al paralizado
  }
  if (!w.busy(n) || n.act === ACT.DAMAGE) {
    w.setAct(n, ACT.DAMAGE, n.dur.damage);
    n.busyUntil = w.time + n.dur.damage;
  }
}

// Penalización por morir (invento del port para dificultar): pierdes el 25 % de la experiencia que cuesta tu nivel y,
// si no te alcanza, bajas de nivel (con sus puntos sin repartir). Sin penalización en zonas de lucha.
export function deathPenalty(w, p) {
  if (w.fightZone) return;
  const loss = Math.floor((R.expForLevel(p.level + 1) - R.expForLevel(p.level)) * 0.25);
  const before = p.level;
  p.exp = Math.max(R.expForLevel(1), p.exp - loss);
  while (p.level > 1 && p.exp < R.expForLevel(p.level)) { p.level--; p.pool = Math.max(0, p.pool - R.LEVELUP_POINTS); }
  w.recalc(p);
  w.emit({ t: "penalty", id: p.id, loss, level: p.level, lost: before - p.level });
}
