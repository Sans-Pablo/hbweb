# Backlog (2026-10-13) — fidelidad al original, ventanas, estabilidad y funciones

Fuente: lista de peticiones del propietario del 2026-10-13, analizadas contra el código (`web/src`, `server/`) y `docs/DESVIOS.md`. Sustituye al TO-DO antiguo de `docs/ESTADO.md` (que queda como histórico).
Cada ticket lleva: **Entiendo** (mi reescritura del pedido, para confirmar que lo interpreté bien), **Hoy** (qué hay en el código), **Hacer** y **Listo cuando** (criterio de aceptación). Tamaño: S ≤ ½ día · M 1–2 días · L 3–5 días · XL > 1 semana.
🔎 = necesita el código original (`Game.cpp`, `HG.cpp`, `combat.cpp`), que **no está en el entorno de la nube**; se hace en el PC del propietario (ruta en `docs/ORIGINAL.md`) o con los trozos pegados.
❓ = tiene una pregunta abierta (resumen en §Decisiones).

## Orden recomendado
| Ola | Objetivo | Tickets |
|---|---|---|
| **0 · Bloqueantes** (testers no pueden jugar bien) | Estabilidad | EST-1…EST-5, BOT-1 |
| **1 · Proceso** (acelera todo lo demás) | Reportar fallos y ver tickets | WEB-1, WEB-2 |
| **2 · Quitar inventos y alinear con el original** | Fidelidad rápida | INV-1…INV-12 |
| **3 · Cimientos de ventanas** | Una sola base, bien hecha | WIN-1…WIN-8 |
| **4 · Migrar diálogos y ventanas** | Look and feel clásico | WIN-9…WIN-13, QST-1, QST-2, PET-1…PET-3 |
| **5 · Sistemas grandes** | Trade, login/cuentas, interfaz total, bots, auto | TRD-1, TRD-2, ACC-1, UI-1…UI-3, EST-6, BOT-2, AUT-1, AUT-2 |
| **6 · Ideas Olympia y extras** | Pulido | OLY-1…OLY-5, EXT-1…EXT-3 |

---

## Ola 0 · Estabilidad

### EST-1 · Mapa con huecos negros al entrar (carga) — P0 · M
- **Entiendo:** al hacer login se dibuja el mapa antes de que lleguen las losetas y salen cuadros negros. Quieres que se espere con un diálogo de carga hasta que esté todo, o que la carga mejore.
- **Hoy:** `renderer` omite las hojas no listas (`Sprites.ready`) y el bucle principal dibuja desde el primer fotograma; el *bundle* del mapa se pide en `streaming.js` sin bloquear la entrada. No hay señal de «todo cargado» (la ficha `carga.md` no la menciona).
- **Hacer:** (1) `Sprites.pending(keys)` + `gate` que cuente las hojas del área visible ±2 pantallas (losetas, monstruos cercanos, equipo del jugador); (2) pantalla de carga con barra (ventana nueva del sistema WIN) hasta que el *gate* cumpla, con tiempo máximo de 15 s y botón «Entrar igualmente»; (3) al teletransportar entre mapas, mismo *gate* corto con fundido. Se apoya en F0–F2 de `docs/PLAN_RENDIMIENTO.md`.
- **Listo cuando:** `perf/visual.py` no captura ningún píxel de relleno en las 4 escenas tras el *gate*; con red lenta (Playwright throttle 3G) no se ve ningún hueco, solo la barra.

### EST-2 · «Connection lost» al perder el foco — P0 · S
- **Entiendo:** si la pestaña lleva mucho sin foco, te desconecta; no debe pasar.
- **Hoy (causa probable, verificada leyendo el código):** el cliente manda `ping` con `setInterval` cada 2 s (`connection.js:126`) y el servidor corta a los 45 s sin mensajes (`server.mjs:66 IDLE_MS`). Los navegadores aplazan los temporizadores de pestañas en segundo plano (≥ 1/min; tras 5 min, mucho más), así que el ping no llega.
- **Hacer:** (a) el servidor manda *ping* de protocolo WebSocket cada 15 s (el navegador responde solo, sin JS ni temporizadores); `lastMsg` se actualiza con el *pong*; (b) pinger del cliente movido a un Worker; (c) al volver el foco, resincronizar el estado y no mostrar el cartel si la reconexión es inmediata; (d) `IDLE_MS` sigue protegiendo de conexiones muertas reales.
- **Listo cuando:** test Playwright que oculta la pestaña (`page.evaluate` + `document.hidden` simulado) 3 min y sigue conectado; prueba manual de 30 min en segundo plano.

### EST-3 · Tutorial bloqueado tras saltarlo y volver a entrar — P0 · S
- **Entiendo:** hiciste *skip*, entraste a la tienda, el tutorial reapareció y «Next» no responde.
- **Hoy:** estados `st` ("on"/"skip"/"done") en `tutorial.js`; `skipAll()` pone `st="skip"` en cliente y manda `tut/skip`, pero `restart`/`enter` y el estado que devuelve el servidor (`ev.st`, línea 33) pueden contradecirse; cualquier ventana nueva sobre el tutorial puede robar el clic.
- **Hacer:** reproducir con `tools/e2e.py` (skip → shop → mirar `hb.tutorial.st`), fijar una máquina de estados única (servidor manda, cliente solo pinta) y test en `tests/tutorial.test.mjs`. Se reescribe con el sistema de ventanas en WIN-14.
- **Listo cuando:** test reproduce el fallo antes del arreglo y pasa después; el tutorial nunca reaparece tras *skip* ni queda sin respuesta.

