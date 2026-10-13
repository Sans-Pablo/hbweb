# Plan de rendimiento gráfico y de carga (encargo para un agente autónomo)

> Este documento es el **encargo completo**. Un agente que lo lea junto con `CLAUDE.md` y `docs/PROCESO.md` tiene todo lo necesario para trabajar sin preguntar de nuevo. Skill de apoyo: `.claude/skills/rendimiento-sprites/SKILL.md`. Ficha viva del sistema: `docs/sistemas/rendimiento-sprites.md`.

## 1. Misión
Eliminar los tirones y la caída de fps que aparecen al cargar sprites (sobre todo las hojas HD y las mejoradas con IA, cada vez más numerosas y pesadas), **sin cambiar cómo se ve el juego ni cómo se juega**. El código original sigue siendo la especificación de la jugabilidad; este trabajo toca solo la capa de carga y dibujo, que es invención del port.

## 2. Qué se midió (baseline del 2026-10-13, `tools/perf/baseline.json`, Chromium headless con GL por software)
| Dato | Valor | Lectura |
|---|---|---|
| Hojas HD (`sprites_hd`) | 7 537 en disco, **207 MB** | En disco pesan poco (mediana 0,3 MB)… |
| …decodificadas (RGBA) | **7 389 MB** si se cargaran todas | …pero la memoria que cuestan es ~35× mayor: **el cuello de botella es decodificar y la memoria de imagen, no la descarga**. |
| Hojas grandes | 104 hojas ≥ 8 MB decodificadas = **1 481 MB** (terreno `t*` 2560×1920 = 18,8 MB c/u; `m1_*_8` 3040×1808 = 21 MB) | Cada una bloquea el hilo ~50–200 ms al primer `drawImage` si no está decodificada. |
| Arranque (granja) | **1 442 hojas pedidas, 71 MB transferidos, 1,5 GB decodificados** | `docs/sistemas/carga.md` prometía ~17 MB: algo se carga de más (ver F1). |
| Caminar 15 s | p50 66 ms, p95 167 ms, p99 217 ms, 43 MB decodificados nuevos | (GL por software: pesimista; sirve como base relativa). |
| Teleport | p99 **1 050 ms** (un fotograma de >1 s) | Hojas nuevas en bloque. |
| Defecto de datos | `web/data/sprites_hd/m0_3_5.webp` mide **0 bytes** (última modificación en v0.61.0, ya vacío) | Imagen rota; el reintento de `assets.js` lo oculta. |
| `sprites_ia/` | **No existe en este checkout** (`assets.js` la espera) | Las hojas con IA del usuario están en su PC; ver §9. |

Origen de las hojas grandes: `tools/upscale_hd.py` reescala ×4 (`k:4` en `sprites_hd.json`) y `tools/remaster_ia.py` (Real-ESRGAN ×4) las mejora con IA; de ahí los 2560×1920. Es la palanca principal de F2.4/F3: **×4 puede ser más de lo que se ve en pantalla**.

Herramienta preexistente que se **complementa, no se sustituye**: `tools/perf.py` (escenarios con bots, monstruos y magias; presupuesto dibujo medio < 12 ms y p95 < 33 ms; resultados en `pruebas/rendimiento/`). `tools/perf/run.py` mide carga y memoria de hojas; `tools/perf.py` mide el coste de dibujo en juego. Ejecutar ambas al cerrar cada fase.

Ya existe y **no hay que rehacer**: carga por mapa (`bundles.js`, `streaming.js`), Service Worker con caché (`web/sw.js`), `decode()` asíncrono (`dec()` en `assets.js`), reintento de hojas negras, WebP sin pérdida opcional (`tools/to_webp.py`).

## 3. Metas (criterios de aceptación globales)
Medidas con `python3 tools/perf/run.py` y `tools/sprite_audit.py`, en la misma máquina que la base.
| Métrica | Base | Meta |
|---|---|---|
| Memoria decodificada al arrancar (`boot.decoded_bytes`) | 1 519 MB | **≤ 300 MB** |
| Hojas pedidas al arrancar (`boot.sheets_requested`) | 1 441 | **≤ 600** |
| Transferencia al arrancar | 71 MB | **≤ 30 MB** (≤ 5 MB con caché caliente) |
| Fotogramas > 50 ms al caminar / al teletransportarse | 129 / 35 | **≤ 3 / ≤ 6** (con GPU real, `--gpu`) |
| Fotograma p99 al teletransportarse | 1 050 ms | **≤ 60 ms** |
| Hojas sobre el presupuesto (`sprite_audit --check`) | 2 + 1 ilegible | **0** |
| Aspecto | – | `tools/perf/visual.py --compare` en **OK** en las 4 escenas, clásico y remastered |
| Regresión | – | `tools/test.sh` verde, incluidos `online.test.mjs` y `net-*.test.mjs` |
Las metas de memoria y bytes no dependen de la máquina y se exigen con `run.py --check`. Los tiempos de fotograma exigen `--gpu` y una GPU real (pedir al usuario que la ejecute en su PC si el agente solo dispone de GL por software).

