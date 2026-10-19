# Bots que aprenden (v0.85.64)
[invento] — la IA de los bots no existe en el original.

- **Genes** (`shared/systems/botgenes.js`): `flee, potion, rested, engage, ratio` por arquetipo (`vanguard`/`mage`) y modo (`pve`/`pvp`, según `w.pvp`). Sin tabla = comportamiento anterior (`DEFAULTS`). Los lee `bot.js` vía `genesOf(w,p)`.
- **Entrenador** `node tools/train.mjs [gens=6] [pob=8] [segundos=90] [clases] [modos]`: simula con semillas fijas. PvE: exp/min / (1+0,6·muertes). PvP: duelo en terreno abierto contra la clase contraria con genes de fábrica; fitness = ganar + 0,6·(vida propia − vida rival). Mantiene el mejor, muta dentro de `BOUNDS`, acumula la curva y guarda `web/data/botgenes.json` (versión incremental). El servidor lo carga al arrancar.
- **Online**: `learnFight` compara daño previsto y recibido (media móvil, factor `cal` por arquetipo, 0,4–2,5) que escala `fightEstimate`; `learnDeath` cuenta muertes por monstruo (`w.learn`).
- **Admin**: `/admin/aprendizaje.html` (curvas, ranking, calibración y muertes en vivo) con `/api/admin/learning`.
- **Test**: `tests/botlearn.test.mjs`; falla si los genes entrenados rinden >10 % peor que los de fábrica.