### EST-4 · Hover turquesa en la interfaz — P0 · S ❓
- **Entiendo:** al pasar el ratón por la UI aparece un color turquesa que no corresponde; sospechas falta un sprite.
- **Hoy:** no localizado; candidatos: fotogramas «hover» de `dialogtext_1`/`interface` que el conversor deja en color clave, o un `fillStyle` de reserva en `gui.js`/`window.js`. Necesito una captura (o el nombre del botón) para acotar.
- **Hacer:** `grep` de colores cian en `gui.js`, comparar fotogramas hover vs. `docs/SPRITES.md`; corregir sprite o conversor (`tools/convert_ui.py`).
- **Listo cuando:** ningún hover de la UI usa un color fuera de la paleta del original (revisado con captura por botón).

### EST-5 · Bajos fps — P0 · XL
- **Entiendo:** con pocos fps el juego no se puede jugar.
- **Hoy:** medido: 1 442 hojas / 1,5 GB decodificados al arrancar, fotogramas de hasta 1 s al teletransportar (`docs/PLAN_RENDIMIENTO.md`, `tools/perf/`). Además `perf.py` ya marca dibujo medio < 12 ms.
- **Hacer:** ejecutar el plan F0→F5; es un ticket marco. Añadir selector de calidad automática al final (baja efectos si fps < 30 sostenido).
- **Listo cuando:** metas del plan (§3) y p99 ≤ 40 ms al caminar con GPU real.

### EST-6 · Teletransporte y mapas poco claros (granja → ladera) — P1 · S
- **Entiendo:** no se sabe cómo pasar del mapa de farm a la ciudad (al menos a Aresden).
- **Hoy:** existen `teleport` y portales; no hay indicación en pantalla.
- **Hacer:** flecha/etiqueta en el minimapa al portal más cercano (como en el original se ve el teleport en el mapa), NPC o cartel sencillo en la granja. 🔎 comprobar cómo lo resuelve el original (Guide Map).
- **Listo cuando:** un jugador nuevo encuentra la salida sin ayuda en < 1 min (prueba con tester).

---

## Ola 1 · Proceso y herramientas web

### WEB-1 · Reportar un bug con F11 — P0 · M
- **Entiendo:** ventana de reporte rápido: el tester escribe una línea (texto libre) y se envía; después se revisa en la web en un panel de errores.
- **Hoy:** F11 hoy alterna `dialogtrans` (se elimina con WIN-4). No hay endpoint de reportes. El servidor tiene `server/data` (SQLite).
- **Hacer:** ventana WIN «Report a bug» (campo de texto, botón *Send*, casilla «incluir captura» activada); el cliente adjunta automáticamente: versión (`version.json`), cuenta/personaje, mapa y posición, últimos 50 mensajes de consola/eventos, ping y fps, captura del lienzo (opcional); `POST /api/report`; tabla `reports` con estado (nuevo/leído/resuelto). Límite de tasa por cuenta.
- **Listo cuando:** un tester envía un reporte en < 10 s y aparece en el panel con todos esos datos.

### WEB-2 · Menú web con Changelog y Backlog (sistema de tickets) — P1 · L ❓
- **Entiendo:** la web (la página del juego/`index.html`) tendrá menú con *Changelog* y *Backlog* para ver prioridades; yo (Claude) escribo ahí y marco los tickets como listos; además reescribo e interpreto cada ticket para comprobar que lo entendí.
- **Hoy:** el backlog vive en `docs/ESTADO.md`/`BACKLOG.md` y el changelog en `docs/CHANGELOG.md`; F1 muestra `news.json`. No hay vista web.
- **Hacer:** fuente única `web/data/backlog.json` (id, título, estado, prioridad, ola, «entiendo», criterios, enlace a reportes); `tools/backlog.py` genera `docs/BACKLOG.md` desde él y marca *hecho* en `release.sh`; página `backlog.html` (filtros por ola/estado, buscador) y `changelog.html` desde `CHANGELOG.md`. Los reportes de WEB-1 pueden convertirse en ticket con un clic. Quién puede editar: solo yo vía commits (la web es de solo lectura) salvo que quieras edición en línea.
- **Listo cuando:** `release.sh` falla si un ticket marcado «hecho» no tiene entrada de changelog; la web muestra el estado en vivo.

---

## Ola 2 · Quitar inventos y alinear con el original

> Criterio general (**decisión pendiente ❓**): se eliminan los inventos **de interfaz y de mensajes**. Los inventos de **jugabilidad** (pets/summons, granjas, criptas, quests propias, bots, críticos Alt+clic, dash) no se eliminan sin tu confirmación explícita: hoy son la base del port. `docs/DESVIOS.md` §0–§5 es el inventario de partida.

### INV-1 · Auditoría de inventos — P1 · M ❓
- **Entiendo:** recorrer todo hbweb para listar y quitar lo que no existe en el original.
- **Hoy:** `docs/DESVIOS.md` ya clasifica 20+ filas ➕. Los de interfaz que conozco: texto de exp sobre la cabeza (`fx.js:106`), nombre del mapa al entrar, botones *Recall* y *Summons* en la barra (`gui.js:354`, «inventos del port»), F1 «Para probar/A tener en cuenta» (`newswin.js`), minimapa en esquina fija, tutorial, F11 transparencia, opciones de luz/cursor/hechizos, mensajes de «Failed» en golpes, banners y avisos varios en `hud.js`.
- **Hacer:** tabla en `DESVIOS.md` con tres columnas: *interfaz/mensaje* (se quita), *jugabilidad* (se pregunta), *herramienta de pruebas* (se queda detrás de debug). Una subtarea por elemento de la tabla (INV-2…INV-12 son los primeros).
- **Listo cuando:** `DESVIOS.md` §«Inventos» completo, cada fila con decisión tuya (quitar/mantener/mover a debug).

