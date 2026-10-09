# Estado del proyecto

**Hecho:** granja de Aresden jugable; combate con fórmulas del servidor original; ítems originales (568 de Item.cfg), mochila de 50 casillas, peso, equipar con requisitos, absorción por parte del cuerpo, durabilidad (solo con bando), botín con las tasas originales (1/1), habilidades con maestría, resistencia, hambre; opciones (Esc), mapa tipo Diablo II, correr con R, guardado en el navegador.

**Pendiente (por orden):** magia (Magic.cfg), resto de monstruos y mapas, portales, NPC y tiendas, reparación, atributos raros de ítems, arco y flechas, grupos y PvP. Gráficos y música congelados hasta que todo sea fiel.

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
- Pendiente: el tinte del pelo es una aproximación (el original suma RGB al píxel); el bando (Aresden/Elvine) aún no se elige.

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
