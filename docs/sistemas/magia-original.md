# Magia: portado fiel del original (HG.cpp PlayerMagicHandler)

Test por sistema: `tests/magic-safe.test.mjs` (6), y los que se añadan en cada bloque.

## 6. Modo ataque seguro
- Home alterna `flags.safe` en el cliente y manda `{t:"safemode", on}` → `p.safeAttack` (world.js, `ToggleSafeAttackModeHandler`).
- `manaCost(p, spell, id, fightZone)`: con `safeAttack` y mapa sin zona de lucha el coste se multiplica por 1,1 (entero) antes del ahorro de maná (HG.cpp:10337).
- `pk.js` ya leía `k.safeAttack` (no penalizar al criminal): ahora sí llega a valer algo.
- Desvío documentado: la puerta de ataque por relación (HG.cpp:18143, `GetPlayerRelationship`) no se aplica porque el PvP del port deja pelear también a los viajeros (ver combatsys.js `isFoe`).