### INV-2 · Quitar el texto de exp sobre la cabeza — P1 · S
- **Entiendo:** el «+N exp» flotante es invento; fuera.
- **Hoy:** `fx.js:106` (`case "exp"`).
- **Hacer:** eliminar el caso; la exp ya se ve en la barra y en el log de sistema como en el original.
- **Listo cuando:** ningún texto flotante de exp; test de eventos sin regresión.

### INV-3 · Quitar el nombre del mapa al entrar — P1 · S
- **Hoy:** `renderer.mapName` + aviso al cambiar de mapa (buscar en `hud.js`/`main.js`).
- **Hacer:** eliminar el banner. 🔎 Confirmar qué muestra el original al entrar (mensaje de sistema en el chat).
- **Listo cuando:** sin banner; el nombre del mapa solo en el minimapa/ventana de mapa como en el original.

### INV-4 · Sin mensaje «Failed» en golpes comunes fallados — P1 · S ❓
- **Entiendo:** si un ataque de golpe común falla, no mostrar nada.
- **Hoy:** `fx.js:87` (`miss`) y `fx.js:105` (`resist`) dibujan « * Failed! * » (el comentario dice que viene de `OBJECTDAMAGE` del original con daño 0). Ojo: el original sí lo muestra; tu decisión pesa más que el original aquí.
- **Hacer:** quitar solo `miss` de melee/arco; mantener `resist` (hechizo resistido) salvo que digas lo contrario. ❓ confirmar.
- **Listo cuando:** un golpe fallado no dibuja nada; el sonido de fallo sigue.

### INV-5 · Nombre del hechizo sobre el personaje al lanzar — P1 · S ❓
- **Entiendo:** en el original aparece el nombre de la magia sobre la cabeza al castear; en el port no.
- **Hoy:** `DESVIOS.md` §2 lo marca ❌ pero la fila de fuentes dice ✅ en el resumen: se contradicen. `fx.js` tiene `sprFontDraw` con la fuente de sprites. No encontré `castName` en `client/`.
- **Hacer:** en el evento de lanzamiento (`cast`), `fx.text(id, nombre + "!", rojo, …)` tipo 41/42, sube y se desvanece. 🔎 verificar color/duración en `Game.cpp` (`OBJECTMAGIC`).
- **Listo cuando:** al lanzar un hechizo, jugadores y NPC muestran su nombre, idéntico al original.

### INV-6 · Sin auto-ataque a jugadores, bots ni pets — P1 · S
- **Entiendo:** el auto-ataque (mantener Ctrl / `autoAttack`) solo funciona contra enemigos, para evitar abuso en PvP.
- **Hoy:** `controller.js:201`: `(this.ctrl || this.ui.autoAttack) && ent` ataca a cualquier entidad.
- **Hacer:** filtrar por `kind === "npc"` hostil; contra jugadores/bots/pets/ciudadanos solo ataque manual por clic. Test.
- **Listo cuando:** Ctrl+clic sobre otro jugador no inicia ataque repetido; sobre un monstruo sí.

### INV-7 · No se puede hacer la reverencia a otro jugador en modo paz — P1 · S 🔎
- **Entiendo:** (la «reverencia» es la emote/bow hacia otro personaje) no debe poder hacerse a otro jugador en modo paz (como en el original).
- **Hoy:** no localizado el comando de emote; buscar `bow`/`emote` en `world.js`/`controller.js`.
- **Hacer:** 🔎 leer la regla en `HG.cpp` (acción `DAMAGE_TYPE`/«Pose»); replicarla en el servidor y rechazar con el mensaje original.
- **Listo cuando:** test: en paz, la reverencia al otro jugador se rechaza.

### INV-8 · Críticos (golpe especial del guerrero) mal implementados — P1 · L 🔎
- **Entiendo:** el sistema de críticos/«super ataque» hay que rehacerlo igual que el servidor base.
- **Hoy:** `combatsys.js` (carga `CRIT`, `chargeCritTick`, Alt+clic gasta carga, alcance ampliado) y dash; `DESVIOS.md` §1 anota «Críticos con Alt+clic, dash: no existe en el original» pero `docs/ORIGINAL.md` cita `SuperAttack`/`bIsDash` en `char/combat.cpp`, `Client.h` y `Game.cpp`: **hay contradicción**, y la nota «pendiente de revisar contra esta fuente» sigue abierta.
- **Hacer:** 🔎 leer `combat.cpp` (`m_iSuperAttackLeft`, `m_iSuperAttackCount`, Alt, `bIsDash`) y documentar el algoritmo en `docs/sistemas/critico-dash.md`; reescribir `combatsys.js` copiándolo (cargas, daño, requisitos de arma, animación); borrar lo propio (`chargeCrit` de armaduras, alcance inventado).
- **Listo cuando:** tests comparan, con tablas extraídas del original, daño y cargas para cada arma/skill; la ficha cita funciones y líneas.

