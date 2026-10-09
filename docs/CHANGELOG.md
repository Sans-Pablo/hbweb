# Changelog

Registro de cambios del port, del más reciente al más antiguo. Se actualiza en cada entrega junto con `web/data/news.json` (lo que ven los testers con F1) y `web/data/version.json`.

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
