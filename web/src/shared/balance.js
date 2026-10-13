// Balance del juego (invento del port): multiplicadores editables por los administradores. Todo vale 1 por defecto = reglas del original.
// Datos en web/data/balance.json (no generado: se edita con la página web/admin/balance.html o a mano). El servidor online puede
// sobrescribirlos en caliente (saves["sys:balance"], POST /api/admin/balance). Sin DOM, sin azar: lo usa la simulación compartida.
//   global: playerMelee playerSpell monsterDmg monsterHp petDmg petHp petSkill field heal pvp spellMana
//   spells[id]: {dmg, mana} · npcs[nombre]: {dmg, hp} · pets[especie]: {dmg, hp} · petSkills[especie]: mult · schools: {hp, mp, dmg} (TIER_MULT)
import { TIER_MULT } from "./systems/schools.js";

export const GLOBAL_KEYS = ["playerMelee", "playerSpell", "monsterDmg", "monsterHp", "petDmg", "petHp", "petSkill", "field", "heal", "pvp", "spellMana"];
export const TIER_BASE = { ...TIER_MULT };                               // valores del diseño original del port (se restauran al reiniciar)
const clampN = v => { v = +v; return Number.isFinite(v) ? Math.max(0, Math.min(20, v)) : 1; };
const blank = () => ({ version: 1, global: Object.fromEntries(GLOBAL_KEYS.map(k => [k, 1])), spells: {}, npcs: {}, pets: {}, petSkills: {}, schools: { ...TIER_BASE } });

export const BAL = blank();

// Sustituye la configuración entera (los huecos quedan en 1). Devuelve la configuración limpia aplicada.
export function setBalance(src = {}) {
  const b = blank();
  for (const k of GLOBAL_KEYS) if (src.global && k in src.global) b.global[k] = clampN(src.global[k]);
  for (const sec of ["spells", "npcs", "pets"]) for (const [id, o] of Object.entries(src[sec] || {})) {
    const e = {}; for (const f of ["dmg", "hp", "mana"]) if (o && f in o && clampN(o[f]) !== 1) e[f] = clampN(o[f]);
    if (Object.keys(e).length) b[sec][id] = e;
  }
  for (const [id, v] of Object.entries(src.petSkills || {})) if (clampN(v) !== 1) b.petSkills[id] = clampN(v);
  for (const k of ["hp", "mp", "dmg"]) if (src.schools && k in src.schools) b.schools[k] = clampN(src.schools[k]);
  for (const k of Object.keys(BAL)) delete BAL[k];
  Object.assign(BAL, b);
  Object.assign(TIER_MULT, b.schools);                                    // las escuelas leen TIER_MULT directamente
  return b;
}

const g = k => BAL.global[k] ?? 1;
export const spellDmgMul = id => g("playerSpell") * (BAL.spells[id]?.dmg ?? 1);
export const spellManaMul = id => g("spellMana") * (BAL.spells[id]?.mana ?? 1);
export const fieldMul = () => g("field");
export const healMul = () => g("heal");
export const pvpMul = () => g("pvp");
export const meleeMul = () => g("playerMelee");
export const monsterDmgMul = name => g("monsterDmg") * (BAL.npcs[name]?.dmg ?? 1);
export const monsterHpMul = name => g("monsterHp") * (BAL.npcs[name]?.hp ?? 1);
export const petDmgMul = sp => g("petDmg") * (BAL.pets[sp]?.dmg ?? 1);
export const petHpMul = sp => g("petHp") * (BAL.pets[sp]?.hp ?? 1);
export const petSkillMul = sp => g("petSkill") * (BAL.petSkills[sp] ?? 1);

// Aplica un multiplicador sin tocar el valor si vale 1 (así el balance por defecto no altera ni el redondeo del original).
export const scale = (v, m, round = Math.round) => (m === 1 ? v : round(v * m));