### INV-10 · Pasar todo lo «traído del original» a una lista de paridad — P2 · M 🔎
- **Entiendo:** «tienes que traer todas las mecánicas al juego nuevo; los usuarios están acostumbrados a lo clásico». Y: «revisa código, implementa servidor lo necesario; si hay implementaciones nuestras, píscalas con las originales».
- **Hoy:** `DESVIOS.md` calcula ~47 % de NPC, ~48 % de mapas, 0 guerra/bandos/PK-UI, ventanas de guerra y slates ausentes.
- **Hacer:** convertir `DESVIOS.md` en tickets de paridad por área (combate ✅, magia ✅, **bandos**, **PK/criminal UI**, **guerra**, **slates**, **fishing**, mapas y NPC que faltan, **comandos de chat**, **hotkeys** INV-11), con prioridad tuya. Ticket marco; no empezar sin orden por área.
- **Listo cuando:** cada área con un % de paridad medible y su ticket.

### INV-11 · Comandos y atajos del original (wiki Commands and Hotkeys) — P1 · M 🔎 ❓
- **Entiendo:** que los atajos de teclado y los comandos de chat sean idénticos al wiki de helbreath.net.
- **Hoy:** el entorno de la nube no puede abrir `helbreath.net` (probado: sin resolución de nombre). Atajos actuales (`main.js:419-467`): F1 novedades (invento), F2/F3 atajos, F4 hechizo, F5 personaje, F6 inventario, F7 libro, F8 habilidades, F9 chat, F10 pets (invento), F11 transparencia (invento), F12 opciones, Tab modo combate, Ctrl+E comerciar, Esc, Enter.
- **Hacer:** necesito el texto del wiki (pégalo o guárdalo en `docs/original/hotkeys.md`) y, mejor, el `Game.cpp` (`bCheckHotKey`/`OnKeyDown`). Con eso: tabla original → implementado/falta/conflicto, y reasignar los inventos (F1, F10, F11) a teclas libres o a la UI.
- **Listo cuando:** `tests/hotkeys.test.mjs` recorre la tabla y simula cada tecla/comando; los inventos no pisan ninguna tecla original.

### INV-12 · Matar «Para probar» y «A tener en cuenta» de F1 — P2 · S
- **Entiendo:** quitar esas pestañas de la ventana F1.
- **Hoy:** `newswin.js` y `news.json` con 4 pestañas (Novedades, Para probar, A tener en cuenta, Herramientas).
- **Hacer:** dejar solo Novedades (y Herramientas en debug); mover «Para probar» a tickets de WEB-2. Actualizar `docs/sistemas/novedades.md` y la regla de `CLAUDE.md` («cada cambio visible se anota en news.json» sigue valiendo para Novedades).
- **Listo cuando:** F1 sin esas dos pestañas; `release.sh` ya no exige casillas de prueba.

---

## Ola 3 · Cimientos del sistema de ventanas

> Base: `client/window.js` (373 líneas, `THEME`, `Win`, widgets `text/para/head/rule/btn/check/slider/input/combo/scroll/Flow`). Ficha: `docs/sistemas/ventanas.md`. Todo lo de Ola 4 depende de aquí.

### WIN-1 · Márgenes y rejilla definidos en el sistema — P1 · M
- **Entiendo:** hay textos solapados y márgenes izquierdos pegados al borde; definir márgenes una vez para todas.
- **Hoy:** `window.js` no exporta constantes de margen (no hay `PAD`); cada ventana coloca a mano (`ui.text(24, …)`).
- **Hacer:** `LAYOUT = { padX, padTop, padBottom, gap, rowH, titleH }` calculado del marco `gamedialog_1`; `inner` ya es el área útil, hacerlo obligatorio; `Flow`/`Column`/`Row` con medida de texto y **recorte con elipsis** (nunca solapar); auditoría que detecta textos fuera de `inner` en `tests/`.
- **Listo cuando:** ninguna ventana dibuja a menos de `padX` del borde; test de solapes en las ventanas registradas.

### WIN-2 · Botones «OK/Cancel» sin pixelado — P1 · M
- **Entiendo:** el botón OK se ve muy pixelado; rediseñarlo.
- **Hoy:** botones de piedra de `dialogtext_1` escalados (`BTN`), con `imageSmoothing`.
- **Hacer:** botón de 9 cortes dibujado a la escala del lienzo, con texto de la fuente nueva (WIN-3) y estados (reposo/hover/pulsado/desactivado) al estilo «cuadrado neutro que se activa al hover» del original (ver WIN-5); versión HD de los marcos a partir del original con `tools/remaster_ui.py`.
- **Listo cuando:** captura a 1× y 2× sin bordes escalonados; todos los `ui.btn` usan el botón nuevo.

### WIN-3 · Fuente nueva para textos como «Failed» y pixelados — P2 · M ❓
- **Entiendo:** remasterizar con IA los textos en fuente de sprites (los «Failed», números de daño) o generar una fuente parecida más nítida.
- **Hoy:** `fx.js sprFontDraw` usa la hoja `interface2_1` ampliada; los textos de ventana usan fuente del sistema con sombreado.
- **Hacer:** opción A (recomendada): fuente vectorial (TTF/WOFF2) que imite la del original, generada a partir de los glifos (95 caracteres) por trazado + limpieza, con contorno/sombra; opción B: reescalado IA de los glifos (artefactos en tamaños pequeños). Una sola `font.js` para daño, chat y ventanas.
- **Listo cuando:** daño, chat y ventanas con la fuente nueva y nítidos a cualquier zoom.

