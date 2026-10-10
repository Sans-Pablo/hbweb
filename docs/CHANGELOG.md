# Changelog

Registro de cambios del port, del más reciente al más antiguo. Se actualiza en cada entrega junto con `web/data/news.json` (lo que ven los testers con F1) y `web/data/version.json`.

## 0.40.0 · Servidor más fácil y rápido (2026-10-10)

- `Iniciar servidor.bat` + `tools/iniciar.ps1` (modos online y rápido, sustituye a servidor-online.ps1 y multijugador.ps1; los .bat antiguos lo llaman). A* con arrays tipados (`path.js`, `tests/path.test.mjs`), recálculo de rutas de bots limitado, estado propio solo si cambia (`server.mjs`), `tools/bench.mjs`.

## 0.39.0 · El libro es del summon (2026-10-10)

- `learn` enseña al summon elegido (comp.spells); coste de Int/oro/maná normalizado por nivel de hechizo (`schools.js`); acierto por nivel del summon. Sin documentación nueva hasta una versión estable.

## 0.38.0 · Panel de estados (2026-10-10)

- Panel de estados con DR/MR, buffs, auras y estados con temporizador y efecto; `e.aura` incluye ahora regeneración, estamina, maná y el nombre del Dummy.

## 0.37.0 · Arena y Dummies con carácter (2026-10-10)

- Arena rehecha (combates cortos, críticos, movimientos, hechizos de escuela, comentarios, experiencia y premio), Dummy con carisma/báculo/auras/resurrección, voz de Dummies y bots, estamina original, marco de grupo reubicado. Documentación pendiente hasta una versión estable.

## 0.36.0 · Summons al estilo Pokémon (2026-10-10)

- **Protocolo 4** (`NET_PROTO`): los jugadores y summons envían su maná (`mp`, `mm`) para los marcos de grupo.
- **Libro de magias**: solo muestra las magias de la escuela del summon elegido (vacío sin summon de escuela). Cada magia lleva el nivel que necesita el summon (las compradas de la escuela, ordenadas por maná, se reparten del nivel 1 al 50; la especie superior las desbloquea al 80 %) y el servidor rechaza cualquier magia que no sea de la escuela.
- Las magias de escuela las da el summon: no hay que aprenderlas en la torre del mago y no fallan por la habilidad del jugador (probabilidad 100 %).
- **Maná visible**: barra de maná del summon junto a su vida (barra inferior) y marcos de grupo con tu personaje, cada miembro (vida y maná) y su summon (apodo, raza, nivel, tipo —escuela, clase de Dummy o combate—, vida y maná).
- **Poder por nivel**: el daño de las magias del summon crece con su nivel (×0,6 al 1 → ×1,4 al 50) y su maná también; al nivel 50 lanza las mejores.
- **Comando**: al lanzar, el summon se gira hacia el objetivo, hace el gesto y dice el nombre de la magia sobre su cabeza.
- **Dummy de aura**: nuevas **Vampiric Aura** (nivel 25: parte del daño de los aliados vuelve como vida, hasta 8 %) y **Resurrection** (nivel 40: levanta a un aliado caído en su radio, Magic.cfg 94; recarga 3 min, menos por rango).

## 0.35.0 · Bots, caramelos y manual (2026-10-10)

- **Bots** (`systems/bot.js`, F1 → Bots): jugadores simulados que entran en tu grupo (o cazan sueltos), siguen al dueño por mapas y criptas, atacan con A*, beben pociones, comen, recogen botín, reparten puntos, se equipan por catálogo y suben de nivel. Funcionan igual en local y en el servidor online. Ficha `docs/sistemas/bots.md`.
- **Hospital de compañeros**: nueva pestaña **Caramelos** (rojo 60, azul 90, verde 400 de oro).
- **Optimización**: el servidor serializa cada entidad, la lista de objetos y los campos una sola vez por tick y mundo (antes, una por cliente); el dibujado ya no crea arrays temporales por fotograma.
- **Manual del jugador** de la primera versión: `docs/MANUAL.md`.

## 0.34.0 · Escuelas de magia (2026-10-10)

- Escuelas (`systems/schools.js`): Orc/Demon = fuego, Tentocle/Frost = hielo, Cannibal-Plant/Liche = rayo. Los hechizos de ataque de la escuela (atributo de Magic.cfg + tipo ofensivo) solo salen con el summon de esa escuela fuera: lo lanza él (el efecto sale del summon) y paga con SU maná.
- Los summons de escuela tienen el doble de maná y NO lo regeneran; se recupera con caramelos azules (también con la bola guardada, el maná viaja con la bola).
- Curar, escudos y berserk (tipos 2, 11, 18) ya no los lanza el jugador: son del Dummy. Los summons normales pierden todos los talentos con hechizo (combate únicamente); Frenzy potencia los hechizos de escuela.
- Cambio de escuela (hospital, Gail): un Orc/Tentocle/Cannibal-Plant de nivel 50 se cambia por Demon/Frost/Liche de nivel 1 (mismo nombre): +50 % vida, +60 % maná, +25 % daño. Las especies superiores no se compran.
- Nuevas bolas de prueba: Tentocle y Cannibal-Plant. El summon guardado se desvanece en 1 s.
- Tierra/sin elemento y utilidades (Recall, Summon, Create Food…) siguen siendo del jugador.

