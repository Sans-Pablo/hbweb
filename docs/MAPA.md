# Mapa del código

Generado por `tools/mapa.sh` (no editar a mano). Cada línea: fichero · líneas · para qué sirve (primer comentario del fichero).

## web/src/shared

- `adventure.js` · 298 · Enruta jugadores entre Aresfarm e instancias privadas. Compartido por Node y navegador.
- `appearance.js` · 15 · Equipo visible de un personaje (Client/Game.cpp, DrawObject_On*; Server: bEquipItemHandler -> m_sAppr2..4).
- `attributes.js` · 140 · Atributos de los objetos que caen (NpcDeadItemGenerator, _AdjustRareItemValue, bEquipItemHandler).
- `combat.js` · 98 · Combate (iCalculateAttackEffect y compañía, HGServer/Game.cpp:52318+).
- `const.js` · 67 · Constantes del juego compartidas por la simulación (el futuro servidor) y el cliente.
- `data.js` · 16 · Datos del juego (generados por tools/convert.py a partir de los .cfg del servidor).
- `drops.js` · 113 · Botín al morir un monstruo: NpcDeadItemGenerator (HGServer/Game.cpp:47297).
- `dungeon.js` · 252 · Cripta de esqueletos: niveles que bajan de uno en uno (1..DUNGEON_LEVELS).
- `grid.js` · 36 · Rejilla del mapa: casillas bloqueadas (del .amd) y ocupación por personajes.
- `inventory.js` · 143 · Mochila, equipo y efectos del equipo (CalcTotalItemEffect, bEquipItemHandler...).
- `items.js` · 27 · Constantes y reglas puras de los objetos (HGServer/Item.h, Game.cpp).
- `magic.js` · 96 · Magia: fórmulas del servidor original (PlayerMagicHandler, Effect_Damage_Spot, bCheckResistingMagicSuccess).
- `mobtiming.gen.js` · 3 · Generado por tools/convert_frames.py desde Client/MapData.cpp: no editar a mano.
- `path.js` · 71 · A* en 8 direcciones con montículo binario.
- `rarity.js` · 30 · Rareza del botín (propia del port; los atributos y los objetos salen del original).
- `rules.js` · 82 · Fórmulas del servidor original (HGServer/Game.cpp). Funciones puras: reciben el
- `skills.js` · 43 · Habilidades (Skill.cfg, CalculateSSN_*): maestría 0..100 que sube con el uso.
- `world.js` · 267 · Simulación del juego: el papel del servidor (HGServer). No sabe nada de dibujo ni del

## web/src/shared/systems

