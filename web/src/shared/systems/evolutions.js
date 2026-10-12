// Tabla única de EVOLUCIONES de los compañeros (INVENTO del port, petición del diseñador). Para cambiar una cadena se edita SOLO esta tabla:
// escuelas (schools.js), bola superior (hospital), báculo (classgear.js), misiones de clase (quests.js), textos (summoninfo.js, diálogos del cliente),
// aspecto/efectos (renderer.js) y los habitantes (residents.js) la leen de aquí. Cada especie debe existir en SPECIES (companion.js) y en npc.json.
//  base    especie que se compra/gana como bola normal
//  evo     especie superior: se obtiene en el hospital con la base a nivel 50 (nivel 1 de la superior); no se compra
//  school  escuela de magia (fire | ice | lightning) o null = sin magia (solo combate, mismas mejoras de la especie superior)
//  family  familia de báculo que exige la especie superior en la mano (classgear.js: fire | ice | dark) o null = sin báculo; "psychic" = Psychic Controller
//  psy     (opcional) rama psíquica: movement | interference | territory (psychic.js)
//  look    aspecto y efectos de la especie superior en el renderer (por defecto el propio nombre)
//  fit     (opcional) altura del sprite de la base al nivel 50 como fracción de la del personaje, para sprites originales pequeños (renderer.petScale)
//  es/en   frase de la ficha de la especie superior
export const CHAINS = [
  { base: "Orc", evo: "Demon", school: "fire", family: "fire", es: "Forma superior del Orc: un señor del fuego que ha dominado las llamas.", en: "Higher form of the Orc: a lord of fire who has mastered the flames." },
  { base: "Tutelary-Angel", evo: "Frost", school: "ice", family: "ice", fit: 0.7, es: "Forma superior del Pixie: un espíritu de hielo eterno.", en: "Higher form of the Pixie: a spirit of eternal ice." },
  { base: "Skeleton", evo: "Liche", school: "lightning", family: "dark", es: "Forma superior del Esqueleto: un nigromante que domina el rayo.", en: "Higher form of the Skeleton: a necromancer who commands lightning." },
  { base: "Tentocle", evo: "Beholder", school: null, family: "psychic", psy: "movement", es: "Forma superior del Tentocle: un ojo flotante de las profundidades.", en: "Higher form of the Tentocle: a floating eye of the deep." },
  { base: "Dark-Elf", evo: "Elf-Master", school: null, family: null, es: "Forma superior del Elfo oscuro: un maestro de las artes élficas.", en: "Higher form of the Dark Elf: a master of the elven arts." },
  { base: "Unicorn", evo: "Centaurus", school: null, family: "psychic", psy: "interference", es: "Forma superior del Unicornio: un centauro veloz y orgulloso.", en: "Higher form of the Unicorn: a swift and proud centaur." },
  { base: "Scorpion", evo: "Giant-Crayfish", school: null, family: null, es: "Forma superior del Escorpión: un crustáceo gigante acorazado.", en: "Higher form of the Scorpion: an armoured giant crustacean." },
  { base: "Guard", evo: "Temple-Knight", school: null, family: null, es: "Forma superior del Guardia: un caballero del templo.", en: "Higher form of the Guard: a temple knight." },
  { base: "Giant-Frog", evo: "Stalker", school: null, family: "psychic", psy: "territory", es: "Forma superior de la Rana gigante: un acechador que domina el terreno.", en: "Higher form of the Giant Frog: a stalker that commands the ground." },
];
// Especies que ya no existen como compañero: las partidas guardadas se pasan a su sustituta (nombre y nivel se conservan)
export const LEGACY = {};

const by = (key) => Object.fromEntries(CHAINS.map(c => [c[key], c]));
export const BASE_CHAIN = by("base"), EVO_CHAIN = by("evo");
export const TIER2 = Object.fromEntries(CHAINS.map(c => [c.base, c.evo]));                                       // base → evolución
export const BASE_OF = Object.fromEntries(CHAINS.map(c => [c.evo, c.base]));                                     // evolución → base
export const TIER2_SET = new Set(CHAINS.map(c => c.evo));
export const SCHOOL_OF = Object.fromEntries(CHAINS.filter(c => c.school).flatMap(c => [[c.base, c.school], [c.evo, c.school]]));
export const STAFF_FOR = Object.fromEntries(CHAINS.filter(c => c.family).map(c => [c.evo, c.family]));
export const SCHOOL_BASES = CHAINS.filter(c => c.school).map(c => c.base);                                       // bases con magia, en el orden de la tabla
// Rama psíquica (invento): especies superiores que controlan en vez de dañar. Se lanzan solas (psychic.js) y exigen el Psychic Controller (classgear.js)
export const PSY_OF = Object.fromEntries(CHAINS.filter(c => c.psy).flatMap(c => [[c.evo, c.psy]]));
export const FIT = Object.fromEntries(CHAINS.filter(c => c.fit).map(c => [c.base, c.fit]));
export const LOOK = Object.fromEntries(CHAINS.map(c => [c.evo, c.look || c.evo]));
// especie cuyos efectos/aspecto se usan para dibujar a `sp` (renderer)
export const look = sp => LOOK[sp] || sp;
// Nombre que ve el jugador (la clave de datos no cambia): Tutelary-Angel se muestra como «Pixie»
export const NICK = { "Tutelary-Angel": "Pixie" };
export const shown = sp => NICK[sp] || String(sp).replace(/-/g, " ");
// nombre de la cadena para textos: «Orc (fuego), Tentocle (hielo) o Skeleton (rayo)»
const SCH_ES = { fire: "fuego", ice: "hielo", lightning: "rayo" };
export const schoolList = (lang = "es", last = lang === "en" ? "or" : "o") => {
  const xs = CHAINS.filter(c => c.school).map(c => c.base + " (" + (lang === "en" ? c.school === "lightning" ? "lightning" : c.school : SCH_ES[c.school]) + ")");
  return xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " " + last + " " + xs[xs.length - 1];
};
// «Orc, Tentocle y Skeleton nivel 50+ pasan a Demon, Beholder y Liche» (solo cadenas con escuela)
export const evoPairs = () => CHAINS.filter(c => c.school);
// Pasa una bola guardada con una especie desaparecida a su sustituta
export function fixLegacy(c) { if (c && LEGACY[c.sp]) c.sp = LEGACY[c.sp]; return c; }
