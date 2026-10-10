// HABITANTES: bots que viven en el servidor (INVENTO del port, no está en el original). Cada uno es un jugador simulado (systems/bot.js) con:
//  - una ficha estable (arquetipo, origen, motivación, miedo, manía) sacada de su nombre, y una historia que va creciendo;
//  - objetivos de vida (subir de nivel, juntar oro, hacer amigos...) y memoria corta de lo que le pasa;
//  - relaciones con los jugadores que conoce (los saluda, los recuerda, acepta o no unirse a su grupo);
//  - respuestas al chat con frases propias y, si el servidor lo ofrece (`adv.llm`, un modelo local como Ollama), con texto generado.
// Todo es determinista salvo `adv.llm` (solo existe en el servidor). El estado (`p.res`) se guarda en el save del habitante.
import { dist } from "../const.js";
import * as Party from "./party.js";
import { blog, tooStrong } from "./bot.js";
import { canFight } from "./combatsys.js";
import * as Comp from "./companion.js";
import * as Tal from "./talents.js";
import * as Sch from "./schools.js";

const NAMES = ["Aldric", "Brenna", "Cael", "Dorna", "Edric", "Fenna", "Garrick", "Helga", "Ivo", "Jessa", "Korin", "Lyra", "Marek", "Nessa", "Orin", "Petra", "Quill", "Rhea", "Soren", "Talia",
  "Ulric", "Vesna", "Wynn", "Yara", "Zeke", "Bram", "Cora", "Dain", "Elsa", "Finn", "Greta", "Hugo", "Iris", "Joren", "Kira", "Leif", "Mira", "Nils", "Olga", "Pip"];
export const RESIDENT_NAMES = NAMES;

const ARCH = {
  warrior: { es: "guerrero", en: "warrior", talk: 0.4, brave: 1 }, hunter: { es: "cazador", en: "hunter", talk: 0.5, brave: 0.8 },
  trader: { es: "comerciante", en: "trader", talk: 0.8, brave: 0.4 }, wanderer: { es: "viajero", en: "wanderer", talk: 0.7, brave: 0.6 },
  scholar: { es: "estudioso", en: "scholar", talk: 0.6, brave: 0.3 },
};
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
  const h = hash(name.toLowerCase()), arch = Object.keys(ARCH)[h % 5];
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
  const r = p.res, kind = ["level", "gold", "kills", "friend", "pvp", "pvp", "pit", "crypt"][Math.floor(w.rng() * 8)];
  if (kind === "level") r.goal = { k: "level", n: p.level + 2 };
  else if (kind === "gold") r.goal = { k: "gold", n: p.gold + 800 + p.level * 300 };
  else if (kind === "kills") r.goal = { k: "kills", n: (p.kills || 0) + 25 };
  else if (kind === "pvp") r.goal = { k: "pvp", n: (p.ek || 0) + 3 + Math.floor(w.rng() * 3) };
  else if (kind === "pit") r.goal = { k: "pit", n: (r.qa.pvp.held || 0) + 180, zone: 1 + Math.floor(w.rng() * 12) };           // 180 s dominando el foso
  else if (kind === "crypt") r.goal = { k: "crypt", n: Math.min(10, (p.delve?.deepest || 1) + 1) };
  else r.goal = { k: "friend", n: Object.keys(r.rel).length + 2 };
}
export const goalText = (g, lang) => !g ? "" : lang === "en"
  ? { level: `reach level ${g.n}`, gold: `save ${g.n} gold`, kills: `hunt ${g.n} monsters in total`, friend: "make new friends", pvp: `kill enemies until I have ${g.n} enemy kills`, pit: `dominate pit ${g.zone} in Promise Land`, crypt: `reach crypt level ${g.n}` }[g.k]
  : { level: `llegar al nivel ${g.n}`, gold: `juntar ${g.n} de oro`, kills: `cazar ${g.n} monstruos en total`, friend: "hacer nuevos amigos", pvp: `abatir enemigos hasta las ${g.n} bajas`, pit: `dominar el foso ${g.zone} de Promise Land`, crypt: `llegar al nivel ${g.n} de la cripta` }[g.k];
function goalDone(p) {
  const g = p.res.goal;
  return !g ? false : g.k === "level" ? p.level >= g.n : g.k === "gold" ? p.gold >= g.n : g.k === "kills" ? (p.kills || 0) >= g.n : g.k === "pvp" ? (p.ek || 0) >= g.n
    : g.k === "pit" ? (p.res.qa.pvp.held || 0) >= g.n : g.k === "crypt" ? (p.delve?.deepest || 1) >= g.n : Object.keys(p.res.rel).length >= g.n;
}

