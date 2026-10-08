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
  return { damage: dice(rng, npc.cfg.attackDiceThrow, npc.cfg.attackDiceRange), hitRatio: npc.cfg.hitRatio };
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
export function applySpecial(rng, npc, kind) {
  if (kind === 1) npc.exp += Math.floor(npc.exp * 0.25);
  else if (kind === 2) npc.exp += Math.floor(npc.exp * 0.30);
  else if (kind === 3) {
    npc.absDamage = -Math.min(90, 20 + dice(rng, 1, 60));
    npc.exp += Math.floor(npc.exp * Math.abs(npc.absDamage) / 100);
  }
}
