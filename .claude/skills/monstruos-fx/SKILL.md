---
name: monstruos-fx
description: Editar el aspecto, auras y efectos visuales de los monstruos/summons (Demon, Frost, Liche…) de hbweb; usar el Bestiario para verificar.
---

Lee `docs/EDITAR_MONSTRUOS.md` completo antes de tocar nada y sigue su flujo:
1. Abre `http://localhost:8088/bestiario.html` (servidor `node server/server.mjs 8088`) y mira la criatura por etapas y direcciones.
2. Edita solo `web/src/client/renderer.js` (`drawEntity`, bloque de auras Lv 50; `orbPos`/`tipPos` para anclajes).
3. Recarga forzada y verifica con una captura; junta todas las correcciones antes de volver a editar.
4. Anota en `docs/CHANGELOG.md`; da siempre el número de versión; no publiques sin que lo pidan.
