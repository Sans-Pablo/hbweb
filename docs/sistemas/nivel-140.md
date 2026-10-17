# Nivel máximo 140 y reinicio general (v0.85.58)

- `MAX_LEVEL = 140` (`drops.js`; `combatsys.js` lo reexporta). Antes 50.
- Experiencia: `expRate` sigue igual hasta el 50 (−8 % por nivel desde el 20) y del 50 al 140 baja solo −1,2 % por nivel. La tabla de niveles es la del original.
- Oro por subir de nivel: `50 + nivel/2` (antes 50 fijo, hasta el 50).
- Equipo: `remapLevel` ya no comprime; los objetos conservan su nivel original (tope 140). Los báculos maestros siguen en nivel 50.
- Reinicio único (`player.js` `WIPE_V = 1`): al cargar cada personaje (humano o bot) sin `wipeV` guardado, devuelve los puntos de estadística al fondo y borra mochila, equipo, banco y pendientes. Se conserva oro, nivel y magias. Subir `WIPE_V` lo repite. Los bots además pasan `RESET_V = 4` (reparten de nuevo).
- Copia previa: `../hbweb-backup/pre-0.85.58/data`.
- Pendiente: reajuste fino de monstruos/jefes, precios y requisitos de magia para el rango 50–140.
