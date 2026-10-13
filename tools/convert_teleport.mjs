// Teleport.cfg → web/data/teleport.json. Columnas del original (HG: Teleport.cfg): NpcName srcMap tgtMap x y cost minLvl maxLvl side neutral? crim?
// Se separa por cualquier espacio en blanco (el original mezcla tabs y espacios en las filas de HRampart).
import { readFileSync, writeFileSync } from "node:fs";
const src = process.argv[2] || "C:/Users/sansp/Documents/HelbreathOriginal/Helbreath.ServerFiles/Config/Teleport.cfg";
const rows = [];
for (const line of readFileSync(src, "utf8").split(/\r?\n/)) {
  const m = /^teleport\s*=\s*(.+)$/.exec(line.trim()); if (!m) continue;
  const f = m[1].trim().split(/\s+/); if (f.length < 11) continue;
  rows.push({ npc: f[0], from: f[1].toLowerCase(), to: f[2].toLowerCase(), x: +f[3], y: +f[4], cost: +f[5], min: +f[6], max: +f[7], side: f[8].toLowerCase(), neutral: f[9] === "TRUE", crim: f[10] === "TRUE" });
}
writeFileSync(new URL("../web/data/teleport.json", import.meta.url), JSON.stringify(rows, null, 1));
console.log(rows.length, "rutas");
