# Caché de fotogramas teñidos (`Sprites.tinted`)

**Problema (v0.85.26):** el Demon (y el Frost) summon desde el nivel 30 dibuja un resplandor de borde con 12 llamadas a `spr.tinted` por fotograma
(`renderer.js`, bloque `isD || isF`). Cada llamada recomponía el fotograma teñido en un lienzo temporal con la hoja HD a 4x (372x484 px):
borrar, copiar, `source-in`, y luego mezclar. Con el Demon Lv 50 (radio 1,8) son ~12 recomposiciones de 180 000 px por fotograma.

**Medida** (Chromium headless, render por software, `demon0` HD k=4, 12 tintados): **7,7-9,2 ms → 0,6-0,9 ms por fotograma** (~10x). Un tintado suelto:
0,65 ms → 0,03-0,07 ms. En GPU además desaparecen los 12 cambios de destino de dibujo (lienzo temporal ↔ principal) por fotograma.
El resto de capas del Demon cuesta poco: `put` 0,01 ms, `veins` 0,07 ms (ya cacheada), `shadow` 0,04 ms.

**Solución:** `tinted` guarda el fotograma ya teñido en un lienzo por (hoja, fotograma, color, escala) y lo reutiliza; solo cambian el alfa y el desplazamiento
(que no dependen del lienzo). Mismos píxeles de origen y mismo dibujo final: la salida es **idéntica bit a bit** (diferencia máx. 0 sobre 12 muestras + sprite).
Tope de memoria ~16 Mpx (~64 MB); al superarlo se vacía. `spr.noTintCache = true` devuelve el camino antiguo (para medir/comparar).

Test: `tests/tintcache.test.mjs`.

**Descartado:** guardar la capa a tamaño de pantalla (93x121): 14x más rápido pero con diferencias de hasta 22/255 en los bordes (el remuestreo cambia); no se cambia el aspecto.