## 4. Reglas que no se negocian
1. **Fidelidad**: ninguna fórmula, posición ni texto cambia (`CLAUDE.md`). Nada de `Math.random`/`Date.now` en `shared/*`; este trabajo vive en `client/` y `tools/`.
2. **Paridad visual** antes y después de cada fase (`tools/perf/visual.py`). Si un cambio altera píxeles a propósito (p. ej. compresión con pérdida), se muestra la comparación al usuario y se decide con él.
3. **Datos generados**: salen de `tools/*.py`, no se editan a mano; JSON y hojas PNG se versionan, los `.webp` derivados de `to_webp.py` no. No se re-versionan binarios sin cambio real (el repo ya pesa ~420 MB).
4. **Una versión por bloque** (`docs/PROCESO.md`): cada fase cerrada = una versión con `tools/release.sh`. Cambios que un tester note van a `web/data/news.json`.
5. **Flag y retirada**: lo experimental (renderer GL, KTX2) va detrás de `?gl=1`/ajuste y con el camino actual intacto hasta que la paridad esté demostrada y el usuario lo apruebe. Un cambio de protocolo sube `NET_PROTO`.
6. **Medir antes de optimizar**, y una sola cosa a la vez: cada cambio se acepta o se revierte por sus números.

## 5. Fases
Cada fase termina con: tests verdes → `python3 tools/perf.py` dentro de su presupuesto → `perf/run.py --check --baseline` → `visual.py --compare` → ficha actualizada → CHANGELOG + news → versión. Si una fase no mejora su métrica, se revierte y se anota en la ficha (qué se probó y por qué no sirvió).

### F0 · Medición y saneado (½ día)
- Rehacer `m0_3_5.webp` (0 bytes): regenerar solo esa clave con `tools/upscale_hd.py` (HD ×4, es la que produjo `sprites_hd/`) o `tools/remaster_ia.py` si su entrada está en `sprites_ia.json`; si no se puede, preguntar al usuario. Comprobar que `sprite_audit --check` queda sin ilegibles.
- Hacer determinista la señal «todo cargado» (p. ej. `hb.renderer.spr.pending()` = hojas pedidas aún sin decodificar) y usarla en `visual.py` y `run.py` en vez de esperas fijas.
- Añadir al HUD de dibujo (ya muestra «dibujo media/pico ms») un contador de hojas pendientes y MB decodificados. Guardar una referencia visual (`visual.py --save`).
- Entregable: base `tools/perf/baseline.json` + referencia visual + el test `tests/perf_tools_test.py` en verde.

### F1 · Diagnóstico: quién pide 1 442 hojas y 1,5 GB (½ día)
- Instrumentar (temporal) `Sprites.src/hdImg/preloadHd` y `loadAssets` para volcar qué claves se piden al arrancar y por qué (caller). Sospechosos: precarga de personajes/equipo (`players.json`, `equip.json`), `preloadHd` de todo el reparto, `armory.js`, el bucle de `ready()`.
- Entregable: tabla en la ficha «hojas pedidas al arrancar, por origen, con MB». Prioriza F2.

### F2 · Ganancias sin cambiar formato (1–2 días) — **mayor retorno, menor riesgo**
1. **Presupuesto de decodificación por fotograma**: cola con prioridad (lo visible > lo cercano > el resto), 1–2 `decode()` en vuelo, una subida a pantalla por fotograma; nunca decodificar en el primer `drawImage`.
2. **Dejar de pedir lo que no se ve**: eliminar las cargas de F1 que no hacen falta en el arranque (diferirlas a reposo o al uso).
3. **Expulsión LRU de hojas decodificadas** con tope de memoria (p. ej. 256 MB de imagen): al superar el tope, soltar las menos recientes (`img.src = ""`/quitar referencia) para que el navegador libere la bitmap; recargar desde la caché del SW si vuelven a hacer falta.
4. **Escala real de las hojas HD/IA**: si el factor `k` es mayor del que se ve en pantalla (zoom del juego × DPR), generar el nivel necesario y no más. Herramienta en `tools/` (extiende `to_webp.py` o nueva), salida junto al original.
5. **Caché HTTP**: comprobar cabeceras del servidor (`server/` y GitHub Pages) y que la URL con `?v=` no se invalide en cada arranque (`armory.js` usa `Date.now()`).
- Verificar con `run.py` (decodificado y hojas al arrancar) y `visual.py`.

