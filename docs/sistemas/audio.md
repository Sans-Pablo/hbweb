# Audio al volver a la pestaña (v0.76.0)

- Con la pestaña oculta el navegador acumula sonidos y al volver sonaban todos de golpe.
- `client/audio.js`: `visibilitychange` → `quietUntil` = ∞ mientras está oculta y `+1200 ms` al volver; la propiedad `quiet` descarta los sonidos nuevos en ese periodo.
- Sin test automático (depende del DOM); comprobado a mano.
