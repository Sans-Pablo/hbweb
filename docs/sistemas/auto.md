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

## Reglas por rareza, pociones y exp (0.85.19)
- `a.rules[rareza]` ∈ ignore|sell|store (rareza 0 normal, 1 mágico, 2 raro, 3 único; por defecto sell, sell, store, store). «Ignorar» deja el objeto en el suelo; «vender»/«guardar» lo recogen.
- Mochila llena: si hay algo que vender va a la tienda y manda `selllist` (≤12 por tanda), luego retoma la caza; si no, guarda con `deposit` en el almacén; almacén lleno (MAX_BANK) o nada que vender/guardar → termina con aviso.
- `a.potions` (ON por defecto): con poca vida bebe una poción de vida de la mochila; si no tiene, para.
- `ctl.auto.exp` (0.85.23) se mide por fotograma con `trackExp` (delta de `me.exp`, con acarreo al subir de nivel); no depende del evento `exp`. `AutoMini` extiende `MiniWin` (`client/miniwin.js`) y muestra «Reiniciar» al detenerse; la mini ventana lo muestra. F5 reabre la mini ventana si hay una caza (o la última) y estaba cerrada.
- Test: `tests/autoplay.test.mjs`.

## 0.85.70
- Llena = ≥47 huecos, peso ≥90 % de `maxLoad` o recogida fallida (`a.full`). Va a vender; `sellList` se prefiltra con `sellValue` (descarta cannot 1/2) y repite por tandas mientras `a.full`. Al quedar sitio se limpian `skip`/`tries`.
- Muerte: `decide` no para en hunt; `Controller.update` manda `respawn` a los 2,5 s y la caza retoma (viaTeleport a la zona).
- `AutoMini.resume`: «Continuar» conserva kills/exp/tiempo acumulado; «Reiniciar» pone a cero.
- `MiniWin`: bola inferior izquierda = transparente/opaca (`clear`), asa inferior derecha = redimensionar (`setSize`, 170-520 px).

## v0.85.71
- Equipo roto (life 0, categorías 1-10): corre al herrero y manda `repairall`; tras 3 intentos fallidos se desiste (`noRepair`).
- Los envíos de venta/guardado se espacian `SEND_GAP_MS` (700 ms) para no gastar los reintentos de `a.bad` antes de la respuesta del servidor.

## v0.85.73
- `a.worn` recuerda el equipo puesto (`trackWorn`); `brokenGear`/`damagedGear` salen de ahí.
- Un solo viaje: herrero (`repairall` con `uids`, también gastado si `full` y hay oro), tienda (tandas de 12, seguimiento de envíos) y almacén (`sends`, varios depósitos).
- Aviso único en el log (`saidCant`) si algo no se puede vender o reparar.
