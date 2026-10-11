# Cómo editar el aspecto y los efectos de los monstruos

Guía para abrir en otra conversación. Todo el dibujado es del cliente (`web/src/client/`); la simulación (`web/src/shared/`) no interviene en lo visual.

## 1. Herramienta: el Bestiario
`http://localhost:8088/bestiario.html` (servidor: `node server/server.mjs 8088`). Ver `docs/sistemas/bestiario.md`.
- Vista **Evolución** (niveles 1, 10, 25, 40, 50 × direcciones) y vista **8 direcciones**; acciones reposo/andar/atacar/daño/morir en bucle.
- «Como summon» activa escala por nivel y auras; «Círculo de casteo» el círculo de nivel máximo.
- El navegador cachea el JS: tras editar `renderer.js`, recarga forzada (Ctrl+F5) o añade `?v=N` a la URL.
- Flujo barato: abrir el bestiario, mirar una vez, apuntar TODAS las correcciones y aplicarlas juntas.

## 2. Dónde está cada cosa
- `renderer.js` → `drawEntity(e, x, y, s, overlays)`: `x,y` = pivote de los pies. Rama «monstruo»: sprite (`mobSprite`), sombra, tintes, auras.
  - Auras de summon Lv 50 (`e.comp && e.clvl >= 50 && name in Demon/Frost/Liche`): bloque con `ctx.globalAlpha` (0.5 Demon/Frost, 1 Liche). Dentro, una rama por criatura.
  - `T = time + e.id*997` (tiempo por entidad); `rnd(k)` aleatorio determinista por entidad. **No usar `Math.random`** en efectos: parpadean.
  - Efectos de luz: `ctx.globalCompositeOperation = "lighter"` (acordarse de restaurarlo).
- `anim.js` → `mobSprite(e,time,count)`: clave de hoja = `cfg.sprite + (grupo*8 + dir-1)`; grupos 0 reposo, 1 andar, 2 atacar, 3 daño, 4 morir. `dir` 1..8 (1 arriba, 3 derecha, 5 abajo, 7 izquierda).
- `shared/systems/companion.js` → `SIZE_STAGES = [10,25,40,50]`, `sizeStep`; `petScale` (renderer) escala por etapa.
- `fx.js` → efectos de evento (`fx.scast` círculo de casteo del summon, `popScale`, `evoGlow`).
- API de sprites (`assets.js`, `renderer.spr`): `spr.frames(key)`, `spr.frame(key,f)` → `[sx,sy,w,h,pvx,pvy]`, `spr.src(key)` → `[img,k]`, `spr.ready(key)`, `spr.put/shadow/tinted(ctx,key,f,x,y,color,alpha)`.

## 3. Anclar un efecto a una parte del sprite (lección aprendida)
Los fotogramas son imágenes de ~100 px; el pivote de cada uno varía. Para poner un efecto en el báculo, el orbe o los puños:
- **Nunca** «los píxeles opacos más altos/bajos»: eso coge las alas o las puntas de las alas (error ya cometido con Demon y Frost).
- **Por color**, como `orbPos` (Liche: píxeles violeta) y `tipPos` (Frost: máscara azul fuerte, componente conectada más grande, centroide de la punta). Resultado relativo al pivote, cacheado por `key:f`.
- **Por tabla fija por dirección** cuando el color no discrimina (puños del Demon: tabla `HD` en el bloque Demon, `[dx,dy]` relativos al pivote). En vistas de espalda los puños quedan tras las alas: valores aproximados.
- Los ojos del Liche usan la altura del sprite **en reposo** (`mobSprite({...e, act: ACT.STOP}, 0, …)`); con la del frame actual saltaban al atacar.
- Para localizar coordenadas: volcar el sprite en una rejilla pivote-relativa (canvas de prueba con `window.hb.renderer`, entidad falsa con `Object.create(base)`), mirar a zoom y anotar píxeles.

## 4. Estilo y criterios del usuario
- Sutil, «a la altura del Liche»: nada «flashy». Pixelado coherente con el juego (cuadrados 2×2, parpadeo en pasos con `Math.floor(T/90)`), no degradados lisos «HD».
- Demon: fuego en los puños, brasas y calor; **sin** aura en el suelo ni llamas tipo Fire Field.
- Frost: viento helado, copos, destellos; **sin** anillo en el suelo ni cristales orbitando; estrella en la punta del báculo.
- Liche: ojos rojos solo mirando abajo/abajo-izq./abajo-der., orbe violeta con halo y chispas.

## 5. Reglas del repo que afectan
- Original = especificación. Sin `Math.random`/`Date.now` en `shared/`. Cadenas de interfaz nuevas en español → entrada en inglés en `client/i18n.js`.
- Un efecto visible nuevo → línea en `docs/CHANGELOG.md` y en `web/data/news.json`; ficha en `docs/sistemas/`.
- Los ficheros del repo usan CRLF: editar con scripts que normalicen `\r\n` y restauren (o la herramienta Edit tras comprobar).
- Siempre decir el número de versión al entregar. Publicar (commit/push) solo si el usuario lo pide: `tools/release.sh X.Y.Z "Nombre" "mensaje"`.
