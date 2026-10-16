# Generador de spawns (sistema 27)

Fiel a `MobGenerator` (HG.cpp:16841) y su llamada cada >600 ms (HG.cpp:2093). Código: `spotGenerator` en `shared/systems/npcsys.js`, bucle en `World.tick`. Test: `tests/spot-generator.test.mjs`.

- Cada 600 ms, por cada spot con hueco (`alive < max`): `dice(1,3) == 2` (1/3) crea un monstruo en un punto libre del rectángulo.
- El mapa no supera `maxObjects` (MAPDATA `maximum-object`; `World.maxObjects`), contando cadáveres.
- Al morir, el cadáver permanece `max(dying, regenTime)` y solo entonces se libera el hueco (HG.cpp:6806, DeleteNpc ~16992).
- Cripta, jefes e invocados (`respawn:false`, `master`) no regeneran.
- Desvío: el mapa se llena al crearse (el original arranca vacío y se llena con el generador), respetando `maxObjects`.

## Generador aleatorio (sistema 28, v0.85.16)
`randomMobGenerator` (npcsys.js, mismo pulso de 600 ms) transcribe HG.cpp:15993-16780: con `randomMob.kind` y `maxObjects−30 > npcs activos` crea un maestro cuyo id sale de la tabla del nivel del mapa (`randomMob.count`), con SA por `_cGetSpecialAbility` (HG.cpp:28959) o firme+berserk (exp ×2), y 0..N esclavos (conteo por id y filtros 1/5 de grupo). Tablas en `randommob.gen.js` (generado por `tools/convert_randommob.py`). Desvíos: el esclavo nace junto al maestro (no hay seguir NPC→NPC); sin eventos especiales ni cruzada; posición aleatoria libre del mapa. Test: `tests/random-mob.test.mjs`.