## 0.33.1 · Dummy más callado y más fuerte (2026-10-10)

- El anillo del área del Dummy se dibuja por debajo de los personajes.
- Los Dummies no hablan: solo muestran sobre su cabeza la magia o aura que usan (`dummy-cast`); se mantiene el aviso corto de que un monstruo los ataca.
- Aura más fuerte: porcentajes ×1,6 por nivel (rango 5, nivel 50: 5 %/s de vida, 4 %/s de maná, +40 % exp, -30 % daño) y una casilla más de radio.

## 0.33.0 · Caramelos, sonido y órdenes (2026-10-10)

- Sonido: el interruptor de música y los volúmenes de efectos y música del menú del sistema (F12) ahora funcionan; la música tiene su propio on/off y volumen (`audio.js`: `setMusic`, `setMusicVolume`).
- Caramelos (Item.cfg 780/781/782): ya no curan al jugador; rojo = vida del compañero, azul = maná, verde = revive al inconsciente (a mitad de vida). Se usan con doble clic (compañero elegido) o arrastrados sobre una bola de la mochila (`companion.candy`).
- Alt + clic derecho: el compañero va a esa casilla y se queda allí (vuelve a seguirte si te alejas más de 14 casillas; `petgo`).
- Dummy: el área de efecto se muestra como el anillo de subida de nivel, del color de su clase, en lugar de un cuadrado relleno.

## 0.32.1 · Nombre de la bola en el suelo y bola del Dummy (2026-10-10)

- Online: las bolas en el suelo llevan su especie, nombre y clase en el paquete de objetos; antes el cliente solo veía el objeto base y mostraba «Pearl» en vez de «Cyclops Ball».
- La bola del Dummy en la mochila se tiñe del color de su clase.

## 0.32.0 · Dummy de apoyo (2026-10-10)

- Nuevo compañero único «Dummy» (ficha `docs/sistemas/dummy.md`): frágil, no ataca, 3 clases (Healer verde, Buffer amarillo, Aura azul) que se fijan con la primera magia, área de efecto 1→6 casillas según el nivel, solo para el grupo y sus summons, MASS, auras proporcionales al nivel, reflejo de agro con aviso hablado y modo Stay/Follow.
- Nuevo estado Protection From Magic. Pestañas del cuadro Summons adaptadas a las clases del Dummy. Test `tests/dummy.test.mjs`.

## 0.31.0 · Grupo en acción (2026-10-10)

- Ctrl+P invita al jugador bajo el cursor (o al más cercano) y entra al grupo sin preguntar ni mirar el modo de paz (`partyreq` con `auto`).
- Al elegir a quién invitar, los cuadros Personaje y Grupo se ocultan hasta el clic (`gui` admite `hidden`).
- Marcos de grupo a la izquierda estilo WoW: barra de vida de cada miembro y, debajo, la de su compañero (`gui.partyFrames`).
- Los compañeros que desaparecen (guardados en la bola, cambio de mapa) se desvanecen en vez de borrarse de golpe.
- Último nivel antes de evolucionar: el compañero late y brilla cada vez más rápido según su progreso (`evoK`, protocolo `ek`). Al evolucionar: animación estilo Pokémon (crece, encoge, crece, encoge con brillo blanco y queda grande).
- Herramientas de administración/pruebas (F1 → Herramientas) abiertas a todos en el servidor (`HB_DEBUG=0` las apaga).

## 0.30.1 · Atributos, círculos y respawn (2026-10-10)

- Repartir muchos puntos de atributo a la vez ya funciona: el cliente manda una sola orden `stat` con `n` (antes eran decenas de mensajes y el límite por segundo del servidor descartaba el resto). `NET_PROTO` = 3.
- Ctrl+1…9 y Ctrl+0 abren el libro de magia en el círculo 1…10.
- Al morir se abre el cuadro del sistema original (diálogo 19) con su botón Restart; desaparece el cartel propio.

## 0.30.0 · Party en la cripta (2026-10-10)

