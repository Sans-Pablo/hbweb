# Changelog

## 0.79.8 · Sprite Tool (2026-10-12)
- `bestiario.html` pasa a llamarse «Sprite Tool». Personajes M/W (`@M`, `@W`) con piel, peinado, color, ropa interior y acciones; vista «Hojas sueltas» con todas las fuentes (sprites, players, equip, sprites_mod, fx, ui), filtro, pivote y hoja entera.

## 0.79.7 · Bestiario: original al lado (2026-10-12)
- Casilla «Original al lado» (`bestiario.html`, `bestiary.js#frame`): cada fotograma lleva a su izquierda el original. Hojas IA de tigerworm, cat y scorpion; el suavizado del alfa conserva líneas de 1 px.

## 0.79.6 · Servidor más robusto (2026-10-12)
- Copia diaria de `hb.sqlite` en `server/data/backups/` (7 días; al arrancar y cada 6 h). Si el puerto está ocupado al reiniciar, el servidor reintenta hasta 30 s en vez de caer en bucle. Test `store-backup`.

## 0.79.5 · Recado de flechas sin apuntar al aire (2026-10-12)
- Un arquero sin flechas que va a comprar deja de apuntar a monstruos durante 5 s (si no le están pegando), así no queda marcado como bloqueado. Summon lejano: el teletransporte corre aunque esté siempre ocupado peleando.

## 0.79.4 · Summons que no se pierden (2026-10-12)
- Un summon a más de 40 casillas de su dueño se teletransporta a su lado aunque esté ocupado o con una orden vieja (`npcsys.js#followerThink`). Simulación de 12 bots × 240 min con 3 semillas sin avisos de bug.

## 0.79.3 · Bots pulidos (2026-10-12)
- Recall de los bots: solo cuenta como interrupción si no les pegaban; en huida esperan el canal. Entrada a la cripta desde la granja sin depender de estar libres (`noFight`). Recados también en combate si no hay flechas; flechas antes que pociones; sin oro, el arquero suelta el arco. Detector de atascos con `stuck.last`. Test `bot-fixes`.

## 0.79.2 · Botín inteligente de los bots (2026-10-12)
- Los bots juzgan el equipo del suelo con `judge` (`lootValue`): recogen lo que equipan o guardan, y solo venden lo que paga; elijen por valor/distancia. Item level pondera cada atributo por su efecto real. Dirección fija de Tailscale Funnel. Test `bot-loot`.

## 0.79.1 · Indicador de estados de los demás (2026-10-12)
- Barras de tiempo restante sobre la cabeza de jugadores, monstruos y summons con Hold, Hielo, Confusión, Illusion, Armor Break, Inhibición o Veneno. El servidor publica `sx` en `pub()`. NET_PROTO 10.

## 0.79.0 · Summons psíquicos (2026-10-12)
- Beholder (Movimiento), Centaurus (Interferencia) y Stalker (Territorio, evolución de Giant-Frog): control y debilitación sin daño directo, lanzamiento automático. Exigen el nuevo Psychic Controller (id 9004) en la mano; cualquier clase.
- Estados nuevos: Illusion y Armor Break (+25 % daño recibido), campos sin daño, Confusion para monstruos. Panel de estados con cuenta atrás de ambos.
- Herramientas: modo «0 restricciones» (sin báculo ni tope de nivel de mascota). Mascotas un 25 % más rápidas. NET_PROTO 9.
- Test `psychic`, ficha `docs/sistemas/psiquico.md`.
## 0.78.0 · Observador de 4 paneles, artesanos y combate de rango (2026-10-12)
- Observador: 4 paneles elegibles sin recargar el juego, panel «Personajes» por clase y oficio.
- Bots: 8 artesanos (2 granjeros y 2 pescadores por bando) con puesto; los demás les compran la comida de sus summons. Los magos mantienen distancia mientras el summon lanza hechizos; los supports ya invocan su summon de apoyo.
- Controles: Shift+clic ordena al summon; Alt+clic = crítico; dash al atacar corriendo; correr por defecto (Ctrl+R alterna). Cifras de crítico/dash aproximadas (original no disponible). NET_PROTO 8.
- `release.sh` consulta el CI por curl. Fichas de 0.76.0 (summonfood, sprite-retry, audio).
- Tests `crit-dash`, `craft-stall`, `support-summon`, `mage-kite`.

## 0.77.1 · Arreglos del observador y colores de bola (2026-10-12)
- Observador: arreglada la maquetación de las 4 ranuras (antes los paneles se solapaban).
- Bolas de apoyo: verde (heal), amarilla (buff) y azul (aura).

## 0.77.0 · Observador a medida y bots con criterio (2026-10-12)
- Observador: layout con 4 paneles elegibles y guardados, estadísticas globales y peticiones de los bots (`/api/stats`), top de summons con ficha, mapa por nombre en la party, nombre rojo del summon enemigo.
- Bots: reinicio de estadísticas obligatorio una vez y de nuevo si cambia el arma clave (tope diario), clase por ítems (guerrero/cazador/invocador/apoyo); summon fuera con maná; defienden aliados y buscan el último golpe; sin flechas no disparan (compran o hacen Recall) y no cancelan el Recall; detector de bloqueos; reintento de Recall en la cripta.
- Collar del lich ahorra maná del summon. Mensajes largos de bots: hasta 10 partes.
- Tests `obsstats`, `lich-neck`, `bot-forced-respec`, `bot-arrows-allies`.

