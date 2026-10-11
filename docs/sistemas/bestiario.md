# Bestiario (herramienta de pruebas visuales)

`http://localhost:8088/bestiario.html` (o `web/bestiario.html` en cualquier servidor estático). Código: `web/src/client/bestiary.js`.

Dibuja cualquier criatura de `npc.json` con el mismo `Renderer.drawEntity` del juego, sin entrar a jugar:
- **Vista Evolución**: una fila por etapa de tamaño (niveles 1, 10, 25, 40, 50) y una columna por dirección.
- **Vista Un nivel**: las 8 direcciones de un nivel concreto.
- Acciones: reposo, andar, atacar, daño, morir (en bucle). «Como summon» activa escala por nivel y auras; «Círculo de casteo» el círculo de nivel máximo.
- No modifica nada del juego ni usa la simulación: solo lectura de datos y sprites. Por eso no tiene test propio.

## Armería (`armeria.html`, `client/armory.js`)
Editor de sprites de objetos, enlazado con el Bestiario. Recorta el fotograma de mochila (`packKey`) de cualquier objeto de `items.json` y lo recolorea: matiz, saturación, brillo, contraste y reemplazo de un color (cuentagotas sobre el original, tolerancia, destino). Exporta PNG o lo guarda con `POST /api/dev/armory` (solo loopback) en `art/armory/<nombre>.png` + `.json` con la receta.
- No crea objetos en el juego: eso exigiría nuevos IDs de Item.cfg (autoritativos). Los PNG son material para spritelab/arte.
- Sin test propio (herramienta visual de solo lectura; el endpoint solo escribe en `art/armory/`).