### WIN-4 · Reducir opciones de Interfaz / Gráficos — P1 · M ❓
- **Entiendo:** solo 2 modos, *remastered* o *legacy*. Quitar: luz viñeta, luz dinámica, desactivar animaciones de hechizos (siempre on), volver al cursor (siempre el clásico), transparencia de cuadros. *Legacy* = sin ningún cambio; todos los cambios aplican en *remastered*.
- **Hoy:** `main.js:291-306` y `dialogs.js:411` con `lighting`, `lightFx`, `spellFx`, `classicCursor`, `Transparencia de cuadros`; F11 conmuta `dialogtrans`; `hdSprites` además.
- **Hacer:** eliminar esas opciones y sus ramas; decidir el valor fijo de cada una en *remastered* (❓ **¿luz/viñeta/luz dinámica quedan activas o se eliminan del todo?** «Remueve luz viñeta» es ambiguo). Cursor clásico siempre. Hechizos siempre on. Transparencia: valor del original. *Legacy* congela renderer, UI, sprites y sonido al estado original (sin sombras largas, sin HD, sin luces). Migrar partidas guardadas con opciones antiguas.
- **Listo cuando:** menú Gráficos con un solo selector Remastered/Legacy; test de migración de `opts`.

### WIN-5 · Estilo «cuadro neutro que se activa al hover» — P2 · M
- **Entiendo:** la UI original usa cuadrados en color neutro que se «activan» con el ratón; todas las ventanas que usen este recurso deben comportarse igual.
- **Hoy:** la barra inferior original lo hace con sprites; `window.js` usa botones de piedra sin ese comportamiento para listas e iconos.
- **Hacer:** widget `Tile` (icono cuadrado, estado neutro/hover/activo/desactivado, tooltip) reutilizable en pestañas (PET-2), listas (WIN-6) y barra.
- **Listo cuando:** pestañas de ventanas y listas usan `Tile`; hover idéntico en todas.

### WIN-6 · Widget «Lista de objetos» (sprite + datos + clic) — P1 · L
- **Entiendo:** una forma «Lista–Objeto» reutilizable (tienda, comercio, bolas, etc.): a la izquierda el sprite (animado), a la derecha nombre y datos, clic para abrir la ficha.
- **Hoy:** no existe; cada ventana de lista (tiendas en `npcdialogs.js` 580 líneas, bolas en `petdialog.js`) dibuja a mano.
- **Hacer:** `ui.list({items, row:(it)=>…, onSelect, search})` con filas de altura fija, miniatura animada (caminando/atacando para monstruos), cuadrícula opcional, scroll con rueda y barra, teclado (↑↓ Enter), selección y *tooltip*.
- **Listo cuando:** tienda, warehouse, herrero, bolas, trade y quests usan el widget.

### WIN-7 · Buscador por texto en listados — P2 · S
- **Entiendo:** shop, blacksmith, warehouse y toda ventana con listado deben tener búsqueda.
- **Hoy:** `combo` ya filtra (lista con filtro).
- **Hacer:** `list({search:true})` con campo arriba (filtra por nombre y por efecto), atajo de teclado `/`, recuerda el texto por ventana.
- **Listo cuando:** buscar «sword» en la tienda filtra en < 1 fotograma.

### WIN-8 · Ventanas responsive y arrastrables hasta los bordes — P2 · M
- **Entiendo:** todas las ventanas deben adaptarse al tamaño (la mini ventana de quests no se redimensiona) y poder arrastrarse hasta el borde de la pantalla; ahora la resolución lo impide. Además, extender el área de juego y la barra inferior hasta los bordes.
- **Hoy:** lienzo lógico 800×600 (regla 7) escalado; las ventanas no se salen del 800×600 y la barra inferior es de 640 px. Arrastre limitado.
- **Hacer:** (1) área lógica dinámica: ancho/alto según la ventana del navegador (manteniendo 4:3 de la interfaz solo en el marco); la barra inferior se extiende (tiling del sprite) hasta los bordes; (2) `Win` acepta `minW/minH/resizable`, restricciones por pantalla y se reacomoda al cambiar tamaño; (3) *snap* a bordes. 🔎 comprobar cómo el original maneja 800×600 vs. 1024+ (el original fija la resolución).
- **Listo cuando:** `tools/e2e.py` en 1280×800, 1920×1080 y móvil: ninguna ventana queda fuera de pantalla ni se corta; se puede arrastrar hasta cada borde.

---

## Ola 4 · Migrar diálogos y ventanas

### WIN-9 · Reimaginar/reemplazar todos los diálogos con el sistema nuevo — P2 · XL ❓
- **Entiendo:** todos los diálogos del juego (tienda, herrero, almacén, NPC, party, guild, etc.) deben usar el sistema de ventanas nuevo; el diálogo de la cripta y el chat **se quedan como están**.
- **Hoy:** coexisten `gui.js` (diálogos del original por ID), `dialogs.js`, `npcdialogs.js`, `classicdialog.js`, `window.js`, paneles HTML heredados (`hud.js`: `#charpanel/#inv/#book`), `questui.js`, `petdialog.js`, `guild.js`, `party.js`, `stall.js`, `trade.js`.
- **Hacer:** inventario (tabla) de cada diálogo → migración en lotes de 3–4 con captura antes/después; eliminar los paneles HTML.
- **Listo cuando:** `grep` de `createElement("div")` de paneles = 0; todas las ventanas pasan el test de márgenes.

### WIN-10 · Sistema de diálogos con historial/opciones («history line») — P2 · L
- **Entiendo:** el *history line* debe ser un sistema para armar buenos diálogos (opciones, ramas).
- **Hoy:** `tutorial.js` (líneas, `typing`) y `npcdialogs.js` por separado.
- **Hacer:** motor `Dialogue` (nodos: texto, opciones, condiciones, acciones, retratos) con historial desplazable; el tutorial, los NPC y las quests lo usan.
- **Listo cuando:** el tutorial y 3 NPC (guía, herrero, healer) reescritos sin código ad hoc.

