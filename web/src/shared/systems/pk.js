// Criminales, reputación y contadores de muertes. Fuente: char/Client.cpp (ApplyPKPenalty, IncPKCount, DecPKCount, ApplyElo y la rama de
// muerte de jugadores en CClient::Killed) y HG.cpp (PK_KillRewardHandler, EnemyKillRewardHandler). Aquí «neutral» = viajero (side 0).
import * as R from "../rules.js";

export const MAXREWARDGOLD = 99999999, ELO_K = 16, ELO_START = 1500;        // HG.h MAXREWARDGOLD · GlobalDef.h K
export const NEUTRAL = 0;
const clampGold = v => Math.max(0, Math.min(MAXREWARDGOLD, v));
const logb = (x, b) => Math.log(x) / Math.log(b);

export function ensure(p) {
  if (p.pkCount === undefined) Object.assign(p, { pkCount: 0, reputation: 0, enemyKillCount: 0, rewardGold: 0, elo: ELO_START });
  return p;
}
// Categoría por contador (CClient::Killed): 0 inocente, 1-3 criminal, 4-11 asesino, 12+ matarife.
export const pkRank = n => n >= 12 ? "slaughterer" : n >= 4 ? "murderer" : n >= 1 ? "criminal" : "innocent";
// Objetos que suelta quien muere (ApplyCombatKilledPenalty): 1/3/6/12 según categoría.
export const penaltyLevel = n => n >= 12 ? 12 : n >= 4 ? 6 : n >= 1 ? 3 : 1;

export function incPK(w, p) {
  ensure(p); p.pkCount++;
  w.emit({ t: "pkpenalty", id: p.id, pk: p.pkCount });                          // NOTIFY_PKPENALTY
}
export function decPK(w, p) {
  ensure(p);
  if (p.pkCount > 0) { p.pkCount--; w.emit({ t: "pkpenalty", id: p.id, pk: p.pkCount }); }
}

// CClient::ApplyPKPenalty: el asesino pierde dados de experiencia y reputación; en su ciudad va a la cárcel (3 min).
export function applyPKPenalty(w, k, v) {
  ensure(k); ensure(v);
  if (k.safeAttack && k.pkCount === 0) return;
  const lose = R.dice(w.rng, Math.floor(v.level / 2) + 1, 50) + R.dice(w.rng, Math.floor(k.level / 2) + 1, 50);
  k.exp = Math.max(0, k.exp - lose);
  incPK(w, k);
  w.crimes = w.crimes || { 1: 0, 2: 0 };
  if (k.side) w.crimes[k.side] = (w.crimes[k.side] | 0) + 1;                   // m_stCityStatus[side].iCrimes++
  k.reputation -= 5;
  if (k.side !== NEUTRAL) { k.jailUntil = w.time + 3 * 60 * 1000; w.emit({ t: "jail", id: k.id, side: k.side }); }   // sideMapJail, m_iLockedMapTime = 60*3
}

// PK_KillRewardHandler: matar a un criminal paga oro de recompensa si el que mata no lo es.
export function pkKillReward(w, k, v) {
  ensure(k);
  if (k.pkCount !== 0) return;
  k.rewardGold = clampGold(k.rewardGold + v.level * 3);
  w.emit({ t: "pkcaptured", id: k.id, pk: v.pkCount | 0, level: v.level, name: v.name });
}

// ApplyElo (Client.cpp)
export function applyElo(w, a, b) {
  ensure(a); ensure(b);
  const lvl = a.level > b.level ? 1 - logb(a.level - b.level, 180) : a.level < b.level ? logb(b.level - a.level, 180) : 1;
  let E = 1 / (1 + Math.pow(10, (b.elo - a.elo) / 400));
  a.elo += lvl * ELO_K * (1 - E);
  E = 1 / (1 + Math.pow(10, (a.elo - b.elo) / 400));
  b.elo += lvl * ELO_K * (0 - E);
}

// EnemyKillRewardHandler: premio por matar a un enemigo (experiencia 1/3 de 3d(3·nivel)+nivel, oro 1d(nivel), contador si el nivel llega al umbral).
export function enemyKillReward(w, k, v, giveExp) {
  ensure(k); ensure(v);
  if (k.pkCount !== 0) return;
  const ekLevel = k.level >= 80 ? 80 : 30, lv = v.level;
  const exp = Math.floor((R.dice(w.rng, 3, 3 * lv) + lv) / 3);
  if (giveExp) giveExp(w, k, exp); else k.exp += exp;
  if (lv >= ekLevel) { k.enemyKillCount++; applyElo(w, k, v); }
  k.rewardGold = clampGold(k.rewardGold + R.dice(w.rng, 1, lv));
}

// Rama de CClient::Killed cuando mata un jugador. Devuelve cuántos objetos suelta la víctima (ApplyCombatKilledPenalty).
export function onPlayerKilled(w, k, v, giveExp) {
  ensure(k); ensure(v);
  if (k === v) return 0;
  const kn = k.side === NEUTRAL, vn = v.side === NEUTRAL;
  if (vn) { if (v.pkCount === 0) enemyKillReward(w, k, v, giveExp); else pkKillReward(w, k, v); }
  else if (kn) { if (v.pkCount === 0) enemyKillReward(w, k, v, giveExp); else applyPKPenalty(w, k, v); }
  else if (v.side === k.side) { if (v.pkCount === 0) applyPKPenalty(w, k, v); else pkKillReward(w, k, v); }
  else enemyKillReward(w, k, v, giveExp);
  if (v.pkCount === 0) return !kn && v.side === k.side ? 0 : kn ? 0 : 2;
  return penaltyLevel(v.pkCount);
}

// Quién puede atacar a quién (misma idea que IsPlayerHostile): el del mismo bando solo es atacable si es criminal.
export const hostileTo = (a, t) => a.side === NEUTRAL || t.side === NEUTRAL || a.side !== t.side || (t.pkCount | 0) > 0;
