// HABITANTES: bots que viven en el servidor (INVENTO del port, no está en el original). Cada uno es un jugador simulado (systems/bot.js) con:
//  - una ficha estable (arquetipo, origen, motivación, miedo, manía) sacada de su nombre, y una historia que va creciendo;
//  - objetivos de vida (subir de nivel, juntar oro, hacer amigos...) y memoria corta de lo que le pasa;
//  - relaciones con los jugadores que conoce (los saluda, los recuerda, acepta o no unirse a su grupo);
//  - respuestas al chat con frases propias y, si el servidor lo ofrece (`adv.llm`, un modelo local como Ollama), con texto generado.
// Todo es determinista salvo `adv.llm` (solo existe en el servidor). El estado (`p.res`) se guarda en el save del habitante.
import { dist } from "../const.js";
import * as Party from "./party.js";
import { isSupport } from "./bot.js";
import { hasStaff } from "./dummy.js";
import { blog, tooStrong, fightEstimate, bossPreview } from "./bot.js";
import * as Council from "./council.js";
import * as Human from "./human.js";
import * as Builds from "./builds.js";
import * as ObsStats from "./obsstats.js";
import * as Respec from "./respec.js";
import { canFight } from "./combatsys.js";
import * as Comp from "./companion.js";
import * as Tal from "./talents.js";
import * as Sch from "./schools.js";
import * as PG from "./petgrimoire.js";
import * as Trade from "./trade.js";
import * as Guild from "./guild.js";
import * as Inv from "../inventory.js";
import { itemLevel } from "../itemlevel.js";
import { EQUIP, ITYPE } from "../items.js";
import * as Shop from "./shopsys.js";
import { judge, stallable } from "./botitems.js";
import * as Stall from "./stall.js";
import * as Quests from "./quests.js";
import * as Leisure from "./leisure.js";
import * as SFood from "./summonfood.js";
import * as Orders from "./orders.js";
import { gold as ledger } from "./ledger.js";

const NAMES = ["Aldric", "Brenna", "Cael", "Dorna", "Edric", "Fenna", "Garrick", "Helga", "Ivo", "Jessa", "Korin", "Lyra", "Marek", "Nessa", "Orin", "Petra", "Quill", "Rhea", "Soren", "Talia",
  "Ulric", "Vesna", "Wynn", "Yara", "Zeke", "Bram", "Cora", "Dain", "Elsa", "Finn", "Greta", "Hugo", "Iris", "Joren", "Kira", "Leif", "Mira", "Nils", "Olga", "Pip"];
export const RESIDENT_NAMES = NAMES;
// OFICIOS FIJOS (0.76.0, INVENTO): entre los 40 habitantes, 4 granjeros, 4 pescadores y 4 de apoyo (2+2+2 por bando, 0.78.0: 0-19 Aresden, 20-39 Elvine) que viven de su oficio
export const JOBS = { Helga: "farmer", Nessa: "farmer", Ivo: "fisher", Quill: "fisher", Nils: "farmer", Cora: "farmer", Greta: "fisher", Finn: "fisher", Petra: "support", Lyra: "support", Olga: "support", Yara: "support" };
export const isCraft = r => r?.job === "farmer" || r?.job === "fisher";

const ARCH = {
  warrior: { es: "guerrero", en: "warrior", talk: 0.4, brave: 1 }, hunter: { es: "cazador", en: "hunter", talk: 0.5, brave: 0.8 },
  trader: { es: "comerciante", en: "trader", talk: 0.8, brave: 0.4 }, wanderer: { es: "viajero", en: "wanderer", talk: 0.7, brave: 0.6 },
  scholar: { es: "estudioso", en: "scholar", talk: 0.6, brave: 0.3 },
};
const ARCH_MIX = ["warrior", "hunter", "scholar", "wanderer", "scholar", "trader", "warrior", "scholar"];
const ORIGINS = [["una aldea de pescadores", "a fishing village"], ["las minas del norte", "the northern mines"], ["una familia de herreros", "a family of smiths"], ["la ciudad de Aresden", "the city of Aresden"],
  ["un monasterio lejano", "a distant monastery"], ["un barco mercante", "a merchant ship"], ["las montañas", "the mountains"], ["una granja a las afueras", "a farm on the outskirts"]];
const MOTIVES = [["quiere hacerse rico", "wants to get rich"], ["busca a un hermano desaparecido", "is looking for a missing brother"], ["quiere ser el mejor cazador", "wants to be the best hunter"],
  ["huye de una deuda", "is running from a debt"], ["sueña con una casa junto al mar", "dreams of a house by the sea"], ["quiere demostrar su valor", "wants to prove their worth"], ["solo busca buena compañía", "just wants good company"]];
const FEARS = [["las arañas", "spiders"], ["la oscuridad", "the dark"], ["quedarse sin dinero", "running out of money"], ["morir solo", "dying alone"], ["los fantasmas", "ghosts"], ["el fuego", "fire"]];
const QUIRKS = [["siempre cuenta cuántos monstruos ha matado", "always counts the monsters they've killed"], ["silba cuando está nervioso", "whistles when nervous"], ["colecciona piedras raras", "collects odd stones"],
  ["habla con su arma", "talks to their weapon"], ["no soporta el pescado", "can't stand fish"], ["siempre pide perdón", "always apologises"]];

const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const pickBy = (arr, h, salt) => arr[(Math.imul(h, salt) >>> 0) % arr.length];

// ---------------------------------------------------------------- ficha e historia
export function create(name) {
  const h = hash(name.toLowerCase()), arch = ARCH_MIX[h % 8];       // 3 de cada 8 son magos (estudiosos: summons de escuela que lanzan magias)
  return { v: 1, arch, origin: pickBy(ORIGINS, h, 31), motive: pickBy(MOTIVES, h, 37), fear: pickBy(FEARS, h, 41), quirk: pickBy(QUIRKS, h, 43),
    lang: (NAMES.indexOf(name) >= 0 ? NAMES.indexOf(name) : h) % 2 ? "en" : "es",          // mitad habla inglés y mitad español
    goal: null, mem: [], rel: {}, kills0: 0, deaths: 0, bio: null, chats: 0, qa: { kills: {}, deaths: {}, rej: {}, exp0: 0, pvp: { k: 0, d: 0 }, pet: { lost: 0, kills: 0, lvls: 0, heals: 0, spent: 0 } } };
}
export function restore(name, saved) { const r = { ...create(name), ...(saved && typeof saved === "object" ? saved : {}) }; r.mem = (r.mem || []).slice(-16); r.qa = { kills: {}, deaths: {}, rej: {}, exp0: 0, ...(r.qa || {}) }; r.qa.pvp ||= { k: 0, d: 0 }; r.qa.pet ||= { lost: 0, kills: 0, lvls: 0, heals: 0, spent: 0 }; return r; }
export const storyOf = (p, lang) => {
  const r = p.res, i = lang === "en" ? 1 : 0, a = ARCH[r.arch][lang === "en" ? "en" : "es"];
  return lang === "en"
    ? `${p.name} is a ${a} from ${r.origin[i]} who ${r.motive[i]}. Fears ${r.fear[i]} and ${r.quirk[i]}.`
    : `${p.name} es un ${a} de ${r.origin[i]} que ${r.motive[i]}. Teme ${r.fear[i]} y ${r.quirk[i]}.`;
};
export function remember(p, es, en) { const m = p.res.mem; m.push({ es, en }); if (m.length > 16) m.shift(); if (p.res._w) blog(p.res._w, p, "📝 " + es); }
export const relOf = (p, who) => p.res.rel[who] || 0;
function befriend(p, who, n = 1) {
  const rel = p.res.rel; rel[who] = (rel[who] || 0) + n;
  const ks = Object.keys(rel); if (ks.length > 30) { ks.sort((a, b) => rel[a] - rel[b]); delete rel[ks[0]]; }
}

// ---------------------------------------------------------------- objetivos de vida
// Metas de combate: bajas de enemigos en Promise Land (pvp), dominar un foso de Promise Land (pit: aguantar su zona con el bando dueño) y bajar en la cripta (crypt).
function newGoal(w, p) {
  // METAS DE VIDA (las mismas que perseguiría un jugador): muchas bajas enemigas (pvp), nivel máximo (level), terminar la cripta (crypt), muchos summons distintos
  // al nivel máximo (pet), los mejores objetos (gear) y socializar (friend); el oro (gold) y los monstruos (kills) son paradas intermedias.
  if (p.quests) { const g = questGoal(w, p); if (g) { p.res.goal = { ...g, q: p.quests.n }; return; } }
  const r = p.res, kind = ["level", "level", "gold", "kills", "friend", "friend", "pvp", "pvp", "pit", "crypt", "crypt", "pet", "pet", "gear", "gear"][Math.floor(w.rng() * 15)];
  if (kind === "level") r.goal = { k: "level", n: p.level + 2 };
  else if (kind === "gold") r.goal = { k: "gold", n: p.gold + 800 + p.level * 300 };
  else if (kind === "kills") r.goal = { k: "kills", n: (p.kills || 0) + 25 };
  else if (kind === "pvp") r.goal = { k: "pvp", n: (p.ek || 0) + 3 + Math.floor(w.rng() * 3) };
  else if (kind === "pit") r.goal = { k: "pit", n: (r.qa.pvp.held || 0) + 180, zone: 1 + Math.floor(w.rng() * 12) };           // 180 s dominando el foso
  else if (kind === "crypt") r.goal = (p.delve?.deepest || 1) >= 12 && !p.delve?.king ? { k: "crypt", n: 20, king: true } : { k: "crypt", n: Math.min(20, (p.delve?.deepest || 1) + 1) };   // meta final: matar al Rey esqueleto dorado (piso 20)
  else if (kind === "pet") r.goal = { k: "pet", n: Math.min(6, maxedPets(p) + 1) };
  else if (kind === "gear") r.goal = { k: "gear", n: Math.round(avgIlvl(w, p)) + 3 };
  else r.goal = { k: "friend", n: Object.keys(r.rel).length + 2 };
}
export const goalText = (g, lang) => !g ? "" : lang === "en"
  ? { level: `reach level ${g.n}`, gold: `save ${g.n} gold`, kills: `hunt ${g.n} monsters in total`, friend: "make new friends", pvp: `kill enemies until I have ${g.n} enemy kills`, pit: `dominate pit ${g.zone} in Promise Land`, pet: `have ${g.n} different summons at max level`, gear: `reach an average item level of ${g.n}`, crypt: g.king ? "kill the Golden Skeleton King and finish the crypts" : `reach crypt level ${g.n}` }[g.k]
  : { level: `llegar al nivel ${g.n}`, gold: `juntar ${g.n} de oro`, kills: `cazar ${g.n} monstruos en total`, friend: "hacer nuevos amigos", pvp: `abatir enemigos hasta las ${g.n} bajas`, pit: `dominar el foso ${g.zone} de Promise Land`, pet: `tener ${g.n} summons distintos al nivel máximo`, gear: `llegar a un nivel de objeto medio de ${g.n}`, crypt: g.king ? "matar al Rey esqueleto dorado y terminar las criptas" : `llegar al nivel ${g.n} de la cripta` }[g.k];
// La misión activa convertida en una meta de las de siempre (nivel, caza, cripta, pvp, summons). `q` = nº de misión: la meta se da por buena al pasar a la siguiente.
// ¿está en condiciones de pelear con el jefe que le pide la misión? Si no, mejor sube de nivel cazando (y gasta el oro en pociones) antes de bajar a morir
function questReady(w, p) {
  const q = p.quests, cur = q && Quests.lineOf(p)[q.n], g = cur?.goal; if (!g || p.level >= 50) return true;
  const tier = g.k === "boss" ? g.tier : g.k === "staff" || g.k === "king" ? 4 : 0; if (!tier) return true;
  const bp = bossPreview(w, Math.min(20, tier * 5)); if (!bp) return true;
  const e = fightEstimate(w, p, bp, true); return e.ratio >= 1.3 || p.level >= 5 * tier * 2 + 20;
}
function questGoal(w, p) {
  const q = p.quests, cur = Quests.lineOf(p)[q.n]; if (!cur) return null;
  const g = cur.goal, pr = Quests.progress(p, g);
  switch (g.k) {
    case "lvl": return { k: "level", n: g.n };
    case "kill": return g.mon === "Skeleton" ? { k: "crypt", n: Math.min(5, q.u.crypt) } : { k: "kills", n: (p.kills || 0) + 30 };
    case "kinds": return pr[0] >= 3 ? { k: "crypt", n: 1 } : { k: "kills", n: (p.kills || 0) + 40 };   // la granja da cuatro especies: la quinta está en la cripta
    case "depth": return { k: "crypt", n: g.n };
    case "boss": return { k: "crypt", n: Math.min(20, g.tier * 5), king: g.tier >= 4 };
    case "staff": return { k: "crypt", n: 20, king: true };
    case "king": return { k: "crypt", n: 20, king: true };
    case "ek": return { k: "pvp", n: (p.ek || 0) + Math.max(1, Math.min(6, g.n - pr[0])) };
    case "pet": case "trade": case "final": return { k: "pet", n: Math.min(6, maxedPets(p) + 1) };
    default: return null;
  }
}
// especie de la línea de la clase que le toca criar: la base de su clase (quests.js PATH) y, tras evolucionar, su especie superior
const qSpecies = p => { const q = p.quests, P = q && Quests.PATH[q.cls]; if (!P || q.n >= Quests.ACT1_END) return null; return q.tr ? P.final : P.sp; };
const qBall = p => { const sp = qSpecies(p); return sp ? p.bag.find(i => i.comp && i.comp.sp === sp && !i.comp.bad) || null : null; };
const qEvolve = p => { const q = p.quests; return !!q && q.u.trade && !q.tr && q.n < Quests.ACT1_END && p.bag.some(i => i.comp && i.comp.sp === Quests.PATH[q.cls].sp && i.comp.lvl >= Sch.TRADE_LEVEL); };
const qMissing = p => { const q = p.quests; return !!q && !q.tr && qSpecies(p) && !qBall(p) && p.level >= 2; };
const maxedPets = p => new Set(p.bag.filter(i => i.comp && i.comp.lvl >= Sch.TRADE_LEVEL).map(i => i.comp.sp)).size;
// nivel medio de objeto de lo que lleva puesto (arma, cuerpo, piernas, escudo, casco, brazos, pantalones)
export function avgIlvl(w, p) {
  let t = 0; for (const slot of [EQUIP.RHAND, EQUIP.BODY, EQUIP.LEGGINGS, EQUIP.LHAND, EQUIP.HEAD, EQUIP.ARMS, EQUIP.PANTS]) { const uid = p.equip[slot] ?? (slot === EQUIP.RHAND ? p.equip[EQUIP.TWOHAND] : undefined), i = uid !== undefined && Inv.instOf(p, uid); if (i) t += itemLevel(w.data.item(i.id), i.attr, i.id); }
  return t / 7;
}
function goalDone(p) {
  const g = p.res.goal;
  return !g ? false : g.q !== undefined && p.quests ? p.quests.n > g.q : g.k === "pet" ? maxedPets(p) >= g.n : g.k === "gear" ? p.res._w && avgIlvl(p.res._w, p) >= g.n : g.k === "level" ? p.level >= g.n : g.k === "gold" ? p.gold >= g.n : g.k === "kills" ? (p.kills || 0) >= g.n : g.k === "pvp" ? (p.ek || 0) >= g.n
    : g.k === "pit" ? (p.res.qa.pvp.held || 0) >= g.n : g.k === "crypt" ? (g.king ? (p.delve?.king | 0) > 0 : (p.delve?.deepest || 1) >= g.n) : Object.keys(p.res.rel).length >= g.n;
}

// ---------------------------------------------------------------- frases
// SITUACIONES (no frases): el habitante ya no tiene diálogos escritos; cada ocasión de hablar es una descripción de lo que pasa y el modelo de lenguaje
// (adv.llm, server/llm.mjs) lo dice con su voz. Sin modelo, el habitante calla (las acciones no dependen de hablar).
const SIT = {
  admire: "{n} has a fully grown, maximum level summon next to them; you notice it and comment on it, impressed",
  greet: "you meet {n} and greet them warmly", again: "you meet {n} again, you remember them and suggest hunting together",
  who: "someone asks who you are; answer with this: {s}", doing: "someone asks what you are doing; you are working on this goal: {g}",
  from: "someone asks where you come from; you come from {o}", fear: "someone asks what you fear; you are afraid of {f} (say it as a secret)",
  thanks: "{n} thanks you; reply kindly", bye: "{n} says goodbye; say goodbye", yes: "{n} asks you to join their party; you accept and will follow them a while",
  no: "{n} asks you to join their party but you are busy with your own things; decline politely", shy: "{n} asks you to join their party but you barely know them; say you want to talk first",
  bot: "someone asks if you are a real person or a bot; admit you are a simulated resident of this server, but your goals feel real to you",
  idle: "say something short about your day, the place, hunting or your gear", level: "you just reached level {l}", goal: "you just achieved your goal: {g}",
  died: "you just died and respawned; say you will be more careful", group: "invite {n} to hunt together",
  trip: "you are heading to Promise Land to try your luck; maybe ask who joins", taunt: "taunt the enemy {n} before attacking",
  win: "you just killed an enemy player in Promise Land; gloat briefly", lose: "an enemy player just killed you in Promise Land",
  banter: "make small talk with other residents about shop prices, crypts, monsters you killed ({m}) or your goals", banterr: "reply to {n}'s small talk with a short natural answer",
  tsell: "you offer to sell {n} this item: {i}, for {p} gold", tgift: "you give {n} this item as a gift: {i}", tnoneed: "{n} offers you something but you do not need it now",
  toffer: "during a trade you put {i} on the table for {n} and ask {p} gold for it", tpay: "during a trade you put {p} gold on the table to pay {n} for {i}",
  tconfirm: "you press confirm in the trade with {n} because the deal looks fair to you", tcounter: "{n}'s offer is lower than what your item is worth to you; ask for more or a better item",
  twait: "you wait for {n} to put something on the trade table",
  tbye: "the trade ended without a deal; say maybe next time", tdone: "you just closed a trade with {n}; say deal", task: "{n} is interested in trading; ask what they offer",
  tnothing: "{n} wants to trade but you have nothing to offer", tno: "the price {n} offers is not worth it for you",
  gchat: "chat casually with your guild mates (level {l}, loot, your day)", gjoin: "your guild proposes an activity and you join in", gskip: "your guild proposes an activity but you cannot go today",
  gwelcome: "{n} just joined your guild; welcome them", gfound: "you just founded the guild {g}; invite others to talk to you to join",
  gdanger: "warn your guild that {m} killed you at level {l} and they should avoid it for now", gpit: "warn your guild that the raid at pit {m} went badly because enemies are killing you",
  gfoe: "warn that the guild {g} is raiding Promise Land and to watch out", tinvite: "invite {n} to hunt together and say you are sending a party invite",
  gbackup: "you are losing a fight in Promise Land; ask your guild for backup there, briefly", gbackupgo: "you answer {n}'s call for backup: you are on your way to Promise Land", gnobackup: "{n} asked for backup in Promise Land but you are busy or not in the mood; excuse yourself briefly",
  other: "answer {n} briefly; you are not sure what to say",
};
export const langOf = text => (/[áéíóúñ¿¡]|\b(hola|que|qué|como|cómo|quien|quién|donde|dónde|grupo|gracias|adios|adiós|ayuda|vamos|ven)\b/i.test(text) ? "es" : "en");
export function intentOf(text) {
  const t = text.toLowerCase();
  if (/\b(bot|ia|ai|robot|real|humano|human|npc)\b/.test(t)) return "bot";
  if (/\b(grupo|party|ven\b|sigueme|sígueme|follow|join|come with|vamos)/.test(t)) return "party";
  if (/\b(gracias|thanks|thx|thank)/.test(t)) return "thanks";
  if (/\b(adios|adiós|bye|chao|hasta)/.test(t)) return "bye";
  if (/\b(quien|quién|who|nombre|name)/.test(t)) return "who";
  if (/\b(de donde|dónde|donde|where|from|origen)/.test(t)) return "from";
  if (/\b(miedo|fear|afraid|scared)/.test(t)) return "fear";
  if (/\b(haces|doing|meta|goal|objetivo|que tal|qué tal|how are)/.test(t)) return "doing";
  if (/\b(hola|hello|hi|hey|buenas)\b/.test(t)) return "greet";
  return "other";
}
function fmt(p, key, lang, who, w, extra = {}) {                                   // -> "§" + descripción de la situación (la dice el modelo)
  const t = SIT[key]; if (!t) return "";
  const i = lang === "en" ? 1 : 0, r = p.res;
  return "§" + t.replace("{n}", who || "").replace("{s}", storyOf(p, lang)).replace("{g}", goalText(r.goal, lang) || "wander").replace("{o}", r.origin[i])
    .replace("{f}", r.fear[i]).replace("{l}", p.level).replace("{i}", extra.i ?? "").replace("{p}", extra.p ?? "").replace("{m}", extra.m ?? "");
}
// Texto del contexto para un modelo de lenguaje (server/llm.mjs): quién es, qué ha vivido y qué quiere ahora.
export function describe(p, lang) {
  const r = p.res, es = lang !== "en";
  const mem = r.mem.slice(-6).map(m => (es ? m.es : m.en)).join(" | ");
  const lessons = (r.insights || []).slice(-3).map(i => i.t).join(" | ");
  const known = Object.entries(r.rel).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n).join(", ");
  return es
    ? `${storyOf(p, "es")} Nivel ${p.level}. Meta actual: ${goalText(r.goal, "es") || "ninguna"}. Recuerdos recientes: ${mem || "ninguno"}. Conoce a: ${known || "nadie aún"}.${lessons ? " Lo que he aprendido: " + lessons : ""}`
    : `${storyOf(p, "en")} Level ${p.level}. Current goal: ${goalText(r.goal, "en") || "none"}. Recent memories: ${mem || "none"}. Knows: ${known || "nobody yet"}.${lessons ? " What I have learned: " + lessons : ""}`;
}

