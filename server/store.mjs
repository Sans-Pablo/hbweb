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
    "CREATE TABLE IF NOT EXISTS history(k TEXT NOT NULL, at INTEGER NOT NULL, v TEXT NOT NULL); CREATE INDEX IF NOT EXISTS history_k ON history(k, at);");
  const load = tbl => { const o = {}; for (const r of db.prepare("SELECT k, v FROM records WHERE tbl=?").all(tbl)) o[r.k] = JSON.parse(r.v); return o; };
  const st = { kind: "sqlite", accounts: load("accounts"), saves: load("saves"), last: new Map(), histAt: new Map() };
  for (const t of ["accounts", "saves"]) for (const k in st[t]) st.last.set(t + "\0" + k, JSON.stringify(st[t][k]));
  const up = db.prepare("INSERT INTO records(tbl,k,v,updated) VALUES(?,?,?,?) ON CONFLICT(tbl,k) DO UPDATE SET v=excluded.v, updated=excluded.updated");
  const del = db.prepare("DELETE FROM records WHERE tbl=? AND k=?");
  const hist = db.prepare("INSERT INTO history(k,at,v) VALUES(?,?,?)");
  const prune = db.prepare("DELETE FROM history WHERE k=? AND at NOT IN (SELECT at FROM history WHERE k=? ORDER BY at DESC LIMIT ?)");
  st.flush = (force = false) => {
    const now = Math.max(Date.now(), (st.lastAt || 0) + 1); st.lastAt = now; let n = 0;       // marca única por volcado: la poda del historial se apoya en `at`
    db.exec("BEGIN");
    try {
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
  st.versions = k => db.prepare("SELECT at FROM history WHERE k=? ORDER BY at DESC").all(k).map(r => r.at);
  st.restore = (k, at) => { const r = db.prepare("SELECT v FROM history WHERE k=? AND at=?").get(k, at); if (!r) return false; st.saves[k] = JSON.parse(r.v); st.flush(true); return true; };
  st.close = () => { try { st.flush(true); db.close(); } catch {} };
  return st;
}

function jsonStore(accountsFile, savesFile, log) {
  log("[bd] node:sqlite no disponible (hace falta Node 22.5 o superior): se usa el modo JSON antiguo");
  const st = { kind: "json", accounts: readJson(accountsFile, {}), saves: readJson(savesFile, {}) };
  st.flush = () => { writeJson(accountsFile, st.accounts); writeJson(savesFile, st.saves); return 0; };
  st.versions = () => []; st.restore = () => false; st.close = () => { try { st.flush(); } catch {} };
  return st;
}