## 0.76.0 · Compañeros activos y bots con oficio (2026-10-12)
- Compañeros: cada especie lanza una habilidad activa propia en combate (maná y enfriamiento; `petskill.js`, test `petskill`).
- Bots: 2 granjeros y 2 pescadores fijos y 4 de apoyo (2 por bando) que prefieren entrenar en party (test `bot-jobs`); descansan solo en ciudad o granja (test `bot-rest`); compran y dan comida a sus summons (test `summon-food`).
- Cripta: se puede elegir el nivel de inicio entre los despejados; ya no se vuelve a pelear contra el jefe de un nivel superado (test `crypt-start`).
- Sprite negro: las hojas que fallan al cargar se reintentan solas (parcial, causa sin identificar; test `sprite-retry`). Audio: al volver a la pestaña se descartan los sonidos acumulados.
- Diálogos: Ctrl+E y Ctrl+G ya no activan atajos del explorador.
- `tools/i18n_audit.mjs` arreglado (antes tardaba minutos). `docs/ONLINE.md`: scripts de Windows y ngrok probados.

## 0.75.0 · Traducciones (2026-10-12)
- Inglés completo de lo que faltaba: chat de bots y aliados, comentarista de la arena, mensajes de guild, misiones, capítulos, observador, panel de estadísticas, descripciones de caramelos y errores de aventura (`i18n.js`, plantillas `TPL` con datos).
- Nueva herramienta `tools/i18n_audit.mjs` que lista las cadenas sin traducir.

## 0.74.0 · Cíclopes y rangos (2026-10-12)
- Los Cíclopes lanzan Fire Ball / Fire Strike a distancia, con maná propio (`npcsys.npcCast`, test `npc-cast`).
- El nombre de los objetos toma el color de su rango (mágico/raro/único) en tooltip, detalle de la bolsa y casilla (`gui.js`, `hud.js`, `main.js`).
- Las órdenes a la mascota ya usaban línea punteada (roja = atacar, clara = moverse); anotado en el backlog.

## 0.73.0 · Stats y bots (2026-10-12)
- Puntos de estadística: al perder nivel por morir se descuentan los puntos ya gastados (`lvDebt`, `combatsys.deathPenalty/giveExp`, `respec.js`); antes volver a subir regalaba puntos. Test `level-debt`.
- Bots: venden antes (la bolsa se ordena con 36 huecos libres de margen) y conservan la caña de pescar (`botitems.js`).
- Observador: las teclas F (F5 incluida) ya no refrescan la página (`dashboard.js`, `watchpanel.js`; faltaba una `\d` en el regex).

## 0.72.0 · Compañero en multijugador (2026-10-12)
- Verificado con un test de red que los demás jugadores ven al compañero invocado (nombre, nivel, dueño, vida). Sin cambios de protocolo.
- Ficha de compañeros actualizada; las habilidades por especie quedan como decisión de diseño pendiente.

Registro de cambios del port, del más reciente al más antiguo. Se actualiza en cada entrega junto con `web/data/news.json` (lo que ven los testers con F1) y `web/data/version.json`.

## 0.71.0 · Bando y pelo (2026-10-12)
- Creación de personaje: se elige el bando (Aresden/Elvine); el de Elvine empieza en Elvine Farm (`player.js`, `adventure.addPlayer`, `create.js`); test `create-side`.
- Tinte de pelo: el color se suma al píxel como `PutSpriteRGB` (antes se multiplicaba); los valores exactos de la tabla del original no están disponibles y siguen siendo aproximados.
- Test `backup` (aviso de refuerzos del guild); el vaivén ya tenía el suyo. Revisado `audio.js`: sin cambios.

## 0.70.0 · Cierre de pendientes (2026-10-12)
- Magia: Inhibición (efecto 16) impide lanzar hechizos y Confusión (31/32) hace caminar al azar la mitad de los pasos (`magicsys.js`, `status.js`, `world.js`); test `magic-pvp`.
- Bots compradores: de vez en cuando un habitante visita un puesto ajeno de `gshop_1f` y compra un objeto que puede usar, si le alcanza el oro y la carga (`residents.js`); test `residents-buy`.
- Susurros: `/to nombre texto` (o `/w`) llega a cualquier jugador conectado, con eco al remitente (`adventure.whisper`); test `whisper`.
- Arena: se quita el NPC Kennedy y el paso del tutorial; la arena completa pasa a `docs/FUTURO.md`.
- Tests: se corrige el test intermitente de residentes; el observador ya no lanza errores de consola.
- Herramientas: `tools/version_web.mjs` sustituye a la versión en Python (no hace falta Python).

## 0.69.0 · Vida de bots (2026-10-12)
- Pesca (`systems/fishing.js`): caña (105), peces vendibles y comida de mascotas carnívoras (los peces no se dan a los herbívoros).
- Descansos de los bots (`systems/leisure.js`): entre peleas pescan, cultivan, comercian, entrenan a su summon, charlan con el guild o acuden al aviso de backup de un compañero (`lz` en el cerebro: veces, oro y tiempo por actividad). Ganan oro con la pesca y la venta.
- Arco: los cazadores compran un arco y flechas, estudian arquería y disparan a distancia; las flechas no se venden.
- Mago de apoyo: la mitad de los magos compra una varita mágica, la mantiene en la mano y coleccionan Healer, Buffer y Aura con los talentos de cada clase.
- Builds: los bots copian el reparto de puntos que mejor rinde a otro de su personalidad y recomiendan el suyo al guild cuando es su mejor.
- Observador dividido: dos cuadrantes arriba y uno abajo, redimensionables; datos de la página, juego limpio.
- Sonido por arma y sexo (`client/audio.js`, el evento `attack` lleva `wt`): manos C1, cuerpo a cuerpo C2, arco C3; quejido de mujer C13 y muerte de mujer C15 (hombre C12 y C14). El código original no estaba a mano: los números son los de MapData.cpp/Game.cpp tal como los recuerda el port; revisar contra el original.
- Observador: el juego del cuadrante vuelve a tener su interfaz completa (bolsa, chat, HUD); las teclas (F6 = bolsa, etc.) se reenvían al juego en vez de actuar sobre la página; los grupos son plegables, empiezan colapsados y muestran su líder y lo que hace.
- Bots: detección de vaivén (`vaiven` en `bot.js`): si en 18 pasos solo pisan 4 casillas o menos sin llegar, descartan la meta (objetivo, viaje o paseo), se paran un momento y prueban otra cosa; al tercer vaivén seguido hacen Recall.
- Tests: `fishing`, `leisure`, `archer`, `support-bot`, `builds-peer`, `vaiven`.

