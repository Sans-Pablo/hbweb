# Observador: paneles, estadísticas globales y summons (v0.77.0)
- Layout: 4 huecos (`#s1..#s4`) donde se elige entre `game, roster, info, stats, glob, summ`; se guarda en `localStorage` (`hb.obs.panels`).
- `systems/obsstats.js`: `ask` (peticiones de los bots-testers, una por clave), `requests`, `globals` (clases, arquetipos, bandos, mapas, bloqueados) y `summons` (top con dueños). Servidor: `GET /api/stats` (solo HTTP, no cambia `NET_PROTO`).
- Panel de summons: clic en una fila abre su ficha; clic en el dueño lo selecciona. El mapa de cada miembro de party se muestra por nombre. Nombre del summon enemigo en rojo (renderer).
- Test: `tests/obsstats.test.mjs`.

## Desde GitHub Pages (0.79.7)
`dashboard.js` resuelve el servidor igual que `main.js` (`?server=` > `data/server.json` > mismo origen) para `/api/bots` y `/api/stats`, y reenvía `?server=` al marco del juego.

## 0.85.63
- Panel 💬 Preguntas (qaInit en dashboard.js), aprobar todo, Ctrl+Enter, hechas plegadas, filtro PvP.
