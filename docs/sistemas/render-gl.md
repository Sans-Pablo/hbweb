# Renderer WebGL2 (`?gl=1`)
Fichero: `web/src/client/glcompose.js`. Sin el parámetro, el renderer es Canvas2D como siempre.
- Desde 0.83.1: los quads de una composición se acumulan y salen en un solo draw (hasta 8 hojas por lote, 96 quads); tope de texturas 1.6 GB; subidas con presupuesto de 6 ms/fotograma (lo aplazado se reintenta y `warm` lo sube).
- Hojas de sprites = texturas (caché con tope 1.6 GB, se expulsa la menos usada). Un shader con modos: normal, multiplicar (tintes de ropa `DYE_RGB`), sumar 0.55 (pelo, `PutSpriteRGB`), desplazar canal (`WEAPON_RGB`) y tono de suelo (multiply × `dk` + 0.14 × `br`, recortado al alfa).
- `PersonCache` (`composed.js`) compone cada fotograma de personaje en un lienzo WebGL y lo vuelca (drawImage GPU→GPU) al atlas; `drawPerson` no cambia (se le pasan `put/tintedHair/putWeapon` GL).
- `Renderer.blendTone` usa `glc.tone` para los bloques de suelo; el resultado se copia al lienzo del bloque.
- Log de rendimiento: `gl` en `start`; `glx` por ventana (subidas de textura, ms, tonos, draws).
- Pendiente: entidades/sombras directamente en GL (hoy sigue siendo 2D por el orden de pintado de `drawEntity`).
- Desde 0.83.2: `?prof=1` activa el perfilador A/B (`profiler.js`, `renderer.pf` apaga capas); atlas con smoothing `low` (`PersonCache.blit`); lienzo principal `desynchronized` solo con `?desync=1` (0.83.2 parpadeaba).

## 0.83.6
- El canvas GL es premultiplicado: el shader debe devolver rgb<=alfa (`min(c.rgb, vec3(c.a))`) o el volcado a 2D suma luz y dibuja recuadros pálidos. `getImageData` no lo muestra (des-premultiplica); se detecta solo a ojo o desactivando `pcache.draw`.

## 0.83.5
- `buildMinimap` por ImageData + caché de color por (hoja, fotograma): quita 4 s de congelación al entrar a un mapa.

## 0.83.4
- WebGL es el modo por defecto; `?gl=0` apaga el compositor y deja el 2D.
- Subidas de textura: `UPMS` 3 ms/fotograma; `pump` no sube si `upMs` > UPMS/2.
- fx: textos sprFont horneados en caché (máx. 200).
