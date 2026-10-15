// Golpes, daño, experiencia y muerte de jugadores y monstruos.
import * as Boss from "./bosses.js";
import * as Bal from "../balance.js";
import { ACT, PLAYER, dist, dirTo } from "../const.js";
import * as R from "../rules.js";
import * as PK from "./pk.js";
import * as Inv from "../inventory.js";
import { EQUIP, ITYPE } from "../items.js";
import { strikeNpc, absorbOnHit, CRIT } from "../combat.js";
import { gainSSN } from "../skills.js";
import { sget, sclear } from "./status.js";
import { extraWeaponWear } from "./weather.js";
import { rollKillDrop } from "../drops.js";
import { groundPush } from "./ground.js";
import { newInst } from "./itemsys.js";
import * as Quests from "./quests.js";
import * as Farming from "./farming.js";
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
// `crit` (Alt + clic): el cliente original deja golpear de más lejos: espada larga 3, esgrima 4, StormBlade 5 (Game.cpp, _iGetAttackType / clic con Alt).
export function reachOf(w, p, t, crit) {
  if (p.eff?.bow) return Infinity;                                  // arco: el cliente manda el disparo a la casilla elegida
  const two = p.equip[EQUIP.TWOHAND], inst = two !== undefined && Inv.instOf(p, two);
  if (inst && inst.id === 845) return crit ? 5 : 4;
  if (crit && p.eff?.wtype > 0) { if (p.eff.skill === 8) return 3; if (p.eff.skill === 9) return 4; if (p.eff.skill === 10 || p.eff.skill === 14 || p.eff.skill === 21) return 2; }   // hacha, martillo, vara: absX<=2 (Game.cpp ~31018, 31052, 31090)
  return BIG_MOBS.has(t.type) ? 2 : 1;
}

// Cargas de super ataque (p.superAttack, tope nivel/10): una cada 13 pasadas del reloj de 3 s (HG.cpp ~2422, contador > 12) y una cada
// 15 golpes recibidos (combat.cpp ~1196, contador > 14); la armadura con chargeCrit suma cargas por su lado. Alt + clic gasta una carga (world.js, attack).
export function addSuperCharge(p) { p.superAttack = Math.min(Math.floor(p.level / 10), (p.superAttack || 0) + 1); }
export function chargeCritTick(w, p) {
  if (w.time - (p.tCrit ?? (p.tCrit = w.time)) < CRIT.periodMs) return;
  p.tCrit = w.time;
  if (((p.critCount = (p.critCount || 0) + 1)) >= CRIT.periodTicks) { p.critCount = 0; addSuperCharge(p); }
}
function chargeCritHit(p) { if (((p.critHits = (p.critHits || 0) + 1)) >= CRIT.hitsTaken) { p.critHits = 0; addSuperCharge(p); } }
export function playerHit(w, p, t, fx = {}) {
  if (p.dead || t.dead || dist(p, t) > reachOf(w, p, t)) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  if (t.crop) { Farming.hoe(w, p, t); return; }                       // cultivos: azada (farming.js)
  if (p.eff?.bow && !useArrow(w, p)) return;                        // sin flechas: la animación se hace pero no hay daño ni mensaje
  const r = strikeNpc(w.rng, p, t, p.dir === t.dir, { berserk: !!sget(w, p, "berserk"), protect: sget(w, t, "protect"), bonus: weaponBonus(w, p), weather: w.weather, crit: fx.crit, dash: fx.dash });
  if (!r.hit) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  if (fx.crit || fx.dash) w.emit({ t: "crit", id: p.id, target: t.id, crit: !!fx.crit, dash: !!fx.dash });
  // desgaste del arma y experiencia de habilidad (solo con bando; los viajeros no gastan equipo)
  const skill = p.eff.wtype === 0 ? 5 : p.eff.skill;
  const lethal = t.hp - r.damage <= 0;
  if (!lethal) gainSSN(p, skill, 1);
  wearWeapon(w, p);
  damageNpc(w, t, Math.max(1, Bal.scale(r.damage, Bal.meleeMul())), p, skill);
}

