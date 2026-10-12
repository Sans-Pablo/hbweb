// Añade la revisión del despliegue a módulos ESM y entradas HTML para evitar mezclar entregas.
//   node tools/version_web.mjs web "$GITHUB_SHA"
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const IMPORT = /((?:from\s+|import\s*)["'])(\.[^"'?]+\.js)(?:\?v=[a-zA-Z0-9_-]+)?(["'])/g;
const SCRIPT = /(\bsrc\s*=\s*["'])([^"'?]+\.js)(?:\?v=[a-zA-Z0-9_-]+)?(["'])/g;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

export function versionWeb(root, revision) {
  if (!/^[a-zA-Z0-9_-]+$/.test(revision)) throw new Error("Revisión inválida");
  let count = 0;
  for (const p of walk(root)) {
    const ext = path.extname(p);
    if (ext !== ".html" && ext !== ".js") continue;
    const source = fs.readFileSync(p, "utf8");
    let text = source.replace(IMPORT, (_, a, b, c) => a + b + "?v=" + revision + c);
    if (ext === ".html") text = text.replace(SCRIPT, (_, a, b, c) => a + b + "?v=" + revision + c);
    if (text !== source) { fs.writeFileSync(p, text); count++; }
  }
  return count;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`Módulos versionados: ${versionWeb(process.argv[2], process.argv[3])}`);
