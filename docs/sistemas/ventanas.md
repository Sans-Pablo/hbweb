# Ventanas del juego (toolkit `window.js`)

Código: `client/window.js` (toolkit), `client/newswin.js` (F1), prompts `gui.ask`/`gui.confirm` (ids 90/91). Test: `tests/window.test.mjs`.

**Por qué:** los paneles HTML (F1, opciones, avisos) sacaban el cursor del juego: dentro salía el puntero de Windows y se comportaban como una página web. Ahora todo se dibuja en el lienzo 800×600 con el cursor clásico y las reglas de `gui.js` (orden, arrastre, clic derecho cierra, Esc).

**Estilo:** marco clásico (`gamedialog_1`, fotograma 2, 9-slice), botones de piedra de `dialogtext_1`, texto con la tipografía del juego. Los colores están en `THEME`.

## Cómo crear una ventana
```js
class Mi extends Win {
  constructor() { super({ id: 71, title: "Mi ventana", w: 400, h: 300 }); }
  body(ui, me, world) { ui.text(24, 40, "Hola"); ui.btn(24, 60, 80, "Ok", () => this.g.close(this.id)); }
}
gui.register(new Mi());   // gui.toggle(71)
```
Modo inmediato: `body` se llama cada fotograma; coordenadas locales (0,0 = esquina del marco), área útil `this.inner`.

## Widgets (`ui`)
`text`, `para` (párrafo con ajuste, devuelve alto), `head`, `rule`, `btn`, `check`, `slider`, `input` (texto o número con min/max), `combo` (lista desplegable con filtro), `scroll` (zona con barra y rueda), `hit`, y `Flow` para filas que saltan de línea (`f.text/btn/input/combo/nl`, `f.bottom`).

## Prompts y acciones
- `gui.ask(label, def, {numeric,min,max,maxLen}) → Promise<string|null>` y `gui.confirm(label) → Promise<bool>`: modales del lienzo (sustituyen a `prompt()`/`confirm()` del navegador; los usa el puesto de venta).
- Los diálogos modales bloquean el resto y reciben el teclado antes que los NPC (`gui.key`); `gui.cap` captura el ratón.
- `gui.actions` (rellena `main.js`): `save`, `exportSave`, `importSave`, `tutorial`, `canExport`; así Opciones (id 60) llama a funciones de main sin tocar el DOM.

## Qué sigue en DOM
Solo el login/creación de personaje (`#join`), el selector de archivo `#file-import` y, por ahora, los paneles heredados `#charpanel/#inv/#book` (hud.js) y el diario/seguimiento de misiones (`questui.js`). Migrarlos: crear un `Win` y quitar el panel.

Reglas: un diálogo nunca se cierra a sí mismo dentro de `draw` (usa `sweep()`); toda cadena nueva en español lleva entrada en `client/i18n.js`.
