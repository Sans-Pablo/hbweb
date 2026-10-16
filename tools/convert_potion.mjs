// Potion.cfg → web/data/potion.json. Fila: potion = N Nombre (id cantidad)×6 skillLimit difficulty (HG.cpp: bReadPotionConfigFile).
// Los huecos son "-1 0". Se separa por cualquier espacio en blanco (el original mezcla tabs y espacios).
import { readFileSync, writeFileSync } from "node:fs";
const src = process.argv[2] || "C:/Users/sansp/Documents/HelbreathOriginal/Helbreath.ServerFiles/Config/Potion.cfg";
const rows = [];
for (const line of readFileSync(src, "utf8").split(/\r?\n/)) {
  const m = /^potion\s*=\s*(.+)$/.exec(line.trim()); if (!m) continue;
  const f = m[1].trim().split(/\s+/); if (f.length < 16) continue;
  rows.push({ n: +f[0], name: f[1], arr: f.slice(2, 14).map(Number), limit: +f[14], diff: +f[15] });
}
writeFileSync(new URL("../web/data/potion.json", import.meta.url), JSON.stringify(rows));
console.log(rows.length, "recetas");
