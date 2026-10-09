# Modo móvil

Invento del port (el original es solo de escritorio). Código: `web/src/client/mobile.js`, `gui.js` (modo `mobile`), `index.html` (CSS adaptable).

## Activación
`isMobile()`: pantalla táctil (`pointer: coarse` + puntos táctiles) o `?mobile=1` (`?mobile=0` lo fuerza apagado). Añade `body.mobile`, `gui.mobile = true` y `renderer.miniSize/miniTop` (minimapa pequeño bajo los botones).

## Auto-ataque
`initMobileOpts`: la primera vez en móvil (`mobileInit` en el almacén) `autoAttack = true`; después manda la opción del jugador. Botón AUTO en pantalla.

## Interfaz
- Lienzo GUI a pantalla completa con escala `k` (ajustada para que el cuadro abierto quepa entero, 0.5–1.3); un cuadro cada vez, centrado; sin arrastre ni barra inferior original.
- Capa DOM (`#mobile`): barras HP/MP/SP/XP, joystick virtual (`stickTarget`, correr a fondo), ⚔️ atacar al más cercano (`nearestHostile`), ✋ recoger (`nearestItem`), ❤️/🔷 pociones, 🏃 correr, 💬 chat, ☰ menú con todos los cuadros (personaje, mochila, compañeros, habilidades, magia, historial, opciones, novedades, tutorial, retorno, guardar, pantalla completa, zoom), ✕ cierra el cuadro abierto, zoom con dos dedos y aviso para girar el móvil en vertical.
- Los cuadros de tutorial son `mobileFixed` (se recolocan abajo/arriba con `layout`).
- Pantallas de acceso/creación y paneles DOM (opciones, novedades, personaje) con desplazamiento y 94 % de ancho.

## Pruebas
`tests/mobile.test.mjs` (funciones puras). Visual: Playwright con `is_mobile`, `has_touch` y `?mobile=1`.
