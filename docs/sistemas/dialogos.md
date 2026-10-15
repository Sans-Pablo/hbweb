# Cuadros de conversación (`DialogBox`)

Código: `client/dialogbox.js` (sobre `Win` de `window.js`). Test: `tests/dialogbox.test.mjs`. Usado por el tutorial (`tutorial.js`, ids 46 y 47).

Constructor de la «history line con opciones»: marco de piedra, cara a la izquierda, nombre, texto con máquina de escribir y botones abajo a la derecha.

```js
gui.register(new DialogBox({ id: 46, w: 600, face: 80, place: (g, box) => {...}, spec: (me, world) => ({
  title, face: (g,x,y,size)=>{}, name, text, shown, options: [{label, fn, primary, disabled, tip, w}],
  numbered, hint, extra: (ui,x,y,w,box)=>alto, click }) }));
```
- `spec` devuelve null para ocultar el cuadro. El alto se calcula del texto; `place` lo coloca (móvil: ancho `g.W-12`, cara de 64).
- `extra` con `ui` nula solo mide y devuelve su alto (barra de progreso, flecha…).
- `numbered:true` numera las opciones y las teclas 1-9 las eligen (lista de respuestas de un NPC).
- El cuadro no se cierra solo: lo cierra quien lo abre (`gui.close`). Textos ya traducidos.
