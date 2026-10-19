// SABER DE ÍTEMS (INVENTO, v0.85.65): los bots aprenden qué piezas rinden de verdad. Cada pocos minutos anotan, para cada ítem que llevan
// puesto, la experiencia ganada y las muertes sufridas (rendimiento = exp/min / (1 + 0.6·muertes), como el entrenador PvE). El saber es del
// mundo (`w.itemLore`): lo que aprende uno lo usan todos, como un rumor entre jugadores. `factor` (0.8–1.25) corrige el item level teórico.
const MIN_MS = 8 * 60000, MAX = 1.25, MIN = 0.8;
export const loreOf = w => (w.itemLore ||= { items: {}, avg: { xp: 0, ms: 0 } });
const deathsOf = p => Object.values(p.res?.qa?.deaths || {}).reduce((a, n) => a + n, 0);
// Se llama desde los recados del bot: acumula lo ocurrido desde la última muestra en cada ítem equipado.
export function sample(w, p, b) {
  const L = loreOf(w), s = b.lore, now = w.time, d = deathsOf(p);
  if (!s) { b.lore = { t: now, exp: p.exp, deaths: d }; return; }
  const dt = now - s.t; if (dt < 60000) return;
  const dxp = Math.max(0, p.exp - s.exp), dd = Math.max(0, d - s.deaths);
  b.lore = { t: now, exp: p.exp, deaths: d };
  if (p.hp <= 0 || dt > 20 * 60000) return;                               // muestras largas o con el bot muerto no valen
  L.avg.xp += dxp; L.avg.ms += dt;
  for (const uid of new Set(Object.values(p.equip))) {
    const i = p.bag.find(x => x.uid === uid); if (!i) continue;
    const e = (L.items[i.id] ||= { xp: 0, ms: 0, deaths: 0 });
    e.xp += dxp; e.ms += dt; e.deaths += dd;
  }
}
const rate = e => (e.xp / Math.max(1, e.ms / 60000)) / (1 + 0.6 * e.deaths);
// Factor multiplicativo del item level de `id` según lo aprendido (1 = sin datos suficientes)
export function factor(w, id) {
  const L = w.itemLore, e = L?.items[id];
  if (!e || e.ms < MIN_MS || L.avg.ms < MIN_MS * 3) return 1;
  const base = L.avg.xp / Math.max(1, L.avg.ms / 60000);
  if (base <= 0) return 1;
  const conf = Math.min(1, e.ms / (MIN_MS * 4));                          // con pocos datos pesa menos
  return 1 + (Math.max(MIN, Math.min(MAX, rate(e) / base)) - 1) * conf;
}
// Resumen legible (panel de aprendizaje): mejores y peores ítems conocidos
export function summary(w, n = 5) {
  const L = w.itemLore; if (!L) return [];
  return Object.keys(L.items).map(id => ({ id: +id, f: factor(w, +id), min: Math.round(L.items[id].ms / 60000) })).filter(x => x.f !== 1).sort((a, b) => b.f - a.f).slice(0, n);
}
