# Modo online (servidor en el PC del anfitrión)

Código: `server/server.mjs` (servidor), `server/accounts.mjs` (cuentas y límites), `server/admin.mjs` (panel), `web/src/client/connection.js` (`NetConnection`), `main.js` (`findServer`, `askNameAndJoin`), `web/src/shared/appearance.js` (equipo visible), `NET_PROTO` en `shared/const.js`. Guía de uso: `docs/ONLINE.md`. Test: `tests/online.test.mjs` (+ `net-walk`, `net-dungeon`).

## Arquitectura
- **La misma simulación** (`shared/`) corre en el servidor a 20 Hz con todo el mundo compartido (granja, ciudad, tiendas, arena); las criptas siguen siendo una instancia privada por jugador. El cliente es un espejo (`MirrorWorld`) que predice sus propios pasos/golpes y se corrige con el estado del servidor.
- **Descubrimiento** (`findServer`): `?server=URL` > `data/server.json {"url"}` > mismo origen (`/api/info`). Si el servidor configurado no responde → modo local con aviso. `?offline=1` fuerza local.
- **Protocolo** (`NET_PROTO`, ahora 2), por WebSocket `/ws`:
  `auth{mode,name,pass,proto}` → `authok{hasChar,admin}` · `join{create?}` → `welcome{id,time,returning}` · `cmd{seq,cmd}` · `ping` · servidor: `s` (estado), `msg`, `error{code}`, `kicked`.
- **Estado `s`**: entidades que cambian (`e`), las que desaparecen (`g`), eventos (`ev`), objetos del suelo (`it`), mapa (`map`), cielo/clima (`sk`), campos mágicos y efectos de jefe (`fx`). Para el propio jugador `o` lleva su estado completo (mochila, magia, talentos, tutorial, compañeros…: `ownState`); para los demás `ap` (equipo visible, `shared/appearance.js`) y `lk` (aspecto).
- **Privacidad**: solo los eventos de `PUBLIC` (efectos y sonidos) llegan a quien está cerca; el resto con `id` es de su dueño. Un evento nuevo es privado por defecto.
- **Cuentas**: usuario 3–16 (`[\p{L}\p{N}_-]`), clave 6–64, scrypt; personaje único por cuenta (nombre único del servidor, mismas reglas que local). Progreso en `server/data/saves.json` (escritura atómica, cada 30 s y al salir).
- **Límites**: ver `docs/ONLINE.md` (intentos, cuentas, conexiones, mensajes, chat, inactividad, orígenes).
- **Administración**: comandos de chat (cuentas `admins`), consola y panel `/admin` (solo loopback y sin cabeceras de túnel).

## Pendiente / límites conocidos
- Un único servidor y un único proceso; sin recuperación de clave por correo (el admin usa `resetpass`).
- El chat es del mapa (como en local); no hay susurros ni gremios.
- PvP no existe todavía: la simulación local no lo tiene.
- Los scripts de Windows (`tools/servidor-online.ps1`) y los túneles ngrok/Tailscale no se han podido probar en el entorno de desarrollo.

## Suavizado de movimiento remoto (0.25.2)
`smoothRemote` (client/connection.js): los pasos de otros jugadores se muestran `REMOTE_DELAY` (120 ms) tarde y encadenados; un «parado» en el destino no corta el paso visible. Solo afecta a la vista de los demás; el propio personaje sigue con predicción. Test: `tests/remote-smooth.test.mjs`.