## 0.68.0 · Observador dividido (2026-10-12)
- Bots: los mensajes largos ya no se cortan: se parten en varios mensajes (frases) con pausa entre ellos; el LLM puede escribir 1–2 frases (límite 230).
- Bots: socializan más en el guild (charla cada 25–70 s, responden el 70 %) y tienen memoria de lo que hablan (`res.talk`/`talkN`, entra en el contexto del LLM y sale en el cerebro).
- Observador dividido (`web/observador.html`): cuatro cuadrantes — juego en vivo (iframe; al cambiar de personaje solo se recarga ese cuadrante), plantel limpio por party, ficha del personaje (con pestaña Charlas) y estadísticas/tendencias (sparklines de HP/nivel/oro/bajas, tiempo por modo, rankings, bandos, mapas, guilds). Endpoint `/api/bots`.

## 0.67.0 · Centro de observación (2026-10-12)
- Modo observar rehecho como pantalla compartida (`client/watchpanel.js`): plantel a la izquierda con todos los habitantes agrupados por party (👑 líder) y «en solitario», con qué hace cada uno (modo, mapa/piso, vida, guild), búsqueda y filtro de bando; un clic cambia de habitante (recarga con `#observar=ID`). Barra superior con ◀ ▶ (teclas [ y ]).
- Panel «cerebro» con pestañas Resumen / Mente (personalidad, bio, todas las misiones, recuerdos) / Ficha (atributos, equipo por ranura, habilidades, historial, cripta, summon) / Social (party clicable, guild, amistades).
- Servidor: `modeOf` (residents.js) y `brainOf`/`botList` con campos nuevos (grp, lead, mode, quests, mates, equip, guild…). Solo se añaden campos: sin cambio de `NET_PROTO`. Test ampliado: `tests/bot-brain.test.mjs`.

## 0.66.0 · Criptas en disputa (2026-10-12)
- Causa de las «dos parties en la misma cripta»: (1) un bot seguidor sin party (`recruitCrypt`) abría su propia cripta con su id en vez de entrar a la de su líder; (2) quien dejaba la party dentro de una cripta privada se quedaba allí; (3) la clave de la cripta era el id de la party. Ahora el seguidor entra a la cripta del líder y `guardPrivate` saca de un piso privado a quien ya no es de la party (si todos pasan a la misma party nueva, el piso pasa a ser suyo).
- Pisos 15–20 compartidos (`SHARED_FROM` en adventure.js): un único mundo por piso para Aresden y Elvine, con PvP (`w.pvp`, `map.shared`). Baja la party (o el jugador solo) y los rivales se quedan; se necesita despejar el piso para bajar; se descarta al quedar vacío. La salida devuelve al origen de cada jugador (`origins`).
- Cliente: `enemyPlayer` permite atacar a jugadores enemigos en criptas compartidas.
- Test nuevo `tests/shared-crypt.test.mjs`.

## 0.65.0 · Cerebro de bots (2026-10-12)
- Observar: ventana «Cerebro» (arriba a la derecha) con modo, objetivo, misión, expedición, equipo, a quién mira, diario de pensamientos, recuerdos y amigos. El servidor manda `brain` 1 vez por segundo solo a quien observa (`brainOf` en residents.js). Sin cambio de `NET_PROTO`: un cliente viejo ignora el mensaje.
- Bots: compran y estudian el manual de la habilidad de su arma (y del escudo): con 0 % de skill fallaban casi todo (`studyManuals`).
- Bots: en la cripta cada piso nuevo prorroga la expedición 5 min y ya no vuelven a casa al acabar el tiempo si pueden bajar más.
- Bots: al bajar a una cripta invitan a 2 compañeros cercanos (nv ±8) y bajan en equipo (`recruitCrypt`).
- Test: `bot-brain`, `bot-manuals`; `human.test` espera más a un bot en expedición.

## 0.64.4 · Summons que pelean (2026-10-12)
- Bots: el cálculo de pelea (`fightEstimate`) cuenta el daño real del summon vivo (golpe de su nivel, +60 % si es de escuela) y que reparte los golpes. Antes usaba la ficha del monstruo.
- Bots: el encargo del hospital de compañeros ya no lo interrumpe el grupo (arrastraba al bot lejos de Gail) y el simulador carga `gshop_1f`.
- Bots: los hechizos del summon dejan una reserva de oro para pociones (`potReserve`).
- `tools/questsim.mjs`: `PETS=1` y `DEATHS=1`.

## 0.64.3 · Brasas con aviso (2026-10-12)
- Las brasas del jefe hacen su primer daño a los 900 ms (antes 400): da tiempo a apartarse. Los bots se quedaban sobre el fuego. Medido: 5–9 de 12 pasan del Rey carmesí en 480 min.
- `tools/questsim.mjs`: `HAZ=1` mide el tiempo sobre peligros.

## 0.64.2 · Jefe del piso 5 más justo (2026-10-12)
- Jefes de cripta: vida ×(2+tier) en vez de ×(3+tier) y 4 esbirros en vez de 6. Los bots morían una y otra vez en el piso 5 (hasta 9 muertes). Medido: 4–7 de 12 pasan del Rey carmesí en 480 min (antes 2–4).
- Bots: el cálculo para bajar al jefe usa la vida máxima (tras curarse), no la actual.

