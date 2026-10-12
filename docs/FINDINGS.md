# Trampas encontradas (leer antes de tocar datos o interfaz)

## Datos y conversores
- `tools/convert.py` puede **sobrescribir `web/data/npc.json`**. Por eso `tools/convert_all.py` ejecuta `npcs` siempre al final; `tests/data.test.mjs` lo comprueba y lista los NPC y mapas aún sin portar.
  Uso: `cd tools && python3 convert_npcs.py /root/HelbreathServer/Helbreath /root/HelbreathServer ../web/data` (sin `python3 -I`: importa `convert`).
- Los ficheros del servidor están en cp1252: `iconv -c -f cp1252 -t utf8` (sin `-c` falla con secuencias ilegales).
- `price < 0` en un objeto = no está a la venta. El oro es `p.gold`, no un objeto de la mochila.
- Las pociones son tipo 7 (EAT), no pilas. `isStack` solo es CONSUME(5) y ARROW(6). Vender un no-apilable exige cantidad 1.
- `inst.life` es la vida actual; `realStats(d, inst).maxLife` la máxima. `inst.attr` es el atributo de 32 bits empaquetado (`parseAttr`).
- Clave de sprite de objeto en el cliente: `"ip" + itemSet(sprite)` (`packKey`).

## Interfaz
- Números de cuadro del original: 11 tienda · 14 almacén · 16 tienda de magia · 17 cantidad · 18 texto · 20 menú NPC · 23 vender/reparar · 31 lista de venta. El cuadro de mejoras propias de la web usa el 60.
- Sprites: ND_GAME2 = `gamedialog_1`, ND_TEXT = `dialogtext_0`, ND_BUTTON = `dialogtext_1`. Tinta RGB(45,25,25), enlace RGB(4,0,50), hover blanco. Negrita = texto dibujado dos veces con 1 px de diferencia.
- El menú del NPC se abre pegado al cursor (`msX-117, msY-50`). Esc cierra el cuadro de NPC de más arriba.
- Un cuadro no puede cerrarse durante `gui.draw`; se barre una vez por fotograma (`npcUi.sweep()`).
- Un objeto "en trámite" (vender, depositar) queda desactivado en la mochila hasta que acaba la operación (`m_bIsItemDisabled`).

## Simulación
- `World.tick` solo aplica `tickVitals` a `kind === "player"`; los `citizen` no tienen vitales.
- Los hechizos solo apuntan a `kind` `npc` o `player`.
- Lanzar un hechizo no debe mover al personaje (`noHold` en el controlador tras `cast`).
- En modo prueba `MAGIC_MODE.free` todos los hechizos están aprendidos y no cuestan maná; los tests ponen `MAGIC_MODE.free = false`.
- Los monstruos resisten magia fielmente (`resistMagic`); esto es correcto, no un fallo.

## Pruebas del navegador
- Servidor estático en `web/`, Playwright con `executablePath: /opt/pw-browsers/chromium`.
- `window.hb.gui.dialogs.get(id)` permite mover cuadros; los NPC se localizan con `renderer` (`camX, camY, scale, ox, oy, dpr`).
- `api/info` da 404 en el servidor estático: es esperado (indica modo local).
- El clasificador de comandos del entorno puede agotar el tiempo; reintentar más tarde, no saltarse el sandbox.

- **ui.json pierde los iconos generados**: `convert_all.py --only ui` regenera `web/data/ui.json` y borra `summons_icon`, `recall_icon` y `pet_*` (botones sin icono). Después hay que reejecutar `tools/make_crypt_assets.py`; `tests/uiicons.test.mjs` lo vigila.

- **Observar bots tiraba el servidor**: `ownState` serializaba la entidad del bot observado con su `bot` (IA) y `bot.target` ↔ `target.bot` forman un ciclo → `JSON.stringify` lanzaba dentro del tick sin captura. Ahora `ownReplacer` omite la clave `bot`, el tick está protegido y los fallos van a `server/data/crash.log`.

- **Hojas IA (Real-ESRGAN, `tools/remaster_ia.py`) — lecciones del orge:**
  - Limpiar píxeles oscuros come pelo, flecos, sombras de profundidad y monstruos oscuros (wyvern, troll). Tampoco se quita el negro de abajo: es sombra propia del modelo (ver la lección del orge más abajo); con lum<38 además se cortaban los tobillos.
  - La mugre «volando» se filtra por fotograma: se descartan los trozos que no tocan el cuerpo (5 px) ni miden al menos el 15 % del trozo mayor.
  - El alfa original es binario; se rehace aparte por fotograma (`build_alpha`). El suavizado debe leer solo el fotograma propio: con los vecinos dejaba tiras de 1 px en el borde del recuadro.
  - Real-ESRGAN alisa la textura del pelaje y el alfa no la devuelve (idea pendiente: mezclar textura original o IA más suave).
  - El WebP se guarda con `exact=True` (conserva el color bajo lo transparente): `--alpha` rehace solo el contorno sin repetir la IA (orge, 40 hojas: ~12 s; con IA ~37 s).
  - Pendiente: wyvern, troll y sprites diminutos (gato, conejo, hormiga) pierden detalle con los umbrales de área; líneas rectas finas bajo los pies del orge: causa probable hallada y corregida (fotogramas vecinos, ver regla abajo); falta que Pablo lo confirme en el Bestiario.
  - **Regla (causa confirmada de tiras rectas en el borde del recuadro):** los filtros por fotograma de `build_alpha` solo leen su propio recuadro; con el margen de relleno entraban píxeles del fotograma vecino. Ver reglas en `docs/sistemas/bestiario.md`.
  - **Lección (orge, Pablo): el negro bajo los pies y entre las púas es sombra propia del modelo (la del garrote), no mugre.** El recorte de «sombra del suelo» (lum<14, 14 filas bajas) lo borraba; apagado con `black=0` en `clean_mask`. Antes de limpiar un tipo de píxel, pintar lo quitado en magenta sobre el original y comprobarlo a ojo; si hay duda, no borrar. Ver regla 2 en `docs/sistemas/bestiario.md`.