// ---------------------------------------------------------------- frases
const L = {
  greet: [["¡Hola, {n}! Qué alegría verte.", "Hi, {n}! Good to see you."], ["Buenas, {n}. ¿Todo bien por aquí?", "Hey {n}. Everything fine?"]],
  again: [["¡{n}! Cuánto tiempo.", "{n}! Long time no see."], ["Te recuerdo, {n}. ¿Cazamos juntos?", "I remember you, {n}. Hunt together?"]],
  who: [["Soy {s}", "I'm {s}"]],
  doing: [["Ando con una meta: {g}.", "I'm working on a goal: {g}."], ["Cazo un poco. Quiero {g}.", "Hunting a bit. I want to {g}."]],
  from: [["Vengo de {o}.", "I come from {o}."]],
  fear: [["Me dan miedo {f}… pero no se lo digas a nadie.", "I'm afraid of {f}… don't tell anyone."]],
  thanks: [["De nada, {n}.", "Anytime, {n}."]],
  bye: [["¡Hasta pronto, {n}!", "See you, {n}!"]],
  yes: [["¡Vamos, {n}! Te sigo un rato.", "Let's go, {n}! I'll tag along for a while."]],
  no: [["Ahora no puedo, {n}, tengo cosas que hacer.", "Can't right now, {n}, I have things to do."]],
  shy: [["Aún no te conozco lo bastante, {n}. Charlemos antes.", "I don't know you well enough yet, {n}. Let's talk first."]],
  bot: [["Pues sí, soy un habitante simulado de este servidor. Pero mis metas son de verdad… para mí.", "Yes, I'm a simulated resident of this server. But my goals are real… to me."]],
  idle: [["Este sitio tiene su encanto.", "This place has its charm."], ["Hoy toca cazar.", "Today is for hunting."], ["¿Alguien más tiene hambre?", "Anyone else hungry?"], ["Mi arma y yo tenemos un trato.", "My weapon and I have an understanding."]],
  level: [["¡Nivel {l}! Un paso más hacia lo que busco.", "Level {l}! One step closer to what I seek."]],
  goal: [["¡Lo logré: {g}!", "I did it: {g}!"]],
  died: [["Me han matado… la próxima vez tendré más cuidado.", "I got killed… I'll be more careful next time."]],
  group: [["¿Cazamos juntos, {n}?", "Want to hunt together, {n}?"], ["Voy contigo, {n}, mejor en grupo.", "I'm with you, {n}, better as a group."]],
  trip: [["Voy a Promise Land a probar suerte.", "Heading to Promise Land to try my luck."], ["Toca viaje a Promise Land. ¿Quién se apunta?", "Time for Promise Land. Who's in?"]],
  taunt: [["¡Por mi bando! Fuera de aquí, {n}.", "For my side! Get out of here, {n}."], ["{n}, hoy no sales vivo de aquí.", "{n}, you're not leaving here alive."]],
  win: [["¡Uno menos del otro bando!", "One less from the other side!"], ["Eso te pasa por entrar en Promise Land.", "That's what you get for coming to Promise Land."]],
  lose: [["Me han ganado… la próxima será mía.", "They got me… next one's mine."]],
  other: [["Interesante. Cuéntame más.", "Interesting. Tell me more."], ["Mm, no sé qué decirte, {n}.", "Hm, not sure what to say, {n}."]],
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
function fmt(p, key, lang, who, w) {
  const l = L[key]; if (!l) return "";
  const t = l[Math.floor(w.rng() * l.length)][lang === "en" ? 1 : 0], i = lang === "en" ? 1 : 0, r = p.res;
  return t.replace("{n}", who || "").replace("{s}", storyOf(p, lang)).replace("{g}", goalText(r.goal, lang) || (lang === "en" ? "wander" : "pasear")).replace("{o}", r.origin[i])
    .replace("{f}", r.fear[i]).replace("{l}", p.level);
}
// Texto del contexto para un modelo de lenguaje (server/llm.mjs): quién es, qué ha vivido y qué quiere ahora.
export function describe(p, lang) {
  const r = p.res, es = lang !== "en";
  const mem = r.mem.slice(-6).map(m => (es ? m.es : m.en)).join(" | ");
  const known = Object.entries(r.rel).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n).join(", ");
  return es
    ? `${storyOf(p, "es")} Nivel ${p.level}. Meta actual: ${goalText(r.goal, "es") || "ninguna"}. Recuerdos recientes: ${mem || "ninguno"}. Conoce a: ${known || "nadie aún"}.`
    : `${storyOf(p, "en")} Level ${p.level}. Current goal: ${goalText(r.goal, "en") || "none"}. Recent memories: ${mem || "none"}. Knows: ${known || "nobody yet"}.`;
}

// ---------------------------------------------------------------- conexión con el bot
export function attach(w, p, saved) {
  p.res = restore(p.name, saved);
  p.res.next = 0;
  if (!p.res.goal) newGoal(w, p);
  p.res.lvl = p.level; p.res.kills0 = p.kills || 0;
  if (!p.res.mem.length) remember(p, "Llegué a Aresfarm buscando mi camino.", "I arrived in Aresfarm looking for my way.");
}
export function speak(adv, p, text) { if (text) adv.command(p.id, { t: "say", text: text.replace(/\s+/g, " ").slice(0, 118) }); }
const inFarm = (adv, p) => adv.worldFor(p.id) === adv.farm;

