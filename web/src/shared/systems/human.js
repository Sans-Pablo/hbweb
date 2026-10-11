// HUMANIZACIÓN de los habitantes (INVENTO del port, no está en el original): que no parezcan máquinas 24 h.
//  - Horarios: cada habitante tiene su hora punta; se conecta y se desconecta a lo largo del día (hora real del servidor) con sesiones y descansos
//    de duración variable y alguna "vacación" larga. El admin decide quién se conecta (cfg.pins: on / off / auto) y cuántos como mínimo (cfg.minOnline).
//  - Pausas AFK: de vez en cuando se queda quieto unos minutos (café, teléfono) y vuelve.
//  - Despistes: se queda mirando, da un paso equivocado y, al escribir, a veces comete una errata y la corrige.
//  - Charla espontánea: comenta cosas sin que nadie le pregunte (frases propias; con modelo de lenguaje, además, lo que le pasa).
//  - Llegadas: los nuevos pueden llegar con experiencia (nivel > 1) y traen su historia.
// Es opt-in: `adv.human.on` empieza apagado (las pruebas no lo ven) y el servidor lo enciende (HB_HUMAN=0 lo apaga).
// Reloj: `adv.hourFn()` (hora local 0..24) y `adv.nowFn()` (ms reales) los pone el servidor; sin ellos se usa el tiempo simulado (1 día = 24 min).
import { dist } from "../const.js";
import * as Party from "./party.js";

export const DEFAULTS = { on: false, minOnline: 10, pins: {}, afk: true, slips: true, chatter: false, typos: true, vets: 0.3 };
export const cfgOf = adv => (adv.human ||= { ...DEFAULTS, pins: {} });
const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17);
export const nowMs = adv => adv.nowFn ? adv.nowFn() : adv.farm.time;
export const hourOf = adv => adv.hourFn ? adv.hourFn() : (adv.farm.time / 60000) % 24 * 1;      // sin reloj real: un día pasa en 24 min

// Rasgos estables (salen del nombre y se guardan en la ficha)
export function traits(r, name) {
  if (r.hum) return r.hum;
  const h = hash(name + "#hum");
  return (r.hum = { peak: 10 + (h % 14), clumsy: ((h >> 5) % 100) / 100, chatty: ((h >> 12) % 100) / 100, typo: ((h >> 19) % 100) / 100, afk: 0.3 + ((h >> 7) % 70) / 100, off: 0, seen: 0 });
}
const circ = (a, b) => { const d = Math.abs(a - b) % 24; return d > 12 ? 24 - d : d; };
// Ganas de estar conectado a la hora `h`: 1 en su hora punta (±4 h), 0.12 en plena madrugada para él
export const weight = (hum, h) => { const d = circ(h, hum.peak); return d <= 4 ? 1 : d >= 9 ? 0.12 : 1 - (d - 4) / 5 * 0.88; };

const BYE = { es: ["me voy a dormir, hasta luego", "tengo que irme, nos vemos", "bueno, me desconecto un rato", "hasta mañana!", "me llaman, vuelvo luego", "cierro por hoy"], en: ["gotta go sleep, see you", "I have to run, later", "logging off for a bit", "see you tomorrow!", "got called away, brb", "calling it a day"] };
const HELLO = { es: ["ya estoy aquí", "buenas, he vuelto", "qué me he perdido?", "hola de nuevo"], en: ["I'm back", "hey, did I miss anything?", "hello again", "back online"] };
const AFK = { es: ["un momento, vuelvo en seguida", "brb", "me llaman al teléfono", "voy a por un café"], en: ["one sec, brb", "brb", "phone call, one sec", "getting a coffee"] };
const BACK = { es: ["ya estoy", "perdón, ya volví", "listo"], en: ["back", "sorry, I'm back", "ok, here"] };
const CHAT = {
  es: ["qué calor hace hoy", "alguien sabe dónde se consigue buen equipo?", "me duele el dedo de tanto clicar", "esto de subir de nivel no se acaba nunca", "ayer vi un jefe enorme en la cripta", "los slimes ya me dan pena", "quién se apunta a Promise Land?", "tengo la mochila hecha un lío", "necesito pociones...", "qué buen día para cazar", "creo que me voy a cambiar de arma", "los orcos pegan fuerte, cuidado", "alguien tiene un summon bueno?", "hoy me siento con suerte"],
  en: ["so warm today", "anyone know where to get good gear?", "my finger hurts from all the clicking", "levelling never ends, does it", "saw a huge boss in the crypt yesterday", "I feel bad for the slimes", "who's up for Promise Land?", "my bag is a mess", "need potions...", "great day for hunting", "thinking of switching weapons", "orcs hit hard, careful", "anyone got a good summon?", "feeling lucky today"],
};
const pick = (w, a) => a[Math.floor(w.rng() * a.length)];
const L = r => (r.lang === "en" ? "en" : "es");

