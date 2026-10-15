// Habilidades (Skill.cfg, CalculateSSN_*): maestría 0..100 que sube con el uso.
export const SKILL = {
  MINING: 0, FISHING: 1, FARMING: 2, MAGIC_RES: 3, MAGIC: 4, HAND: 5, ARCHERY: 6, SHORT_SWORD: 7, LONG_SWORD: 8,
  FENCING: 9, AXE: 10, SHIELD: 11, ALCHEMY: 12, MANUFACTURING: 13, HAMMER: 14, PRETEND_CORPSE: 19, STAFF: 21, POISON_RES: 23,
};
export const SKILL_NAMES = {
  0: "Minería", 1: "Pesca", 2: "Agricultura", 3: "Resistencia mágica", 4: "Magia", 5: "Ataque sin armas", 6: "Arquería",
  7: "Espada corta", 8: "Espada larga", 9: "Esgrima", 10: "Hacha", 11: "Escudo", 12: "Alquimia", 13: "Fabricación",
  14: "Martillo", 19: "Fingir muerte", 21: "Bastón", 23: "Resistencia al veneno",
};
export const MAX_TOTAL_MASTERY = 900;           // combat.h MAXSKILLPOINTS (CheckTotalSkillMasteryPoints, Client.cpp:460)

// _iCalcSkillSSNpoint (HG.cpp:15004): hasta 50 vale el nivel; por encima, nivel*nivel/10.
export const ssnTable = L => (L < 1 ? 1 : L <= 50 ? L : Math.floor((L * L) / 10));
// GetSkillMultiplier (Shared/Skilltypes.h:30): cada punto de uso cuenta x8 (combate, magia, resistencias, fingir muerte), x2 (minería, pesca,
// agricultura, alquimia, fabricación) o x1 (el resto) — Client.cpp:806 SkillUp.
const MULT8 = [4, 5, 6, 7, 8, 9, 10, 14, 21, 19, 3, 11, 23];
const MULT2 = [2, 13, 12, 0, 1];
export const skillMultiplier = skill => (MULT8.includes(skill) ? 8 : MULT2.includes(skill) ? 2 : 1);

// tope de maestría según el atributo que la limita
function cap(p, skill) {
  const s = p.stats;
  switch (skill) {
    case 0: case 5: case 13: return s.str * 2;
    case 3: return p.level * 2;
    case 4: case 21: return s.mag * 2;
    case 1: case 6: case 7: case 8: case 9: case 10: case 11: case 14: return s.dex * 2;
    case 2: case 12: case 15: case 19: return s.int * 2;
    case 23: return s.vit * 2;
    default: return 100;
  }
}

// Suma `v` puntos de experiencia de habilidad. Devuelve true si sube un nivel de maestría.
export function gainSSN(p, skill, v) {
  const m = p.skills[skill] || 0;
  if (m <= 0 || v <= 0) return false;                       // sin maestría inicial no hay progreso
  const before = p.ssn[skill] || 0;
  v *= skillMultiplier(skill);
  let ssn = before + v;
  if (m < 100 && ssn > ssnTable(m + 1)) {
    if (m + 1 > cap(p, skill)) { p.ssn[skill] = before; return false; }
    p.skills[skill] = m + 1;
    p.ssn[skill] = 0;
    return true;
  }
  p.ssn[skill] = ssn;
  return false;
}
