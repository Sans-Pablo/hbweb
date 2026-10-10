// Constantes y reglas puras de los objetos (HGServer/Item.h, Game.cpp).
export const EQUIP = { NONE: 0, HEAD: 1, BODY: 2, ARMS: 3, PANTS: 4, LEGGINGS: 5, NECK: 6, LHAND: 7, RHAND: 8, TWOHAND: 9, RFINGER: 10, LFINGER: 11, BACK: 12, FULLBODY: 13 };
export const ITYPE = { NONE: 0, EQUIP: 1, APPLY: 2, USE_DEPLETE: 3, INSTALL: 4, CONSUME: 5, ARROW: 6, EAT: 7, USE_SKILL: 8, USE_PERM: 9, USE_SKILL_DLG: 10, USE_DEPLETE_DEST: 11, MATERIAL: 12 };
export const EFFECT = {
  ATTACK: 1, DEFENSE: 2, ATTACK_ARROW: 3, HP: 4, MP: 5, SP: 6, HPSTOCK: 7, GET: 8, STUDYSKILL: 9, SHOWLOCATION: 10,
  MAGIC: 11, CHANGEATTR: 12, ATTACK_MANASAVE: 13, ADDEFFECT: 14, MAGICDAMAGESAVE: 15, DYE: 17, STUDYMAGIC: 18,
  ATTACK_MAXHPDOWN: 19, ATTACK_DEFENSE: 20, FIRMSTAMINAR: 22, LOTTERY: 23, ATTACK_SPECABLTY: 24, DEFENSE_SPECABLTY: 25,
};
// Solo existen las pociones pequeñas (Red/Blue/Green): las grandes, super y power no se venden, no caen y no se pueden comprar.
export const BANNED_ITEMS = new Set([92, 94, 96, 390, 391, 840, 841, 842]);
export const GOLD = 90;               // Item.cfg: Gold
export const MAX_ITEMS = 50;          // DEF_MAXITEMS: casillas de la mochila
export const GROUND_STACK = 12;       // DEF_TILE_PER_ITEMS: objetos por casilla

// Las pociones (EAT con efecto HP/MP/SP) también se apilan: pedido de los testers (en el original salen sueltas).
export const isStack = d => d.type === ITYPE.CONSUME || d.type === ITYPE.ARROW ||
  (d.type === ITYPE.EAT && (d.effectType === EFFECT.HP || d.effectType === EFFECT.MP || d.effectType === EFFECT.SP));

// iGetItemWeight: el peso va en centésimas de "stone". El oro pesa count/20.
export function itemWeight(d, count = 1) {
  let w = d.weight;
  if (w <= 0) w = 1;
  if (d.id === GOLD) return Math.floor(w * count / 20);
  return w * count;
}

export const HEAD_POSITIONS = [EQUIP.HEAD, EQUIP.BODY, EQUIP.ARMS, EQUIP.LEGGINGS];
