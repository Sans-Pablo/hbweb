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
`text`, `para` (párrafo con ajuste, devuelve alto), `head`, `rule`, `btn`, `check`, `slider`, `input` (texto o número con min/max), `combo` (lista desplegable con filtro), `search` (campo con lupa y × que devuelve el texto buscado en minúsculas; úsalo en toda ventana con listas, p. ej. F1), `scroll` (zona con barra y rueda), `hit`, y `Flow` para filas que saltan de línea (`f.text/btn/input/combo/nl`, `f.bottom`).

`btn` admite `{primary:true}` (filete dorado y rótulo en negrita: el Ok de los avisos). `THEME.pad/gap/row` (8/6/24) son los márgenes comunes para separar piezas.

## Prompts y acciones
- `gui.ask(label, def, {numeric,min,max,maxLen}) → Promise<string|null>` y `gui.confirm(label) → Promise<bool>`: modales del lienzo (sustituyen a `prompt()`/`confirm()` del navegador; los usa el puesto de venta).
- Los diálogos modales bloquean el resto y reciben el teclado antes que los NPC (`gui.key`); `gui.cap` captura el ratón.
- `gui.actions` (rellena `main.js`): `save`, `exportSave`, `importSave`, `tutorial`, `canExport`; así Opciones (id 60) llama a funciones de main sin tocar el DOM.

## Qué sigue en DOM
Solo el login/creación de personaje (`#join`), el selector de archivo `#file-import` y, por ahora, los paneles heredados `#charpanel/#inv/#book` (hud.js) y el diario/seguimiento de misiones (`questui.js`). Migrarlos: crear un `Win` y quitar el panel.

Reglas: un diálogo nunca se cierra a sí mismo dentro de `draw` (usa `sweep()`); toda cadena nueva en español lleva entrada en `client/i18n.js`.

## Diario de misiones (v0.84.0)
`client/questwin.js`: `QuestWin` (id 49, J o botón «!» de la barra) lista la línea de misiones (✔ hechas, ▶ actual con objetivo, «???» futuras). `questui.js` queda solo como rastreador DOM plegable (▾/▸, se recuerda en `hbweb.qtrack`) bajo el minimapa. El botón Quest de F5 se retiró. Test: `tests/questwin.test.mjs`.

## Pestañas de ClassicDialog (v0.84.1)
`tabBox()` mide cada rótulo (negrita 12 px) y reparte el sobrante como hueco; `tabX(i)`/`tabW(i)` dan posición y caja de clic. Las filas con icono de bola dibujan una casilla cuadrada (translúcida, más clara al pasar el ratón).

## Casillas (v0.84.2)
`drawSlot(c,x,y,s,on,sel)` en `window.js`: hueco gris con bisel, brilla con `on` (hover) y dorado con `sel`. Test `tests/slot.test.mjs`.
