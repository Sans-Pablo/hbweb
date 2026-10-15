// Reportes de fallos de los testers (F11 en el juego) y errores de JavaScript del cliente. Se guardan en bugs.jsonl (carpeta de datos del servidor);
// el panel web (web/menu.html, pestaña «Errores») los lista y permite marcarlos. Cada línea: {id, at, kind: "report"|"error"|"order" (un habitante no entendió una orden), user, ver, map, x, y, text, status}.
// El estado se guarda como líneas {id, status} que sobrescriben (append-only: nunca se reescribe el fichero).
import fs from "node:fs";
import path from "node:path";

const MAX_TEXT = 600, MAX_ROWS = 5000, RATE = { n: 8, ms: 60000 };
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);

export function openBugs(dir) {
  const file = path.join(dir, "bugs.jsonl");
  const rows = new Map();                                   // id -> fila
  const hits = new Map();                                   // ip -> [marcas de tiempo]
  let seq = 0;
  try {
    for (const l of fs.readFileSync(file, "utf8").split("\n").slice(-MAX_ROWS)) {
      if (!l) continue;
      try { const r = JSON.parse(l); if (r.kind) { rows.set(r.id, r); seq = Math.max(seq, r.id); } else if (rows.has(r.id)) rows.get(r.id).status = r.status; } catch {}
    }
  } catch {}
  const append = o => { try { fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(file, JSON.stringify(o) + "\n"); } catch {} };
  return {
    // devuelve la fila guardada, o null si el emisor pasó el límite (RATE por ip) o el texto está vacío
    add(src, ip = "?", now = Date.now()) {
      const text = clean(src.text, MAX_TEXT); if (!text) return null;
      const h = (hits.get(ip) || []).filter(t => now - t < RATE.ms);
      if (h.length >= RATE.n) { hits.set(ip, h); return null; }
      h.push(now); hits.set(ip, h);
      const kind = src.kind === "error" ? "error" : src.kind === "order" ? "order" : "report";
      if (kind === "error") { for (const r of rows.values()) if (r.kind === "error" && r.text === text && r.status === "open") { r.n = (r.n || 1) + 1; r.last = now; return r; } }   // el mismo error se cuenta, no se duplica
      const r = { id: ++seq, at: now, last: now, n: 1, kind, user: clean(src.user, 24), ver: clean(src.ver, 16), map: clean(src.map, 24), x: +src.x | 0, y: +src.y | 0, text, status: "open" };
      rows.set(r.id, r); append(r); return r;
    },
    list(status) { return [...rows.values()].filter(r => !status || r.status === status).sort((a, b) => b.at - a.at); },
    setStatus(id, status) {
      const r = rows.get(+id); if (!r || !["open", "fixed", "wontfix"].includes(status)) return null;
      r.status = status; append({ id: r.id, status }); return r;
    },
  };
}
