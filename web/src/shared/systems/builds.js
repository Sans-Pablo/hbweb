// BUILDS (reparto de puntos) de los habitantes (INVENTO del port). Cada habitante empieza con el de su arquetipo y, con el tiempo, prueba otros: va al mago
// (reinicio de estadísticas, respec.js), se reparte los puntos de otra forma y mide cuánta experiencia por minuto saca con cada uno. Así descubren qué
// funciona (más vida, más daño, más inteligencia para los summons…) y se quedan con lo mejor o siguen explorando.
import * as R from "../rules.js";

export const BUILDS = {
  balanced: { es: "equilibrado", w: { str: 0.35, vit: 0.35, dex: 0.2, int: 0.05, mag: 0.05 } },
  tank:     { es: "resistente", w: { vit: 0.55, str: 0.3, dex: 0.15 } },
  glass:    { es: "cañón de cristal", w: { str: 0.55, dex: 0.3, vit: 0.15 } },
  agile:    { es: "ágil", w: { dex: 0.5, str: 0.25, vit: 0.25 } },
  summoner: { es: "invocador", w: { int: 0.3, mag: 0.15, vit: 0.35, str: 0.2 } },
  vanguard: { es: "vanguardia", w: { vit: 0.45, str: 0.4, dex: 0.15 } },                               // Guerrero de misiones: el jefe de cripta se aguanta con vida
  mage:     { es: "mago", w: { int: 0.65, mag: 0.2, vit: 0.15 } },                                // v0.85.47: Blizzard pide Int 113 (magicbal.js); v0.85.46: más Int y Mag. v0.85.26: lanzador puro. INT para aprender y lanzar (Magic Missile pide 18, Fire Ball 26, Fire Strike 34), MAG para el maná
  arcane:   { es: "arcano", w: { vit: 0.4, int: 0.3, mag: 0.15, str: 0.15 } },                      // Mago e Invocador de misiones: vida y mente
};
const QUEST_BUILD = { warrior: "vanguard", mage: "arcane", summoner: "arcane" };
export const DEFAULT_BUILD = { warrior: "glass", hunter: "agile", trader: "balanced", wanderer: "balanced", scholar: "summoner" };
export const buildOf = p => (p.res && BUILDS[p.res.build]) ? p.res.build : p.bot?.mage ? "mage" : QUEST_BUILD[p.quests?.cls] || DEFAULT_BUILD[p.res?.arch] || "balanced";
// ¿Gasta puntos en INT/MAG y lanza hechizos con las manos libres o una varita? (botmagic.js)
export const isCaster = p => { const b = buildOf(p); return b === "mage" || b === "arcane" || b === "summoner"; };
// Mago puro: sin arma cuerpo a cuerpo (solo se lanza con las manos libres o con varita, magicsys.js usable())
export const isMage = p => buildOf(p) === "mage";

// Reparte `total` puntos según el build respetando el tope de cada estadística
export function allocate(p, total) {
  const w = BUILDS[buildOf(p)].w, out = {}, ks = Object.keys(w);
  let left = total;
  for (const k of ks) { const n = Math.min(Math.round(total * w[k]), R.STAT_LIMIT - p.stats[k], left); if (n > 0) { out[k] = n; left -= n; } }
  for (const k of ks) { if (left <= 0) break; const n = Math.min(left, R.STAT_LIMIT - p.stats[k] - (out[k] || 0)); if (n > 0) { out[k] = (out[k] || 0) + n; left -= n; } }
  return out;
}

// Rendimiento (experiencia por minuto de juego) del build actual
export function perf(p, w) { const b = p.res?.bperf; return b ? (p.exp - b.exp0) / Math.max(1, (w.time - b.t0) / 60000) : 0; }
// Siguiente build a probar: primero los que no ha probado; luego el mejor conocido (con algo de exploración)
export function nextBuild(p, w) {
  const hist = p.res.builds || [], tried = new Set(hist.map(h => h.name)), cur = buildOf(p);
  const pool = Object.keys(BUILDS).filter(k => !p.quests || (k !== "glass" && k !== "agile"));          // con misiones no se prueba un build sin vida
  const fresh = pool.filter(k => !tried.has(k) && k !== cur);
  if (fresh.length && (w.rng() < 0.75 || hist.length < 2)) return fresh[Math.floor(w.rng() * fresh.length)];
  const best = hist.filter(h => h.name !== cur).sort((a, b) => b.rate - a.rate)[0];
  return best?.name || pool.filter(k => k !== cur)[Math.floor(w.rng() * (pool.length - 1))];
}
// Anota el rendimiento del build que deja
export function closeBuild(p, w) { const cur = buildOf(p), rate = Math.round(perf(p, w)), h = (p.res.builds ||= []), e = h.find(x => x.name === cur); if (e) { e.rate = Math.round((e.rate + rate) / 2); e.n++; } else h.push({ name: cur, rate, n: 1 }); }
// IDEAS DE LOS DEMÁS (INVENTO, v0.69): el reparto que mejor le ha rendido a otro habitante de su misma personalidad (mide exp/min en `res.builds`). Solo vale si supera con holgura lo mejor que él ha visto.
export function peerBest(p, others) {
  const cur = buildOf(p), mine = Math.max(0, ...(p.res.builds || []).map(h => h.rate));
  let best = null;
  for (const o of others) {
    if (o === p || !o.res || o.res.arch !== p.res.arch) continue;
    for (const h of o.res.builds || []) if (h.name !== cur && BUILDS[h.name] && h.rate > mine * 1.15 + 1 && (!p.quests || (h.name !== "glass" && h.name !== "agile")) && (!best || h.rate > best.rate)) best = { name: h.name, rate: h.rate, from: o.name };
  }
  return best;
}
// CLASE POR ÍTEMS (INVENTO, v0.77.0): lo que lleva puesto decide la clase: arco → cazador (ágil), báculo → invocador (arcano), con summon activo → invocador,
// el resto → guerrero (cañón de cristal; con misiones, vanguardia). Se reevalúa cuando cambia el arma; devuelve {arch, build}.
export function fitByItems(p) {
  const t = p.eff?.wtype || 0;
  if (p.eff?.bow) return p.quests ? { arch: "warrior", build: buildOf(p) } : { arch: "hunter", build: "agile" };
  if (t >= 34 && t < 40) return { arch: "scholar", build: "arcane" };
  if (p.res?.arch === "scholar" || p.companion || p.summon) return { arch: "scholar", build: "summoner" };
  return { arch: "warrior", build: p.quests ? "vanguard" : "glass" };
}
// Firma del equipo clave (arma en mano); cambia cuando encuentra un ítem de otra clase
export const itemSig = p => (p.eff?.bow ? "bow" : (p.eff?.wtype || 0) >= 34 && (p.eff?.wtype || 0) < 40 ? "staff" : "melee");
// Tope diario de reinicios por bot
export const DAILY_CAP = 2;
export function canRespecToday(r, w) { const d = Math.floor(w.time / 86400000); if (r.rsDay !== d) { r.rsDay = d; r.rsN = 0; } return r.rsN < DAILY_CAP; }
