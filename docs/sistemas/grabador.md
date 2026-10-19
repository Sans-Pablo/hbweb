# Grabador de partidas (v0.85.67)
`server/recorder.mjs` graba el 100 % de las sesiones de jugadores reales (no bots, no observadores) en `server/data/replays/<fecha>_<nombre>_<pid>.jsonl`.
Líneas: `h` cabecera (nombre, mapa, nivel, stats) · `c` orden enviada (`w` = tiempo de mundo) · `s` foto cada 250 ms (propio: pos, hp, mp, nivel, arma, objetivo, modo combate; `near`: entidades a ≤14 casillas) · `e` evento de combate que le afecta (damage, miss, crit, spell, attack, castfail, death…) · `m` cambio de mapa.
Ganchos en `server.mjs`: `recorder.cmd` tras ejecutar cada orden y `recorder.tick` tras `drainEvents`. No cambia protocolo ni simulación. Se cierra al apagar el servidor.
Uso previsto: analizar PvP real (huida por vida, distancia de ataque, hechizos, cómo acorralan a magos) para afinar los genes y tácticas de los bots. Test: `tests/recorder.test.mjs`.

## Acciones admin (v0.85.81)
`Debug.run` (debug.js) toma una foto del jugador antes y después de cada orden `dbg` y emite `{t:"dbgact", id, op, cmd, before, after, change}`; el grabador lo guarda como `{k:"e", w, ev:{t:"dbgact",…}}`. `before/after`: lvl, exp, pool, gold, st (stats), hp/mhp, mp/mmp, sp/msp, god, fm, free. `change`: solo los campos que cambiaron, `{campo:[antes,después]}` (cada stat va como `st.vit`…). Los replays anteriores solo tienen la orden `dbg` sin valores.
Análisis: `node tools/replay-analisis.mjs [fichero|carpeta|filtro]` (por defecto «zzzz»): resumen por replay y lista ADMIN/DBG; los saltos de HP/MP máximos sin orden admin a ≤3 s (y que no sean subida de nivel) salen como «SIN orden admin cercana». Test: `tests/bot-mana-dbgact.test.mjs`.