- Cripta compartida: los miembros de una party entran a la misma cripta, bajan de nivel juntos y la cripta se descarta cuando sale el último (`adventure.js`, clave de grupo). Test en `tests/dungeon.test.mjs`.
- Arena: en los duelos no se puede atacar, lanzar magia, recoger ni dar órdenes a mascotas (cliente y servidor).
- Girar con el botón derecho vuelve a funcionar en el modo online (giro predicho en `NetConnection`).
- Nombres como el cliente original (`DrawObjectName`/`DrawNpcName`): nombre en blanco con sombra y debajo la condición (Traveller, Criminal, (Enemy), (Friendly)); los monstruos solo al pasar el ratón.

## 0.29.1 · Arreglo de guardado (2026-10-10)

- Servidor: el personaje nuevo se vuelca a SQLite al crearlo (`persist(true)`); antes esperaba al temporizador de 5 s y un cierre brusco lo perdía. Test `tests/net-persist.test.mjs`.

## 0.29.0 · Personajes persistentes (2026-10-10)

- Servidor online: cuentas y partidas en SQLite (`server/store.mjs`, `server/data/hb.sqlite`, WAL + `synchronous=FULL`). Guardado cada 5 s solo de lo que cambió y al desconectarse; copias en `history` (24 por personaje, cada 10 min como mucho y al salir). Admin: `versions <cuenta>` y `restore <cuenta> <n>`. Importa solos los `accounts.json`/`saves.json` antiguos (quedan como `*.migrated`). Sin `node:sqlite` (Node < 22.5) cae al JSON con aviso. Test `tests/store.test.mjs`.

- Inicio siempre en Aresfarm (65,75) (`player.addPlayer` usa `w.home`). Arena Master con la skin de William (`citizens.skin`). Mascotas con nombre y nivel (`renderer`). Opción `groundInfo` (info y precio del suelo). Gandlf en la tienda general (`EXTRA_CITIZENS`). Eliminada la puerta dibujada de la cripta (`cryptdoor`): se usa `cryptpit`.

## 0.28.0 · Party y magia (2026-10-10)

- **Party** (`shared/systems/party.js`, `client/party.js`, diálogo 32): invitación por clic, aceptar/rechazar/cancelar, retirarse, lista, máx. 8, reparto de experiencia entre miembros vivos del mismo mapa (`GetExp`; con 8 el doble), chat `$`, «, Party Member», disolución con 1 miembro, salida al desconectar. Grupo compartido entre mapas (`hooks.party`). Test `tests/party.test.mjs`. Sin fuego amigo que filtrar: PvP aún no existe.
- **Magia del jugador activa** (`MAGIC_MODE = { free: false, player: true }`): aprender (Int + oro), maná, probabilidad de fallo; Summon Creature (tipo 9) habilitado. Opción «Magia libre» eliminada.
- Servidor: sin límite de cuentas por IP (`registers` inerte; `maxRegistersPerHour` ya no existe).

## 0.27.0 · Bolsa y clásico (2026-10-10)

- Recall y muerte: `w.home` = Aresfarm (65,75) (`adventure.js`, `player.respawn`).
- Pociones HP/MP/SP apilables (`items.isStack`), uso gasta una unidad, fusión de partidas antiguas al cargar; test `tests/bag-stack.test.mjs`.
- Arrastre robusto: `pointerup` global, cancelación al perder foco, liberación de objetos «desactivados» colgados (`npcdialogs.sweep`).
- `hud.effectLine`: descripción de ADDEFFECT (protección elemental, ahorro de maná…); etiquetas del suelo con atributos y precio (`shopsys.sellPriceOf`).
- Cripta: puerta de salida nueva (`tools/make_crypt_assets.py`), info de nivel como texto clásico en inglés (`gui.dungeonInfo`), summon sin tinte y con sprite en el minimapa; bola de summon caído en grises.

## 0.26.0 · Evolución de summons (2026-10-10)

- **Summons: tamaño por etapas** (`companion.SIZE_STAGES` 10/25/40/50, `sizeStep`; `renderer.petScale`): el compañero cambia de tamaño a saltos en vez de crecer poco a poco (los pequeños nacen al 70 %).
- **Cambio de tamaño = evento**: al cruzar el nivel se emite `companion-evolve` (aviso) y 2,5 s después `evolveCompanion` lo vuelve a invocar (`companion-resummon`, público en el servidor) con efecto: anillos, chispas violeta/doradas, «Summon Creature» original (Magic.cfg 31) y entrada con rebote (`fx.popScale`). Frases nuevas por etapa en `voice.json` (`companion.evolve`, `tools/mkvoice_phases.py`).
- **Minimapa**: oculto dentro de tienda, herrería y almacén (`gshop_1f`, `bsmith_1f`, `wrhus_1f`).
- **Tirar lo equipado**: se puede arrastrar fuera del cuadro Personaje para soltar un objeto que llevas puesto (set Hero/Knight, etc.); el servidor lo desequipa.
- **Tutorial**: los cuadros Personaje y Mochila ya no tapan el mensaje de Gandlf ni el objetivo (`gui.avoidOverlap`: 46/47 cuentan como obstáculo y apartan lo ya abierto).
- Test nuevo: `tests/summon-size.test.mjs`.

