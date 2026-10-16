// Monitor económico del admin (docs/sistemas/economia.md): analítica, alertas, riqueza, simulación, configuración versionada, auditoría y stream.
// Lee el libro de oro (econ_events, ver shared/systems/ledger.js); no cambia ninguna regla del juego. El panel es público por decisión del propietario:
// no hay roles ni claves; el actor de la auditoría es el que declara la petición (o «admin») y se guarda la IP de origen.
import crypto from "node:crypto";

export const SCHEMA_VERSION = 1, SERVER_ID = "main";
export const DEFAULT_CFG = {
  net_growth: { on: true, severity: "warning", windowMin: 60, ratio: 3, minCreated: 5000, cooldownMin: 60 },          // crecimiento sostenido: creado/destruido ≥ ratio en 2 ventanas seguidas
  source_dev: { on: true, severity: "warning", windowMin: 15, baselineWindows: 8, pct: 300, minEvents: 20, cooldownMin: 60 },   // una fuente se desvía de su propia media
  duplicate: { on: true, severity: "warning", windowMin: 10, count: 3, cooldownMin: 30 },                              // mismo actor+motivo+importe en el mismo instante de juego
  ledger_gap: { on: true, severity: "info", windowMin: 60, minGaps: 3, cooldownMin: 360 },                             // el saldo no encaja con el movimiento anterior
  concentration: { on: true, severity: "info", top10Share: 0.8, minPlayers: 10, cooldownMin: 720 },                    // riqueza concentrada en el 10 % superior
};
export const RULE_VER = 1;
const SEVERITIES = ["info", "warning", "critical"], STATUSES = ["open", "acknowledged", "investigating", "resolved", "dismissed"];
const LIMITS = { windowMin: [1, 1440], ratio: [1, 1000], minCreated: [0, 1e9], cooldownMin: [0, 10080], baselineWindows: [1, 100], pct: [1, 100000], minEvents: [1, 1e6], count: [2, 1000], minGaps: [1, 1000], top10Share: [0.1, 1], minPlayers: [2, 100000] };
// Qué métricas no se pueden calcular todavía y qué falta capturar (manual §26: «No disponible», nunca un valor inventado).
export const MISSING = [
  { metric: "Índice de precios y precio mediano", why: "No hay mercado jugador-jugador con precio por objeto: solo el intercambio (oro-objeto no se registra) y los puestos de venta, cuyo cobro entra como transferencia sin detalle del objeto.", plan: "Registrar en trade.js/stall.js un evento por objeto vendido (id, cantidad, precio) con la misma idempotencia." },
  { metric: "Economía de objetos (creación, destrucción, stock)", why: "Los objetos no pasan por un libro como el del oro; no hay IDs de instancia de objeto en todas las rutas.", plan: "Libro de objetos análogo a ledger.js en inventory.js (addToBag/removeFromBag) y drops.js." },
  { metric: "Materiales", why: "Sin instrumentación; los materiales son objetos apilables sin libro.", plan: "Incluir los apilables en el libro de objetos con agregación por cantidad." },
  { metric: "Oro en puestos y en el banco", why: "El oro depositado en puestos (s.gold) y los saldos de jugadores desconectados sin partida guardada no entran en el total.", plan: "Sumar puestos activos al snapshot de riqueza." },
  { metric: "Segmentos por antigüedad y actividad", why: "Las partidas guardadas no guardan fecha de creación ni horas jugadas.", plan: "Guardar createdAt y playSecs en saveOf y segmentar después." },
];
const OP = { faucet: "create", sink: "destroy", transfer: "transfer" };
const iso = ms => new Date(ms).toISOString();
const rangeOf = (q, now) => {
  const hours = q.hours != null && q.hours !== "" ? +q.hours : 24, from = q.from ? +q.from : now - (hours > 0 ? hours : 24) * 3600000, to = q.to ? +q.to : now;
  return { from, to, artificial: q.artificial === "all" ? "all" : undefined };
};

