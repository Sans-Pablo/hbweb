# Salidas del mapa (ticket 6)
INVENTO del port (no existe en el original). `renderer.js` `drawTeleportMarks`/`teleportGroups`: agrupa los teleports del mapa por destino y componente contigua, y rotula cada grupo con `MAP_NAMES` (adventure.js) + «(cerrado)» si el destino no está en `ALLOWED_MAPS`. Fuera de pantalla: flecha en el borde; minimapa: marca azul (abierto) o marrón (cerrado).
Online: `MirrorWorld.teleports` se rellena en `connection.js` `onState` desde `meta.teleports` del mapa.
Test: `tests/exits.test.mjs` (todo destino de teleport de la granja tiene nombre).