## 0.64.1 · Recall sin cancelarse (2026-10-12)
- Los bots no relanzan Recall mientras el canal está abierto (el segundo comando lo cancelaba).

## 0.64.0 · Bots hacia el final (2026-10-12)
- Residentes: llevan hasta 40 pociones si tienen oro, ya no cambian escudo por arma a dos manos ni entre dos armas a dos manos (bucles que vaciaban el oro), y las lecciones de muerte caducan a los 20 min para no quedarse sin presa.
- Cripta: jefes más suaves (vida +18 %/piso, daño +6 %/piso); `bossPreview` de los bots sincronizado. Medido: 5 de 12 bots pasan del Rey carmesí en 480 min (antes ninguno).

## 0.63.0 · El camino del invocador (2026-10-12)
- Sistema de misiones: 22 por clase (Guerrero, Mago, Invocador), acto 1 hasta nivel 50. Diario con J y rastreador en pantalla; siempre queda un siguiente objetivo.
- Hitos con objetos nuevos (9101–9111, emblemas 9121–9123). El báculo solo cae del Gold Skeleton tras la misión que lo habilita; la cripta y el comercio se abren por misiones.
- Equilibrio: experiencia más lenta (PACE 0.3), cripta más dura; los bots residentes persiguen las misiones (medido con `tools/questsim.mjs`).

## 0.62.2 · Revisión de código (2026-10-12)
- Servidor: una URL mal formada (`GET /%`) o un `Range` imposible ya no tumban el proceso (400/416).
- Servidor: las cabeceras de túnel (`X-Forwarded-For`, `CF-Connecting-IP`) solo se creen si la conexión viene de loopback, así no se falsea la IP para saltar límites.
- Servidor: una orden que lanza excepción ya no aborta el tick ni deja `world.time` desfasado; se registra y, tras 25 errores, se expulsa al cliente.
- Los flujos de lectura de ficheros estáticos cierran la respuesta si fallan.

## 0.62.1 · Ajuste de equipo (2026-10-12)
- Tentocle vuelve a ser libre: solo Frost, Liche y Demon exigen su báculo.
- Fuera el halo y las chispas de los báculos maestros: solo queda el tinte (más fuerte que el normal).
- El color de cada báculo hace juego con su summon: Ice Wand azul hielo (Frost), Darkness Staff morado oscuro (Liche), Hero Staff naranja brasa (Demon).
- Ninguna pieza de cabeza/cuerpo/brazos/piernas queda sin clase: Hero (gorro, hauberk, leggings) = Guerrero; ropa básica (Shirt, Tunic, Bodice, Trousers, Skirt...) = las tres. `tests/classgear.test.mjs` lo comprueba pieza a pieza.

## 0.62.0 · Equipo de clase (2026-10-12)
- Cada clase solo equipa su armadura: Mago = túnica, ChainHose, Wizard Hauberk y Wizard-Hat; Guerrero = placas y cualquier casco; Invocador = cuero, ChainHose, Hauberk normal y Wizard-Cap. Lo que ya llevabas puesto se queda.
- Para invocar a Frost/Tentocle hace falta la Ice Wand en la mano (antes BerserkWand), para el Liche el Darkness Staff (ResurWand) y para el Demon el Hero Staff. Cada báculo lleva un tinte del color de su summon.
- Báculos maestros (Master Ice Wand, Master Darkness Staff, Master Hero Staff): nivel 50, 1 de oro en el herrero, tinte más fuerte y un halo con chispas en el color de la escuela. Valen como el báculo de su familia.
- Niveles del equipo reajustados al acto 1 (máximo 50).

## 0.61.0 · Clases (2026-10-12)
- Al crear el personaje se elige clase: Guerrero (FUE y VIT), Mago (INT y MAG) o Invocador (CAR y VIT). Solo cambia los atributos iniciales; los personajes existentes son Guerreros.
- El Invocador puede tener 2 summons activos a la vez con 100 de carisma (total) y 3 con 200. Deben ser de especies distintas; al pasar el límite se guarda el más antiguo. Cada invocación cuesta su porcentaje de maná.
- F10 y los controles de modo actúan sobre el primer summon activo.

## 0.60.1 · Bots en la lista de conectados (2026-10-12)
- La pantalla de entrada (y /api/info) cuenta y nombra a los habitantes conectados junto a los jugadores.

## 0.60.0 · Maná proporcional, gustos y manuales (2026-10-11)
- Invocar cuesta un porcentaje de tu maná máximo igual al nivel del summon (nivel 1 = 1 %, nivel 50 = 50 %).
- F10 → Info muestra la comida que le gusta y la que no a tu summon.
- Los manuales de habilidad dan el 100 % de la habilidad (se usan también para subir una habilidad ya aprendida).

## 0.59.0 · Invocar cuesta maná (2026-10-11)
- Invocar un summon cuesta maná igual a su nivel (nivel 12 = 12 de maná). Sin maná suficiente no se invoca; guardarlo es gratis.

## 0.58.1 · Aviso de versión (2026-10-11)
- La pantalla de entrada avisa en rojo cuando el servidor está en otra versión que tu cliente (p. ej. servidor sin reiniciar tras una actualización).

## 0.58.0 · Supports independientes (2026-10-11)
- Healer, Buffer y Aura son tres summons distintos, cada uno con su sprite y su clase desde que se invoca; ya no hay un Dummy que se transforme. Las bolas antiguas se convierten solas.
- Las bolas de los supports muestran su nombre y su color propio en tienda, mochila y chat.

## 0.57.1 · Colores de supports (2026-10-11)
- Aura ahora tiene el pelo azul y Buffer el amarillo.

