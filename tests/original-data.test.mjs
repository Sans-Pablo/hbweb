// Auditoría de datos vs el original: compara web/data con los .cfg de Helbreath.ServerFiles/Config (tools/audit_datos.mjs).
// Las diferencias ya conocidas están congeladas en docs/auditoria_baseline.json (ver docs/AUDITORIA_DATOS.md): el test falla
// si aparece una diferencia NUEVA (dato tocado sin querer) o si un área pierde filas. Para aceptar un cambio deliberado:
//   node tools/audit_datos.mjs --json docs/auditoria_baseline.json
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { REMOVED_MASTER_IDS } from "../web/src/shared/items.js";   // v0.85.100 (obs. 111): quitados a propósito
import os from "node:os";
import path from "node:path";
const CFG = process.env.HB_ORIGINAL_CFG || "C:/Users/sansp/Documents/HelbreathOriginal/Helbreath.ServerFiles/Config";
if (!fs.existsSync(CFG + "/Item.cfg")) { console.log("OK original-data (omitido: no hay copia del original en " + CFG + ")"); process.exit(0); }
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hbaud-")), "now.json");
execFileSync("node", ["tools/audit_datos.mjs", CFG, "--json", tmp], { stdio: "ignore" });
const now = JSON.parse(fs.readFileSync(tmp, "utf8")), base = JSON.parse(fs.readFileSync("docs/auditoria_baseline.json", "utf8"));
let bad = 0;
const removed = l => REMOVED_MASTER_IDS.some(id => l.startsWith("#" + id + " "));
for (const area of ["items", "npc", "magic", "teleport"]) {
  if (now[area].total !== base[area].total) { console.log(`FALLO ${area}: el original tiene ${now[area].total} filas (baseline ${base[area].total})`); bad++; }
  const known = new Set(base[area].lines);
  const fresh = now[area].lines.filter(l => !known.has(l) && !(area === "items" && removed(l)));
  for (const l of fresh.slice(0, 10)) console.log(`FALLO ${area}: diferencia nueva respecto al original: ${l}`);
  if (fresh.length) bad += fresh.length;
}
// invariantes duras: ningún ítem original desaparece y sus IDs nunca se reutilizan para otro nombre salvo los ya documentados
const miss = now.items.lines.filter(l => /: FALTA$/.test(l) && !removed(l));
if (miss.length) { console.log("FALLO items: faltan ítems originales", miss.slice(0, 5)); bad++; }
const tp = now.teleport.lines; if (tp.length) { console.log("FALLO teleport:", tp); bad++; }
console.log(bad ? "FALLO original-data" : "OK original-data");
process.exit(bad ? 1 : 0);