## 0.25.3 · Cuentas sin límite en pruebas (2026-10-10)

- `server/config.json → maxRegistersPerHour` (por defecto 5 por IP y hora; `0` = sin límite). Tras el túnel los jugadores pueden compartir IP, así que en pruebas se pone a 0. Solo servidor.

## 0.25.2 · Movimiento online suave (2026-10-10)

- **Otros jugadores online se mueven con fluidez**: los estados llegan a 20 Hz con jitter (túnel ngrok, wifi) y cada paso arrancaba al llegar, lo que producía paradas y saltos. Ahora los pasos de los demás se muestran con un retardo fijo de 120 ms (`REMOTE_DELAY`), se encadenan entre sí y un «parado» que llega antes de acabar el paso visible no lo corta (`smoothRemote` en `client/connection.js`). Mi propio personaje no cambia (predicción). Test: `tests/remote-smooth.test.mjs`.

## 0.25.1 · Online con ngrok (2026-10-10)

- **Corrección**: ngrok gratis intercala una página de aviso (ERR_NGROK_6024) sin cabeceras CORS, que impedía que el cliente de GitHub Pages detectase el servidor (`findServer`, `/api/info`). Ahora el cliente envía `ngrok-skip-browser-warning` (el servidor ya lo permitía en CORS).
- Instalador de Windows (`tools/instalar-online.ps1`): ngrok por descarga directa, script solo ASCII.

## 0.25.0 · Modo online (2026-10-09)

- **Servidor online real** (`server/server.mjs`, protocolo `NET_PROTO` 2): cuentas con usuario + contraseña (`server/accounts.mjs`, scrypt), un personaje por cuenta (nombre único), progreso por cuenta en `server/data/` (escritura atómica), sesión única (la nueva expulsa a la vieja), mundo compartido (granja, ciudad, tiendas, arena en directo; criptas privadas), estado propio completo (`ownState`: tutorial, talentos, compañeros, bolsa…), equipo visible de los demás (`shared/appearance.js`, `ap`), cielo/clima/campos/efectos de jefe sincronizados, eventos privados por defecto (`PUBLIC`).
- **Seguridad**: límites de intentos, cuentas, conexiones, mensajes y chat; orígenes permitidos (CORS y WebSocket); inactividad; el panel solo desde el propio PC.
- **Administración**: comandos de chat para cuentas `admins`, consola del servidor y panel `/admin` (jugadores, expulsar, silenciar, bloquear, anunciar, guardar, reiniciar).
- **Cliente** (`NetConnection`, `findServer`): se conecta a la dirección de `web/data/server.json` (o `?server=`), pantalla de entrada con cuenta y creación de personaje online, aviso de desconexión con motivo, vuelta a modo local si el servidor está apagado (`?offline=1` lo fuerza).
- **Alojamiento**: `Servidor online.bat` + `tools/servidor-online.ps1` (ngrok o Tailscale Funnel con dirección fija), guía `docs/ONLINE.md`, ficha `docs/sistemas/online.md`, `server/config.example.json`.
- Tests: `tests/online.test.mjs` (en CI vía `tools/test.sh`); `net-walk` y `net-dungeon` adaptados a las cuentas. `net-walk` usa el puerto 18123.

## 0.24.0 · Modo móvil (2026-10-09)

- Nuevo `client/mobile.js`: detección (`isMobile`, `?mobile=1/0`), auto-ataque activado la primera vez (`initMobileOpts`), capa DOM con barras, joystick, botones de acción, menú ☰, ✕, zoom táctil y aviso de giro. `gui.js` modo `mobile` (lienzo a pantalla completa, escala que ajusta el cuadro abierto, un cuadro cada vez). `index.html` responsive. Tutorial adaptado (`mobileFixed`). Minimapa reducido (`renderer.miniSize/miniTop`). Ficha `docs/sistemas/movil.md`, test `tests/mobile.test.mjs` (en CI).

## 0.23.0 · Tutorial de bienvenida (2026-10-09)

- Nuevo sistema de tutorial: `shared/systems/tutorial.js` (guion de 18 pasos con lore y mecánicas, es+en; estado `p.tut` en la partida; concesiones: limo de práctica, botín, 400 monedas y recompensa final, estas dos solo una vez) y `client/tutorial.js` (cuadro de conversación con cara + texto, rastreador de objetivos con flecha, saltar tutorial/paso, Espacio/Intro/clic). Orden `tut`, evento `tutorial`. `/tutorial`, `/tutorial off` y botón «Repetir tutorial» en Opciones. Partidas antiguas: terminado. Ficha `docs/sistemas/tutorial.md`, test `tests/tutorial.test.mjs`.