// ------------------------------------------------------------- horarios
const humOf = (e, n) => traits((e.save ||= {}).res ||= {}, n);
const offline = adv => (adv.offline ||= new Map());
export const isOffline = (adv, name) => offline(adv).has(name);

function canLeave(adv, p) {
  const w = adv.worldFor(p.id), r = p.res, b = p.bot;
  return !p.dead && w === adv.homeOf(p) && !w.pvp && w.map.kind !== "dungeon" && !r._trip && !r._delve && !r._pet && !r._reb && !b.travel && !w.busy(p) && w.time - (p.lastCombat || 0) > 8000 && !p.trade;
}
export function logoff(adv, p, why = "") {
  const w = adv.worldFor(p.id), r = p.res, hum = traits(r, p.name);
  if (p.party) { try { Party.leave(w, p, true); } catch {} }
  p.bot.owner = null;
  for (const o of adv.bots.values()) if (o.bot.owner === p.id) { o.bot.owner = null; try { Party.leave(adv.worldFor(o.id), o, true); } catch {} }
  hum.seen = nowMs(adv);
  const save = adv.saveOf(p.id);
  adv.removePlayer(p.id);
  offline(adv).set(p.name, { save, since: nowMs(adv), back: hum.back || 0, why });
}
export function logon(adv, name) {
  const e = offline(adv).get(name); if (!e) return null;
  offline(adv).delete(name);
  const p = adv.spawnResident(name, e.save), r = p.res, hum = traits(r, name), w = adv.worldFor(p.id);
  const mins = Math.round((nowMs(adv) - (hum.seen || e.since)) / 60000);
  hum.back = 0; hum.online = nowMs(adv);
  if (mins >= 5) { const es = `Me desconecté ${mins >= 120 ? Math.round(mins / 60) + " h" : mins + " min"} y volví.`, en = `I logged off for ${mins >= 120 ? Math.round(mins / 60) + " h" : mins + " min"} and came back.`; r.mem.push({ es, en }); if (r.mem.length > 16) r.mem.shift(); }
  if (mins >= 60) w.after?.(9000 + Math.floor(w.rng() * 8000), () => {                       // recuerda a sus amigos: saluda al que más aprecia y esté cerca
    if (p.dead || !adv.bots.get(p.id)) return;
    const f = Object.entries(r.rel).filter(([n, v]) => v >= 3).sort((a, b) => b[1] - a[1]).map(([n]) => [...w.ents.values()].find(e => e.kind === "player" && e.name === n && dist(p, e) <= 18)).find(Boolean);
    if (f) adv.command(p.id, { t: "say", text: L(r) === "en" ? `hey ${f.name}, long time no see!` : `hola ${f.name}, cuánto tiempo!` });
  });
  if (w.rng() < 0.4) w.after?.(4000 + Math.floor(w.rng() * 6000), () => { if (!p.dead && adv.bots.get(p.id)) adv.command(p.id, { t: "say", text: pick(w, HELLO[L(r)]) }); });
  return p;
}
// Decide a quién conectar o desconectar (cada pocos segundos)
function schedule(adv) {
  const cfg = cfgOf(adv), h = hourOf(adv), now = nowMs(adv), on = adv.residents(), off = [...offline(adv).entries()];
  const total = on.length + off.length;
  const min = Math.min(cfg.minOnline, total);
  let online = on.length;
  for (const p of on) {
    const hum = traits(p.res, p.name), pin = cfg.pins[p.name] || "auto";
    if (pin === "on") { hum.until = 0; continue; }
    if (hum.until == null || hum.until === 0) hum.until = now + (20 + (adv.farm.rng() * 90)) * 60000;      // sesión mínima al llegar
    const w = adv.farm;
    if (pin === "off" ? true : now >= hum.until) {
      const want = weight(hum, h);
      if (pin === "off" || w.rng() > want * 0.85 + 0.1) {
        if (online <= min && pin !== "off") { hum.until = now + 10 * 60000; continue; }            // el servidor nunca se queda sin gente
        if (!canLeave(adv, p)) { hum.until = pin === "off" ? 0 : now + 10000; continue; }
        const long = w.rng() < 0.04, mins = long ? 180 + w.rng() * 900 : (10 + w.rng() * 80) * (1.6 - want);
        hum.back = now + mins * 60000; hum.until = 0;
        const rr = p.res; if (w.rng() < 0.6 && !p.dead) adv.command(p.id, { t: "say", text: pick(w, BYE[L(rr)]) });
        logoff(adv, p, long ? "vacation" : "break"); online--;
      } else hum.until = now + (20 + w.rng() * 60) * 60000;                                       // se queda otro rato
    }
  }
  const wake = off.filter(([n, e]) => (cfg.pins[n] || "auto") === "on" || ((cfg.pins[n] || "auto") === "auto" && now >= (e.back || 0)));
  wake.sort((a, b) => weight(humOf(b[1], b[0]), h) - weight(humOf(a[1], a[0]), h));
  for (const [n, e] of wake) {
    const pin = cfg.pins[n] || "auto", hum = humOf(e, n);
    const want = weight(hum, h);
    if (pin === "auto" && online >= min && adv.farm.rng() > want * 0.5 + 0.05) { e.back = now + (5 + adv.farm.rng() * 20) * 60000; continue; }
    if (logon(adv, n)) online++;
  }
  // los que se quedaron cortos de gente conectada: despierta a los más animados aunque no les toque
  if (online < min) for (const [n, e] of [...offline(adv).entries()].filter(([n]) => (cfg.pins[n] || "auto") !== "off").sort((a, b) => weight(humOf(b[1], b[0]), h) - weight(humOf(a[1], a[0]), h))) { if (online >= min) break; if (logon(adv, n)) online++; }
}
export function tick(adv) {
  const cfg = cfgOf(adv); if (!cfg.on) return;
  const t = adv.farm.time; if (t < (adv._humAt || 0)) return; adv._humAt = t + 5000;
  schedule(adv);
}
// Estado para el panel de admin
export function status(adv) {
  const cfg = cfgOf(adv), h = hourOf(adv), now = nowMs(adv);
  const row = (name, p, e) => { const r = p?.res || (e && (e.save ||= {}).res) || {}, hum = traits(r, name); return { name, state: p ? (r._afk ? "afk" : "on") : "off", pin: cfg.pins[name] || "auto", peak: hum.peak, want: Math.round(weight(hum, h) * 100), backMin: !p && e?.back ? Math.max(0, Math.round((e.back - now) / 60000)) : null, why: e?.why || null }; };
  return { cfg: { on: cfg.on, minOnline: cfg.minOnline, afk: cfg.afk, slips: cfg.slips, chatter: cfg.chatter, typos: cfg.typos, vets: cfg.vets }, hour: Math.round(h * 10) / 10, online: adv.residents().length, offline: offline(adv).size, bots: [...adv.residents().map(p => row(p.name, p)), ...[...offline(adv).entries()].map(([n, e]) => row(n, null, e))] };
}
export function configure(adv, c) {
  const cfg = cfgOf(adv);
  for (const k of ["on", "afk", "slips", "chatter", "typos"]) if (typeof c[k] === "boolean") cfg[k] = c[k];
  if (Number.isFinite(c.minOnline)) cfg.minOnline = Math.max(0, Math.min(40, c.minOnline | 0));
  if (Number.isFinite(c.vets)) cfg.vets = Math.max(0, Math.min(1, +c.vets));
  if (c.pins && typeof c.pins === "object") for (const [n, v] of Object.entries(c.pins)) { if (v === "on" || v === "off") cfg.pins[n] = v; else delete cfg.pins[n]; }
  if (c.all === "on" || c.all === "off") for (const n of [...adv.residents().map(p => p.name), ...offline(adv).keys()]) cfg.pins[n] = c.all;
  if (c.all === "auto") cfg.pins = {};
  return status(adv);
}
// Al arrancar el servidor: quien estaba desconectado (descanso o vacaciones) sigue así hasta que le toque
export function restoreOffline(adv, name, save) {
  const hum = save?.res?.hum, cfg = cfgOf(adv); if (!cfg.on || !hum?.back || hum.back <= nowMs(adv) || (cfg.pins[name] || "auto") === "on") return false;
  offline(adv).set(name, { save, since: hum.seen || nowMs(adv), back: hum.back, why: "restored" }); return true;
}

