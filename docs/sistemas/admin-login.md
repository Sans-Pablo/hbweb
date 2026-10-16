# Login de admin y observador en el panel
- Botón «🛡 Admin» en el login: cuenta (de `HB_ADMINS`/`config.json admins`) + clave -> `POST /api/admin/login` -> token de sesión (12 h) -> `/admin?token=<sesión>`.
- Solo desde el PC del servidor (loopback, sin túnel); 8 intentos fallidos/10 min por IP. El token fijo de `server/data/admin-token.txt` sigue valiendo.
- El panel `/admin` tiene el botón «Observador (pantalla dividida)» que abre `observador.html` dentro de la página.
- Test: `tests/adminlogin.test.mjs`.