### WIN-11 · Sprites/retratos para diálogos (Gandalf del tutorial) — P3 · M ❓
- **Entiendo:** generar o importar retratos para los NPC de diálogo.
- **Hoy:** el tutorial usa texto; hay sprites de NPC en `sprites/`.
- **Hacer:** retrato por NPC (recorte del sprite en alta resolución o ilustración con IA coherente); campo `portrait` en `Dialogue`.
- **Listo cuando:** retrato visible en el tutorial y NPC principales.

### WIN-12 · Mini-ventana de misiones con estilo Helbreath — P2 · S
- **Entiendo:** la mini ventana de quests (arriba a la derecha) tiene un estilo inventado; hacerla clásica.
- **Hoy:** `questui.js` (67 líneas) y bloque de estados en `gui.js:519-547`.
- **Hacer:** misma moldura que las ventanas, con `Win` redimensionable (WIN-8).
- **Listo cuando:** coincide visualmente con el resto de ventanas.

### WIN-13 · F5: el color de pelo no coincide con el sprite — P2 · S
- **Entiendo:** en la ventana F5 (personaje) el color de pelo es distinto al del sprite en el mundo.
- **Hoy:** `create.js` usa `HAIR_COLORS[hairCol]` y `look.js drawPerson`; la ventana F5 y el renderer del mundo pueden teñir con tablas distintas (a confirmar con captura).
- **Hacer:** una sola función `hairTint(hairCol)` compartida por creación, F5 y mundo; test que compara los píxeles.
- **Listo cuando:** los 16 colores salen iguales en las tres vistas.

### QST-1 · Rehacer la ventana de quests — P2 · M ❓
- **Entiendo:** revamp con el constructor nuevo; botón en la UI para abrirla y quitarla de F5; toggle en la ventana para mostrar/ocultar el minipanel de quests.
- **Hoy:** acceso desde el diálogo `15` (botón «Quest» en `dialogs.js:56-62`) y `questui.js`. Las quests (22/clase) son **invención** (`DESVIOS.md` §6) mientras el original tiene 151 en `Quest.cfg`. ❓ ¿se mantienen las quests propias?
- **Hacer:** `Win` con lista (WIN-6): activas / completadas / disponibles, detalle a la derecha, botón «Seguir» (toggle del minipanel), botón nuevo en la barra de la UI.
- **Listo cuando:** quests se abre desde el botón de la UI; F5 sin pestaña de quests.

### QST-2 · Mover el indicador de quests bajo el minimapa — P2 · S
- **Hoy:** panel de estados en `gui.js:547` (`y = 164`, «bajo el minimapa»); el minimapa de la esquina puede ser mayor (cripta).
- **Hacer:** anclar a la altura real del minimapa (`miniH + margen`), y a 0 si no hay minimapa.
- **Listo cuando:** sin solapes en ningún mapa.

### PET-1 · Nuevo botón de la barra para pets — P2 · S
- **Entiendo:** la garra gusta pero se superpone sobre otro botón y se ve el de abajo en el hover; generar uno nuevo.
- **Hoy:** botones «Summons» y «Recall» añadidos a la barra (`gui.js:354`, «inventos del port»).
- **Hacer:** botón propio con sprite nuevo (`tools/remaster_ui.py` o ilustración propia) en un hueco libre, con los tres estados (reposo/hover/pulsado) y sin superposición. Recall se quita (WIN-4/INV-1: usar el skill).
- **Listo cuando:** captura de los 3 estados sin restos del botón de debajo.

### PET-2 · Hospital de compañeros: pestañas usables con iconos — P2 · M
- **Entiendo:** las pestañas superiores se bugean/son difíciles de clicar; usar iconos cuadrados (como los de la UI) para «Cuidados», «Bolas», etc.
- **Hoy:** `petdialog.js`.
- **Hacer:** pestañas con `Tile` (WIN-5), áreas de clic de ≥ 32 px, icono + tooltip.
- **Listo cuando:** test de clics por pestaña; sin zonas muertas.

### PET-3 · Listado de bolas con sprite animado — P2 · M
- **Entiendo:** a la izquierda el sprite del monstruo caminando (algo más grande) o cuadrados con el monstruo atacando en medio; al clicar se abre la ficha de la pet.
- **Hoy:** lista de texto.
- **Hacer:** `list` de WIN-6 con miniatura animada (`anim.js`) y ficha de pet al seleccionar. Reutilizar en tienda/trade.
- **Listo cuando:** la lista de bolas muestra el sprite animado y abre la ficha.

---

## Ola 5 · Sistemas grandes

### TRD-1 · Rehacer el trade copiando el del original — P1 · L 🔎
- **Entiendo:** revamp completo; copiar el sistema de Helbreath Olympia; arrastrar un item sobre otro personaje abre la ventana de exchange como en el original.
- **Hoy:** `shared/systems/trade.js` (102 líneas) y `client/trade.js` (127); inicio por Ctrl+E o `/trade nombre` (`main.js:348-353`), no por arrastrar. El original usa `DrawDialogBox_Exchange` y sus mensajes de red (🔎 leer los nombres exactos).
- **Hacer:** protocolo del original (solicitar → ambos aceptan → confirmar → ejecutar), arrastrar sobre jugador abre la ventana con el item ya colocado, hasta 4 casillas + oro, reglas de distancia/muerte/PK; ventana nueva con WIN-6.
- **Listo cuando:** `tests/trade.test.mjs` cubren cancelaciones, desconexión y duplicados; funciona online (`net-*`).

