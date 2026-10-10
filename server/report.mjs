// Informe de los habitantes-probadores. Recibe cada aviso (residents.report), lo guarda en informe-bots.jsonl y mantiene un resumen legible
// «Informe de bots.md» (en la carpeta de datos del servidor): temas agrupados con cuántos bots coinciden, ordenados por tipo y frecuencia.
import fs from "node:fs";
import path from "node:path";

const KINDS = [["bug", "🐞 Fallos (bug)"], ["comfort", "🧭 Incomodidades"], ["balance", "⚖️ Balance"], ["idea", "💡 Ideas"]];
export function openReport(dir, { version = "?", log = console.log } = {}) {
  const jsonl = path.join(dir, "informe-bots.jsonl"), md = path.join(dir, "Informe de bots.md");
  const topics = new Map();                                               // kind:topic -> resumen
  let lines = 0, dirty = false;
  const add = (r, count = true) => {
    const k = r.kind + ":" + r.topic;
    let t = topics.get(k);
    if (!t) topics.set(k, t = { kind: r.kind, topic: r.topic, n: 0, bots: new Set(), first: r.at, last: r.at, es: r.es, en: r.en, text: r.text, lvls: [], where: r.map + " (" + r.x + "," + r.y + ")" });
    if (count) t.n++;
    t.bots.add(r.bot); t.last = r.at; t.lvls.push(r.lvl); if (t.lvls.length > 50) t.lvls.shift();
    if (r.es) t.es = r.es; if (r.en) t.en = r.en;
    return t;
  };
  try { for (const l of fs.readFileSync(jsonl, "utf8").split("\n").slice(-5000)) if (l) { try { add(JSON.parse(l)); lines++; } catch {} } } catch {}
  const text = (t, lang) => (lang === "en" ? (t.en || t.es || t.text) : (t.es || t.en || t.text));
  const render = () => {
    const out = [`# Informe de los habitantes-probadores`, `Versión ${version} · ${new Date().toLocaleString("es")} · ${topics.size} temas, ${lines} avisos\n`,
      `Cada línea: **×avisos · bots distintos · niveles** — texto (el bot habla en su idioma; mitad en inglés, mitad en español).\n`];
    for (const [kind, title] of KINDS) {
      const list = [...topics.values()].filter(t => t.kind === kind).sort((a, b) => b.bots.size - a.bots.size || b.n - a.n).slice(0, 60);
      if (!list.length) continue;
      out.push(`## ${title}`);
      for (const t of list) {
        const lv = t.lvls.length ? `nv ${Math.min(...t.lvls)}-${Math.max(...t.lvls)}` : "";
        out.push(`- **×${t.n} · ${t.bots.size} bots · ${lv}** — ${text(t, "es")}${t.en && t.es && t.en !== t.es ? `  \n  _EN:_ ${t.en}` : ""}  \n  \`${t.topic}\` · ${t.where} · ej.: ${[...t.bots].slice(0, 3).join(", ")}`);
      }
      out.push("");
    }
    return out.join("\n");
  };
  const write = () => { if (!dirty) return; dirty = false; try { fs.writeFileSync(md, render()); } catch (e) { log("[informe] no se pudo escribir:", e.message); } };
  const timer = setInterval(write, 30000); timer.unref?.();
  return {
    file: md,
    add(r) {
      r.at = Date.now(); lines++; dirty = true;
      add(r);
      try { fs.appendFileSync(jsonl, JSON.stringify(r) + "\n"); } catch {}
    },
    text: render, flush: write,
    clear() { topics.clear(); lines = 0; try { fs.writeFileSync(jsonl, ""); } catch {} dirty = true; write(); },
    size: () => ({ topics: topics.size, lines }),
  };
}
