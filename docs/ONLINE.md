# Jugar online: tu PC como servidor, la web de GitHub como entrada

**Cómo funciona.** La web (`https://sans-pablo.github.io/hbweb/`) solo trae los gráficos y el cliente. El mundo, las cuentas y los personajes viven en el servidor de **tu PC** (`server/server.mjs`). El cliente se conecta a tu PC por un túnel con dirección fija (HTTPS/WSS). El PC debe estar **encendido y con «Servidor online.bat» abierto** para que se pueda jugar; si está apagado, la web funciona en modo local (un jugador, guardado en el navegador).

## Montarlo (una sola vez)

### Opción A · ngrok (recomendada, gratis, dirección fija)
1. Crea una cuenta en https://ngrok.com e instala ngrok (`winget install ngrok.ngrok`).
2. En el panel de ngrok copia tu *Authtoken* y ejecuta una vez: `ngrok config add-authtoken TU_TOKEN`.
3. En el panel, **Domains → Create Domain**: te da un dominio estático gratis, del tipo `algo-algo.ngrok-free.app`.
4. Doble clic en **`Servidor online.bat`**. Responde: tu usuario del juego (será administrador), `1` (ngrok) y tu dominio. Se guarda en `server/config.json`.

### Opción B · Tailscale Funnel (gratis, dirección fija)
1. Instala Tailscale (tailscale.com) y entra con tu cuenta. En el panel de administración activa **DNS → HTTPS Certificates**.
2. Ejecuta `tailscale funnel 8088` una vez: si Funnel no está permitido te da un enlace para activarlo. Tu dirección es `https://NOMBRE-PC.TU-RED.ts.net`.
3. Doble clic en **`Servidor online.bat`**, elige `2` y pega esa dirección.

### Publicar la dirección (una sola vez)
Edita `web/data/server.json` con tu dirección (sin barra final) y súbelo a `main`:
```json
{ "url": "https://algo-algo.ngrok-free.app" }
```
GitHub Pages tarda ~2 minutos en publicarlo. A partir de ahí, **cualquiera que abra el enlace de GitHub ve la pantalla «Partida en línea»**, crea su cuenta (usuario + contraseña), su personaje, y juega con los demás. La dirección es fija: no hay que volver a tocar nada.

> Estos pasos con ngrok/Tailscale/PowerShell no se han podido probar desde el entorno de desarrollo (Linux, sin Windows ni internet abierto); el servidor, el protocolo y los límites sí tienen tests (`tests/online.test.mjs`). Si algún paso falla, dime el mensaje y lo ajusto.

## Día a día
- Abre **`Servidor online.bat`** y déjalo abierto mientras se juega. Intro en esa ventana apaga todo.
- Quien entra por GitHub crea su cuenta; la contraseña se guarda con *scrypt* (nunca en claro). Tu progreso y el de todos está en `server/data/` (cuentas, partidas, bloqueos): **haz copia de esa carpeta** de vez en cuando.
- **Actualizar:** cada versión nueva se publica sola en GitHub, pero tu servidor debe actualizarse: `git pull` y reiniciar el `.bat`. Si cambia el protocolo (`NET_PROTO`), los clientes viejos avisan de que recarguen y el servidor distinto se ve en la pantalla de entrada («tu cliente es la v…»).

## Administración
Tres sitios, mismos comandos (`help` los lista):
- **Chat del juego** (solo cuentas de `admins` en `server/config.json`): `/who`, `/kick <jugador> [motivo]`, `/mute <jugador> [min]`, `/unmute`, `/ban <cuenta>`, `/unban <cuenta>`, `/banip <ip>`, `/say <anuncio>`, `/resetpass <cuenta> <clave>`, `/save`, `/restart`, `/stop`.
- **Consola del servidor** (la ventana negra del servidor): los mismos comandos sin barra.
- **Panel web** `http://localhost:8088/admin?token=…` (el enlace exacto sale al arrancar el servidor): lista de jugadores con nivel, mapa, IP y ping; expulsar, silenciar, bloquear, anunciar, guardar y reiniciar. **Solo funciona desde el propio PC**: por el túnel responde siempre 403.

## Seguridad (lo que ya hace el servidor)
- Contraseñas con scrypt y sal propia; mensajes de error que no revelan si un usuario existe.
- 8 intentos fallidos por IP y 10 min → bloqueo; 5 cuentas nuevas por IP y hora; máximo 6 conexiones por IP; límite de mensajes por segundo y de chat; sin respuesta 45 s → se cierra.
- Solo acepta WebSocket desde `https://sans-pablo.github.io` (configurable en `origins`), localhost y el propio servidor.
- Una sola sesión por cuenta (la nueva expulsa a la vieja). Nombres de personaje únicos.
- El servidor es quien decide todo (daño, botín, oro): el cliente solo manda órdenes.
- Herramientas de depuración (F1 → Herramientas) abiertas a todos los jugadores; `HB_DEBUG=0` las apaga.
- Recuerda: abrir un servidor a internet siempre tiene riesgo. Mantén Node al día y no compartas el token del panel.

## Pruebas rápidas sin túnel
- `node server/server.mjs` y abre `http://localhost:8088/` (el servidor también sirve la web).
- Desde la web local estática: `http://localhost:8123/?server=http://localhost:8088`.
- `?offline=1` fuerza el modo local aunque haya servidor configurado.
