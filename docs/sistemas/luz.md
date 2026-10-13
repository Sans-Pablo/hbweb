# Luz dinámica y sombras largas

Opción `lightFx` (Opciones → Gráficos, "Luz dinámica y sombras largas"), solo en modo Remasterizado y con "Luz y viñeta" activa.

- `renderer.drawLights`: capa de oscuridad según `sky.night` y la viñeta, con huecos de luz (`destination-out`) alrededor del jugador, antorchas y hechizos, y brillo aditivo (`lighter`).
- `renderer.shK`: factores de la sombra larga (`spr.shadow(..., sq, sk)` en `assets.js`); el modo clásico conserva la sombra original (1/3, inclinada a la izquierda).
- Es solo visual: no toca `shared/`, por lo que no necesita test de simulación (cubierto por la batería existente y comprobación visual con `tools/e2e.py`).
