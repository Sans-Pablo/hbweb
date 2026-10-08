// Golpes, daño, experiencia y muerte de jugadores y monstruos.
import { ACT, PLAYER, dist, dirTo } from "../const.js";
import * as R from "../rules.js";
import * as Inv from "../inventory.js";
import { EQUIP } from "../items.js";
import { strikeNpc, absorbOnHit } from "../combat.js";
import { gainSSN } from "../skills.js";
import { sget, sclear } from "./status.js";

// El golpe del jugador "conecta" a mitad de la animación.
export function playerHit(w, p, t) {
  if (p.dead || t.dead || dist(p, t) > 1) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  const r = strikeNpc(w.rng, p, t, p.dir === t.dir);
  if (!r.hit) { w.emit({ t: "miss", id: t.id, from: p.id }); return; }
  // desgaste del arma y experiencia de habilidad (solo con bando; los viajeros no gastan equipo)
  const skill = p.eff.wtype === 0 ? 5 : p.eff.skill;
  const lethal = t.hp - r.damage <= 0;
  if (!lethal) gainSSN(p, skill, 1);
  wearWeapon(w, p);
  damageNpc(w, t, r.damage, p, skill);
}

function wearWeapon(w, p) {
  if (p.side === 0) return;
  const uid = p.equip[EQUIP.TWOHAND] ?? p.equip[EQUIP.RHAND];
  wear(w, p, uid, 1);
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

export function giveExp(w, p, amount) {
  if (amount <= 0) return;
  p.exp += amount;
  w.emit({ t: "exp", id: p.id, amount });
  while (p.exp >= p.nextExp && p.level < 180) {              // bCheckLevelUp
    p.level++;
    p.pool += R.LEVELUP_POINTS;
    w.recalc(p);
    w.emit({ t: "levelup", id: p.id, level: p.level });
  }
}

export function damagePlayer(w, p, dmg, from) {
  p.hp -= dmg;
  p.lastCombat = w.time;
  w.emit({ t: "damage", id: p.id, from: from.id, amount: dmg, hp: Math.max(0, p.hp), max: p.maxHp });
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true; p.deadAt = w.time;
    w.setAct(p, ACT.DYING, PLAYER.dyingMs);
    w.grid.release(p.x, p.y, p.id);
    w.emit({ t: "death", id: p.id, by: from.id });
    return;
  }
  if (!w.busy(p) || p.act === ACT.DAMAGE) {
    w.setAct(p, ACT.DAMAGE, PLAYER.damageMs);
    p.busyUntil = w.time + PLAYER.damageMs;
  }
}

// El monstruo golpea: acierto contra la defensa del jugador, absorción por la parte del cuerpo, desgaste.
export function npcStrikes(w, n, t) {
  const miss = () => w.emit({ t: "miss", id: t.id, from: n.id });
  const { damage, hitRatio } = R.npcMelee(w.rng, n);
  if (R.dice(w.rng, 1, 100) > R.hitChance(hitRatio, t.defense, n.dir === t.dir)) return miss();
  let ap = R.absorbOnPlayer(w.rng, damage, t.stats);
  if (ap <= 0) return miss();
  const a = absorbOnHit(w.rng, t, ap);
  if (t.side !== 0) {
    if (a.shielded) wear(w, t, t.equip[EQUIP.LHAND], 1);
    for (const pos of a.parts) if (t.equip[pos] !== undefined) { wear(w, t, t.equip[pos], 1); break; }
  }
  if (a.shielded) gainSSN(t, 11, 1);
  damagePlayer(w, t, a.damage, n);
  // atributos de armadura: parte del daño se convierte en maná; probabilidad de cargar un golpe crítico
  if (!t.dead && a.damage > 0 && t.eff.transMana > 0) t.mp = Math.min(t.maxMp, t.mp + Math.floor((t.eff.transMana / 100) * a.damage));
  if (!t.dead && t.eff.chargeCrit > 0 && R.dice(w.rng, 1, 100) < t.eff.chargeCrit) t.superAttack = Math.min(Math.floor(t.level / 10), (t.superAttack || 0) + 1);
}

export function damageNpc(w, n, dmg, p, skill, half = false) {
  n.hp -= dmg;
  p.lastCombat = w.time;
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
  if (!n.target || R.dice(w.rng, 1, 3) === 2) n.target = p.id;
  if (R.dice(w.rng, 1, 3) === 2 && !n.cfg.actionLimit) {
    n.nextAct = w.time + n.cfg.actionTime;
    if (sget(w, n, "hold")) sclear(w, n, "hold");              // un golpe libera al paralizado
  }
  if (!w.busy(n) || n.act === ACT.DAMAGE) {
    w.setAct(n, ACT.DAMAGE, n.dur.damage);
    n.busyUntil = w.time + n.dur.damage;
  }
}
