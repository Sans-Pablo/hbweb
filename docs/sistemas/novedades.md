# F1: novedades y pruebas

Código: `client/news.js`, `web/data/news.json`, panel `#news` en `web/index.html`. Sustituye a la ayuda original (diálogos 18/35 y `data/help/*.txt`, eliminados).

- Tres pestañas: **Novedades** (registro por fecha), **Para probar** (lista con casillas que se guardan en `localStorage` `hbweb.tested`) y **A tener en cuenta** (límites conocidos y qué falta por portar).
- Todo el texto va en `news.json` con `es` y `en`; se redibuja al cambiar de idioma.
- **Regla de trabajo:** cada cambio que un tester pueda notar se anota en `news.json` (novedad + casilla de prueba con `id` único) en el mismo commit.
- F1 y H abren/cierran el panel; Esc lo cierra.
