// Guardia (pedido 2026-10-19, punto 4): modos Remastered/Legacy conmutables y minimapa propio para móvil. node tests/ui-modos-mini.test.mjs
import { readFileSync } from "node:fs";
const r = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const main = r("web/src/client/main.js"), opt = r("web/src/client/optwin.js"), html = r("web/index.html");
const ok = (c, m) => { if (!c) { console.error("FALLA: " + m); process.exit(1); } };
ok(/if \(mobile\) \{ renderer\.miniSize = \d+; renderer\.miniTop = \d+; \}/.test(main), "móvil: minimapa pequeño y bajo los botones");
ok(opt.includes("Remastered (apagado: Legacy)"), "opción para alternar Remastered/Legacy");
ok(main.includes('m === "classic" ? "Legacy" : "Remastered"'), "rótulo del modo activo");
ok(/body\.classic #log/.test(html), "registro estilo Legacy en CSS");
console.log("OK ui-modos-mini");
