# Interfaz original (Legacy) y minimapa móvil — v0.84.8

- **Registro de eventos**: en modo Legacy sale arriba a la izquierda, 6 líneas de 15 px, 5 s de vida (original `CGame::ShowEventList`: `PutString(10, 10+i*15)`, `< 5000`). En Remastered se mantiene el registro largo abajo.
- **Entrada de chat** (Legacy): centrada sobre la barra inferior, ya no abajo a la izquierda.
- **Minimapa arrastrable**: clic izquierdo mantenido sobre el minimapa de la esquina lo mueve; la posición se guarda en `localStorage` (`hb.miniPos`) y se recorta a la vista. `renderer.miniReset()` la restaura. Clic derecho sigue cerrándolo.
- **Criptas**: en mapas de ancho ≤ 64 casillas el minimapa se agranda ×1.45 (máx. 240 px).
- Código: `renderer.js` (`miniRect`, `minimapHit`, `miniDrag*`), `controller.js` (pointerdown/move/up), `index.html` (`body.classic #log/#chat`), `hud.js` (`log`).
- Test: `tests/interfaz-original.test.mjs` (comprobación estática de las piezas).
