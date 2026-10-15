# Modo automático (/auto)

INVENTO del port (Olympia tenía auto-caza; el original no). Lógica pura en `shared/systems/autoplay.js`, ejecutada solo en el cliente (`Controller.update`): emite las mismas intenciones que un clic (`attack`, `pickup`, `move`), así que el servidor valida cada paso y no hay cambio de protocolo.

- `/auto hunt <criatura>` (alias de orders.js: slime, orcos…): ataca a la presa de ese tipo más cercana (≤ 40 casillas); sin presas recoge el botín a ≤ 7 casillas (lo que no cabe se salta tras 3 intentos); para con vida < 35 %, al morir o tras 20 s sin presas ni botín.
- `/auto run <almacén|tienda|herrería|mago|granjero|hospital|hechicero de mascotas>`: camina hasta el habitante más cercano de ese tipo (NPC.cfg: Warehouse Keeper 20, Shop Keeper 15, BlackSmith 24, Magician 19; el resto por `role`) y abre su diálogo. Si no hay en el mapa, avisa y para.
- `/auto stop`, cualquier clic o clic derecho lo cancelan.
- Test: `tests/autoplay.test.mjs`.

## Menú AUTO (v0.84.11)
- Botón AUTO en el diálogo 1 → ventana id 74 (`client/autowin.js`, registrada en main.js). Pestañas «Cazar» e «Ir a…». Empezar llama a `ctl.setAuto({kind:"hunt", mob, zone:{map,rect}})`; los destinos, a `{kind:"run", place}`.
- Caza con zona: fuera del mapa o de la zona (rect ± ZONE_PAD) viaja primero (`viaTeleport`: granja ↔ edificio por su teletransportador); ignora presas fuera de la zona. Con ≥ BAG_MAX objetos (o `auto.full`) vuelve a FARM_HOME y TERMINA el ciclo con aviso; vaciar en el almacén y repetir NO está hecho.
- `approach(w, me, e)`: casilla a ≤2 del habitante con camino más corto (salta bloqueadas y ocupadas); si no hay, para con aviso. `run farm` anda a FARM_HOME.
- La ficha usa `drops.js dropInfo(type)` y NPC.cfg; el sprite sale de `mobSprite` (8 direcciones, 1,8 s cada una).
- Test: `tests/autoplay.test.mjs`.

## v0.85.5: pozos, contador, almacén
- `auto.nopick` (casilla del menú, no en `/auto`): `decide` se salta el bucle de botín. `auto.kills` lo suma main.js con `death` (`by` = pid, sin mascotas); la mini ventana id 75 (`AutoMini`) lo muestra con tiempo y ritmo.
- Zona = spawn de arefarm.spawns.json: se muestra «Pozo id · criatura (rect)».
- Almacén: `viaTeleport` ordena entradas por longitud de `findPath`; controller.js pasa `avoid` (casillas de `w.teleports`) al andar en auto (reintenta sin él); `approach` descarta casillas de teletransporte.
