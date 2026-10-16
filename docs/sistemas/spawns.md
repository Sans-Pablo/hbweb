# Generador de spawns (sistema 27)

Fiel a `MobGenerator` (HG.cpp:16841) y su llamada cada >600 ms (HG.cpp:2093). Código: `spotGenerator` en `shared/systems/npcsys.js`, bucle en `World.tick`. Test: `tests/spot-generator.test.mjs`.

- Cada 600 ms, por cada spot con hueco (`alive < max`): `dice(1,3) == 2` (1/3) crea un monstruo en un punto libre del rectángulo.
- El mapa no supera `maxObjects` (MAPDATA `maximum-object`; `World.maxObjects`), contando cadáveres.
- Al morir, el cadáver permanece `max(dying, regenTime)` y solo entonces se libera el hueco (HG.cpp:6806, DeleteNpc ~16992).
- Cripta, jefes e invocados (`respawn:false`, `master`) no regeneran.
- Desvío: el mapa se llena al crearse (el original arranca vacío y se llena con el generador), respetando `maxObjects`.
