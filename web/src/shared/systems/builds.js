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
};
export const DEFAULT_BUILD = { warrior: "glass", hunter: "agile", trader: "balanced", wanderer: "balanced", scholar: "summoner" };
export const buildOf = p => (p.res && BUILDS[p.res.build]) ? p.res.build : DEFAULT_BUILD[p.res?.arch] || "balanced";

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
  const fresh = Object.keys(BUILDS).filter(k => !tried.has(k) && k !== cur);
  if (fresh.length && (w.rng() < 0.75 || hist.length < 2)) return fresh[Math.floor(w.rng() * fresh.length)];
  const best = hist.filter(h => h.name !== cur).sort((a, b) => b.rate - a.rate)[0];
  return best?.name || Object.keys(BUILDS).filter(k => k !== cur)[Math.floor(w.rng() * (Object.keys(BUILDS).length - 1))];
}
// Anota el rendimiento del build que deja
export function closeBuild(p, w) { const cur = buildOf(p), rate = Math.round(perf(p, w)), h = (p.res.builds ||= []), e = h.find(x => x.name === cur); if (e) { e.rate = Math.round((e.rate + rate) / 2); e.n++; } else h.push({ name: cur, rate, n: 1 }); }
