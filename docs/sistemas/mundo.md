# Mundo: mapas, cielo, música, zonas sin ataque

Código: `shared/adventure.js` (mundos), `shared/world.js` (`safeAt`, cielo), `shared/systems/weather.js`, `shared/systems/citizens.js`,
`client/sky.js` (noche, lluvia, pista de música). Datos: `web/data/maps/*.json|bin` (de `tools/convert_maps.py`).

## Mapas
- Un `World` por mapa estático (`staticWorld(id)`), creado al entrar el primer jugador; la granja (`arefarm`) y una cripta procedural por jugador.
- `meta` de cada mapa: `teleports`, `initial`, `npcs` (con waypoints), `spawns`, `noAttack`, `fixedDay`, `location`.
- NPC de ciudad: ver [tiendas.md](tiendas.md). Faltan por portar Kennedy, William, Guard-Aresden, Devlin, Perry y los muñecos de práctica (Dummy, Attack-Dummy).
- Teleports a mapas no exportados todavía: 2ndmiddle, CmdHall_1, dglv2, huntzone2, middled1n, middleland (`tests/data.test.mjs` los lista).

## Cielo (`Game.cpp`: _CheckDayOrNight, WhetherProcessor)
- Noche (`dayOrNight = 2`) cuando el minuto del reloj es >= 40 (DEF_NIGHTTIME). Los mapas con `fixedDay` son siempre de día y sin clima. El reloj es opcional: sin reloj siempre es de día (pruebas deterministas); el cliente pasa `new Date().getMinutes()`.
- Clima: cada 20 s con 1/300 empieza lluvia ligera/media/fuerte (1..3) durante 3 + 1d7 minutos. Eventos `time` y `weather`.
- Efectos: el acierto del arco baja un 5/10/25 %; las armas cuerpo a cuerpo se gastan más.
- Cliente: la noche oscurece y enfría la imagen con fundido; lluvia con el efecto 11 (600 gotas como máximo, 1/5, 1/2 o todas), sonido E38 en bucle, E31/E32 al cambiar de hora.
- Pruebas locales (chat): `/time day|night|auto`, `/weather 0-3`.
- Pendiente: nieve (clima 4–6, solo con nieve activada en el mapa) y luces nocturnas de Navidad.

## Música (`StartBGM`)
Pista según el `location` del mapa: aresden → `aresden`, elvine, dglv/middled1/maze → `dungeon`, middleland/infernia → `middleland`, druncncity, abaddon; el resto `MainTm`. La cripta usa `dungeon`.
Convertidas hasta ahora: MainTm, aresden y dungeon (original y remasterizada). Con `tools/remaster_music.py` se hacen las demás cuando se porten sus mapas.

## Zonas sin ataque
`World.safeAt(x, y)`: rectángulos `noAttack` del mapa (-10 = todo el mapa) y las 20 casillas del borde (iGetAttribute devuelve -1 allí). Un hechizo de ataque (categoría 1) no se lanza desde una casilla así (`_PlayerMagicHandler`).
