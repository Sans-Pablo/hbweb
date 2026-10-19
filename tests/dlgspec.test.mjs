// Constructor de diálogos declarativo (dlgspec.js): apila filas, pestañas, botones y búsqueda sin DOM.
import assert from "node:assert/strict";
globalThis.document = { documentElement: {}, body: null, createElement: () => ({ getContext: () => ctx }) };
globalThis.navigator ??= {};
const ctx = new Proxy({ measureText: s => ({ width: String(s).length * 6 }), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => k in o ? o[k] : () => {}, set: () => true });
const { Gui } = await import("../web/src/client/gui.js");
const { defineDialog } = await import("../web/src/client/dlgspec.js");
const g = new Gui({ getContext: () => ctx });
g.manifest = new Proxy({}, { get: () => ({ frames: new Proxy([], { get: () => [0, 0, 10, 10] }) }) }); g.dpr = 1;
g.rect = { x: 0, y: 0, w: 800, h: 600 }; g.scale = 1;

let n = 0, on = false, got = "";
const d = defineDialog({ id: 72, title: "Demo", w: 300, h: 260, x: 100, y: 100, tabs: ["A", "B"], items: (me, w, win, tab) => tab === 0
  ? [{ k: "head", s: "Hola" }, { k: "search", id: "q" }, { k: "check", s: "Sí", get: () => on, set: v => { on = v; } }, { k: "btn", s: "Sumar", fn: () => { n++; } }]
  : [{ k: "para", s: "Pestaña B" }, { k: "row", items: [{ k: "btn", s: "Uno", fn: () => { n += 10; } }] }] });
g.register(d); g.open(72); d.draw(g, null, null);
const clickBtn = lbl => { d.draw(g, null, null); const hs = d.hits.filter(h => h.fn); return hs; };
let hs = clickBtn();
assert.ok(hs.length >= 4, "pestañas, × del buscador o casilla y botón registrados");
const body = () => d.hits.filter(h => h.fn && h.w > 20 && h.y > 40);   // sin las bolas del marco ni las pestañas
body().at(-1).fn(); assert.equal(n, 1, "el botón de la pestaña A suma");
d.tab = 1; d.draw(g, null, null);
body().at(-1).fn(); assert.equal(n, 11, "la pestaña B muestra otros botones");
assert.throws(() => defineDialog({ id: 73, items: [{ k: "zzz" }] }).draw(g, null, null), /desconocida/);
// fila list (con buscador y pie de ayuda) y fila draw
let picked = null, drew = 0;
const L = defineDialog({ id: 74, title: "Lista", w: 300, h: 300, x: 100, y: 100, footer: "pie",
  items: [{ k: "search", id: "q" }, { k: "draw", h: 14, fn: () => { drew++; } },
    { k: "list", filter: true, h: 100, pick: r => { picked = r.text; }, rows: [{ text: "Alfa", right: 5 }, { text: "Beta", disabled: true }, { text: "Gamma", tip: "ayuda" }] }] });
g.register(L); g.open(74); L.draw(g, null, null);
assert.equal(drew, 1, "la fila draw se ejecuta");
const rowHits = () => L.hits.filter(h => h.fn && h.h === 18);
assert.equal(rowHits().length, 2, "la fila deshabilitada no registra clic");
rowHits()[0].fn(); assert.equal(picked, "Alfa");
L.vals.q = "gam"; L.draw(g, null, null); assert.equal(rowHits().length, 1, "el buscador filtra la lista");
console.log("OK");
