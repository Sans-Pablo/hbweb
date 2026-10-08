// Mochila, equipo y efectos del equipo (CalcTotalItemEffect, bEquipItemHandler...).
// Un jugador tiene:  p.bag = [{uid, id, count, life}]   p.equip = {posición: uid}
import { EQUIP, ITYPE, EFFECT, GOLD, MAX_ITEMS, isStack, itemWeight } from "./items.js";

export const instOf = (p, uid) => p.bag.find(i => i.uid === uid);
export const isEquipped = (p, uid) => Object.values(p.equip).includes(uid);

export function totalWeight(p, data) {
  let w = itemWeight(data.item(GOLD), p.gold || 0);
  for (const i of p.bag) { const d = data.item(i.id); w += itemWeight(d, isStack(d) ? i.count : 1); }
  return w;
}
export const maxLoad = p => p.stats.str * 500 + p.level * 500;
export function canCarry(p, data, def, count = 1) {
  return totalWeight(p, data) + itemWeight(def, isStack(def) ? count : 1) <= maxLoad(p);
}

// Mete un objeto en la mochila (los apilables se juntan por id). Devuelve false si no cabe.
export function addToBag(p, data, inst) {
  const d = data.item(inst.id);
  if (inst.id === GOLD) { p.gold += inst.count; return true; }
  if (isStack(d)) {
    const same = p.bag.find(i => i.id === inst.id);
    if (same) { same.count += inst.count; return true; }
  }
  if (p.bag.length >= MAX_ITEMS) return false;
  p.bag.push(inst);
  return true;
}

export function removeFromBag(p, uid) {
  const i = p.bag.findIndex(x => x.uid === uid);
  if (i < 0) return null;
  for (const pos of Object.keys(p.equip)) if (p.equip[pos] === uid) delete p.equip[pos];
  return p.bag.splice(i, 1)[0];
}

export function release(p, pos) { const uid = p.equip[pos]; delete p.equip[pos]; return uid; }

// bEquipItemHandler. Devuelve { ok, why, released: [uid...] }. Los objetos soltados siguen en la mochila.
export function equip(p, data, uid) {
  const out = { ok: false, why: "", released: [] };
  const inst = instOf(p, uid), d = inst && data.item(inst.id);
  const rel = pos => { const u = release(p, pos); if (u !== undefined) out.released.push(u); };
  if (!d || d.type !== ITYPE.EQUIP || inst.life === 0) { out.why = "no se puede equipar"; return out; }
  if (d.levelLimit > p.level) { out.why = "nivel " + d.levelLimit + " necesario"; return out; }
  if (d.gender === 1 && p.gender !== 1) { out.why = "solo para hombres"; return out; }
  if (d.gender === 2 && p.gender !== 2) { out.why = "solo para mujeres"; return out; }
  const w = itemWeight(d, 1);
  if (w > p.stats.str * 100) { out.why = "demasiado pesado (fuerza " + Math.ceil(w / 100) + ")"; return out; }
  const pos = d.equipPos;
  // requisito de atributo de cascos y armaduras (v4 = atributo, v5 = mínimo); si falla, se suelta lo que haya puesto
  if (pos === EQUIP.HEAD || pos === EQUIP.BODY || pos === EQUIP.ARMS || pos === EQUIP.LEGGINGS) {
    const stat = { 10: "str", 11: "dex", 12: "vit", 13: "int", 14: "mag", 15: "chr" }[d.v4];
    if (stat && p.stats[stat] < d.v5) { rel(pos); out.why = stat.toUpperCase() + " " + d.v5 + " necesario"; recalc(p, data); return out; }
  }
  if (d.id === 845 && p.stats.int < 65) { out.why = "INT 65 necesario"; return out; }
  if (pos === EQUIP.NONE) { out.why = "no se puede equipar"; return out; }
  // un solo objeto con habilidad especial equipado a la vez
  if (d.effectType === EFFECT.ATTACK_SPECABLTY || d.effectType === EFFECT.DEFENSE_SPECABLTY)
    for (const [ps, u] of Object.entries(p.equip)) {
      const o = data.item(instOf(p, u)?.id);
      if (o && +ps !== pos && (o.effectType === EFFECT.ATTACK_SPECABLTY || o.effectType === EFFECT.DEFENSE_SPECABLTY)) rel(+ps);
    }
  // conflictos de casilla
  switch (pos) {
    case EQUIP.TWOHAND:
      if (p.equip[EQUIP.TWOHAND] !== undefined) rel(EQUIP.TWOHAND); else { rel(EQUIP.RHAND); rel(EQUIP.LHAND); }
      break;
    case EQUIP.LHAND: case EQUIP.RHAND:
      rel(EQUIP.TWOHAND); rel(pos); break;
    case EQUIP.FULLBODY:
      for (const q of [EQUIP.FULLBODY, EQUIP.HEAD, EQUIP.BODY, EQUIP.ARMS, EQUIP.LEGGINGS, EQUIP.PANTS, EQUIP.BACK]) rel(q);
      break;
    case EQUIP.HEAD: case EQUIP.BODY: case EQUIP.ARMS: case EQUIP.LEGGINGS: case EQUIP.PANTS: case EQUIP.BACK:
      rel(EQUIP.FULLBODY); rel(pos); break;
    default: rel(pos);
  }
  p.equip[pos] = uid;
  out.ok = true;
  recalc(p, data);
  return out;
}