- `arena.js` · 380 · Arena de apuestas. INVENTO del port (sin equivalente en el original); usa lo que sí existe: el NPC de ciudad "Kennedy"
- `bosses.js` · 269 · Mecánicas únicas de los jefes de la cripta. INVENTO del port (el original no tiene jefes de mazmorra); los números van aquí.
- `bot.js` · 271 · BOT: jugador simulado (INVENTO del port, herramienta de admin). Vive en el mundo como un jugador más (kind "player", mochila, equipo,
- `citizens.js` · 29 · Habitantes de las ciudades (tendero, herrero, almacenero, mago...): NPC pacíficos que no se mueven ni se pueden atacar.
- `combatsys.js` · 203 · Golpes, daño, experiencia y muerte de jugadores y monstruos.
- `companion.js` · 249 · Compañeros (clase Cazador). INVENTO del port, sin equivalente en el original; se apoya en lo que sí existe:
- `debug.js` · 125 · Herramientas de prueba (F1 → «Herramientas»). INVENTO del port: no existen en el original. Solo funcionan con DEBUG.enabled
- `dummy.js` · 220 · Dummy: summon de apoyo ÚNICO del port (INVENTO: no existe en el original; usa el NPC "Dummy" de NPC.cfg y los hechizos de Magic.cfg).
- `fields.js` · 92 · Objetos dinámicos de los hechizos de campo (CheckDynamicObjectList / DynamicObjectEffectProcessor):
- `ground.js` · 27 · Objetos en el suelo: hasta 12 por casilla, el último en caer queda encima (Map.cpp bSetItem / pGetItem).
- `itemsys.js` · 138 · Recoger, tirar, equipar y usar objetos (iClientMotion_GetItem_Handler, DropItemHandler, UseItemHandler).
- `magicsys.js` · 307 · Lanzar y aprender hechizos.
- `npcsys.js` · 368 · Monstruos: aparición en sus generadores, IA, ataque, muerte y botín.
- `party.js` · 116 · Grupos (party), como el original. Cliente: Client/Game.cpp (DlgBoxClick_Party, DrawDialogBox_Party, DEF_NOTIFY_PARTY, GetExp en el servidor)
- `player.js` · 167 · Jugador: creación, guardado, recalculo de atributos, reaparición.
- `schools.js` · 49 · Escuelas de magia de los summons. INVENTO del port (petición del diseñador); los hechizos son los de Magic.cfg tal cual.
- `shopsys.js` · 214 · Tienda, herrero y almacén (HGServer/Game.cpp): RequestPurchaseItemHandler, ReqSellItemHandler,
- `status.js` · 24 · Estados mágicos (m_cMagicEffectStatus + eventos de liberación diferida del servidor original).
- `talents.js` · 138 · Árbol de talentos y hechizos del compañero. INVENTO del port (sin equivalente en el original); los hechizos son los de Magic.cfg
- `tutorial.js` · 174 · Tutorial para jugadores nuevos. INVENTO del port (el original no tiene tutorial): guion de diálogos (lore + mecánicas básicas),
- `vitals.js` · 49 · Vida, maná, resistencia y hambre (CheckClientResponseTime, TimeHitPointsUp, TimeStaminarPointsUp).
- `weather.js` · 47 · Hora del día y clima de cada mundo (HGServer/Game.cpp: _CheckDayOrNight / WhetherProcessor).

## web/src/client

- `accounts.js` · 49 · Cuentas locales (la prueba es de un jugador y sin servidor): nombre + contraseña.
- `anim.js` · 74 · Qué sprite y qué fotograma toca dibujar para cada entidad en cada momento.
- `assets.js` · 233 · Carga de datos y gráficos, y funciones para dibujar sprites con su pivote
- `audio.js` · 207 · Sonido: efectos originales (SOUNDS/*.wav) con volumen y panorámica según la distancia,
- `bundles.js` · 92 · Qué recursos hacen falta en cada mapa (carga bajo demanda). Sin DOM: se prueba desde Node.
- `classicdialog.js` · 76 · Cuadro de diálogo con el formato clásico de Helbreath (marco de madera "gamedialog_1" fotograma 2, texto en tinta oscura,
- `compicon.js` · 64 · Icono de las bolas de compañero: un sprite pequeño de la especie (reposo, de frente) sobre la bola de Item.cfg.
- `connection.js` · 295 · Conexión con el "servidor". Dos implementaciones con la misma forma:
- `controller.js` · 211 · Entrada del jugador -> intenciones -> órdenes al servidor.
- `create.js` · 127 · Pantalla de creación de personaje (UpdateScreen_OnCreateNewCharacter del cliente original):
- `devtools.js` · 76 · F1 → «Herramientas»: panel de pruebas (crear objetos y enemigos, subir niveles, saltar de mapa...). Manda órdenes `dbg` a la simulació
- `dialogs.js` · 479 · Cuadros de diálogo del cliente original (Game.cpp, DrawDialogBox_*). Cada uno: { id, x, y, w, h, draw(g, me, world), click(g, x, y, me) }
- `dungeon-choice.js` · 24 · Decisión de juego al volver a la cripta con progreso guardado: continuar donde se quedó o reiniciar desde el nivel 1.
- `fx.js` · 180 · Efectos visuales del cliente: números de daño, avisos flotantes, chispas.
- `gui.js` · 528 · Interfaz del cliente original dibujada sobre un lienzo de 800x600 (los sprites salen de
- `hud.js` · 325 · Interfaz en HTML encima del lienzo. Cambia de aspecto con el modo (clase en <body>):
- `i18n.js` · 286 · Idiomas: español (el texto del código) e inglés. `t(texto)` traduce el texto en español a inglés cuando el idioma es "en";
- `imgurl.js` · 8 · WebP opcional: tools/to_webp.py genera data/**/*.webp (sin pérdida) y data/webp.json; esos binarios NO se versionan.
- `loadinfo.js` · 13 · Pantalla de carga: versión de la compilación (data/version.json) y últimas novedades (data/news.json), para saber qué se está probando.
- `look.js` · 88 · Aspecto del personaje: piel y género (cuerpo), ropa interior y peinado con su color.
- `main.js` · 677 · Arranque del cliente web: carga datos, crea el mundo (el "servidor" local), conecta
- `mobile.js` · 231 · Modo móvil (invento del port): controles táctiles y menús para pantallas pequeñas.
- `names.js` · 10 · Nombres y sprites de los objetos (los datos vienen de Item.cfg / ItemName.cfg).
- `news.js` · 59 · F1: novedades, lista de pruebas y notas para los testers (data/news.json). Sustituye a la ayuda original.
- `npcdialogs.js` · 602 · Cuadros de diálogo de los NPC de ciudad, como en el cliente original (Game.cpp):
- `party.js` · 107 · Cuadro de grupo (Party), id 32: DrawDialogBox_Party / DlgBoxClick_Party del cliente original (Client/Game.cpp) con sus textos (LAN_ENG.H).
- `petdialog.js` · 97 · Cuadro «Summons» (F10 y botón de la barra, entre Personaje y Mochila): todo lo de la bola/compañero en un sitio.
- `renderer.js` · 725 · Dibujo del mundo. Dos modos sobre la misma simulación, como Diablo II Resurrected:
- `sky.js` · 86 · Cielo del cliente: noche (G_cSpriteAlphaDegree), lluvia (DrawWhetherEffects / WhetherObjectFrameCounter de Game.cpp)
- `spellfx.js` · 440 · Efectos de hechizos del cliente original (Game.cpp: bAddNewEffect, bEffectFrameCounter, DrawEffects).
- `streaming.js` · 96 · Descarga bajo demanda con cola de prioridad (como hacen los juegos actuales con sus "bundles"):
- `tutorial.js` · 289 · Tutorial para jugadores nuevos (cliente). Guion y estado en shared/systems/tutorial.js; aquí se detectan los objetivos y se dibuja:
- `voice.js` · 269 · "Personalidad" del jugador y de los habitantes: frases ocasionales en burbujas de chat.

## server

- `accounts.mjs` · 57 · Cuentas del servidor online: usuario + contraseña (scrypt con sal propia). Nada de contraseñas en claro, nunca.
- `admin.mjs` · 38 · Texto de ayuda de administración y página del panel (/admin, solo desde el PC del servidor).
- `server.mjs` · 513 · Servidor online de Helbreath Web (Node.js, sin dependencias).
- `store.mjs` · 69 · Almacén persistente del servidor: SQLite (node:sqlite, Node >= 22.5) en vez de reescribir un JSON entero cada 30 s.

## tests

- `arena.test.mjs` · 173 · Arena de apuestas: simulación, cuotas con margen de la casa, combate en directo y cobro. node tests/arena.test.mjs
- `assets.test.mjs` · 100 · Decodifica las hojas RGBA reales, incluidos los filtros PNG. Sin dependencias de navegador.
- `bag-stack.test.mjs` · 29 · Pociones apilables: se juntan por id, el uso gasta una unidad y la partida antigua se fusiona al cargar.
- `bosses.test.mjs` · 112 · Mecánicas únicas de los 4 jefes de la cripta (shared/systems/bosses.js). node tests/bosses.test.mjs
- `bossloot.test.mjs` · 29 · Cada rey suelta siempre un único de Item.cfg. node tests/bossloot.test.mjs
- `bot.test.mjs` · 55 · BOT: jugador simulado. Entra en el grupo del admin, caza, sube de nivel, se equipa y recoge botín con las mismas órdenes que un cliente.
- `bow.test.mjs` · 49 · Arco (HGServer/Game.cpp iClientMotion_Attack_Handler + iCalculateAttackEffect): dispara a cualquier distancia, gasta una
- `combat.test.mjs` · 115 · Fórmulas de combate contra HGServer/Game.cpp iCalculateAttackEffect (jugador -> monstruo).
- `companion.test.mjs` · 85 · Compañeros: obtención en la tienda, selección, estadísticas compartidas, experiencia, guardado.
- `data.test.mjs` · 50 · Coherencia de los datos generados (web/data): lo que un conversor deja a medias suele romper el juego mucho después.
- `debug.test.mjs` · 37 · Herramientas de prueba (F1 → Herramientas): órdenes dbg.
- `dummy.test.mjs` · 155 · Dummy: summon de apoyo único (3 clases, radio por nivel, auras por nivel, MASS, reflejo de agro). Solo afecta al grupo.
- `dungeon.test.mjs` · 185 · 
- `ghost.test.mjs` · 56 · Esqueleto fantasma: un esqueleto común puede levantarse al desaparecer su cadáver. node tests/ghost.test.mjs
- `i18n.test.mjs` · 20 · Idiomas: el texto en español se traduce al inglés cuando se elige "en" y vuelve a español al cambiar.
- `loot.test.mjs` · 72 · 
- `magic-prep.test.mjs` · 40 · Elegir un hechizo en el libro empieza la animación de lanzar; el clic lo suelta sobre el objetivo.
- `magic-types.test.mjs` · 65 · Tipos de hechizo con estados: paralizar, hielo, escudo, invisibilidad, campos, veneno, línea.
- `maps.test.mjs` · 59 · Ciudad de Aresden: teletransportes entre mapas (teleport-loc del servidor original).
- `mobile.test.mjs` · 35 · Modo móvil: funciones puras (detección, auto-ataque inicial, joystick, objetivos cercanos). node tests/mobile.test.mjs
- `net-bot.test.mjs` · 29 · El admin invoca un bot en el servidor real: el bot aparece como jugador, entra en el grupo y se mueve con él.
- `net-dungeon.test.mjs` · 103 · Dos clientes reales: transición, aislamiento y reconexión, con 80 ms de latencia.
- `net-persist.test.mjs` · 22 · Cuenta y personaje nuevos sobreviven a matar el servidor de golpe (SIGKILL) nada más entrar.
- `net-walk.test.mjs` · 35 · Ritmo de pasos con servidor real y latencia: mide cuántas veces el servidor corrige la posición.
- `online.test.mjs` · 147 · Servidor online real (server/server.mjs): cuentas, sesiones, mundo compartido, privacidad, chat, administración y persistencia. node tests/
- `party.test.mjs` · 88 · Grupos: invitar/aceptar/rechazar/cancelar, límite de 8, reparto de experiencia, retirarse y disolución, chat de grupo.
- `pets.test.mjs` · 81 · Hospital de compañeros, modo paz/ataque, Ctrl+Q (objetivo), compañero caído y manuales de habilidad.
- `recall.test.mjs` · 42 · Botón Recall: canaliza 3 s, se cancela al moverse o entrar en combate, y tiene enfriamiento. node tests/recall.test.mjs
- `remote-smooth.test.mjs` · 30 · Suavizado de pasos de otros jugadores online (connection.js: smoothRemote). node tests/remote-smooth.test.mjs
- `schools.test.mjs` · 110 · Escuelas de magia de los summons: el jugador lanza, el summon de la escuela paga y tira; sin regeneración (caramelo azul); cambio al nivel 
- `shop.test.mjs` · 81 · Tienda, herrero y almacén: compra, venta, reparación y depósito con las reglas del servidor original.
- `sim.test.mjs` · 159 · Prueba de la simulación sin navegador: un "jugador" automático caza en la granja.
- `sky.test.mjs` · 72 · Hora del día, clima y zonas sin ataque (HGServer/Game.cpp: _CheckDayOrNight, WhetherProcessor, _SetupNoAttackArea).
- `store.test.mjs` · 46 · Almacén SQLite: persistencia, solo filas cambiadas, importación de los JSON antiguos, historial y restauración.
- `streaming.test.mjs` · 57 · Carga bajo demanda: qué recursos pide cada mapa y que no se baja lo que no hace falta.
- `summon-size.test.mjs` · 62 · Compañeros: tamaño por etapas (niveles 10/25/40/50), aviso y re-invocación con efecto al cruzar un nivel de cambio.
- `summon.test.mjs` · 23 · Summon Creature (Game.cpp ~18660): seguidor según Magery, límite magery/20, ataca monstruos, sin experiencia ni botín.
- `talents.test.mjs` · 61 · Árbol de talentos del compañero (3 ramas), hechizos del compañero y jugador sin magia.
- `tutorial.test.mjs` · 131 · Tutorial: guion íntegro (es+en), estado en la partida, concesiones y recorrido completo del flujo del cliente. node tests/tutorial.test.mjs
- `voice.test.mjs` · 65 · determinista por nombre
- `version_web_test.py` · 35 · 

## tools

- `build_dungeon_palette.py` · 122 · (mapa, tema): las cámaras de cada rey usan el escenario de otro dungeon del original (ver convert_theme_maps.py)
- `convert.py` · 291 · número de monstruo de "spot-mob-generator" -> nombre en NPC.cfg (HGServer/Game.cpp)
- `convert_all.py` · 43 · 
- `convert_equip.py` · 53 · objetos en suelo y mochila: todas las hojas
- `convert_frames.py` · 20 · 
- `convert_fx.py` · 22 · 
- `convert_maps.py` · 111 · tipo de spot-mob-generator -> (monstruo de NPC.cfg, prob. de habilidad especial %, tipo de habilidad): Game.cpp del servidor
- `convert_mobs.py` · 57 · sonido base por sprite (Monsters.ts: states.move.sound = 'M<n>.mp3')
- `convert_npcs.py` · 52 · pak, clave de sprite, nombre en NPC.cfg
- `convert_players.py` · 23 · 
- `convert_talk.py` · 18 · 
- `convert_theme_maps.py` · 42 · 
- `convert_ui.py` · 27 · paperdoll del diálogo de personaje: item-equipM / item-equipW (15 hojas cada una) y colgantes de item-pack
- `e2e.py` · 75 · 
- `export_skeleton.py` · 31 · 
- `hdup.py` · 38 · 
- `make_crypt_assets.py` · 147 · ---------------------------------------------------------------- puerta
- `mkvoice_companion.py` · 41 · 
- `mkvoice_fear.py` · 83 · 
- `mkvoice_phases.py` · 63 · evolve: línea al volver a invocar al compañero tras cambiar de tamaño (niveles 10, 25, 40, 50 = pasos 1..4)
- `remaster_music.py` · 203 · 
- `serve.py` · 75 · 
- `tile_table.py` · 24 · (archivo .pak, índice inicial, cantidad)
- `to_webp.py` · 25 · 
- `upscale_equip.py` · 18 · 
- `upscale_hd.py` · 33 · 
- `version_web.py` · 28 · 

