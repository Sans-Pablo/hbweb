# Proceso de desarrollo (menos iteraciones, menos tokens)

Medido: 93 commits en 2 días, casi todos con su ritual (versión + novedades + changelog + CI + comprobación). Cada vuelta pequeña cuesta lo mismo que una grande. Reglas:

## 1. Entregas por bloques, no por retoque
- **Una versión por petición** (o por bloque de peticiones relacionadas). Los arreglos que salen al probar se acumulan en la misma versión hasta que el bloque esté verificado; no se publica «0.24.1» por un píxel.
- Excepción: un fallo que rompe el juego se publica solo.
- `tools/release.sh X.Y.Z "Nombre" "mensaje"` hace todo el ritual (comprueba CHANGELOG/news, versión, mapa, tests, commit con trailers, rebase, push, espera al CI). Un comando en vez de ~8.

## 2. Antes de programar (una sola vez)
- Peticiones grandes o ambiguas: **un único bloque de preguntas** al principio (AskUserQuestion, máx. 4) con valores por defecto razonables; después se construye de una vez.
- Escribir primero los criterios de aceptación en 5–10 líneas (en la ficha `docs/sistemas/<x>.md`); el test se escribe contra ellos.
- Agrupar peticiones: el usuario puede mandar varias a la vez con prioridad; se planifican juntas y se entregan en una versión.

## 3. Herramientas que evitan reescribir cosas
| Necesidad | Comando |
|---|---|
| Todos los tests (paralelo, solo imprime fallos) | `tools/test.sh` (`--fast` salta net-*; `tools/test.sh tutorial` filtra) |
| Prueba visual (escritorio o móvil, cuenta + personaje + salto de tutorial) | `python3 tools/e2e.py [--mobile] --eval JS --tap SEL --shot f.png` |
| Saber dónde está cada cosa sin leer ficheros | `docs/MAPA.md` (generado: `tools/mapa.sh`) |
| Entrega completa | `tools/release.sh` |

## 4. Ahorro de tokens
- **No leer ficheros enteros**: `docs/MAPA.md` → `Grep` → `Read` con `offset/limit`. Para barridos amplios, un agente `Explore` (devuelve conclusiones, no volcados).
- **Una captura por comprobación** y solo cuando importa; verificar con `--eval` (datos) antes que con imagen.
- **No reescribir scripts de prueba** en cada vuelta: usar `tools/e2e.py` (o importar `game()` desde Python).
- **Tests que solo imprimen fallos** (`tools/test.sh`): el resultado normal es una línea.
- **Mensajes de commit y respuestas cortos**; el detalle vive en CHANGELOG/ficha, no en el chat.
- **CLAUDE.md corto** (se carga en cada turno): reglas, no historia. La historia va a `docs/`.
- **Sesiones por bloque**: al terminar una versión grande, sesión nueva (el contexto acumulado se paga en cada turno). El resumen de contexto es `docs/ESTADO.md`: actualizarlo al entregar.
- No sondear el CI con bucles cortos: `release.sh` espera por sí solo.

## 5. Calidad sin vueltas
- Un test por sistema nuevo escrito **antes** de la prueba visual; la prueba visual solo para lo que el test no ve.
- CI ejecuta `tools/test.sh` (todos los tests, no un subconjunto): se acabó el «pasa en local pero no en CI» por tests olvidados.
- Ficheros grandes (`renderer.js` 677, `main.js` 620, `npcdialogs.js` 580 líneas): dividir al tocarlos más de 100 líneas, para que cada lectura sea barata.

## 6. Trabajo en paralelo
- Otro agente empuja a `main`: `git pull --rebase` antes de empezar y antes de subir, y bloques que toquen ficheros distintos.
- Tareas independientes (p. ej. documentar + test + datos) se reparten en subagentes con instrucciones completas; el trabajo que depende de lo anterior, no.
