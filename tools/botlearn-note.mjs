// Añade una nota de análisis a la bitácora: node tools/botlearn-note.mjs "texto ES" "text EN"
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const F = new URL("../web/data/botlearn-log.json", import.meta.url), d = existsSync(F) ? JSON.parse(readFileSync(F)) : { entries: [] };
d.entries.push({ at: new Date().toISOString().slice(0, 19).replace("T", " "), es: "ANÁLISIS · " + process.argv[2], en: "ANALYSIS · " + (process.argv[3] || process.argv[2]) });
writeFileSync(F, JSON.stringify(d, null, 1));
