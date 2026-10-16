# Estado del proyecto

**Hecho:** granja de Aresden jugable; combate con fórmulas del servidor original; ítems originales (568 de Item.cfg), mochila de 50 casillas, peso, equipar con requisitos, absorción por parte del cuerpo, durabilidad (solo con bando), botín con las tasas originales (1/1), habilidades con maestría, resistencia, hambre; opciones (Esc), mapa tipo Diablo II, correr con R, guardado en el navegador.

**Pendiente:** ver el Backlog más abajo (el listado antiguo estaba desfasado).

## Hilo MOTOR/COMBATE (pedido 2026-10-15)
- [x] 1 Críticos: contador en HUD (v0.84.11); la lógica ya coincidía con el original. [x] 2 Pretend Corpse (v0.84.12, docs/sistemas/pretend-corpse.md). [x] 3 Paralyze (v0.84.13, docs/sistemas/paralyze.md). [x] 6 Efecto de protección (v0.84.16), [x] 7 Sin indicador de tiempo sobre la cabeza (v0.84.17) [x] 5 Granjas enemigas (v0.84.15 farm-side) [x] 8 Dash arreglado (SP > 0, Shift cuenta como correr) y [x] 9 sin controles Shift del summon (v0.84.18) [x] 4 Magia sin daño (v0.84.14, objetivo en movimiento; fórmulas de acierto/resistencia ya coincidían con el original).
- [ ] Pendiente (pedido 2026-10-15): reimplementar el control de pet/summon (ir a casilla / atacar) con otra tecla; Shift queda libre para la mecánica original (v0.84.18). Cierre 2026-10-15 (v0.84.19): Alt-resaltado del crítico, recall forzado fuera de granja enemiga, Paralyze por daño mágico, Pretend Corpse con cadáver; verificado en localhost.
- [x] (pedido 2026-10-16, v0.85.12) Fidelidad 24 botín: drops.js desde HG.cpp:29315 (sin corte débil). Pendiente 25 exp, 26 npc.json/spawns, 27 generador, 28 mobs aleatorios, tarea 5 cliente.
- [x] Backlog motor (v0.85.5): sonidos de arma por tipo; combate revisado contra el original (furia no duplica crítico, critBonus, dash sin gasto de SP); "Connection lost" en segundo plano arreglado (reconexión automática y resync). Sin verificar en navegador real con pestaña dormida.

## Hilo UI (pedido 2026-10-15, v0.83.7)
- [x] (backlog nuevo UI, v0.85.0) 1 sin elegir personaje · 2 chat nuevo · 3 rastreador+opción · 4 ventanas movibles (lienzo y rastreador; chat/log Legacy DOM no, borde exacto sin probar) · 5 buscadores (tienda verificada de punta a punta; almacén y hospital se ven; compañeros sin filas sin probar) · 6 fuente homogénea · 7 hospital: ClassicDialog con pestañas + buscador (no es un Win) · 8 bordes de barras · 9 flechas de dirección opcionales (apagadas) · 10 texto de hechizo con fuente original. Ficha: docs/sistemas/buscadores.md.
- [x] 1 hover turquesa (solo la huella) · [x] 2 tutorial (reaparece/bloqueo; sin verificar en vivo la tienda) · [~] 10 opciones limpias hecho; falta modos solo Remastered/Legacy y F1 ON/OFF (son órdenes del servidor, no UI)
- [ ] 3-9, 11-14 sin empezar (ventanas, constructor de diálogos, misiones, hospital, botón mascota, cripta E, interfaz original, pelo F5, stats Olympia)

- [x] (pedido 2026-10-15, cierre hilo UI) **Verificación en navegador de lo pendiente:** móvil vertical/horizontal, minimapa en cripta real (nivel 1 y 4), chat Legacy, plegado ▾/▸ del rastreador, pozo cerrado (mini esqueleto + aro de jefe) y abierto. Arreglado: el rastreador de misión se apartaba mal (tapaba el diálogo en horizontal móvil, lo tapaba el minimapa ampliado de cripta) -> `questUi.avoid` + media query; el log Legacy pisaba la línea de fps (top 24px). Flecha del tutorial: vista solo en el paso de mapa (sin probar talk/kill). Minimapa en móvil: sin probar.

## Hilo SISTEMAS (pedido 2026-10-15) — tickets por prioridad
- [x] 1. **Bots locos con un drop:** `bot.js` reclamo por casilla (8 s, `w.lootClaims`): solo un bot va a cada botín; lo tirado por un jugador/bot (`dropBy`, `itemsys.dropItem`) los bots no lo recogen solos. Test `tests/bot-loot-claim.test.mjs`. Sin bump de versión (queda en 0.83.6; se agrupa con la siguiente entrega). Orden «recoge esto» (v0.83.13): el bot recoge 30 s lo tirado por su jugador.
- [x] 2. Changelog + Backlog web (tickets con prioridad, reinterpretación) y reporte rápido F11 + panel de errores.
- [x] 3. Revamp del trade (Olympia; arrastrar item sobre otro personaje abre exchange; bag llena: definir cola/bag extra).
- [x] 4. Obediencia de bots + glosario de órdenes + ticket «el bot X no entendió».
- [x] 5. Efecto de evolución de pet: el aura de Demon/Frost/Liche/Cyclops evolucionados ahora late ~6 s cada 60 s (fase propia por criatura, fundido suave) en vez de titilar siempre (`renderer.js`, `evoEnv`). Sin bump (0.83.6). Interpretación: pulso de aura 6 s cada 60 s; si se refería a otro efecto, p. ej. la animación de evolución de `fx.js`, avisar).
- [x] 6. Indicación de paso al mapa de farm contiguo (hacia Ares).
- [x] (pedido 2026-10-15, v0.85.5) AUTO: no recoger objetos, mini ventana de muertes, nombre del pozo, atasco en el almacén (sin verificar en navegador).
- [x] 7. Auto hunt / auto run (v0.83.11, docs/sistemas/auto.md).
- [x] 8. Stat simulator (Olympia): `/stats`, ventana id 73 (`client/statsim.js`, `docs/sistemas/statsim.md`).