export function shapeEvent(e) {
  return { eventId: e.event_id, cursor: e.id, eventType: "gold." + e.cls, occurredAt: iso(e.ts), receivedAt: iso(e.ts), serverId: SERVER_ID, schemaVersion: SCHEMA_VERSION, resourceType: "gold", operation: OP[e.cls] || e.cls,
    quantity: Math.abs(e.delta), delta: e.delta, source: e.reason, actor: e.actor, peer: e.peer, balanceAfter: e.bal, zone: e.map, artificial: e.artificial };
}

export const gini = sorted => {                  // sorted ascendente
  const n = sorted.length, sum = sorted.reduce((a, b) => a + b, 0); if (n < 2 || !sum) return 0;
  let acc = 0; sorted.forEach((v, i) => { acc += (2 * (i + 1) - n - 1) * v; }); return acc / (n * sum);
};
const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;

export function createEconomy({ store, now = () => Date.now(), version = "" }) {
  const stats = { ingested: 0, errors: 0, lastIngest: 0 };
  const hits = new Map();                                                        // límite de consultas por IP: 240/min
  const limited = ip => { const t = Math.floor(now() / 60000), h = hits.get(ip); if (!h || h.t !== t) { hits.set(ip, { t, n: 1 }); return false; } return ++h.n > 240; };
  const cfg = () => { const pub = store.cfgList().find(c => c.status === "published"); return { version: pub?.version ?? 0, rules: mergeCfg(pub?.data) }; };
  const mergeCfg = d => { const o = {}; for (const k in DEFAULT_CFG) o[k] = { ...DEFAULT_CFG[k], ...(d?.[k] || {}) }; return o; };
  const noteIngest = ok => { if (ok) { stats.ingested++; stats.lastIngest = now(); } else stats.errors++; };

  // --- Riqueza: oro de las partidas guardadas de jugadores reales (no bots ni sys:). Los habitantes quedan fuera.
  function wealth() {
    const rows = [];
    for (const k in store.saves) { if (k.startsWith("bot:") || k.startsWith("sys:")) continue; const s = store.saves[k]; if (s && Number.isFinite(s.gold)) rows.push({ gold: s.gold, level: s.level | 0 }); }
    const g = rows.map(r => r.gold).sort((a, b) => a - b), n = g.length, total = g.reduce((a, b) => a + b, 0);
    const top = g.slice(Math.floor(n * 0.9)).reduce((a, b) => a + b, 0), bands = [[1, 10], [11, 30], [31, 60], [61, 100], [101, 9999]];
    const edges = [0, 100, 1000, 10000, 100000, 1000000, 1e12];                  // histograma por tramos de oro
    return { available: n > 0, players: n, total, mean: n ? total / n : 0, percentiles: { p10: pct(g, 0.1), p25: pct(g, 0.25), p50: pct(g, 0.5), p75: pct(g, 0.75), p90: pct(g, 0.9), p99: pct(g, 0.99) },
      gini: n >= 10 ? +gini(g).toFixed(4) : null, top10Share: total ? top / total : 0, confidence: n >= 10 ? "ok" : "Datos insuficientes (menos de 10 jugadores)",
      byLevel: bands.map(([a, b]) => { const r = rows.filter(x => x.level >= a && x.level <= b), s = r.map(x => x.gold).sort((x, y) => x - y); return { level: a + "–" + (b === 9999 ? "+" : b), players: r.length, median: pct(s, 0.5), total: s.reduce((x, y) => x + y, 0) }; }),
      histogram: edges.slice(0, -1).map((lo, i) => ({ from: lo, to: edges[i + 1], players: g.filter(v => v >= lo && v < edges[i + 1]).length })),
      definition: "Oro en mano de las partidas guardadas de jugadores (sin bots ni habitantes; no incluye oro en puestos ni jugadores sin partida). Gini solo con ≥10 jugadores." };
  }

  const sources = () => {
    const s = store.econStats(), t = now(), lastAge = s.last ? t - s.last : null, ingestAge = stats.lastIngest ? t - stats.lastIngest : null;
    const reasons = store.econSummary({ artificial: "all" }).map(r => r.reason);
    return { schemaVersion: SCHEMA_VERSION, sink: { status: store.kind === "sqlite" ? (stats.errors ? "degraded" : "connected") : "disabled", ingested: stats.ingested, errors: stats.errors, lastIngestAt: stats.lastIngest || null, ingestAgeMs: ingestAge },
      store: { kind: store.kind, events: s.n || 0, first: s.first || null, last: s.last || null, cursor: s.cursor || 0, lastEventAgeMs: lastAge },
      coverage: { goldReasons: reasons, note: "Cobertura de oro: todos los movimientos de p.gold pasan por ledger.js (bots, teletransporte y objetos Gold incluidos). Se verifica en tests/ledger.test.mjs." },
      latency: "occurred_at = received_at: el servidor del juego captura y persiste en el mismo proceso (latencia de ingestión 0 por construcción).", missing: MISSING, config: cfg() };
  };

  function overview(q) {
    const r = rangeOf(q, now()), span = r.to - r.from, prev = { from: r.from - span, to: r.from, artificial: r.artificial };
    const sum = f => { let c = 0, d = 0, n = 0, tv = 0; for (const s of store.econSummary(f)) { n += s.n; if (s.cls === "transfer") tv += s.inflow; else { c += s.inflow; d += s.outflow; } } return { created: c, destroyed: d, net: c - d, events: n, transferVolume: tv }; };
    const cur = sum(r), old = sum(prev), w = wealth(), st = store.econStats(), t = now();
    const openAlerts = { info: 0, warning: 0, critical: 0 }; for (const a of store.alertList({ limit: 500 })) if (a.status === "open" || a.status === "acknowledged" || a.status === "investigating") openAlerts[a.severity]++;
    return { range: r, serverId: SERVER_ID, ...cur, previous: old, circulating: { available: w.available, value: w.total, quality: "Snapshot de partidas guardadas (ver /wealth: definición y límites)" },
      priceIndex: { available: false, why: "Datos insuficientes: sin precios de transacciones (ver /sources → missing)" }, openAlerts,
      meta: { updated_at: iso(t), source_status: sources().sink.status, last_event_at: st.last ? iso(st.last) : null, freshnessMs: st.last ? t - st.last : null, completeness: "oro: completo; objetos/mercado: no disponible" } };
  }

  function flow(q) {
    const r = rangeOf(q, now()), bucket = Math.max(1000, +q.bucket || Math.max(60000, Math.round((r.to - r.from) / 60 / 60000) * 60000)), span = r.to - r.from;
    const ser = (f, shift) => { const m = new Map(); for (const x of store.econSeries({ ...f, bucket })) { const t = x.t + shift, o = m.get(t) || { t, created: 0, destroyed: 0, events: 0 }; if (x.cls === "faucet") o.created += x.net; else o.destroyed -= x.net; o.events += x.n; m.set(t, o); } return [...m.values()].sort((a, b) => a.t - b.t); };
    const series = ser({ from: r.from, to: r.to, artificial: r.artificial }, 0); let acc = 0; for (const p of series) { p.net = p.created - p.destroyed; acc += p.net; p.cumulative = acc; }
    const previous = ser({ from: r.from - span, to: r.from - 1, artificial: r.artificial }, span);
    const sm = store.econSummary({ from: r.from, to: r.to, artificial: r.artificial }).filter(s => s.cls !== "transfer");
    return { range: r, bucket, series, previous, faucets: sm.filter(s => s.cls === "faucet").sort((a, b) => b.inflow - a.inflow), sinks: sm.filter(s => s.cls === "sink").sort((a, b) => b.outflow - a.outflow), unattributed: { available: true, volume: 0, note: "Toda la moneda tiene motivo (ledger.js); si aparece un volumen sin motivo es un fallo de instrumentación" },
      definition: "Neto = creado − destruido. Los intercambios y puestos (transferencias) mueven oro sin crearlo ni destruirlo." };
  }

  // --- Alertas: reglas versionadas (RULE_VER) con ventana, baseline, umbral, muestra mínima, duración, severidad y cooldown.
  function evaluate(t = now()) {
    const rules = cfg().rules, made = [], min = 60000, add = (rule, a) => { const id = store.alertAdd({ ts: t, rule, ver: RULE_VER, severity: rules[rule].severity, ...a }, rules[rule].cooldownMin * min); if (id) made.push({ id, rule, k: a.k }); };
    const sumWin = (from, to) => { const m = {}; for (const s of store.econSummary({ from, to })) { const o = m[s.reason] ||= { n: 0, inflow: 0, outflow: 0, cls: s.cls }; o.n += s.n; o.inflow += s.inflow; o.outflow += s.outflow; } return m; };
    const tot = m => { let c = 0, d = 0; for (const k in m) if (m[k].cls !== "transfer") { c += m[k].inflow; d += m[k].outflow; } return { c, d }; };
    let R = rules.net_growth;
    if (R.on) { const W = R.windowMin * min, a = tot(sumWin(t - W, t)), b = tot(sumWin(t - 2 * W, t - W)), bad = x => x.c >= R.minCreated && (x.d === 0 || x.c / x.d >= R.ratio);
      if (bad(a) && bad(b)) add("net_growth", { k: "all", observed: a.d ? a.c / a.d : Infinity, baseline: 1, threshold: R.ratio, summary: `Se crea ${a.c.toLocaleString()} de oro y se destruye ${a.d.toLocaleString()} en ${R.windowMin} min, dos ventanas seguidas.`, evidence: { window: [t - W, t], created: a.c, destroyed: a.d, previousWindow: b } }); }
    R = rules.source_dev;
    if (R.on) { const W = R.windowMin * min, cur = sumWin(t - W, t), hist = []; for (let i = 1; i <= R.baselineWindows; i++) hist.push(sumWin(t - (i + 1) * W, t - i * W));
      for (const k in cur) { const c = cur[k]; if (c.cls !== "faucet" || c.n < R.minEvents) continue; const vals = hist.map(h => h[k]?.inflow || 0), have = vals.filter(v => v > 0).length, mean = vals.reduce((x, y) => x + y, 0) / vals.length;
        if (have < 2 || mean <= 0) continue;                                      // sin historia suficiente no se alerta
        const dev = (c.inflow / mean - 1) * 100; if (dev >= R.pct) add("source_dev", { k, observed: c.inflow, baseline: mean, threshold: R.pct, summary: `${k}: ${c.inflow.toLocaleString()} en ${R.windowMin} min, ${Math.round(dev)} % sobre su media (${Math.round(mean).toLocaleString()}).`, evidence: { reason: k, events: c.n, deviationPct: dev, windows: vals } }); } }
    R = rules.duplicate;
    if (R.on) { const g = new Map(); for (const e of store.econRaw(t - R.windowMin * min, t)) { if (e.cls === "transfer" || e.gt == null) continue; const key = [e.actor, e.reason, e.delta, e.gt].join("|"), o = g.get(key) || { n: 0, e }; o.n++; g.set(key, o); }
      for (const [key, o] of g) if (o.n >= R.count) add("duplicate", { k: key, observed: o.n, baseline: 1, threshold: R.count, summary: `${o.e.actor}: ${o.n} movimientos idénticos de ${o.e.delta} por «${o.e.reason}» en el mismo instante de juego.`, evidence: { actor: o.e.actor, reason: o.e.reason, delta: o.e.delta, gameTime: o.e.gt, count: o.n, firstEventId: o.e.event_id } }); }
    R = rules.ledger_gap;
    if (R.on) { const last = new Map(), gaps = new Map(); for (const e of store.econRaw(t - R.windowMin * min, t)) { const p = last.get(e.actor); if (p != null && e.bal != null && p + e.delta !== e.bal) { const o = gaps.get(e.actor) || []; o.push({ eventId: e.event_id, expected: p + e.delta, got: e.bal, reason: e.reason }); gaps.set(e.actor, o); } if (e.bal != null) last.set(e.actor, e.bal); }
      for (const [actor, o] of gaps) if (o.length >= R.minGaps) add("ledger_gap", { k: actor, observed: o.length, baseline: 0, threshold: R.minGaps, summary: `${actor}: ${o.length} saldos no encajan con el movimiento anterior (puede ser carga de partida o un cambio de oro fuera del libro).`, evidence: { actor, samples: o.slice(0, 10) } }); }
    R = rules.concentration;
    if (R.on) { const w = wealth(); if (w.players >= R.minPlayers && w.top10Share >= R.top10Share) add("concentration", { k: "top10", observed: w.top10Share, baseline: 0.5, threshold: R.top10Share, summary: `El 10 % más rico tiene el ${Math.round(w.top10Share * 100)} % del oro de ${w.players} jugadores.`, evidence: { players: w.players, total: w.total, gini: w.gini } }); }
    return made;
  }

  function simulate(body) {
    const r = rangeOf({ hours: body.hours || 24 }, now()), ch = Array.isArray(body.changes) ? body.changes : [];
    if (!ch.length || ch.length > 20) throw new Error("Indica entre 1 y 20 cambios {reason, factor}.");
    const f = new Map(); for (const c of ch) { const k = String(c.reason || ""), v = +c.factor; if (!k || !(v >= 0 && v <= 10)) throw new Error("factor fuera de rango (0 a 10) para «" + k + "»"); f.set(k, v); }
    const base = store.econSummary({ from: r.from, to: r.to }).filter(s => s.cls !== "transfer"); let b = 0, p = 0; const rows = [];
    for (const s of base) { const k = f.has(s.reason) ? f.get(s.reason) : 1; b += s.net; p += s.net * k; if (k !== 1) rows.push({ reason: s.reason, cls: s.cls, baselineNet: s.net, projectedNet: s.net * k, factor: k }); }
    const unknown = [...f.keys()].filter(k => !base.some(s => s.reason === k));
    return { window: r, baselineNet: b, projectedNet: p, delta: p - b, changes: rows, unknownReasons: unknown, events: base.reduce((a, s) => a + s.n, 0),
      assumptions: ["Se reescala el importe histórico de cada motivo por el factor indicado.", "Sin elasticidad: los jugadores no cambian de conducta (más sumidero no reduce la actividad)."], limitations: ["Solo oro de jugadores reales; sin precios ni objetos (ver /sources → missing).", "Es una proyección, no cambia ninguna regla del juego."] };
  }

  function validateCfg(d) {
    if (!d || typeof d !== "object") throw new Error("data debe ser un objeto de reglas.");
    for (const k in d) { if (!DEFAULT_CFG[k]) throw new Error("regla desconocida: " + k);
      for (const f in d[k]) { if (!(f in DEFAULT_CFG[k])) throw new Error(k + "." + f + " no existe"); const v = d[k][f];
        if (f === "on") { if (typeof v !== "boolean") throw new Error(k + ".on debe ser booleano"); } else if (f === "severity") { if (!SEVERITIES.includes(v)) throw new Error(k + ".severity inválida"); }
        else { const [lo, hi] = LIMITS[f] || [0, 1e9]; if (typeof v !== "number" || !(v >= lo && v <= hi)) throw new Error(`${k}.${f} fuera de rango (${lo} a ${hi})`); } } }
    return d;
  }
  const highImpact = (cur, next) => { const out = []; for (const k in next) for (const f in next[k]) { const a = cur[k]?.[f], b = next[k][f]; if (typeof a === "number" && a > 0 && (b / a > 2 || b / a < 0.5)) out.push(`${k}.${f}: ${a} → ${b}`); if (f === "on" && a === true && b === false && k === "duplicate") out.push("duplicate desactivada"); } return out; };

  const audit = (req, ip, body, e) => store.auditAdd({ ts: now(), actor: String(body?.actor || "admin").slice(0, 40), role: "admin", origin: ip, corr: body?.corr || crypto.randomBytes(6).toString("hex"), result: "ok", ...e });

  function stream(req, res, url, cors) {
    if (stream.n >= 20) { res.writeHead(429); res.end(); return; }
    stream.n++; const last = +(req.headers["last-event-id"] || url.searchParams.get("cursor") || 0) || 0, q = { artificial: url.searchParams.get("artificial") === "all" ? "all" : undefined };
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...cors });
    let cursor = last, closed = false;
    if (!last) cursor = store.econStats().cursor || 0;                       // snapshot nuevo: se sigue desde el final; con Last-Event-ID se recuperan los eventos perdidos
    const send = (ev, data, id) => { if (!closed) res.write((id != null ? "id: " + id + "\n" : "") + "event: " + ev + "\ndata: " + JSON.stringify(data) + "\n\n"); };
    send("hello", { cursor, resumed: !!last, serverTime: iso(now()), schemaVersion: SCHEMA_VERSION });
    const tick = () => { try { const rows = store.econAfter(cursor, q, 200); for (const e of rows) { cursor = e.id; send("econ", shapeEvent(e), e.id); } send("beat", { serverTime: iso(now()), cursor, lastIngestAt: stats.lastIngest || null }); } catch {} };
    const iv = setInterval(tick, 1000), done = () => { if (closed) return; closed = true; clearInterval(iv); stream.n--; };
    req.on("close", done); res.on("close", done); tick();
  }
  stream.n = 0;

  // Todas las rutas /api/admin/economy/*. Devuelve true si la ruta era suya.
  function handle(req, res, url, { json, cors, ip, readBody }) {
    const sub = url.pathname.slice("/api/admin/economy/".length), q = Object.fromEntries(url.searchParams), post = req.method === "POST";
    if (limited(ip)) { json(req, res, 429, { error: "Demasiadas consultas; espera un minuto." }); return; }
    const body = () => readBody(req).then(t => { try { return JSON.parse(t || "{}"); } catch { throw new Error("JSON inválido"); } });
    const run = fn => { Promise.resolve().then(fn).then(r => { if (r !== undefined) json(req, res, 200, r); }).catch(e => json(req, res, 400, { error: e.message })); };
    switch (sub) {
      case "overview": return run(() => overview(q));
      case "flow": return run(() => flow(q));
      case "wealth": return run(() => ({ ...wealth(), meta: { updated_at: iso(now()) } }));
      case "sources": return run(sources);
      case "prices": case "items": return run(() => ({ available: false, why: "Datos insuficientes: falta instrumentación de objetos y precios.", missing: MISSING.filter(m => /precio|objetos|Materiales/i.test(m.metric)) }));
      case "stream": return stream(req, res, url, cors);
      case "events": {
        const f = { ...rangeOf(q, now()), reason: q.reason || undefined, actor: q.actor || undefined, before: q.before, limit: q.limit };
        if (q.hours == null && !q.from) delete f.from; if (q.format === "csv") return run(() => { const rows = store.econPage({ ...f, limit: Math.min(5000, +q.limit || 1000) }); audit(req, ip, q, { action: "export", object: "events.csv", new: { rows: rows.length, filter: f } }); res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", ...cors }); res.end("event_id,occurred_at,reason,cls,delta,actor,peer,balance,zone,artificial\n" + rows.map(e => [e.event_id, iso(e.ts), e.reason, e.cls, e.delta, e.actor, e.peer, e.bal, e.map, e.artificial].map(v => /[",\n]/.test(v ?? "") ? '"' + String(v).replace(/"/g, '""') + '"' : v ?? "").join(",")).join("\n")); });
        return run(() => { const rows = store.econPage(f); return { events: rows.map(shapeEvent), next: rows.length ? rows[rows.length - 1].id : null, meta: { updated_at: iso(now()) } }; });
      }
      case "alerts":
        if (!post) return run(() => ({ alerts: store.alertList(q), rules: cfg(), meta: { updated_at: iso(now()) } }));
        return run(async () => { const b = await body();
          if (b.evaluate) { const m = evaluate(); audit(req, ip, b, { action: "alerts.evaluate", object: "rules", new: m }); return { created: m }; }
          if (!STATUSES.includes(b.status)) throw new Error("estado inválido"); if (b.status === "dismissed" && !String(b.note || "").trim()) throw new Error("descartar exige un motivo");
          if (!store.alertSet(+b.id, b.status, b.note, now())) throw new Error("alerta no encontrada"); audit(req, ip, b, { action: "alert.status", object: "alert:" + b.id, new: { status: b.status }, reason: b.note }); return { ok: true }; });
      case "audit": return run(() => ({ audit: store.auditList(+q.limit || 100, +q.before || 0).map(a => ({ ...a, old: a.old && JSON.parse(a.old), new: a.new && JSON.parse(a.new) })) }));
      case "config": return run(() => ({ active: cfg(), defaults: DEFAULT_CFG, versions: store.cfgList(), editable: "Solo umbrales de alertas; el balance del juego sigue en /admin/balance.html y este monitor no lo modifica." }));
      case "simulations": if (!post) return run(() => ({ error: "usa POST" })); return run(async () => { const b = await body(), r = simulate(b); audit(req, ip, b, { action: "simulation", object: "gold", new: { changes: b.changes, delta: r.delta } }); return r; });
      case "config/drafts": if (!post) return run(() => ({ error: "usa POST" }));
        return run(async () => { const b = await body(); validateCfg(b.data); if (!String(b.reason || "").trim()) throw new Error("indica el motivo del cambio");
          const cur = cfg().rules, v = store.cfgDraft(String(b.actor || "admin").slice(0, 40), b.reason, b.data, now()); audit(req, ip, b, { action: "config.draft", object: "config:v" + v, old: cfg().version, new: b.data, reason: b.reason }); return { version: v, highImpact: highImpact(cur, mergeCfg(b.data)) }; });
      case "config/publish": case "config/rollback": if (!post) return run(() => ({ error: "usa POST" }));
        return run(async () => { const b = await body(), isRb = sub.endsWith("rollback"), v = +b.version, list = store.cfgList(), row = list.find(c => c.version === v); if (!row) throw new Error("versión no encontrada");
          if (isRb && row.status === "draft") throw new Error("solo se puede volver a una versión ya publicada");
          if (!isRb && row.status !== "draft") throw new Error("solo se publican borradores");
          const hi = highImpact(cfg().rules, mergeCfg(row.data)); if (hi.length && b.approve !== true) throw new Error("Cambio de alto impacto (" + hi.join("; ") + "): reenvía con approve:true para aprobarlo.");
          const before = cfg().version; store.cfgPublish(v, now()); audit(req, ip, b, { action: isRb ? "config.rollback" : "config.publish", object: "config:v" + v, old: before, new: v, reason: b.reason }); return { ok: true, active: cfg() }; });
      default: json(req, res, 404, { error: "ruta desconocida" });
    }
  }
  return { handle, evaluate, overview, flow, wealth, sources, simulate, noteIngest, cfg, stats, validateCfg, highImpact, mergeCfg };
}