## 0.57.0 · Criptas y Rey dorado (2026-10-11)
- Los habitantes vuelven a pelear en la cripta: la lección de una muerte se guarda por piso (antes un solo esqueleto vetaba a todos).
- Nueva meta de vida: matar al Rey esqueleto dorado (piso 20) y terminar las criptas; expediciones más largas y seguidas mientras dure.
- Summons de apoyo: el Buffer da berserk, afectan a todos los del círculo (también pets) y se ven como hechicera desde el principio.

## 0.56.0 · Ficha de puestos (2026-10-11)
- Ventana del puesto ampliada con ficha a la derecha (sprite, estadísticas, comparación con el equipo, precio y oro).
- El puesto en el mundo usa sprites reales de objetos en vez del cofre dibujado a mano.

## 0.55.2 · Avisos del puesto (2026-10-11)
- Montar un puesto fuera de shop, warehouse o herrería ya no es silencioso: aviso claro al pulsar Tienda o /puesto, y los rechazos del servidor (cerca de un teletransporte, ya tienes uno...) salen en el chat.

## 0.55.1 · Arreglo de carga (2026-10-11)
- Hotfix: la 0.55.0 no cargaba (expresión regular rota en la tienda del granjero). Arreglado.
- Los habitantes (bots) ya no fallan al arrancar el servidor si su partida estaba en otro mapa.

## 0.55.0 · Doomy, hospital y granja (2026-10-11)
- Doomy (sistema Dummy): nombres y colores por clase (Healer verde, Buff amarillo, Aura azul); barras de HP/maná/exp de los summons diferenciadas; indicador de zona menos intrusivo; Aura Doomy muestra HP/maná sobre el personaje (opción F12, visible a otros jugadores, evento `auramp`).
- Hospital de compañeros: HP en las filas, nombre y color de Doomy, pestaña Ayuda. Tienda: al pasar el ratón se ve sprite, estadísticas completas y comparación con lo equipado. Summons: filas de evolución y clase Doomy en Info; dar de comer arrastrando el alimento al summon o con doble clic.
- Arreglos: sprite de personaje parado (pecho), PV al cambiar de mapa, bola de Dummy desde F1 → Herramientas, sin puestos en entradas/teletransportes, grimorio de vuelta en la barra inferior, puntos de aura al nivel 50, guarda de reaparición tras morir.
- Granjero en Aresfarm (77,106): vende todas las semillas y el Manual de Cultivo, con explicación. Test `farmer.test.mjs`.
- Pendiente: BUG-019 (diálogos unificados) y fichas ampliadas de más especies (BUG-010).

## 0.54.1 · Publicación online arreglada (2026-10-11)
- `net-bot`, `net-persist` y `net-walk` usan `NET_PROTO` en vez de `proto: 6` fijo (el CI fallaba desde v0.52.0 al subir el protocolo y Pages no se desplegaba). `data.test` ya funciona en Windows.

## 0.54.0 · Habitantes con puesto (2026-10-11)
- Los habitantes (bots residentes) abren un puesto en `gshop_1f` con hasta 8 objetos sobrantes (`stallSurplus`), los venden a ~el doble del precio de tienda, vuelven a recoger oro y cierran cuando se agota. `manage` reserva hasta 8 objetos vendibles (`stallKeep`). Test: `tests/residents-stall.test.mjs`.

## 0.53.0 · Los summons de nivel 50 hablan según su especie (2026-10-11)
- Al llegar al nivel 50, Liche (nigromante, aterrador), Demon (rey del inframundo, majestuoso y cálido) y Frost (belleza y muerte por escarcha) dicen una frase propia, con respuesta del jugador (es/en). Datos: `voice.json` → `companion.milestone50`. Test en `tests/voice.test.mjs`.

## 0.52.2 · Puestos: diálogos propios (2026-10-11)
- Precio y rótulo del puesto se piden con un cuadro propio (el `prompt` del navegador está bloqueado en muchos webviews). Pie de página correcto al montar un puesto. Probado: tienda NPC, montar y abrir puesto, plantar y alimentar.

## 0.52.1 · Puestos: arreglo y botón Tienda (2026-10-11)

- Arreglo: `/puesto` no abría nada (el id del cuadro chocaba con el rastreador del tutorial; ahora es el 48).
- El botón «Upgrade» de la mochila pasa a «Tienda» y abre el montaje del puesto. El cuadro explica los pasos y tiene botón «Abrir tienda» abajo (Ok cancela).

## 0.52.0 · Puestos de jugadores (2026-10-11)

- Nuevo: los jugadores abren puestos de venta en shop, warehouse y herrería (`/puesto`). Comisión 0, oro recogible por el dueño, el puesto queda abierto AFK y se guarda en el servidor. Protocolo 7.

## 0.51.3 · Bots atascados en criptas (2026-10-11)

- Arreglo urgente: los habitantes que quedaban en una cripta sin expedición activa (o cuyo Recall se cancelaba al repetir la orden o moverse) se quedaban corriendo de un lado a otro sin matar esqueletos. Ahora adoptan la expedición y el Recall de la cripta se queda quieto los 3 s del canal sin reenviarse.

## 0.51.2 · Sembrar con doble clic (2026-10-11)

- Doble clic en una bolsa de semillas de la mochila siembra en la casilla que se mira (antes no hacía nada). También se puede arrastrar la bolsa a una casilla vecina del mundo: el personaje se vuelve hacia ella y siembra.

## 0.51.1 · Gustos de los summons (2026-10-11)

- Cada especie tiene cultivos favoritos (curan un 50% más; los puntos permanentes suben de 2 en 2) y otros que rechaza sin gastarlos. Se ve en la ficha del summon de la tienda de bolas.

## 0.51.0 · Agricultura (2026-10-11)

