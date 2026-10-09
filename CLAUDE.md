# hbweb — port web de Helbreath

Port fiel del Helbreath original al navegador. Una sola regla manda: **el código original es la especificación**
(`/root/HelbreathServer`: `Client/Game.cpp`, `HGServer/Game.cpp`, `Files/*.cfg`, `Helbreath/{SPRITES,MAPDATA,SOUNDS,MUSIC,CONTENTS}`).
Antes de inventar una fórmula, un texto, una posición de interfaz o un número, se busca en el original y se cita
(función o fichero) en el comentario del código.

## Arquitectura
- `web/src/shared/*` — simulación autoritativa. Se ejecuta igual en el navegador (LocalConnection) y en Node (`server/server.mjs`).
  Nada de DOM, nada de `Math.random` (usar `w.rng()`), nada de `Date.now` (usar `w.time`).
  - `world.js` (World: ents, tick, COMMANDS), `adventure.js` (granja + criptas por jugador + mapas estáticos `staticWorld(id)`),
    `systems/*` (combatsys, magicsys, npcsys, itemsys, shopsys, citizens, player, vitals, status…).
- `web/src/client/*` — dibujado, HUD, audio, diálogos (`gui.js` + `dialogs.js` + `npcdialogs.js`). No decide reglas: manda órdenes (`conn.send`) y pinta eventos.
- `tools/*.py` — convierten los recursos originales a `web/data/`. Los datos generados (JSON y hojas PNG) se versionan siempre, también los nuevos; no se editan a mano. Única excepción: los `.webp` de `tools/to_webp.py` (copias derivadas, en `.gitignore`).
- `tests/*.test.mjs` — `node tests/<x>.test.mjs`, todos deben imprimir OK. Sin dependencias.
- Guardado en `localStorage` (prueba local) o, en el modo online, en `server/data/` (cuentas y partidas por usuario). El servidor online (`server/`) está activo: cualquier cambio en la simulación o en el estado del jugador debe seguir pasando `online.test.mjs` y `net-*.test.mjs`; un cambio de protocolo sube `NET_PROTO` (`shared/const.js`). Estado propio nuevo no necesita código de red: `ownState` manda toda la entidad; solo lo visible para los demás va en `pub()` (`server/server.mjs`) y los eventos visibles en `PUBLIC`. Guía: `docs/ONLINE.md`, ficha `docs/sistemas/online.md`.

## Reglas de oro
1. Los IDs y nombres de `Item.cfg`/`NPC.cfg`/`Magic.cfg` son autoritativos. No se inventan ni se renumeran.
2. Cualquier cambio de equipo, estadísticas o atributos de un objeto llama a `w.recalc(p)`.
3. Los eventos del servidor (`w.emit({t:…})`) llevan `id` del jugador afectado; el cliente solo reacciona a los suyos.
4. Los cuadros de diálogo nunca se cierran a sí mismos dentro de `gui.draw` (se muta el orden); usar `sweep()` por fotograma.
5. Entidades: `kind` = `player` | `npc` (monstruo hostil) | `citizen` (NPC de ciudad). La lógica hostil ignora `citizen`.
6. Textos de interfaz y mensajes de tienda: los del original (en inglés) tal cual. El resto va en español y se traduce con `client/i18n.js` (toda cadena nueva en español lleva su entrada en inglés).
7. Interfaz en coordenadas GUI 800x600 (`gui.mouse`). El mundo en píxeles de mundo (`renderer.toWorld`).
8. Cada sistema nuevo trae su test en `tests/` y su ficha en `docs/sistemas/`.
9. Sin credenciales en el repo. No se usa Shift para correr (Ctrl+R alterna).

## Comandos
- Servir: `cd web && python3 -m http.server 8123` (o `Abrir prueba web.bat`). Servidor online: `node server/server.mjs 8088` (`HB_NO_LIMITS=1 HB_DEBUG=1 HB_DATA=/tmp/x` para pruebas) y `tools/e2e.py --query "server=http://localhost:8088"` (`players(n)` para varios jugadores).
- Regenerar datos: `python3 tools/convert_all.py /root/HelbreathServer/Helbreath /root/HelbreathServer web/data [--only paso,paso] [--dry]` (pasos base, equip, fx, players, ui, maps, npcs; luego `tests/data.test.mjs`).
- Idiomas: `docs/sistemas/idiomas.md`.
- Pruebas visuales: Playwright con Chromium en `/opt/pw-browsers/chromium`.
- `window.hb` expone `world, conn, renderer, ctl, gui, npcUi` para pruebas automáticas.

## Flujo de trabajo
Trabajo directo en `main`; **una versión por petición/bloque** (no por retoque), `git pull --rebase origin main` antes de cada `push`.
Otro agente también empuja a `main`. Proceso completo y ahorro de tokens: `docs/PROCESO.md`.
- Mapa del código (no explorar a ciegas): `docs/MAPA.md` (`tools/mapa.sh`).
- Tests: `tools/test.sh` (paralelo, solo imprime fallos). Pruebas visuales: `python3 tools/e2e.py [--mobile] --eval/--tap/--shot`.
- Entrega: `tools/release.sh X.Y.Z "Nombre" "mensaje"` (exige CHANGELOG y news con la versión).

## Para los testers
F1 muestra `web/data/news.json` (novedades, lista de pruebas, notas). Cada cambio visible se anota ahí en el mismo commit (`docs/sistemas/novedades.md`).

## Documentación
`docs/ESTADO.md` estado y pendientes · `docs/FINDINGS.md` trampas · `docs/sistemas/*.md` una ficha por sistema.

## Versión visible
`web/data/version.json` ({version, name}) se muestra junto a los fps (arriba a la izquierda). Súbela en cada entrega para que los testers sepan qué build prueban.
