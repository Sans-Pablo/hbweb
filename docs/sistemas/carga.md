# Carga bajo demanda (streaming)

Código: `client/bundles.js` (qué hace falta, puro y probado en Node), `client/streaming.js` (cola de prioridad), `client/assets.js`, `web/sw.js` (caché persistente).
No existe en el original (carga todos los `.pak` al arrancar); es una optimización propia del port.

## Qué se descarga y cuándo
- **Arranque**: JSON de datos, núcleo de sprites (`coreKeys`: objetos del suelo, ~0,7 MB) y el *bundle* del mapa inicial: losetas que aparecen en su rejilla (`tileKeysOfGrid`, +50 para la sombra de los árboles) y las hojas de los monstruos de sus generadores/habitantes (`bundleOfWorld`). Granja: ~17 MB frente a 131 MB antes.
- **Cambio de mapa**: el bucle principal detecta el nuevo `world.grid` y pide su bundle con prioridad 2; mientras llega se dibujan marcadores (el renderizador ya omite hojas no listas).
- **Cercanía**: a ≤ 40 casillas de un teleport se calienta el destino (rejilla `.bin` y bundle, prioridad 1), salvo mapas vetados por `levelLimit`/`upperLevelLimit`. Un nivel 1 no baja Middleland (abaddon, wyvern...) hasta que puede entrar.
- **Mapas**: `data/maps/<id>.json` siempre; `.bin` con `m.ensure()`. `Adventure.teleport` rechaza ("cargando el mapa, vuelve a intentarlo") si la rejilla no ha llegado y la pide.
- **Sonido**: `Sound.prefetch` baja los `M<n>` de los monstruos del bundle (se guardan hasta que el audio se desbloquea); música ya iba por pista.
- **Efectos**: `SpellFx.getImg` descarga cada hoja al dibujarla; en reposo se calientan solo los golpes y chispas comunes.
- **Reposo** (20 s): hojas de la cripta de esqueletos.
- **HD**: solo para lo que se dibuja (no se precarga por bundle).
- **Servidor Node / pruebas**: pasan rejillas ya construidas (`maps[id].grid`), sin `ensure`.

## Caché
`web/sw.js` (Cache API): cache-first para sprites, HD, equipo, fx, ui, sfx y música (sus URL llevan `?v=ASSET_VERSION`); red primero para JSON y `.bin`. Al cambiar sonidos/música sin versión, subir `CACHE`.

## WebP (no versionado)
`python3 tools/to_webp.py` convierte `data/sprites/*.png` y `data/fx/*.png` a WebP sin pérdida (142 MB → 56 MB, −61 %) y escribe `data/webp.json` al final. Los `.webp` de esas carpetas y el marcador están en `.gitignore`: no se versionan. `client/imgurl.js` los usa solo si existe el marcador; sin él (p. ej. GitHub Pages) se sirven los PNG. `sprites_hd/` y `equip/` ya eran WebP versionados. Regla: los binarios generados no se suben; si se quiere WebP en producción, ejecutar el script en el despliegue.

## Pendiente / espacio en el repositorio
- `web/data` pesa ~450 MB y `.git` ~420 MB: no volver a versionar binarios regenerados sin cambios reales; valorar Git LFS o repositorio de datos aparte.

## Pruebas
`tests/streaming.test.mjs` (núcleo sin losetas ni monstruos, ciudad sin dragones, monstruos y sonidos de un campo, criptas, cola de prioridad sin duplicados).
