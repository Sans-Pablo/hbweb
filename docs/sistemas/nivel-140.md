# Nivel máximo 140 y reinicio general (v0.85.58)

- `MAX_LEVEL = 140` (`drops.js`; `combatsys.js` lo reexporta). Antes 50.
- Experiencia: `expRate` sigue igual hasta el 50 (−8 % por nivel desde el 20) y del 50 al 140 baja solo −1,2 % por nivel. La tabla de niveles es la del original.
- Oro por subir de nivel: `50 + nivel/2` (antes 50 fijo, hasta el 50).
- Equipo: `remapLevel` ya no comprime; los objetos conservan su nivel original (tope 140). Los báculos maestros siguen en nivel 50.
- Reinicio único (`player.js` `WIPE_V = 1`): al cargar cada personaje (humano o bot) sin `wipeV` guardado, devuelve los puntos de estadística al fondo y borra mochila, equipo, banco y pendientes. Se conserva oro, nivel y magias. Subir `WIPE_V` lo repite. Los bots además pasan `RESET_V = 4` (reparten de nuevo).
- Copia previa: `../hbweb-backup/pre-0.85.58/data`.
- Pendiente: reajuste fino de monstruos/jefes, precios y requisitos de magia para el rango 50–140.

## Cómo cambiar el nivel máximo (v0.85.59)
Editar solo `MAX_LEVEL` en `web/src/shared/levelcap.js`. De ahí se derivan: curva de experiencia (`expDecay`, el tramo final baja hasta `ENDGAME_RATE`),
oro por nivel (`levelUpGold`), nivel máximo de equipo (`MAX_GEAR_LEVEL`), Int mínima y precio de los libros (`intFactor`/`costFactor` → `magicbal.js`),
misión de Maestría (`lv50`, ahora "nivel = MAX_LEVEL"), barras del cliente, nivel del panel debug y normalización de `botstats`.
No se derivan (decisión consciente): báculos maestros (`MASTER_LEVEL` 50), pets/invocaciones de nivel 50. Si el tope sube de 200 hay que revisar `STAT_LIMIT` y `MAX_STR`.
Con tope 140 las magias exigen Int ≤ 170 (reescala 0,82) y los libros cuestan el 98 % del precio original.