## 0.22.0 · Arena con habilidades (2026-10-09)

- Corredor de apuestas: ahora **Kennedy** en `gshop_1f` (ya no McGaffin ni Aresfarm). Apostar teletransporta al mapa de arena `huntzone1` (`ARENA.field`/`watch`, sin monstruos), el combate se ve allí y se vuelve a la tienda al acabar. Eliminado el cuadro dibujado en el suelo (`renderer.drawArena`).
- `simulate` usa todas las habilidades aprendidas (curas, escudos, Berserk, Fire Ball/Lightning/Meteor Strike, Fortitude, maná y enfriamientos) para el compañero y el retador; el retador gasta todos sus puntos de talento. Eventos `spell` en directo.
- Tests: `tests/arena.test.mjs` (habilidades y viaje).

## 0.21.0 · Miedo en la cripta (2026-10-09)

- Diálogos de miedo en la cripta de esqueletos (`tools/mkvoice_fear.py` → `voice.json` `fear`, 5 etapas por nivel de cripta): entrada, charla, monstruo/jefe/fantasma avistado, kills, poca vida, charla y ataques del compañero. `client/voice.js` (`fearStage`, `fear`). Test en `tests/voice.test.mjs`.
- Las bolas de compañero ya no se consiguen por muertes: solo en la tienda (Gail). Eliminados `HUNT`, `killsFor`, el contador `p.hunt` en `onKill`, `?hunt=N` y el aviso del HUD.

## 0.20.1 · Publicación estable (2026-10-09)

- `net-dungeon.test.mjs`: la aserción de «A ve esqueletos» dependía del trazado del nivel (radio de interés) y el límite de 30 s rozaba la duración real (~29 s): ahora comprueba que todo npc visible es esqueleto y el límite es 90 s. Fallaba en CI (v0.19.2 y v0.20.0 no se publicaron).

## 0.20.0 · Arena de apuestas (2026-10-09)

- Nuevo `shared/systems/arena.js`: NPC McGaffin (`role arena`) + arena en Aresfarm, apuestas por el compañero o el retador, simulación previa con cuotas (margen 10 %), combate en directo con gladiadores reales y cobro; apuesta pendiente persistida. Cuadro 44 en `npcdialogs.js`, `renderer.drawArena`, comandos `arenainfo`/`arenabet`. Ficha `docs/sistemas/arena.md`, test `tests/arena.test.mjs`.

## 0.19.4 · Música y color de la cripta (2026-10-09)

- `trackFor`: mapas `dungeon` → pista `darkloop` (`web/data/music/darkloop.mp3`, aportada por el usuario; la `.remaster` es copia idéntica).
- `renderer.drawEntity`: monstruos de la cripta con tinte 0.14 del color del rey del tramo (`ceil(nivel/5)`); el jefe conserva 0.5.

## 0.19.3 · Botín usable (2026-10-09)

- `CRYPT_LOOT` (drops.js): tabla de la cripta por tramos de 5 niveles con objetos de Item.cfg usables por un guerrero nivel 50; filtro `usable()` global; variante por sexo. Test en `loot.test.mjs`.

## 0.19.2 · Protección al 50 y 90 % (2026-10-09)

- `PROT_OVERRIDE`: 638/642 → 50 %, 645/643 → 90 % (sustituye al 80 % de 0.19.1).

## 0.19.1 · Collar de fuego al 80 % (2026-10-09)

- `PROT_OVERRIDE`: 638 KnecklaceOfFirePro reduce el 80 % del daño de fuego (Item.cfg: 25).

## 0.19.0 · Botín que importa (2026-10-09)

- Botín escalado por nivel de cripta, único garantizado por rey (Item.cfg), protección elemental (ADDEFFECT 7/9/10/11) y rareza visible. Ficha: `docs/sistemas/botin.md`. Tests `loot` y `bossloot`.

## 0.18.4 · Bajada contra la pared (2026-10-09)

- `generateLevel` (v7): la bajada/final se coloca contra pared al norte (3 casillas de pared, suelo al sur); si el mapa pequeño no tiene, se levanta la pared. Test en `dungeon.test.mjs`.
- Login: `loadinfo.js` solo muestra la versión (sin registro de novedades).

## 0.18.3 · Escalera contra la pared (2026-10-09)

- `generateLevel`: la salida se busca entre todas las casillas libres con pared al oeste (antes solo entre las de 3x3 libre, que nunca tocan pared): 573 de 600 niveles de prueba.