- Agricultura como en el servidor original: semillas, casillas de cultivo, azada y cosecha.
- Los productos alimentan al summon: Tomate +1 vida, Uva +1 maná, Champiñón +1 ataque; el resto lo cura y el Ginseng lo revive. Se ve en su ventana.
- Algunos bots son granjeros: siembran y cosechan para comerciar.

## 0.50.8 · Vista previa de summons (2026-10-11)

- Comprar una bola en el hospital abre una ventana con estadísticas (nivel 1 → 50), habilidades, historia breve y siluetas de las evoluciones; desde ahí se confirma la compra.

## 0.50.7 · Bots y jefe glacial (2026-10-11)

- Al volver a entrar reapareces donde cerraste sesión (mapas fijos; no en criptas ni arena).
- Los bots saludan, charlan y comentan tu summon de nivel máximo aunque no haya modelo de lenguaje.
- El jefe glacial de la cripta ya no marca cuadro ni suelo helado: solo lanza Tormentas de Hielo, más juntas según pierde vida.
- Al cambiar de summon, la magia elegida para F4 se reinicia.
- Los bots ya no dicen el nombre interno de los objetos en los tratos (Long Sword, no LongSword).

## 0.50.6 · Bots con armadura y conversación (2026-10-11)

- Ctrl+0..9 abre la página correcta del libro de magia.
- Las áreas (Blizzard…) ya no dañan a tus summons ni a los de tu grupo.
- El brillo de «a punto de evolucionar» del summon aparece desde el 90 % de exp, no solo al final.
- El grupo muestra el nivel de cada miembro.
- Los bots hablan en los tratos aunque no haya modelo de lenguaje.
- El minimapa siempre va en la esquina.
- Grupo: el nivel de los miembros viaja en `party.lvls`.
- Nuevo **Bestiario** (bestiario.html): ver cualquier criatura por etapas de evolución y direcciones, con sus efectos, sin entrar a jugar. Liche: los ojos ya no suben en los frames de ataque.

- **Observar con el ratón**: en Promise Land, mover el cursor sobre un jugador enemigo lanzaba una excepción al elegir objetivo y congelaba el juego; corregido.
- **Demon Lv 50** (nuevo aura): fuego en los puños, brasas y calor; sin aura en el suelo ni llamas tipo Fire Field. **Frost Lv 50** (nuevo aura): viento helado, copos y destellos de cristal (sin aura en el suelo ni cristales volando), más un destello de cristal con copos cayendo en la punta del báculo. **Liche Lv 50**: ojos también mirando abajo-izquierda y abajo-derecha, más abajo en la cabeza, y halo violeta con chispas en el orbe del báculo.
- **Auras Demon/Frost** más sutiles (a la altura del Liche). **Summon al lanzar magia**: frase propia según la especie (Demon, Frost, Liche o genérica) con el nombre del hechizo, y si está en nivel máximo dibuja un círculo de runas de su color bajo los pies mientras castea (lo ven también los demás jugadores).
- **Observar**: si el habitante observado desaparece del mundo (cambio de mapa, muerte, salida), el servidor espera 6 s antes de soltarte y el cliente vuelve solo a la lista, en vez de dejar la pantalla congelada. El bucle de dibujo ya no se detiene por un error puntual.
- **Promise Land**: arreglado el cierre del cliente al entrar (una entidad ya conocida cambiaba de tipo sin recalcular su ficha).
- **Liche Lv 50**: ojos más arriba y ocultos de espaldas.
- **Bots**: ahora valoran también las armaduras (peso relativo a lo que llevan puesto; compran antes la pieza más floja), no solo armas especiales.
- **Bots**: siguen el hilo de una conversación entre ellos (responden antes y con más probabilidad a quien participa del hilo).
- **Bots**: el chat ambiental enlatado queda desactivado por defecto (sigue siendo interruptor en el panel de administración).

## 0.50.5 · Auras de nivel 50 (2026-10-11)

- **Demon Lv 50**: aura de fuego (brasa bajo los pies, llamas del Fire Field, brasas ascendentes).
- **Liche Lv 50**: oscuridad (sombra, humo negro, ojos rojos, Armor Break inverso).
- **Frost Lv 50**: viento helado en espiral con copos y destellos de cristal.
- **Servidor**: arreglado el cierre del servidor al observar bots (referencia circular en el estado del bot observado); el tick ya no tumba el servidor y los fallos van a `server/data/crash.log`.

## 0.50.4 · Brillitos y Liche (2026-10-11)

- **Liche**: conserva su color original, solo más oscuro.
- **Summons evolucionados**: en vez del destello blanco, brillitos en forma de estrella (como la armadura Merien) en ráfagas cada ~5 s.

## 0.50.3 · Liche y brillo de evolucionados (2026-10-11)

- **Liche**: color más oscuro y saturado (violeta), sin el tono azulado.
- **Summons evolucionados** (Demon, Frost, Liche): destello blanco periódico (cada ~5 s) para distinguirlos.

## 0.50.2 · EKs, summons caídos y Promise Land (2026-10-11)

- **EK (enemy kills)**: el contador ya no se pone a cero al morir; se acredita al matar a un enemigo de la otra ciudad con golpes, summons, magias o campos. La racha de la recompensa es aparte.
- **Bots**: la meta de EKs atrae más a Promise Land; si su summon cae allí, salen con Recall y lo reviven en el hospital de compañeros.

## 0.50.1 · Arreglo: caída del servidor (2026-10-11)

- **Corregido**: el servidor se caía al golpear un summon a un jugador enemigo en Promise Land (`defenseRatio` de un jugador). Eso causaba «conexión perdida» y reinicios.
- **Bots en la cripta**: si todos los esqueletos que quedan les resultan demasiado fuertes, salen con Recall en vez de quedarse parados.

