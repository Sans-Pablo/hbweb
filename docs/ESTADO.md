# Estado del proyecto

**Hecho:** granja de Aresden jugable; combate con fórmulas del servidor original; ítems originales (568 de Item.cfg), mochila de 50 casillas, peso, equipar con requisitos, absorción por parte del cuerpo, durabilidad (solo con bando), botín con las tasas originales (1/1), habilidades con maestría, resistencia, hambre; opciones (Esc), mapa tipo Diablo II, correr con R, guardado en el navegador.

**Pendiente:** ver el Backlog más abajo (el listado antiguo estaba desfasado).

## Backlog (actualizado en v0.70.0)
- Hecho 0.79.x: summons psíquicos, modo 0 restricciones, pets más rápidas, indicador de estados de los demás. Pendiente: contramagias psíquicas, HD de Beholder/Centaurus/Stalker.
**Hecho recientemente:** magia 102–172 y teleport (por diseño/Recall), Inhibición/Confusión, PvP, chat de gremio/grupo, susurros `/to`, bots que abren y compran en puestos, Python ya no es necesario.

**A hacer (FIX), en el orden sugerido:**
1. (hecho en v0.71.0: tests de backup/vaivén, audio revisado, bando al crear y tinte aditivo; falta la tabla exacta m_wR del original)
3. Compañeros: habilidades por especie y compañero en multijugador (snapshot).
4. Online: probar y documentar los scripts de Windows y los túneles.
5. Peso del repo: `web/data` ~450 MB y `.git` ~420 MB; evaluar Git LFS o un repo de datos aparte (antes de que crezca más).
6. Fichas: revisar `companeros.md` y limpiar los "Pendiente" viejos de este fichero.

**Backlog nuevo (pedido del usuario, v0.71.0):**
- (hecho: ya existía en `renderer.drawPetOrder`) Órdenes a la mascota: usar la misma línea punteada que el personaje; rojo para atacar y un tono más claro para «moverse a ese lugar».
- (hecho en v0.74.0) Cíclopes de Promise Land: darles las magias que tienen en el original para hacerlos más peligrosos.
- (hecho en v0.74.0) Color del nombre de los objetos según rango (tiers, como en WoW).
- (hecho en v0.75.0; la auditoría se arregló en v0.76.0) Traducciones completas (es/en) de todo el juego.
- (hecho en v0.73.0) Observador: ignorar las teclas F cuando se pulsan fuera de la pantalla del juego (F5 refresca la web sin querer).
- (hecho en v0.73.0) Stats de más: el original da 3 puntos por nivel (`bCheckLevelUp`, igual que aquí). La causa era la pérdida de nivel al morir: quitaba 3 puntos del fondo libre pero no de lo ya repartido, así que morir y volver a subir regalaba 3 puntos por nivel. Ahora el nivel perdido deja una *deuda* (`lvDebt`) que pagan los siguientes niveles (y el reinicio de stats); la pérdida de nivel se mantiene. Test `level-debt.test.mjs`. Los personajes ya inflados conservan lo que tienen.
- (hecho en v0.73.0) Bots: sí vendían (`manage` en `botitems.js`), pero solo con carga ≥ 50 % o la mochila casi llena (38/50), así que llevaban 13-15 objetos de equipo sobrante. Ahora también ordenan al pasar de 14; los residentes se guardan hasta 8 para su puesto. Arreglado de paso: al vender se llevaban la caña de pescar de los residentes (`judge` la conserva).

