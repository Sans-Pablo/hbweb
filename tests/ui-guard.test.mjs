// Guardia de la interfaz: sin sombras/resaltados celestes del navegador, sin cartel "¿Salir del sitio?" (beforeunload),
// y el lienzo de la GUI cubre toda el área visible para que las ventanas lleguen al borde exacto del navegador.
import fs from "fs";
import path from "path";
const root = path.resolve(import.meta.dirname, "..", "web");
const fail = m => { console.error("FALLO:", m); process.exit(1); };
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (!/-webkit-tap-highlight-color:\s*transparent/.test(html)) fail("falta -webkit-tap-highlight-color: transparent");
if (!/canvas,\s*button\s*\{\s*outline:\s*none/.test(html)) fail("falta outline:none en canvas/button");
if (!/::selection\s*\{\s*background:\s*transparent/.test(html)) fail("falta ::selection transparente");
if (/::selection\s*\{[^}]*(#9f|rgba\(\s*(0|100|150),\s*(150|200|220))/i.test(html)) fail("::selection con tinte celeste");
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of [path.join(root, "index.html"), ...walk(path.join(root, "src")).filter(f => f.endsWith(".js"))]) {
  if (/beforeunload|onbeforeunload/.test(fs.readFileSync(f, "utf8"))) fail("beforeunload en " + path.relative(root, f));
}
const gui = fs.readFileSync(path.join(root, "src/client/gui.js"), "utf8");
if (!/this\.full = rect/.test(gui)) fail("el lienzo de la GUI debe cubrir toda el área (this.full = rect)");
if (!/const vl = /.test(gui) && !/vl = \(f\.x/.test(gui)) fail("el arrastre debe medirse contra los bordes del navegador");
{ const i = html.indexOf('id="join"'); if (/type=["']?password/i.test(html.slice(i, i + 1500))) fail("el login no debe usar input type=password (aviso de filtración de Chrome)"); }
const rd = fs.readFileSync(path.join(root, "src/client/renderer.js"), "utf8");
if (rd.includes("rgba(90,170,255,\" + (0.12") || rd.includes("ctx.moveTo(x, y - T / 2); ctx.lineTo(x + T / 2, y)")) fail("rombos celestes de salida sobre el suelo (no existen en el original)");
{ const g2 = fs.readFileSync(path.join(root, "src/client/gui.js"), "utf8");
  if (/hue-rotate((1[5-9]|2[0-4])d?deg)/.test(g2) || g2.includes("#2fd0b0")) fail("tinte turquesa/azul en la barra o la ficha del compañero");
  if (/#(7fc4ff|8de4ff|bde8ff)/i.test(rd)) fail("etiquetas o puntos del minimapa turquesa/celeste en renderer.js"); }
console.log("OK ui-guard");