## 0.50.0 · Summons en el PvP (2026-10-11)
- Energy Strike: las bolas ahora salen del lanzador hacia el objetivo (antes se iban abajo a la derecha).
- Los summons pelean en Promise Land contra jugadores y summons enemigos; los bots los sacan, los señalan a un rival, los retiran con poca vida y atacan a los summons que les amenazan.
- PvP más ágil: el daño entre jugadores sube un 70 % para que los duelos no duren minutos.
- Ventana de chat (F9) nueva: más grande, con filtros (Todo, Chat, Grupo, Clan, Sistema), saltos de línea y barra de scroll; el registro del HUD es más ancho.
- Orden al summon: línea de puntos gris hasta la casilla a la que lo mandas y roja hasta el objetivo que le ordenas atacar (Alt + clic; también sobre jugadores y summons rivales en Promise Land).
- La bola y el sprite del Liche tienen tonos más oscuros y tenebrosos.

## 0.49.0 · Vida propia, grupos y builds (2026-10-11)
- Habitantes con vida propia: horarios de conexión según la hora, descansos, pausas AFK, despistes, erratas al escribir y charla espontánea.
- Panel de admin: tarjeta «Conexiones» para elegir qué bots se conectan (on / off / auto) y cuántos como mínimo; columna de build y parties con su debate.
- Los grupos de bots debaten qué hacer (cazar, cripta o Promise Land) y cada bot tiene su estilo; buscan mejores presas en vez de quedarse en slimes.
- Los bots calculan si pueden con un jefe, esquivan el fuego y la escarcha y atacan a los cristales y clones; se curan y huyen con Recall.
- PvP solo en Promise Land: los bots guardan rencor tras morir y hay «fiebre de guerra» periódica.
- Gestión de objetos de los bots por valor: venden, guardan, regalan a amigos, ordenan la mochila y ahorran para su mejora deseada.
- Reset de estadísticas: habla con el mago de la tienda general (cuesta 300 + 60 × nivel); los bots lo usan para probar builds.
- Menos basura en el suelo (los slimes sueltan poco y los drops desaparecen); tienda de magia indica «Smn Lv» (nivel del summon); nombres algo más abajo; botón Ok del guild arreglado; nuevos jugadores empiezan en Aresden; los bots atienden peticiones de party por chat.

## 0.48.0 · Comercio, guilds y bots sociales (2026-10-11)
- Item level: cada objeto tiene un nivel de objeto y los bots se equipan lo mejor de su mochila y compran por mejora.
- El summon te sigue con correa: acelera suavemente si se queda atrás, sin saltos bruscos.
- La barra de vida del grupo está pegada al borde izquierdo de la ventana.
- Chats como en el original: sin prefijo local, ! grito, ~ bando, $ grupo, @ guild (cada uno con su color).
- Matar enemigos distintos da más experiencia; los bots variados y aprenden: evitan lo que los mató y se avisan entre ellos.
- Los bots atacan a los jefes de la cripta si tienen nivel o compañeros suficientes, y aprenden de cada jefe por separado.
- Los bots usan las magias de sus summons.
- Comercio (Ctrl+E o /trade) con jugadores y bots: ítems y oro con confirmación de ambos; los bots compran, venden y regalan según afinidad.
- Los bots aceptan tu petición de grupo (o te invitan) si te conocen.
- Los bots charlan en la tienda del pueblo.
- Guilds del original (Ctrl+G, /guild): crear (nv 20, car 20), invitar, expulsar, capa y botas de color, 'Guildmaster/Guildsman' bajo el nombre.
- Los bots fundan y organizan guilds por afinidad, charlan por el chat de guild y proponen cripta, raid en Promise Land o buscar loot.
- Corregido: dos grupos distintos podían acabar en una cripta mal emparejada al reiniciar; y Ctrl+P / elegir jugador funciona de nuevo.
- Protocolo de red 6.

## 0.47.0 · Cliente y bots pulidos (2026-10-11)

- `main.js useMagic`: con bola de invocación activa, la magia de su escuela se lanza sin saberla (la valida el servidor). Etiquetas «Combatant»/«Traveller». Nombres ajenos solo con el ratón encima (`controller.pickPlayer`, `hoverPlayer`); nombre propio siempre. Mascotas: nombre del dueño.
- Panel DR/MR opcional (mod `statusPanel`, apagado). `connection.applyEnt`: al observar, la entidad observada se trata como remota (interpolación; sin esto iba a tirones).
- `bot.js`: sin hostiles a ≤14 casillas, viaja a cazar al más cercano (cada 8 s) en vez de vagar junto al pueblo.

## 0.46.3 · De vuelta en línea (2026-10-11)

- `tools/iniciar.ps1`: `tunnel: "cloudflare"` en config.json (o `-Modo rapido`) usa el túnel temporal de Cloudflare (`$quick`, `IniciarCloudflare`); con ngrok comprueba `/api/info` del dominio fijo al arrancar y, si no responde (ERR_NGROK_725, ancho de banda agotado), mata ngrok y levanta Cloudflare. El enlace sale en el aviso y se copia al portapapeles. No probado en Windows desde el entorno de desarrollo.

## 0.46.2 · Modo observar fiable (2026-10-11)

- Causa de «no veo Observar»: el túnel ngrok respondía ERR_NGROK_725 (ancho de banda mensual agotado) → `findServer` caía a prueba local. Ahora, si el servidor configurado no responde, prueba el mismo origen (`api/info`), lo que funciona abriendo `http://localhost:8088/`.
- Servidor: los ticks sin novedades solo mandan el reloj cada 0,4 s; cada 60 s repone habitantes hasta `RESIDENTS` (los bots siempre arrancan y se mantienen).

## 0.46.1 · Arreglo del almacén (2026-10-11)