**Backlog nuevo (pedido del usuario, 2026-10-12, tras la v0.75.0):**
- [x] (hecho en v0.76.0) **Proceso:** toda petición del usuario se anota aquí como tarea formal (con estado) antes de empezar, para poder retomar sin perder nada.
- [x] (hecho en v0.76.0) **Cripta, progreso por niveles:** un bot superó el nivel 10 y salió de la cripta; al volver a entrar tiene que matar al jefe en vez de entrar en el nivel 11. Revisar cómo se guarda y se reanuda el progreso (`dungeon.js`, `adventure.js`, `bot.js`). → al volver se puede elegir el nivel de inicio entre los despejados (o el siguiente); continuar entra en el siguiente al último despejado. Test `crypt-start`.
- [x] (hecho en v0.76.0) **Sprite negro:** a veces un personaje pierde su sprite y se ve negro. Reproducir (carga por mapa, caché de hojas) y arreglar. → PARCIAL: sin causa identificada; las hojas que fallan se reintentan solas. Test `sprite-retry`.
- [x] (hecho en v0.76.0) **Observador, audio al volver de otra pestaña:** al recuperar el foco suenan muchos sonidos juntos (parece una muerte). Descartar los eventos acumulados mientras la pestaña estaba oculta (`audio.js`, `visibilitychange`). → al volver a la pestaña se descartan los sonidos acumulados.
- [x] (hecho en v0.76.0) **Bots y summons:** que quieran subir de nivel a sus summons dándoles su comida favorita. → compran y dan comida (`summonfood.js`). Test `summon-food`.
- [x] (hecho en v0.76.0) **Bots granjeros y pescadores:** aún no se ven; revisar los roles y por qué no se asignan (`bot.js`, `leisure.js`). → 2 granjeros y 2 pescadores fijos (`JOBS` en `residents.js`). Test `bot-jobs`.
- [x] (hecho en v0.76.0) **Bots support:** bots que usen summons de apoyo (para estudiar su comportamiento) y que prefieran con fuerza entrenar en party. → 4 de apoyo (2 por bando) que prefieren entrenar en party. Test `bot-jobs`.
- [x] (hecho en v0.76.0) **Bots, descanso en zona segura:** un bot descansaba en Promise Land mientras los monstruos le pegaban; es incorrecto. Rediseñar el sistema de descanso: solo en una zona segura (como mínimo sin monstruos cerca; ciudad, granja o tienda), nunca en pleno combate ni bajo ataque. Si hay monstruos cerca o recibe daño, deja de descansar y huye o se defiende (`bot.js`, `leisure.js`). Con test y ficha en `docs/sistemas/`. → solo en ciudad o granja; fuera vuelven con Recall y si les pegan se defienden. Test `bot-rest`.
- [x] (hecho en v0.76.0) **Por confirmar (mensajes antiguos, sin verificar):** recordar la posición al desconectarse; auto-ataque activado al entrar; Guildmaster regala bota y capa del color del guild; línea fina en el borde de Promise Land; atacar a Elvine (personaje y summon); drops sin objetos knight/hero/sangh; reinicio del casteo F4 al cambiar de summon; sin cuadrado del suelo en el jefe de hielo; ojos del liche más arriba y juntos; teclas de los diálogos que activan atajos del explorador. → las 10 estaban hechas salvo Ctrl+E/G en los diálogos (arreglado: `isHotkey`); la línea fina del borde de Promise Land NO se pudo verificar ni reproducir.

- [x] (hecho en v0.76.0) **Compañeros:** una habilidad activa propia por especie (`petskill.js`, test `petskill`).
- [x] (hecho en v0.76.0) **Online:** scripts de Windows y túnel ngrok probados en este PC (ver `docs/ONLINE.md`; Tailscale y Cloudflare sin probar).
- [x] (hecho en v0.76.0) **`tools/i18n_audit.mjs`:** tardaba minutos por una expresión regular con retroceso exponencial; ahora tarda menos de un segundo.
- [ ] **Aplazado (decidido por el usuario):** tamaño del repo (LFS), tabla de tinte de pelo `m_wR`, verificación de CI (no hay `gh`), todo `docs/FUTURO.md`.

