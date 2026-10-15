# Bolas de invocación propias

INVENTO del port (compañeros, ver `companeros.md`). Cada especie de `SPECIES` (companion.js) tiene su propio objeto-bola: ids 2001..2032 en orden de declaración (Slime=2001 … Aura=2032), `SPECIES[sp][1]`. No se renumera ningún id de Item.cfg.

- Datos: `web/data/items.json` (copia los campos del 651; `display` «<Especie> Ball», `sprite` 23, `spriteFrame` = índice) y `sprites.json` (`ip20`, alias `ig20`, 32 celdas de 48 px). Se generan con `node tools/ballitems.mjs` (idempotente).
- Icono: `web/data/sprites/ip20.png` (384x192) horneado en el navegador con el juego en marcha, dibujando `drawBall` de cada especie en una cuadrícula de 8x4. Si se añade una especie, volver a hornear.
- Dibujo: `client/compicon.js` (`BALL_SPRITE = 23`) usa la hoja; las bolas antiguas con ids 651-655 guardadas en partidas se siguen pintando con el camino de teñido anterior.
- Origen: compra en el hospital (`buyBall`), `tradeUp` y la herramienta de F1 (`ball`). El botín 651-655 (`shared/drops.js`) no cambia.
- Test: `tests/bolas-especie.test.mjs`.
