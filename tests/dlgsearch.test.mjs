// Buscador de los cuadros clásicos (DlgSearch) y ajustes de la interfaz nueva: filtrado, teclado, clics y opciones por defecto.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DlgSearch } from "../web/src/client/dlgsearch.js";
const src = n => readFileSync(new URL("../web/src/client/" + n, import.meta.url), "utf8");

const s = new DlgSearch(24, 314, 190);
assert.equal(s.match("Anything"), true, "sin texto no filtra");
assert.equal(s.key({ key: "a" }), false, "sin foco no consume teclas");
assert.equal(s.click(30, 320), true); assert.equal(s.on, true);
for (const k of "ScRoLl") s.key({ key: k });
assert.equal(s.match("Recall Scroll"), true); assert.equal(s.match("Health Potion"), false);
s.key({ key: "Backspace" }); assert.equal(s.q, "ScRoL");
assert.equal(s.key({ key: "a", ctrlKey: true }), true, "Ctrl+tecla no se escribe pero no se filtra al juego");
assert.equal(s.q, "ScRoL");
assert.equal(s.click(24 + 190 - 5, 320), true); assert.equal(s.q, "", "la × limpia");
assert.equal(s.click(5, 5), false); assert.equal(s.on, false, "clic fuera quita el foco");
s.click(30, 320); s.key({ key: "Escape" }); assert.equal(s.on, false);

// cableado
const nd = src("npcdialogs.js"), cd = src("classicdialog.js");
assert.ok(/get focus\(\) \{ return this\.s\.on; \}/.test(nd), "tienda/almacén ceden el teclado al tutorial");
assert.ok(/get focus\(\) \{ return !!this\.s\?\.on; \}/.test(cd));
assert.ok(/search: true/.test(src("petdialog.js")) && /search: true, footer/.test(nd), "compañeros y hospital con buscador");
assert.ok(/idx/.test(nd) && /V\[this\.view \+ i\]\.idx/.test(nd), "el almacén retira por el índice real, no el filtrado");
assert.ok(!/hud\.toast\([^)]*(cast|lanz|hechizo)/i.test(src("main.js")), "el lanzamiento de hechizos no usa el aviso grande");
console.log("OK dlgsearch");