**Backlog nuevo (pedido del usuario, 2026-10-12, tras la v0.76.0):**
- [x] (hecho en v0.77.0) **Observador, party members:** no se ven los miembros de la party en el menú del observador.
- [x] (hecho en v0.77.0) **Observador, party: mapa:** en el visor de party no poner «(otro mapa)»: mostrar el nombre del mapa donde está cada miembro.
- [x] (hecho en v0.77.0) **Observador, estadísticas globales:** pantalla con estadísticas globales, los *requests* de los bots y qué prefieren: los bots son testers y deben decirnos qué mejorar.
- [x] (hecho en v0.77.0) **Observador, top summons:** top de summons con sus dueños en el panel, y una ficha de cada summon con todos sus stats.
- [x] (hecho en v0.77.0) **Observador, layout propio:** elegir qué pantallas ver y definir/guardar el layout de la web a gusto del usuario.
- [x] (hecho en v0.77.0) **Bots, skill reset:** que los bots puedan hacer skill reset en algún NPC.
- [x] (hecho en v0.77.0) **Bots, change stat obligatorio:** forzar a todos los bots a un change stat para revisar armas, clase y build.
- [x] (hecho en v0.77.0) **Bots, variedad de clases:** balancear clases y roles para ver más variedad y no solo warriors: cada bot elige según sus ítems (si encuentra un buen ítem de warrior resetea y sigue de warrior); puede pasar a summoner o support por decisión propia.
- [x] (hecho en v0.77.0) **Bots, mensajes largos:** si un mensaje del bot supera el límite de caracteres de Helbreath, partirlo en varios mensajes en vez de truncarlo.
- [x] (hecho en v0.77.0) **Bots, salir de la cripta:** a los bots aún les cuesta salir de la cripta; revisar.
- [x] (hecho en v0.77.0) **Bots, summon fuera:** si un bot tiene summon, mantenerlo invocado en el mundo para darle exp, sobre todo los de apoyo, que dependen de la exp ganada en party.
- [x] (hecho en v0.77.0) **Bots, defender aliados:** si hay una pelea cerca, unirse a defender a los aliados y, sobre todo, intentar quedarse con el último golpe (*enemy kill*).
- [x] (hecho en v0.77.0) **Bots, flechas:** un bot peleaba sin flechas y no podía recallear porque seguir pegando cancelaba la acción. Debe razonar: comprar más al quedarse corto y llegar a mazmorras y zonas PvP con el equipo listo; no seguir atacando sin munición.
- [x] (hecho en v0.77.0) **Sistema, detección de bots bloqueados:** detector de bloqueos (bot atascado en una acción que se cancela, sin munición, sin progreso) que lo registre en el informe.
- [x] (hecho en v0.77.0) **Collar del lich:** el Liche Neck debe ahorrar maná del summon, no del personaje.
- [x] (hecho en v0.77.0) **Bolas de summon, colores:** cambiar los colores de las bolas: hoy heal es verde, buff amarilla y aura azul. → corregido en v0.77.1: las bolas son verde (heal), amarilla (buff) y azul (aura), como el nombre y el círculo
- [x] (hecho en v0.77.0) **Summon enemigo, nombre rojo:** el nombre del summon enemigo debe verse en rojo.

- [x] (hecho en v0.77.1) **Observador, web rota:** la página del observador no se veía bien (las ranuras no tenían posición en la rejilla y el contenedor oculto se pintaba encima). Arreglado en `web/observador.html`.

**Backlog nuevo (pedido del usuario, 2026-10-12, tras la v0.77.1):**
- [x] (hecho en v0.78.0) **Bots, magos y magias de pets:** los magos deben usar las magias que enseñan las pets y luego pelear con el báculo. → mantienen distancia con el summon vivo y con maná; sin maná, báculo. INVENTO: el original no estaba disponible. Test `mage-kite`; ficha en `companeros.md`.
- [x] (hecho en v0.78.0) **Bots, summoners a distancia:** los summoners también son personajes de rango; revisar cómo se comportan en el juego original. → mismo comportamiento de rango (aproximación, original no verificable).
- [x] (hecho en v0.78.0) **Bots, support sin summon:** aún no se ha visto invocar a ningún support; investigar por qué. → causa: la bola de misión y el combate reciente bloqueaban el cambio; ahora alternan. Test `support-summon`.

**Backlog nuevo (pedido del usuario, 2026-10-12, observador y economía):**
- [x] (hecho en v0.78.0) **Observador, 4 paneles sin recargar:** siempre 4 paneles, elegir qué panel ver en cada uno y redimensionar; al cambiar de panel NO se recarga la página ni el iframe del juego. → panel por ranura sin recargar el iframe del juego.
- [x] (hecho en v0.78.0) **Observador, selección de personaje:** panel de selección de personaje: ver quiénes son magos, warriors, etc. y filtrar por profesión para seguir a farmers y pescadores. → panel «Personajes» por clase/oficio.
- [x] (hecho en v0.78.0) **Bots, farmers y pescadores por ciudad:** 2 farmers y 2 pescadores por ciudad; hacen su actividad y venden sus productos a los otros bots, que compran en su tienda y mejoran sus pets. → 8 artesanos con puesto; los demás les compran. Ficha `artesanos.md`, test `craft-stall`.