### F3 · Pipeline de recursos (2–3 días)
- `tools/build_assets.py`: por zona/bundle, recortar el espacio transparente de cada hoja (`sprite_audit --deep` da el % vacío), reempaquetar en atlas ≤ 2048 px de lado y actualizar los manifiestos (`sprites*.json`) con las nuevas coordenadas, conservando pivotes. Nombres con hash de contenido, `Cache-Control: immutable`.
- Perfiles de compresión para las hojas IA (WebP con pérdida `quality 88–92`, `alpha_quality 100`, `method 6`) **solo si `visual.py` lo aprueba** (tolerancia visual acordada con el usuario).
- Test: todo sprite del manifiesto resuelve a una hoja existente y en rango (`tests/data.test.mjs` ya cubre lo básico; ampliarlo con pivotes/rectángulos).

### F4 · Decodificación fuera del hilo principal (1–2 días)
- `createImageBitmap(blob, {premultiplyAlpha:'premultiply'})` en un Worker, con `ImageBitmap` transferible; sustituir `i.complete && naturalWidth` por una abstracción `Sheet` (listo/pendiente/fallido) en `assets.js`. Mantener el reintento de `sprite-retry.test.mjs`.
- Resultado esperado: cero tareas largas por decodificación.

### F5 · Renderer GPU detrás de flag (1–2 semanas) — solo si F2–F4 no alcanzan la meta con GPU real
- WebGL2 (con WebGPU como mejora opcional): terreno → sprites → luz y efectos, por capas, comparando con el Canvas 2D con `visual.py` en cada capa. Tinte, sombras y alfa en shaders (`WEAPON_RGB`, siluetas).
- Texturas **KTX2/Basis** para las hojas grandes (no se decodifican en CPU y ocupan 4–8× menos VRAM). Requiere `toktx`/`basisu` en el build (no están instalados en este entorno: pedir instalación o usar la versión WASM `basis_universal`).
- Pasar la meta de fotogramas con GPU real antes de proponer hacerlo por defecto.

### F6 · Opcional
Simulación local en un Worker; protocolo de red binario con deltas; empaquetado con Vite/TypeScript. Solo con petición expresa.

## 6. Protocolo de trabajo del agente
1. Leer `CLAUDE.md`, `docs/PROCESO.md`, `docs/sistemas/carga.md`, este plan y la ficha. No explorar a ciegas: `docs/MAPA.md` → `Grep` → `Read` con `offset/limit`.
2. Un único bloque de preguntas al principio solo si falta un dato de §9; con valores por defecto, no bloquear.
3. Por fase: **medir → hipótesis → cambio mínimo → medir → decidir (conservar o revertir)**. Apuntar cada intento y su resultado en la ficha (tabla «Intentos»).
4. Verificar con datos (`--eval`, `run.py`) antes que con imágenes; una captura por comprobación.
5. Commits por fase, mensajes cortos; entrega con `tools/release.sh X.Y.Z "Nombre" "mensaje"`. Trabajo directo en `main` salvo que el usuario indique una rama (esta sesión: `claude/happy-mendel-v3bv42`). No abrir PR sin que lo pidan.
6. Parar y avisar al usuario si: la paridad visual falla de forma deliberada (calidad), hace falta instalar herramientas, hay que tocar `NET_PROTO`, o una fase no alcanza su meta tras dos intentos razonados.

## 7. Informe al terminar cada fase (plantilla, ≤ 15 líneas)
```
Fase Fx — <nombre> — vX.Y.Z
Métrica        antes → después
boot.decoded_bytes   …  → …
boot.sheets_requested … → …
walk.frames_over_50ms … → …
Visual: OK / diferencias en … (adjunto diff)
Tests: tools/test.sh OK N
Qué no funcionó y por qué: …
Siguiente: …
```

## 8. Riesgos conocidos
- **GL por software** (Chromium headless) distorsiona los tiempos de fotograma: usar solo comparativas relativas y pedir una pasada con GPU real al usuario para las metas `--gpu`.
- **Expulsar hojas** puede provocar parpadeo si se sueltan las visibles: la expulsión respeta lo dibujado en los últimos N fotogramas.
- **Atlas** cambia coordenadas y pivotes: es la fuente más probable de desajustes de 1 px; la paridad visual por escena es la red de seguridad.
- **Caché del navegador y del SW**: al cambiar hojas, subir `ASSET_VERSION`/`IA_VERSION` (`assets.js`) y `CACHE` (`web/sw.js`).

## 9. Datos que faltan (pedir una vez, con valor por defecto)
| Pregunta | Por defecto |
|---|---|
| ¿Dónde están las hojas con IA (`sprites_ia/`, `ui_ia/`) y cuánto pesan? | Se asume la estructura de `assets.js` (`data/sprites_ia/*.webp`); el agente hace la F2–F3 sobre `sprites_hd` y deja la herramienta lista para IA. |
| ¿Hardware mínimo objetivo (PC medio, móvil)? | PC con GPU integrada; móvil gama media (`--mobile`). |
| ¿Tolerancia a pérdida visual en las hojas IA? | Ninguna perceptible (`visual.py` ≤ 0,5 %). |
| ¿Se acepta WebGL2 como requisito (F5)? | Sí, con Canvas 2D de respaldo. |
