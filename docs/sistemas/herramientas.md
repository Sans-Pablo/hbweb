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
