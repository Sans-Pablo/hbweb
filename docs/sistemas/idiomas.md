# Idiomas (español / inglés)

Código: `client/i18n.js`. El texto del código está en español; `t(texto)` lo traduce al inglés cuando el idioma es `en` (diccionario `EN` + frases con datos en `PATTERNS`).
Los textos que ya vienen en inglés del original (diálogos, tiendas, nombres de objetos y monstruos) no se tocan.

- `gui.text` y `renderer.label` traducen el texto del lienzo; el DOM (HUD, opciones, login, creación) se traduce solo con un `MutationObserver` y se restaura al volver a español.
- Selector: botones Español/English en la pantalla de entrada y en Opciones, y la fila "Idioma / Language" del cuadro de mejoras (60). Se guarda en `localStorage` (`hbweb.lang`); por omisión, el idioma del navegador.
- Un texto nuevo en español sin entrada en `EN` se ve en español: añadirlo a `EN` (exacto) o a `PATTERNS` (con datos). Prueba: `tests/i18n.test.mjs`.
- Auditoría: `node tools/i18n_audit.mjs [--all]` lista las cadenas en español que `t()` aún no traduce (hay ruido de fragmentos de código). Las frases con datos van como plantillas `{x}` en `TPL` (se convierten en patrones).
