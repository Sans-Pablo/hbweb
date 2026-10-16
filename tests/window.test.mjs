// Sistema de ventanas del lienzo (window.js + gui.js): avisos modales (gui.ask / gui.confirm), teclado y bloqueo del ratón por modal.
import assert from "node:assert/strict";
globalThis.document = { documentElement: {}, body: null, createElement: () => ({ getContext: () => ctx }) };
globalThis.navigator ??= {};
const ctx = new Proxy({ measureText: s => ({ width: String(s).length * 6 }), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => k in o ? o[k] : () => {}, set: () => true });
const { Gui } = await import("../web/src/client/gui.js");
const { registerPrompts, Win } = await import("../web/src/client/window.js");
const g = new Gui({ getContext: () => ctx });
g.manifest = new Proxy({}, { get: () => ({ frames: new Proxy([], { get: () => [0, 0, 10, 10] }) }) }); g.dpr = 1;   // sin imágenes: el marco no se pinta pero los campos sí se registran
g.rect = { x: 0, y: 0, w: 800, h: 600 }; g.scale = 1;
registerPrompts(g);
const key = k => g.key({ key: k });

// ask: escribir y pulsar Intro devuelve el texto; el cuadro se cierra
let p = g.ask("Precio", "5", { numeric: true, maxLen: 3 });
assert.ok(g.isOpen(90) && g.modal()?.id === 90);
g.dialogs.get(90).draw(g, null, null);                                   // el dibujado registra los campos (número, longitud máxima)
key("Backspace"); key("1"); key("2"); key("a"); key("3"); key("4");           // la letra se ignora (numérico), maxLen 3
key("Enter");
assert.equal(await p, "123"); assert.ok(!g.isOpen(90));

// ask: Esc cancela (null)
p = g.ask("Nombre", "x"); key("Escape"); await Promise.resolve();
assert.ok(g.isOpen(90), "el primer Esc solo suelta el foco del campo"); key("Escape");
assert.equal(await p, null); assert.ok(!g.isOpen(90));

// confirm: Intro = sí, Esc = no
p = g.confirm("¿Seguir?"); key("Enter"); assert.equal(await p, true);
p = g.confirm("¿Seguir?"); key("Escape"); assert.equal(await p, false);

// un modal se queda con el ratón y el teclado aunque haya otras ventanas debajo
g.register(new Win({ id: 71, title: "Otra", w: 200, h: 100, x: 400, y: 100 })); g.open(71);
assert.equal(g.dialogAt(450, 130)?.id, 71);
p = g.confirm("¿Seguro?");
assert.equal(g.dialogAt(450, 130), null, "con un modal abierto no se llega a las demás ventanas");
assert.equal(g.down(450, 130, 0), true, "el clic fuera del modal se traga");
assert.ok(g.over(450, 130));
assert.equal(g.key({ key: "z" }), true, "el teclado lo recibe el modal");
g.close(91); assert.equal(await p, false, "cerrar el modal por cualquier vía resuelve la promesa");

// Esc cierra una ventana normal; con un campo con foco, solo lo suelta
key("Escape"); assert.ok(!g.isOpen(71));
// buscador de listas (ui.search): devuelve el texto en minúsculas, la × lo borra
{
  let got = null; const w = new Win({ id: 72, title: "Lista", w: 300, h: 200, x: 100, y: 100 }); w.body = ui => { got = ui.search("q", 24, 40, 200); };
  g.register(w); g.open(72); w.draw(g, null, null); assert.equal(got, "");
  w.vals.q = " Pelo "; w.draw(g, null, null); assert.equal(got, "pelo");
  const x = w.hits.find(h => h.fn && h.x >= 24 + 200 - 18 && h.w <= 18); assert.ok(x, "× visible con texto"); x.fn(); assert.equal(w.vals.q, "");
  g.close(72);
}
console.log("OK");