## 0.18.2 · Cuevas y puertas (2026-10-09)

- Revertidos los escenarios por rey (v0.18.1): `STAGE_THEMES` todo «cueva» y paleta solo con middled1n/x (630 KB). El código y `tools/convert_theme_maps.py` quedan por si se reactivan.
- Bajada = sprite `cryptpit` (hueco con escalera y losa de arefarm, `tools/make_crypt_assets.py`); salida = `cryptdoor` en una casilla con pared al oeste. Reparto de esqueletos más tolerante.

## 0.18.1 · Escenarios por rey (2026-10-09)

- Cada tramo de 5 niveles usa el escenario de otro dungeon original (`stageTheme`): fuego = dglv4, sombra = Toh1-3, hielo = icebound, oro = maze. `tools/convert_theme_maps.py` convierte los mapas y las hojas; `tools/build_dungeon_palette.py` guarda recortes de 90x90 por mapa y tablas de borde por tema (`themes`).
- Puerta de salida/bajada en zonas abiertas (r 3). Fantasmas: 20 % de EXP, sin botín; bajar exige no quedar enemigos vivos ni fantasmas pendientes. `streaming.js` pide las hojas por nivel.

## 0.18.0 · Fantasmas, Summons y Recall (2026-10-09)

- Esqueleto común → «Fantasma skeleton» (25 %, 30 % de opacidad) al desaparecer su cadáver (`npcsys.killNpc`, `w.ghostsPending` retiene la limpieza del nivel). Test: `tests/ghost.test.mjs`.
- Rey dorado ×1,44 (20 % más que los otros jefes). Cripta: todas las puertas dibujan el sprite `cryptdoor` (sin aros).
- Barra: icono de garra (`summons_icon`) y botón Recall (`recall` en `world.js`, 3 s / 60 s; test `tests/recall.test.mjs`). Herramienta `tools/make_crypt_assets.py`.
- Summons: ventana movible (ClassicDialog devuelve false en huecos), sprite caminando + nombre, EXP (también en el panel junto a la barra), botones Support/Damage/Warrior/Info, margen `mx`.
- Alt + clic ordena atacar al summon (`pettarget` con `tn`), diálogos por etapa/especie/hitos (`tools/mkvoice_phases.py`). Quitados Ctrl+0..9, Ctrl+Q y Gandlf. Mensaje al vender.

## 0.17.0 · Jefes con mecánicas (2026-10-09)

- Los 4 reyes esqueleto tienen mecánicas propias (`shared/systems/bosses.js`, ficha `docs/sistemas/jefes.md`): brasas, huesos, rugido, salto, drenaje, clones, suelo helado, congelación, escudo con cristales, fases, contador de furia y reflejo. Test: `tests/bosses.test.mjs`.
- F1 → Herramientas: «vida del jefe». El hielo ralentiza a los jugadores (+50 % por paso).

## 0.16.0 · Summons y tiendas (2026-10-09)

- Botón «Summons» en la barra (entre Personaje y Mochila; sustituye al libro de hechizos) y F10: cuadro `client/petdialog.js` (id 43) con Info, renombrar, modo, reinicio y las 3 ramas. Sustituye al cuadro 42.
- `ClassicDialog`: la ayuda sale en una zona fija abajo (ya no flota junto al ratón); filas más altas; sin solapes.
- `ALLOWED_MAPS` recupera `gshop_1f`, `bsmith_1f` y `wrhus_1f`. Gail vive dentro de `gshop_1f`.
- Se eliminan `FARM_PORTAL`, `MIDDLE_PORTAL` y `DUNGEON_ENTRANCES`. El teletransportador de la granja a middled1n entra directo a la cripta (`Adventure.teleport` → `enterCrypt`, portal sintético `mid-entry`).
- Pantalla de carga y de entrada: versión y novedades (`client/loadinfo.js`).

## 0.15.0 · Herramientas de prueba (2026-10-09)

- F1 → Herramientas: panel con órdenes `dbg` (nivel, oro, objetos, enemigos y jefes, ir a mapas/cripta, summons y talentos, cielo). Ficha: `docs/sistemas/herramientas.md`. El servidor las desactiva salvo `HB_DEBUG=1`.

## 0.14.0 · Cripta fiel al original (2026-10-09)

- Los niveles de la cripta son ventanas recortadas de middled1n/middled1x (paredes, suelos y antorchas originales); sin agua; el sello del corte usa teselas de borde elegidas por máscara y por adyacencia observada en el original. `build_dungeon_palette.py` empaqueta los mapas (v3). Se eliminan los trazados rectangulares inventados.

## 0.13.2 · Summons que crecen (2026-10-09)

- El tamaño del summon crece linealmente con su nivel: mitad de altura al nivel 1 (solo los más altos que el personaje) y tamaño real al 50.

