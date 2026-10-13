# F1: novedades y pruebas

Código: `client/newswin.js` (ventana del lienzo, id 70, sobre `client/window.js`; ver `docs/sistemas/ventanas.md`), `web/data/news.json`. Sustituye a la ayuda original (diálogos 18/35 y `data/help/*.txt`, eliminados). Ya no hay panel HTML: F1 se ve dentro del juego con el cursor clásico.

- Cuatro pestañas: **Novedades** (registro por fecha), **Para probar** (lista con casillas que se guardan en `localStorage` `hbweb.tested`), **A tener en cuenta** (límites conocidos y qué falta por portar) y **Herramientas** (pruebas, ver `herramientas.md`).
- Todo el texto va en `news.json` con `es` y `en`; se redibuja al cambiar de idioma.
- **Regla de trabajo:** cada cambio que un tester pueda notar se anota en `news.json` (novedad + casilla de prueba con `id` único) en el mismo commit.
- F1 y H abren/cierran la ventana; Esc o clic derecho la cierran.
