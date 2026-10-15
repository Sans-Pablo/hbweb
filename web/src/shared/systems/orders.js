// ÓRDENES de un jugador a un habitante (bot) por el chat. INVENTO del port: glosario determinista (sin modelo) que traduce frases como
// «vamos a matar slimes» o «vamos a hacer EK» en una orden concreta. Glosario completo en docs/sistemas/ordenes.md.
//   parse(text) -> { kind:"hunt", mob:"Slime" } | { kind:"ek" } | { kind:"follow" } | { kind:"unsure", why } | null
//   hunt: el bot acompaña al jugador y solo ataca a esa criatura (p.bot.only = nombre de NPC.cfg). ek: acompaña y solo ataca a jugadores enemigos
//   (EK = enemy kills, combatsys.js). follow: solo acompaña. unsure: parece una orden pero no se entiende -> el bot pregunta; si sigue sin entender
//   se anota un ticket «el bot X no entendió esto del player Y» (kind "order" en server/bugs.mjs).
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,]/g, " ").replace(/\s+/g, " ").trim();
// alias (en español o inglés) -> nombre exacto en NPC.cfg (web/data/npc.json). Los nombres del original se aceptan tal cual (ver mobOf).
export const ALIAS = {
  slime: "Slime", slimes: "Slime", limo: "Slime", limos: "Slime", babosa: "Slime", babosas: "Slime",
  hormiga: "Giant-Ant", hormigas: "Giant-Ant", ant: "Giant-Ant", ants: "Giant-Ant",
  escorpion: "Scorpion", escorpiones: "Scorpion", scorpion: "Scorpion", scorpions: "Scorpion",
  esqueleto: "Skeleton", esqueletos: "Skeleton", skeleton: "Skeleton", skeletons: "Skeleton",
  zombi: "Zombie", zombis: "Zombie", zombie: "Zombie", zombies: "Zombie",
  orco: "Orc", orcos: "Orc", orc: "Orc", orcs: "Orc",
  cíclope: "Cyclops", ciclope: "Cyclops", ciclopes: "Cyclops", cyclops: "Cyclops",
  troll: "Troll", trolls: "Troll", ogro: "Orge", ogros: "Orge", ogre: "Orge", ogres: "Orge",
  rana: "Giant-Frog", ranas: "Giant-Frog", frog: "Giant-Frog", frogs: "Giant-Frog",
  conejo: "Rabbit", conejos: "Rabbit", rabbit: "Rabbit", rabbits: "Rabbit", gato: "Cat", gatos: "Cat", cat: "Cat", cats: "Cat",
  golem: "Stone-Golem", golems: "Stone-Golem", "golem de piedra": "Stone-Golem", "golems de piedra": "Stone-Golem", "golem de arcilla": "Clay-Golem", "golems de arcilla": "Clay-Golem",
  lobo: "WereWolf", lobos: "WereWolf", hombrelobo: "WereWolf", werewolf: "WereWolf", werewolves: "WereWolf",
  gargola: "Gagoyle", gargolas: "Gagoyle", gargoyle: "Gagoyle", gargoyles: "Gagoyle",
  jabali: "DireBoar", jabalis: "DireBoar", boar: "DireBoar", boars: "DireBoar",
  cangrejo: "Giant-Crayfish", cangrejos: "Giant-Crayfish", lagarto: "Giant-Lizard", lagartos: "Giant-Lizard", lizard: "Giant-Lizard", lizards: "Giant-Lizard",
  tortuga: "Claw-Turtle", tortugas: "Claw-Turtle", turtle: "Claw-Turtle", turtles: "Claw-Turtle",
  planta: "Giant-Plant", plantas: "Giant-Plant", plant: "Giant-Plant", plants: "Giant-Plant",
  demonio: "Demon", demonios: "Demon", demon: "Demon", demons: "Demon", liche: "Liche", beholder: "Beholder", unicornio: "Unicorn", unicornios: "Unicorn",
  minotauro: "Minotaurs", minotauros: "Minotaurs", minotaur: "Minotaurs", minotaurs: "Minotaurs", centauro: "Centaurus", centauros: "Centaurus", centaur: "Centaurus",
  wyvern: "Wyvern", wyverns: "Wyvern", "dark elf": "Dark-Elf", "elfo oscuro": "Dark-Elf", "elfos oscuros": "Dark-Elf", "ettin": "Ettin", ettins: "Ettin",
  gigante: "Mountain-Giant", gigantes: "Mountain-Giant", "mountain giant": "Mountain-Giant",
};
export function mobOf(s, names = []) {
  const t = norm(s); if (!t) return null;
  if (ALIAS[t]) return ALIAS[t];
  for (const n of names) if (norm(n) === t || norm(n) === t.replace(/s$/, "")) return n;
  const w = t.split(" "); for (let i = w.length; i > 0; i--) { const k = w.slice(0, i).join(" "); if (ALIAS[k]) return ALIAS[k]; }
  return null;
}
export function parse(text, names = []) {
  const t = norm(text); if (!t) return null;
  if (/\b(hacer|hacemos|hagamos|farmear|farmeamos|ir a por|do|get|go for|farm)\b.*\b(ek|eks|enemy kills?)\b|\b(ek|eks)\b.*\b(vamos|ven|go|let s)\b|^(vamos|let s go|lets go) (a )?(ek|eks)$/.test(t)) return { kind: "ek" };
  if (/(^| )(recoge|recoger|recogelo|recogelos|coge|coger|agarra|toma|pick up|pickup|grab|take)( .*)? (esto|eso|esos|estos|todo|this|that|these|it|everything)( [a-z]+)?$|^(recoge|coge|pick up|grab)( [a-z]+)?$/.test(t)) return { kind: "pickup" };   // lo tirado por un jugador: los bots no lo recogen solos (bot.js, dropBy)
  const m = t.match(/\b(?:matar|mata|cazar|caza|farmear|farmea|limpiar|limpia|kill|killing|hunt|hunting|farm|farming|grind|exterminar|liquidar)\s+(?:a\s+|a los\s+|a las\s+|los\s+|las\s+|el\s+|la\s+|some\s+|the\s+)?(.+)$/);
  if (m) { const mob = mobOf(m[1], names); return mob ? { kind: "hunt", mob } : { kind: "unsure", why: m[1] }; }
  return null;                                                                            // lo demás (grupo, hola, etc.) sigue por intentOf
}
export const label = (o, lang) => o.kind === "hunt" ? o.mob : o.kind === "ek" ? "EK" : o.kind === "pickup" ? "pickup" : "";
// Pregunta si hay duda; «sí/no» a esa pregunta se resuelve con answerOf
export const answerOf = text => { const t = norm(text); return /^(si|sí|yes|yep|ok|vale|claro|exacto|eso|correcto|y)\b/.test(t) ? true : t.split(" ").length <= 2 && /^(no|nope|nah|negativo)\b/.test(t) ? false : null; };   // «no» suelto (con el nombre del bot, 2 palabras); «no sé…» no cuenta