// ---- PvP (INVENTO del port: el original calcula el golpe contra jugadores en iCalculateAttackEffect con las mismas piezas que contra monstruos).
// Solo en mapas con `w.pvp` (Promise Land) y fuera de las zonas sin ataque. Todos los jugadores son combatientes siempre: pelean los de bandos
// distintos y también los viajeros (bando 0, sin bando) contra cualquiera; no se golpean entre sí los del mismo bando (1 o 2) ni los de la misma party.
// Client.cpp _iGetFOE: soy criminal (m_iPKCount != 0) -> todos son enemigos (también los aliados); el objetivo es criminal (STATUS_PK) -> enemigo;
// del mismo bando -> aliado (no se ataca); de bando distinto -> enemigo. Desvío del port: los viajeros (sin bando) también se pelean (en el original son neutrales)
export function isFoe(p, t) {
  if (p.pkCount > 0 || t.pkCount > 0) return true;
  return !(p.side > 0 && p.side === t.side);
}
export function canFight(w, p, t) {
  if (!w.pvp || t === p || t.kind !== "player" || p.dead || t.dead || w.safeAt(p.x, p.y) || w.safeAt(t.x, t.y)) return false;
  if (!isFoe(p, t)) return false;
  return !(p.party && t.party && p.party.id === t.party.id);
}
// Multiplicador del daño entre jugadores (invento del port): subido para que un duelo se decida en unos 15-25 golpes, no en minutos; las pets y las pociones deciden el resto.
export const PVP_DMG = 1.7;
export function hitPlayer(w, p, t, fx = {}) {
  if (p.dead || t.dead || dist(p, t) > reachOf(w, p, t) || !canFight(w, p, t)) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  if (p.eff?.bow && !useArrow(w, p)) return;
  const dummy = { cfg: { defenseRatio: t.defense, size: 0, actionLimit: 0 }, absDamage: 0 };
  const r = strikeNpc(w.rng, p, dummy, p.dir === t.dir, { berserk: !!sget(w, p, "berserk"), protect: sget(w, t, "protect"), bonus: weaponBonus(w, p), weather: w.weather, crit: fx.crit, dash: fx.dash });
  if (!r.hit) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  if (fx.crit || fx.dash) w.emit({ t: "crit", id: p.id, target: t.id, crit: !!fx.crit, dash: !!fx.dash });
  gainSSN(p, p.eff.wtype === 0 ? 5 : p.eff.skill, 1);
  wearWeapon(w, p);
  const ap = R.absorbOnPlayer(w.rng, r.damage, t.stats);
  if (ap <= 0) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  const a = absorbOnHit(w.rng, t, ap);
  a.damage = Math.max(1, Math.round(a.damage * PVP_DMG * Bal.pvpMul()));                                      // la armadura aguanta de más: sin esto los duelos duraban minutos
  for (const pos of a.parts) if (t.equip[pos] !== undefined) { wear(w, t, t.equip[pos], 1); break; }
  damagePlayer(w, t, a.damage, p);                                                             // la baja (ek) se acredita dentro de damagePlayer: vale para golpes, summons, magias y campos
  if (!t.dead) knockback(w, p, t, a.damage);
}