// ---------------------------------------------------------------- conexión con el bot
export function attach(w, p, saved) {
  p.res = restore(p.name, saved);
  p.res.next = 0;
  { const job = JOBS[p.name]; p.res.job = job || null; if (job === "support") p.res.arch = "scholar"; else if (job) p.res.arch = job === "fisher" ? "hunter" : "trader";
    if (job && p.bot) { p.bot.farmer = job === "farmer"; p.bot.fixed = job; } }
  if (!p.res.goal) newGoal(w, p);
  if (!p.res.chr20) { p.res.chr20 = 1; if (p.level >= 15 && p.stats.chr < 20) p.pool += 20 - p.stats.chr; }       // una sola vez: los veteranos reciben los puntos de carisma que exige fundar un guild
  p.res.lvl = p.level; p.res.kills0 = p.kills || 0;
  if (!p.res.mem.length) remember(p, "Llegué a Aresfarm buscando mi camino.", "I arrived in Aresfarm looking for my way.");
}
// Habla del habitante. `text` = "§situación" (o "@§…" para el chat de guild): se pide al modelo de lenguaje en cola (una petición a la vez, las más viejas se
// descartan) y, si responde a tiempo, se dice; sin modelo no dice nada. Texto sin "§" se dice tal cual (solo lo escrito por el modelo o por un humano).
// Saca el texto hablado de una respuesta del modelo aunque venga como JSON roto ({"say":"…","do":…), con comillas sueltas o con llaves: nunca se lee código en el chat.
export function cleanSay(t) {
  let s = String(t ?? "");
  const m = /"say"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(s);
  if (m) { try { s = JSON.parse('"' + m[1] + '"'); } catch { s = m[1].replace(/\\"/g, '"'); } }
  else if (/^\s*[{[]/.test(s) || /"(?:do|say)"\s*:/.test(s)) s = s.replace(/"(?:do|say)"\s*:\s*"?[a-z_]*"?,?/gi, "").replace(/[{}[\]"]/g, "");
  return s.replace(/\s+/g, " ").trim();
}
// Parte un texto largo en mensajes de ≤ max caracteres cortando en frases (luego en comas/espacios): nunca se pierde el final.
export function splitSay(text, max = 108) {
  const out = []; let s = String(text || "").replace(/\s+/g, " ").trim();
  while (s.length > max) {
    let cut = Math.max(s.lastIndexOf(". ", max - 2), s.lastIndexOf("! ", max - 2), s.lastIndexOf("? ", max - 2)) + 1;
    if (cut < max * 0.4) cut = Math.max(s.lastIndexOf(", ", max - 2), s.lastIndexOf("; ", max - 2)) + 1;
    if (cut < max * 0.4) cut = s.lastIndexOf(" ", max - 2);
    if (cut < 1) cut = max;
    out.push(s.slice(0, cut).trim()); s = s.slice(cut).trim();
  }
  if (s) out.push(s);
  return out.slice(0, 10);
}
// Dice un texto (con prefijo de canal opcional) en uno o varios mensajes seguidos, con una pausa de «tecleo» entre ellos.
function sayLong(adv, p, pre, text, typo = true) {
  const w = adv.worldFor(p.id), parts = splitSay(text, 118 - pre.length);
  parts.forEach((t, i) => {
    const go = () => { if (!p.dead) adv.command(p.id, { t: "say", text: pre + (typo && !pre && i === 0 ? Human.typo(adv, p, t) : t) }); };
    if (i === 0 || typeof w.after !== "function") go(); else w.after(i * (1800 + t.length * 45), go);
  });
}
// Memoria de charla: lo que se dijo entre habitantes (por canal), para que contesten con contexto y recuerden con quién hablaron.
export function logTalk(p, w, who, text, ch, mine = false) {
  const r = p.res; if (!r || !text) return;
  const t = (r.talk ||= []); t.push({ at: w.time, who, ch, me: mine ? 1 : 0, text: String(text).slice(0, 160) }); if (t.length > 40) t.shift();
  if (!mine && who) { const c = (r.talkN ||= {}); c[who] = (c[who] | 0) + 1; }
}
export const talkCtx = (p, ch, n = 6, who = "") => ((p.res?.talk) || []).filter(x => x.ch === ch && (!who || x.who === who)).slice(-n).map(x => (x.me ? p.name : x.who) + ": " + x.text).join(" / ");
export function speak(adv, p, text) {
  if (!text) return;
  if (!/^[@$!~]?§/.test(text)) text = cleanSay(text);
  if (!text) return;
  const m = /^([@$!~]?)§(.*)$/s.exec(text);
  if (!m) { const pm = /^([@$!~])(.*)$/s.exec(text); sayLong(adv, p, pm ? pm[1] : "", pm ? pm[2] : text); return; }
  if (typeof adv.llm !== "function" || adv.llm.ready === false) return;
  const q = (adv._sayQ ||= []), w = adv.worldFor(p.id);
  if (q.some(x => x.p === p && x.pre === m[1])) return;                                        // uno pendiente por habitante y canal
  q.push({ p, pre: m[1], sit: m[2], at: w.time, lang: p.res.lang }); if (q.length > 14) q.shift();
  pumpSay(adv);
}
// Modo actual del habitante (lo usan el cerebro y la lista de observar).
export function modeOf(adv, p, w = adv.worldFor(p.id)) {
  const b = p.bot, r = p.res || {}, d = r._delve, t = r._trip, tgt = b.target != null ? w.ents.get(b.target?.id ?? b.target) : null;
  return p.dead ? "dead" : b.rest ? "rest" : b.owner != null ? "follow" : d ? (d.go ? "delve-go" : "delve") : t ? (t.pit ? "pit" : "trip") : r._pet ? "pet" : r._leis ? r._leis.kind : b.travel ? "travel" : b.fleeAt && w.time - b.fleeAt < 3000 ? "flee" : tgt ? "fight" : "idle";
}
const topN = (o, n) => Object.entries(o || {}).sort((x, y) => y[1] - x[1]).slice(0, n);
// «Cerebro» del habitante observado: qué hace, qué piensa, qué mira y su ficha completa. Lo recibe el cliente en modo observar (≈1 vez por segundo).
export function brainOf(adv, p) {
  const w = adv.worldFor(p.id), b = p.bot, r = p.res || {}, tgt = b.target != null ? w.ents.get(b.target?.id ?? b.target) : null;
  const d = r._delve, mode = modeOf(adv, p, w);
  const line = p.quests ? Quests.lineOf(p) : [], qn = p.quests ? p.quests.n | 0 : 0, cur = line[qn];
  const lead = b.owner != null ? w.ents.get(b.owner) : null;
  const near = [...w.ents.values()].filter(e => e !== p && !e.dead && dist(p, e) <= 12 && e.kind !== "citizen" && !e.aux).sort((x, y) => dist(p, x) - dist(p, y)).slice(0, 6).map(e => ({ n: e.name || e.type || "?", k: e.kind === "player" ? (e.side === p.side ? "ally" : "enemy") : e.comp ? "pet" : "mob", d: Math.round(dist(p, e)), hp: Math.round(100 * e.hp / Math.max(1, e.maxHp)) }));
  const red = w.data.named?.("RedPotion"), pots = red ? p.bag.reduce((n, i) => n + (i.id === red.id ? i.count || 1 : 0), 0) : 0;
  const sk = p.eff?.skill, skv = sk != null ? (p.skills?.[sk] | 0) : null;
  const nm = u => { const i = p.bag.find(x => x.uid === u), it = i && w.data.item(i.id); return it ? it.name : ""; };
  const ilv = avgIlvl(w, p);
  const gd = p.guild ? adv.guildReg?.guilds?.get(p.guild.name) : null;
  const team = lead ? lead : members(adv, p) > 0 ? p : null;
  const pn = p.party?.names || [];                                                 // party formal: sus miembros que sean bots (más uno mismo)
  const mates = pn.length > 1 ? [p, ...[...adv.bots.values()].filter(x => x !== p && pn.includes(x.name))] : team ? [team, ...[...adv.bots.values()].filter(x => x !== team && x.bot?.owner === team.id)] : [];
  const qs = line.map((q, i) => ({ id: q.id, es: q.es || q.name || q.id, en: q.en || q.name || q.id, st: i < qn ? 2 : i === qn ? 1 : 0 }));
  return {
    id: p.id, name: p.name, side: p.side, mode, lv: p.level, hp: p.hp, mhp: p.maxHp, mp: p.mp, mmp: p.maxMp, gold: p.gold, pots, map: w.map.id, floor: w.map.kind === "dungeon" ? w.map.level : 0, cls: p.quests?.cls || "",
    goal: { es: goalText(r.goal, "es"), en: goalText(r.goal, "en") },
    quest: cur ? { id: cur.id, es: cur.es || cur.name || cur.id, en: cur.en || cur.name || cur.id, pr: Quests.progress(p, cur.goal) } : null,
    quests: qs, qn,
    target: tgt ? { n: tgt.name || tgt.type || "?", hp: Math.round(100 * tgt.hp / Math.max(1, tgt.maxHp)), d: Math.round(dist(p, tgt)) } : null,
    delve: d ? { until: Math.max(0, Math.round((d.until - w.time) / 1000)), floor: d.lv | 0 } : null,
    team: lead ? { lead: lead.name, n: members(adv, lead) + 1 } : members(adv, p) > 0 ? { lead: p.name, n: members(adv, p) + 1 } : null,
    mates: mates.map(x => ({ id: x.id, n: x.name, lv: x.level, hp: Math.round(100 * x.hp / Math.max(1, x.maxHp)), lead: x === (pn.length > 1 ? p : team), map: adv.worldFor(x.id)?.map?.name || "" })),
    party: pn.length > 1 ? pn : null,
    skill: skv, near,
    wish: b.wish || "",
    log: (b.log || []).slice(-14),
    mem: (r.mem || []).slice(-5).map(m => ({ es: m.es, en: m.en })),
    friends: Object.entries(r.rel || {}).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([n, v]) => n + " " + v),
    // ficha completa para analizar al bot
    st: { ...p.stats }, exp: Math.round(100 * (p.exp - p.prevExp) / Math.max(1, p.nextExp - p.prevExp)), ilvl: Math.round(ilv), ek: p.ek | 0, kills: p.kills | 0,
    arch: r.arch || "", origin: r.origin || "", motive: r.motive || "", fear: r.fear || "", quirk: r.quirk || "", lang: r.lang || "", bio: r.bio || "", chats: r.chats | 0,
    equip: Object.entries(p.equip || {}).map(([sl, u]) => [+sl, nm(u)]).filter(x => x[1]),
    skills: Object.entries(p.skills || {}).filter(x => x[1] > 0).map(([k, v]) => [+k, v | 0]).sort((x, y) => y[1] - x[1]).slice(0, 8),
    bagN: p.bag.length, deaths: r.deaths | 0,
    qa: { kills: topN(r.qa?.kills, 6), deaths: topN(r.qa?.deaths, 4), pvp: { ...(r.qa?.pvp || {}) }, pet: { ...(r.qa?.pet || {}) } },
    rel: Object.entries(r.rel || {}).sort((x, y) => y[1] - x[1]).slice(0, 8),
    guild: p.guild ? { name: p.guild.name, rank: p.guild.rank | 0, master: gd?.master || "", n: gd ? Object.keys(gd.members).length : 0 } : null,
    delveInfo: p.delve ? { deepest: p.delve.deepest | 0, king: p.delve.king | 0 } : null,
    lz: r.lz || {}, leis: r._leis ? r._leis.kind : "", pet: r._pet ? 1 : 0, x: Math.round(p.x), y: Math.round(p.y),
    talk: (r.talk || []).slice(-16).map(x => ({ ch: x.ch, who: x.who, me: x.me, text: x.text })), talkN: topN(r.talkN, 5),
  };
}
export function thought(adv, p, sit) {                                                   // burbuja sobre la cabeza (evento botsay) con texto del modelo
  if (!p.res || typeof adv.llm !== "function" || adv.llm.ready === false) return;
  const q = (adv._sayQ ||= []), w = adv.worldFor(p.id);
  if (q.some(x => x.p === p)) return;
  q.push({ p, pre: "", sit: "you think out loud (a short thought bubble over your head): " + sit, at: w.time, lang: p.res.lang, bubble: true }); if (q.length > 14) q.shift();
  pumpSay(adv);
}
function pumpSay(adv) {
  if (adv._sayBusy) return;
  const q = adv._sayQ || [];
  while (q.length) {
    const it = q.shift(), w = adv.worldFor(it.p.id);
    if (it.p.dead || !w || w.time - it.at > 25000) continue;
    adv._sayBusy = true;
    const r = it.p.res, gc = it.pre === "@" && it.p.guild ? talkCtx(it.p, "g", 8) : "", ctx = it.pre === "@" && it.p.guild ? ` You are in the guild ${it.p.guild.name}.` + (gc ? ` Recent guild chat (you remember it): ${gc}.` : "") : "";
    Promise.resolve(adv.llm({ task: "say", who: it.p.name, lang: it.lang, system: describe(it.p, it.lang) + ctx, from: "situation", text: it.sit }))
      .then(t => { if (!t || it.p.dead) return; const tx = cleanSay(t).slice(0, 230); if (!tx) return; if (it.bubble) adv.worldFor(it.p.id).emit({ t: "botsay", id: it.p.id, es: tx, en: tx }); else sayLong(adv, it.p, it.pre, tx); })
      .catch(() => {}).finally(() => { adv._sayBusy = false; setTimeout(() => pumpSay(adv), 0); });
    return;
  }
}
const inFarm = (adv, p) => adv.worldFor(p.id) === adv.farm;

// Eventos del mundo que le importan a un habitante (lo llama World.emit): chat, órdenes rechazadas, golpes recibidos, muertes y bajas.
export function onEvent(adv, w, ev) {
  switch (ev.t) {
    case "chat": return onChat(adv, w, ev);
    case "tradedone": return tradeDone(adv, w, ev);
    case "guildchat": return onGuildChat(adv, w, ev);
    case "reject": { const b = adv.bots.get(ev.id); if (b?.res) qaReject(adv, w, b, ev); return; }
    case "damage": {
      const b = adv.bots.get(ev.id);
      if (b?.res && ev.from) {
        const f = w.ents.get(ev.from); b.res._lastHit = f?.name || "?"; b.res._lastBoss = f?.boss || 0;
        if (f?.kind === "player" && w.pvp) { b.bot.revenge = { id: f.id, until: w.time + 8000 }; if (!b.res._hitLogAt || w.time - b.res._hitLogAt > 4000) { b.res._hitLogAt = w.time; blog(w, b, `${f.name} (nv ${f.level}, bando enemigo) me ataca: -${ev.amount} (${ev.hp}/${ev.max}).`); } }
      }
      return;
    }
    case "pvpkill": {
      const k = adv.bots.get(ev.id);
      if (k?.res) { k.res.qa.pvp.k++; remember(k, "Derroté a " + ev.name + " en Promise Land.", "Defeated " + ev.name + " in Promise Land."); if (w.rng() < 0.6) speak(adv, k, fmt(k, "win", k.res.lang, ev.name, w)); }
      return;
    }
    case "companion-lost": { const b = adv.bots.get(ev.id); if (b?.res) { b.res.qa.pet.lost++; blog(w, b, `Mi summon ${ev.nm} (${ev.sp}) ha caído: pierde ${ev.loss} de experiencia (queda nivel ${ev.lvl}).`); remember(b, "Mi summon " + ev.nm + " cayó en combate.", "My summon " + ev.nm + " fell in battle."); } return; }
    case "companion-lvl": { const b = adv.bots.get(ev.id); if (b?.res) { b.res.qa.pet.lvls++; blog(w, b, `Mi summon ${ev.nm} sube al nivel ${ev.lvl}.`); } return; }
    case "companion-evolve": case "companion-resummon": { const b = adv.bots.get(ev.id); if (b?.res) blog(w, b, ev.t === "companion-evolve" ? `Mi summon ${ev.nm} va a evolucionar (etapa ${ev.step}).` : "Mi summon ha evolucionado y se vuelve a invocar."); return; }
    case "petbought": { const b = adv.bots.get(ev.id); if (b?.res) { remember(b, "Compré un summon: " + ev.sp + " llamado " + ev.nm + ".", "Bought a summon: " + ev.sp + " named " + ev.nm + "."); blog(w, b, `Compro un summon ${ev.sp} («${ev.nm}») por ${ev.price} de oro.`); } return; }
    case "pettreated": { const b = adv.bots.get(ev.id); if (b?.res) { b.res.qa.pet.heals++; b.res.qa.pet.spent += ev.cost; blog(w, b, `${ev.revived ? "Revivo" : "Curo"} a mi summon ${ev.nm} en el hospital por ${ev.cost} de oro.`); if (ev.cost > 3000) report(adv, b, "balance", "revive-cost", `Revivir a mi summon me cuesta ${ev.cost} de oro con nivel ${b.level} y ${b.gold + ev.cost} de oro: demasiado caro si cae a menudo.`, `Reviving my summon costs ${ev.cost} gold at level ${b.level} with ${b.gold + ev.cost} gold: too expensive if it falls often.`); } return; }
    case "learned": { const b = adv.bots.get(ev.id); if (b?.res && ev.uid) blog(w, b, `Enseño un hechizo a mi summon ${ev.nm}.`); return; }
    case "death": {
      const dead = adv.bots.get(ev.id);
      if (dead?.res) { const kf = w.ents.get(ev.by); dead.res._killer = kf?.name || dead.res._lastHit || "?"; dead.res._killBoss = kf ? (kf.boss || 0) : (dead.res._lastBoss || 0); if (kf?.kind === "player") { dead.res._pvpDeath = true; dead.res.qa.pvp.d++; } return; }
      const kb = w.ents.get(ev.by), b = ev.pet ? null : adv.bots.get(ev.by) || (kb?.comp ? adv.bots.get(kb.master) : null), n = w.ents.get(ev.id);
      if (b?.res && n?.kind === "npc") { b.res.qa.kills[n.name] = (b.res.qa.kills[n.name] || 0) + 1; if (kb?.comp) b.res.qa.pet.kills++; }
      if (ev.pet) { const o = adv.bots.get(ev.pet); if (o?.res) { o.res.qa.pet.kills++; o.res.qa.kills[n?.name] = (o.res.qa.kills[n?.name] || 0) + 1; } }
    }
  }
}
// Un jugador habla cerca de un habitante: el más cercano (o el nombrado) responde tras una pausa.
export function onChat(adv, w, ev) {
  if (!ev.id || ev.system || !ev.text) return;
  const human = w.ents.get(ev.id); if (!human) return;
  const fromBot = adv.bots.get(ev.id), depth = fromBot?.res ? (fromBot.res._depth ?? 0) : 0;
  if (adv.bots.has(ev.id)) {                                                          // un habitante habla a otro: solo del mismo bando, de cerca, con poca probabilidad y sin cadenas largas
    if (!fromBot.res || depth >= 6) return;
  }
  const text = String(ev.text), low = text.toLowerCase();
  const th = fromBot ? noteThread(adv, w, human, ev.text) : null;                       // HILO: lo dicho se apunta para que quien conteste sepa de qué se habla
  if (fromBot && w.rng() > (th ? 0.85 : 0.5)) return;                                   // dentro de un hilo vivo casi siempre contestan; fuera, rara vez
  let best = null, bd = 1e9;
  for (const b of adv.bots.values()) {
    if (b === human || !b.res || b.dead || adv.worldFor(b.id) !== w || (b.res.reply && (fromBot || !b.res.reply.toBot))) continue;      // una persona tiene prioridad sobre la charla entre habitantes
    const inThread = !!th && th.who.includes(b.name);
    if (fromBot && (b.side !== fromBot.side || w.time - (b.res._rcd || -1e9) < (inThread ? 5000 : 20000))) continue;
    const named = low.includes(b.name.toLowerCase()), d = dist(b, human);
    if (d > (fromBot ? (inThread ? 10 : 7) : named ? 40 : 10)) continue;
    const s = d - (named ? 100 : 0) - (inThread ? 50 : 0);
    if (s < bd) { best = b; bd = s; }
  }
  if (best) queueReply(adv, w, best, human, text, depth + 1);
}
// CONVERSACIÓN ANCLADA AL JUEGO: cuando un humano habla, el modelo recibe los HECHOS reales del habitante (guild, rango, grupo, nivel, afinidad, distancia…) y la lista
// de ACCIONES que puede hacer ahora mismo, y responde {say, do}. La acción se ejecuta con las mismas órdenes del juego (guildinvite, party…), así que lo que dice
// coincide con lo que pasa: un Guildmaster que acepta de verdad te invita al guild; quien no es Guildmaster explica que no puede.
function groundedFacts(adv, w, p, human) {
  const r = p.res, es = r.lang !== "en", G = Guild.guildOf(w, p), rel = relOf(p, human.name), d = Math.max(Math.abs(p.x - human.x), Math.abs(p.y - human.y));
  const facts = [], acts = [];
  const members = G ? Object.keys(G.members).length : 0;
  if (G && G.members[p.name] === 0) facts.push(`You are the Guildmaster of the guild "${G.name}" (${members}/${Guild.MAX_MEMBERS} members).`);
  else if (G) facts.push(`You are a member of the guild "${G.name}" but NOT its leader (${G.master}); only the Guildmaster can invite people.`);
  else facts.push(`You are not in any guild. Founding one needs level ${Guild.MIN_LEVEL} and charisma ${Guild.MIN_CHR} (you are level ${p.level}, charisma ${p.stats.chr}).`);
  facts.push(`You are level ${p.level}; your goal now: ${goalText(r.goal, "en") || "none"}.`);
  facts.push(`${human.name} is level ${human.level}, ${human.side === p.side ? "from your own side" : "from the ENEMY side"}, ${human.guild ? `in the guild "${human.guild.name}"` : "in no guild"}, ${d} tiles from you. Your affinity with ${human.name}: ${rel >= 5 ? "good friends" : rel >= 3 ? "friendly" : rel >= 1 ? "acquaintances" : "strangers"} (${rel}).`);
  if (p.party) facts.push(`You are in a party with ${p.party.names.filter(x => x !== p.name).join(", ") || "nobody else"}.`);
  if (G && G.members[p.name] === 0 && members < Guild.MAX_MEMBERS && !human.guild && !human.guildQuery && human.side === p.side && d <= 10 && !human.dead) acts.push("guild_invite (invite them to your guild right now)");
  else if (G && G.members[p.name] === 0 && d > 10) facts.push(`${human.name} is too far away to be invited; they should come closer.`);
  const friendly = human.side === p.side || !human.side || !p.side;
  if (!p.bot.owner && !r._trip && !r._delve && !r._stall && friendly && !human.dead) acts.push("party_follow (join their party and follow them for a while)");
  if (!human.party && !p.party && !human.partyQuery && friendly) acts.push("party_invite (send them a party invitation)");
  return { facts: facts.join(" "), acts };
}
function askGrounded(adv, w, p, human, text, lang) {
  const r = p.res, n = human.name, { facts, acts } = groundedFacts(adv, w, p, human);
  const rep = { at: w.time + 4500, text: "", to: n, lang, depth: 0, act: null };
  p.bot.hold = Math.max(p.bot.hold || 0, w.time + 9000); p.bot.path = null;          // atiende a quien le habla: se queda charlando (22 s; cada mensaje nuevo renueva el plazo)
  r.reply = rep; adv._reflecting ||= false;
  const sys = describe(p, lang) + " FACTS: " + facts + " ALLOWED ACTIONS: " + (acts.length ? acts.map(a => a.split(" ")[0]).join(", ") + ", none" : "none only") + ".";
  Promise.resolve(adv.llm({ task: "act", who: p.name, lang, system: sys, from: n, text })).then(t => {
    if (!t || r.reply !== rep) return;
    let j = null; try { const m = /\{.*\}/s.exec(String(t)); j = m && JSON.parse(m[0]); } catch {}
    if (j && typeof j === "object") { rep.text = cleanSay(j.say).slice(0, 230); const a = String(j.do || "none").trim().split(/\s/)[0]; if (acts.some(x => x.split(" ")[0] === a)) rep.act = a; }
    else { rep.text = cleanSay(t).slice(0, 230); const a =/"do"\s*:\s*"([a-z_]+)/.exec(String(t))?.[1]; if (a && acts.some(x => x.split(" ")[0] === a)) rep.act = a; fallbackAct(); }
  }).catch(() => fallbackAct());
  // si el modelo falla o no devuelve JSON, una petición clara de grupo se atiende igualmente (hechos reales, sin frases)
  function fallbackAct() { if (r.reply === rep && !rep.act && intentOf(text) === "party" && acts.some(x => x.startsWith("party_follow")) && relOf(p, n) >= 1) rep.act = "party_follow"; }
}
function doAct(adv, w, p, rep) {
  const r = p.res, h = [...w.ents.values()].find(e => e.kind === "player" && e.name === rep.to && !adv.bots.has(e.id)); if (!h || !rep.act) return;
  if (rep.act !== "party_follow" && dist(p, h) > 8) { r._pend = { ...rep, until: w.time + 25000 }; return; }          // lo dijo y se acerca a cumplirlo (la invitación exige estar cerca)
  if (rep.act === "guild_invite") { if (adv.command(p.id, { t: "guildinvite", name: h.name })) { befriend(p, h.name, 1); blog(w, p, `Invito a ${h.name} a mi guild (me lo pidió en el chat).`); } }
  else if (rep.act === "party_follow") { if (p.bot.owner == null) { p.bot.owner = h.id; r.followUntil = w.time + 5 * 60000; p.bot.partyAt = w.time + 3000; befriend(p, h.name, 1); blog(w, p, `Acompaño a ${h.name} (me lo pidió en el chat).`); } }
  else if (rep.act === "party_invite") { if (Party.request(w, p, h.name)) blog(w, p, `Invito a ${h.name} a un grupo (me lo pidió en el chat).`); }
}
// HILO DE CONVERSACIÓN entre habitantes: las últimas frases del grupo que charla (par de interlocutores, 45 s de vida). Quien contesta las recibe como contexto.
function noteThread(adv, w, speaker, text) {
  const T = (adv._threads ||= []), near = n => { const q = adv.bots.get([...adv.bots.keys()].find(k => adv.bots.get(k).name === n)); return q && dist(q, speaker) <= 8; };
  let th = T.find(t => w.time - t.at < 45000 && (t.who.includes(speaker.name) || t.who.some(near)));
  const fresh = !th;
  if (!th) { th = { who: [], lines: [], at: w.time }; T.push(th); if (T.length > 12) T.shift(); }
  if (!th.who.includes(speaker.name) && th.who.length < 4) th.who.push(speaker.name);
  th.lines.push(speaker.name + ": " + String(text).slice(0, 160)); if (th.lines.length > 6) th.lines.shift(); th.at = w.time;
  return fresh ? null : th;
}
const threadOf = (adv, w, a, b) => (adv._threads || []).find(t => w.time - t.at < 45000 && t.who.includes(a) && t.who.includes(b));
// ÓRDENES (orders.js). true = ya está respondido. Si no entiende lo que debe cazar, pregunta; si la segunda respuesta tampoco se entiende, abre un ticket.
const SAY = {
  hunt: { es: "¡Vamos! Voy contigo a por {m}.", en: "Let's go! I'm with you, hunting {m}." },
  ek: { es: "¡Va! Te sigo a hacer EK, solo a los enemigos.", en: "On it! I'll follow you for EK, enemies only." },
  ask: { es: "No sé qué quieres que cace: ¿cómo se llama la criatura?", en: "I'm not sure what to hunt: what is the creature called?" },
  giveup: { es: "Sigo sin entenderlo. Se lo paso a los desarrolladores para aprenderlo.", en: "I still don't get it. I'll pass it on to the devs so I can learn it." },
  pickup: { es: "¡Voy, lo recojo!", en: "On it, I'll pick it up!" },
  no: { es: "Vale, lo dejo.", en: "Okay, forget it." },
};
function obey(adv, w, p, human, text, lang) {
  const r = p.res, n = human.name, say = (k, m = "") => { r.reply = { at: w.time + 900 + Math.floor(w.rng() * 800), text: SAY[k][lang].replace("{m}", m), follow: k === "hunt" || k === "ek" ? n : null, to: n, lang, depth: 0, toBot: false }; return true; };
  const go = o => { if (p.bot.owner != null && p.bot.owner !== human.id) return false; p.bot.only = o.kind === "hunt" ? o.mob : "@ek"; p.bot.owner = human.id; r.followUntil = w.time + 10 * 60000; p.bot.partyAt = w.time + 3000; return true; };
  const q = r._ask && r._ask.to === n && w.time - r._ask.at < 60000 ? r._ask : null; r._ask = null;
  if (q) {
    const mob = Orders.mobOf(text), yn = Orders.answerOf(text);
    if (mob) { go({ kind: "hunt", mob }); return say("hunt", mob); }
    if (yn === false) return say("no");
    adv.order?.({ bot: p.name, user: n, text: q.text + " / " + text, map: w.map.name || w.map.id, x: p.x, y: p.y });   // ticket: el bot no entendió la orden (texto a enseñarle)
    return say("giveup");
  }
  const o = Orders.parse(text);
  if (!o) return false;
  if (o.kind === "unsure") { r._ask = { to: n, at: w.time, text }; return say("ask"); }
  if (o.kind === "pickup") { p.bot.pickFrom = human.id; p.bot.pickUntil = w.time + 30000; return say("pickup"); }   // 30 s para recoger lo que tiró este jugador
  go(o); return say(o.kind, o.mob);
}
function queueReply(adv, w, p, human, text, depth = 0) {
  const r = p.res, lang = langOf(text), n = human.name, intent = human.res && intentOf(text) === "party" ? "other" : intentOf(text);      // entre habitantes una frase suelta de «vamos» no forma grupo (eso lo deciden ellos en el consejo, council.js)
  const th = human.res ? threadOf(adv, w, p.name, n) : null;
  const old = human.res ? talkCtx(p, "l", 4, n) : "", ctx = (th && th.lines.length > 1 ? "(Conversation so far: " + th.lines.slice(0, -1).join(" / ") + ") " : "") + (old && !th ? "(You talked to " + n + " before: " + old + ") " : "");
  (r.hl ||= {})[n] = lang;
  befriend(p, n, 1); r.chats++; r._rcd = w.time;
  if (human.res) logTalk(p, w, n, text, "l");
  if (!human.res && obey(adv, w, p, human, text, lang)) return;                         // órdenes del glosario (orders.js): no pasan por el modelo
  if (!human.res && typeof adv.llm === "function" && adv.llm.ready !== false) return askGrounded(adv, w, p, human, text, lang);
  let key = human.res && intent === "other" ? "banterr" : intent, extra = null;
  if (intent === "party") { key = relOf(p, n) >= 2 || w.rng() < 0.5 ? "yes" : "shy"; extra = key === "yes" ? n : null; }
  r.reply = { at: w.time + 1200 + Math.floor(w.rng() * 1500), text: fmt(p, key, lang, n, w), follow: extra, to: n, lang, depth, toBot: !!human.res };
  if (typeof adv.llm === "function" && adv.llm.ready !== false && intent !== "party") {                       // el modelo contesta a lo que dijo el interlocutor (sin él, calla)
    const rep = r.reply; rep.at += 3000; rep.text = "";
    Promise.resolve(adv.llm({ who: p.name, lang, system: describe(p, lang), from: n, text: ctx + text })).then(t => { if (t && r.reply === rep) rep.text = cleanSay(t); }).catch(() => {});
  }
}

const CH = { speak: (adv, p, t) => speak(adv, p, t), blog, remember: (p, a, b) => remember(p, a, b), relOf: (p, who) => relOf(p, who), cryptNeed: (r, L) => cryptNeed(r, L),
  leave(adv, m, lead, why) { const w = adv.worldFor(m.id); m.bot.owner = null; m.bot.only = null; m.bot.partyAt = 0; m.res._leaveAt = 0; try { Party.leave(w, m, true); } catch {} blog(w, m, `Dejo el grupo de ${lead.name}: ${why}.`); remember(m, "Dejé el grupo de " + lead.name + " por desacuerdo.", "I left " + lead.name + "'s party over a disagreement."); befriend(m, lead.name, -1); } };
export function think(adv, p) {
  const r = p.res, w = adv.worldFor(p.id);
  if (!r || w.time < r.next) return;
  r.next = w.time + 500; r._w = w;
  { let es = 0, en = 0; for (const e of w.ents.values()) if (e.kind === "player" && e.uiLang && !adv.bots.has(e.id)) e.uiLang === "en" ? en++ : es++; if (es + en) r.lang = en > es ? "en" : "es"; }     // todos hablan el idioma de los clientes presentes
  Council.tick(adv, CH);                                                                  // los grupos debaten qué hacer (council.js)
  const home = adv.homeOf(p);
  if (r.greply && w.time >= r.greply.at) { const g = r.greply; r.greply = null; if (!p.dead && p.guild) gsay(adv, p, g.text); }
  // respuesta pendiente
  if (r.reply && w.time >= r.reply.at) {
    const rep = r.reply; r.reply = null;
    if (!p.dead) {
      r._depth = rep.depth || 0; if (rep.text && rep.toBot) logTalk(p, w, rep.to, rep.text, "l", true); speak(adv, p, rep.text); if (rep.act) doAct(adv, w, p, rep);
      if (rep.follow && !r.followUntil) { const h = [...w.ents.values()].find(e => e.kind === "player" && e.name === rep.to && !adv.bots.has(e.id)); if (h) { p.bot.owner = h.id; r.followUntil = w.time + 5 * 60000; remember(p, "Acompañé a " + rep.to + " un rato.", "Tagged along with " + rep.to + " for a while."); } }
    }
  }
  if (r.followUntil && w.time > r.followUntil) {                                     // se acabó el acompañamiento: vuelve a su vida
    r.followUntil = 0; p.bot.owner = null; p.bot.only = null; Party.leave(w, p, true);
    if (w !== home) { adv.transfer(p, w, home, home.home); p.bot.home = { x: p.x, y: p.y }; p.bot.path = null; p.bot.target = null; }
  }
  if (r._wid !== w.map.id) worldChanged(adv, w, p, r, home);
  if (p.dead) { if (!r.deadSeen) { r.deadSeen = true; r.deaths++; learnFromDeath(w, p, r); shareDeath(adv, w, p, r); remember(p, r._pvpDeath ? "Me mató " + (r._killer || "un enemigo") + " en Promise Land." : "Morí en combate.", r._pvpDeath ? (r._killer || "An enemy") + " killed me in Promise Land." : "I died in battle."); if (w.rng() < 0.5) speak(adv, p, fmt(p, r._pvpDeath ? "lose" : "died", r.lang, "", w)); r._pvpDeath = false; } qaTick(adv, w, p, r); return; }
  r.deadSeen = false;
  if (Human.afk(adv, w, p, r)) return;                                                    // pausa AFK (human.js)
  Human.slip(adv, w, p, r); Human.chatter(adv, w, p, r, speak);
  if (p.level > r.lvl) { r.lvl = p.level; remember(p, "Subí al nivel " + p.level + ".", "Reached level " + p.level + "."); if (p.bot.owner == null && w.rng() < 0.7) speak(adv, p, fmt(p, "level", r.lang, "", w)); }
  if (goalDone(p)) {
    const g = goalText(r.goal, "es"), ge = goalText(r.goal, "en");
    remember(p, "Cumplí mi meta: " + g + ".", "Achieved my goal: " + ge + "."); speak(adv, p, fmt(p, "goal", r.lang, "", w)); newGoal(w, p);
  }
  qaTick(adv, w, p, r);
  // fuera de la granja (entró a una tienda o a la cripta pisando un teletransporte mientras paseaba): se queda un rato probando y vuelve
  if (w !== home && !p.bot.owner && !r._trip && !r._delve && !r._pet && !r._stall) {
    r._away ??= w.time;
    if (w.time - r._away > 45000 && !p.dead) { r._away = null; remember(p, "Entré en " + (w.map.name || w.map.id) + " y volví.", "I went into " + (w.map.name || w.map.id) + " and came back."); adv.transfer(p, w, home, home.home); p.bot.home = { x: p.x, y: p.y }; p.bot.path = null; p.bot.target = null; }
  } else r._away = null;
  const tg = p.bot.target;                                                         // se burla del enemigo al que va a atacar
  if (tg?.kind === "player" && r._tauntId !== tg.id) { r._tauntId = tg.id; if (w.rng() < 0.5) speak(adv, p, fmt(p, "taunt", r.lang, tg.name, w)); }
  pits(adv, w, p, r);
  if (r.scare && w.time - (r.scareAt || 0) > 480000) { r.scare--; r.scareAt = w.time; }          // el miedo a morir se va pasando
  reflect(adv, w, p, r);
  if (r._pend) {
    const pd = r._pend, h = [...w.ents.values()].find(e => e.kind === "player" && e.name === pd.to && !adv.bots.has(e.id));
    if (!h || h.dead || w.time > pd.until || p.dead) r._pend = null;
    else if (dist(p, h) <= 8) { r._pend = null; doAct(adv, w, p, pd); }
    else if (!p.bot.travel || w.time - (r._pendAt || 0) > 2500) { r._pendAt = w.time; p.bot.travel = { x: h.x, y: h.y, w, until: w.time + 20000, seek: true }; p.bot.path = null; p.bot.target = null; }
  }
  partyAndTrade(adv, w, p, r);
  guildAI(adv, w, p, r, home);
  gather(adv, w, p, r, home);
  stallAI(adv, w, p, r, home);
  { const lh = leisureH(adv); Leisure.tick(adv, w, p, r, home, lh); Leisure.backupTick(adv, w, p, r, home, Guild.guildOf(w, p), lh); }
  pets(adv, w, p, r, home);
  rebuild(adv, w, p, r, home);
  expedition(adv, w, p, r, home);
  social(adv, w, p, r);
  // saludar a quien llega
  const seen = (r.seen ||= {});
  for (const e of w.ents.values()) {
    if (e.kind !== "player" || adv.bots.has(e.id) || e.dead || dist(e, p) > 6) continue;
    if (w.time - (seen[e.name] || -1e9) < 300000) continue;
    seen[e.name] = w.time;
    if (w.rng() < ARCH[r.arch].talk) { const again = relOf(p, e.name) > 0; say2(adv, w, p, again ? "again" : "greet", e.name); befriend(p, e.name, 1); }
    break;
  }
  // admirar un summon de nivel máximo ajeno
  const adm = (r.admired ||= {});
  for (const e of w.ents.values()) {
    if (e.kind !== "player" || adv.bots.has(e.id) || e.dead || dist(e, p) > 8 || !e.bag) continue;
    if (!e.bag.some(i => i.comp?.on && i.comp.lvl >= Sch.TRADE_LEVEL)) continue;
    if (w.time - (adm[e.name] || -1e9) < 600000) continue;
    adm[e.name] = w.time;
    if (w.rng() < 0.8) { say2(adv, w, p, "admire", e.name); befriend(p, e.name, 1); }
    break;
  }
  // charla suelta con otro habitante o consigo mismo
  if (!p.bot.owner && w.time > (r.idleAt ||= w.time + 40000 + Math.floor(w.rng() * 90000))) {
    r.idleAt = w.time + 90000 + Math.floor(w.rng() * 150000);
    if (w.rng() < ARCH[r.arch].talk) say2(adv, w, p, "idle", "");
  }
}

// APRENDIZAJE CON EL MODELO: cada diez minutos aprox. el habitante «reflexiona» sobre su experiencia (muertes, presas, oro, recuerdos) y el modelo de lenguaje
// le devuelve una lección y ajustes concretos: monstruos a evitar (`dlv`), a priorizar (`focus`) y cuánta prudencia (`scare`). La lección se guarda (`insights`)
// y se incluye en lo que el modelo sabe de él, así que las conversaciones y las siguientes reflexiones lo tienen en cuenta. Sin modelo no hace nada.
function reflect(adv, w, p, r) {
  if (typeof adv.llm !== "function" || adv.llm.ready === false || p.dead || adv._reflecting) return;
  if (w.time < (r._refAt ||= w.time + 90000 + Math.floor(w.rng() * 240000))) return;
  const top = (o, n) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} x${v}`).join(", ") || "none";
  const text = `level ${p.level}, deaths ${r.deaths | 0}, killed by: ${top(r.qa?.deaths, 4)}; kills: ${top(p.kinds, 6)}; gold ${p.gold}; best item level ${Math.max(0, ...p.bag.map(i => itemLevel(w.data.item(i.id), i.attr, i.id) | 0))}; avoiding: ${Object.keys(r.dlv || {}).join(", ") || "none"}; goal ${goalText(r.goal, "en") || "none"}; memories: ${(r.mem || []).slice(-4).map(m => m.en).join(" / ")}`;
  const known = new Set([...Object.keys(p.kinds || {}), ...Object.keys(r.qa?.deaths || {}), ...Object.keys(r.qa?.kills || {})].filter(k => w.npcDb[k]));
  r._refAt = w.time + 480000 + Math.floor(w.rng() * 360000); adv._reflecting = true;
  Promise.resolve(adv.llm({ task: "reflect", who: p.name, lang: r.lang, system: describe(p, r.lang), from: "stats", text })).then(t => {
    if (!t) { r._refAt = w.time + 60000; return; }
    let j = null; try { const m = /\{.*\}/s.exec(String(t)); j = m && JSON.parse(m[0]); } catch {}
    if (!j || typeof j !== "object") return;
    const lesson = String(j.lesson || "").slice(0, 160); if (lesson.length < 8) return;
    const names = a => (Array.isArray(a) ? a : []).map(x => String(x).trim().replace(/ /g, "-")).filter(x => known.has(x)).slice(0, 4);
    const avoid = names(j.avoid), focus = names(j.focus), caution = Math.max(0, Math.min(3, Math.round(+j.caution || 0)));
    (r.insights ||= []).push({ t: lesson, avoid, focus, caution, at: Math.round(w.time / 1000), lv: p.level }); if (r.insights.length > 12) r.insights.shift();
    for (const n of avoid) { (r.dlv ||= {}); if ((r.dlv[n] || 0) < p.level) r.dlv[n] = p.level; }
    r.focus = Object.fromEntries(focus.map(n => [n, w.time + 20 * 60000]));
    if (caution > (r.scare | 0)) { r.scare = caution; r.scareAt = w.time; }
    blog(w, p, `🧠 Reflexión (IA): ${lesson}${avoid.length ? " · evito " + avoid.join(", ") : ""}${focus.length ? " · priorizo " + focus.join(", ") : ""}${caution ? " · prudencia " + caution : ""}`);
    remember(p, "Aprendí: " + lesson, "Learned: " + lesson);
  }).catch(() => {}).finally(() => { adv._reflecting = false; });
}

// APRENDIZAJE: al morir apunta qué lo mató y a qué nivel (bot.js tooStrong lo evita hasta llevar +3 niveles) y, en la cripta, en qué piso (la bajada
// exige entonces 5 niveles más por cada muerte allí). Se guarda en la ficha del habitante (`dlv`, `dd`).
function learnFromDeath(w, p, r) {
  const k0 = r._killer || r._lastHit, k = k0 && r._killBoss ? k0 + "*" + r._killBoss : k0, ks = k && w.map.kind === "dungeon" ? k + "@" + w.map.level : k;          // los jefes de la cripta se aprenden aparte de su especie
  if (!r._pvpDeath && k && k !== "?" && !adv_isPlayer(w, k)) { (r.dlv ||= {})[ks] = Math.max(r.dlv[ks] || 0, p.level); (r.dlt ||= {})[ks] = w.time; blog(w, p, `Aprendo: «${k}»${ks !== k ? " en el piso " + w.map.level : ""} me mató a nivel ${p.level}; no lo peleo hasta el ${p.level + 3}.`); }
  // MORIR ES MALO (además de la pérdida de experiencia del juego): pierde oro, recuerda el miedo (más prudencia durante un rato) y no se arriesga igual
  const lostGold = Math.floor(p.gold * 0.1); ledger(w, p, -lostGold, "resident_death"); r.scare = Math.min(5, (r.scare || 0) + 1); r.scareAt = w.time;
  if (r._pvpDeath) { r.grudge = w.time + 15 * 60000; blog(w, p, "Me mató un enemigo en Promise Land: quiero la revancha."); }          // rencor: el grupo tenderá a volver a Promise Land
  blog(w, p, `Morir me cuesta: pierdo ${lostGold} de oro y experiencia; seré más prudente.`);
  if (w.map.kind === "dungeon") { (r.dd ||= {})[w.map.level] = (r.dd[w.map.level] || 0) + 1; blog(w, p, `Aprendo: morí en la cripta nivel ${w.map.level}; bajaré más fuerte.`); }
}
const adv_isPlayer = (w, name) => { for (const e of w.ents.values()) if (e.kind === "player" && e.name === name) return true; return false; };
// Nivel mínimo para bajar al piso L de la cripta (sube 5 por cada muerte que ya tuvo en ese piso)
export const cryptNeed = (r, L) => 3 + 2 * (L - 1) + (L >= 4 ? 4 : 0) + 5 * (r.dd?.[L] || 0);

// ---------------------------------------------------------------- probador (QA): los habitantes juegan y avisan de lo que ven
// Cada informe: { bot, lvl, lang, kind, topic, es, en, map, x, y }.  kind: bug (algo falla) · comfort (incómodo) · balance (números) · idea.
// `adv.report` lo pone el servidor (server/report.mjs), que agrupa por kind+topic y escribe el informe legible. Cada tema se repite como mucho
// cada 10 minutos por habitante; así 40 bots no inundan el informe y se ve cuántos coinciden.
const QUIET = new Set(["ocupado", "demasiado rápido", "muerto", "sin resistencia", "no tienes guild", "nivel insuficiente para este canal", "no puede comerciar ahora", "no se puede ofrecer"]);                 // rechazos normales de un bot que insiste, no son un fallo
export function report(adv, p, kind, topic, es, en, extra = {}) {
  const r = p.res, w = adv.worldFor(p.id), k = kind + ":" + topic, rep = (r._rep ||= {});
  if (w.time - (rep[k] ?? -1e9) < 600000) return false;
  rep[k] = w.time;
  adv.report?.({ bot: p.name, lvl: p.level, lang: r.lang, kind, topic, es, en, map: w.map.name || w.map.id, x: p.x, y: p.y, ...extra });
  return true;
}
function qaReject(adv, w, p, ev) {
  if (QUIET.has(ev.why) || (ev.cmd === "move" && ev.why === "bloqueado")) return;       // ruido de la ruta del bot, no un fallo del juego
  const q = p.res.qa.rej, k = ev.cmd + ": " + ev.why;
  q[k] = (q[k] || 0) + 1;
  if (q[k] >= 3 && q[k] % 3 === 0) report(adv, p, "comfort", "rej:" + k, `La orden «${ev.cmd}» se rechaza: «${ev.why}» (${q[k]} veces). ¿Falta una pista en pantalla?`, `The «${ev.cmd}» command gets rejected: «${ev.why}» (${q[k]} times). Is a hint missing on screen?`);
}
const top = (o, n = 3) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => k + " x" + v).join(", ") || "-";
function qaTick(adv, w, p, r) {
  const b = p.bot;
  if (b?.broken && !r._brokenRep) { r._brokenRep = true; report(adv, p, "bug", "brain", "Mi cerebro de bot se ha parado por un error interno.", "My bot brain stopped on an internal error."); }
  // muertes: contra qué y a qué nivel
  if (p.dead && !r._deathLogged) {
    r._deathLogged = true; const m = r._killer || r._lastHit || "?"; r.qa.deaths[m] = (r.qa.deaths[m] || 0) + 1;
    if (m !== "?") report(adv, p, "balance", "death:" + m, `Me mata «${m}» siendo nivel ${p.level} (vida máx. ${p.maxHp}, ${r.qa.deaths[m]} veces). ¿Demasiado fuerte aquí?`, `«${m}» kills me at level ${p.level} (max HP ${p.maxHp}, ${r.qa.deaths[m]} times). Too strong here?`, { n: r.qa.deaths[m] });
  } else if (!p.dead) r._deathLogged = false;
  if (w.time < (r._qaAt ||= w.time + 20000)) return;
  r._qaAt = w.time + 20000;
  if (p.dead) return;
  // atascado (solo en la granja: dentro de tiendas y criptas el bot no sabe qué hacer y vuelve solo)
  if (w !== adv.homeOf(p)) { r._pt = w.time; r._px = -1; }       // quieto > 40 s sin descansar ni pelear = atascado
  else if (r._px !== p.x || r._py !== p.y || b.rest || r._gather || r._leis || w.time - p.lastCombat < 6000 || w.busy(p) || (b.owner != null && adv.bots.get(b.owner) && dist(adv.bots.get(b.owner), p) <= 4)) { r._px = p.x; r._py = p.y; r._pt = w.time; r._stuckN = 0; }
  else if (w.time - r._pt > 40000) {
    r._pt = w.time;
    b.path = null; b.goal = null; b.wander = null; b.target = null; b.fails = 0; b.ignore?.clear?.();          // se desatasca solo: olvida camino y objetivo y, a la segunda vez seguida, usa Recall (vuelve a la ciudad)
    if ((r._stuckN = (r._stuckN | 0) + 1) >= 2 && !p.recallTok) { r._stuckN = 0; blog(w, p, "Sigo atascado: uso Recall."); adv.command(p.id, { t: "recall" }); } else b.hold = w.time + 500;
    b.stuck = { why: "sin progreso", since: w.time - 40000 };
    report(adv, p, "bug", "stuck:" + (w.map.id || "") + ":" + (p.x >> 3) + "," + (p.y >> 3), `Me quedo parado/atascado cerca de (${p.x},${p.y}) en ${w.map.name || w.map.id}.`, `I'm stuck near (${p.x},${p.y}) in ${w.map.name || w.map.id}.`);
  }
  if (b.stuck && w.time - (b.stuck.last ?? b.stuck.since) > 8000) b.stuck = null;                                // ya se resolvió: no es un bloqueo
  if (b.stuck && w.time - b.stuck.since > 30000) {                                      // detector de bloqueos (v0.77.0): munición, acción cancelada o sin progreso; queda en el informe y en `b.stuck`
    report(adv, p, "bug", "stuck-" + b.stuck.why, `Estoy bloqueado (${b.stuck.why}) desde hace ${Math.round((w.time - b.stuck.since) / 1000)} s en ${w.map.name || w.map.id}.`, `I'm blocked (${b.stuck.why}) for ${Math.round((w.time - b.stuck.since) / 1000)} s in ${w.map.name || w.map.id}.`);
    ObsStats.ask(adv, p, "stuck-" + b.stuck.why, "Bots bloqueados (" + b.stuck.why + "): revisar.", "Blocked bots (" + b.stuck.why + "): needs a look.");
    b.stuck = null;
  } else if (b.stuck && w.time - b.stuck.since > 90000) b.stuck = null;
  if (p.weight > p.maxLoad * 0.92) report(adv, p, "comfort", "weight", `Voy casi al límite de peso (${p.weight}/${p.maxLoad}) y no lo he visto avisar.`, `I'm near the weight limit (${p.weight}/${p.maxLoad}) and nothing warned me.`);
  { const pb = p.bag.find(i => i.comp);                                                    // le pone un nombre propio a su summon (una vez): más cariño
    if (pb && !r.petNamed) { r.petNamed = 1; const PETN = ["Bruno", "Luna", "Kiko", "Sombra", "Nube", "Rayo", "Chispa", "Toby", "Mochi", "Fénix", "Copo", "Ámbar", "Trufa", "Thor", "Milo", "Nala", "Bola", "Pipo"]; if (Comp.rename(w, p, PETN[Math.floor(w.rng() * PETN.length)])) { blog(w, p, `Le pongo nombre a mi summon: ${pb.comp.nm}.`); remember(p, "Bauticé a mi summon " + pb.comp.nm + ".", "I named my summon " + pb.comp.nm + "."); } } }
  { const ball = p.bag.find(i => i.comp && i.comp.on), lv = ball && liveOf(w, p);                       // summons: ¿sigue a su dueño?
    if (ball && !lv && !ball.comp.down && !w.fightZone && w.map.kind !== "dungeon") { if ((r._petGone = (r._petGone | 0) + 1) >= 3) report(adv, p, "bug", "pet-missing", `Mi summon ${ball.comp.nm} figura como invocado pero no aparece en el mapa (${w.map.name || w.map.id}).`, `My summon ${ball.comp.nm} counts as summoned but is not on the map (${w.map.name || w.map.id}).`); } else r._petGone = 0;
    if (lv && dist(p, lv) > 18 && !b.travel) { if ((r._petFar = (r._petFar | 0) + 1) >= 3) report(adv, p, "bug", "pet-far", `Mi summon ${ball.comp.nm} se queda a ${dist(p, lv)} casillas de mí y no me alcanza (${w.map.name || w.map.id}, ${p.x},${p.y}).`, `My summon ${ball.comp.nm} stays ${dist(p, lv)} tiles away and doesn't catch up (${w.map.name || w.map.id}, ${p.x},${p.y}).`); } else r._petFar = 0; }
  if (p.bag.length >= 46) report(adv, p, "comfort", "bagfull", "La mochila (50 huecos) se llena enseguida; no hay forma rápida de vender o tirar lo inútil.", "The 50-slot bag fills up fast; no quick way to sell or drop junk.");
  if (p.level >= 8 && p.gold < 60) report(adv, p, "balance", "poor", `Nivel ${p.level} y solo ${p.gold} de oro: las pociones y el equipo cuestan más de lo que gano.`, `Level ${p.level} with only ${p.gold} gold: potions and gear cost more than I earn.`);
  if (p.gold > 20000) report(adv, p, "idea", "goldsink", `Tengo ${p.gold} de oro y nada útil en que gastarlo: faltan sumideros de oro.`, `I hold ${p.gold} gold with nothing worthwhile to spend it on: gold sinks are missing.`);
  // ritmo: cada ~8 min exp/min, muertes y bajas
  if (!r._paceAt) { r._paceAt = w.time + 480000; r._paceExp = p.exp; r._paceK = Object.values(r.qa.kills).reduce((a, c) => a + c, 0); r._paceD = Object.values(r.qa.deaths).reduce((a, c) => a + c, 0); }
  else if (w.time >= r._paceAt) {
    const mins = 8, k = Object.values(r.qa.kills).reduce((a, c) => a + c, 0), d = Object.values(r.qa.deaths).reduce((a, c) => a + c, 0), xp = Math.round((p.exp - r._paceExp) / mins);
    report(adv, p, "balance", "pace:L" + p.level, `Nivel ${p.level}: ${xp} exp/min, ${Math.round((k - r._paceK) / mins * 10) / 10} bajas/min, ${d - r._paceD} muertes en ${mins} min. Más habituales: ${top(r.qa.kills)}.`,
      `Level ${p.level}: ${xp} exp/min, ${Math.round((k - r._paceK) / mins * 10) / 10} kills/min, ${d - r._paceD} deaths in ${mins} min. Most common: ${top(r.qa.kills)}.`, { xpmin: xp, deaths: d - r._paceD });
    { const ball = p.bag.find(i => i.comp && !i.comp.bad), q = r.qa.pet;
      if (ball) {
        report(adv, p, "balance", "pet:" + ball.comp.sp, `Summon ${ball.comp.sp} «${ball.comp.nm}» nivel ${ball.comp.lvl} (yo ${p.level}): ${q.kills} bajas suyas, ${q.lost} caídas, ${q.heals} visitas al hospital (${q.spent} de oro gastado).`, `${ball.comp.sp} summon «${ball.comp.nm}» level ${ball.comp.lvl} (me ${p.level}): ${q.kills} kills, ${q.lost} falls, ${q.heals} hospital visits (${q.spent} gold spent).`, { petlvl: ball.comp.lvl, lost: q.lost });
        if (p.level - ball.comp.lvl > 12) report(adv, p, "balance", "pet-slow", `Mi summon va al nivel ${ball.comp.lvl} y yo al ${p.level}: sube demasiado despacio (solo recibe el ${Math.round(Comp.OWNER_SHARE * 100)} % de mi experiencia).`, `My summon is level ${ball.comp.lvl} while I'm ${p.level}: it levels too slowly (it only gets ${Math.round(Comp.OWNER_SHARE * 100)}% of my experience).`);
        if (q.lost >= 3 && q.lost > q.kills) report(adv, p, "balance", "pet-dies", `Mi summon ${ball.comp.sp} cae más de lo que mata (${q.lost} caídas, ${q.kills} bajas): ¿vida o defensa insuficientes?`, `My ${ball.comp.sp} summon falls more than it kills (${q.lost} falls, ${q.kills} kills): not enough health or defense?`);
      } else if (p.level >= 5) report(adv, p, "comfort", "pet-none", `Soy nivel ${p.level} y aún no tengo summon (oro ${p.gold}): conseguirlo exige ir hasta Gail y no hay pista de dónde está.`, `I'm level ${p.level} and still have no summon (gold ${p.gold}): getting one means finding Gail and nothing hints where she is.`); }
    r._paceAt = w.time + 480000; r._paceExp = p.exp; r._paceK = k; r._paceD = d;
    if (typeof adv.llm === "function" && adv.llm.ready !== false) {                 // opinión libre del probador con el modelo (si está disponible)
      const lang = r.lang;
      Promise.resolve(adv.llm({ task: "feedback", who: p.name, lang, system: describe(p, lang), from: "stats", text: `lvl ${p.level}, ${xp} exp/min, deaths ${d}, kills ${top(r.qa.kills)}, deaths by ${top(r.qa.deaths)}, gold ${p.gold}, rejects ${top(r.qa.rej)}` }))
        .then(t => { const seen = (adv._ideas ||= new Set()), key = String(t || "").toLowerCase().replace(/[^a-záéíóúñ ]/g, "").slice(0, 60);
          if (t && t.length >= 25 && !seen.has(key) && !RESIDENT_NAMES.some(n => t.includes(n))) { seen.add(key); report(adv, p, "idea", "llm:" + p.level + ":" + (r.chats | 0), lang === "en" ? "" : t, lang === "en" ? t : "", { text: t }); } }).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------- vida social y expediciones
const members = (adv, p) => { let n = 0; for (const b of adv.bots.values()) if (b.bot?.owner === p.id) n++; return n; };
// Al cambiar de mapa (teletransporte, Recall, seguir al líder): el punto de paseo pasa a ser donde llega.
function worldChanged(adv, w, p, r, home) {
  const was = r._wid; r._wid = w.map.id;
  if (!was) return;
  p.bot.home = { x: p.x, y: p.y }; p.bot.path = null; p.bot.target = null; p.bot.travel = null;
  blog(w, p, `Cambio de mapa: ${w.map.name || w.map.id}${w.pvp ? " (zona de lucha entre bandos)" : ""}.`);
  if (w.pvp) remember(p, "Entré en Promise Land.", "Entered Promise Land.");
  else if (r._delve && w.map.kind === "dungeon") { r._delve.go = false; r._delve.lv = w.map.level; remember(p, "Bajé a la cripta (nivel " + w.map.level + ").", "Went down into the crypt (level " + w.map.level + ")."); }
  else if (r._delve && w === home) { r._delve = null; r._tripAt = w.time + (r.goal?.k === "crypt" && r.goal.king ? 20000 : 120000) + Math.floor(w.rng() * 240000); blog(w, p, "Expedición a la cripta terminada: de vuelta en casa."); }
  else if (r._trip && w === home) { r._trip = null; r._tripAt = w.time + 240000 + Math.floor(w.rng() * 360000); blog(w, p, "Expedición terminada: de vuelta en casa."); }
}
// Los líderes (sin jefe) salen de vez en cuando de su granja: a Promise Land por el teletransportador normal (cazan, combaten y dominan fosos; vuelven con Recall)
// o a la cripta de esqueletos (bajan niveles despejándolos). Lo que toca lo decide la meta (pvp/pit → Promise Land, crypt → cripta) o el azar.
const FOSOS = adv => adv.maps["2ndmiddle"]?.meta.spawns || [];
const pitCenter = z => ({ x: (z.rect[0] + z.rect[2]) >> 1, y: (z.rect[1] + z.rect[3]) >> 1 });
// Elige foso: los que tiene el enemigo o nadie atraen; los propios y los lejanos, menos.
function pickPit(adv, w, p, zones) {
  let best = null, bs = 1e9;
  for (const z of zones) { if ((adv.lessons?.pits.get(z.id) || 0) > w.time) continue; const st = adv.pits?.get(z.id), s = dist(p, pitCenter(z)) * 0.5 - (st && st.side !== p.side ? 70 : 0) + (st && st.side === p.side ? 140 : 0) + w.rng() * 50; if (s < bs) { best = z; bs = s; } }
  return best;
}
function expedition(adv, w, p, r, home) {
  const b = p.bot;
  if (w.map.kind === "dungeon" && b.owner == null && !r._delve && !p.dead) {                // en una cripta sin expedición propia (llegó siguiendo a un líder que se fue o murió, o se le quedó un recado): la adopta para despejar, bajar o salir
    r._pet = null; r._trip = null;
    r._delve = { go: false, goUntil: 0, until: w.time + 240000 + Math.floor(w.rng() * 120000), spot: null, tries: 0, lv: w.map.level };
    blog(w, p, "Estoy en la cripta sin plan: la despejo o salgo.");
  }
  if (b.owner != null || r._pet) return;                                                   // los miembros de un grupo van donde va su líder
  if (isCraft(r) && !r._delve && !r._trip) return;                                         // granjeros y pescadores no salen de expedición: viven de su oficio
  if (r._delve) return delve(adv, w, p, r, home);
  if (r._trip) {
    if (w === home && r._trip.go && w.time > r._trip.goUntil) { r._trip = null; r._tripAt = w.time + 120000; blog(w, p, "No llegué al teletransportador: cancelo la expedición."); return; }
    if (w.pvp && w.time > r._trip.until) {
      if (p.recallTok) b.hold = w.time + 1500;                                                   // el canal de Recall dura 3 s: se queda quieto (un segundo comando lo CANCELARÍA)
      else if (w.time - (r._rc || 0) > 8000 && w.time >= (p.recallCd || 0)) { r._rc = w.time; b.hold = w.time + 3500; b.target = null; blog(w, p, "Fin de la expedición: uso Recall."); adv.command(p.id, { t: "recall" }); }
    }
    if (w.pvp) {
      r._trip.go = false;
      if (r._trip.pit && r.goal?.k !== "pit" && w.time > (r._reassignAt || 0)) {                      // el foso ya es nuestro desde hace rato: va a por otro que tenga el enemigo
        r._reassignAt = w.time + 15000; const st = adv.pits?.get(r._trip.pit.id);
        if (st && st.side === p.side && w.time - st.since > 90000) { const z = pickPit(adv, w, p, FOSOS(adv).filter(q => q.id !== r._trip.pit.id)); if (z) { r._trip.pit = { id: z.id, name: z.name, rect: z.rect }; b.travel = null; blog(w, p, `El foso es nuestro: me voy a por el foso ${z.id} (${z.name}).`); } }
      }
      const pit = r._trip.pit, pc = pit && pitCenter(pit);
      // en Promise Land va a buscar al enemigo más cercano (cualquier distancia; con foso asignado, solo los que estén cerca de él) si está sano; el combate lo resuelve el cerebro del bot (pickTarget)
      if (w.time > (r._seekAt || 0) && !p.dead && b.target?.kind !== "player" && !b.rest && p.hp > p.maxHp * 0.6) {
        r._seekAt = w.time + 8000;
        let foe = null, fd = pit ? 40 : 320;
        for (const e of w.ents.values()) if (e.kind === "player" && canFight(w, p, e) && e.level <= p.level + 6 && e.hp <= p.hp * 2.2) { const d = pit ? dist(pc, e) : dist(p, e); if (d < fd) { foe = e; fd = d; } }
        if (foe && dist(p, foe) > 10) { b.travel = { x: foe.x, y: foe.y, w, until: w.time + 9000, seek: true }; b.path = null; b.goal = null; blog(w, p, `Busco a ${foe.name} (${foe.side === 1 ? "Aresden" : foe.side === 2 ? "Elvine" : "viajero"}, nv ${foe.level}) a ${dist(p, foe)} casillas.`); }
        else if (pit && !foe && dist(p, pc) > 14) { b.travel = { x: pc.x, y: pc.y, w, until: w.time + 40000, seek: true }; b.path = null; b.goal = null; blog(w, p, `Voy al foso ${pit.id} (${pit.name}) en (${pc.x},${pc.y}) para dominarlo.`); }
        else if (pit && dist(p, pc) <= 14) b.home = { x: pc.x, y: pc.y };       // en el foso: pasea por él esperando enemigos
      }
    }
    return;
  }
  if (!r._tripAt) r._tripAt = w.time + 60000 + Math.floor(w.rng() * 120000);
  if (w !== home || w.time < r._tripAt || p.dead || p.hp < p.maxHp * 0.7 || p.level < 2 || b.rest || b.travel) return;
  const g = r.goal?.k, plan = r._plan && w.time < r._plan.until ? r._plan : null;
  // QUÉ HACER: lo que decidió el grupo (council.js) o, en solitario, lo que más le conviene según lo que rinde cada cosa (hunt / crypt / pl)
  let kind = plan?.kind;
  if (!kind) {
    const ev = Council.evaluate(adv, p, CH, 1); kind = Council.bestOf(ev);
    if (w.time - (r._evalLog || 0) > 120000) { r._evalLog = w.time; blog(w, p, `Evalúo qué me conviene: ${Council.KINDS.map(k => k + " " + ev[k].s).join(", ")} → ${Council.labelOf(kind)} (${ev[kind].why}).`); }
  }
  if (g === "crypt" && p.quests && !plan) kind = questReady(w, p) ? "crypt" : "hunt";                                           // misión de cripta: baja sí o sí (el consejo solo decide cuando no hay misión)
  if (kind === "hunt") { r._tripAt = plan ? plan.until : w.time + 90000; return; }                   // se queda cazando en la granja (la caza prefiere lo que más rinde)
  const pl = p.level >= 3 && kind === "pl";
  if (!pl) return startDelve(adv, w, p, r, home);
  const tps = (adv.maps[home.map.id]?.meta.teleports || []).filter(t => t.map === "2ndmiddle");
  if (!tps.length) return startDelve(adv, w, p, r, home);
  const tp = tps[tps.length >> 1], zones = FOSOS(adv);
  const pit = g === "pit" ? zones.find(z => z.id === r.goal.zone) : (p.level >= 6 && zones.length && w.rng() < 0.7 ? pickPit(adv, w, p, zones) : null);
  r._trip = { go: true, goUntil: w.time + 120000, until: w.time + (pit ? 480000 : 240000) + Math.floor(w.rng() * 180000), pit: pit ? { id: pit.id, name: pit.name, rect: pit.rect } : null };
  b.travel = { x: tp.x, y: tp.y, w, until: w.time + 120000 };
  blog(w, p, `Planeo una expedición a Promise Land${pit ? " para dominar el foso " + pit.id + " (" + pit.name + ")" : ""}: voy al teletransportador (${tp.x},${tp.y}).`);
  remember(p, "Salí hacia Promise Land.", "Set out for Promise Land.");
  if (w.rng() < 0.7) speak(adv, p, fmt(p, "trip", r.lang, "", w));
}
// ---- cripta de esqueletos: se anda hasta la entrada (el teletransportador de Aresfarm, o el punto de inicio en Elvine Farm) y se usa la orden de portal
function startDelve(adv, w, p, r, home) {
  const b = p.bot, tp = (adv.maps[home.map.id]?.meta.teleports || []).find(t => t.map === "middled1n");
  let spot = tp ? w.freeSpotNear(tp.x, tp.y + 2) : null;
  if (!spot || w.teleports.has(w.grid.idx(spot[0], spot[1]))) spot = w.freeSpotNear(...(home.home || [b.home.x, b.home.y]));
  if (!spot) { r._tripAt = w.time + 60000; return; }
  r._delve = { go: true, t0: w.time, goUntil: w.time + 150000 + dist(p, { x: spot[0], y: spot[1] }) * 1200, until: w.time + (r.goal?.k === "crypt" && r.goal.king ? 900000 : 420000) + Math.floor(w.rng() * 300000), spot, tries: 0, lv: 0 };
  b.travel = { x: spot[0], y: spot[1], w, until: w.time + 150000 };
  blog(w, p, `Planeo bajar a la cripta de esqueletos${r.goal?.k === "crypt" ? " (mi meta: nivel " + r.goal.n + ")" : ""}: voy a la entrada (${spot[0]},${spot[1]}).`);
  remember(p, "Salí hacia la cripta de esqueletos.", "Set out for the skeleton crypt.");
  if (w.rng() < 0.6) speak(adv, p, "§you are going down to the skeleton crypt to clear skeletons");
  recruitCrypt(adv, w, p, r);
}
// Equipo de cripta: el que sale a bajar invita a compañeros libres de su granja (mismo bando, nivel parecido; hasta 4 en total). Es voluntario (algunos rechazan): en grupo se reparte la experiencia,
// la cuenta contra los jefes suma lo que pegan los aliados y los miembros siguen al líder por la cripta (bot.js).
function recruitCrypt(adv, w, p, r) {
  if (p.bot.owner != null || w.pvp) return;
  const cand = [...adv.bots.values()].filter(q => q !== p && q.res && !q.dead && q.side === p.side && adv.worldFor(q.id) === w && q.bot.owner == null && !q.res.followUntil && !q.res._trip && !q.res._delve && !q.res._pet && !q.bot.rest && q.level >= 8 && Math.abs(q.level - p.level) <= 8 && q.hp > q.maxHp * 0.7 && dist(p, q) < 60).sort((x, y) => dist(p, x) - dist(p, y));
  let n = members(adv, p);
  for (const q of cand) {
    if (n >= 3) break;
    if (w.rng() < 0.25) { blog(w, q, `${p.name} me propone bajar juntos a la cripta, pero prefiero ir por mi cuenta.`); continue; }
    q.bot.owner = p.id; q.res._leaveAt = w.time + 600000 + Math.floor(w.rng() * 300000); q.bot.partyAt = 0; n++;
    blog(w, q, `Bajo a la cripta en equipo con ${p.name} (nv ${p.level}): juntos aguantamos más.`); blog(w, p, `${q.name} (nv ${q.level}) baja conmigo a la cripta.`);
    befriend(p, q.name, 1); befriend(q, p.name, 1);
  }
}
// Recall desde la cripta: el canal dura 3 s y quedarse quieto es obligatorio (moverse o un segundo comando lo cancelan)
function cryptRecall(adv, w, p, r, es) {
  const b = p.bot;
  if (p.recallTok) { b.hold = w.time + 1500; return; }
  if (w.time - (r._rc || 0) <= 8000 || w.time < (p.recallCd || 0)) return;
  const hit = w.time - (p.lastCombat || -1e9) < 2500;                                  // v0.77.0: con un monstruo encima el canal se rompe: primero se defiende (no se queda quieto), y reintenta
  r._rc = w.time; blog(w, p, es); if (!hit) { b.hold = w.time + 3500; b.target = null; b.travel = null; b.path = null; }
  if (!hit) r._rcN = (r._rcN | 0) + 1; if (r._rcN >= 4) { r._rcN = 0; report(adv, p, "bug", "crypt-exit", "Me cuesta salir de la cripta: el Recall se me interrumpe " + 4 + " veces seguidas.", "I struggle to leave the crypt: Recall gets interrupted 4 times in a row."); }
  adv.command(p.id, { t: "recall" });
}
function delve(adv, w, p, r, home) {
  const b = p.bot, d = r._delve;
  if (w === home) {
    r._rcN = 0;
    if (!d.go) { r._delve = null; r._tripAt = w.time + 120000; return; }
    if ((w.time > d.goUntil && dist(p, { x: d.spot[0], y: d.spot[1] }) > 5 && (w.time - p.lastCombat > 10000 || w.time > d.goUntil + 300000)) || d.tries > 6) { r._delve = null; r._tripAt = w.time + 150000; blog(w, p, "No consigo entrar en la cripta: cancelo la bajada."); report(adv, p, "bug", "cryptentry", "No consigo entrar en la cripta desde mi granja.", "I can't get into the crypt from my farm."); return; }
    if (dist(p, { x: d.spot[0], y: d.spot[1] }) > 2 && !b.travel && !p.dead) { b.travel = { x: d.spot[0], y: d.spot[1], w, until: w.time + 60000 + dist(p, { x: d.spot[0], y: d.spot[1] }) * 1000 }; b.path = null; b.goal = null; b.fails = 0; }
    if ((dist(p, { x: d.spot[0], y: d.spot[1] }) <= 5 || w.time - d.t0 > 120000) && !p.dead && w.busy(p) && !(b.noFight > w.time)) b.noFight = w.time + 1500;                // en la entrada y peleando sin parar: suelta el combate un instante para poder usar el portal
    if ((dist(p, { x: d.spot[0], y: d.spot[1] }) <= 5 || w.time - d.t0 > 120000) && !p.dead && !w.busy(p) && w.time - (d.cmdAt || 0) > 3000) { d.cmdAt = w.time; r._noPrey = 0; d.tries++; const dp = p.delve?.deepest || 1, cl = p.delve?.cleared ?? Math.max(0, dp - 1);
      let start = Math.min(cl + 1, 20);                                                            // elige el piso de inicio entre los despejados (el siguiente al último es el máximo): el más hondo cuyo jefe pueda vencer y cuyo nivel le alcance
      while (start > 1) { const bp = bossPreview(w, start); if ((!bp || fightEstimate(w, p, bp).ratio >= 1.3) && p.level >= cryptNeed(r, start) - 2) break; start--; }
      const cap = Quests.cryptCap(p);                                                              // v0.78.6: un piso ya despejado no se repite: si el siguiente aún no se puede (jefe o nivel) o el tope de misiones lo impide, no baja y vuelve a intentarlo más tarde
      if (cl > 0 && (start < cl + 1 || cl + 1 > cap)) { r._delve = null; r._tripAt = w.time + 240000; blog(w, p, `Tengo despejado hasta el piso ${cl}, pero aún no puedo con el ${cl + 1}: no repito el ${cl}, me preparo más.`); return; }
      const restart = start === 1;
      if (cl > 0) blog(w, p, `Tengo despejado hasta el piso ${cl}: empiezo en el ${start}, sin repetir el jefe.`);
      adv.command(p.id, { t: "portal", portal: "mid-entry", restart, level: start }); }
    return;
  }
  if (w.map.kind !== "dungeon") return;
  d.go = false;
  const left = w.time > d.until || p.level < 2 || p.level < cryptNeed(r, w.map.level) - 2;          // aprendizaje: si este piso lo mató y aún no está listo, sale
  if (p.dead) return;
  if (d.peek === w.map.level) { cryptRecall(adv, w, p, r, `Ya conozco la entrada del piso ${w.map.level}: vuelvo a prepararme.`); return; }
  if (w.map.boss && r._bossSeen !== w.map.id) {                                           // piso de jefe: antes de acercarse hace la cuenta; si no puede con él, sale (con la party, si la hay, cuenta lo que pegan los compañeros)
    const bs = [...w.ents.values()].find(e => e.boss && !e.aux && !e.dead);
    if (bs) {
      const est = fightEstimate(w, p, bs); r._bossSeen = w.map.id;
      if (est.ratio < 1.3) { r.dd ||= {}; r.dd[w.map.level] = (r.dd[w.map.level] || 0) + 0.4; r.bossFails = (r.bossFails | 0) + 1; blog(w, p, `El jefe del piso ${w.map.level} (vida ${bs.hp}) me aplastaría: aguanto ${Math.round(est.budget)} de daño y recibiría ${Math.round(est.taken)} (con ${est.allies} aliados cerca). Salgo y vuelvo más fuerte o con grupo.`); r._rc = 0; cryptRecall(adv, w, p, r, "Salgo de la cripta (Recall)."); return; }
      blog(w, p, `Hago la cuenta contra el jefe del piso ${w.map.level}: aguanto ${Math.round(est.budget)}, recibiría ${Math.round(est.taken)} (${est.allies} aliados). Voy a por él.`);
    }
  }
  if (left || (b.rest && !b.target)) { cryptRecall(adv, w, p, r, left ? "Fin de la bajada: salgo de la cripta (Recall)." : "Voy mal: salgo de la cripta (Recall)."); return; }
  if (b.rest || w.time < (r._delveAt || 0)) return;
  r._delveAt = w.time + 1500;
  // nivel despejado: baja si puede (niveles superiores solo con suficiente nivel) o sale
  if (w.cleared) {
    const gate = w.map.portals.find(g => g.target === "down"), nb = bossPreview(w, w.map.level + 1), deeper = !!gate && w.map.level + 1 <= Quests.cryptCap(p) && p.level >= cryptNeed(r, w.map.level + 1) && (!nb || fightEstimate(w, p, nb, false, true).ratio >= 1.3);       // no baja a un piso de jefe sin hacer la cuenta
    const peek = !deeper && !!gate && w.map.level + 1 <= Quests.cryptCap(p);                       // v0.78.6: aunque aún no pueda con el siguiente, llega hasta su entrada (queda guardado como piso más hondo) y vuelve en Recall
    const exit = deeper || peek ? gate : w.map.portals.find(g => g.target === "origin" && g.id !== "return") || w.map.portals.find(g => g.id === "return");
    if (!exit) return;
    if (dist(p, exit) <= 1) { if (w.time - (d.cmdAt || 0) > 2000) { d.cmdAt = w.time; if (!deeper) d.until = 0; else d.until = Math.max(d.until, w.time + 300000); if (peek) d.peek = w.map.level + 1; blog(w, p, deeper ? `Nivel ${w.map.level} despejado: bajo.` : peek ? `Nivel ${w.map.level} despejado: llego hasta la entrada del ${w.map.level + 1} y vuelvo.` : "Cripta despejada: salgo."); adv.command(p.id, { t: "portal", portal: exit.id }); } }
    else if (!b.travel || b.travel.x !== exit.x) { b.travel = { x: exit.x, y: exit.y, w, until: w.time + 60000 }; b.path = null; b.goal = null; }
    return;
  }
  // caza: los esqueletos cercanos los pelea el cerebro del bot; si no hay ninguno a la vista, va a por el más cercano
  if (b.target) { r._noPrey = 0; return; }
  let best = null, bd = 1e9;
  for (const e of w.ents.values()) if (e.kind === "npc" && !e.dead && !e.comp && !e.aux && !e.master && !tooStrong(w, p, e)) { const dd = dist(p, e); if (dd < bd) { best = e; bd = dd; } }
  if (best) r._noPrey = 0;
  else if (!r._noPrey) r._noPrey = w.time;
  else if (w.time - r._noPrey > 12000) { cryptRecall(adv, w, p, r, "Los esqueletos que quedan son demasiado fuertes para mí: salgo de la cripta (Recall)."); return; }       // sin presa que pueda pelear no se queda quieto hasta agotar el tiempo
  if (best && bd > 9) { b.travel = { x: best.x, y: best.y, w, until: w.time + 12000, seek: true }; b.path = null; b.goal = null; blog(w, p, `Busco a ${best.name} a ${bd} casillas.`); }
  else if (best) b.travel = null;
}
// ---------------------------------------------------------------- summons (compañeros): los habitantes los compran, invocan, curan, les dan talentos y hechizos, y avisan de lo que falla
// Cada habitante prueba una especie distinta (salen de `Comp.SPECIES`; así se ejercitan todas). El hospital (Gail) está en la tienda general de Aresden
// y al aire libre en Elvine Farm. Los avisos van al informe de probadores (`report`).
const TALENT_PLAN = { warrior: ["hide", "iron", "taunt", "regen"], hunter: ["might", "frenzy", "might"], trader: ["hide", "might"], wanderer: ["might", "hide", "iron"], scholar: ["mind", "might", "hide"] };
const PET_SPECIES = Object.keys(Comp.SPECIES).filter(sp => !Sch.isTier2(sp) && !Tal.CLS_OF[sp]);           // las especies superiores solo por cambio y el Dummy exige un báculo
const ballOf = p => Comp.activeBall(p) || p.bag.find(i => i.comp && !i.comp.bad);
const liveOf = (w, p) => { for (const e of w.ents.values()) if (e.comp && e.master === p.id && !e.dead) return e; return null; };
const nurseOf = w => { for (const e of w.ents.values()) if (e.role === "pethospital") return e; return null; };
// MAGOS (arquetipo estudioso): coleccionan summons de las tres escuelas (las bases de las escuelas de evolutions.js) y los van alternando para tirar magias variadas
const MAGE_SPECIES = Object.keys(Sch.SCHOOL_OF).filter(sp => !Sch.isTier2(sp));
// MAGO DE APOYO (INVENTO, v0.69): con báculo en la mano colecciona Healer, Buffer y Aura (se compran en el hospital) y gasta los talentos de cada clase; sin báculo sigue la escuela normal
const SUPPORT_SPECIES = Object.keys(Tal.CLS_OF), SUPPORT_PLAN = { healer: ["dheal", "dgheal", "dheal", "dmassh"], buffer: ["dward", "dgward", "dpfm", "dberserk", "dmassb"], aura: ["dregen", "dexp", "ddef", "dmana", "dvamp"] };
const supporter = (p, r) => r.arch === "scholar" && isSupport(p) && hasStaff(p);
const balls = p => p.bag.filter(i => i.comp && !i.comp.bad);
const wantsMoreBalls = (p, r) => {            // metas de vida: muchos summons distintos; los magos reúnen las 3 escuelas pronto y los demás cuando los que tienen ya van altos
  const bs = balls(p); if (p.level < 8 || p.gold < 1500) return false;
  if (supporter(p, r)) return bs.filter(i => Tal.CLS_OF[i.comp.sp]).length < SUPPORT_SPECIES.length;
  if (r.arch === "scholar") return bs.length < MAGE_SPECIES.length;
  return bs.length > 0 && bs.length < 6 && p.gold >= 3000 && bs.every(i => i.comp.lvl >= Math.min(Sch.TRADE_LEVEL, 10 + bs.length * 8));
};
function pickSpecies(p, r) {
  if (qMissing(p)) return qSpecies(p);
  if (supporter(p, r)) { const own = new Set(balls(p).map(i => i.comp.sp)), free = SUPPORT_SPECIES.filter(sp => !own.has(sp)); if (free.length) return free[(r.petN | 0) % free.length]; }
  if (r.arch === "scholar") { const own = new Set(balls(p).map(i => i.comp.sp)), free = MAGE_SPECIES.filter(sp => !own.has(sp)); if (free.length) return free[(r.petN | 0) % free.length]; }
  let h = 0; for (const c of p.name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PET_SPECIES[(h + (r.petN | 0)) % PET_SPECIES.length]; }
// oro que no se gasta en caprichos del summon (hechizos): lo justo para llenar de pociones (60 por poción) y no quedarse sin ellas
export const potReserve = p => Math.min(2400, 300 + p.level * 40);
// En Promise Land un summon es media pelea: lo sacan (si no está), lo ponen en modo ataque y le señalan al rival (jugador o su summon). Así entrenan a sus summons contra los de los demás.
function pvpPets(adv, w, p, r) {
  if (p.dead || w.time < (r._pvpPetAt ||= 0)) return;
  r._pvpPetAt = w.time + 2000;
  const ball = ballOf(p), c = ball?.comp; if (!c || c.bad) return;
  if (c.down) {                                                                                       // su summon cayó: en Promise Land no se puede revivir (Gail está en la ciudad) → acaba la expedición con Recall y va al hospital
    if (p.gold >= Comp.treatCost(p, c)) {
      r._petAt = Math.min(r._petAt || 1e15, w.time + 3000);
      if (r._trip && r._trip.until > w.time && w.time - p.lastCombat > 5000) { r._trip.until = w.time; blog(w, p, "Mi summon ha caído: salgo de Promise Land para revivirlo en el hospital de compañeros."); }
    }
    return;
  }
  const live = liveOf(w, p);
  if (!live) { if (w.time - (r._petUseAt || 0) > 8000 && !w.busy(p)) { r._petUseAt = w.time; adv.command(p.id, { t: "use", uid: ball.uid }); blog(w, p, "Saco a mi summon: en Promise Land vale por un guerrero más."); } return; }
  const hf = live.hp / live.maxHp;                                                                          // lo cuidan: con poca vida lo retiran del combate y esperan a que se recupere
  if (hf < 0.3 && c.mode !== "peace") { adv.command(p.id, { t: "petmode", mode: "peace" }); if (w.time - (r._careLog || 0) > 15000) { r._careLog = w.time; blog(w, p, "Mi summon está muy herido (" + Math.round(hf * 100) + "%): lo retiro para que no muera."); } return; }
  if (c.mode === "peace") { if (hf >= 0.7) adv.command(p.id, { t: "petmode", mode: "attack" }); return; }
  const tg = p.bot.target; let foe = tg && (tg.kind === "player" || (tg.comp && tg.master)) ? tg : null;
  if (foe) { const fp = [...w.ents.values()].find(e => e.comp && e.master === foe.id && !e.dead && dist(p, e) <= 12); if (fp && live.hp >= live.maxHp * 0.5) foe = fp; }       // si su summon lo protege y el mío está sano: primero summon contra summon
  if (foe && live.cTarget !== foe.id && dist(p, foe) <= 14) { adv.command(p.id, { t: "pettarget", target: foe.id }); if (foe.comp && w.time - (r._sparLog || 0) > 20000) { r._sparLog = w.time; blog(w, p, "Mi summon se enfrenta al summon de " + (w.ents.get(foe.master)?.name || "un rival") + ": así los dos suben de nivel."); } }
}
function pets(adv, w, p, r, home) {
  if (w.pvp) return pvpPets(adv, w, p, r);
  if (p.dead || w.pvp || w.map.kind === "dungeon" || w.time < (r._petThink ||= 0)) return;
  r._petThink = w.time + 2500;
  const b = p.bot, live = liveOf(w, p);
  let want = r._wantBall && p.bag.find(i => i.uid === r._wantBall && i.comp && !i.comp.bad && !i.comp.down);
  if (!want && !live && supporter(p, r)) { const cur = ballOf(p); if (!cur || cur.comp.down || !Tal.CLS_OF[cur.comp.sp]) want = balls(p).find(i => Tal.CLS_OF[i.comp.sp] && !i.comp.down) || null; }   // su bola activa cayó (o es de escuela) y no hay summon fuera: saca uno de apoyo sano en vez de esperar al hospital
  const qb = w.time < (r._supHold || 0) ? null : qBall(p);          // el mago de apoyo suelta un rato la bola de la misión para sacar a su summon de apoyo (0.78.0)
  if (!want && qb && !qb.comp.down && !qb.comp.on && Comp.activeBall(p) && !w.fightZone && w.time - p.lastCombat > 4000) { adv.command(p.id, { t: "use", uid: Comp.activeBall(p).uid }); r._wantBall = qb.uid; r._petUseAt = 0; }
  const ball = want || (qb && !qb.comp.down ? qb : null) || ballOf(p), c = ball?.comp;
  if (want && c.on) r._wantBall = 0;
  // VARIOS SUMMONS: el mago alterna de escuela (otros hechizos); los demás entrenan al de menor nivel para llevarlos todos al máximo (meta «summons distintos al nivel máximo»)
  // el MAGO DE APOYO saca siempre un summon de apoyo (Healer/Buffer/Aura) en cuanto tiene uno: antes se quedaba con el de escuela y nunca se le veía invocar apoyo (0.78.0)
  const supNow = supporter(p, r) && live && w.time >= (r._supAt || 0) && !!Comp.activeBall(p) && !Tal.CLS_OF[Comp.activeBall(p).comp.sp] && balls(p).some(i => Tal.CLS_OF[i.comp.sp] && !i.comp.down);
  if (live && (supNow || !qb) && balls(p).length > 1 && (supNow || (!qb && w.time - (r._schoolAt ||= w.time + 120000) > 0)) && (supNow || w.time - p.lastCombat > 4000) && !w.fightZone) {
    const cur = Comp.activeBall(p), all = balls(p).filter(i => i !== cur && !i.comp.down);
    let nx = null;
    if (supporter(p, r)) { const o = all.filter(i => Tal.CLS_OF[i.comp.sp] && Tal.CLS_OF[i.comp.sp] !== Tal.CLS_OF[cur?.comp.sp]); nx = o[Math.floor(w.rng() * o.length)]; }
    else if (r.arch === "scholar") { const o = all.filter(i => Sch.SCHOOL_OF[i.comp.sp] && Sch.SCHOOL_OF[i.comp.sp] !== Sch.SCHOOL_OF[cur?.comp.sp]); nx = o[Math.floor(w.rng() * o.length)]; }
    else { const o = all.filter(i => i.comp.lvl < Sch.TRADE_LEVEL).sort((x, y) => x.comp.lvl - y.comp.lvl)[0]; if (o && cur && (cur.comp.lvl >= Sch.TRADE_LEVEL || cur.comp.lvl >= o.comp.lvl + 4)) nx = o; }
    r._schoolAt = w.time + 180000 + Math.floor(w.rng() * 180000);
    if (cur && nx) { if (supNow) { r._supHold = w.time + 240000; r._supAt = w.time + 480000; } adv.command(p.id, { t: "use", uid: cur.uid }); r._wantBall = nx.uid; r._petUseAt = 0; blog(w, p, `Cambio de summon: guardo a ${cur.comp.nm} (nv ${cur.comp.lvl}) y saco a ${nx.comp.nm} (${nx.comp.sp} nv ${nx.comp.lvl}).`); return; }
  }
  // ---- mantenimiento (en cualquier mapa menos Promise Land y la cripta)
  if (ball) {
    if (live && (b.rest || p.recallTok) && w.time - (r._petUseAt || 0) > 12000) { r._petUseAt = w.time; adv.command(p.id, { t: "use", uid: ball.uid }); blog(w, p, "Guardo a mi summon para descansar/viajar."); }
    else if ((!c.on || !live) && !c.down && !w.fightZone && !b.rest && !p.recallTok && p.mp >= Math.min(20, p.maxMp * 0.2) && w.time - (r._petUseAt || 0) > 12000) {          // invoca a su summon (también si la bola dice «fuera» y no hay summon: tras morir o viajar)
      if (c.on && !live && (r.deaths | 0) > (r._petDeaths | 0)) { r._petDeaths = r.deaths | 0; report(adv, p, "bug", "pet-after-death", `Tras morir y reaparecer mi summon ${c.nm} no vuelve solo: la bola sigue «fuera» pero no hay summon hasta que la uso otra vez.`, `After dying and respawning my summon ${c.nm} doesn't come back by itself: the ball still says «out» but there is no summon until I use it again.`); }
      r._petUseAt = w.time; adv.command(p.id, { t: "use", uid: ball.uid });
      if ((r._petUseFails = (r._petUseFails | 0) + 1) >= 3 && !live) { c.bad = true; r._petUseFails = 0; r.petN = (r.petN | 0) + 1; report(adv, p, "bug", "summon:" + c.sp, `No consigo invocar a mi summon de especie ${c.sp} (la bola no lo saca nunca).`, `I can't summon my ${c.sp} companion (the ball never produces it).`); blog(w, p, `Mi summon ${c.sp} no se deja invocar: lo dejo y probaré otra especie.`); }
    } else if (live) r._petUseFails = 0;
    // talentos: gasta los puntos libres según su arquetipo
    if (Tal.pointsFree(c) > 0) for (const id of (Tal.isDummy(c) ? SUPPORT_PLAN[c.cls] : null) || TALENT_PLAN[r.arch] || TALENT_PLAN.hunter) if (!Tal.canLearn(c, id)) { adv.command(p.id, { t: "talent", uid: ball.uid, talent: id }); blog(w, p, `Gasto un punto de talento de ${c.nm} en «${Tal.talent(id).name}».`); break; }
    // los summons de escuela aprenden hechizos (barato primero) y los lanzan contra su objetivo
    const school = Sch.SCHOOL_OF[c.sp];
    if (school && w.magic) {
      if (w.time - (r._teachAt || 0) > 20000) {
        r._teachAt = w.time;
        const ids = Object.entries(PG.catalog(w.magic, school)).filter(([id, lv]) => !PG.knows(c, id) && lv <= c.lvl).sort((x, y) => x[1] - y[1]);
        for (const [id] of ids) if (p.stats.int >= PG.intNeeded(w.magic, school, id) && p.gold >= PG.goldCost(w.magic, school, id) + potReserve(p)) { adv.command(p.id, { t: "pgteach", spell: +id, npc: 0 }); break; }
      }
      const n = live;
      let t = b.target?.kind === "npc" ? b.target : null;                                // sin objetivo propio: el monstruo más cercano al summon (él también pelea solo)
      if (!t && n) { let bd = 9; for (const e of w.ents.values()) if (e.kind === "npc" && !e.dead && !e.master && !e.aux && !e.cfg.actionLimit && !w.safeAt(e.x, e.y)) { const d = dist(n, e); if (d < bd) { bd = d; t = e; } } }
      if (n && t && !t.dead && dist(p, t) <= 12 && w.time - (r._castAt || 0) > 2500) {
        const known = PG.grimOf(c).filter(id => PG.needLevel(w.magic, school, id, c.sp) <= c.lvl && (n.mp ?? 0) >= PG.manaCost(w.magic, school, id)).sort((x, y) => PG.manaCost(w.magic, school, y) - PG.manaCost(w.magic, school, x));
        if (known.length) { r._castAt = w.time; adv.command(p.id, { t: "pgcast", spell: known[0], x: t.x, y: t.y }); blog(w, p, `Mi summon lanza «${w.magic[known[0]].name}» contra ${t.name}.`); }
      }
    }
    // órdenes y caramelos
    if (live && b.target?.kind === "npc" && w.time - (r._petOrderAt || 0) > 45000 && w.rng() < 0.5) { r._petOrderAt = w.time; adv.command(p.id, { t: "pettarget", target: b.target.id }); }
    if (live && live.hp < live.maxHp * 0.4 && w.time - (r._candyAt || 0) > 8000) { const cd = p.bag.find(i => i.id === 780); if (cd) { r._candyAt = w.time; adv.command(p.id, { t: "use", uid: cd.uid }); blog(w, p, "Doy un caramelo rojo a mi summon."); } }
    if (live && (!r._modeAt || w.time - r._modeAt > 600000)) { r._modeAt = w.time; if (r._modeAt > 1) { const m = c.mode === "peace" ? "attack" : "peace"; adv.command(p.id, { t: "petmode", mode: m }); r._modeBack = w.time + 20000; } }
    if (r._modeBack && w.time > r._modeBack) { r._modeBack = 0; adv.command(p.id, { t: "petmode", mode: "attack" }); }
  }
  // ---- ¿toca ir al hospital? sin summon, o con el summon caído/herido
  const more = wantsMoreBalls(p, r);
  const need = more || qMissing(p) || qEvolve(p) ? true : !ball ? p.level >= 2 && p.gold >= 20 : (c.down || (!live && Comp.hpOf(p, c) < Comp.maxOf(p, c) * 0.5)) && p.gold >= Comp.treatCost(p, c) && !c.bad;
  if (!(!ball && p.bot.owner != null)) r._noBall = 0;          // cualquiera sin summon deja el grupo para ir a por uno (el mago, antes que nadie)
  else if (!r._pet && p.level >= 2 && p.gold >= 20 && w === home && w.time - (r._noBall ||= w.time) > (r.arch === "scholar" ? 90000 : 150000)) { r._noBall = 0; r._petAt = w.time; const lead = adv.bots.get(p.bot.owner) || w.ents.get(p.bot.owner); CH.leave(adv, p, lead || { name: "?" }, r.arch === "scholar" ? "un mago sin su summon no sirve de nada: voy al hospital de compañeros" : "aún no tengo summon: voy al hospital de compañeros a por uno"); }          // los magos no se quedan sin summon por seguir a nadie
  if (!r._pet) {
    if (!need || r._trip || r._delve || p.bot.owner != null || w.time < (r._petAt ||= w.time + 20000 + Math.floor(w.rng() * 40000)) || w !== home || p.hp < p.maxHp * 0.5 || b.rest) return;
    const tp = (adv.maps[home.map.id]?.meta.teleports || []).find(t => t.map === "gshop_1f"), nurse = nurseOf(w);
    if (!nurse && !tp) { r._petAt = w.time + 600000; return; }
    r._pet = { until: w.time + 240000, done: 0, tp: tp ? { x: tp.x, y: tp.y } : null };
    blog(w, p, !ball ? "Voy a buscar un summon al hospital de compañeros." : "Llevo a mi summon al hospital de compañeros.");
    if (!ball && w.rng() < 0.6) speak(adv, p, "§you need a summon companion and are heading to the pet hospital");
    return;
  }
  const d = r._pet;
  if (w.time > d.until || p.hp < p.maxHp * 0.3) { r._pet = null; r._petAt = w.time + 120000; if (w.time > d.until) blog(w, p, "No llego al hospital de compañeros: cancelo."); return; }
  if (w !== home) d.in = true;                                                           // ya estuvo dentro: no vuelve a la tienda
  const nurse = nurseOf(w);
  if (nurse) {                                                                           // en el mapa de Gail: se acerca y la usa
    if (dist(p, nurse) > 5) { if (!b.travel) { b.travel = { x: nurse.x, y: nurse.y + 1, w, until: w.time + 40000 }; b.path = null; b.goal = null; b.fails = 0; } return; }
    if (w.busy(p) || w.time - (d.cmdAt || 0) < 1500) return;
    d.cmdAt = w.time;
    d.n0 ??= balls(p).length;
    { const q = p.quests, qb = q && q.u.trade && !q.tr ? p.bag.find(i => i.comp && i.comp.sp === Quests.PATH[q.cls].sp && i.comp.lvl >= Sch.TRADE_LEVEL && !i.comp.down) : null;
      if (qb) { if (qb.comp.on) { adv.command(p.id, { t: "use", uid: qb.uid }); return; } adv.command(p.id, { t: "petup", uid: qb.uid, npc: nurse.id }); blog(w, p, "Pido a Gail que evolucione a mi " + qb.comp.nm + " (misión de clase)."); return; } }
    if (!ball || qMissing(p) || (more && balls(p).length <= d.n0)) { if (d.bought) { r.petN = (r.petN | 0) + 1; d.bought = false; } const sp = pickSpecies(p, r); d.bought = true; adv.command(p.id, { t: "petbuy", npc: nurse.id, sp }); if (++d.done > 6) { r._pet = null; r._petAt = w.time + 300000; } return; }
    if (c.down || Comp.hpOf(p, c) < Comp.maxOf(p, c)) { adv.command(p.id, { t: "petheal", uid: ball.uid, npc: nurse.id }); if (++d.done > 4) { r._pet = null; r._petAt = w.time + 300000; } return; }
    d.leave = true; r._petUseAt = 0;
  } else if (d.tp && w === home && !d.in) {                                                     // camino a la tienda general de Aresden
    if (!b.travel) { b.travel = { x: d.tp.x, y: d.tp.y, w, until: w.time + 90000 }; b.path = null; b.goal = null; b.fails = 0; }
    return;
  }
  // terminado (o no hay enfermera aquí): vuelve a casa
  if (w === home) { r._pet = null; r._petAt = w.time + (ball ? 240000 : 90000); return; }
  const out = (adv.maps[w.map.id]?.meta.teleports || []).find(t => t.map === home.map.id) || (adv.maps[w.map.id]?.meta.teleports || [])[0];
  if (out && !b.travel) { b.travel = { x: out.x, y: out.y, w, until: w.time + 60000 }; b.path = null; b.goal = null; b.fails = 0; }
  else if (!out && w.time - (r._rc || 0) > 8000) { r._rc = w.time; adv.command(p.id, { t: "recall" }); }
}
// ---- REPARTO NUEVO (build): de vez en cuando prueban otro reparto de puntos para descubrir builds mejores (builds.js). Van al mago de la tienda general
// (Gandlf, reinicio de estadísticas de respec.js), recuperan sus puntos, los reparten según el nuevo build y miden cuánta experiencia por minuto sacan.
function rebuild(adv, w, p, r, home) {
  const b = p.bot;
  if (p.dead) { r._reb = null; return; }
  r.bperf ||= { name: Builds.buildOf(p), t0: w.time, exp0: p.exp };
  if (!r._reb) {
    if (w !== home || p.level < 12 || r._trip || r._delve || r._pet || b.owner != null || b.rest || b.travel || p.hp < p.maxHp * 0.7 || w.time < (r._rebAt ||= w.time + 600000 + Math.floor(w.rng() * 600000))) return;
    r._rebAt = w.time + 900000 + Math.floor(w.rng() * 600000);
    const sig = Builds.itemSig(p), fit = Builds.fitByItems(p), forced = !r.forcedDone || (r.sig && r.sig !== sig && fit.build !== Builds.buildOf(p));      // v0.77.0: un reinicio obligatorio por bot y otro si cambia el ítem clave
    r.sig ||= sig;
    if (p.gold < Respec.respecCost(p) + 300 || (!forced && w.time - r.bperf.t0 < 15 * 60000) || (forced && !Builds.canRespecToday(r, w))) return;       // sin oro, sin probar lo bastante o tope diario
    if (forced) {
      const tp0 = (adv.maps[home.map.id]?.meta.teleports || []).find(t => t.map === "gshop_1f");
      if (!tp0) return;
      r._reb = { until: w.time + 300000, nb: fit.build, arch: fit.arch, forced: true, done: false, tp: { x: tp0.x, y: tp0.y } };
      blog(w, p, `Reviso mi equipo (${sig === "bow" ? "arco" : sig === "staff" ? "báculo" : "cuerpo a cuerpo"}) y mi clase: voy al mago a reiniciar mis estadísticas y repartirlas como «${Builds.BUILDS[fit.build].es}».`);
      ObsStats.ask(adv, p, "forced-respec", "Reinicio de estadísticas obligatorio: sería útil poder cambiar de clase sin pasar por el mago.", "Mandatory stat reset: it would help to change class without going to the mage.");
      return;
    }
    const hist = r.builds || [], best = Math.max(0, ...hist.map(h => h.rate)), now = Builds.perf(p, w), poor = best > 0 && now < best * 0.85, curious = hist.length < 4 && w.rng() < 0.3;
    if (!poor && !curious) return;
    const peer = w.rng() < 0.7 ? Builds.peerBest(p, [...w.ents.values()].filter(e => e.kind === "player" && e.res)) : null;
    const nb = peer ? peer.name : Builds.nextBuild(p, w), tp = (adv.maps[home.map.id]?.meta.teleports || []).find(t => t.map === "gshop_1f");
    if (!tp) return;
    r._reb = { until: w.time + 300000, nb, peer, done: false, tp: { x: tp.x, y: tp.y } };
    if (peer) { blog(w, p, `${peer.from} saca ${peer.rate} exp/min con el reparto «${Builds.BUILDS[nb].es}» y yo ${Math.round(now)}: copio su idea. Voy al mago a reiniciar mis estadísticas.`); remember(p, `${peer.from} me enseñó que el reparto «${Builds.BUILDS[nb].es}» rinde ${peer.rate} exp/min.`, `${peer.from} showed me that the «${nb}» build yields ${peer.rate} exp/min.`); return; }
    blog(w, p, `Quiero probar otro reparto de puntos (${Builds.BUILDS[nb].es}): ${poor ? `mi build actual rinde ${Math.round(now)} exp/min y he visto ${Math.round(best)}` : "tengo curiosidad por ver si rinde más"}. Voy al mago a reiniciar mis estadísticas.`);
    if (w.rng() < 0.6) speak(adv, p, `§you are going to the mage to reset your stats and try a new build (${Builds.BUILDS[nb].es.replace(/^./, c => c)})`);
    return;
  }
  const d = r._reb;
  if (w.time > d.until || p.hp < p.maxHp * 0.4) { r._reb = null; return; }
  if (w === home) {
    if (d.done) { r._reb = null; return; }
    if (!b.travel) { b.travel = { x: d.tp.x, y: d.tp.y, w, until: w.time + 90000 }; b.path = null; b.goal = null; b.fails = 0; }
    return;
  }
  if (!d.done) {
    const mage = Respec.mageNear(w, p);
    if (!mage) { let m = null; for (const e of w.ents.values()) if (e.kind === "citizen" && e.type === Respec.RESPEC.mageType) m = e; if (m && !b.travel) { b.travel = { x: m.x, y: m.y + 1, w, until: w.time + 30000 }; b.path = null; b.goal = null; b.fails = 0; } else if (!m) r._reb = null; return; }
    if (w.busy(p) || w.time - (d.cmdAt || 0) < 2500) return;
    d.cmdAt = w.time;
    { const old = Builds.buildOf(p); Builds.closeBuild(p, w); const e = (p.res.builds || []).find(x => x.name === old), top = Math.max(0, ...(p.res.builds || []).map(x => x.rate)); if (e && e.rate > 0 && e.rate >= top && p.guild && w.rng() < 0.7) { blog(w, p, `Recomiendo el reparto «${Builds.BUILDS[old].es}»: me dio ${e.rate} exp/min.`); gsay(adv, p, `recommend your stat build «${Builds.BUILDS[old].es}» (it gave you ${e.rate} exp/min) to your guildmates`); } }
    if (adv.command(p.id, { t: "statreset" })) {
      d.done = true; p.res.build = d.nb; if (d.forced) { r.forcedDone = true; r.sig = Builds.itemSig(p); r.rsN = (r.rsN | 0) + 1; if (d.arch && d.arch !== p.res.arch) { blog(w, p, `Cambio de clase: de ${p.res.arch} a ${d.arch} según mis ítems.`); p.res.arch = d.arch; } } r.bperf = { name: d.nb, t0: w.time, exp0: p.exp }; b.errand = 0;
      blog(w, p, `Reinicié mis estadísticas y las reparto como «${Builds.BUILDS[d.nb].es}».`);
      remember(p, "Reinicié mis estadísticas para probar un reparto «" + Builds.BUILDS[d.nb].es + "».", "I reset my stats to try a different build: " + d.nb + ".");
      for (const [stat, n] of Object.entries(Builds.allocate(p, p.pool))) if (n > 0) adv.command(p.id, { t: "stat", stat, n });
      if (p.pool > 0) adv.command(p.id, { t: "stat", stat: "str", n: p.pool });
    } else if (++d.fails > 3) r._reb = null; else d.fails = (d.fails | 0) + 1;
    return;
  }
  const out = (adv.maps[w.map.id]?.meta.teleports || []).find(t => t.map === home.map.id) || (adv.maps[w.map.id]?.meta.teleports || [])[0];
  if (out && !b.travel) { b.travel = { x: out.x, y: out.y, w, until: w.time + 60000 }; b.path = null; b.goal = null; b.fails = 0; }
}
// ---- fosos de Promise Land (INVENTO): cada zona de aparición de monstruos es un foso. Lo controla el bando con jugadores dentro (rect + 6 casillas) mientras el otro no tenga ninguno.
// `adv.pits` (no se guarda): id → { side, since }. Los habitantes que lo aguantan suman tiempo (`qa.pvp.held`, meta «pit»).
function pits(adv, w, p, r) {
  if (!w.pvp || p.dead) return;
  if (w.time - (adv._pitAt ?? -1e9) >= 2000) {                                    // el primero que llega cada 2 s recalcula quién domina cada foso
    adv._pitAt = w.time; adv.pits ||= new Map();
    const inside = (e, z) => e.x >= z.rect[0] - 6 && e.x <= z.rect[2] + 6 && e.y >= z.rect[1] - 6 && e.y <= z.rect[3] + 6;
    for (const z of FOSOS(adv)) {
      const n = { 1: 0, 2: 0 };
      for (const e of w.ents.values()) if (e.kind === "player" && !e.dead && (e.side === 1 || e.side === 2) && inside(e, z)) n[e.side]++;
      const owner = n[1] && !n[2] ? 1 : n[2] && !n[1] ? 2 : 0, old = adv.pits.get(z.id);
      if (owner && (!old || old.side !== owner)) { adv.pits.set(z.id, { side: owner, since: w.time }); for (const e of w.ents.values()) if (e.res && e.side === owner && inside(e, z)) blog(w, e, `${owner === 1 ? "Aresden" : "Elvine"} domina el foso ${z.id} (${z.name}).`); }
      else if (!owner && old && n[old.side] === 0) adv.pits.delete(z.id);
    }
  }
  const dt = w.time - (r._heldAt ?? w.time); r._heldAt = w.time;
  if (dt > 0 && dt <= 5000) {
    const z = FOSOS(adv).find(q => p.x >= q.rect[0] - 6 && p.x <= q.rect[2] + 6 && p.y >= q.rect[1] - 6 && p.y <= q.rect[3] + 6), st = z && adv.pits?.get(z.id);
    if (st && st.side === p.side) r.qa.pvp.held = (r.qa.pvp.held || 0) + dt / 1000;
  }
}
// Grupos de hasta 4 del mismo bando: el de más nivel lidera, los demás lo siguen (party real) y se disuelven al cabo de un rato para mezclarse.
function social(adv, w, p, r) {
  const b = p.bot, sup = r.job === "support";
  if (isCraft(r)) return;
  if (w.time < (r._socAt ||= w.time + (sup ? 5000 : 15000) + Math.floor(w.rng() * 20000))) return;
  r._socAt = w.time + (sup ? 8000 : 25000);
  if (b.owner != null && !r.followUntil) {                                      // miembro: ¿toca disolver?
    if (adv.bots.get(b.owner)?.res && w.time > (r._leaveAt || 0)) { blog(w, p, "Dejo el grupo para ir por mi cuenta un rato."); b.owner = null; Party.leave(w, p, true); }
    return;
  }
  if (b.owner != null || r.followUntil || r._trip || r._pet || p.dead || b.rest) return;
  let best = null, bd = 99;
  for (const q of adv.bots.values()) {
    if (q === p || !q.res || q.dead || q.side !== p.side || adv.worldFor(q.id) !== w || q.bot.owner != null || q.res.followUntil || q.res._trip || q.res._pet || q.res.job) continue;     // los de oficio no entran en grupos corrientes
    const d = dist(p, q);
    if (d > (sup ? 45 : 20) || Math.abs(q.level - p.level) > (sup ? 40 : 10) || members(adv, p) + members(adv, q) + 2 > 4) continue;
    if (d < bd) { best = q; bd = d; }
  }
  if (!best || (!sup && w.rng() > 0.5)) return;
  // el de apoyo siempre se une como miembro (curar y reforzar), se queda mucho más y busca grupo cada pocos segundos
  const lead = sup ? best : best.level > p.level || (best.level === p.level && members(adv, best) > members(adv, p)) ? best : p, mem = lead === p ? best : p;
  mem.bot.owner = lead.id; mem.res._leaveAt = w.time + (sup ? 1500000 + Math.floor(w.rng() * 900000) : 600000 + Math.floor(w.rng() * 900000)); mem.bot.partyAt = 0;
  blog(w, mem, `Me uno al grupo de ${lead.name} (nv ${lead.level}).`); blog(w, lead, `${mem.name} (nv ${mem.level}) se une a mi grupo.`);
  remember(mem, "Me uní al grupo de " + lead.name + ".", "Joined " + lead.name + "'s party."); remember(lead, mem.name + " se unió a mi grupo.", mem.name + " joined my party.");
  if (w.rng() < 0.6) speak(adv, lead, fmt(lead, "group", lead.res.lang, mem.name, w));
  befriend(lead, mem.name, 1); befriend(mem, lead.name, 1);
}

// ---------------------------------------------------------------- comercio, grupo y tertulia en la tienda (INVENTO del port)
// Los habitantes comercian con jugadores y entre ellos (systems/trade.js, con las mismas órdenes que un cliente): regalan a quien aprecian (afinidad `rel` ≥ 6),
// venden al 70 % de lo que valen a conocidos y piden el precio entero a desconocidos; compran lo que les sirve (item level) y rechazan lo que no.
// También aceptan o piden grupo, y de vez en cuando se reúnen junto a la tienda de Aresfarm a charlar.
const worth = (w, i) => { const d = w.data.item(i.id); if (!d) return 1; const base = Math.max(5, Math.abs(d.price || 0) * 0.5), q = d.type === ITYPE.EQUIP ? itemLevel(d, i.attr, i.id) * 6 : 0; return Math.floor((base + q) * (i.count || 1)); };
const priceFor = (rel, total) => (rel >= 6 ? 0 : Math.floor(total * (rel >= 3 ? 0.7 : 1)));
const nameOf = (w, i) => (w.data.item(i.id)?.display || (w.data.item(i.id)?.name || "?").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " "));
const langFor = (r, who) => r.hl?.[who] || r.lang;
// Sin modelo de lenguaje, en los tratos hablan con frases fijas (si no, el comprador no sabría qué quiere el habitante)
const CANNED = {
  tsell: ["{n}, te vendo esto: {i}, por {p} de oro.", "{n}, I'll sell you this: {i}, for {p} gold."], tgift: ["{n}, te regalo esto: {i}.", "{n}, here's a gift: {i}."],
  toffer: ["Pongo {i} sobre la mesa, pido {p} de oro.", "I put {i} on the table, asking {p} gold."], tpay: ["Pongo {p} de oro por {i}.", "I put {p} gold for {i}."],
  tconfirm: ["Trato hecho, confirmo.", "Deal, I confirm."], twait: ["{n}, ¿qué me ofreces?", "{n}, what do you offer?"], task: ["{n}, ¿qué te interesa?", "{n}, what are you after?"],
  tbye: ["Será otra vez.", "Maybe next time."], tnothing: ["{n}, no tengo nada para ti ahora.", "{n}, I have nothing for you right now."], tno: ["{n}, ese precio no me conviene.", "{n}, that price doesn't suit me."],
  greet: [["¡Hola, {n}!", "Hi, {n}!"], ["{n}, buenas. ¿Todo bien?", "{n}, hey. All good?"], ["Ey {n}, ¿cazamos juntos?", "Hey {n}, hunt together?"]],
  again: [["¡{n}! Cuánto tiempo, ¿cazamos juntos?", "{n}! Long time, want to hunt together?"], ["Otra vez por aquí, {n}.", "You again, {n}."]],
  idle: [["Hoy hay que seguir mejorando.", "Gotta keep improving today."], ["¿Alguien quiere formar grupo?", "Anyone want to party up?"], ["Qué bien se está por aquí.", "Nice around here."]],
  admire: [["¡{n}, qué summon tan grande! ¿Es de nivel máximo?", "{n}, what a huge summon! Is it max level?"], ["Guau {n}, ese summon al máximo da miedo.", "Wow {n}, that maxed summon is scary."]],
  tnoneed: ["{n}, eso no me hace falta ahora.", "{n}, I don't need that right now."], tcounter: ["{n}, mi objeto vale más que eso.", "{n}, my item is worth more than that."],
};
const say2 = (adv, w, p, key, who, extra = {}) => {
  let c = CANNED[key];
  if (c && Array.isArray(c[0])) c = c[Math.floor(w.rng() * c.length)];
  if (c && (typeof adv.llm !== "function" || adv.llm.ready === false)) {
    const t = c[langFor(p.res, who) === "en" ? 1 : 0].replace("{n}", who || "").replace("{i}", extra.i ?? "").replace("{p}", extra.p ?? "");
    sayLong(adv, p, "", t, false); return;
  }
  speak(adv, p, fmt(p, key, langFor(p.res, who), who, w, extra));
};
const wornIlvl = (w, p, d) => {
  const slot = d.equipPos === EQUIP.TWOHAND ? EQUIP.RHAND : d.equipPos, uid = p.equip[slot] ?? (slot === EQUIP.RHAND ? p.equip[EQUIP.TWOHAND] : undefined), i = uid !== undefined && Inv.instOf(p, uid);
  return i ? itemLevel(w.data.item(i.id), i.attr, i.id) : 0;
};
const canUse = (q, d) => d.type === ITYPE.EQUIP && !(d.levelLimit > q.level) && !(d.gender === 1 && q.gender !== 1) && !(d.gender === 2 && q.gender !== 2) && d.equipPos > 0 && d.equipPos < EQUIP.FULLBODY;
// objeto de la mochila que no lleva puesto y que a `q` le mejoraría lo que lleva
function spareFor(w, p, q) {
  const worn = new Set(Object.values(p.equip));
  let best = null, bg = 0;
  for (const i of p.bag) {
    const d = w.data.item(i.id);
    if (!d || worn.has(i.uid) || i.comp || i.life === 0 || !canUse(q, d)) continue;
    const mine = itemLevel(d, i.attr, i.id), gain = mine - wornIlvl(w, q, d);
    if (gain > 1 + mine * 0.15 && gain > bg && (!canUse(p, d) || mine <= wornIlvl(w, p, d) * 1.0 + 1)) { best = i; bg = gain; }   // le sirve a q y a mí no me mejora (o no puedo usarlo: otro sexo/nivel)
  }
  return best;
}
// ALMACÉN: lo guardado para comerciar sale de él cuando alguien lo necesita (los habitantes lo hacen "de paso", como vender)
function fromBank(w, p, q) {
  if (!p.bank?.length) return;
  let bi = -1, bg = 0;
  p.bank.forEach((i, k) => { const d = w.data.item(i.id); if (!d || !canUse(q, d)) return; const mine = itemLevel(d, i.attr, i.id), gain = mine - wornIlvl(w, q, d); if (gain > 1 + mine * 0.15 && gain > bg) { bi = k; bg = gain; } });
  if (bi >= 0) Shop.withdraw(w, p, { index: bi });
}
const usefulFor = (w, p, items) => items.some(i => { const d = w.data.item(i.id); return d && canUse(p, d) && itemLevel(d, i.attr, i.id) > wornIlvl(w, p, d) * 1.08 + 0.5; });

function partyAndTrade(adv, w, p, r) {
  const b = p.bot, now = w.time;
  // ---- invitación de grupo recibida (un jugador o un habitante nos pide)
  if (p.partyQuery && !r._pq) r._pq = { at: now + 800 + Math.floor(w.rng() * 1200), from: p.partyQuery.from };
  if (r._pq && now >= r._pq.at) {
    const q = r._pq; r._pq = null;
    const f = w.ents.get(q.from), human = f && f.kind === "player" && !adv.bots.has(f.id);
    if (p.partyQuery) {
      const yes = !!f && !p.dead && !r._trip && !r._delve && !r._pet && (human ? relOf(p, f.name) >= 1 || w.rng() < 0.7 : w.rng() < 0.8);
      Party.answer(w, p, yes ? 1 : 0);
      if (human && f) { befriend(p, f.name, yes ? 2 : 0); if (yes) { if (b.owner == null) { b.owner = f.id; r.followUntil = now + 10 * 60000; b.partyAt = now + 5000; } say2(adv, w, p, "yes", f.name); remember(p, "Me uní al grupo de " + f.name + ".", "Joined " + f.name + "'s party."); } else say2(adv, w, p, "no", f.name); }
    }
  }
  // ---- grupo con un jugador humano: lo sigue mientras dure
  if (p.party && b.owner == null) { const h = [...w.ents.values()].find(e => e.kind === "player" && !adv.bots.has(e.id) && !e.dead && p.party.names.includes(e.name)); if (h) { b.owner = h.id; r.followUntil = now + 10 * 60000; } }
  // ---- tratos
  if (p.tradeQuery && !r._tq) r._tq = { at: now + 600 + Math.floor(w.rng() * 900), from: p.tradeQuery.from };
  if (r._tq && now >= r._tq.at) {
    const q = r._tq; r._tq = null;
    if (p.tradeQuery) {
      const f = w.ents.get(q.from), human = f && !adv.bots.has(f.id), calm = now - p.lastCombat > 4000 && !p.dead && !b.rest;
      const yes = !!f && calm && (!human || relOf(p, f.name) >= 1 || w.rng() < 0.6);
      Trade.answer(w, p, yes);
      if (human && f) { if (yes) { befriend(p, f.name, 1); say2(adv, w, p, "task", f.name); } else say2(adv, w, p, "tnoneed", f.name); }
    }
  }
  if (p.trade) return tradeStep(adv, w, p, r);
  r._tr = null;
  // ---- proponer un trato (cada ~60 s como mucho; con quien está cerca y aprecia)
  if (now < (r._dealAt ||= now + 30000 + Math.floor(w.rng() * 40000)) || p.dead || b.rest || b.target || b.travel || b.owner != null || r._trip || r._delve || r._pet || r._plan || w.pvp || busyTrade(p) || now - p.lastCombat < 6000 || w.map.kind === "dungeon") return;       // solo comercia cuando está parado y libre (no a mitad de una caza, viaje, cripta o plan de grupo)
  r._dealAt = now + 60000 + Math.floor(w.rng() * 90000);
  const group = r._gather && now < r._gather.until;
  for (const q of w.ents.values()) {
    if (q === p || q.kind !== "player" || q.dead || q.side !== p.side || dist(p, q) > 8 || busyTrade(q) || q.bot?.rest) continue;
    const qb = adv.bots.has(q.id), rel = relOf(p, q.name);
    if (!qb && rel < 1) continue;
    if (qb && !group && rel < 2 && w.rng() > (r.arch === "trader" ? 0.9 : 0.5)) continue;       // a los amigos siempre intenta ayudarlos con el equipo
    fromBank(w, p, q); const it = spareFor(w, p, q); if (!it) continue;
    const total = worth(w, it); let ask = priceFor(rel, total);
    if (qb && ask > q.gold * 0.6) ask = rel >= 3 ? 0 : -1;                                   // el comprador no puede pagarlo: regalo si hay afinidad
    if (ask < 0) continue;
    if (Trade.request(w, p, q.name)) { r._deal = { to: q.id, uid: it.uid, ask, until: now + 45000 }; say2(adv, w, p, ask ? "tsell" : "tgift", q.name, { i: nameOf(w, it), p: ask }); break; }
  }
  // ---- AYUDAR A LOS AMIGOS CON EL EQUIPO: si un amigo conectado (en este mapa) necesita algo que llevo de más o tengo en el almacén, voy a su encuentro para dárselo/venderle
  if (now >= (r._helpAt ||= now + 90000) && !b.travel) {
    r._helpAt = now + (r.arch === "trader" ? 90000 : 180000);
    for (const { q, rel } of adv.friendsOf(p)) {
      if (adv.worldFor(q.id) !== w || dist(p, q) <= 8) continue;
      const it = spareFor(w, p, q) || (p.bank?.some(i => { const d = w.data.item(i.id); return d && canUse(q, d) && itemLevel(d, i.attr, i.id) > wornIlvl(w, q, d) * 1.15 + 1; }) ? { bank: true } : null);
      if (!it) continue;
      b.travel = { x: q.x, y: q.y, w, until: now + 40000, seek: true }; b.path = null; b.goal = null;
      blog(w, p, `${q.name} (afinidad ${rel}) necesita equipo y yo tengo algo que le sirve: voy a su encuentro.`);
      break;
    }
  }
  // ---- invitar a un jugador humano cercano a mi grupo (solo sin grupo propio)
  if (!p.party && b.owner == null && !r._trip && !r._delve && !w.pvp) {
    for (const q of w.ents.values()) {
      if (q.kind !== "player" || adv.bots.has(q.id) || q.dead || q.side !== p.side || dist(p, q) > 9 || q.partyQuery || q.partyReq || relOf(p, q.name) < 1) continue;
      const inv = (r._inv ||= {}); if (now - (inv[q.name] || -1e9) < 8 * 60000 || w.rng() > 0.4) continue;
      inv[q.name] = now;
      if (Party.request(w, p, q.name)) { say2(adv, w, p, "tinvite", q.name); blog(w, p, `Invito a ${q.name} a mi grupo.`); break; }
    }
  }
}
const busyTrade = p => !!(p.trade || p.tradeReq || p.tradeQuery);
function tradeStep(adv, w, p, r) {
  const t = p.trade, o = w.ents.get(t.with); if (!o?.trade) return;
  const now = w.time, tr = (r._tr ||= { at: now, set: false, said: {} }), rel = relOf(p, o.name), deal = r._deal && r._deal.to === o.id ? r._deal : null;
  const mine = t.offer.map(u => Inv.instOf(p, u)).filter(Boolean), theirs = o.trade.offer.map(u => Inv.instOf(o, u)).filter(Boolean), tg = o.trade.gold;
  const once = k => !tr.said[k] && (tr.said[k] = true);
  const names = list => list.map(i => (w.data.item(i.id)?.name || "item").replace(/-/g, " ") + ((i.count || 1) > 1 ? " x" + i.count : "")).join(", ");
  const confirm = () => { if (!t.ok) { if (once("conf")) say2(adv, w, p, "tconfirm", o.name); Trade.confirm(w, p); } };
  const quit = key => { if (once("q")) say2(adv, w, p, key, o.name); Trade.cancel(w, p, ""); r._deal = null; };
  if (now - tr.at > 50000) return quit("tbye");
  if (deal) {                                                                              // yo propuse: ofrezco el objeto y espero el pago
    if (!tr.set) { tr.set = true; Trade.setItem(w, p, deal.uid); const it = Inv.instOf(p, deal.uid); say2(adv, w, p, deal.ask ? "toffer" : "tgift", o.name, { i: it ? names([it]) : "", p: deal.ask }); return; }
    if (!mine.length) return quit("tbye");
    if (tg >= deal.ask) confirm();
    return;
  }
  const tw = theirs.reduce((a, i) => a + worth(w, i), 0), mw = mine.reduce((a, i) => a + worth(w, i), 0);
  if (!mine.length && !theirs.length && tg === 0) { if (once("ask")) say2(adv, w, p, "task", o.name); else if (now - tr.at > 14000 && once("wait")) say2(adv, w, p, "twait", o.name); return; }                 // espera a ver qué ponen
  if (!mine.length && !theirs.length && tg > 0) {                                           // quieren comprarme algo: ofrezco algo que valga lo que pagan
    if (tr.set) return;
    let pick = null;
    for (const i of p.bag) { const d = w.data.item(i.id); if (!d || i.comp || Object.values(p.equip).includes(i.uid) || d.id === 90) continue; const price = priceFor(rel, worth(w, i)); if (price <= tg && price >= tg * 0.4 && (!pick || worth(w, i) > worth(w, pick))) pick = i; }
    if (pick) { tr.set = true; Trade.setItem(w, p, pick.uid); r._deal = { to: o.id, uid: pick.uid, ask: priceFor(rel, worth(w, pick)), until: now + 30000 }; }
    else return quit("tnothing");
    return;
  }
  if (!mine.length && t.gold === 0 && theirs.length) {                                      // me ofrecen algo
    if (tg > 0) { confirm(); return; }                                   // con oro encima: es un regalo y me lo quedo
    if (!usefulFor(w, p, theirs) && rel < 5) return quit("tnoneed");
    const asked = o.res?._deal?.to === p.id ? o.res._deal.ask : priceFor(rel, tw);                // si me lo vende un habitante, pago lo que pide
    if (asked > p.gold * 0.6) return quit("tno");
    const pay = Math.min(Math.floor(p.gold * 0.6), asked);
    if (pay > 0 && !tr.set) { tr.set = true; Trade.setGold(w, p, pay); say2(adv, w, p, "tpay", o.name, { i: names(theirs), p: pay }); return; }
    confirm();
    return;
  }
  const fair = tw >= mw * (rel >= 4 ? 0.7 : 0.95) - 1;                                       // ambos ponen algo: acepto si me compensa
  if (fair) confirm();
  else if (now - tr.at > 6000 && once("counter")) say2(adv, w, p, "tcounter", o.name);
  else if (now - tr.at > 12000) quit("tno");
}
// el trato salió bien: afinidad y recuerdo para los dos habitantes
function tradeDone(adv, w, ev) {
  const a = w.ents.get(ev.id), b = w.ents.get(ev.with);
  for (const [x, y] of [[a, b], [b, a]]) if (x?.res && y) { befriend(x, y.name, 2); x.res.trades = (x.res.trades | 0) + 1; remember(x, "Comercié con " + y.name + ".", "Traded with " + y.name + "."); if (w.rng() < 0.7) say2(adv, w, x, "tdone", y.name); x.res._deal = null; }
}

// ---- tertulia junto a la tienda: de vez en cuando varios habitantes se reúnen cerca de la puerta de la tienda general y charlan
function gather(adv, w, p, r, home) {
  const b = p.bot, now = w.time;
  if (w !== home || p.dead) return;
  if (r._gather) {
    const g = r._gather;
    if (now > g.until || p.hp < p.maxHp * 0.5 || b.owner != null || r._trip || r._delve || r._pet) { r._gather = null; b.hold = 0; return; }
    if (dist(p, g.spot) > 4) { if (!b.travel && !b.target) { b.travel = { x: g.spot.x, y: g.spot.y, w, until: now + 60000 }; b.path = null; b.goal = null; b.fails = 0; } return; }
    b.hold = Math.max(b.hold || 0, now + 3000);
    if (now >= (g.talkAt ||= now + 3000 + Math.floor(w.rng() * 6000))) {
      g.talkAt = now + 9000 + Math.floor(w.rng() * 9000);
      const mates = [...adv.bots.values()].filter(q => q !== p && q.res?._gather && !q.dead && adv.worldFor(q.id) === w && dist(q, p) <= 8);
      for (const m of mates) if (w.rng() < 0.5) { befriend(p, m.name, 1); befriend(m, p.name, 1); }                         // charlar en la tienda crea afinidad
      if (mates.length || w.rng() < 0.3) { const top = Object.entries(r.qa.kills).sort((x, y) => y[1] - x[1])[0]; speak(adv, p, fmt(p, "banter", r.lang, mates[0]?.name || "", w, { m: (top ? top[0] : "Slime").replace(/-/g, " ") })); }
    }
    return;
  }
  if (now < (r._gatherAt ||= now + 120000 + Math.floor(w.rng() * 360000))) return;
  r._gatherAt = now + 480000 + Math.floor(w.rng() * 600000);
  if (b.owner != null || r._trip || r._delve || r._pet || b.rest || p.hp < p.maxHp * 0.7 || b.travel || w.pvp) return;
  const tp = (adv.maps[home.map.id]?.meta.teleports || []).find(t => t.map === "gshop_1f"); if (!tp) return;
  const spot = w.freeSpotNear(tp.x + 2 + Math.floor(w.rng() * 3), tp.y + 3 + Math.floor(w.rng() * 3)); if (!spot || w.teleports.has(w.grid.idx(spot[0], spot[1]))) return;
  r._gather = { spot: { x: spot[0], y: spot[1] }, until: now + 75000 + Math.floor(w.rng() * 60000) };
  b.travel = { x: spot[0], y: spot[1], w, until: now + 60000 }; b.path = null; b.goal = null; b.fails = 0;
  blog(w, p, `Me paso por la tienda a charlar un rato con los vecinos (${spot[0]},${spot[1]}).`);
}

// ---------------------------------------------------------------- puestos (INVENTO del port: systems/stall.js)
// Con la mochila llena de equipo que no le sirve, el habitante entra en la tienda, monta un puesto con precios razonables y vuelve a sus cosas;
// más tarde regresa a recoger el oro (y cierra el puesto si ya no queda nada). Los jugadores le compran aunque él no esté.
const stallOf = (adv, p) => (adv.stallDb || []).find(x => x.owner === p.name.toLowerCase() && !x.closed);
// 0.78.0 (INVENTO): los artesanos (granjero/pescador) venden en el puesto lo que cosechan o pescan, al precio de Item.cfg en valor absoluto (el original guarda con signo negativo lo que no vende la tienda; sin precio: SFood.FOOD_PRICE)
export const produceStock = (w, p) => p.bag.filter(i => Comp.FEED[i.id] && !i.comp).map(i => ({ i, price: Math.max(1, Math.abs(w.data.item(i.id)?.price) || SFood.FOOD_PRICE) })).slice(0, Stall.MAX_ITEMS_STALL);
// ¿le sirve esta fila de un puesto a un bot con summon? comida de estadística que su bola aún acepta (summonfood.wanted) o un caramelo; devuelve cuántas piezas comprar
export function foodWanted(w, p, row) {
  if (p.dead || p.res && isCraft(p.res)) return 0;
  const d = w.data.item(row.inst.id); if (!d) return 0;
  const balls = Comp.activeBalls(p); if (!balls.length) return 0;
  const ok = Comp.isCandy(d) || balls.some(b => SFood.wanted(b)?.id === row.inst.id);
  if (!ok || row.price > p.gold - SFood.RESERVE) return 0;
  return Math.max(1, Math.min(row.inst.count || 1, SFood.PER_ERRAND, Math.floor((p.gold - SFood.RESERVE) / row.price)));
}
export function stallSurplus(w, p) {
  const worn = new Set(Object.values(p.equip)), out = [];
  for (const i of p.bag) { if (worn.has(i.uid) || i.comp) continue; const v = judge(w, p, i, []); if (stallable(v)) out.push({ i, v }); }          // lo que juzga «para comerciar»
  return out.sort((a, b) => b.v.value - a.v.value).slice(0, Stall.MAX_ITEMS_STALL);
}
function stallAI(adv, w, p, r, home) {
  const b = p.bot, now = w.time;
  if (p.dead) { r._stall = null; return; }
  const st = r._stall;
  if (st) {
    if (now > st.until || b.owner != null || r._trip || r._delve || r._pet) { r._stall = null; if (w !== home) { adv.transfer(p, w, home, home.home); b.home = { x: p.x, y: p.y }; b.path = null; b.target = null; } return; }
    if (w === home) {
      if (!b.travel && !b.target) { b.travel = { x: st.tp.x, y: st.tp.y, w, until: now + 60000 }; b.path = null; b.goal = null; b.fails = 0; }
      return;
    }
    if (w.map.id !== "wrhus_1f") { r._stall = null; return; }
    if (!st.done && st.buy) {                                                                 // comprador: se acerca al puesto que le interesa y compra lo que le mejora el equipo
      st.done = true; st.back = now + 4000;
      const me = p.name.toLowerCase();
      for (const e of Stall.stallsOf(w)) {
        if (e.stall.owner === me) continue;
        const row = e.stall.items.find(x => foodWanted(w, p, x) || x.price <= p.gold * 0.7 && Inv.canCarry(p, w.data, w.data.item(x.inst.id), 1, x.inst) && judge(w, p, x.inst, []).act === "equip"); if (!row) continue;
        const nFood = foodWanted(w, p, row);
        const sp = w.freeSpotNear(e.x + 1, e.y + 1); if (sp) adv.relocate(p, w, sp);
        const __r = adv.command(p.id, { t: "stallbuy", sid: e.stall.sid, uid: row.inst.uid, count: nFood || row.inst.count || 1 })
        if (__r) {
          remember(p, "Compré en el puesto de " + e.stall.name + ".", "I bought something at " + e.stall.name + "'s stall.");
          if (nFood) { SFood.feedSummons(w, p, t => blog(w, p, t)); blog(w, p, "Compro comida en el puesto de " + e.stall.name + " para mi summon."); }
          else blog(w, p, "Compro en el puesto de " + e.stall.name + " algo que me mejora el equipo."); break;
        }
      }
    } else if (!st.done) {
      st.done = true; st.back = now + 4000;
      // BUG-012: el puesto no se monta junto a la puerta; se aparta a más de Stall.DOOR_GAP casillas de cualquier teletransporte
      const nearTp = (x, y) => [...w.teleports.values()].some(t => Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) <= Stall.DOOR_GAP);
      if (nearTp(p.x, p.y)) for (const [dx, dy] of [[10, 0], [-10, 0], [0, 10], [0, -10], [10, 10], [-10, -10], [10, -10], [-10, 10], [13, 0], [-13, 0], [0, 13], [0, -13]]) {
        const sp = w.freeSpotNear(p.x + dx, p.y + dy); if (sp && !nearTp(sp[0], sp[1])) { adv.relocate(p, w, sp); break; }
      }
      const mine = stallOf(adv, p);
      if (mine) {
        const gold = mine.gold; adv.command(p.id, { t: "stalltake" });
        const fresh = isCraft(r) ? produceStock(w, p) : [];
        if (fresh.length && adv.command(p.id, { t: "stallclose" })) {                                   // artesano: recoge lo no vendido y repone el puesto con la cosecha nueva
          const again = produceStock(w, p).map(({ i, price }) => ({ uid: i.uid, price, count: i.count || 1 }));
          if (again.length) adv.command(p.id, { t: "stallopen", title: pickBy(["Cosecha fresca", "Del campo", "Pesca del día"], hash(p.name), 3), items: again });
          blog(w, p, "Repongo mi puesto con " + again.length + " productos" + (gold ? " (+" + gold + " de oro)." : "."));
        }
        else if (!mine.items.length) { adv.command(p.id, { t: "stallclose" }); blog(w, p, "Cierro mi puesto: vendí todo" + (gold ? " (+" + gold + " de oro)." : ".")); }
        else if (gold) blog(w, p, "Recojo " + gold + " de oro de mi puesto.");
      } else {
        const items = isCraft(r) ? produceStock(w, p).map(({ i, price }) => ({ uid: i.uid, price, count: i.count || 1 })) : stallSurplus(w, p).map(({ i, v }) => ({ uid: i.uid, price: Math.max(1, Math.round(Math.max(v.value, Shop.sellPriceOf(w.data.item(i.id), i) * 2) * (0.9 + w.rng() * 0.4) / (i.count || 1))), count: i.count || 1 }));
        if (items.length && adv.command(p.id, { t: "stallopen", title: isCraft(r) ? pickBy(["Cosecha fresca", "Del campo", "Pesca del día"], hash(p.name), 3) : pickBy(["Ocasión", "Rebajas", "Todo a buen precio", "Liquidación", "Cosas útiles"], hash(p.name), 7), items })) {
          remember(p, "Monté un puesto en la tienda con " + items.length + " objetos.", "I set up a stall in the shop with " + items.length + " items.");
        }
      }
    } else if (now >= st.back) { r._stall = null; adv.transfer(p, w, home, home.home); b.home = { x: p.x, y: p.y }; b.path = null; b.target = null; }
    return;
  }
  if (w === home && now >= (r._buyAt ||= now + 200000 + (hash(p.name) % 200000))) {                // ¿hay algo a la venta que le mejore el equipo y pueda pagar?
    r._buyAt = now + 120000;
    const me = p.name.toLowerCase(), tp = (adv.maps[home.map.id]?.meta.teleports || []).find(t => t.map === "wrhus_1f");
    const want = tp && !(b.owner != null || r._trip || r._delve || r._pet || r._gather || b.rest || b.travel || w.pvp || p.hp < p.maxHp * 0.7) &&
      (adv.stallDb || []).some(sd => sd.owner !== me && sd.map === "wrhus_1f" && !sd.closed && sd.items.some(x => foodWanted(w, p, x) || x.price <= p.gold * 0.7 && Inv.canCarry(p, w.data, w.data.item(x.inst.id), 1, x.inst) && judge(w, p, x.inst, []).act === "equip"));
    if (want) {
      r._buyAt = now + 600000;
      r._stall = { tp: { x: tp.x, y: tp.y }, until: now + 120000, buy: true };
      b.travel = { x: tp.x, y: tp.y, w, until: now + 60000 }; b.path = null; b.goal = null; b.fails = 0;
      blog(w, p, "Voy a la tienda: hay en un puesto algo que me mejora el equipo."); return;
    }
  }
  if (w !== home || now < (r._stallAt ||= now + 240000 + (hash(p.name) % 300000))) return;
  r._stallAt = now + 30000;                                                                   // ocupado: reintenta pronto
  if (b.owner != null || r._trip || r._delve || r._pet || r._gather || b.rest || p.hp < p.maxHp * 0.7 || b.travel || w.pvp) return;
  const mine = stallOf(adv, p), tp = (adv.maps[home.map.id]?.meta.teleports || []).find(t => t.map === "wrhus_1f"); if (!tp) return;
  if (isCraft(r)) { if (produceStock(w, p).length < (mine ? 1 : 2)) return; r._stallAt = now + 150000; r._stall = { tp: { x: tp.x, y: tp.y }, until: now + 120000 }; b.travel = { x: tp.x, y: tp.y, w, until: now + 60000 }; b.path = null; b.goal = null; b.fails = 0; blog(w, p, "Llevo mi cosecha al puesto de la tienda."); return; }
  if (!mine && stallSurplus(w, p).length < (p.bag.length >= 40 ? 1 : 3)) return;                // monta puesto con ≥3 objetos que le sobran (o 1 si la mochila casi está llena)
  if (mine && !mine.gold && mine.items.length && w.rng() < 0.7) return;                        // nada que cobrar: casi nunca vuelve
  r._stallAt = now + 600000 + Math.floor(w.rng() * 600000);
  r._stall = { tp: { x: tp.x, y: tp.y }, until: now + 120000 };
  b.travel = { x: tp.x, y: tp.y, w, until: now + 60000 }; b.path = null; b.goal = null; b.fails = 0;
  blog(w, p, mine ? "Voy a mi puesto de la tienda a ver qué se ha vendido." : "Voy a montar un puesto en la tienda para vender lo que me sobra.");
}

// ---------------------------------------------------------------- guilds (INVENTO del port: systems/guild.js) ----------------------------------------------------------------
// Cada habitante decide por conveniencia: funda un guild con quien aprecia (afinidad `rel`), acepta o rechaza invitaciones, se apunta o no a las actividades
// que propone su Guildmaster (cripta, raid en Promise Land, buscar botín, cazar) y se va si no se siente a gusto. Por el chat «@» hablan entre ellos y
// se avisan de lo que aprenden: monstruos que matan, fosos donde los matan y guilds enemigos que hacen raid.
const GUILD_NAMES = ["Iron Oak", "Silver Wolves", "Crimson Order", "Dawn Watch", "Stormcallers", "Night Owls", "Brave Hearts", "Stone Wardens", "Golden Lanterns", "Ash and Ember", "Wild Hunt", "Rangers Rest", "Blue Banner", "Black Anvil", "Moon Harriers", "Last Lantern"];
const ETHOS = { warrior: ["raid", "hunt"], hunter: ["crypt", "hunt"], trader: ["loot", "hunt"], wanderer: ["loot", "crypt"], scholar: ["crypt", "loot"] };
const ACT_TXT = { crypt: "propose to your guild an activity: going down to the skeleton crypt together, leaving in a minute", raid: "propose to your guild an activity: a raid in Promise Land, leaving in a minute", loot: "propose to your guild an activity: hunting together to find loot, leaving in a minute" };
const gsay = (adv, p, text) => speak(adv, p, "@" + text);
const gline = (p, key, w, extra = {}, who = "") => fmt(p, key, p.res.lang, who, w, extra);
const leisureH = adv => ({ reg: () => adv.guildReg, blog, gsay, gchat: gchatLine, remember, befriend, line: gline, pitNear: (a, p) => FOSOS(a).find(z => p.x >= z.rect[0] - 8 && p.x <= z.rect[2] + 8 && p.y >= z.rect[1] - 8 && p.y <= z.rect[3] + 8) });
const lessons = adv => (adv.lessons ||= { mobs: [], pits: new Map() });

function guildAI(adv, w, p, r, home) {
  const b = p.bot, now = w.time, reg = adv.guildReg; if (!reg || p.dead) return;
  const G = Guild.guildOf(w, p);
  // ---- invitación recibida
  if (p.guildQuery && !r._gq) r._gq = { at: now + 1000 + Math.floor(w.rng() * 2000), from: p.guildQuery.from, guild: p.guildQuery.guild };
  if (r._gq && now >= r._gq.at) {
    const q = r._gq; r._gq = null;
    if (p.guildQuery) {
      const g = reg.guilds.get(q.guild), master = g && [...adv.bots.values()].find(x => x.name === g.master) || (g && w.ents.get(q.from));
      const rel = master ? relOf(p, master.name) : 0, ethos = g?.ethos && (ETHOS[r.arch] || []).includes(g.ethos);
      const human = master && !adv.bots.has(master.id);
      const yes = !!g && !p.dead && !G && p.level >= 5 && w.rng() < Math.min(0.95, 0.3 + 0.15 * Math.min(4, rel) + (ethos ? 0.2 : 0) + (human ? 0.2 : 0));
      Guild.answer(w, p, yes);
      if (yes) { remember(p, "Me uní al guild " + q.guild + ".", "Joined the guild " + q.guild + "."); blog(w, p, `Acepto entrar en el guild ${q.guild}.`); r._gSince = now; }
    }
  }
  if (!G) return guildFree(adv, w, p, r, home);
  const members = Guild.onlineMembers(reg, G), bots = members.filter(m => adv.bots.has(m.id));
  const master = G.master === p.name;
  // ---- conversación por el chat de guild (un miembro cada cierto tiempo; el resto responde en onGuildChat)
  if (bots.length >= 2 && now >= (G._chatAt ||= now + 20000 + Math.floor(w.rng() * 40000)) && bots[Math.floor(w.rng() * bots.length)] === p) {
    G._chatAt = now + 25000 + Math.floor(w.rng() * 45000); gsay(adv, p, gchatLine(adv, w, p, G));
  }
  // ---- bienvenida a quien entra
  for (const m of members) if (m !== p && !(G._greeted ||= new Set()).has(m.name)) { G._greeted.add(m.name); if (G._greeted.size > 1 && master && w.rng() < 0.9) gsay(adv, p, gline(p, "gwelcome", w, {}, m.name)); }
  if (master) guildMaster(adv, w, p, r, home, G, members, bots);
  else guildMember(adv, w, p, r, home, G, members);
  guildLaunch(adv, w, p, r, home, G);
}
function guildFree(adv, w, p, r, home) {
  const b = p.bot, now = w.time, reg = adv.guildReg;
  if (now < (r._gAt ||= now + 60000 + Math.floor(w.rng() * 120000))) return;
  r._gAt = now + 180000 + Math.floor(w.rng() * 240000);
  if (w !== home || w.pvp || b.rest || b.owner != null || r._trip || r._delve || p.level < Guild.MIN_LEVEL || p.stats.chr < Guild.MIN_CHR || !(p.side === 1 || p.side === 2)) return;
  // quien aprecia y no tiene guild, cerca
  const pals = [];
  for (const q of adv.bots.values()) if (q !== p && q.res && !q.dead && q.side === p.side && adv.worldFor(q.id) === w && !q.guild && dist(p, q) <= 20 && (relOf(p, q.name) >= 3 || (relOf(p, q.name) >= 1 && w.rng() < 0.4) || w.rng() < 0.12)) pals.push(q);
  if (!pals.length || w.rng() > 0.6) return;
  const taken = new Set([...reg.guilds.keys()].map(n => n.toLowerCase())), name = GUILD_NAMES.find(n => !taken.has(n.toLowerCase()) && w.rng() < 0.5) || GUILD_NAMES.find(n => !taken.has(n.toLowerCase()));
  if (!name) return;
  if (!adv.command(p.id, { t: "guildcreate", name })) return;
  const g = reg.guilds.get(name); if (!g) return;
  g.ethos = (ETHOS[r.arch] || ["hunt"])[Math.floor(w.rng() * (ETHOS[r.arch] || [1, 2]).length)];
  adv.command(p.id, { t: "guildcolor", cape: 1 + Math.floor(w.rng() * 15), boots: 1 + Math.floor(w.rng() * 15) });
  remember(p, "Fundé el guild " + name + ".", "Founded the guild " + name + "."); blog(w, p, `Fundo el guild ${name} (${g.ethos}) con ${pals.map(x => x.name).join(", ")}.`);
  gsay(adv, p, gline(p, "gfound", w, { g: name })); speak(adv, p, gline(p, "gfound", w, { g: name }));
  for (const q of pals.slice(0, 3)) adv.command(p.id, { t: "guildinvite", name: q.name });
  r._gSince = now;
}
function guildMaster(adv, w, p, r, home, G, members, bots) {
  const b = p.bot, now = w.time;
  G.ethos ||= (ETHOS[r.arch] || ["hunt"])[0];
  // reclutar: cada ~7 min invita a alguien cercano sin guild que aprecia (bot o jugador)
  if (now >= (r._recAt ||= now + 120000) && Object.keys(G.members).length < 12) {
    r._recAt = now + 420000 + Math.floor(w.rng() * 240000);
    for (const q of w.ents.values()) if (q.kind === "player" && q !== p && !q.dead && !q.guild && !q.guildQuery && q.side === p.side && dist(p, q) <= 9 && relOf(p, q.name) >= (adv.bots.has(q.id) ? 2 : 1)) { if (adv.command(p.id, { t: "guildinvite", name: q.name })) { speak(adv, p, `§invite ${q.name} to join your guild ${G.name}`); break; } }
  }
  // disuelve el guild si lleva mucho tiempo solo
  if (Object.keys(G.members).length === 1) { r._aloneAt ||= now; if (now - r._aloneAt > 25 * 60000 && w.rng() < 0.2) { blog(w, p, `Disuelvo el guild ${G.name}: nadie se unió.`); adv.command(p.id, { t: "guilddisband" }); r._aloneAt = 0; } } else r._aloneAt = 0;
  // actividad: cada 10-18 min con al menos otro miembro conectado
  if (G._act && now > G._act.until) G._act = null;
  if (!G._act && now >= (r._actAt ||= now + 90000 + Math.floor(w.rng() * 120000)) && bots.length >= 2 && !r._trip && !r._delve && !b.rest) {
    r._actAt = now + 600000 + Math.floor(w.rng() * 480000);
    const kinds = [G.ethos, G.ethos, "hunt", "crypt", "loot", "raid"], kind = kinds[Math.floor(w.rng() * kinds.length)];
    if (kind === "raid" && p.level < 10) return;
    let pit = null;
    if (kind === "raid") { const zones = FOSOS(adv).filter(z => !((lessons(adv).pits.get(z.id) || 0) > now)); pit = zones.length ? pickPit(adv, w, p, zones) : null; if (!pit) return; }
    G._act = { id: now, kind, at: now + 60000, until: now + 600000, pit: pit ? { id: pit.id, name: pit.name, rect: pit.rect } : null, yes: new Set([p.name]) };
    gsay(adv, p, "§" + ACT_TXT[kind]); blog(w, p, `Propongo al guild ${G.name}: ${kind}.`);
    r._gjoin = G._act;
  }
}
function guildMember(adv, w, p, r, home, G, members) {
  const now = w.time, master = members.find(m => m.name === G.master), act = G._act;
  // responde a la propuesta de actividad
  if (act && act.at > now && r._gans !== act.id && now >= (r._gansAt ||= 0)) {
    r._gansAt = now + 4000 + Math.floor(w.rng() * 6000);
    r._gans = act.id;
    const rel = relOf(p, G.master), match = (ETHOS[r.arch] || []).includes(act.kind), ok = !p.dead && !p.bot.rest && p.hp > p.maxHp * 0.6 && !r._trip && !r._delve && !r._pet && p.bot.owner == null && w === home && p.level >= (act.kind === "raid" ? 10 : act.kind === "crypt" ? 5 : 1);
    const yes = ok && w.rng() < Math.min(0.92, 0.4 + 0.1 * Math.min(5, rel) + (match ? 0.2 : 0));
    if (yes) { act.yes.add(p.name); r._gjoin = act; gsay(adv, p, gline(p, "gjoin", w)); blog(w, p, `Me apunto a la actividad del guild: ${act.kind}.`); } else gsay(adv, p, gline(p, "gskip", w));
  }
  // ¿me quedo? cada ~15 min: si apenas aprecia a su Guildmaster y a los demás, puede irse
  if (now >= (r._gEvalAt ||= now + 600000 + Math.floor(w.rng() * 600000))) {
    r._gEvalAt = now + 900000 + Math.floor(w.rng() * 600000);
    const mates = members.filter(m => m !== p), avg = mates.length ? mates.reduce((a, m) => a + relOf(p, m.name), 0) / mates.length : 0, score = relOf(p, G.master) + avg + (r.gpart || 0) * 0.5;
    if (score < 2.5 && w.rng() < 0.3) { blog(w, p, `Dejo el guild ${G.name}: no me siento a gusto (afinidad ${score.toFixed(1)}).`); gsay(adv, p, "§you are leaving the guild; say a short goodbye"); remember(p, "Dejé el guild " + G.name + ".", "Left the guild " + G.name + "."); adv.command(p.id, { t: "guildleave" }); }
  }
}
// A la hora de la actividad, los apuntados salen a la vez
function guildLaunch(adv, w, p, r, home, G) {
  const act = r._gjoin, now = w.time; if (!act) return;
  if (now > act.until || G._act !== act) { r._gjoin = null; return; }
  if (now < act.at || r._gdone === act.id) return;
  r._gdone = act.id; r.gpart = (r.gpart || 0) + 1;
  for (const m of act.yes) { if (m !== p.name) befriend(p, m, 1); }
  if (w !== home || p.dead || p.bot.rest || r._trip || r._delve || p.bot.owner != null) return;
  const b = p.bot;
  switch (act.kind) {
    case "crypt": startDelve(adv, w, p, r, home); break;
    case "raid": {
      const tps = (adv.maps[home.map.id]?.meta.teleports || []).filter(t => t.map === "2ndmiddle"); if (!tps.length || !act.pit) break;
      const tp = tps[tps.length >> 1];
      r._trip = { go: true, goUntil: now + 120000, until: now + 420000, pit: act.pit, guild: G.name };
      b.travel = { x: tp.x, y: tp.y, w, until: now + 120000 }; b.path = null; b.goal = null; b.fails = 0;
      blog(w, p, `Raid del guild ${G.name} al foso ${act.pit.id} (${act.pit.name}).`); break;
    }
    default: {                                                                              // loot / hunt: salen a la zona de monstruos a cazar y recoger botín
      b.huntAt = 0; b.travel = null; b.path = null; r._gloot = now + 300000; b.lootBoost = now + 300000;
      blog(w, p, `Actividad del guild: ${act.kind === "loot" ? "buscar botín" : "cazar"} en grupo.`);
    }
  }
}
// Charla en el chat de guild: los demás responden a veces
// Cada miembro conectado recibe el evento: lo apunta en su memoria de charla y, a menudo, contesta (con el modelo, usando lo hablado antes).
const llmOn = adv => typeof adv.llm === "function" && adv.llm.ready !== false;
function gchatLine(adv, w, p, G) {
  if (!llmOn(adv)) return gline(p, "gchat", w, { l: p.level });
  const past = talkCtx(p, "g", 4), topics = [`how your day is going (level ${p.level}, goal: ${goalText(p.res.goal, "en") || "none"})`, "something that happened to you recently", "a question for one of your guild mates", "a plan for the next hunt or crypt run", "a joke or a complaint about the monsters or the loot"];
  const mem = (p.res.mem || []).slice(-3).map(m => m.en).join(" "), topic = topics[Math.floor(w.rng() * topics.length)];
  return "§chat casually with your guild mates about " + topic + (mem ? ". Things you remember: " + mem : "") + (past ? ". If it fits, continue what was said before" : "");
}
function onGuildChat(adv, w, ev) {
  const b = adv.bots.get(ev.id); if (!b?.res) return;
  const own = ev.name === b.name;
  if (!own && !adv.bots.has([...w.ents.values()].find(q => q.kind === "player" && q.name === ev.name)?.id)) Leisure.humanCall(adv, w, Guild.guildOf(w, b), ev);
  logTalk(b, w, ev.name, ev.text, "g", own);
  if (own) return;
  const r = b.res, rel = relOf(b, ev.name);
  if (!own && rel >= 0 && w.rng() < 0.12) remember(b, `${ev.name} dijo en el guild: «${String(ev.text).slice(0, 70)}»`, `${ev.name} said in guild chat: «${String(ev.text).slice(0, 70)}»`);
  if (w.rng() > 0.7 || w.time < (r._grCd || 0)) return;
  r._grCd = w.time + 12000; if (w.rng() < 0.3) befriend(b, ev.name, 1);
  const text = llmOn(adv) ? "§in guild chat " + ev.name + " said: «" + String(ev.text).slice(0, 160) + "». Answer them naturally; you may react, ask something back or add your own experience" : fmt(b, "banterr", r.lang, ev.name, w);
  r.greply = { at: w.time + 3000 + Math.floor(w.rng() * 7000), text };
}
// ---- lecciones compartidas
function adopt(r, name, lvl) { if (!name) return; (r.dlv ||= {}); if ((r.dlv[name] || 0) < lvl) r.dlv[name] = lvl; }
function shareDeath(adv, w, p, r) {
  const k = (r._killer || r._lastHit) && r._killBoss ? (r._killer || r._lastHit) + "*" + r._killBoss : (r._killer || r._lastHit), now = w.time, L = lessons(adv), G = Guild.guildOf(w, p), mates = G ? Guild.onlineMembers(adv.guildReg, G).filter(m => m !== p && m.res) : [];
  if (r._pvpDeath) {
    if (!w.pvp) return;
    const zone = FOSOS(adv).find(z => p.x >= z.rect[0] - 6 && p.x <= z.rect[2] + 6 && p.y >= z.rect[1] - 6 && p.y <= z.rect[3] + 6);
    const killer = [...w.ents.values()].find(e => e.kind === "player" && e.name === k);
    if (killer?.guild && G) for (const m of mates) blog(w, m, `Aviso de ${p.name}: el guild ${killer.guild.name} hace raid en Promise Land.`);
    if (killer?.guild) { L.pits.set("g:" + killer.guild.name, now + 15 * 60000); if (G) gsay(adv, p, gline(p, "gfoe", w, { g: killer.guild.name })); }
    if (zone && (r._trip?.pit?.id === zone.id || r._trip?.guild)) {                          // la raid fracasó: se evita el foso un rato y la raid del guild se retira
      L.pits.set(zone.id, now + 10 * 60000);
      if (G) { gsay(adv, p, gline(p, "gpit", w, { m: zone.name })); for (const m of mates) if (m.res._trip?.pit?.id === zone.id) { m.res._trip.until = 0; blog(w, m, `${p.name} avisa: raid fallida en el foso ${zone.id}; me retiro.`); } }
      blog(w, p, `Lección: el foso ${zone.id} es peligroso ahora; lo evito diez minutos.`);
    }
    return;
  }
  if (!k || k === "?" || w.map.kind === "dungeon" && !r.dlv?.[k] && false) return;
  L.mobs.push({ name: k, lvl: p.level, by: p.name, at: now }); if (L.mobs.length > 24) L.mobs.shift();
  for (const m of mates) { adopt(m.res, w.map.kind === "dungeon" ? k + "@" + w.map.level : k, p.level); blog(w, m, `Aviso de ${p.name}: «${k}» es difícil (lo mató a nivel ${p.level}); lo evito.`); }
  if (G) gsay(adv, p, gline(p, "gdanger", w, { m: String(k).replace(/\*\d+/, " (jefe)").replace(/-/g, " "), l: p.level }));
}