// Eventos del mundo que le importan a un habitante (lo llama World.emit): chat, órdenes rechazadas, golpes recibidos, muertes y bajas.
export function onEvent(adv, w, ev) {
  switch (ev.t) {
    case "chat": return onChat(adv, w, ev);
    case "reject": { const b = adv.bots.get(ev.id); if (b?.res) qaReject(adv, w, b, ev); return; }
    case "damage": {
      const b = adv.bots.get(ev.id);
      if (b?.res && ev.from) {
        const f = w.ents.get(ev.from); b.res._lastHit = f?.name || "?";
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
    case "learned": { const b = adv.bots.get(ev.id); if (b?.res && ev.uid) { blog(w, b, `Enseño un hechizo a mi summon ${ev.nm}.`); report(adv, b, "bug", "learn-anywhere", "Puedo enseñarle hechizos a mi summon desde cualquier sitio: la orden «learn» no comprueba que esté junto al Mago de la torre.", "I can teach my summon spells from anywhere: the «learn» command does not check that I'm next to the tower Mage."); } return; }
    case "death": {
      const dead = adv.bots.get(ev.id);
      if (dead?.res) { const kf = w.ents.get(ev.by); dead.res._killer = kf?.name || dead.res._lastHit || "?"; if (kf?.kind === "player") { dead.res._pvpDeath = true; dead.res.qa.pvp.d++; } return; }
      const kb = w.ents.get(ev.by), b = adv.bots.get(ev.by) || (kb?.comp ? adv.bots.get(kb.master) : null), n = w.ents.get(ev.id);
      if (b?.res && n?.kind === "npc") { b.res.qa.kills[n.name] = (b.res.qa.kills[n.name] || 0) + 1; if (kb?.comp) b.res.qa.pet.kills++; }
    }
  }
}
// Un jugador habla cerca de un habitante: el más cercano (o el nombrado) responde tras una pausa.
export function onChat(adv, w, ev) {
  if (!ev.id || ev.system || !ev.text) return;
  const human = w.ents.get(ev.id); if (!human) return;
  const fromBot = adv.bots.get(ev.id), depth = fromBot?.res ? (fromBot.res._depth ?? 0) : 0;
  if (adv.bots.has(ev.id)) {                                                          // un habitante habla a otro: solo del mismo bando, de cerca, con poca probabilidad y sin cadenas largas
    if (!fromBot.res || depth >= 3 || w.rng() > 0.5) return;
  }
  const text = String(ev.text), low = text.toLowerCase();
  let best = null, bd = 1e9;
  for (const b of adv.bots.values()) {
    if (b === human || !b.res || b.dead || adv.worldFor(b.id) !== w || b.res.reply) continue;
    if (fromBot && (b.side !== fromBot.side || w.time - (b.res._rcd || -1e9) < 20000)) continue;
    const named = low.includes(b.name.toLowerCase()), d = dist(b, human);
    if (d > (fromBot ? 7 : named ? 40 : 10)) continue;
    const s = d - (named ? 100 : 0);
    if (s < bd) { best = b; bd = s; }
  }
  if (best) queueReply(adv, w, best, human, text, depth + 1);
}
function queueReply(adv, w, p, human, text, depth = 0) {
  const r = p.res, lang = langOf(text), intent = intentOf(text), n = human.name;
  befriend(p, n, 1); r.chats++; r._rcd = w.time;
  let key = intent, extra = null;
  if (intent === "party") { key = relOf(p, n) >= 3 ? "yes" : "shy"; extra = key === "yes" ? n : null; }
  r.reply = { at: w.time + 1200 + Math.floor(w.rng() * 1500), text: fmt(p, key, lang, n, w), follow: extra, to: n, lang, depth };
  if (typeof adv.llm === "function" && adv.llm.ready !== false && intent !== "party") {                       // modelo local: si responde a tiempo, sustituye a la frase hecha
    const rep = r.reply; rep.at += 3000;
    Promise.resolve(adv.llm({ who: p.name, lang, system: describe(p, lang), from: n, text })).then(t => { if (t && r.reply === rep) rep.text = String(t); }).catch(() => {});
  }
}

export function think(adv, p) {
  const r = p.res, w = adv.worldFor(p.id);
  if (!r || w.time < r.next) return;
  r.next = w.time + 500; r._w = w;
  const home = adv.homeOf(p);
  // respuesta pendiente
  if (r.reply && w.time >= r.reply.at) {
    const rep = r.reply; r.reply = null;
    if (!p.dead) {
      r._depth = rep.depth || 0; speak(adv, p, rep.text);
      if (rep.follow && !r.followUntil) { const h = [...w.ents.values()].find(e => e.kind === "player" && e.name === rep.to && !adv.bots.has(e.id)); if (h) { p.bot.owner = h.id; r.followUntil = w.time + 5 * 60000; remember(p, "Acompañé a " + rep.to + " un rato.", "Tagged along with " + rep.to + " for a while."); } }
    }
  }
  if (r.followUntil && w.time > r.followUntil) {                                     // se acabó el acompañamiento: vuelve a su vida
    r.followUntil = 0; p.bot.owner = null; Party.leave(w, p, true);
    if (w !== home) { adv.transfer(p, w, home, home.home); p.bot.home = { x: p.x, y: p.y }; p.bot.path = null; p.bot.target = null; }
  }
  if (r._wid !== w.map.id) worldChanged(adv, w, p, r, home);
  if (p.dead) { if (!r.deadSeen) { r.deadSeen = true; r.deaths++; remember(p, r._pvpDeath ? "Me mató " + (r._killer || "un enemigo") + " en Promise Land." : "Morí en combate.", r._pvpDeath ? (r._killer || "An enemy") + " killed me in Promise Land." : "I died in battle."); if (w.rng() < 0.5) speak(adv, p, fmt(p, r._pvpDeath ? "lose" : "died", r.lang, "", w)); r._pvpDeath = false; } qaTick(adv, w, p, r); return; }
  r.deadSeen = false;
  if (p.level > r.lvl) { r.lvl = p.level; remember(p, "Subí al nivel " + p.level + ".", "Reached level " + p.level + "."); if (p.bot.owner == null && w.rng() < 0.7) speak(adv, p, fmt(p, "level", r.lang, "", w)); }
  if (goalDone(p)) {
    const g = goalText(r.goal, "es"), ge = goalText(r.goal, "en");
    remember(p, "Cumplí mi meta: " + g + ".", "Achieved my goal: " + ge + "."); speak(adv, p, r.lang === "en" ? "I did it: " + ge + "!" : "¡Lo logré: " + g + "!"); newGoal(w, p);
  }
  qaTick(adv, w, p, r);
  // fuera de la granja (entró a una tienda o a la cripta pisando un teletransporte mientras paseaba): se queda un rato probando y vuelve
  if (w !== home && !p.bot.owner && !r._trip && !r._delve && !r._pet) {
    r._away ??= w.time;
    if (w.time - r._away > 45000 && !p.dead) { r._away = null; remember(p, "Entré en " + (w.map.name || w.map.id) + " y volví.", "I went into " + (w.map.name || w.map.id) + " and came back."); adv.transfer(p, w, home, home.home); p.bot.home = { x: p.x, y: p.y }; p.bot.path = null; p.bot.target = null; }
  } else r._away = null;
  const tg = p.bot.target;                                                         // se burla del enemigo al que va a atacar
  if (tg?.kind === "player" && r._tauntId !== tg.id) { r._tauntId = tg.id; if (w.rng() < 0.5) speak(adv, p, fmt(p, "taunt", r.lang, tg.name, w)); }
  pits(adv, w, p, r);
  pets(adv, w, p, r, home);
  expedition(adv, w, p, r, home);
  social(adv, w, p, r);
  // saludar a quien llega
  const seen = (r.seen ||= {});
  for (const e of w.ents.values()) {
    if (e.kind !== "player" || adv.bots.has(e.id) || e.dead || dist(e, p) > 6) continue;
    if (w.time - (seen[e.name] || -1e9) < 300000) continue;
    seen[e.name] = w.time;
    if (w.rng() < ARCH[r.arch].talk) { const again = relOf(p, e.name) > 0; speak(adv, p, fmt(p, again ? "again" : "greet", r.lang, e.name, w)); befriend(p, e.name, 1); }
    break;
  }
  // charla suelta con otro habitante o consigo mismo
  if (!p.bot.owner && w.time > (r.idleAt ||= w.time + 40000 + Math.floor(w.rng() * 90000))) {
    r.idleAt = w.time + 90000 + Math.floor(w.rng() * 150000);
    if (w.rng() < ARCH[r.arch].talk) speak(adv, p, fmt(p, "idle", r.lang, "", w));
  }
}

// ---------------------------------------------------------------- probador (QA): los habitantes juegan y avisan de lo que ven
// Cada informe: { bot, lvl, lang, kind, topic, es, en, map, x, y }.  kind: bug (algo falla) · comfort (incómodo) · balance (números) · idea.
// `adv.report` lo pone el servidor (server/report.mjs), que agrupa por kind+topic y escribe el informe legible. Cada tema se repite como mucho
// cada 10 minutos por habitante; así 40 bots no inundan el informe y se ve cuántos coinciden.
const QUIET = new Set(["ocupado", "demasiado rápido", "muerto"]);                 // rechazos normales de un bot que insiste, no son un fallo
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
  else if (r._px !== p.x || r._py !== p.y || b.rest || w.time - p.lastCombat < 6000 || w.busy(p)) { r._px = p.x; r._py = p.y; r._pt = w.time; }
  else if (w.time - r._pt > 40000) {
    r._pt = w.time;
    report(adv, p, "bug", "stuck:" + (w.map.id || "") + ":" + (p.x >> 3) + "," + (p.y >> 3), `Me quedo parado/atascado cerca de (${p.x},${p.y}) en ${w.map.name || w.map.id}.`, `I'm stuck near (${p.x},${p.y}) in ${w.map.name || w.map.id}.`);
  }
  if (p.weight > p.maxLoad * 0.92) report(adv, p, "comfort", "weight", `Voy casi al límite de peso (${p.weight}/${p.maxLoad}) y no lo he visto avisar.`, `I'm near the weight limit (${p.weight}/${p.maxLoad}) and nothing warned me.`);
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
        if (p.level - ball.comp.lvl > 12) report(adv, p, "balance", "pet-slow", `Mi summon va al nivel ${ball.comp.lvl} y yo al ${p.level}: sube demasiado despacio (solo recibe el 25 % de mi experiencia).`, `My summon is level ${ball.comp.lvl} while I'm ${p.level}: it levels too slowly (it only gets 25% of my experience).`);
        if (q.lost >= 3 && q.lost > q.kills) report(adv, p, "balance", "pet-dies", `Mi summon ${ball.comp.sp} cae más de lo que mata (${q.lost} caídas, ${q.kills} bajas): ¿vida o defensa insuficientes?`, `My ${ball.comp.sp} summon falls more than it kills (${q.lost} falls, ${q.kills} kills): not enough health or defense?`);
      } else if (p.level >= 5) report(adv, p, "comfort", "pet-none", `Soy nivel ${p.level} y aún no tengo summon: conseguirlo exige ir hasta Gail y no hay pista de dónde está.`, `I'm level ${p.level} and still have no summon: getting one means finding Gail and nothing hints where she is.`); }
    r._paceAt = w.time + 480000; r._paceExp = p.exp; r._paceK = k; r._paceD = d;
    if (typeof adv.llm === "function" && adv.llm.ready !== false) {                 // opinión libre del probador con el modelo (si está disponible)
      const lang = r.lang;
      Promise.resolve(adv.llm({ task: "feedback", who: p.name, lang, system: describe(p, lang), from: "stats", text: `lvl ${p.level}, ${xp} exp/min, deaths ${d}, kills ${top(r.qa.kills)}, deaths by ${top(r.qa.deaths)}, gold ${p.gold}, rejects ${top(r.qa.rej)}` }))
        .then(t => { if (t) report(adv, p, "idea", "llm:" + p.level + ":" + (r.chats | 0), lang === "en" ? "" : t, lang === "en" ? t : "", { text: t }); }).catch(() => {});
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
  else if (r._delve && w === home) { r._delve = null; r._tripAt = w.time + 120000 + Math.floor(w.rng() * 240000); blog(w, p, "Expedición a la cripta terminada: de vuelta en casa."); }
  else if (r._trip && w === home) { r._trip = null; r._tripAt = w.time + 240000 + Math.floor(w.rng() * 360000); blog(w, p, "Expedición terminada: de vuelta en casa."); }
}
// Los líderes (sin jefe) salen de vez en cuando de su granja: a Promise Land por el teletransportador normal (cazan, combaten y dominan fosos; vuelven con Recall)
// o a la cripta de esqueletos (bajan niveles despejándolos). Lo que toca lo decide la meta (pvp/pit → Promise Land, crypt → cripta) o el azar.
const FOSOS = adv => adv.maps["2ndmiddle"]?.meta.spawns || [];
const pitCenter = z => ({ x: (z.rect[0] + z.rect[2]) >> 1, y: (z.rect[1] + z.rect[3]) >> 1 });
// Elige foso: los que tiene el enemigo o nadie atraen; los propios y los lejanos, menos.
function pickPit(adv, w, p, zones) {
  let best = null, bs = 1e9;
  for (const z of zones) { const st = adv.pits?.get(z.id), s = dist(p, pitCenter(z)) * 0.5 - (st && st.side !== p.side ? 70 : 0) + (st && st.side === p.side ? 140 : 0) + w.rng() * 50; if (s < bs) { best = z; bs = s; } }
  return best;
}
function expedition(adv, w, p, r, home) {
  const b = p.bot;
  if (b.owner != null || r._pet) return;                                                   // los miembros de un grupo van donde va su líder
  if (r._delve) return delve(adv, w, p, r, home);
  if (r._trip) {
    if (w === home && r._trip.go && w.time > r._trip.goUntil) { r._trip = null; r._tripAt = w.time + 120000; blog(w, p, "No llegué al teletransportador: cancelo la expedición."); return; }
    if (w.pvp && w.time > r._trip.until && w.time - (r._rc || 0) > 8000) { r._rc = w.time; blog(w, p, "Fin de la expedición: uso Recall."); adv.command(p.id, { t: "recall" }); }
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
  const g = r.goal?.k, wantsPL = g === "pvp" || g === "pit", wantsCrypt = g === "crypt";
  const pl = p.level >= 3 && !wantsCrypt && (wantsPL || w.rng() < 0.5);
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
  r._delve = { go: true, goUntil: w.time + 150000, until: w.time + 420000 + Math.floor(w.rng() * 300000), spot, tries: 0, lv: 0 };
  b.travel = { x: spot[0], y: spot[1], w, until: w.time + 150000 };
  blog(w, p, `Planeo bajar a la cripta de esqueletos${r.goal?.k === "crypt" ? " (mi meta: nivel " + r.goal.n + ")" : ""}: voy a la entrada (${spot[0]},${spot[1]}).`);
  remember(p, "Salí hacia la cripta de esqueletos.", "Set out for the skeleton crypt.");
  if (w.rng() < 0.6) speak(adv, p, r.lang === "en" ? "Time to clear some skeletons in the crypt." : "Toca limpiar esqueletos en la cripta.");
}
function delve(adv, w, p, r, home) {
  const b = p.bot, d = r._delve;
  if (w === home) {
    if (!d.go) { r._delve = null; r._tripAt = w.time + 120000; return; }
    if (w.time > d.goUntil || d.tries > 6) { r._delve = null; r._tripAt = w.time + 150000; blog(w, p, "No consigo entrar en la cripta: cancelo la bajada."); report(adv, p, "bug", "cryptentry", "No consigo entrar en la cripta desde mi granja.", "I can't get into the crypt from my farm."); return; }
    if (dist(p, { x: d.spot[0], y: d.spot[1] }) > 2 && !b.travel && !p.dead) { b.travel = { x: d.spot[0], y: d.spot[1], w, until: w.time + 60000 }; b.path = null; b.goal = null; b.fails = 0; }
    if (dist(p, { x: d.spot[0], y: d.spot[1] }) <= 2 && !p.dead && !w.busy(p) && w.time - (d.cmdAt || 0) > 3000) { d.cmdAt = w.time; d.tries++; adv.command(p.id, { t: "portal", portal: "mid-entry", restart: false }); }
    return;
  }
  if (w.map.kind !== "dungeon") return;
  d.go = false;
  const left = w.time > d.until || p.level < 2;
  if (p.dead) return;
  if ((left || (b.rest && !b.target)) && w.time - (r._rc || 0) > 8000) { r._rc = w.time; blog(w, p, left ? "Fin de la bajada: salgo de la cripta (Recall)." : "Voy mal: salgo de la cripta (Recall)."); adv.command(p.id, { t: "recall" }); return; }
  if (b.rest || w.time < (r._delveAt || 0)) return;
  r._delveAt = w.time + 1500;
  // nivel despejado: baja si puede (niveles superiores solo con suficiente nivel) o sale
  if (w.cleared) {
    const gate = w.map.portals.find(g => g.target === "down"), deeper = !!gate && p.level >= 3 + 2 * (w.map.level - 1) && w.time < d.until - 60000;
    const exit = deeper ? gate : w.map.portals.find(g => g.target === "origin" && g.id !== "return") || w.map.portals.find(g => g.id === "return");
    if (!exit) return;
    if (dist(p, exit) <= 1) { if (w.time - (d.cmdAt || 0) > 2000) { d.cmdAt = w.time; if (!deeper) d.until = 0; blog(w, p, deeper ? `Nivel ${w.map.level} despejado: bajo.` : "Cripta despejada: salgo."); adv.command(p.id, { t: "portal", portal: exit.id }); } }
    else if (!b.travel || b.travel.x !== exit.x) { b.travel = { x: exit.x, y: exit.y, w, until: w.time + 60000 }; b.path = null; b.goal = null; }
    return;
  }
  // caza: los esqueletos cercanos los pelea el cerebro del bot; si no hay ninguno a la vista, va a por el más cercano
  if (b.target) return;
  let best = null, bd = 1e9;
  for (const e of w.ents.values()) if (e.kind === "npc" && !e.dead && !e.comp && !e.aux && !e.master && !tooStrong(w, p, e)) { const dd = dist(p, e); if (dd < bd) { best = e; bd = dd; } }
  if (best && bd > 9) { b.travel = { x: best.x, y: best.y, w, until: w.time + 12000, seek: true }; b.path = null; b.goal = null; blog(w, p, `Busco a ${best.name} a ${bd} casillas.`); }
  else if (best) b.travel = null;
}
// ---------------------------------------------------------------- summons (compañeros): los habitantes los compran, invocan, curan, les dan talentos y hechizos, y avisan de lo que falla
// Cada habitante prueba una especie distinta (salen de `Comp.SPECIES`; así se ejercitan todas). El hospital (Gail) está en la tienda general de Aresden
// y al aire libre en Elvine Farm. Los avisos van al informe de probadores (`report`).
const TALENT_PLAN = { warrior: ["hide", "iron", "taunt", "regen"], hunter: ["might", "frenzy", "might"], trader: ["hide", "might"], wanderer: ["might", "hide", "iron"], scholar: ["mind", "might", "hide"] };
const PET_SPECIES = Object.keys(Comp.SPECIES).filter(sp => !Sch.isTier2(sp) && sp !== "Dummy");           // Demon/Frost/Liche solo por cambio y el Dummy exige un báculo
const ballOf = p => Comp.activeBall(p) || p.bag.find(i => i.comp && !i.comp.bad);
const liveOf = (w, p) => { for (const e of w.ents.values()) if (e.comp && e.master === p.id && !e.dead) return e; return null; };
const nurseOf = w => { for (const e of w.ents.values()) if (e.role === "pethospital") return e; return null; };
function pickSpecies(p, r) { let h = 0; for (const c of p.name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PET_SPECIES[(h + (r.petN | 0)) % PET_SPECIES.length]; }
function pets(adv, w, p, r, home) {
  if (p.dead || w.pvp || w.map.kind === "dungeon" || w.time < (r._petThink ||= 0)) return;
  r._petThink = w.time + 2500;
  const b = p.bot, ball = ballOf(p), c = ball?.comp, live = liveOf(w, p);
  // ---- mantenimiento (en cualquier mapa menos Promise Land y la cripta)
  if (ball) {
    if ((!c.on || !live) && !c.down && !w.fightZone && w.time - (r._petUseAt || 0) > 12000) {          // invoca a su summon (también si la bola dice «fuera» y no hay summon: tras morir o viajar)
      if (c.on && !live && (r.deaths | 0) > (r._petDeaths | 0)) { r._petDeaths = r.deaths | 0; report(adv, p, "bug", "pet-after-death", `Tras morir y reaparecer mi summon ${c.nm} no vuelve solo: la bola sigue «fuera» pero no hay summon hasta que la uso otra vez.`, `After dying and respawning my summon ${c.nm} doesn't come back by itself: the ball still says «out» but there is no summon until I use it again.`); }
      r._petUseAt = w.time; adv.command(p.id, { t: "use", uid: ball.uid });
      if ((r._petUseFails = (r._petUseFails | 0) + 1) >= 3 && !live) { c.bad = true; r._petUseFails = 0; r.petN = (r.petN | 0) + 1; report(adv, p, "bug", "summon:" + c.sp, `No consigo invocar a mi summon de especie ${c.sp} (la bola no lo saca nunca).`, `I can't summon my ${c.sp} companion (the ball never produces it).`); blog(w, p, `Mi summon ${c.sp} no se deja invocar: lo dejo y probaré otra especie.`); }
    } else if (live) r._petUseFails = 0;
    // talentos: gasta los puntos libres según su arquetipo
    if (Tal.pointsFree(c) > 0) for (const id of TALENT_PLAN[r.arch] || TALENT_PLAN.hunter) if (!Tal.canLearn(c, id)) { adv.command(p.id, { t: "talent", uid: ball.uid, talent: id }); blog(w, p, `Gasto un punto de talento de ${c.nm} en «${Tal.talent(id).name}».`); break; }
    // los summons de escuela aprenden hechizos (barato primero) y los lanzan contra su objetivo
    const school = Sch.SCHOOL_OF[c.sp];
    if (school && w.magic) {
      if (w.time - (r._teachAt || 0) > 20000) {
        r._teachAt = w.time;
        const ids = Object.entries(Sch.unlockLevels(w.magic, school)).filter(([id, lv]) => !Sch.taught(c, id) && lv <= c.lvl).sort((x, y) => x[1] - y[1]);
        for (const [id] of ids) if (p.stats.int >= Sch.spellInt(w.magic, school, id) && p.gold >= Sch.spellGold(w.magic, school, id)) { adv.command(p.id, { t: "learn", spell: +id }); break; }
      }
      const t = b.target, n = live;
      if (n && t && t.kind === "npc" && !t.dead && dist(p, t) <= 10 && w.time - (r._castAt || 0) > 3500) {
        const known = (c.spells || []).filter(id => Sch.spellLevel(w.magic, school, id, c.sp) <= c.lvl && (n.mp ?? 0) >= Sch.spellMana(w.magic, school, id)).sort((x, y) => Sch.spellMana(w.magic, school, y) - Sch.spellMana(w.magic, school, x));
        if (known.length) { r._castAt = w.time; adv.command(p.id, { t: "cast", spell: known[0], x: t.x, y: t.y }); blog(w, p, `Mi summon lanza «${w.magic[known[0]].name}» contra ${t.name}.`); }
      }
    }
    // órdenes y caramelos
    if (live && b.target?.kind === "npc" && w.time - (r._petOrderAt || 0) > 45000 && w.rng() < 0.5) { r._petOrderAt = w.time; adv.command(p.id, { t: "pettarget", target: b.target.id }); }
    if (live && live.hp < live.maxHp * 0.4 && w.time - (r._candyAt || 0) > 8000) { const cd = p.bag.find(i => i.id === 780); if (cd) { r._candyAt = w.time; adv.command(p.id, { t: "use", uid: cd.uid }); blog(w, p, "Doy un caramelo rojo a mi summon."); } }
    if (live && (!r._modeAt || w.time - r._modeAt > 600000)) { r._modeAt = w.time; if (r._modeAt > 1) { const m = c.mode === "peace" ? "attack" : "peace"; adv.command(p.id, { t: "petmode", mode: m }); r._modeBack = w.time + 20000; } }
    if (r._modeBack && w.time > r._modeBack) { r._modeBack = 0; adv.command(p.id, { t: "petmode", mode: "attack" }); }
  }
  // ---- ¿toca ir al hospital? sin summon, o con el summon caído/herido
  const need = !ball ? p.level >= 2 && p.gold >= 20 : (c.down || (!live && Comp.hpOf(p, c) < Comp.maxOf(p, c) * 0.5)) && p.gold >= Comp.treatCost(p, c) && !c.bad;
  if (!r._pet) {
    if (!need || r.followUntil || r._trip || r._delve || p.bot.owner != null || w.time < (r._petAt ||= w.time + 20000 + Math.floor(w.rng() * 40000)) || w !== home || p.hp < p.maxHp * 0.6 || b.rest) return;
    const tp = (adv.maps[home.map.id]?.meta.teleports || []).find(t => t.map === "gshop_1f"), nurse = nurseOf(w);
    if (!nurse && !tp) { r._petAt = w.time + 600000; return; }
    r._pet = { until: w.time + 240000, done: 0, tp: tp ? { x: tp.x, y: tp.y } : null };
    blog(w, p, !ball ? "Voy a buscar un summon al hospital de compañeros." : "Llevo a mi summon al hospital de compañeros.");
    if (!ball && w.rng() < 0.6) speak(adv, p, r.lang === "en" ? "I need a companion. Off to the pet hospital." : "Necesito un compañero. Voy al hospital de mascotas.");
    return;
  }
  const d = r._pet;
  if (w.time > d.until || p.hp < p.maxHp * 0.3) { r._pet = null; r._petAt = w.time + 120000; if (w.time > d.until) blog(w, p, "No llego al hospital de compañeros: cancelo."); return; }
  const nurse = nurseOf(w);
  if (nurse) {                                                                           // en el mapa de Gail: se acerca y la usa
    if (dist(p, nurse) > 5) { if (!b.travel) { b.travel = { x: nurse.x, y: nurse.y + 1, w, until: w.time + 40000 }; b.path = null; b.goal = null; b.fails = 0; } return; }
    if (w.busy(p) || w.time - (d.cmdAt || 0) < 1500) return;
    d.cmdAt = w.time;
    if (!ball) { if (d.bought) { r.petN = (r.petN | 0) + 1; d.bought = false; } const sp = pickSpecies(p, r); d.bought = true; adv.command(p.id, { t: "petbuy", npc: nurse.id, sp }); if (++d.done > 6) { r._pet = null; r._petAt = w.time + 300000; } return; }
    if (c.down || Comp.hpOf(p, c) < Comp.maxOf(p, c)) { adv.command(p.id, { t: "petheal", uid: ball.uid, npc: nurse.id }); if (++d.done > 4) { r._pet = null; r._petAt = w.time + 300000; } return; }
    d.leave = true; r._petUseAt = 0;
  } else if (d.tp && w === home) {                                                       // camino a la tienda general de Aresden
    if (!b.travel) { b.travel = { x: d.tp.x, y: d.tp.y, w, until: w.time + 90000 }; b.path = null; b.goal = null; b.fails = 0; }
    return;
  }
  // terminado (o no hay enfermera aquí): vuelve a casa
  if (w === home) { r._pet = null; r._petAt = w.time + (ball ? 240000 : 90000); return; }
  const out = (adv.maps[w.map.id]?.meta.teleports || []).find(t => t.map === home.map.id) || (adv.maps[w.map.id]?.meta.teleports || [])[0];
  if (out && !b.travel) { b.travel = { x: out.x, y: out.y, w, until: w.time + 60000 }; b.path = null; b.goal = null; b.fails = 0; }
  else if (!out && w.time - (r._rc || 0) > 8000) { r._rc = w.time; adv.command(p.id, { t: "recall" }); }
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
  const b = p.bot;
  if (w.time < (r._socAt ||= w.time + 15000 + Math.floor(w.rng() * 20000))) return;
  r._socAt = w.time + 25000;
  if (b.owner != null && !r.followUntil) {                                      // miembro: ¿toca disolver?
    if (adv.bots.get(b.owner)?.res && w.time > (r._leaveAt || 0)) { blog(w, p, "Dejo el grupo para ir por mi cuenta un rato."); b.owner = null; Party.leave(w, p, true); }
    return;
  }
  if (b.owner != null || r.followUntil || r._trip || p.dead || b.rest) return;
  let best = null, bd = 99;
  for (const q of adv.bots.values()) {
    if (q === p || !q.res || q.dead || q.side !== p.side || adv.worldFor(q.id) !== w || q.bot.owner != null || q.res.followUntil || q.res._trip) continue;
    const d = dist(p, q);
    if (d > 20 || Math.abs(q.level - p.level) > 10 || members(adv, p) + members(adv, q) + 2 > 4) continue;
    if (d < bd) { best = q; bd = d; }
  }
  if (!best || w.rng() > 0.5) return;
  const lead = best.level > p.level || (best.level === p.level && members(adv, best) > members(adv, p)) ? best : p, mem = lead === p ? best : p;
  mem.bot.owner = lead.id; mem.res._leaveAt = w.time + 600000 + Math.floor(w.rng() * 900000); mem.bot.partyAt = 0;
  blog(w, mem, `Me uno al grupo de ${lead.name} (nv ${lead.level}).`); blog(w, lead, `${mem.name} (nv ${mem.level}) se une a mi grupo.`);
  remember(mem, "Me uní al grupo de " + lead.name + ".", "Joined " + lead.name + "'s party."); remember(lead, mem.name + " se unió a mi grupo.", mem.name + " joined my party.");
  if (w.rng() < 0.6) speak(adv, lead, fmt(lead, "group", lead.res.lang, mem.name, w));
  befriend(lead, mem.name, 1); befriend(mem, lead.name, 1);
}