## 0.13.1 · Lista de pruebas completa (2026-10-09)

- F1 «Para probar» cubre ahora todas las funciones del juego (~50 casillas nuevas).

## 0.13.0 · Summons con talentos (2026-10-09)

- **Los summons son lo principal**: aportan hasta el 90 % del daño del dueño y hasta el 150 % de su vida; matan por el dueño (mitad de experiencia para cada uno) y **dejan botín**. Si caen hay que pagar caro en el hospital.
- **Árbol de talentos del summon** (F10, `ClassicDialog` id 42): 3 ramas — *Support*, *Damage*, *Warrior* — con 18 talentos; 1 punto por nivel del summon; cada fila exige puntos en su rama; la rama con más puntos fija la especialidad (estadísticas de clase). Reiniciar cuesta 50 × nivel de oro, junto a la enfermera.
- **Los summons lanzan hechizos** de `Magic.cfg` (Heal, Great Heal, Defense Shield, Great Defense Shield, Fire Ball, Lightning, Berserk, Meteor Strike) con maná propio y fórmulas originales; *Taunt* y *Fortitude* propios del port.
- **El jugador ya no tiene magia** (cast/learn/prepare rechazados).
- Nivel máximo 50 (jugador y summon). Solo existen pociones pequeñas (Red/Blue/Green): las Big/Super/Power no se venden ni caen.
- Solo se puede viajar a Aresfarm, la cripta de esqueletos y Middle Dungeon (middled1n).
- Rey esqueleto carmesí: Fire Field a su alrededor cada 20 % de vida perdida, inmune al fuego, deja siempre un hueso de esqueleto rojo; ve de lejos y ya no se queda quieto.
- Nombres: el summon solo muestra su nombre; el usuario lo renombra (clic en el nombre del panel o `/petname`); el personaje lo llama por su nombre a veces y solo habla con él si está a menos de 8 casillas.
- Los tintes (dye) de pelo, ropa, armadura y arma funcionan; apilar objetos con Mayús ya no desplaza la posición.
- Nueva clase base `ClassicDialog` (`client/classicdialog.js`): formato clásico de Helbreath para todos los cuadros nuevos (hospital y talentos ya la usan).
- Documento de cambios (este).

## 0.12.0 · Hospital de compañeros (2026-10-09)

- Enfermera Gail, bolas a 1 de oro, caído hasta revivir (caro), modo paz/ataque, barra y miniatura del summon, Ctrl+Q, tamaño reducido, manuales de habilidad y nombre real en la venta.

## 0.11.0 · Cripta de esqueletos de 20 niveles (2026-10-09)

- Teselas de `middled1n/x`, jefes cada 5 niveles, progreso por jugador, entrada desde middled1n (100,85); nombres aleatorios de summons; esqueleto con su sprite original.

## 2026-10-09 (historial de commits)

- Personalidad elegida al crear el personaje (tono de voz y mascota) v0.10.4
- Compañeros: aggro, penalización de muerte, bolas con color/tamaño, nombre al hover, diálogos con la mascota, arreglo de recoger objetos (v0.10.3)
- Interfaz: los cuadros evitan solaparse al abrirse y los bocadillos esquivan etiquetas (v0.10.2)
- Compañeros: 10 muertes por bola en la build de pruebas (v0.10.1)
- Cazador: sistema de compañeros (bolas por muertes, stats compartidas, experiencia) v0.10.0
- Versión y nombre de la build junto a los fps (data/version.json)
- Voz: personalidad del personaje y respuestas de los habitantes (burbujas, pits, tiendas)
- Hojas del cuerpo para el ataque con arco (grupo 7) y regla: datos generados se versionan siempre
- Arco como el original (flechas, alcance, animacion), clic derecho en el suelo solo gira, F1 = novedades y pruebas (sin ayuda original)
- WebP sin perdida opcional para sprites y fx (binarios generados fuera de git)
- Carga bajo demanda: streaming de sprites por mapa, mapas y fx lazy, prefetch de sonidos, service worker
- Correcciones de interfaz (cursor, doble clic al desequipar, minimapa, Mayús agrupa, oro en la mochila), resistencia más generosa e idiomas español/inglés
- docs: estado de la pasada de fidelidad
- Mapas de Middleland, Dungeons y Huntzones; habilidades especiales 1-8 de monstruos con explosivos
- Summon Creature: seguidores que atacan monstruos; ficha de magia
- Retroceso por golpes de 40+ y monstruos sin sombra según el original
- NPC de ciudad restantes (William, Kennedy, McGaffin, Perry, Devlin, Gail): sprites y fichas
- Monstruos: 45 tipos con sprites, sonidos y fichas (tabla de los repos de referencia); tiempos y fotogramas por tipo desde MapData.cpp
- Conversación con los NPC de la ciudad: textos originales (contents15x) y diálogo 21
- Cielo: día y noche por reloj, lluvia con efectos y sonido, música por lugar, zonas sin ataque; documentación del mundo
- Tubería de datos única (convert_all.py) y test de coherencia de datos
- Combate: furia, escudos de defensa, protección de flechas, armas con bonus y contraataque como el original; test de combate y ficha
- CLAUDE.md, FINDINGS.md y ficha de tiendas
- Esc cierra el cuadro de NPC de más arriba; gui y npcUi accesibles para pruebas
- Cliente de los NPC de ciudad: tienda, herrero, almacén y mago (diálogos, clic, arrastre)

