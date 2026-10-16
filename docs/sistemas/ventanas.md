# Ventanas del juego (toolkit `window.js`)

Código: `client/window.js` (toolkit), `client/newswin.js` (F1), prompts `gui.ask`/`gui.confirm` (ids 90/91). Test: `tests/window.test.mjs`.

**Por qué:** los paneles HTML (F1, opciones, avisos) sacaban el cursor del juego: dentro salía el puntero de Windows y se comportaban como una página web. Ahora todo se dibuja en el lienzo 800×600 con el cursor clásico y las reglas de `gui.js` (orden, arrastre, clic derecho cierra, Esc).

**Estilo:** marco clásico (`gamedialog_1`, fotograma 2, 9-slice), botones de piedra de `dialogtext_1`, texto con la tipografía del juego. Los colores están en `THEME`.

## Estilo común (`client/uistyle.js`)
Una sola fuente para `Win`, `ClassicDialog` y `gui.text`: `font(size,bold)` (Tahoma, mínimo `MIN_SIZE`=10 px), `LAYOUT` (título a y=15, margen 22, hueco 6, fila 18, botón 20) y la paleta `INK/DARK/RED/GOOD/DIM`. Los textos de `Ui.text/para` llevan sombra por defecto. En `ClassicDialog` las pestañas se reparten por su ancho medido (`tabBox`), no a paso fijo. Los cuadros originales (ids 1–60) no se tocan. Revisión visual: abrir cada id con `hb.gui.open(id)` en `?offline=1`.

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

## Barra a los bordes (v0.84.4)
`Gui.edgeFill()` dibuja a cada lado del lienzo 800x600 una tira con la primera/última columna del marco 14 de gamedialog2_6; solo en Remastered y no en móvil. Test: `tests/edgefill.test.mjs`.

## Casillas (v0.84.2)
`drawSlot(c,x,y,s,on,sel)` en `window.js`: hueco gris con bisel, brilla con `on` (hover) y dorado con `sel`. Test `tests/slot.test.mjs`.

## Arrastre hasta el borde y paneles DOM (0.85.1)
- `gui.js`: y máximo = H-52-20 (la barra inferior tapa lo de debajo). `domdrag.js`: `#chat` y `#log` con asa `.dh`, posición en `hbweb.pos.*`, doble clic restaura; no en móvil.

- 0.85.7: ventanas hasta el borde exacto del navegador (gui.full); ver CHANGELOG.

- 0.85.10: sin rombos celestes de salida sobre el suelo (test en ui-guard).
- 0.85.9: ver docs/AUDITORIA_UI.md (tabla por ventana).

## Cerrar y minimizar (0.85.19)
- `Win.draw` pinta dos botones-bola sobre las bolas plateadas del marco: derecha = cerrar (`g.close`), izquierda = minimizar. Minimizada, la ventana pasa a una barra de 170x26 con el título (bola izquierda restaura, derecha cierra); `this.w/h` cambian y se restauran desde `this.full`.
- API: `win.minimize()`, `win.restore()`, `win.toggleMin()`, `win.minimized`, `canMin`. Opciones: `nox` (sin cerrar ni minimizar), `nomin`; las `modal` no minimizan. Las ventanas que dibujan su propio marco (ClassicDialog, dialogbox) deben llamar a `this.ball(ui, x, y, glyph, tip, fn)` o heredar de `Win`.