### TRD-2 · Qué pasa si no hay espacio en la bolsa — P1 · M ❓
- **Entiendo:** definir el comportamiento cuando el receptor no tiene espacio; ¿bolsa extra o cola de recepción?
- **Hoy:** `bag` limitada a 50 casillas (`MAX_ITEMS`); el trade rechaza al llenar.
- **Hacer:** **recomendación:** rechazar antes de confirmar mostrando «Bag full» al receptor (comportamiento original), y como extra, buzón con cola (máx. 10, caduca) para correos y compras. ❓ elegir: (a) rechazo clásico, (b) cola, (c) bolsa extra.
- **Listo cuando:** ningún objeto se pierde ni se duplica con bolsa llena; test.

### ACC-1 · Login, cuentas y 4 personajes como el servidor original — P1 · XL 🔎
- **Entiendo:** implementar el sistema de login/cuenta del servidor original (hasta 4 personajes, selección, borrado, etc.).
- **Hoy:** cuenta + 1 personaje; `server/data` por usuario; `create.js` (creación), `accounts.js`; `Helbreath.LoginServerConsole` separado en el original.
- **Hacer:** 🔎 leer `LoginServerConsole` (mensajes `MSGID_REQUEST_LOGIN`, `CREATENEWCHARACTER`, `DELETECHARACTER`, `ENTERGAME`, `CHANGEPASSWORD`); pantallas del cliente original (login, selección de personaje con 4 ranuras, creación, borrado con confirmación); servidor con tabla `accounts` → `characters (max 4)`; migración del personaje único; protocolo versionado (`NET_PROTO`).
- **Listo cuando:** crear/borrar/entrar con 4 personajes; `online.test.mjs` y `net-*` verdes; migración probada.

### UI-1 · Copiar la interfaz total del original (chat, barra, ventanas) — P1 · XL 🔎
- **Entiendo:** el chat en el original no está abajo a la izquierda; copiar la interfaz completa.
- **Hoy:** el chat es propio (`hud.js`, `gui.js` diálogo 10); la barra inferior original está implementada (diálogo `GameMenu`/barra 640 px). El cuadro de chat original es `DrawChatMsgBox` (arriba/medio, 5 líneas fijas) y el campo de entrada está sobre la barra.
- **Hacer:** 🔎 extraer posiciones y tamaños de `Game.cpp` (`DrawBackground`, `DrawChatMsgBox`, `m_stDialogBoxInfo`), crear `docs/sistemas/interfaz-original.md` con las coordenadas, y reubicar el chat y demás elementos; extender la barra a los bordes (WIN-8).
- **Listo cuando:** captura lado a lado con el cliente original sin diferencias de posición > 2 px.

### UI-2 · Minimapa: reescalar en mapas pequeños y moverlo como el original — P2 · M 🔎
- **Entiendo:** en la cripta (mapa pequeño) el minimapa debe reescalarse para mostrar todo bien; y en el original el minimapa se puede mover en pantalla.
- **Hoy:** `view.mapStyle = "corner"` fijo; `miniOn()` lo oculta en interiores; el tamaño no se adapta al mapa.
- **Hacer:** escala = min(maxW/mapW, maxH/mapH) por mapa; arrastrar el minimapa (🔎 ver cómo lo hace el original) con posición guardada.
- **Listo cuando:** cripta, granja y ciudad se ven completas; se puede arrastrar y recuerda la posición.

### UI-3 · Mensaje «Salir de la cripta: E» solo al pasar sobre la entrada — P2 · S
- **Hoy:** aviso fijo en HUD (buscar `crypt-exit`/`cryptentry`).
- **Hacer:** mostrar el texto solo con *hover* sobre la entrada/salida (tooltip en el cursor).
- **Listo cuando:** sin aviso permanente; aparece al apuntar.

### BOT-1 · Bots se vuelven locos al soltar un objeto al suelo — P0 · S
- **Entiendo:** al dropear un item todos los bots corren a cogerlo.
- **Hoy:** `shared/systems/bot.js` + `botitems.js` (`judge/manage/wish`) deciden recoger sin reservar el objeto.
- **Hacer:** reserva por objeto (`ground.claim(item, botId)`), solo el más cercano y que lo desee; los demás ignoran; objeto soltado por un jugador tiene prioridad para ese jugador y sus aliados.
- **Listo cuando:** test con 10 bots y un objeto: solo uno va a por él.

### BOT-2 · Sistema de obediencia — P2 · XL ❓
- **Entiendo:** los bots tienen obediencia variable; siguen órdenes del jugador («vamos a matar slimes» → te siguen; «vamos a hacer EKs» → raid juntos). Hay un glosario de órdenes. Si no entienden, preguntan; si siguen sin entender, se crea un ticket «el bot X no entendió esto del jugador Y» con el texto, para enseñarle.
- **Hoy:** `bot.js`, `builds.js`, `leisure.js`, `tests/bot-*.test.mjs` (chat de bots `bot-chat.test.mjs`).
- **Hacer:** (1) `obedience` por bot (0–1) con rasgos; (2) intérprete de órdenes: glosario `data/bot-orders.json` (patrones es/en → intención + parámetros: cazar X, seguir, esperar, EK, shop, descansar, loot); (3) máquina de estados `Order` que gobierna el bot; (4) aclaración: pregunta una vez; si falla, ticket automático al sistema WEB-1/WEB-2 con el texto; (5) panel/herramienta para enseñar la regla.
- **Listo cuando:** 10 órdenes del glosario ejecutadas por bots en test; fallos de comprensión aparecen como tickets.

