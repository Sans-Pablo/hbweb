# Magia: portado fiel del original (HG.cpp PlayerMagicHandler)

Test por sistema: `tests/magic-safe.test.mjs` (6), `tests/magic-hold-confuse-ice.test.mjs` (7-9), y los que se añadan en cada bloque.

## 6. Modo ataque seguro
- Home alterna `flags.safe` en el cliente y manda `{t:"safemode", on}` → `p.safeAttack` (world.js, `ToggleSafeAttackModeHandler`).
- `manaCost(p, spell, id, fightZone)`: con `safeAttack` y mapa sin zona de lucha el coste se multiplica por 1,1 (entero) antes del ahorro de maná (HG.cpp:10337).
- `pk.js` ya leía `k.safeAttack` (no penalizar al criminal): ahora sí llega a valer algo.
- Desvío documentado: la puerta de ataque por relación (HG.cpp:18143, `GetPlayerRelationship`) no se aplica porque el PvP del port deja pelear también a los viajeros (ver combatsys.js `isFoe`).

## 7. Hold (HOLDOBJECT, HG.cpp:11102)
Contra un jugador no actúa si ya está inmovilizado, si lanzador u objetivo están en casilla segura (iGetAttribute 0x6 → w.safeAt), si son del mismo grupo o si addPR >= 500. Monstruos: magicLevel >= 6 o ya inmovilizado. Desvío: la regla del mismo bando en mapas de bando sin cruzada no existe en el port (no hay mapas de bando/cruzada).

## 8. Confuse (HG.cpp:11337)
Efecto de área (v2 x v3 alrededor del objetivo), solo jugadores; salta a los de su propio bando (m_side == caster->m_side, viajeros entre sí incluidos) y a los ya confundidos; el resto tira resistencia mágica.

## 9. Ice (HG.cpp:11517)
Un jugador neutral (IsNeutral, side 0) no recibe daño ni hielo. Los demás jugadores (con canFight) se congelan además de los monstruos.
