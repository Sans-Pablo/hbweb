// Ficha de un summon para la ventana de vista previa de la tienda de bolas (INVENTO del port): estadísticas, hechizos,
// leyenda y etapas de evolución. Solo lectura: no toca el mundo.
import { SIZE_STAGES, MAX_COMP_LEVEL, statsOf } from "./companion.js";
import { SCHOOL_OF, TIER2, SCHOOL_NAMES, unlockLevels, spellLevel } from "./schools.js";

// Leyenda breve de cada especie (en español; i18n.js trae la inglesa)
export const LORE = {
  "Slime": "Una gota viva que nació en las cuevas húmedas. Nadie sabe qué piensa, pero siempre sonríe.",
  "Giant-Ant": "Obrera incansable de los hormigueros profundos. Lleva el doble de su peso y nunca se rinde.",
  "Amphis": "Serpiente de los pantanos. Se enrosca en silencio y ataca antes de que se la oiga.",
  "Orc": "Guerrero de las tribus del sur. Aprende a canalizar el fuego de sus antepasados.",
  "Skeleton": "Huesos que se negaron a descansar. Obedece a quien le ofrezca un nuevo propósito.",
  "Clay-Golem": "Figura de barro animada por un hechizo antiguo. Lenta, pero muy difícil de romper.",
  "Stone-Golem": "Centinela tallado en roca viva. Se dice que guarda las ruinas desde antes de los reinos.",
  "Orc-Mage": "Chamán orco que mezcla la furia de su pueblo con la magia arcana.",
  "Hellbound": "Bestia ligada a un pacto infernal. Su mirada abrasa a quien se atreve a sostenerla.",
  "Cyclops": "Gigante de un solo ojo. Ve poco, pero golpea con la fuerza de una avalancha.",
  "Troll": "Brutal y terco, se cura de heridas que matarían a cualquiera.",
  "Orge": "Un ogro enorme y glotón. Fiel a quien le da de comer.",
  "Tentocle": "Criatura de las aguas heladas. Sus tentáculos guardan el frío de las profundidades.",
  "Cannibal-Plant": "Planta voraz que crece con las tormentas. Cada rayo la hace más fuerte.",
  "Demon": "Forma superior del Orc: un señor del fuego que ha dominado las llamas.",
  "Frost": "Forma superior del Tentocle: un espíritu de hielo eterno.",
  "Liche": "Forma superior de la Planta Caníbal: un nigromante que domina el rayo.",
  "Dummy": "Muñeco de entrenamiento. Frágil, pero aprende cualquier oficio de apoyo.",
};
export const loreOf = sp => LORE[sp] || "Un compañero misterioso. Crece contigo y guarda secretos.";

// Etapas: crecimientos de tamaño (niveles de SIZE_STAGES; la última coincide con el nivel máximo) y, en las escuelas, la especie superior
export function evolutionsOf(sp) {
  const stages = SIZE_STAGES.map(lvl => ({ lvl, sp, final: lvl === MAX_COMP_LEVEL }));
  const up = TIER2[sp];
  return { stages, tier2: up ? { sp: up, lvl: MAX_COMP_LEVEL } : null };
}

// Datos para mostrar: stats al nivel 1 y al máximo según el dueño `p`, escuela y sus hechizos con el nivel que los desbloquea
export function infoOf(p, sp, magic) {
  const at = lvl => statsOf(p, { sp, lvl });
  const school = SCHOOL_OF[sp] || null;
  let spells = [];
  if (school && magic) spells = Object.keys(unlockLevels(magic, school)).map(id => ({ id: +id, name: magic[id]?.name || "#" + id, lvl: spellLevel(magic, school, id, sp) })).sort((a, b) => a.lvl - b.lvl || a.id - b.id);
  return { sp, school, schoolName: school ? SCHOOL_NAMES[school] : null, lo: at(1), hi: at(MAX_COMP_LEVEL), spells, lore: loreOf(sp), evo: evolutionsOf(sp) };
}
