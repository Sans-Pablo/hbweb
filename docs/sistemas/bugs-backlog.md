# Bugs, backlog y menú web
- **F11** (en el juego): ventana `client/bugwin.js`, solo texto; manda `POST /api/bug` con usuario, versión, mapa y posición. Shift+F11 sigue alternando la transparencia de diálogos.
- Errores de JS (`error`, `unhandledrejection`) se mandan solos (máx. 1 cada 5 s por cliente); el servidor agrupa los idénticos abiertos (`n`).
- `server/bugs.mjs`: `bugs.jsonl` en la carpeta de datos, append-only; límite 8 por minuto y IP, 600 caracteres.
- `GET/POST /api/admin/bugs` (solo loopback + `?token=`): lista y marca open/fixed/wontfix.
- `web/menu.html`: pestañas Changelog (`data/news.json`), Backlog (`data/backlog.json`, lo escribe y marca Claude, cada ticket con su reinterpretación) y Errores (requiere token).
- Test: `tests/bugs.test.mjs`.
