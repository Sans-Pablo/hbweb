// Escuelas de magia de los summons. INVENTO del port (petición del diseñador); los hechizos son los de Magic.cfg tal cual.
//  - Orc (rojo) → Demon: fuego · Tentocle (azul) → Frost: hielo · Cannibal-Plant (celeste) → Liche: rayo.
//  - El jugador tiene los hechizos de ataque de su escuela en el libro, pero SOLO los puede lanzar con el summon de esa escuela fuera:
//    el summon los lanza y paga con SU maná (no regenera solo: se recupera con caramelos azules).
//  - Los hechizos que no atacan (curar, escudos, berserk) son del Dummy: el jugador ya no los lanza.
//  - Las demás especies son de la escuela general: solo combate, sin magia.
//  - Un summon de escuela al nivel 50 se puede cambiar en el hospital por otro de nivel 1 de la especie superior (más vida y maná).
export const SCHOOL_OF = { Orc: "fire", Demon: "fire", Tentocle: "ice", Frost: "ice", "Cannibal-Plant": "lightning", Liche: "lightning" };
export const TIER2 = { Orc: "Demon", Tentocle: "Frost", "Cannibal-Plant": "Liche" };
export const TIER2_SET = new Set(Object.values(TIER2));
export const TRADE_LEVEL = 50;
export const SCHOOL_NAMES = { fire: "Fire", ice: "Ice", lightning: "Lightning" };
export const schoolOfSpecies = sp => SCHOOL_OF[sp] || null;
export const isTier2 = sp => TIER2_SET.has(sp);
// multiplicadores de la especie superior
export const TIER_MULT = { hp: 1.5, mp: 1.6, dmg: 1.25 };
export const MP_BASE = 2;                       // los summons de escuela tienen el doble de maná (no lo regeneran)

const ATTR = { 2: "lightning", 3: "fire", 4: "ice" };            // Magic.cfg: atributo del hechizo
const OFFENSIVE = new Set([1, 3, 14, 19, 21, 22, 23, 25, 26, 28, 30]);
// Escuela de un hechizo de Magic.cfg (null = no pertenece a ninguna: tierra, sin elemento y utilidades)
export function spellSchool(sp) { return sp && OFFENSIVE.has(sp.type) ? ATTR[sp.attr] || null : null; }
// Hechizos de apoyo (curar, escudos, berserk): solo los usa el Dummy
export const isSupportSpell = sp => !!sp && (sp.type === 2 || sp.type === 11 || sp.type === 18);
// Summon de escuela fuera, vivo, del jugador
export function activeSchoolSummon(w, p, school) {
  for (const e of w.ents.values()) if (e.comp && e.master === p.id && !e.dead && SCHOOL_OF[e.name] === school) return e;
  return null;
}

// ---- nivel mínimo del summon para cada hechizo de su escuela: los hechizos que se pueden comprar de la escuela, ordenados por maná,
// se reparten entre el nivel 1 y el 50; la especie superior los desbloquea antes (80 %). Un summon al nivel máximo lanza los mejores.
const unlockCache = new WeakMap();
export function unlockLevels(magic, school) {
  let m = unlockCache.get(magic);
  if (!m) unlockCache.set(magic, (m = {}));
  if (m[school]) return m[school];
  const list = Object.entries(magic).filter(([, sp]) => spellSchool(sp) === school && sp.cost >= 0).sort((a, b) => a[1].mana - b[1].mana || a[0] - b[0]);
  const out = {};
  list.forEach(([id], i) => { out[id] = list.length < 2 ? 1 : Math.round(1 + 49 * i / (list.length - 1)); });
  return (m[school] = out);
}
export const spellLevel = (magic, school, id, species) => {
  const base = unlockLevels(magic, school)[id];
  if (base === undefined) return null;                                     // hechizo de la escuela que no se vende: no lo lanza el summon
  return isTier2(species) ? Math.max(1, Math.round(base * 0.8)) : base;
};
// daño del summon: crece con su nivel (0,6 al nivel 1 → 1,4 al 50)
export const levelPower = lvl => 0.6 + 0.8 * Math.min(50, Math.max(1, lvl)) / 50;
