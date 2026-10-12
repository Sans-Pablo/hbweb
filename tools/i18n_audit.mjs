// Auditoría de traducciones: busca cadenas en español (client/ y shared/) que t() no traduce al inglés.
// node tools/i18n_audit.mjs [--all]   (lista las pendientes; por defecto solo el resumen y las 60 primeras)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
globalThis.document = { documentElement: {}, body: null };
const { t, setLang } = await import("../web/src/client/i18n.js");
setLang("en");
const root = new URL("../web/src/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const files = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : p.endsWith(".js") && !p.endsWith("i18n.js") ? [p] : []; });
const ES = /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|que|con|para|por|tu|tus|no|puedes|tienes|has|te|se|un|una|en|al|su|más|ya|hay|falta|nivel|oro|objeto|jugador|compañero)\b/i;
const out = new Map();
for (const f of files(root)) {
  const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split(/\r?\n/);
  src.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "");
    for (const m of code.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n]){6,}?)\1/g)) {
      const s = m[2], before = code.slice(0, m.index).trimEnd().slice(-1), after = code.slice(m.index + m[0].length).trimStart()[0];
      if (before === "+" || after === "+" || /^[a-z]\w*\s*[=(]/.test(s)) continue;      // fragmentos de una concatenación: los cubre PATTERNS con la frase entera
      if (!/\s/.test(s) || /[;{}()]/.test(s) || /\$\{/.test(s) || /^[\w./#:-]+$/.test(s) || !ES.test(s) || /^<|^\.|^\//.test(s)) continue;
      if (t(s) !== s) continue;
      if (!/[áéíóúñ¿¡]/i.test(s) && !/\b(el|la|los|las|tu|tus|puedes|tienes|has|falta|nivel|objeto|jugador|compañero)\b/i.test(s)) continue;
      const k = s; if (!out.has(k)) out.set(k, f.slice(root.length) + ":" + (i + 1));
    }
  });
}
const all = process.argv.includes("--all");
console.log("Cadenas sin traducir:", out.size);
let n = 0; for (const [s, w] of out) { if (!all && n++ >= 60) break; console.log(w + "  " + s); }
