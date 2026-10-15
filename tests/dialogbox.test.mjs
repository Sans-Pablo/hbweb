// DialogBox (dialogbox.js): maquetación por texto, opciones numeradas y colocación. Sin DOM: contexto falso con medida fija.
import assert from "node:assert/strict";
import { DialogBox } from "../web/src/client/dialogbox.js";
const ctx = { font: "", measureText: s => ({ width: String(s).length * 6 }) };
const g = { W: 800, H: 600, ctx, mobile: false };
let picked = null, spec = { title: "T", name: "N", text: "palabra ".repeat(60), options: [{ label: "A", fn: () => picked = "a" }, { label: "B", fn: () => picked = "b" }] };
const b = new DialogBox({ id: 99, spec: () => spec, place: (gg, bx) => { bx.y = 538 - bx.h; } });
b.layout(g);
const h1 = b.h; assert.ok(h1 > 100 && b.y + b.h === 538, "alto según texto y colocado por place");
spec = { ...spec, text: "corto" }; b.layout(g);
assert.ok(b.h < h1, "menos texto, caja más baja");
spec = { ...spec, face: () => {} }; b.layout(g); assert.equal(b.face, 80);
const m = { ...g, W: 360, mobile: true }; b.layout(m); assert.ok(b.w <= 348 && b.face <= 64, "móvil: ancho de pantalla y cara pequeña");
b.cur = spec; b.key({ key: "2" }, g); assert.equal(picked, null, "sin numbered las teclas no eligen");
b.cur = { ...spec, numbered: true }; assert.ok(b.key({ key: "2" }, g) && picked === "b", "numbered: la tecla 2 elige la opción 2");
spec = { ...spec, face: null, text: "palabra ".repeat(60), extra: (ui, x, y, w) => 30 }; b.layout(g); const h2 = b.h; spec = { ...spec, extra: null }; b.layout(g); assert.equal(h2 - b.h, 30, "extra suma su alto");
console.log("OK dialogbox");
