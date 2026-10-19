// GENES DE COMBATE de los bots (INVENTO v0.85.64): los números que antes estaban fijos en bot.js, ahora ajustables por clase (vanguard/mage) y modo (pve/pvp).
// Los valores por defecto son EXACTAMENTE el comportamiento anterior; tools/train.mjs los evoluciona y guarda web/data/botgenes.json.
export const DEFAULTS = {
  flee: 0.32,       // huye con menos de esta fracción de vida y un enemigo encima
  potion: 0.5,      // bebe poción roja por debajo
  rested: 0.75,     // deja de descansar por encima
  engage: 0.55,     // solo busca objetivo nuevo con más vida que esto
  ratio: 1.3,       // presupuesto/daño recibido mínimo para aceptar un jefe
  cal: 1,           // calibración del estimador de daño recibido (aprendizaje en línea)
};
export const BOUNDS = { flee: [0.1, 0.6], potion: [0.25, 0.8], rested: [0.5, 0.95], engage: [0.3, 0.85], ratio: [0.8, 2.5], cal: [0.4, 2.5] };
export const KEYS = Object.keys(DEFAULTS).filter(k => k !== "cal");
let TABLE = {};                                                // { vanguard: { pve: {...}, pvp: {...} }, mage: {...} }
export const setGenes = t => { TABLE = t && t.genes ? t.genes : (t || {}); };
export const getGenes = () => TABLE;
export const clamp = (k, v) => Math.min(BOUNDS[k][1], Math.max(BOUNDS[k][0], v));
// genes efectivos de un bot en este mundo: defaults < clase/modo < calibración aprendida en línea
export function genesOf(w, p) {
  const cls = p.res?.build === "mage" || p.bot?.mage ? "mage" : "vanguard", mode = w.pvp ? "pvp" : "pve";
  const g = { ...DEFAULTS, ...(TABLE[cls]?.[mode] || {}) };
  const c = w.learn?.cal?.[cls]; if (c) g.cal = clamp("cal", g.cal * c);
  return g;
}
// APRENDIZAJE EN LÍNEA: compara el daño que el estimador esperaba con el real y ajusta un factor por clase (media móvil)
export function learnFight(w, p, name, predicted, actual) {
  const L = (w.learn ||= { cal: {}, mobs: {}, n: 0 }), cls = p.res?.build === "mage" || p.bot?.mage ? "mage" : "vanguard";
  if (!(predicted > 1) || actual < 0) return;
  const r = Math.min(3, Math.max(0.2, (actual + 5) / (predicted + 5)));
  L.cal[cls] = clamp("cal", (L.cal[cls] ?? 1) * 0.97 + r * 0.03); L.n++;
  const m = (L.mobs[name] ||= { n: 0, pred: 0, act: 0, deaths: 0 }); m.n++; m.pred += predicted; m.act += actual;
}
export const learnDeath = (w, name) => { const L = (w.learn ||= { cal: {}, mobs: {}, n: 0 }); (L.mobs[name] ||= { n: 0, pred: 0, act: 0, deaths: 0 }).deaths++; };
