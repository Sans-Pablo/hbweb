// Guardia: sin turquesa/teal en la interfaz (casillas neutras vía drawSlot, colores de ventanas y paneles).
import fs from "fs";
import path from "path";
const dir = path.resolve(import.meta.dirname, "..", "web/src/client");
const bad = [];
const hue = (r, g, b) => { const M = Math.max(r, g, b), m = Math.min(r, g, b); if (M - m < 40) return -1; const d = M - m; let h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".js") && f !== "look.js")  /* look.js: tintes de pelo/ropa (datos, no interfaz) */) {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  for (const m of src.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    let h = m[1]; if (h.length === 3) h = [...h].map(c => c + c).join("");
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)), hh = hue(r, g, b);
    if (hh >= 155 && hh <= 185 && Math.max(r, g, b) > 90) bad.push(f + ": " + m[0]);
  }
}
if (bad.length) { console.error("FALLO: turquesa en la interfaz:\n" + [...new Set(bad)].join("\n")); process.exit(1); }
console.log("OK ui-teal");
