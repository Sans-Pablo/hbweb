# Buscadores de objetos (v0.85.0)

`client/dlgsearch.js` — `DlgSearch(x,y,w)`: caja de texto del lienzo (`q`, `on`, `match(texto)`, `reset`, `draw`, `click`, `key`). Coincidencia por subcadena sin distinguir mayúsculas.

- ClassicDialog: opción `search: true` (hospital, compañeros); filtra `rows()` por `text`. La caja va a la izquierda del Ok (y 292).
- Tienda/herrería (id 11) y almacén (id 14): `vis()` devuelve `{fila, idx}`; se conserva el índice real para comprar/retirar.
- El teclado: `key(e)` y `focus` hacen que el tutorial no le robe las teclas. `onClose()` borra la búsqueda.
- Test: tests/dlgsearch.test.mjs.
