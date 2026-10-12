# Futuro (aplazado a propósito)

Lo que sigue **no se hace ahora**. Está anotado para no perderlo.

## Sonido
- Rediseño del sistema de sonido (audio.js): hoy los efectos se eligen por tipo de evento; falta un mezclador con prioridades, distancia/paneo y límite de voces.

## Combate
- Críticos / súper ataque, ataque en carrera (dash), Firebow, Direction-Bow.
- Retroceso en monstruos con `actionLimit 4`.
- Reputación, zonas de lucha y habilidades especiales.

## Tutorial
- Cámara al destino y resaltado del objetivo.
- Tutorial de la cripta y capítulo de elección de bando.

## Arena (apuestas entre summons)
Aplazada entera para no añadir complejidad. Estado actual:
- El NPC Kennedy **ya no se coloca** en la tienda general (`gshop_1f`), y el tutorial ya no tiene el paso de la arena.
- El código se conserva sin uso: `systems/arena.js`, el mapa de arena en `adventure.js`, el diálogo de `npcdialogs.js`, `tests/arena.test.mjs` (que coloca a Kennedy a mano) y `docs/sistemas/arena.md`.
- Para reactivarla: volver a añadir `{ name: "Kennedy", x: 55, y: 43, role: "arena", skin: "Howard" }` a `EXTRA_CITIZENS.gshop_1f` y el paso `arena` del tutorial.

## Mundo (no entra por ahora)
Nieve, luces de Navidad, NPC Kennedy/William/Guard-Aresden/Devlin/Perry/muñecos y mapas de Elvine.
