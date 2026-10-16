# Admin público y observador en el panel
- Botón «🛡 Admin» en el login (siempre visible): abre `/admin` del servidor. Sin clave ni token ni restricción de IP (decisión del propietario, 2026-10-16); `adminAllowed` devuelve siempre true.
- `/admin` tiene el botón «Observador (pantalla dividida)» que abre `observador.html` dentro de la página.
- Test: `tests/adminlogin.test.mjs`.
- v0.85.43: nueva pestaña «Economía» (monitor completo), ver `economia.md`.
