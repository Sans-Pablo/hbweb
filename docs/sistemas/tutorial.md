# Tutorial para jugadores nuevos

INVENTO del port (el original no tiene tutorial). Guion y estado: `shared/systems/tutorial.js`; cliente: `client/tutorial.js`. Test: `tests/tutorial.test.mjs`.

## Qué es
Una serie de conversaciones (lore + mecánicas básicas) en un cuadro con la **cara del que habla a la izquierda y el texto a la derecha** (efecto de máquina de escribir), intercaladas con objetivos que el jugador cumple jugando. Se puede **saltar** en cualquier momento y repetir cuando se quiera.

- Hablantes (`SPEAKERS`): `me` el propio personaje (su cara sale del sprite con su aspecto y equipo), `g` Gandlf (guía, mago del reino), `s` el tendero, `p` Gail, `k` Kennedy y `n` narrador (sin cara). Las caras de los NPC se recortan de sus sprites del juego (`compicon.miniOf`); no hay imágenes nuevas.
- Lore: naufragio, la granja de Aresden en la frontera, la guerra Aresden–Elvine y los muertos de las criptas del norte.
- 18 pasos (`STEPS`): bienvenida · andar · correr · personaje (F5) · mochila (F6) · equipar · combate (limo de práctica) · botín · poción · niveles y panel · ir a la tienda · hablar con el tendero · comprar · compañero (Gail) · invocarlo · arena (Kennedy) · cripta · despedida y recompensa.
- Cada paso: `lines` (conversación), `goal` opcional (`k`: move, run, panel, equip, kill, pickup, use, map, talk, buy, pet, petuse; con texto y pista en es/en), `after` (conversación al cumplirlo) y `grant` opcional. Todos los textos llevan `es` y `en`.

## Controles
- **Espacio / Intro / clic** avanzan (el primero completa el texto). **Saltar tutorial** (en el cuadro y en el rastreador) pide confirmar con un segundo clic. **Saltar paso** en el rastreador de objetivos.
- Mientras hay un objetivo se muestra el rastreador (cuadro 47, arriba en el centro): objetivo, pista, barra de progreso al andar y una **flecha con la distancia** hacia el destino (puerta de la tienda, tendero, Gail, limo).
- Repetir: `/tutorial` en el chat, botón «Repetir tutorial» en Opciones. `/tutorial off` lo salta.

## Estado y servidor
`p.tut = {i, st, g, claimed}` se guarda con la partida (`saveOf`/`loadSave`). `st`: `on` | `skip` | `done`. Un personaje nuevo empieza `on`; una partida antigua sin `tut` se carga como `done` (no se molesta a los testers).
Orden `tut {op}`: `get` (responde con el evento `tutorial`), `step {i}` (solo avanza), `skip`, `reset`, `grant {what}`. Concesiones (solo en el paso que corresponde): `dummy` (limo de práctica cerca), `loot` (poción en el suelo), `gold` (400 monedas para la tienda, **una vez por personaje**) y `reward` (500 monedas y 3 pociones, **una vez por personaje**; repetir el tutorial no las repite).
El cliente no decide reglas: detecta objetivos con eventos (`equip`, `death` con `by`, `pickup`, `use`, `purchased`, `petbought`, `companion`) y con el estado (andar, correr, cuadros abiertos, mapa).

## Añadir pasos
Editar `STEPS` (ambos idiomas) y, si hace falta un objetivo nuevo, `GOAL_KINDS` + `Tutorial.note/update` en el cliente; `tests/tutorial.test.mjs` recorre el guion completo y exige es+en, hablantes con ficha y objetivos conocidos.

## Pendiente
Cámara que enfoque el destino, resaltar el objetivo en el mundo, tutorial de la cripta jugable (portal, jefes) y un capítulo del bando (Aresden/Elvine) cuando se pueda elegir.