**Backlog nuevo (respuestas del usuario, v0.78.0):**
- [x] (hecho en v0.78.0) **Controles, Shift para el compañero:** Shift+clic izquierdo = atacar con el compañero y Shift+clic derecho = ir a esa casilla (hoy es Alt).
- [x] (hecho en v0.78.0) **Críticos con Alt:** Alt+clic = ataque crítico (super ataque del original, con barra que se carga al golpear); citar la fórmula de HGServer/Game.cpp. → cifras del original verificadas (local, sin publicar). Ficha `critico-dash.md`, test `crit-dash`.
- [x] (hecho en v0.78.0) **Dash:** atacar mientras se corre: avanza y golpea con bono, como en el original. → ídem.
- [x] (hecho en v0.78.0) **Correr por defecto:** el personaje corre por defecto en cada sesión; Ctrl+R alterna.
- [x] (hecho en v0.78.0) **CI sin gh:** release.sh consulta por curl a la API de GitHub el estado del último workflow.
- [x] (hecho en v0.78.0) **Fichas de 0.76.0:** escribir fichas de summonfood, sprite-retry y audio. → `summonfood.md`, `sprite-retry.md`, `audio.md`.

- [x] (hecho en local, sin publicar) **Indicador de órdenes de la pet:** usa las mismas pelotitas que el camino del personaje: rojo = atacar, celeste claro = ir a la casilla (antes línea discontinua gris/roja).
- [x] (hecho en local, sin publicar) **F1 «Reset all»:** botón en Herramientas que devuelve a todos (jugador y bots/habitantes) al nivel 1 con atributos de partida, objetos iniciales, sin oro/banco/compañeros/misiones, como un servidor recién arrancado. Test en `debug.test.mjs`.

- [x] (hecho en local, sin publicar) **F1 «Reiniciar bots desde 0»:** botón que borra todos los bots y habitantes (con sus puestos y partidas guardadas en el servidor) y crea un juego de habitantes completamente nuevo, como un servidor recién arrancado.
- [x] (hecho en local, sin publicar) **Trade/tiendas (4 puntos):** (1) la ventana de trade parece rota: no se pueden arrastrar ni añadir objetos, y los bots tampoco; (2) una tienda sin objetos se cierra sola; (3) las tiendas caducan (24 h); (4) los puestos solo se montan en los warehouses (los grandes) para no bloquear entradas.
- [ ] **Verificar contra el original** (disponible en `HelbreathOriginal`, ver `ORIGINAL.md`): ~~cifras de crítico/dash~~ (hecho en local: `CRIT` ya es el original) y comportamiento de magos/invocadores a distancia (el original no tiene IA de jugadores-bot: es diseño propio, solo hay que mantenerlo coherente con las reglas de magia y de invocación del original).
- [ ] **Artesanos:** solo producen comida y pescado, no caramelos.
- [x] (hecho en local, sin publicar) **Balls con evoluciones (decidido con el usuario):** tabla única de datos `base → {evolución, escuela}` que lean companion/schools/residents/bot/arena/talents/summoninfo y los diálogos del cliente, en vez de las copias a mano de `SPECIES`/`SCHOOL_OF`/`TIER2`. Cadenas pedidas: **Skeleton → Liche** (Skeleton toma el lugar de la Cannibal-Plant como base de la escuela de rayo; Cannibal-Plant queda como bola normal); **Tutelary-Angel → Frost** (hielo, Frost recupera Ice Storm; el ángel crece vía campo `fit` a ~90 % del personaje) y **Tentocle → Beholder** (sin skills ni magia); Dark-Elf → Elf Master, Unicorn → Centaurus, Scorpion → Giant-Crayfish, Guard → Temple Knight (todos sin skills). Elf Master (tipo 84, sprite `uelfmaster`) y Temple Knight (tipo 46, sprite `utk`/`TK` en el cliente original) no están en `Npc.cfg`: hay que crearles entrada de NPC (`Guard-*` es tipo 21, sprite `uguard`). Centaurus es el nombre del original. Hecho: `shared/systems/evolutions.js`, ficha `docs/sistemas/evoluciones.md`, test `evolutions.test.mjs`.

**Futuro (aplazado):** ver [FUTURO.md](FUTURO.md): combate (críticos, dash, Firebow…), tutorial, arena completa, rediseño del sonido. Los mapas se dejan como están.

Especificaciones en `docs/` (items_spec.md). Pruebas: `node tests/sim.test.mjs`, `node tests/net-walk.test.mjs`.

