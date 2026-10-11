# Puestos de jugador (v0.52.0)

Los jugadores abren un puesto de venta en `gshop_1f`, `wrhus_1f` y `bsmith_1f` (`systems/stall.js`).

- `/puesto` (o `/stall`): elegir objetos de la mochila, precio por unidad y título; máximo 8 objetos, 1 puesto por jugador, 12 por mapa.
- El puesto es una entidad `citizen` (skin Howard, `role "stall"`) junto al dueño. Los objetos salen de la mochila (depósito) hasta cerrar.
- Compra: clic en el puesto (a ≤4 casillas), clic en la fila; Ctrl compra la pila. **Comisión 0**: el oro va al puesto y el dueño lo recoge con "Recoger oro".
- El puesto sigue abierto sin el dueño (AFK) y se persiste en `saves["sys:stalls"]` (`adventure.stallDb`). Cerrar devuelve objetos y oro.
- Comandos: `stallopen`, `stallview`, `stallbuy`, `stalltake`, `stallclose`. Protocolo `NET_PROTO` = 7. Eventos `stall` y `stallsale`.
- Test: `tests/stall.test.mjs`. Pendiente: que los bots abran puestos y compren (`stallsOf` listo).

## Habitantes (v0.54.0)
- `stallAI` (`systems/residents.js`): cada 4–9 min libres, si un habitante tiene ≥3 objetos sobrantes (`stallSurplus`, vía `judge`/`stallable`), viaja a `gshop_1f`, abre puesto (rótulo propio, precio ≥ 2× venta NPC ±), vuelve a la granja y más tarde regresa a recoger oro/cerrar. Se aborta a los 120 s o si lo reclutan. `manage` no vende los 8 mejores sobrantes de un habitante (`stallKeep`).
- Test: `tests/residents-stall.test.mjs`. Pendiente: que los bots compren en puestos.
- **Puerta libre**: el puesto no se abre a ≤8 casillas de un teletransporte (`Stall.DOOR_GAP`); los puestos de los bots se apartan a más de esa distancia.