export function unequip(p, data, uid) {
  for (const pos of Object.keys(p.equip)) if (p.equip[pos] === uid) { delete p.equip[pos]; recalc(p, data); return true; }
  return false;
}

// CalcTotalItemEffect: todo lo que el equipo cambia en el combate
export function recalc(p, data) {
  const s = p.stats;
  const fx = {
    sm: [0, 0, 0], l: [0, 0, 0], hit: 0, skill: 5, wtype: 0, speedNib: 0, bow: false,
    defense: s.dex * 2, shield: 0, armor: {}, addPhys: 0, addAR: 0, manaSave: 0, resistMagic: 0,
  };
  if (p.equip[EQUIP.TWOHAND] !== undefined) delete p.equip[EQUIP.RHAND];        // el arma a dos manos manda
  for (const [ps, uid] of Object.entries(p.equip)) {
    const pos = +ps, inst = instOf(p, uid), d = inst && data.item(inst.id);
    if (!d) continue;
    switch (d.effectType) {
      case EFFECT.ATTACK: case EFFECT.ATTACK_MANASAVE: case EFFECT.ATTACK_MAXHPDOWN: case EFFECT.ATTACK_DEFENSE: case EFFECT.ATTACK_SPECABLTY:
        fx.sm = [d.v1, d.v2, d.v3]; fx.l = [d.v4, d.v5, d.v6];
        fx.skill = d.skill; fx.hit = p.skills[d.skill] || 0; fx.wtype = d.appr;
        if (d.effectType === EFFECT.ATTACK_MANASAVE) fx.manaSave = Math.min(80, fx.manaSave + d.v4);
        if (d.effectType === EFFECT.ATTACK_DEFENSE) fx.armor[EQUIP.BODY] = (fx.armor[EQUIP.BODY] || 0) + d.specialEffect;
        break;
      case EFFECT.ATTACK_ARROW: {
        const arrows = p.bag.find(i => data.item(i.id).type === ITYPE.ARROW && i.count > 0);
        if (arrows) { fx.sm = [d.v1, d.v2, d.v3]; fx.l = [d.v4, d.v5, d.v6]; }
        fx.skill = d.skill; fx.hit = p.skills[d.skill] || 0; fx.wtype = d.appr; fx.bow = true;
        break;
      }
      case EFFECT.DEFENSE: case EFFECT.DEFENSE_SPECABLTY:
        fx.defense += d.v1;
        if (pos === EQUIP.LHAND) fx.shield = d.v1 - Math.floor(d.v1 / 3);
        else fx.armor[pos] = (fx.armor[pos] || 0) + d.v2;
        break;
      case EFFECT.ADDEFFECT:
        if (d.v1 === 1) fx.resistMagic += d.v2;
        else if (d.v1 === 2) fx.manaSave = Math.min(80, fx.manaSave + d.v2);
        else if (d.v1 === 3) fx.addPhys += d.v2;
        else if (d.v1 === 4) fx.defense += d.v2;
        else if (d.v1 === 12) fx.addAR += d.v2;
        break;
    }
    if (pos === EQUIP.RHAND || pos === EQUIP.TWOHAND) fx.speedNib = Math.max(0, d.speed - Math.floor(s.str / 13));
  }
  p.eff = fx;
  p.defense = fx.defense;
  return fx;
}
