# Cripta de esqueletos (20 niveles)

- **Entradas**: Aresfarm (134, 94) y middled1n (100, 85) (`DUNGEON_ENTRANCES` en `shared/dungeon.js`; el portal de middled1n se añade en `Adventure.staticWorld`).
- **Niveles**: `generateLevel(seed, level)` es puro (mismo resultado en navegador y Node). La semilla de cada nivel sale de `levelSeed(run, level)`; el cliente regenera la rejilla con `map.seed` y `map.level`.
- **Aspecto**: `tools/build_dungeon_palette.py` lee `middled1n` y `middled1x` y escribe `web/data/dungeon_palette.json` (suelo, roca, bordes por máscara 5x5, objetos 211). El generador solo coloca esas teselas; los mapas originales no se modifican. El agua de middled1n no se reutiliza (hojas animadas).
- **Trazados** (60x60): salas (BSP), laberinto, anillos, islas, pilares, cruz; el tema depende de `(level*5 + semilla&7) % 6`, así que niveles consecutivos nunca repiten. Niveles 5/10/15/20: mapa de 36x36 con un jefe.
- **Dificultad**: generadores con `scale {hp 1+.22(L-1), dmg 1+.10(L-1), exp 1+.15(L-1)}` (`npcsys.spawnFrom`, `rules.npcMelee` usa `dmgMul`). Jefe (`boss` 1..4): vida x6–14, daño x1.6–2.2, exp x8–17; el cliente lo dibuja a escala 1.2 con tinte (`BOSS_COLORS`).
- **Flujo** (`adventure.js`): `enterCrypt` (pregunta con `dungeon-choice` si `p.delve.deepest > 1` y no hay `restart`), `descend` (crea el nivel, descarta el anterior), portales `return` / `down` / `finish` (los dos últimos exigen `w.cleared`). Al salir o morir se descarta la instancia; `p.delve.deepest` se guarda con el personaje (reiniciar lo pone a 1).
- Tests: `tests/dungeon.test.mjs` (alcanzabilidad, variedad, dificultad, flujo, jefe, victoria), `tests/net-dungeon.test.mjs` (servidor real), `tests/assets.test.mjs` y `tests/streaming.test.mjs`.

## Rey esqueleto carmesí (jefe 1, v0.13.0)
Cada 20 % de vida perdida (80/60/40/20 %) enciende un Fire Field (hechizo 41) de radio 2 alrededor de sí; es inmune a los campos de fuego (`fields.js`); siempre deja un `SkeletonBones` teñido de rojo (color 14). Los jefes tienen `searchRange` ≥ 12.
