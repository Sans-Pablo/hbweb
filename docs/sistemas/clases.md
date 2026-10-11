# Clases (Guerrero, Mago, Invocador)
Invento del port. Código: `shared/systems/player.js` (`PRESETS`, `CLASSES`, `sanitizeCreate`, `p.cls` en save), `companion.js` (`maxSummons`, `activeBalls`), `npcsys.js` (`spawnCompanion(w,p,only)`, `dismissCompanion(w,p,uid)`, `toggleCompanion`). Cliente: `create.js`. Test: `tests/classes.test.mjs`.
- Se elige al crear (mensaje `create.cls`; ausente o inválido = guerrero, por eso no sube `NET_PROTO`). Solo fija los atributos iniciales: guerrero FUE/VIT 14, mago INT/MAG 14, invocador CAR/VIT 14. Las partidas antiguas son guerrero.
- Invocador: `maxSummons` = 2 con CAR total ≥ 100, 3 con ≥ 200 (1 el resto de clases o por debajo). Los summons activos deben ser de especies distintas; al activar uno más del límite se guarda el más antiguo. Cada invocación cuesta su % de maná (sin descuento).
- `spawnCompanion` sin bola reinvoca todas las activas (cambio de mapa, reaparición); con bola solo esa. La experiencia por muerte se reparte a todas las activas.
- Limitación: F10, `petmode` y `petname` actúan sobre el primer summon activo.