// Promise Land: matar a un jugador enemigo compensa el riesgo (invento del port, para fomentar el combate): recompensa en oro según su nivel y su racha
// de muertes, y su botín cae al suelo (como el de un monstruo de cripta profunda). Matar a quien lleva racha paga más.
// EK = enemy kills: muertes de jugadores de la otra ciudad. Es un contador acumulado que nunca baja; la racha que encarece la recompensa es aparte (`streak`).
function pvpCredit(w, v, from) {
  const k = from && (from.kind === "player" ? from : w.ents.get(from.id)), was = v.streak || 0;
  v.streak = 0;
  if (!w.pvp || !k || k.kind !== "player" || k === v) return;
  v.dead = false; const ok = canFight(w, k, v); v.dead = true;                                    // canFight rechaza a los muertos: se evalúa como si aún viviera
  if (!ok) return;
  k.ek = (k.ek || 0) + 1; k.kills = (k.kills || 0) + 1; k.streak = (k.streak || 0) + 1;
  w.emit({ t: "pvpkill", id: k.id, victim: v.id, name: v.name }); pvpBounty(w, k, v, was);
  const lost = PK.onPlayerKilled(w, k, v, giveExp); penaltyDrop(w, v, Math.max(1, lost));
}
// ApplyCombatKilledPenalty / PenaltyItemDrop (Client.cpp): el caído suelta al azar objetos de la mochila, puestos o no (DropItemHandler los desequipa).
// El original suelta cPenaltyLevel objetos (2 al morir a manos del bando enemigo, -1 si es menor de nivel 80); aquí 1 como mínimo, sin oro ni bolas de compañero.
export function penaltyDrop(w, v, n = 1) {
  for (let i = 0; i < n; i++) {
    const list = v.bag.filter(it => !it.comp && it.id !== 90);
    if (!list.length) return;
    const it = list[Math.floor(w.rng() * list.length)], worn = Object.values(v.equip).includes(it.uid);
    const out = Inv.removeFromBag(v, it.uid);
    groundPush(w, v.x, v.y, out, true);
    w.emit({ t: "penaltydrop", id: v.id, item: out.id, worn });
  }
  w.recalc(v);
}
export function pvpBounty(w, k, v, streak = 0) {
  const gold = Math.min(6000, Math.floor((150 + v.level * 45) * (1 + Math.min(5, streak) * 0.25)));
  k.gold = (k.gold || 0) + gold;
  w.emit({ t: "bounty", id: k.id, victim: v.name, gold });
  const base = w.npcDb.Troll;
  if (!base) return;
  const drop = rollKillDrop(w.rng, { type: base.type, cfg: base }, { rating: k.rating || 0, data: w.data, depth: 8 });
  if (drop && w.data.item(drop.id)) groundPush(w, v.x, v.y, newInst(w, drop.id, drop.count, drop), true);
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
// RITMO DE LAS QUESTS (0.63.0): factor global medido con los habitantes (tools/questsim.mjs) para que el nivel 50 cueste de verdad.
export const PACE = 0.3;
export const expRate = level => PACE * 0.7 * Math.pow(0.92, Math.max(0, level - 20));
export function giveExp(w, p, amount) {
  if (amount <= 0) return;
  const ax = auraExp(w, p); if (ax) amount = Math.round(amount * (1 + ax / 100));                // aura de sabiduría del Dummy
  if (p.level >= MAX_LEVEL) { p.exp = Math.min(p.exp, p.nextExp - 1); return; }
  amount = Math.max(1, Math.round(amount * expRate(p.level)));
  p.exp += amount;
  w.emit({ t: "exp", id: p.id, amount });
  while (p.exp >= p.nextExp && p.level < MAX_LEVEL) {            // bCheckLevelUp (el original llega a 180; en esta versión el tope es 50)
    p.level++;
    const pay = Math.min(p.lvDebt | 0, R.LEVELUP_POINTS); p.lvDebt = (p.lvDebt | 0) - pay;
    p.pool += R.LEVELUP_POINTS - pay;
    w.recalc(p);
    w.emit({ t: "levelup", id: p.id, level: p.level });
  }
  Quests.onLevel(w, p);
}

// Combat.cpp (char/combat.cpp ~1186 jugador, ~1476 NPC): un golpe libera Hold Person (tipo 1); Paralyze (tipo 2) NO se libera al jugador y al NPC solo si tiene
// más de 50 dados de golpe y sale 1d10==5. Nunca se libera por una tirada de 1/3.
// any = daño mágico: HG.cpp Effect_Damage_Spot (~18307/18456/18834/18917) y campos de fuego/veneno (~19351/19570) sueltan cualquier Hold,
// también Paralyze; el golpe físico (combat.cpp ~1186/~1476) y la tormenta de hielo (~19451) solo sueltan Hold Person.
export function releaseHold(w, t, any = false) {
  const h = sget(w, t, "hold"); if (!h) return;
  if (any) { sclear(w, t, "hold"); return; }
  if (h === 1 || h.v === 1) sclear(w, t, "hold");
  else if (t.kind === "npc" && (t.cfg.hitDice | 0) > 50 && R.dice(w.rng, 1, 10) === 5) sclear(w, t, "hold");
}
export function damagePlayer(w, p, dmg, from, elem) {
  if (p.god) return;                                                   // herramientas de prueba: inmortal
  if (elem && p.eff?.prot?.[elem]) dmg = Math.max(0, Math.round(dmg * (100 - p.eff.prot[elem]) / 100));     // protección elemental del equipo
  if (elem) { const pf = sget(w, p, "pfm"); if (pf) dmg = Math.max(0, Math.round(dmg * (100 - pf) / 100)); }       // Protection From Magic (Dummy buffer)
  const ad = auraDefense(w, p); if (ad) dmg = Math.max(0, Math.round(dmg * (100 - ad) / 100));              // aura de defensa del Dummy
  { const ab = sget(w, p, "armorbreak"); if (ab) dmg = Math.round(dmg * (100 + ab) / 100); }          // Armor Break psíquico
  p.hp -= dmg;
  p.lastCombat = w.time;
  releaseHold(w, p, !!elem && elem !== "ice");
  if (dmg > 0 && !p.dead) chargeCritHit(p);
  w.emit({ t: "damage", id: p.id, from: from.id, amount: dmg, hp: Math.max(0, p.hp), max: p.maxHp });
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true; p.deadAt = w.time;
    w.setAct(p, ACT.DYING, PLAYER.dyingMs);
    w.grid.release(p.x, p.y, p.id);
    w.emit({ t: "death", id: p.id, by: from.id });
    deathPenalty(w, p);
    pvpCredit(w, p, from);
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
  damage = Math.max(1, Bal.scale(damage, Bal.monsterDmgMul(n.name)));
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
  if (!t.dead && t.eff.chargeCrit > 0 && R.dice(w.rng, 1, 100) < t.eff.chargeCrit) addSuperCharge(t);
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
  { const ab = sget(w, n, "armorbreak"); if (ab) dmg = Math.round(dmg * (100 + ab) / 100); }          // Armor Break psíquico: más daño recibido
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
  }
  releaseHold(w, n, skill == null);                                      // skill null = hechizo
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
  while (p.level > 1 && p.exp < R.expForLevel(p.level)) {
    p.level--;
    const take = Math.min(p.pool, R.LEVELUP_POINTS); p.pool -= take;
    p.lvDebt = (p.lvDebt | 0) + R.LEVELUP_POINTS - take;                 // puntos ya repartidos: no se quitan, pero los próximos niveles los pagan primero (si no, subir y bajar regalaba stats)
  }
  w.recalc(p);
  w.emit({ t: "penalty", id: p.id, loss, level: p.level, lost: before - p.level });
}
