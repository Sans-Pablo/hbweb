# Granjas por bando (v0.84.15)
Original: `HG.cpp iGetMapLocationSide` (arefarm/elvfarm y almacenes pertenecen a un bando) y el manejador de teletransporte (~11714): si el destino es de otro bando y el jugador no es GM ni neutral, se deniega.
Port: `adventure.js` `FARM_SIDE` / `enemyMap(p, id)`; se aplica en `teleport()` y en la orden `go`. Promise Land (2ndmiddle) y las criptas siguen libres. Test: `tests/farm-side.test.mjs`.
No implementado: recall forzado de quien ya está dentro (el port no tiene otra ruta a la granja enemiga).

## v0.84.19
- Recall forzado: `Adventure.recallEnemies()` (cada 1 s) devuelve a casa al jugador de otro bando que esté en un mapa enemigo (HG.cpp RequestInitPlayer ~1498, m_iTimeLeft_ForceRecall = 1). Test: `tests/farm-recall.test.mjs`.