- [x] (pedido 2026-10-15, v0.83.6, "sprites mal alrededor de todos los personajes") **Recuadros pálidos con GL:** premultiplicado inválido (rgb>alfa) en el shader; recortado con `min(rgb, alfa)`.
- [x] (pedido 2026-10-15, v0.83.5, "prueba autónomamente en Chrome, 10 bots de cada ciudad, mide frames") **Prueba autónoma:** 41 jugadores + 15 Orcs en Promise Land = 45-60 fps; arreglado el congelamiento de 4-6 s al entrar (minimapa) y el tope de `dbg bot`. Script de medida en la sesión (Playwright + Chrome real).
- [ ] (pedido 2026-10-15, v0.83.4, "haz ?gl=1 el modo por defecto y reduce subidas de texturas y coste de fx al correr") **GL por defecto:** hecho (?gl=0 para 2D), UPMS 3 ms, caché de textos sprFont. Pendiente prueba de Pablo corriendo en Promise Land y leer el log (`fxMs`, `glx.up`).
- [ ] (pedido 2026-10-15, v0.83.3, "mucho flickering, revisa el log") **Parpadeo:** `desynchronized` desactivado por defecto; log 0.83.2 quieto = 60 fps (cuello solo al correr/cargar); pendiente prueba corriendo con `?gl=1&prof=1`.
- [x] (pedido 2026-10-15, v0.83.2) **Perfilador A/B (?prof=1) + suavizado low en atlas + desynchronized, sin bajar calidad:** hecho. Pendiente prueba de Pablo en Promise Land con gente en `http://localhost:8088/?gl=1&prof=1` (quieto ~45 s) y enviar log: eventos `prof` dicen qué capa cuesta GPU.
- [x] (pedido 2026-10-15, v0.83.1, lanzador) **Reinicio con una tecla:** Intro en la ventana del servidor = `restart` + navegador nuevo en `http://localhost:8088/?gl=1` (`tools/iniciar.ps1`, consola de `server.mjs`). Sin cambio de versión (solo herramienta).
- [ ] (pedido 2026-10-15, v0.83.1) **Un draw por composición, tope de texturas y subidas repartidas, sin bajar calidad; mirar recuadros claros alrededor de personajes (captura ?gl=1):** hecho el batching/tope/reparto (verificado en pruebas sintéticas del navegador). Pendiente prueba de Pablo en Promise Land con gente (`glx.draws/quads/defer/up`, `js.tot`) y A/B con/sin `?gl=1` para los recuadros (causa no hallada).
- [ ] (pedido 2026-10-15, v0.83.0) **Repensar el dibujado de sprites (más moderno):** renderer WebGL2 opcional `?gl=1` (compositor de personajes y tono del suelo en shader, 2D intacto). Pendiente prueba de Pablo en Promise Land (fps con/sin `?gl=1`); siguiente paso posible: dibujar entidades directamente en GL sin atlas 2D. **Log ?gl=1 (Pablo, 17:19):** 60 fps estables, tint 0.2 ms (2D: 125-640 ms/ventana); quedan picos de 100 ms por subida de texturas (66 hojas, 596 ms) y suelo 2D (gMs 10-22); propuesta 0.83.1 precarga repartida de texturas.
- [ ] (pedido 2026-10-15, v0.82.10) **Todavía fps bajos (26-33) con 13 a la vista pese a 0.82.9:** añadida medición `js.pre/post/tot` para ver si el cuello es HUD/gui o GPU; pendiente prueba de Pablo.
- [x] (pedido 2026-10-15, v0.82.9) **Armas teñidas sin lectura de GPU (`willReadFrequently` en `weaponTinted`):** hecho; pendiente que Pablo pruebe en Promise Land y leer `pc.cp.weap`.
- [x] (pedido 2026-10-15, v0.82.8) **Analizar log 0.82.7 + medir compose + warm 1/fotograma:** hecho; probado: 37.8 fps en multitud; las armas teñidas (`pc.cp.weap`) eran 3.6 de 4.5 ms por composición.
- [x] (pedido 2026-10-15, v0.82.7) **Fps en multitud (Promise Land, 35 jugadores → 8-16 fps):** precalentamiento de la caché de personajes (2 fotogramas siguientes, 3 ms/fotograma) + medición compose/directo/acierto en el log. Pendiente: Pablo repite en Promise Land y se lee el log.
- [x] (pedido 2026-10-15, v0.82.6) **Máxima calidad siempre + empaquetado:** caché de personajes compuestos en atlas (un drawImage por persona), sin bajar calidad (nivel 3 retirado, auto-calidad off) + registro de rendimiento del jugador zzzz (data/perf/*.jsonl) para analizar tras el test. Pendiente: Pablo prueba y hace logout; leer el log.
- [x] (pedido 2026-10-15, v0.82.5, SUPERADO por 0.82.6) **Más fps con multitud:** calidad automática nivel 3 (resolución interna 70 %, crowdMax 14). Pendiente de confirmar; si sigue bajo: caché de personaje compuesto por frame.
- [x] (pedido 2026-10-15, v0.82.4) **FPS bajos (19-24) con ~30 jugadores:** suavizado de sprites `high`→`medium`/`low` y `put` sin arrays. Pendiente de confirmar; si sigue bajo, siguiente: texturas HD grandes / coste por pieza de personaje.
- [x] (pedido 2026-10-15, v0.82.3) **Tirones al correr:** precalentado del suelo dirigido por la marcha y tono HD en fotograma aparte (`renderer.js`). Pendiente de confirmar por Pablo; medición headless muy ruidosa (rasterizado por software), `tools/perf.py correr`.
- [x] (pedido 2026-10-15, v0.82.2) **Carga sin cuadrados negros:** al entrar, bloques de suelo negros y tirones al correr; causa: HD activado después de pedir las hojas (se bajaban al dibujar). Arreglo en `main.js` (hd antes de `stream.enter` + precalentado del suelo 5x5). Pendiente de confirmar por Pablo; si siguen tirones al correr, medir con `tools/perf.py` escenario `correr`.
- [x] (pedido 2026-10-13, v0.80.7) **Rework de ventanas:** todo dentro del juego (F1, Opciones, prompts) con el estilo clásico y un toolkit nuevo `client/window.js` (`docs/sistemas/ventanas.md`). Pendiente de migrar: diario/seguimiento de misiones (`questui.js`), paneles heredados `#charpanel/#inv/#book` (hud.js), observador. Falta verificación visual por el usuario.

## Hilo SISTEMAS (v0.85.7) — reconexión y carga de mapas
- «El juego se reinicia como si refrescara»: causa = reinicio del servidor (nuevo id de jugador) o cierre por señal (`kicked` apagaba la reconexión). Arreglado: reintento 120 s y recarga con re-login automático (`hb.resume`). En crash.log hay un fallo real (JSON circular) y ~1215 líneas EADDRINUSE (segunda instancia del servidor en bucle de reinicio): vigilar que no haya dos servidores. En localhost, `devReload()` (assets.js) también recarga si cambian los sprites.
- Carga de mapas: login sin esperar rejillas (ver docs/sistemas/carga.md). No se pudo reproducir lentitud local; no hay números «antes/después» en red real. Pendiente: medir en el servidor oficial con caché fría.

## Hilo SISTEMAS (v0.84.11)
- [x] Bolas de invocación propias por especie (2001-2032, icono ip20; drops 651-655 sin cambios) · [x] Ir a solo Promise Land/Aresfarm/Elvine Farm/criptas · [~] sprite negro sin capa: arreglada una colisión de caché (`keyOf`), el fallo original no se reprodujo. Verificado en localhost: iconos en la mochila (Orc, Troll, Unicorn).

## Hilo MOTOR (pedido 2026-10-15, v0.83.10)
- Ticket 14 HECHO (0.83.8): pescado = estadísticas, granja = cura. Ticket 6 HECHO. support-summon arreglado (semilla 34).
- [x] 1 Reconexión (gracia 45 s + reconexión automática; sin probar en navegador real con pestaña oculta larga)
- [x] 7 Sin Failed en fallo normal · [x] 9 Autoataque solo monstruos · [x] 12 sin viñeta/luz/barras de monstruos/aviso de mapa (la barra EXP sobre la cabeza no existe en el código)
- [~] 8 el servidor ya rechaza atacar a no enemigos (canFight); sin gesto añadido
- [x] 4 críticos/dash · [x] 5 magia (flujo prepare→apuntar→lanzar, nombre sobre el personaje y bloqueo de movimiento ya existían; añadido aviso de manos libres) · [x] 10 atajos y órdenes · [x] 13 full mage · [x] 2 carga (ya había pantalla de carga y terreno precalentado; añadida precarga del aspecto online)
- [x] 3 FPS (0.83.14: causa de los tirones iniciales = primer drawImage de hojas de suelo, 57-158 ms cada una; ImageBitmap + corte a 4 ms, ver abajo; 0.83.13: suelo reconstruido de uno en uno, 21.8→30 fps en el navegador integrado, tope 30; quedan tirones de ~10 s tras entrar: pasos de 3 filas de 60-230 ms en el precalentado de bloques lejanos. Descartado (medido, sin efecto): precargar+decodificar hojas, dibujarlas antes. Reconstruir un bloque con todo caliente cuesta <5 ms, así que es coste de arranque de GPU/GL del navegador integrado; falta medirlo en un navegador real). [x] 11 hasta 4 personajes por cuenta (0.83.10, test net-chars, verificado en navegador; admin y silencio por cuenta). Sin FPS nuevo que medir en este PC: no se reproduce el bajo FPS. [x] 10: efectos de /showgrid, /timestamp, /bigitems, /tooff y ciclo de susurros hechos (0.83.11-12); sin verificar en navegador: dash en vivo, reconexión con pestaña oculta larga. support-summon arreglado (semilla 34).

## TO-DO por prioridad (2026-10-12, v0.79.5) — meta: release de testers, solo acto 1

### P0 · Servidor oficial siempre online y de mínima latencia (pedido 2026-10-13)
- [ ] Plan completo en `docs/HOSTING.md` (fases A–H: medir, VPS 24/7 + TLS directo, latencia de aplicación, rendimiento, operación, web/registro con correo, seguridad, carga y beta). **Plan escrito (v0.80.1, sin código aún).** Pendiente decidir: región de los jugadores, proveedor/dominio, correo obligatorio.
- [ ] (pedido 2026-10-13) Escenarios de escala y coste en `docs/HOSTING_ESCALA.md`: **global 100 CCU** (reinos regionales, ≈ 10 semanas, ≈ 100–320 €/mes; con un solo reino ≈ 6–7 semanas y 30–100 €/mes) y **low cost para amigos/pruebas** (VPS ≈ 5–8 €/mes, ≈ 4 días). Medido: tick 0,36 ms medio / 1,4 ms p95 con 40 bots. **Plan escrito (v0.80.1, sin código aún).** Siguiente paso sugerido: montar el low cost y medir red/memoria (Fase A).
- [ ] (pedido 2026-10-13) Alojar en el **PC local** con versiones estables y testeables: `docs/HOSTING_LOCAL.md` (comparativa Cloudflare Tunnel / port-forward / VPS relay / Funnel / ngrok; canales stable·beta·dev en puertos y `HB_DATA` distintos, releases inmutables con rollback, servicio NSSM, backups, `/health`). Recomendado: Cloudflare Tunnel + dominio (~1 €/mes), VPS relay (~5 €) como plan B. **Plan escrito (v0.80.1, sin código aún).**

### P0 · Fluidez con muchos lanzadores en pantalla (pedido 2026-10-13, v0.80.3)
- [x] (0.80.3) `spellfx.js`: el rayo (`thunder`) recalculaba la recta desde cero (coste cuadrático, ×3 por efecto y fotograma) → incremental, mismos puntos (verificado 300 000 muestras); `put()` sin save/restore; `update()` sin copias; tope de efectos 600→400. HUD: «dibujo media/pico ms» junto a los fps.
- [ ] Verificar con 5 Cyclops + Trolls + bots lanzando: leer «dibujo» y ping. Si sigue alto, siguiente sospechoso: gradientes radiales por entidad en `renderer.js` (auras Liche/Cyclops/Demon, líneas 750–990) → cachearlos en sprites.

### P0 · Bloqueantes antes de invitar a nadie
- [x] (0.79.6) Servidor: bucle EADDRINUSE al reiniciar (esperar al puerto o salir limpio) y reinicio para cargar `shared/*`.
- [ ] Protocolo/versión: comprobar que clientes viejos reciben el aviso de recargar.
- [x] (0.79.6) Cuentas: backups diarios de `hb.sqlite`; el límite de registro queda ilimitado por decisión del propietario.
- [ ] Comprobar que el cliente de GitHub Pages conecta con `https://pablo.tail495855.ts.net`.
- [ ] Bots: atasco en Aresfarm (61,77); `cryptentry`, `crypt-exit`, `pet-far`/`pet-missing` residuales.
- [ ] Criterio de listo: 8 h con 40 bots sin avisos de «bloqueado» ni caídas.

### P1 · Experiencia del tester
- [ ] Tutorial y primeras 2 horas (creación, tienda, primera cripta).
- [ ] Cierre claro del acto 1 (rey de la cripta + mensaje).
- [ ] Avisos de peso y mochila llena + botón «vender basura».
- [ ] Cuenta atrás del Recall en pantalla.
- [ ] Guía corta para testers (cómo entrar, qué probar, cómo reportar) y canal de reporte.
- [ ] `attack` a objetivo muerto: ignorar en silencio (6600 rechazos).
- [ ] Bucle de `learn` repetido de los bots.

### P2 · Balance
- [x] (hecho en v0.80.6) **Balance de magias, pets, habilidades de pet y daños:** sistema editable por web (`/admin/balance.html`, ficha `docs/sistemas/balance.md`). Hechizos de monstruos y jefes cubiertos; círculos 9-10 se dejan como el original (decidido). Pendiente: arena y bots; afinar con partidas reales.
- [ ] Cyclops/Troll/Skeleton a nivel 32-50 contra `NPC.cfg` (¿equipo del bot o monstruo?).
- [ ] Revivir al summon menos caro (escala con su nivel).
- [ ] Sumideros de oro (reparar, teñir, apuestas, mejora de equipo).
- [ ] Exp/min negativa y farmeo de Slimes.
- [ ] Summon sube lento (40 % de la exp) en 14 bots.

### P3 · Fidelidad al original
- [ ] Verificar contra el original el comportamiento de magos/invocadores a distancia.
- [ ] Magia pendiente: tipos 4-7, 8-18, 19-33 y mago de la ciudad.
- [ ] Artesanos: también caramelos.
- [ ] Contramagias psíquicas.

### P4 · Visual y contenido
- [ ] HD de Beholder, Centaurus y Stalker.
- [ ] Sonidos de la Pixie: elegir y asignar.
- [ ] Remaster tipo Diablo 2 (piloto werewolf hecho; decidir upscaler IA, luz dinámica, HD manual de jefes).

### P5 · Aplazado a propósito
- [ ] Tamaño del repo (LFS), tinte de pelo `m_wR`, verificación de CI, `docs/FUTURO.md`.
- [ ] Fuera del primer release: arena, mapas de Elvine/nieve, rediseño de sonido, LFS, actos 2+ y final.

## Backlog (actualizado en v0.70.0)
- [ ] (pedido 2026-10-13) portar TODO lo faltante de docs/DESVIOS.md con la lógica original como regla (autónomo). Hecho: 80 ítems (tools/add_missing_items.mjs), magia 75 Ice Whirlwind, texto de lanzamiento, 49 mapas, 59 NPC (tools/add_missing_npcs.mjs), bonos de conjunto de héroe y zona de lucha. En curso: facciones, PK, cruzada, etc.
- [x] (pedido 2026-10-13, v0.80.2) pets inmunes en Promise Land · color de armas del servidor original · drop al morir (PvP) · sprite TAB paz/ataque · textos de combate del original · F1 «Full mage». Falta verificación visual por el usuario.
- [x] (pedido 2026-10-13) documento de desvíos original vs port: `docs/DESVIOS.md` (primera pasada; falta la verificación de las filas «a verificar»). Siguiente derivado: texto de conjuro sobre la cabeza («Nombre!», tipo 41 del cliente original).
- [ ] (análisis, 2026-10-12) **Remaster tipo Diablo 2 Resurrected con los sprites de Helbreath:** hoy el HD es Scale2x×4 + suavizado (`tools/hdup.py`), sin detalle nuevo. Pendiente decidir: piloto con upscaler IA (Real-ESRGAN ncnn-vulkan, RTX 4060) en 3 muestras (cuerpo, monstruo, tile) y comparar en el Bestiario; luz/sombras dinámicas; HD manual solo para jefes/héroes. **Piloto hecho 2026-10-12 con el werewolf** (walk, 8 dir): `pruebas/werewolf-remaster/` (vídeos 4 niveles y original vs nuevo). Pendiente decidir si se sigue. **Lote enemigos 2026-10-12:** `tools/remaster_ia.py` genera `web/data/sprites_ia/` (+`sprites_ia.json`, derivados no versionados) para todos los enemigos de `npc.json` (Real-ESRGAN x4plus); el Bestiario tiene selector «Modelo» (Original / HD actual / IA / IA + luz simulada) y «Comparar los 4» en filas. Sin publicar.
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

**Backlog nuevo (pedido del usuario, 2026-10-12, release de testers):** alcance = solo acto 1; servidor con Tailscale. Ver `docs/RELEASE_TESTERS.md`.
- [ ] **Bots pulidos del todo** (0.79.3: Recall, cripta, flechas hechos; quedan summons lejos/ausentes, peso, `attack` sin objetivo, `learn`, balance): arreglar lo que sale en `Informe de bots.md`: atascos en granjas (Aresfarm/Elvine), Recall interrumpido, sin flechas, summons lejos/sin volver, peso/mochila, `attack` sin objetivo, `learn` repetido, balance (muertes por Cyclops/Troll/Skeleton, revivir summon caro, oro sin sumideros, exp/min negativa con Slimes).
- [x] (2026-10-12, sin publicar) **Orge IA afinado (piloto de aprendizaje):** las 40 hojas del orge rehechas con la canalización nueva de `tools/remaster_ia.py` (conserva pelo y sombras, quita sombra negra del suelo y mugre suelta, alfa por fotograma; ~37 s con IA, ~12 s solo alfa con `--alpha`). Lecciones en `docs/FINDINGS.md`. Pendiente: Pablo revisa el orge en el Bestiario; después lote completo (`python tools/remaster_ia.py ESRGAN_DIR --force`), wyvern/troll/sprites diminutos; las líneas rectas finas bajo los pies: causa probable corregida (el suavizado leía píxeles del fotograma vecino; regla en `docs/sistemas/bestiario.md`), pendiente de confirmar por Pablo.
- [x] (2026-10-12, sin publicar) **Troll IA con las lecciones del orge:** 40 hojas rehechas (22 s) con la canalización nueva (sin borrar negro, alfa por fotograma aislado, mugre suelta). La limpieza no quitó ningún píxel del troll en las muestras. Pendiente: correcciones de Pablo en el Bestiario (Modelo → 3).
- [x] (2026-10-12, sin publicar, v0.79.8) **Sprite Tool** (petición de Pablo): el Bestiario incluye los personajes M y W y todos los sprites del juego (vista «Hojas sueltas»); renombrado. Pendiente: revisión de tigerworm/cat, wyvern, bunny, ant y lote completo.
- [x] (2026-10-12, sin publicar, v0.79.7) **Bestiario: «Original al lado»** (petición de Pablo): casilla que dibuja el original junto a cada fotograma del modelo elegido. Además hojas IA de tigerworm, cat y scorpion (patas finas arregladas: `smooth_alpha` une dos desenfoques; alfa rehecho en orge/troll/tigerworm/cat/scp). Pendiente: Pablo revisa tigerworm, cat y scorpion; luego wyvern, bunny, ant y el lote completo.
- [ ] (2026-10-13, sin publicar, v0.79.11) **Armería con ESRGAN** (petición de Pablo): selector de modelo y Battle Hammer (`ip14`) con IA, pendiente de su revisión. Siguiente: más armas y el arma equipada (`equip.json`, aún no soportado por `remaster_ia.py`).
- [ ] (2026-10-13, sin publicar, v0.79.12) **Herramienta de terreno** (petición de Pablo: «otra herramienta para mejorar terreno, ver los sprites de los maps»): `terreno.html` hecha (ver hojas y mapas por modelo). Siguiente: remasterizar hojas `t` con IA (`remaster_ia.py`, cuidando las costuras) y enlazarla desde la Sprite Tool.
- [ ] (2026-10-13, sin publicar, v0.79.13) **IA en t301** (petición de Pablo): generada; pendiente su revisión (marcas en bordes de loseta).
- [ ] (2026-10-13, sin publicar, v0.79.14) **IA en t214** (petición de Pablo): generada y revisada, pendiente de su visto bueno.
- [ ] (2026-10-13, sin publicar, v0.79.15) **Arefarm completo con IA** + mejoras del proceso (relleno cíclico de losetas, imágenes de revisión, `--map`/`--status`, revisión en terreno.html): hecho, pendiente de su visto bueno.
- [ ] (2026-10-13, sin publicar, v0.79.16) **Aresfarm con IA en el juego** (petición de Pablo): `assets.js` fusiona las hojas `t` IA; pendiente de su prueba.
- [x] (2026-10-13, sin publicar, v0.79.10) **Remaster IA del personaje W** (petición de Pablo): 440 hojas IA con color corregido, botones de modelo y original al lado en la vista de personajes. Pendiente: M (sin pedir), revisar acciones/pelo con Pablo.
- [x] (2026-10-13, sin publicar, v0.79.17) **Losetas IA con bordes/cuadrícula** (petición de Pablo): corregido con relleno envolvente + ajuste de tono. Pendiente: velocidad al hacer todo el juego (ver tiempos: suelos ~7 min en total, objetos de un mapa ~10 min); priorizar por mapa con `--map`.
- [x] (2026-10-13, sin publicar, v0.79.18) **Escorpión IA en el juego** (petición de Pablo) y líneas negras entre losetas (alfa de borde).
- [x] (2026-10-13, sin publicar, v0.79.19) **Líneas oscuras finas entre bloques de suelo** (captura de Pablo): bloques alineados a píxel.
- [ ] (2026-10-13, sin publicar, v0.79.20) **Líneas persistentes y zona difusa en arefarm** (capturas de Pablo): sospecha de caché del navegador con hojas IA viejas; `IA_VERSION`. Pendiente: confirmar con nueva captura; si persiste, identificar la hoja difusa.
- [x] (2026-10-13, v0.79.21) **Luz dinámica y sombras largas** (petición de Pablo, hacia la calidad de Diablo II Resurrected): `renderer.drawLights` + `shK`, opción `lightFx` (Opciones → Gráficos). Ficha `docs/sistemas/luz.md`.
- [x] (2026-10-13, v0.79.22) **Líneas oscuras en el suelo** (capturas de Pablo): reproducido en el juego con Edge; causa = alfa de borde por hoja entera; corregido con `tools/fix_tile_alpha.py` (verificado: sin caídas de luminancia en la captura). Pendiente: zona difusa de hierba (t7/t6/t9/t352).
- [x] (2026-10-13, v0.79.23) **Monstruos de la granja en IA** (petición de Pablo): slm, scp, amp, ant, gol integrados; pendiente revisión visual de Pablo y seguir con el resto de mapas.
- [x] (2026-10-13, v0.79.24) **Monstruos granja: partes negras/perdidas** (Pablo): amp/gol arreglados (keep=0); ant IA oscura → HD, pendiente rehacerla.
- [x] (2026-10-13) **Battle hammer + animaciones en personaje W por IA** (petición de Pablo).
- [ ] (2026-10-13) **IA de los enemigos disponibles (skeleton, Promise Land: cla, cyc, orc, troll, zom, scp, gol) y de los objetos: sprite de suelo/bolsa (`ig*`), icono de inventario (`ip*`) y objeto equipado en el personaje (`equip.json`: armas `w*`, armadura/casco/etc.)** (petición de Pablo). Monstruos fusionados y objetos `ig/ip` listos; equipo (≈5900 hojas, ~2 h) generándose con `remaster_ia.py` (grupos `EA*`/`EW*`). Falta: revisar en el juego y los personajes (W/M, ya hechos).

- [ ] (2026-10-13) Revisión de monstruos IA: zombi/orco oscuros (ahora `tone`: color y brillo base del original), esqueleto con piernas rotas (alfa fino + mezcla con original), clay golem con borde oscuro (`erode`), cíclope sin partes. Pendiente: confirmar en juego antes de 0.80.0.

## Auditoría IA (2026-10-13, v0.79.25)
- [ ] Petición: "qué sprites faltan en pasar con IA". Resultado: 8192/10553 hojas con IA. Sin IA: terreno `t` 223/309 (t12–t530), pb 264, pu 88, ph 88, ututelarangel 192, unidades `u*`/`lgol*`/`znz*`/`eid*` (~2.700 px·M), dummy, crop, civiles (shk, gnd, how, tom, william, kennedy, mcgaffin, perry, devlin, gail), ugate, id, cryptpit.
- Con IA pero NO servidos en juego (fuera del regex de assets.js): 33 monstruos (demon, liche, ettin, wyvern… ant a propósito), y pb/pu/ph (solo mitad generada).

- [x] (2026-10-13, v0.80.0, sin publicar) **33 monstruos + ant + cuerpos de personaje con IA** (petición de Pablo: "finaliza y controla esos 33 monstruos, ant y cuerpos de personajes"): regenerados, QA hecha, servidos en el juego. Pendiente: visto bueno de Pablo; fotogramas diminutos de pu1 sin IA (<3 px, usan original).
- [ ] (2026-10-13) **"No veo los sprites de los items en la bag"** (Pablo): en prueba con Edge los iconos se ven (original, `putGame` no usa IA); esperando captura de Pablo.
- [x] (v0.80.1, sin publicar, verificado en Edge: interior de tienda, ventana de personaje y bolsa) IA: interior de tienda/almacén/herrería (gshop_1, wrhus_1, bsmith_1 y sus «f»: teselas t406-421), ventanas de diálogo (personaje, bolsa, etc.: `tools/remaster_ui.py` → `web/data/ui_ia`, gui.js `uiSrc`) e iconos de la bolsa con las hojas `ip*` IA (gui.putGame usa `spr.src`). Pendiente de verificar en el navegador.
- [x] (v0.80.1, sin publicar) IA: habitantes de la ciudad (shk, gnd, how, tom, william, kennedy, mcgaffin, perry, devlin, gail; 80 hojas) y suelo de la farm borroso: `remaster_ia.py --detail 0.9` (transfiere el detalle de alta frecuencia del original) aplicado a t0, t3, t4, t5, t19, t337, t339-343; IA_VERSION ia-0.80.8. Quedan por revisar otras teselas de suelo.
- Interiores: puntos negros del suelo (t406-413, t418-421) corregidos rellenando alfa; NPC citizens (how, tom, shk, gail, gnd...) añadidos a la whitelist IA de assets.js. v0.80.1 local, IA_VERSION ia-0.80.10.
- Gandlf (gnd0-7): píxeles verdes del original eliminados (alfa), despill + transferencia de detalle + nitidez; IA_VERSION ia-0.80.11.
- Portal/plataforma de la farm (t301): motas negras por huecos de alfa rellenadas; IA_VERSION ia-0.80.12. Nuevo docs/SPRITES.md con sprites clave.
- Armas IA (ia-0.80.13): Battle Axe hombre (`w0_26_*`, 56 hojas) nitidez: detalle del original + unsharp + alfa más seco. Pendiente de probar por el usuario; si gusta, extender a otras armas (`EW`).
- Armas IA (ia-0.80.15): Barbarian Hammer hombre (`w0_32_*`, appr 32, 56 hojas): mismo tratamiento que Battle Axe + quitadas motas sueltas. Pendiente de probar.
- Armas IA (ia-0.80.16): Barbarian Hammer H más nítido/realista (CLAHE, saturación, nitidez 2 escalas, contorno oscuro). Script en scratchpad fixham2.py.
- Armaduras IA H (ia-0.80.17): KnightPlateMail `a0_4_*`, Hauberk `b0_2_*`, Leggings `l0_4_*` con acabado metálico (CLAHE, curva S, brillo especular, croma de acero, contorno); cascos Horned `h0_5_*` y Winged `h0_6_*` con tratamiento suave. Script scratchpad fixarm.py.

- ia-0.80.18 (armaduras M v2, local): a0_4/b0_2/l0_4 con luminancia que conserva la media (base 0.88L+4, detalle local x1.5, brillos puntuales), croma de acero reducido, borde oscuro. Verificado en juego con s19.py (DSF 3). Cascos h0_5/h0_6 con parametros suaves.

- ia-0.80.19 (equipo completo, local): tools/remaster_equip.py aplica el pulido a todas las hojas IA de equipo [ablohsmw][01]_* (5.938, salvo las 7 ya hechas a mano). Copia de seguridad previa en %TEMP%/equip_bak. Armas = receta martillo; armaduras/escudos/capas/botas = receta acero con croma adaptativo (lo coloreado se conserva); cascos = suave.

- ia-0.80.22 (zombie, `tools/remaster_equip.py --type n`): receta de criaturas suavizada (mediana 5, bilateral 9/55, detalle x0.9 sobre luminancia suavizada, sin destellos, unsharp 1.5/3.5). Pendiente: aprobacion del usuario antes de extender a todas las criaturas ("mismo concepto de upscale en todo el juego"). Copia: %TEMP%/npc_bak.
- ia-0.80.25 (cripta, peticion de Pablo): IA para las hojas de terreno que usa la cripta (t300, t302-t309, t211; t301 ya la tenia) con `tools/remaster_ia.py`; las motas negras (huecos de alfa de 1.8% en el original, 6% tras reescalar) se rellenan con `tools/fill_tile_holes.py`. Pendiente: costuras de brillo entre casillas y nuevo diseno del mapa si Pablo lo pide. Sin publicar.
- ia-0.80.26 (cripta): Pablo vio cuadricula de casillas y exceso de blur. `tools/fix_tile_seams.py` rehace t300-t309: base = original x4 por casilla (continuo con la vecina) + alta frecuencia de la IA atenuada en el borde. Sin publicar.
- ia-0.80.28: fix_tile_seams reajustado (base original afilada + detalle IA x1.5, borde 8px) tras quejas de "parece upscale del original". Sin publicar.
- ia-0.80.29: Pablo vio parpadeo (se dibujaba la hoja original y luego la IA). `Sprites.ready()` (assets.js) no da por listo un sprite con hoja HD/IA hasta que esa hoja carga (cae a la original si falla). Sin publicar.
- ia-0.80.30: Ctrl+D alterna sprites HD / originales (opts.hdSprites) para revisar; sustituye al ciclo de nivel de detalle (que sigue en Opciones).
- ia-0.80.31 REVERTIDO (ia-0.80.32): el pase de costuras en todo el terreno (tools/fix_tile_seams.py) quito la cuadricula pero dejo aspecto de 'upscale viejo' y devolvio pixeles negros en el warehouse t406-409; se restauraron las hojas desde %TEMP%/seam_bak. Pendiente: otro metodo (IA con contexto de vecinos).
- Carga de sprites lenta (peticion v0.80.1): el Streamer ahora baja a la vez la hoja original y la HD/IA (antes la HD se pedia al dibujar, sin cola ni prioridad); max simultaneas 6->10.

## 0.80.1 (local) · terreno continuo y bolsa
- Pedido: aplicar a todo el terreno el estilo de los edificios, sin parches de tono ni rejilla; iconos de la bolsa llegaban tarde.
- `tools/equalize_detail.py` (nitidez por casilla) aplicado a t300–t309 (IA_VERSION ia-0.80.33).
- `renderer.js blendTone`: en HD, el tono de cada casilla se acerca al de su vecindario (interpolado, sin saltos en bordes de bloque).
- `main.js`: precarga de ip0–19 / ig0–19 (original+HD) al arrancar para que la bolsa salga completa. PENDIENTE verificar en navegador.
- Pendiente: equalize_detail en otras hojas de terreno (granja, interiores) vigilando píxeles negros en t406–409.
- Rendimiento (spikes de ms): `renderer.js` — los bloques de suelo (CHUNK 16x16, ~100 ms cada uno) se generan por filas (3/fotograma) en un anillo alrededor de la cámara; el suavizado de tono pasó a composición GPU (multiply + lighter) y la media por casilla se calcula 1 vez por hoja. Medido caminando (Playwright, 8 s): p99 17 ms (antes 233 ms), solo queda el pico de la primera carga (~150 ms).
- ia-0.80.34: equalize_detail también en terreno de granja (t0,t3,t4,t5,t19,t337,t339–343) e interiores (t406–413, t418–421). Backups pre-ecualización: `$TEMP/eq_bak`.

- Petición: documento md de magias (lore, fórmulas, balance, simulaciones). HECHO v0.80.4 → docs/sistemas/magias-diseno.md.

- Petición «porta todo esto» (bandos/PK, polymorph/slates/upgrade/DK, pesca/minería/alquimia, Teleport.cfg, fuente de sprites, Item4): PARCIAL, sin versión ni commit (el otro agente tiene cambios sin subir). Hecho: PK/reputación/Elo (systems/pk.js, tests/pk.test.mjs), Teleport.cfg (tools/convert_teleport.mjs, systems/teleport.js, tests/teleport.test.mjs), Item4 en convert.py (solo sintaxis verificada). Pendiente: cárcel arejail/elvjail, DecPKCount, textos/UI de PK, diálogo William/Gail, Polymorph/Slates/ItemUpgrade/DK/ChangeStatsMajestic, pesca/minería/alquimia/manufactura por .cfg, fuente de sprites. Fallo previo ajeno: tests/support-summon.test.mjs (balance del otro agente).
- Petición: escenarios de rendimiento con magias/bots/monstruos, medir y capturas. HECHO v0.80.5 → `tools/perf.py` (`HB_HEADED=1`), capturas en pruebas/rendimiento/. Pendiente: magia p95 de fotograma ~26-39 ms (picos de drawImage en hojas IA grandes; ImageBitmap probado y descartado: peor).

- Petición «fuente de sprites para daño/casteo + revisar críticos y dash + bots»: HECHO v0.81.0 (local, sin commit ni push: hay trabajo del otro agente mezclado). Crit/dash en `critico-dash.md`, fuente en `fx.js` (`sprFontDraw`). Pendiente: apilado de líneas del daño y la fuente en el resto de avisos.
- Petición: 60 fps estables con las gráficas nuevas / al correr cerca de otros jugadores. HECHO v0.80.6 (calidad automática). Nota: la GPU de pruebas estaba al 94 % por otras apps (ollama, Discord…), lo que dispara los ms.
- Petición «restaura la magia normal de Helbreath y reescribe la magia de pets como sistema nuevo (otro NPC, otro menú)»: HECHO v0.82.0 (local). Ficha `petgrimoire.md`. Pendiente: probar a mano el diálogo 46 y el apuntado del grimorio en el navegador.

- [x] (0.82.0) Compendio del juego en un artifact (testers, desvíos, dev): https://claude.ai/artifact/H9RKBrnNGb8RaPYgmaNTay

- Petición (9 puntos): HD ya no vuelve a original solo; minimapa con «Cargando mapa…»; nombre propio solo en hover; F1 Skills 100; ataque a jugadores según `_iGetFOE` (aliados del mismo bando no se atacan (viajeros sí: desvío del port) ni se pisan al clicar; criminales sí): HECHO v0.82.1 (local). Pendiente: fuente de daño más nítida (sin IA disponible), alternar Force Attack con Ctrl+A. El FAIL de magia a summons es la tirada de resistencia original (poca skill), no un fallo de daño.

- Hilo MOTOR 0.83.11: ticket 10 con efecto en /showgrid, /timestamp, /bigitems, /tooff (verificado en navegador integrado). SIN HACER: ciclo de susurros, zoom numpad, gesto del ticket 8, medicion de FPS (ticket 3: el navegador integrado es por software, hace falta log `?gl=1&prof=1` de un PC con GPU).
- Hilo MOTOR 0.83.12: ciclo de susurros (flechas arriba/abajo). Zoom numpad: no existe en el original, no se hace. Ticket 8: cubierto (cliente no apunta a aliados + `Combat.canFight`). Sigue SIN HACER: medicion de FPS del ticket 3 (hace falta log `?gl=1&prof=1` con GPU) y verificacion manual de critico/casteo/«!» en navegador.
- Hilo MOTOR 0.83.13: ticket 3 medido con `?prof=1` en el navegador integrado (software, tope 30 fps). ANTES: fase base 21.8 fps (45.8 ms/fotograma), primeros ~12 s tras entrar con fotogramas de 20-300 ms (suelo 5-33 ms). DESPUES (suelo reconstruido de uno en uno): base 30.2 fps, sinSuelo 26.4, resto 30; los tirones iniciales siguen (~9 s, suelo hasta 26 ms/fotograma, pico 367 ms en el primer fotograma): es el primer dibujo/decodificacion de hojas, no el bucle. En estado estable JS ~1.5-2 ms y dibujo ~0.8 ms: nada que recortar. Verificado en navegador: susurros (flechas), «Critical», «!» al matar, casteo Fire Ball. Dash solo por test.
- Hilo MOTOR 0.83.14: ticket 3, causa real de los tirones de la entrada medida con hooks en página (no rAF, que el panel oculto estrangula). Primer `spr.put` de cada hoja de suelo (t9, t382, t429, t352, t404, t365, t403, t405): 57-158 ms, ~85 % del tiempo de `groundChunk` lento (716 de 844 ms de put). Precargar/decodificar el `<img>` no ayudaba; un `ImageBitmap` (createImageBitmap) se prepara fuera del hilo principal. ANTES (1 ejecución): 14 llamadas a `groundChunk` >5 ms, suma 1532 ms, pico 288 ms, última a 11.1 s. DESPUES (2 ejecuciones): 8 y 7 llamadas, suma 447 y 861 ms, pico 112 y 178 ms, última a 8.0 y 15.3 s (la 2.ª incluye crear personaje en cuenta nueva, arranque en frío). Mejora real pero con ruido alto (software, 3 muestras); quedan tirones puntuales de ~100 ms en el primer dibujo de cada hoja porque el primer put ocurre antes de que el bitmap esté listo. Limite restante: GPU/rasterizado del navegador integrado; falta confirmar en un PC con GPU (`?gl=1&prof=1`).
## Hilo UI (rama Pablo-Claude/hb-ui-46a637) — v0.84.0
- Hechos: 6 misiones (ventana + botón barra + rastreador plegable), 1 hover turquesa, 2 tutorial (cuadro con retrato, saltar con doble clic), 3 buscador/Ok destacado/márgenes comunes, 8 botón de mascota, 9 rótulo de la cripta, 11 arrastrar ventanas al borde, 13 pelo F5.
- Pendientes: 4 cuadros neutros al hover, 5 migrar diálogos al sistema de ventanas + constructor, 7 hospital de mascotas, 10 modos Remastered/Legacy, 11 barra y área máxima (requiere GUI de ancho variable), 12 interfaz original total y minimapa móvil, 14 estadísticas estilo Olympia y mini sprite en pozos.

## Hilo UI (v0.84.2)
- Hechos: tickets 1, 2, 3, 6, 4 (casilla neutra `drawSlot`, solo en el hospital por ahora), 7 (pestañas + casillas), 8, 9, 11 (arrastre a bordes), 13.
- Pendientes: 5 (migrar diálogos + constructor + retratos), 10 (modos Remastered/Legacy), 11 (barra a los bordes), 12 (interfaz original total, minimapa móvil), 14 (stats Olympia, mini mob en el foso).

## Hilo UI (v0.84.9)
- Ticket 14 (v0.84.9): ficha de objeto estilo Olympia (`gui.itemTooltip`) y mini esqueleto sobre cada pozo de bajada (`renderer.pitMob`, aro de color en pisos de jefe). Verificado en escritorio (ficha de Dagger y pozo cerrado en cripta 1). Sin verificar: móvil, pozo abierto/piso de jefe. El formato Olympia no está documentado: se eligió una disposición propia.

## Hilo UI (v0.84.8)
- Ticket 12 (v0.84.8): Legacy con registro arriba-izquierda (original `ShowEventList`), chat sobre la barra, minimapa arrastrable y persistente, agrandado en criptas. Verificado en escritorio (log 6 líneas, arrastre y persistencia). No verificado: móvil, minimapa en cripta real.

## Hilo UI (v0.84.7)
- Ticket 10 cerrado (v0.84.7): opciones F12 ya reducidas a 3 secciones; modo Remastered/Legacy con etiqueta traducida. Los ON/OFF por defecto son los de `main.js` (`defaults`), documentados en el CHANGELOG. Menú F12 verificado en escritorio (la etiqueta nueva no se vio por caché del navegador; comprobado en la fuente servida).

## Hilo UI (v0.84.6)
- Ticket 5 (v0.84.6): conversación de NPC (id 21) migrada a `DialogBox`; verificado en escritorio con texto de prueba. Tienda/banco/venta mantienen el marco clásico (decisión: fieles al original).

## Hilo UI (v0.84.5)
- Ticket 5 (v0.84.5, parcial): `DialogBox` (dialogbox.js, ficha `docs/sistemas/dialogos.md`, test `dialogbox.test.mjs`); tutorial migrado (caja y rastreador), verificado en escritorio (caja y objetivo con barra). Móvil sin verificar. Faltan los diálogos de NPC (`npcdialogs.js`) por migrar. Crypt y chat quedan como están.

## Hilo UI (v0.84.4)
- Ticket 11 completo: barra inferior hasta los bordes (`Gui.edgeFill`, verificado a 1280x720) + arrastre a bordes; el área de juego ya era de pantalla completa.
- Ticket 10 parcial (v0.84.3): solo el indicador Remastered/Legacy. Faltan limpieza de opciones y valores por defecto de F1.
- Pendientes: 5 (migrar diálogos + constructor con opciones + retratos), 10 (resto), 12 (interfaz original total, minimapa móvil/reescalado en cripta), 14 (stats Olympia, mini mob en el foso). Requieren decisiones de diseño (formato Olympia no documentado, GUI de ancho variable).

## Menú AUTO (v0.84.11)
- [x] (pedido 2026-10-15, hilo auto-menu) Botón AUTO en el diálogo del personaje: ventana «Cazar» (zona, sprite 8 direcciones, ficha, Empezar/Parar) e «Ir a…» (granja, almacén, tienda, herrería, mago, granjero, hospital, hechicero de mascotas). Ver `docs/sistemas/auto.md`.
- [ ] Pendiente: vaciar en el almacén y repetir el ciclo; probar en navegador herrería, mago, granjero, hospital y hechicero de mascotas; el enrutado solo parte de la granja de Aresden.
- 0.85.1 (hilo UI): cerrado lo sin verificar de 0.85.0 (arrastre al borde, chat/log arrastrables en Legacy, buscador de compañeros, Opciones en vivo). Hospital sigue siendo ClassicDialog, no Win.

- 0.85.5 (hb-ui): flechas de entrada únicas por destino y ninguna en cerrados; quitado «+N exp» flotante; F11 ya usaba `Win` común (verificado en ambos modos, sin diferencia reproducible).

- 0.85.7 (hb-ui): ventanas hasta el borde exacto (gui.full), guardia CSS + tests/ui-guard.test.mjs, login sin autocompletado, minimapa de cripta proporcional (106 px), quitado pitMob. No se halló ningún beforeunload ni overlay celeste concreto en el código; el cartel de Chrome se asume el de guardar contraseña.

- 0.85.7 (hb-ui): el cartel era el aviso de filtración de Google Password Manager; el login ya no usa input type=password (texto con -webkit-text-security, name no estandar, autocomplete off). Login offline verificado.

- 0.85.10 (hb-ui): quitados los rombos celestes de las casillas de salida (renderer.drawTeleportMarks); sin velo DOM/CSS detectado en vivo.
- 0.85.9 (hb-ui): auditoría UI vs original, ver docs/AUDITORIA_UI.md (corregido y pendiente).
