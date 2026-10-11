# Vista previa de summons

Al elegir una bola en la pestaña «Bolas» del hospital (diálogo 41) se abre el diálogo 45 (`client/summonpreview.js`) en lugar de comprar directamente.

- Datos: `shared/systems/summoninfo.js` (`infoOf`, `evolutionsOf`, `loreOf`). Sin reglas nuevas: usa `statsOf`, `unlockLevels`, `SIZE_STAGES`, `TIER2`.
- Contenido: estadísticas nivel 1 → 50, habilidades por nivel, historia breve, siluetas de las 4 etapas de tamaño y la evolución de nivel 50 (tier 2) como silueta con «?».
- El botón «Comprar bola» envía `petbuy` y cierra; Ok cierra sin comprar.
- Test: `tests/summoninfo.test.mjs`. Textos en inglés en `client/i18n.js` (bloque 0.50.8).
