// Sprites negros en personajes (0.85.23): una textura WebGL sin datos se muestrea como negro opaco (0,0,0,1). Causas: (1) subir una hoja
// aún sin decodificar (tamaño 0) y dejarla cacheada; (2) pérdida de contexto: las texturas mueren y lo compuesto después sale negro.
// Se prueba con un WebGL simulado (sin DOM).
import assert from "node:assert/strict";
const listeners = {};
let lostFlag = false, uploads = 0;
const gl = new Proxy({ isContextLost: () => lostFlag, getShaderParameter: () => true, getProgramParameter: () => true,
  texImage2D: () => { uploads++; }, createTexture: () => ({}), getAttribLocation: () => 0, getUniformLocation: () => ({}) },
  { get: (t, k) => k in t ? t[k] : (typeof k === "string" && /^[A-Z0-9_]+$/.test(k) ? 1 : () => ({})) });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => gl, addEventListener: (n, f) => { listeners[n] = f; } }) };
globalThis.performance = globalThis.performance || { now: () => Date.now() };
const { GLCompose } = await import("../web/src/client/glcompose.js");
const g = new GLCompose();

const empty = { naturalWidth: 0, naturalHeight: 0, width: 0, height: 0, complete: false };
assert.equal(g.texture(empty), null, "hoja sin datos: no se sube"); assert.equal(uploads, 0); assert.ok(!g.has(empty), "y no queda cacheada");
const half = { naturalWidth: 64, naturalHeight: 64, complete: false };
assert.equal(g.texture(half), null, "imagen sin decodificar completa: tampoco");
const ok = { naturalWidth: 64, naturalHeight: 32, complete: true };
assert.ok(g.texture(ok) && uploads === 1 && g.has(ok), "hoja válida: se sube y se cachea");
assert.equal(g.quad(empty, 0, 0, 8, 8, 0, 0, 8, 8), false, "quad con hoja vacía = reintentar");

// pérdida y restauración de contexto
let prevented = false; const e0 = g.epoch;
listeners.webglcontextlost({ preventDefault: () => { prevented = true; } });
assert.ok(prevented && g.lost, "se acepta la restauración (preventDefault)");
assert.equal(g.texture(ok), null, "con el contexto perdido no se sirve ninguna textura"); assert.equal(g.quad(ok, 0, 0, 8, 8, 0, 0, 8, 8), false);
lostFlag = false; listeners.webglcontextrestored();
assert.ok(!g.lost && g.epoch === e0 + 1, "restaurado: nueva época"); assert.equal(g.tex.size, 0, "texturas viejas descartadas");
assert.ok(g.texture(ok) && g.has(ok), "tras restaurar se vuelven a subir");

// PersonCache vacía el atlas al cambiar la época del compositor
const { PersonCache } = await import("../web/src/client/composed.js");
const spr = { wtCache: new Map(), hd: false };
const pc = new PersonCache(spr, g);
pc.map.set("x", { t: undefined }); pc.pages = [{}];
pc.newFrame(); assert.equal(pc.map.size, 1, "misma época: se conserva");
g.epoch++; pc.newFrame(); assert.equal(pc.map.size, 0, "época nueva: atlas descartado"); assert.equal(pc.pages.length, 0);
console.log("OK");