## 2026-10-08 (historial de commits)

- NPC de ciudad (tendero, herrero, almacén, mago) y reglas de compra, venta, reparación y almacén del servidor original
- Ciudades y mapas del servidor Aresden con teletransportes; el lanzar magia ya no hace caminar al personaje
- Integrar caminata remaster del esqueleto en ocho direcciones
- Animaciones de hechizos portadas (hielo, rayos, meteoro, curas, escudos, ventisca...), sprites de efectos 87-151, sin requisito de Int/maná
- Cursor clásico, menú de mejoras, HP/MP/SP, bolsa sin objetos apilados, magia libre
- Modo pruebas: todos los hechizos sin coste de maná
- Efectos de hechizos: hielo (viento helado, lanza, tormenta) y meteoro
- Magia: paralizar, hielo, escudos, invisibilidad, veneno, campos de fuego/nube/tormenta, rayos lineales, recall, comida y más tipos del servidor original
- HD: terreno, árboles y equipo reescalados; suelo pregenerado al doble de resolución en remastered
- Elegir tierra y roca sin bordes de pasto para los suelos de la cripta
- Cripta v3: instancias persistentes y exploración con rutas curvas
- Conservar instancias de cripta y añadir salas variadas, curvas y ramales
- Equipo visible en el personaje: armas, armaduras, escudos, cascos, capas y botas originales
- Sprites HD (reescalado 4x) para personajes, monstruos y objetos; creador sin retardo y más grande; ataque vuelve a 500 ms entre golpes
- Restaurar seguimiento de cámara del personaje junto a los bordes de la cripta
- Documentar fase 2 (interfaz, magia, efectos)
- Magia: lanzar al elegir en el libro, animaciones de hechizos originales (EFFECT.PAK), sonidos E/C, stats al arrastrar, clic derecho cierra, sin créditos
- Versionar el grafo ESM al desplegar para evitar código antiguo en caché
- Mejorar el contraste de esqueletos y limitar la cámara a la cripta
- Ataque sin pausa entre golpes y ataque automático opcional (/auto)
- Añadir vista de prueba de la cripta sin modificar partidas
- Merge PR #2: cripta amplia con texturas y encuentros corregidos
- Ampliar la cripta y corregir suelos negros, carga de sprites y encuentros iniciales
- Skill, texto/ayuda e historial de chat originales
- Level up (12), menú del sistema (19) y botones del diálogo de personaje originales
- Diálogos de magia (F7, Ctrl+0..9) y tienda de magia (16) originales
- Inventario original (F6): posiciones libres, arrastrar y soltar, doble clic, comando setpos
- Diálogo de personaje original (F5): sprites DialogText, muñeco con equipo, estadísticas
- Panel inferior original (GameDialog2): barras HP/MP/SP/exp/hambre, iconos y marco de diálogos 800x600
- Teclas y ratón como en el cliente original (F1-F12, Ctrl+..., clic derecho ataca, magia con puntería)
- Creación de personaje: atributos 10-14, plantillas, género, piel, peinado, color de pelo y ropa interior; sprites de personaje bajo demanda
- Merge pull request #1 from Sans-Pablo/feature/skeleton-dungeon-v1
- Use opaque original pavement frames throughout dungeon floors
- Add instanced procedural skeleton dungeon accessible from Aresfarm
- Login con cuentas locales y guardado del personaje (exportar/importar copia, cerrar sesión)
- Panel de personaje: bonos secundarios del equipo (acierto, defensa, recuperaciones, absorción, exp, oro...)
- Atributos de los objetos que caen: generación, efectos, textos y pruebas
- Magia: libro de hechizos (K), lanzar con clic derecho, efectos y pruebas
- Docs: especificación de ítems y estado del proyecto
- Ítems originales: inventario, equipo, peso, absorción, botín del servidor, habilidades, resistencia y hambre
- Menú de opciones y mapa superpuesto estilo Diablo II
- Quitar movimiento por teclado (fiel al original)
- Primera versión