## Atributos de los drops (revisado contra NpcDeadItemGenerator / _AdjustRareItemValue / bEquipItemHandler)
- Tablas de drop (oro 60 %, estándar 1d12000, genLevel de armas/varitas/armaduras) comprobadas: coinciden. Corregido: en diciembre cualquier monstruo suelta caramelos (el original lo escribe `type == 61 || 55`, siempre cierto).
- Nuevo `shared/attributes.js`: tipo/valor principal y secundario, color, tope 7 para monstruos de nivel ≤2, mínimos por tipo; peso/velocidad/durabilidad reales; efectos al equipar (dado +1/+2, acierto, defensa, recuperación de vida/aguante/maná, absorción, daño de combo, experiencia, oro, maná por daño, carga de crítico, bonus de lanzamiento de varitas).
- No portado aún: veneno (tipo 2), daño crítico (1, necesita ataque especial), "Righteous" (solo PvP), resistencias a veneno y magia (necesitan veneno y magia de NPC).

## Cuentas y guardado (prueba local)
- Pantalla de login con «Entrar» / «Crear cuenta» (`client/accounts.js`): contraseña con PBKDF2 + sal en localStorage; una partida previa con el mismo nombre se conserva al crear la cuenta.
- Guardado automático cada 10 s, al ocultar/cerrar la pestaña y desde Opciones («Guardar ahora»); copia de seguridad en archivo (exportar/importar) y cerrar sesión.
- Limitación: todo vive en el navegador (no hay sincronización entre dispositivos; haría falta un servidor).


## Cripta de esqueletos — 20 niveles

Sustituye a la entrega 1 (nueve salas). Ver [sistemas/cripta.md](sistemas/cripta.md). Pendiente: probar el aspecto de los bordes con los testers y afinar la dificultad.

## Creación de personaje
- Pantalla de creación (`client/create.js`) tras crear la cuenta: nombre (≤10, reglas del original), 10 puntos entre atributos de 10 a 14, plantillas Guerrero/Mago/Sacerdote, género, 3 pieles, 8 peinados, 16 colores de pelo y 8 de ropa interior, con vista previa que gira.
- `tools/convert_players.py` exporta los sprites (6 cuerpos, 16 peinados, 16 ropas interiores) a `data/players.json`; se cargan bajo demanda.
- Pendiente: el tinte del pelo es una aproximación (el original suma RGB al píxel); el bando se elige desde la v0.71.0.

## Cliente original: teclas y ratón (fase 1)
Teclas y ratón copiados de `Client/Game.cpp` (OnKeyUp/CommandProcessor): F1 ayuda, F2/F3 atajos (Ctrl+F2/F3 asigna lo último usado), F4 hechizo elegido,
F5 personaje, F6 mochila, F7 magia, F12 sistema, Insert/Supr pociones, Tab combate/paz, Inicio ataque seguro, Fin último mensaje,
Ctrl+A/D/M/R/S/T/W/X, Intro o cualquier letra = chat. Ratón: izquierdo andar/recoger, Ctrl+izquierdo atacar, derecho atacar adyacente;
con un hechizo preparado (UseMagic) el izquierdo lo lanza y el derecho cancela. Se quitaron teclas inventadas (C I K M G B N O R H Espacio 1 2 3).
Pendiente: Tab/Inicio/PageUp/Ctrl+A solo avisan (aún sin efecto en la simulación), F8/F9 y Ctrl+0..9 esperan a los diálogos originales.

## Cliente original: interfaz, magia y efectos (fase 2)
- Diálogos originales con sprites y posiciones del cliente: Personaje, Inventario (posición libre), Magia, Tienda de magia, Subida de nivel, Menú del sistema, Habilidades, Texto/Ayuda, Historial de chat. Clic derecho cierra el cuadro; arrastrar o pasar sobre un objeto muestra sus estadísticas.
- Magia como el original: elegir el hechizo en el libro cierra el libro, empieza la animación de lanzar (`prepare`) y el siguiente clic izquierdo lo suelta sobre el objetivo (`cast` con `pre`); el clic derecho cancela.
- Efectos de hechizos: `web/src/client/spellfx.js` porta bAddNewEffect / bEffectFrameCounter / DrawEffects con los mismos números de efecto (100 + hechizo) y los sprites de EFFECT*.PAK (`tools/convert_fx.py` -> `web/data/fx*`). Portados: 100, 101, 110, 120, 121, 130, 137, 143, 147, 156, 161 y las explosiones/chispas (4-12, 15, 30, 31).
- Sonidos originales E1..E53 y C1..C24 (`tools/convert.py`): lanzar, curar, explosiones, rayo, equipar (E28), quitar (E29), recoger (E20 / oro E12), clic de interfaz (E14).
- Ataque: sin pausa entre golpes (como el original); ataque automático opcional con `/auto` o en el panel de opciones.
- Pendiente de magia: tipos 4-7, 8-18, 19-33 (veneno, parálisis, escudos, invisibilidad, furia, invocación, resurrección, teletransporte...) con sus efectos 102-172, y el mago de la ciudad.

