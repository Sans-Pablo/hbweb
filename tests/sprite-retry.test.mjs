// Sprite negro: una hoja que falla o llega vacía se vuelve a pedir (hasta 4 veces) en vez de quedarse rota
import assert from "node:assert/strict";
const made = [];
globalThis.Image = class { constructor() { made.push(this); this.complete = false; this.naturalWidth = 0; } };
globalThis.document = { createElement: () => ({ getContext: () => ({}) }) };
globalThis.window = globalThis.window || { location: { search: "", hostname: "x" } };
const { Sprites } = await import("../web/src/client/assets.js");
const s = new Sprites({ hero: { png: "hero.png", frames: [] } }, {});
const a = s.img.hero; assert.equal(made.length, 1);
assert.equal(s.img.hero, a, "sin fallo no se repite la petición");
a.complete = true; a.naturalWidth = 0;                               // llegó vacía
const t0 = performance.now(); const realNow = performance.now.bind(performance);
performance.now = () => t0 + 5000;
const b = s.img.hero; assert.notEqual(b, a, "se vuelve a pedir"); assert.match(b.src, /retry=1/);
performance.now = realNow;
console.log("OK sprite-retry");