### AUT-1 · Auto-caza (auto hunt) — P2 · L ❓
- **Entiendo:** dejar al personaje matando un tipo de criatura en un pit.
- **Hoy:** nada; los bots tienen lógica similar (`bot.js`).
- **Hacer:** reutilizar el cerebro del bot para el jugador: elegir especie, radio de patrulla, reglas de seguridad (HP < X → huir/pausar, drops, bolsa llena, muerte), límite de tiempo y ventana de estado; solo contra enemigos (INV-6). ❓ ¿también online? (riesgo de abuso/economía).
- **Listo cuando:** el personaje caza 10 min un tipo sin morir; se detiene con bolsa llena/HP bajo.

### AUT-2 · Auto-run a destinos (almacén, tienda, etc.) — P2 · M
- **Hoy:** el pathfinding existe (`shared/path.js`, `controller.js` con `intent`).
- **Hacer:** menú «Ir a» (ventana de mapa) con NPC/puntos conocidos; recorrido automático, cancelable con cualquier tecla.
- **Listo cuando:** del centro a la tienda/almacén sin intervención.

---

## Ola 6 · Ideas de Olympia y extras

> Olympia (Discord `hbolympia`): **no puedo acceder** desde aquí (red restringida y Discord con sesión). Hace falta que subas capturas al repo (`docs/original/olympia/`) o me las pegues.

### OLY-1 · Bolsa invisible — P3 · M ❓
- **Entiendo:** la bolsa sin marco (solo los objetos).
- **Hacer:** modo de la ventana de inventario sin fondo (con la imagen de Olympia como referencia).
### OLY-2 · Estadísticas de objetos con el formato de Olympia — P3 · M ❓
- **Hoy:** tooltips propios.
- **Hacer:** copiar el formato de la captura (orden y color de líneas); `names.js` + tooltip de ventana.
### OLY-3 · Mini sprite del monstruo en cada pit — P3 · S
- **Entiendo:** en cada entrada de zona (pit) mostrar el sprite de su monstruo. **Hacer:** icono animado en el selector de pits y en el minimapa.
### OLY-4 · Simulador de stats — P3 · M
- **Entiendo:** ventana que muestra cómo quedaría un personaje al repartir puntos/equipo. **Hoy:** `respec.js`, `attributes.js`, `rules.js`. **Hacer:** simulación pura en `shared/` (reutiliza `recalc`) y ventana con sliders; no toca el personaje real.
### OLY-5 · Varias mejoras visuales — P3 · L ❓ (sin acceso al material).

### EXT-1 · Pescados dan stats a summons y los productos de farming curan — P2 · S
- **Entiendo:** hoy el farming da cosas con más facilidad que la pesca; cambiar para que los peces den stats a los summons y los productos de farming curen.
- **Hoy:** `summonfood.js`, `fishing.js`, `farming.js` (ficha `summonfood.md`).
- **Hacer:** invertir la tabla de efectos en `summonfood.js`; ajustar `balance.json`; migrar objetos ya existentes.
- **Listo cuando:** tests de `summonfood`/`farming` actualizados; el balance de obtención documentado.

### EXT-2 · Mage full para pruebas con 100 % de skill en magia — P3 · S
- **Hoy:** `debug.js fullmage` pone stats a 200, aprende todos los hechizos y quita el coste de maná, pero **no toca la habilidad de magia** (`p.skills`). Existe `skills` (dbg) que fija todas a N.
- **Hacer:** que ponga `skills.magic = 100` (y maestría).
- **Listo cuando:** `fullmage.test.mjs` verifica skill 100.

### EXT-3 · Recall: quitar el botón y usar el skill — P2 · S
- **Entiendo:** que se use el skill (hechizo/pergamino de Recall del original) y no el botón añadido.
- **Hoy:** `main.js:526,532` (`recall: () => conn.send({t:"recall"})`), `gui.js:354`, eventos `recalling/recalled` en `hud.js`.
- **Hacer:** 🔎 ver cómo el original lo da (hechizo «Recall» de `Magic.cfg` o ítem); quitar botón y comando; conservar la mecánica de «quedarse quieto N segundos» si es la del original.
- **Listo cuando:** sin botón; recall disponible como hechizo/ítem.

---

## Decisiones que necesito (resumen)
1. **Inventos de jugabilidad** (pets/summons, granjas, criptas, quests propias, bots, Alt+clic/dash, puestos de venta): ¿se mantienen? Propuesta: se mantienen todos salvo lo que digas; se eliminan solo los de interfaz y mensajes (INV-1).
2. **Luz/viñeta/luz dinámica** (WIN-4): ¿quitar el efecto o quitar solo el interruptor y dejarlo fijo en *remastered*? Propuesta: dejarlo fijo en *remastered* y apagado en *legacy*.
3. **«Failed»** (INV-4): quitar solo el fallo de golpe común; el *resist* de hechizos se mantiene.
4. **Comercio sin espacio** (TRD-2): rechazo clásico + buzón con cola para compras/correo.
5. **Auto-caza online** (AUT-1): ¿solo local o también online con límites?
6. **Fuentes que no puedo leer desde la nube:** `Game.cpp`/`HG.cpp`/`combat.cpp`, wiki de hotkeys, Discord/Olympia. Trabajo marcado 🔎 requiere que corra en tu PC o que me pegues los fragmentos.