- `server/store.mjs`: el volcado usa una marca de tiempo estrictamente creciente; con volcados en el mismo milisegundo la poda del historial (`at NOT IN …`) guardaba más de 24 copias y `store.test.mjs` fallaba a ratos (tumbó el CI de la 0.46.0).

## 0.46.0 · Más difícil llegar al nivel máximo (2026-10-11)

- `combatsys.expRate(level)` = 0,7 · 0,92^(nivel-20) (0,7 hasta el 20); `giveExp` escala toda experiencia ganada. Invento del port a petición del propietario; la tabla `expForLevel` (original) no cambia, así que los niveles guardados se conservan. Test `exprate.test.mjs`; `party.test.mjs` ajustado.
- Nota: la experiencia del summon (`Comp.onKill`) no se escala; sigue siendo el 40 % de la base.

## 0.45.1 · Segunda ronda de bots (2026-10-10)

- Servidor: `BOT_EPOCH` (server.mjs) + `bots-epoch.txt` en la carpeta de datos: al cambiar la época se borran las partidas `bot:*` (todos a nivel 1) y el informe se archiva como `ronda-<fecha> …`. Una sola vez por época; subir la constante para otra ronda.

## 0.45.0 · Reparaciones del informe de bots (2026-10-10)

- Corregido (crash): `companionStruck` leía la mochila de un dueño que ya no estaba en el mundo (cambio de mapa) y tumbaba el servidor; ahora el summon se disuelve.
- Métrica: el evento `death` de un monstruo muerto por un summon lleva `pet` (id del dueño); `residents` cuenta esas bajas.
- Atascos: el viaje al hospital ya no repite la ida a la tienda (`_pet.in`); quien aparece sobre un teletransportador se aparta; el viaje caduca aunque el bot esté peleando; los objetivos sin camino se descartan 20 s (`bot.ignore`); un seguidor junto a su líder no cuenta como atascado.
- Summons: si quedan a más de 22 casillas del dueño se teletransportan a su lado (`followerThink`); `Comp.OWNER_SHARE` = 0.4 (antes 0.25).
- Cliente: aviso de peso (>90 %) y de mochila (≥46/50) en el registro, con la línea de carga en rojo; entradas en inglés en `i18n.js`.
- Habitantes: puntos 40 % Fuerza / 40 % Vitalidad; `tooStrong` exige 4 golpes de margen; el viaje a Gail ya no espera a estar sin grupo; las ideas del LLM se piden sin nombre de personaje, con cifra, y se filtran duplicados y nombres.
- Descartado: el aviso «learn desde cualquier sitio» (en el port se enseña desde el libro, no hay Mago al que acercarse). Sin tocar: curva de experiencia y penalización de muerte (vienen del original).

## 0.44.0 · Bots con summons (2026-10-10)

- Habitantes (`residents.pets`): compran bola en el hospital (Aresden: Gail en `gshop_1f`; Elvine Farm: Gail al aire libre, `EXTRA_CITIZENS.elvfarm`), invocan, gastan talentos según su arquetipo, enseñan y lanzan hechizos de escuela, usan `pettarget`/`petmode`/caramelos, y curan o reviven. Informan al informe de probadores (`pet-missing`, `pet-far`, `pet-slow`, `pet-dies`, `learn-anywhere`, `revive-cost`…).
- Corregido: `petbuy` rechaza especies que no están en NPC.cfg (Orc-Mage). Corregido: al reaparecer vuelve el summon elegido (`world.respawn`, `adventure.command respawn`). Test nuevo `residents-pets.test.mjs`.
- Pendiente (hallazgos): `learn` no exige estar junto al Mago de la torre; los summons se quedan atrás cuando el dueño corre largas distancias.

## 0.43.0 · Fosos y cripta (2026-10-10)

- Habitantes: bajan a la cripta (`residents.startDelve/delve`: entrada por `portal mid-entry`, caza, baja con el nivel despejado y Recall al terminar), metas `pvp` / `pit` / `crypt`, y fosos de Promise Land (cada zona de aparición de `2ndmiddle` es un foso; `adv.pits`, dominio por presencia en solitario, tiempo aguantado en `qa.pvp.held`). Eligen fosos del enemigo o libres y cambian de foso al dominarlo. `bot.js`: llegada a destino con espera (`b.hold`) y de viaje solo pelea lo que está a 2 casillas.
- `combatsys.canFight`: todos son combatientes en Promise Land (viajeros incluidos), salvo mismo bando y misma party. Test nuevo `residents-crypt.test.mjs`.

## 0.42.0 · Dos bandos (2026-10-10)

- Elvine Farm (`elvfarm`, `tools/convert_maps.py --only`) y Promise Land (`2ndmiddle`) abiertos con sus teletransportadores normales; PvP entre bandos solo en Promise Land (`combatsys.canFight/hitPlayer`, `world.pvp`). 40 habitantes: 20 Aresden y 20 Elvine, con auto-run, grupos de hasta 4 (el líder lleva), expediciones a Promise Land, burlas y charla entre ellos. Modo observar desde el login (`observer.js`, mensajes `bots`/`watch`, `NET_PROTO` 5) con su log en el chat (`bot.blog`). Cartel de nombre con bando (`sd`).

## 0.41.0 · Habitantes (2026-10-10)

- 40 bots permanentes en el servidor (`systems/residents.js`): ficha, metas, memoria, relaciones, charla (mitad inglés, mitad español), IA local opcional (`server/llm.mjs`, Ollama) y guardado en `saves["bot:<nombre>"]`. Apagado seguro (SIGHUP/BREAK, excepciones) y `Activar inicio automatico.bat`. Hacen de testers: `server/report.mjs` escribe `server/data/Informe de bots.md` (fallos, incomodidades, balance, ideas); comandos `habitantes`, `vida`, `informe`.

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
