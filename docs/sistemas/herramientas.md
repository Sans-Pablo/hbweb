# Herramientas de prueba (F1 → Herramientas)

INVENTO del port, solo para testers. Código: `client/devtools.js` (panel), `shared/systems/debug.js` (órdenes `{t:"dbg", op}`), viaje en `Adventure.debugTravel`. `DEBUG.enabled` es `true` en la build local; el servidor (`server/server.mjs`) las apaga salvo con `HB_DEBUG=1`.

| Sección | Operaciones |
|---|---|
| Personaje | `level` (1–50, da puntos), `exp`, `gold`, `points`, `stat`, `heal`, `god` (inmortal), `skills` |
| Ir a | `goto` (cualquier mapa exportado, sin la restricción de viaje), `crypt` (salta al nivel N con partida nueva), `clear` (despeja el nivel y abre portales), `teleportxy` |
| Objetos | `give` por nombre exacto de Item.cfg y cantidad; kits: pociones, flechas, tintes, huesos, manual |
| Enemigos | `spawn` (monstruo, cantidad, fuerza ×, jefe 1–4 = reyes de la cripta), `killall` (con exp y botín), `freeze` |
| Summons | `ball` (especie y nivel), `petlvl`, `petheal` (vida + maná), `petspec` (build support/damage/tank con todos los puntos), `petreset` (gratis) |
| Mundo | `sky` (día/noche/auto + clima 0–3) |

Los mensajes salen en el chat como `[test] …`. Test: `tests/debug.test.mjs`.

## Reset all
Botón de «Personaje»: `dbg resetall` → `Adventure.resetAll()` recorre todos los personajes (jugador, bots y habitantes, en cualquier mapa) y llama a `player.resetCharacter`: nivel 1, atributos de partida (clase o `BOT_STATS`), objetos iniciales, sin oro, banco, compañeros ni misiones; los habitantes olvidan su historia. Pide confirmación. Test: `debug.test.mjs`.


## Reiniciar bots desde 0
Botón `botsnew` (con confirmación). `Adventure.restartBots()` quita todos los bots y habitantes, vacía `adv.offline`, borra sus puestos de `stallDb` y llama a `adventure.onBotsRestart(nombres)`; el servidor borra entonces `saves[bkey(n)]` de los 40 habitantes y guarda. Después recrea el mismo número de habitantes, nuevos (nivel 1-4, sin historia). No toca a los jugadores humanos (para eso, Reset all). Test: `tests/debug.test.mjs`.

## Modo «0 restricciones» (`p.free`, v0.79.0)
Sin báculo de familia (`staffOk`), sin tope de nivel de mascota y sin requisitos para evolucionar. Solo herramientas de prueba.

## Barras de estado (v0.79.1)
`renderer.stateBars` pinta sobre la cabeza una barra por estado (debuffs y berserk/protect/invis) con el tiempo restante (escala 10 s). El servidor publica `sx` en `pub()`.