## Coordinación entre agentes
Se trabaja en `main` con commits pequeños: `git pull --rebase origin main` antes de cada push. Fase de UI original (cliente): `web/src/client/{controller,main,hud}.js`, `web/index.html`.

## Octubre 2026: pasada de fidelidad (tomada de los repos de referencia + código original)
- **Monstruos**: 45 tipos con sprites, sonidos y fichas (`tools/convert_mobs.py`; tabla tipo→sprite de ErkoKnoll/helbreath-base-game y juanrossi/helbreath, `tools/ref/Monsters.ts`). Tiempos y fotogramas por tipo desde `MapData.cpp` (`tools/convert_frames.py` → `shared/mobtiming.gen.js`). Hoja por acción según `DrawObject_On*`.
- **Mundo**: mapas de Middleland, Dungeons y Huntzones (`convert_maps.py --server Aresden,Middleland,...`); ciudad con NPC de tienda, herrería, almacén, mago y conversación (diálogo 21, `contents15x`); día/noche, lluvia, música por lugar, zonas sin ataque.
- **Combate**: auditado contra `iCalculateAttackEffect`; retroceso ≥ 40; habilidades especiales de monstruo 1–8 (explosivos); Summon Creature con seguidores.
- **Pendiente**: ver [sistemas/](sistemas/README.md) (cada ficha lista lo que falta); pruebas de interfaz con Playwright dentro del repo; nieve; mapas de Elvine; modo online activo desde la 0.25.0 (ver [ONLINE.md](ONLINE.md) y [sistemas/online.md](sistemas/online.md)).

## Carga bajo demanda (oct 2026)
Streaming por mapa (`docs/sistemas/carga.md`): arranque ~39 MB (antes ~131 MB solo de sprites + 17 MB de mapas), cambio a Aresden ~18 MB, service worker para la segunda visita. Pendiente: WebP, HD por bundle, espacio de `.git`.

## Arco, mirar con el botón derecho, F1 (oct 2026)
Arco portado (flecha, consumo, sin flechas, grupo 7 del cuerpo), botón derecho sobre el suelo gira sin andar, F1 = novedades/pruebas (sin la ayuda original). Pendiente de la fidelidad total: críticos, ataque en carrera, Firebow/Direction-Bow, reputación, zonas de lucha, PvP, Confusion/Inhibition/Resurrection, menús de los NPC restantes.
- Compañeros (Cazador): ver docs/sistemas/companeros.md

