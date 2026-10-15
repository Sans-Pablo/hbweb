// Escuelas de magia de los summons. INVENTO del port (petición del diseñador); los hechizos son los de Magic.cfg tal cual.
//  - Las cadenas base → evolución y su escuela salen de evolutions.js (tabla única): hoy Orc → Demon fuego · Tentocle → Beholder hielo · Skeleton → Liche rayo.
//  - El jugador tiene los hechizos de ataque de su escuela en el libro, pero SOLO los puede lanzar con el summon de esa escuela fuera:
//    el summon los lanza y paga con SU maná (no regenera solo: se recupera con caramelos azules).
//  - Los hechizos que no atacan (curar, escudos, berserk) son del Dummy: el jugador ya no los lanza.
//  - Las demás especies son de la escuela general: solo combate, sin magia.
//  - Un summon de escuela al nivel 50 se puede cambiar en el hospital por otro de nivel 1 de la especie superior (más vida y maná).
import { SCHOOL_OF, TIER2, TIER2_SET } from "./evolutions.js";
export { SCHOOL_OF, TIER2, TIER2_SET };
export const TRADE_LEVEL = 50;
export const SCHOOL_NAMES = { fire: "Fire", ice: "Ice", lightning: "Lightning" };
export const schoolOfSpecies = sp => SCHOOL_OF[sp] || null;
export const isTier2 = sp => TIER2_SET.has(sp);
// multiplicadores de la especie superior
export const TIER_MULT = { hp: 1.5, mp: 1.6, dmg: 1.25 };
export const MP_BASE = 2;                       // los summons de escuela tienen el doble de maná (no lo regeneran)
// Los hechizos de los summons (enseñanza, lanzamiento, daño) viven en petgrimoire.js: sistema propio, separado de la magia del jugador.
