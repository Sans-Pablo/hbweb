# Reintento de hojas de sprites (v0.76.0)

- Síntoma: algún personaje/monstruo se ve negro (hoja que no llegó). Causa **sin identificar**: esto es un parche parcial, no la solución.
- `client/assets.js`: una hoja que falla o llega vacía (`naturalWidth` 0) se vuelve a pedir hasta 4 veces con `&retry=N` para saltarse la caché; tras el primer reintento fallido se lanza el error «Recarga la página».
- Test: `tests/sprite-retry.test.mjs` (simula `Image`).
