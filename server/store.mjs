// Almacén persistente del servidor: SQLite (node:sqlite, Node >= 22.5) en vez de reescribir un JSON entero cada 30 s.
//   server/data/hb.sqlite  ·  tablas: records(tbl, k, v, updated) para «accounts» y «saves»; history(k, at, v) con copias de cada personaje.
// - WAL + synchronous=FULL: cada guardado queda en disco aunque se cierre la ventana o se corte la luz (el JSON podía perder hasta 30 s).
// - Solo se escriben las filas que cambiaron (flush), todas en una transacción.
// - Historial: una copia del personaje cada HISTORY_EVERY ms como mucho (y al desconectarse), con las últimas HISTORY_KEEP por personaje:
//   si un guardado se corrompe o se pierde un objeto, `restore` (consola/admin) devuelve una versión anterior.
// - Migración automática: si la base está vacía y existen accounts.json / saves.json, se importan (y se renombran *.migrated).
// - Sin node:sqlite (Node antiguo) se cae al modo JSON de siempre, con aviso.
import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "./accounts.mjs";

const HISTORY_EVERY = 10 * 60000, HISTORY_KEEP = 24;

export async function openStore(dir, { accountsFile, savesFile, log = console.log } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  accountsFile ||= path.join(dir, "accounts.json"); savesFile ||= path.join(dir, "saves.json");
  let sqlite = null;
  try { sqlite = await import("node:sqlite"); } catch { sqlite = null; }
  if (!sqlite) return jsonStore(accountsFile, savesFile, log);
  const db = new sqlite.DatabaseSync(path.join(dir, "hb.sqlite"));
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
  db.exec("CREATE TABLE IF NOT EXISTS records(tbl TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY(tbl,k));" +
    "CREATE TABLE IF NOT EXISTS history(k TEXT NOT NULL, at INTEGER NOT NULL, v TEXT NOT NULL); CREATE INDEX IF NOT EXISTS history_k ON history(k, at);" +
    // Monitor económico (docs/sistemas/economia.md): libro de oro, solo se añade. event_id único = idempotencia.
    "CREATE TABLE IF NOT EXISTS econ_events(event_id TEXT PRIMARY KEY, ts INTEGER NOT NULL, gt INTEGER, reason TEXT NOT NULL, cls TEXT NOT NULL, delta INTEGER NOT NULL, actor TEXT, peer TEXT, artificial TEXT, bal INTEGER, map TEXT);" +
    "CREATE INDEX IF NOT EXISTS econ_ts ON econ_events(ts); CREATE INDEX IF NOT EXISTS econ_reason ON econ_events(reason, ts); CREATE INDEX IF NOT EXISTS econ_actor ON econ_events(actor, ts);" +
    // Alertas, auditoría (solo se añade) y configuración versionada del monitor (docs/sistemas/economia.md, fases 2-6)
    "CREATE TABLE IF NOT EXISTS econ_alerts(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, rule TEXT NOT NULL, rule_ver INTEGER NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, k TEXT, observed REAL, baseline REAL, threshold REAL, summary TEXT, evidence TEXT, updated INTEGER, note TEXT);" +
    "CREATE INDEX IF NOT EXISTS econ_alerts_rk ON econ_alerts(rule, k, ts);" +
    "CREATE TABLE IF NOT EXISTS econ_audit(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, actor TEXT, role TEXT, action TEXT NOT NULL, object TEXT, old TEXT, new TEXT, reason TEXT, result TEXT, corr TEXT, origin TEXT);" +
    "CREATE TABLE IF NOT EXISTS econ_config(version INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, author TEXT, status TEXT NOT NULL, reason TEXT, data TEXT NOT NULL, published INTEGER);");
  const load = tbl => { const o = {}; for (const r of db.prepare("SELECT k, v FROM records WHERE tbl=?").all(tbl)) o[r.k] = JSON.parse(r.v); return o; };
  const st = { kind: "sqlite", accounts: load("accounts"), saves: load("saves"), last: new Map(), histAt: new Map() };
  for (const t of ["accounts", "saves"]) for (const k in st[t]) st.last.set(t + "\0" + k, JSON.stringify(st[t][k]));
  const up = db.prepare("INSERT INTO records(tbl,k,v,updated) VALUES(?,?,?,?) ON CONFLICT(tbl,k) DO UPDATE SET v=excluded.v, updated=excluded.updated");
  const del = db.prepare("DELETE FROM records WHERE tbl=? AND k=?");
  const hist = db.prepare("INSERT INTO history(k,at,v) VALUES(?,?,?)");
  const prune = db.prepare("DELETE FROM history WHERE k=? AND at NOT IN (SELECT at FROM history WHERE k=? ORDER BY at DESC LIMIT ?)");
  const econIns = db.prepare("INSERT OR IGNORE INTO econ_events(event_id,ts,gt,reason,cls,delta,actor,peer,artificial,bal,map) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
  const econBuf = [];
  st.econAdd = ev => { econBuf.push(ev); };                                                  // se vuelca en el siguiente flush (misma transacción que las partidas)
  st.flush = (force = false) => {
    const now = Math.max(Date.now(), (st.lastAt || 0) + 1); st.lastAt = now; let n = 0;       // marca única por volcado: la poda del historial se apoya en `at`
    db.exec("BEGIN");
    try {
      for (const e of econBuf.splice(0)) econIns.run(e.eventId, e.ts, e.gt ?? null, e.reason, e.cls, e.delta, e.actor ?? null, e.peer ?? null, e.artificial ?? null, e.bal ?? null, e.map ?? null);
      for (const t of ["accounts", "saves"]) {
        for (const k in st[t]) {
          const key = t + "\0" + k, s = JSON.stringify(st[t][k]);
          if (st.last.get(key) === s) continue;
          up.run(t, k, s, now); st.last.set(key, s); n++;
          if (t === "saves" && !k.startsWith("bot:") && (force || now - (st.histAt.get(k) || 0) >= HISTORY_EVERY)) { hist.run(k, now, s); prune.run(k, k, HISTORY_KEEP); st.histAt.set(k, now); }
        }
        for (const key of [...st.last.keys()]) { const [tt, k] = key.split("\0"); if (tt === t && !(k in st[t])) { del.run(t, k); st.last.delete(key); n++; } }
      }
      db.exec("COMMIT");
    } catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; }
    return n;
  };
  if (!Object.keys(st.accounts).length && !Object.keys(st.saves).length) {                       // primera vez: importar los JSON antiguos
    const a = readJson(accountsFile, null), s = readJson(savesFile, null);
    if (a || s) {
      Object.assign(st.accounts, a || {}); Object.assign(st.saves, s || {});
      log(`[bd] importando ${Object.keys(st.accounts).length} cuentas y ${Object.keys(st.saves).length} personajes de los JSON`);
      st.flush(); for (const f of [accountsFile, savesFile]) { try { if (fs.existsSync(f)) fs.renameSync(f, f + ".migrated"); } catch {} }
    }
  }
  // Consultas del monitor. Filtros: from/to (ms), reason, actor, artificial ("real" = sin bots/debug, "all"), limit. Los tramos se agrupan por `bucket` ms.
  const econWhere = (q = {}) => {
    const w = [], a = [];
    if (q.from != null) { w.push("ts>=?"); a.push(+q.from); } if (q.to != null) { w.push("ts<=?"); a.push(+q.to); }
    if (q.reason) { w.push("reason=?"); a.push(q.reason); } if (q.actor) { w.push("actor=?"); a.push(q.actor); }
    if (q.artificial !== "all") w.push("artificial IS NULL");
    return [w.length ? " WHERE " + w.join(" AND ") : "", a];
  };
  st.econFlush = () => { if (econBuf.length) st.flush(); };
  st.econEvents = (q = {}) => { st.econFlush(); const [w, a] = econWhere(q); return db.prepare("SELECT * FROM econ_events" + w + " ORDER BY ts DESC, rowid DESC LIMIT ?").all(...a, Math.min(1000, +q.limit || 100)); };
  st.econSummary = (q = {}) => {
    st.econFlush(); const [w, a] = econWhere(q);
    return db.prepare("SELECT reason, cls, COUNT(*) n, SUM(delta) net, SUM(CASE WHEN delta>0 THEN delta ELSE 0 END) inflow, SUM(CASE WHEN delta<0 THEN -delta ELSE 0 END) outflow FROM econ_events" + w + " GROUP BY reason, cls ORDER BY ABS(SUM(delta)) DESC").all(...a);
  };
  st.econSeries = (q = {}) => {
    st.econFlush(); const [w, a] = econWhere(q), b = Math.max(1000, +q.bucket || 3600000);
    return db.prepare("SELECT (ts/?)*? t, cls, SUM(delta) net, COUNT(*) n FROM econ_events" + w + " AND cls!='transfer' GROUP BY t, cls ORDER BY t".replace(" AND cls", w ? " AND cls" : " WHERE cls")).all(b, b, ...a);
  };
  // Cursor: rowid del último evento visto (stream en vivo y recuperación tras reconexión); occurred = ts, received = rcv.
  st.econAfter = (cursor = 0, q = {}, limit = 200) => { st.econFlush(); const [w, a] = econWhere(q); return db.prepare("SELECT rowid id, * FROM econ_events" + (w ? w + " AND" : " WHERE") + " rowid>? ORDER BY rowid LIMIT ?").all(...a, +cursor || 0, limit); };
  st.econPage = (q = {}) => { st.econFlush(); const [w, a] = econWhere(q); const before = +q.before || 0, lim = Math.min(500, +q.limit || 50); const cond = before ? (w ? w + " AND" : " WHERE") + " rowid<?" : w; return db.prepare("SELECT rowid id, * FROM econ_events" + cond + " ORDER BY rowid DESC LIMIT ?").all(...a, ...(before ? [before] : []), lim); };
  st.econStats = () => { st.econFlush(); return db.prepare("SELECT COUNT(*) n, MIN(ts) first, MAX(ts) last, MAX(rowid) cursor FROM econ_events").get(); };
  st.econRaw = (from, to, all) => { st.econFlush(); return db.prepare("SELECT rowid id, * FROM econ_events WHERE ts>=? AND ts<=?" + (all ? "" : " AND artificial IS NULL") + " ORDER BY rowid").all(from, to); };
  st.alertAdd = (a, cooldown = 0) => {
    const dup = cooldown && db.prepare("SELECT 1 FROM econ_alerts WHERE rule=? AND k IS ? AND ts>?").get(a.rule, a.k ?? null, a.ts - cooldown);
    if (dup) return null;
    return Number(db.prepare("INSERT INTO econ_alerts(ts,rule,rule_ver,severity,status,k,observed,baseline,threshold,summary,evidence,updated) VALUES(?,?,?,?,'open',?,?,?,?,?,?,?)").run(a.ts, a.rule, a.ver, a.severity, a.k ?? null, a.observed, a.baseline, a.threshold, a.summary, JSON.stringify(a.evidence ?? null), a.ts).lastInsertRowid);
  };
  st.alertList = (q = {}) => { const w = [], a = []; if (q.status) { w.push("status=?"); a.push(q.status); } if (q.severity) { w.push("severity=?"); a.push(q.severity); } if (q.from != null) { w.push("ts>=?"); a.push(+q.from); }
    return db.prepare("SELECT * FROM econ_alerts" + (w.length ? " WHERE " + w.join(" AND ") : "") + " ORDER BY id DESC LIMIT ?").all(...a, Math.min(500, +q.limit || 100)).map(r => ({ ...r, evidence: JSON.parse(r.evidence || "null") })); };
  st.alertSet = (id, status, note, now) => { const r = db.prepare("UPDATE econ_alerts SET status=?, note=?, updated=? WHERE id=?").run(status, note ?? null, now, id); return r.changes > 0; };
  st.auditAdd = e => Number(db.prepare("INSERT INTO econ_audit(ts,actor,role,action,object,old,new,reason,result,corr,origin) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(e.ts, e.actor ?? null, e.role ?? null, e.action, e.object ?? null, e.old == null ? null : JSON.stringify(e.old), e.new == null ? null : JSON.stringify(e.new), e.reason ?? null, e.result ?? null, e.corr ?? null, e.origin ?? null).lastInsertRowid);
  st.auditList = (limit = 100, before = 0) => db.prepare("SELECT * FROM econ_audit" + (before ? " WHERE id<?" : "") + " ORDER BY id DESC LIMIT ?").all(...(before ? [before] : []), Math.min(500, limit));
  st.cfgList = () => db.prepare("SELECT version, ts, author, status, reason, published, data FROM econ_config ORDER BY version DESC LIMIT 50").all().map(r => ({ ...r, data: JSON.parse(r.data) }));
  st.cfgDraft = (author, reason, data, ts) => Number(db.prepare("INSERT INTO econ_config(ts,author,status,reason,data) VALUES(?,?,'draft',?,?)").run(ts, author, reason, JSON.stringify(data)).lastInsertRowid);
  // Publicar es atómico: la versión pasa a «published» y la anterior a «superseded» en una sola transacción.
  st.cfgPublish = (version, ts) => {
    const row = db.prepare("SELECT status FROM econ_config WHERE version=?").get(version); if (!row) return false;
    db.exec("BEGIN"); try { db.prepare("UPDATE econ_config SET status='superseded' WHERE status='published'").run(); db.prepare("UPDATE econ_config SET status='published', published=? WHERE version=?").run(ts, version); db.exec("COMMIT"); } catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; }
    return true;
  };
  st.versions = k => db.prepare("SELECT at FROM history WHERE k=? ORDER BY at DESC").all(k).map(r => r.at);
  st.restore = (k, at) => { const r = db.prepare("SELECT v FROM history WHERE k=? AND at=?").get(k, at); if (!r) return false; st.saves[k] = JSON.parse(r.v); st.flush(true); return true; };
  // Copia diaria de hb.sqlite (VACUUM INTO, consistente con WAL) en <dir>/backups/hb-AAAA-MM-DD.sqlite; conserva las últimas `keep`.
  st.backup = (keep = 7) => {
    try {
      const bd = path.join(dir, "backups"); fs.mkdirSync(bd, { recursive: true });
      const out = path.join(bd, "hb-" + new Date().toISOString().slice(0, 10) + ".sqlite");
      if (fs.existsSync(out)) return null;
      st.flush(true); db.exec("VACUUM INTO '" + out.replace(/'/g, "''") + "'");
      for (const old of fs.readdirSync(bd).filter(n => /^hb-.*.sqlite$/.test(n)).sort().slice(0, -keep)) { try { fs.unlinkSync(path.join(bd, old)); } catch {} }
      return out;
    } catch (e) { log("backup falló: " + e.message); return null; }
  };
  st.close = () => { try { st.flush(true); db.close(); } catch {} };
  return st;
}

function jsonStore(accountsFile, savesFile, log) {
  log("[bd] node:sqlite no disponible (hace falta Node 22.5 o superior): se usa el modo JSON antiguo");
  const st = { kind: "json", accounts: readJson(accountsFile, {}), saves: readJson(savesFile, {}) };
  st.flush = () => { writeJson(accountsFile, st.accounts); writeJson(savesFile, st.saves); return 0; };
  st.econAfter = () => []; st.econPage = () => []; st.econStats = () => ({ n: 0 }); st.econRaw = () => []; st.alertAdd = () => null; st.alertList = () => []; st.alertSet = () => false; st.auditAdd = () => 0; st.auditList = () => []; st.cfgList = () => []; st.cfgDraft = () => 0; st.cfgPublish = () => false; st.econAdd = () => {}; st.econEvents = () => []; st.econSummary = () => []; st.econSeries = () => []; st.versions = () => []; st.restore = () => false; st.backup = () => null; st.close = () => { try { st.flush(); } catch {} };
  return st;
}