// ------------------------------------------------------------- por habitante (lo llama residents.think)
// true = está en pausa AFK y no debe pensar
export function afk(adv, w, p, r) {
  const cfg = cfgOf(adv); if (!cfg.on || !cfg.afk) { r._afk = null; return false; }
  const hum = traits(r, p.name), b = p.bot;
  if (r._afk) {
    if (w.time > r._afk.until || w.time - (p.lastCombat || 0) < 3000 || p.hp < p.maxHp * 0.6) { r._afk = null; hum.afkNext = w.time + (6 + w.rng() * 20) * 60000; if (!p.dead && w.rng() < 0.5) adv.command(p.id, { t: "say", text: pick(w, BACK[L(r)]) }); return false; }
    b.hold = w.time + 1000; b.target = null; return true;
  }
  if (w.time < (hum.afkNext ||= w.time + (4 + w.rng() * 16) * 60000)) return false;
  hum.afkNext = w.time + 60000;
  if (w.rng() > hum.afk * 0.5 || w !== adv.homeOf(p) || w.pvp || r._trip || r._delve || r._pet || r._reb || r._plan || b.owner != null || b.travel || b.target || w.busy(p) || w.time - (p.lastCombat || 0) < 8000 || p.hp < p.maxHp * 0.8) return false;
  r._afk = { until: w.time + (1.5 + w.rng() * 5) * 60000 };
  if (w.rng() < 0.6) adv.command(p.id, { t: "say", text: pick(w, AFK[L(r)]) });
  return true;
}
// Despistes pequeños (fuera de combate): se queda mirando o da un paso al azar
export function slip(adv, w, p, r) {
  const cfg = cfgOf(adv); if (!cfg.on || !cfg.slips) return;
  const hum = traits(r, p.name), b = p.bot;
  if (w.time < (hum.slipAt ||= w.time + (20 + w.rng() * 60) * 1000)) return;
  hum.slipAt = w.time + (25 + w.rng() * 90) * 1000 / (0.4 + hum.clumsy);
  if (w.rng() > 0.15 + hum.clumsy * 0.5 || b.target || w.time - (p.lastCombat || 0) < 5000 || w.busy(p) || b.rest) return;
  if (w.rng() < 0.55) b.hold = w.time + 1200 + Math.floor(w.rng() * 2800);                       // se queda mirando la pantalla
  else { b.path = null; adv.command(p.id, { t: "move", dir: 1 + Math.floor(w.rng() * 8), run: false }); }          // da un paso equivocado
}
// Erratas: devuelve el texto (con una errata a veces) y programa la corrección
export function typo(adv, p, text) {
  const cfg = cfgOf(adv); if (!cfg.on || !cfg.typos || !p.res) return text;
  const hum = traits(p.res, p.name), w = adv.worldFor(p.id);
  if (w.rng() > 0.03 + hum.typo * 0.1) return text;
  const words = text.split(" "), i = words.findIndex(x => x.length >= 5 && /^[a-záéíóúñ]+$/i.test(x)); if (i < 0) return text;
  const word = words[i], j = 1 + Math.floor(w.rng() * (word.length - 2)), bad = word.slice(0, j) + word[j + 1] + word[j] + word.slice(j + 2);
  if (bad === word) return text;
  words[i] = bad;
  if (w.rng() < 0.6) w.after?.(2200 + Math.floor(w.rng() * 1500), () => { if (!p.dead && adv.bots.get(p.id)) adv.command(p.id, { t: "say", text: "*" + word }); });
  return words.join(" ");
}
// Charla espontánea
export function chatter(adv, w, p, r, speak) {
  const cfg = cfgOf(adv); if (!cfg.on || !cfg.chatter) return;
  const hum = traits(r, p.name), b = p.bot;
  if (w.time < (hum.chatAt ||= w.time + (2 + w.rng() * 6) * 60000)) return;
  hum.chatAt = w.time + (3 + w.rng() * 9) * 60000 / (0.4 + hum.chatty);
  if (adv._chatAt > w.time - 8000 || w.rng() > 0.25 + hum.chatty * 0.6) return;
  if (b.target || w.pvp || w.map.kind === "dungeon" || r._afk || p.dead || w.time - (p.lastCombat || 0) < 6000) return;
  let near = 0; for (const e of w.ents.values()) if (e !== p && e.kind === "player" && dist(p, e) <= 14) near++;
  if (!near && w.rng() > 0.15) return;
  adv._chatAt = w.time;
  const low = p.gold < 60 && p.level >= 8, q = w.rng();
  if (q < 0.3 && typeof adv.llm === "function" && adv.llm.ready !== false) { speak(adv, p, "§you say something spontaneous to whoever is around, about what you are doing or feeling right now (one short casual line, nothing about trading)"); return; }
  adv.command(p.id, { t: "say", text: typo(adv, p, low && q < 0.6 ? (L(r) === "en" ? "broke again... need gold" : "sin un duro otra vez... necesito oro") : pick(w, CHAT[L(r)])) });
}
// Nivel con que llega un recién llegado: algunos vienen con experiencia
export function arrivalLevel(adv, name, h) {
  const cfg = cfgOf(adv); if (!cfg.on || (h % 1000) / 1000 >= cfg.vets) return 0;
  return 8 + (h >> 4) % 25;
}