- [x] Cyclops Lv 50 eléctrico (v0.78.1–0.78.6): arcos en las pinzas; menos rayos y estimación de pinzas de espaldas (dirs 1 y 8); apagado al morir, chispa mínima en vida y carga de poder al atacar. Ver `docs/sistemas/bestiario.md`.
- [x] Cyclops por niveles (v0.78.11): crece en 10/20/30, 30 mini destello en pinzas, 40 + cuerpo, 50 rayos y full. Ver `docs/sistemas/bestiario.md`.
- [x] Pixie por niveles (v0.78.12–13, aparece como «Pixie» en el Bestiario): crece en 10/20/30; efectos solo en 30 (destellos en alas), 40 (cuerpo y motas orbitando) y 50 (halo y copos). Pendiente: HD real (hoja rehecha); hoy usa el reescalado x4 automático. Ver `docs/sistemas/bestiario.md`.
- [x] Sonidos de la Pixie en el Bestiario (v0.78.14): panel con botones para oír candidatos; pendiente que Pablo elija cuáles y asignarlos (crecer, invocar, morir, auras 30/40/50).
- [x] (hecho en local, sin publicar) **No puedo comprar balls:** causa real: el servidor online (`iniciar.ps1 -Modo online`, puerto 8088) seguía ejecutando el código viejo, donde Tutelary-Angel aún era una evolución («no disponible»). Solución: reiniciar el proceso `node server.mjs` (el script lo relanza solo) después de cambiar `shared/*`. Además: el hospital ya no lista especies sin NPC (Orc-Mage) y el test `summon-buy-all.test.mjs` compra todas las especies, comprueba su ficha y las invoca. Verificado con el servidor reiniciado: las 8 bases se compran, Frost y Beholder se rechazan.
- [x] (hecho en local, sin publicar) **Pixie y 3 tamaños:** Tutelary-Angel se muestra como «Pixie» (`NICK`/`shown` en evolutions.js; la clave de datos no cambia), `fit` 0.9→0.6 (menos pixelado) y flota ~10 px sobre el suelo (`hover` en renderer.js, sombra abajo). Crecimiento de 5 a 3 tamaños (`SIZE_STAGES=[25,50]`, K `[0,0.5,1]`, vista previa `SCALES`); Unicorn, Dark-Elf y Guard nacen al 85 % (`BIRTH` en `petScale`). Tests actualizados (summon-size, summoninfo). Pendiente: revisar a ojo el vuelo y el tamaño del Pixie.
- [x] (v0.78.15) Pixie HD: hojas `ututelarangel*` ×4 automáticas (`tools/make_pixie_hd.py`); rehacerlas a mano sigue opcional. Panel de sonidos del Bestiario abierto por defecto.
- [x] (v0.78.16) Sonidos de la Pixie en el juego (`audio.js`, eventos companion-lvl/companion-lost: E46, E30, E36+E19, M62). Falta: sonido al invocarla y aura continua si Pablo lo pide.
- [x] (v0.78.17) Healer, Buffer y Aura al nivel 50: efectos por clase desde el 30 (renderer.js, bloque `e.dcls`) y visibles en el Bestiario (`dcls` en `ent()`). Pendiente si Pablo lo pide: sonidos propios.
- [x] (v0.78.18) Healer, Buffer y Aura en HD (`tools/make_support_hd.py`, hojas uhealer/usorceress/ubuffer en sprites_hd/). Regla: siempre HD al pedir modelos.
- [x] (v0.78.19) Supports (Healer/Buffer/Aura): solo aliados en Promise Land, inactivos en zona segura, críticos 12 % (Aura doble, Heal doble tick, Buffer masivo; 1 buff por vez), un solo sonido por buff de grupo, sin «Puesto de», Shift+clic invertido (izq. ir, der. atacar). Blizzard: la magia solo daña monstruos (`hurt` en magicsys.js); no hay daño mágico a jugadores.
- [x] (v0.78.20) Pixie un poco más grande: `fit` 0.6 → 0.7 en evolutions.js.

- [x] (hecho en local, sin publicar) Bots y criptas (v0.78.6): con un piso despejado (p. ej. el 10) y el siguiente fuera de alcance (jefe, nivel o tope de misiones), el bot ya no vuelve a entrar al piso despejado: se prepara y reintenta; cuando puede, arranca directamente en el siguiente guardado (`delve.cleared+1`).  Además, tras despejar sin poder bajar, llega hasta la entrada del piso siguiente y vuelve en Recall (queda guardado como más hondo).
- [x] (hecho en local, sin publicar) Dirección fija con Tailscale Funnel: `server/config.json` con `tunnel:"tailscale"` y `publicUrl` `https://pablo.tail495855.ts.net`; `web/data/server.json` apunta a ella (ya no cambia en cada arranque, sin push). Probado: responde 200 desde internet.
- [x] Botín de los bots (v0.79.2): ya no recogen cualquier equipo del suelo (llenaban mochila y peso de basura y no cargaban lo bueno). `lootValue` (bot.js) lo juzga con `judge`: equipar > guardar/comerciar > vender solo si paga (más exigente con la mochila cargada); elige por valor/distancia, no por cercanía. Item level (itemlevel.js): cada atributo pesa según su efecto (afilado/antiguo/crítico/veneno en armas; absorción, defensa y resistencia mágica en armaduras; Light/Agile casi nada) en vez de un peso único. Test `bot-loot.test.mjs`.

- [x] (informe, sin cambios) Verificación de magos/invocadores contra el original: el único sistema de invocación del original es el hechizo Summon-Creature (`HG.cpp` ~10933, `MAGICTYPE_SUMMON`) y ya está portado fiel en `npcsys.js` `summonFor` (monstruo según Magery, máximo Magery/20 seguidores, no en zona de lucha, 300 s). Las bolas/compañeros de escuela, los hechizos lanzados por el summon y el mago a distancia de los bots NO existen en el original: son diseño propio y se mantienen como tal.
