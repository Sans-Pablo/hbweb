// Fórmulas del servidor original (HGServer/Game.cpp). Funciones puras: reciben el
// generador aleatorio para poder reproducir combates en pruebas.

// iDice(n, r): suma de n tiradas de 1..r. Con r <= 0 devuelve 0.
export function dice(rng, n, r) {
  if (r <= 0 || n <= 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += 1 + Math.floor(rng() * r);
  return s;
}

// --- personaje -----------------------------------------------------------------
// iGetMaxHP / iGetMaxMP / iGetMaxSP
export const maxHP = c => c.vit * 3 + c.level * 2 + Math.floor(c.str / 2);
export const maxMP = c => 2 * c.mag + 2 * c.level + Math.floor(c.int / 2);
export const maxSP = c => 2 * c.str + 2 * c.level;
// CalcTotalItemEffect: defensa = destreza x 2 (más armaduras)
export const defenseRatio = c => c.dex * 2;

// iGetLevelExp(n) = iGetLevelExp(n-1) + n * (50 + n * (n/17)^2)   (división entera)
const levelExp = [0];
for (let n = 1; n <= 200; n++) {
  const k = Math.floor(n / 17);
  levelExp[n] = levelExp[n - 1] + n * (50 + n * k * k);
}
export const expForLevel = n => levelExp[Math.min(n, 200)];

export const LEVELUP_POINTS = 3;           // bCheckLevelUp: m_iLU_Pool += 3
export const STAT_LIMIT = 200;             // DEF_CHARPOINTLIMIT (habitual en 3.51)

// --- combate --------------------------------------------------------------------
export const MIN_HIT = 15, MAX_HIT = 99;   // DEF_MINIMUMHITRATIO / DEF_MAXIMUMHITRATIO

// Probabilidad de acierto: (ataque / defensa) * 50, entre 15 y 99.
// Si el atacante mira en la misma dirección que el objetivo (le ataca por la espalda),
// la defensa se reduce a la mitad.
export function hitChance(attackRatio, defense, fromBehind) {
  let dr = fromBehind ? Math.floor(defense / 2) : defense;
  if (dr < 1) dr = 1;
  const p = Math.floor((attackRatio / dr) * 50);
  return Math.max(MIN_HIT, Math.min(MAX_HIT, p));
}

// Ataque de un monstruo: dados de ataque del NPC.cfg y su "HR".
export function npcMelee(rng, npc) {
  return { damage: Math.ceil(dice(rng, npc.cfg.attackDiceThrow, npc.cfg.attackDiceRange) * (npc.dmgMul || 1)), hitRatio: npc.cfg.hitRatio };
}

// Daño que recibe un jugador: se resta 1d(vitalidad/10) - 1.
export function absorbOnPlayer(rng, dmg, c) {
  const v = Math.floor(c.vit / 10);
  if (v > 0) dmg -= dice(rng, 1, v) - 1;
  return Math.max(0, dmg);
}

// --- monstruos ------------------------------------------------------------------
// _bInitNpcAttr
export function npcHP(rng, hd) {
  const hp = hd <= 5 ? dice(rng, hd, 4) + hd : hd * 4 + hd + dice(rng, 1, hd);
  return hp || 1;
}
export function npcExp(rng, cfg) {
  return dice(rng, 1, cfg.expMax - cfg.expMin) + cfg.expMin;
}
// Monstruos especiales: tipo 1 = +25 % exp, 2 = +30 % exp, 3 = absorbe daño físico.
// bCreateNewNpc (Game.cpp ~16418): habilidad especial del monstruo y su bonus de experiencia.
// 1 (+25 %, ve invisibles), 2 (+30 %), 3 absorbe daño físico, 4 absorbe daño mágico, 5 (+15 %), 6 (+20 %), 7 explota al morir (Fire Strike, +20 %), 8 explota al morir (Mass Fire Strike, +25 %).
// Devuelve la habilidad que queda (3 y 4 se anulan si el monstruo ya absorbe del otro tipo).
const SPECIAL_EXP = { 1: 25, 2: 30, 5: 15, 6: 20, 7: 20, 8: 25 };
export function applySpecial(rng, npc, kind) {
  if (SPECIAL_EXP[kind]) npc.exp += Math.floor(npc.exp * SPECIAL_EXP[kind] / 100);
  else if (kind === 3) {
    if (npc.absDamage > 0) return 0;
    npc.absDamage = Math.max(-90, npc.absDamage - (20 + dice(rng, 1, 60)));
    npc.exp += Math.floor(npc.exp * Math.abs(npc.absDamage) / 100);
  } else if (kind === 4) {
    if (npc.absDamage < 0) return 0;
    npc.absDamage = Math.min(90, npc.absDamage + 20 + dice(rng, 1, 60));
    npc.exp += Math.floor(npc.exp * npc.absDamage / 100);
  }
  return kind;
}
