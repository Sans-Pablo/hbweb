# Plan: servidor oficial siempre online y de mínima latencia

Meta: el juego vive en un servidor 24/7; el jugador entra por una web, se registra y juega desde el navegador (solo escritorio por ahora). Prioridad nº 1: el menor ping posible.

## 0. Punto de partida (v0.80.1)
- Servidor Node sin dependencias (`server/server.mjs`, WebSocket propio, `setNoDelay(true)`, tick 20 Hz = `TICK_MS 50`), SQLite con WAL y backups, cuentas con scrypt, límites por IP, admin por chat/consola/panel local.
- Cliente con **predicción** de movimiento/ataque y reloj sincronizado (`connection.js`), ping cada 2 s.
- Hospedaje actual: **el PC de casa + túnel** (ngrok / Tailscale Funnel). Problemas: se apaga con el PC, el túnel añade un salto y a veces pasa por relays (DERP), IP/uplink residencial, el cliente se sirve desde GitHub Pages (~450 MB de `web/data`).

## 1. Presupuesto de latencia (qué se puede y qué no)
`ms percibidos ≈ RTT de red + espera al siguiente tick (0–50, media 25) + interpolación de otros (~100) + frame (16)`
- La **red** manda: la luz tarda ~1 ms por cada 100 km en fibra (ida y vuelta ×2). Mismo país ≈ 10–40 ms; mismo continente ≈ 40–100; transoceánico 150–250. **Un solo servidor no puede dar poco ms a todo el mundo**: hay que elegir la región donde está la mayoría de jugadores. *(Decisión abierta, ver al final.)*
- Lo propio (movimiento y ataque) ya se predice en el cliente, así que el jugador no «siente» el RTT al caminar; lo siente en la respuesta del servidor (daño, drops) y en lo que hacen los demás.
- Objetivos medibles: **RTT p95 < 60 ms** en la región objetivo, **tick del servidor < 10 ms (p99 < 25)** con 100 jugadores+bots, **0 reconexiones** por hora, **tiempo hasta jugar < 10 s** con caché fría y < 3 s con caché caliente.

## 2. Fases

### Fase A · Medir antes de tocar (1–2 días)
1. HUD de red visible (F1/devtools): ping actual, p95 de 1 min, jitter, paquetes tardíos, `tick ms` del servidor.
2. En el servidor: `perf_hooks.monitorEventLoopDelay()` + duración de `tickOnce()` + bytes/s por cliente; expuesto en el panel admin y en un log cada minuto.
3. Línea base con `tools/bench.mjs` y bots reales (`tools/e2e.py players(n)`) contra el servidor actual, para saber cuánto mejora cada fase.

### Fase B · Servidor dedicado 24/7 (2–3 días)  ← lo que más mejora el ping
- **VPS Linux en la región objetivo** (Hetzner / OVH / Vultr / DigitalOcean; 2–4 vCPU con buen rendimiento monohilo, 4 GB RAM, NVMe). Node es de un hilo: importa la **frecuencia por núcleo**, no el número. Elegir proveedor con **protección anti-DDoS incluida** (OVH Game, Hetzner básico).
- Ubuntu LTS + Node LTS, usuario sin privilegios, `ufw` (solo 22 limitado, 80, 443), `fail2ban`, SSH solo con clave.
- **systemd** con `Restart=always`, `LimitNOFILE`, `Nice`, logs a journald. Sustituye a `iniciar.ps1` / `.bat`.
- **TLS directo con Caddy** (certificados automáticos) delante del Node, solo para `wss://juego.<dominio>/ws`. Sin túnel, sin ngrok, sin Funnel. DNS del host del juego en **«solo DNS» (nube gris)**: no pasar el WebSocket por un proxy/CDN, que añade un salto.
- Kernel: `net.ipv4.tcp_congestion_control=bbr`, `tcp_slow_start_after_idle=0`, `tcp_notsent_lowat` bajo.
- Despliegue: `deploy.sh` (git pull → tests → anuncio «reinicio en 60 s» → `/save` → `systemctl restart`). El PC de casa queda solo para desarrollo.
- Dominio propio (p. ej. `helbreath.<tuDominio>`): `www` = cliente, `juego.` = servidor. `server.json` apunta ahí.

### Fase C · Latencia de aplicación (3–5 días)
1. **Procesar las órdenes al llegar**, no al siguiente tick (quita ~25 ms de media): aplicar `cmd` a un jugador libre en el mismo ciclo del evento de red y responder el `ack` al instante; la simulación sigue a 20 Hz. *(Revisar en `server.mjs` cómo se encolan hoy los `cmd`; conservar el determinismo de `shared/*`.)*
2. **Envío por eventos**: no esperar al tick para enviar el resultado propio (daño, drop, `ack`); el resto (otros jugadores) sí va en el snapshot del tick.
3. **Snapshots por delta y por interés (AOI)**: cada cliente solo recibe las entidades de su vista; mensajes diminutos. Hoy es JSON (`JSON.stringify`); pasar a **formato binario compacto** + `NET_PROTO` 11. Menos bytes = menos jitter en conexiones malas y menos CPU del servidor.
4. **Interpolación adaptativa** de entidades ajenas: buffer de 1–2 snapshots que crece solo si hay jitter (100 ms fijos → 60–120 ms según red).
5. **Sin compresión por mensaje** (ya es así con el WS propio) y sin `await` ni E/S síncrona dentro del tick.
6. **Reconexión automática con reanudación** (token de sesión, la entidad se mantiene unos segundos): un microcorte no debe echar al jugador.
7. *(Solo si Fase A demuestra pérdida de paquetes o picos de HOL-blocking)*: evaluar WebTransport/WebRTC datagrams para el movimiento. Por defecto **no**: TCP+BBR basta para un RPG por casillas a 20 Hz.

### Fase D · Rendimiento del servidor (2–3 días)
- Perfilar con 100 entidades humanas+bots (`--cpu-prof`); presupuesto del tick ≤ 10 ms.
- Persistencia fuera del camino caliente: los `persist` cada 5 s y los backups a un `worker_thread` o por lotes; ningún `fsync` síncrono en el tick.
- Controlar el GC (`--max-semi-space-size`), evitar asignaciones por tick en `world.js`/`systems/*`.
- Los **bots/residentes** consumen CPU del mismo hilo: tope configurable y que bajen su frecuencia de decisión si el tick supera el presupuesto.
- Capacidad: medir cuántos jugadores soporta un proceso antes de pasar de 10 ms. Si hiciera falta escalar, el siguiente paso es un **proceso por grupo de mapas** (no por región), y se decide con datos.

### Fase E · Siempre online (2 días)
- **Monitor externo** (UptimeRobot / Better Stack) sobre `/health` (nuevo: versión, jugadores, tick ms) + alerta a Discord/Telegram.
- **Backups**: `hb.sqlite` cada hora en local (rotación) y **diario a almacenamiento externo** (Backblaze B2 / R2 / Hetzner Storage Box) cifrado. Probar la restauración una vez.
- Reinicios de despliegue con aviso en el juego y reconexión automática (Fase C.6); ventanas de mantenimiento fuera del pico.
- Rotación de logs, límite de disco, alerta a 80 %.
- `err.log`/`out.log` salen del repo; `crashLog` existente envía resumen al canal de alertas.

### Fase F · Web de entrada, registro y carga rápida (3–4 días)
- **Cliente estático en una CDN** (Cloudflare Pages / R2 o GitHub Pages con dominio propio): hojas de sprites `.webp` (`tools/to_webp.py`), Brotli, `Cache-Control: immutable` con hash en el nombre, HTTP/3. El servidor de juego **no** sirve estáticos en producción.
- **Caché persistente** (Cache Storage/IndexedDB + service worker): la primera carga descarga lo mínimo (granja y ciudad, `streaming.js`/`bundles.js` ya existen), el resto en segundo plano. Segunda visita: arranque casi inmediato.
- **Landing + registro**: usuario, contraseña, **correo** (verificación y recuperación de contraseña con Resend/Mailgun), **Cloudflare Turnstile** contra bots, términos y privacidad (RGPD si hay jugadores en la UE). Hoy no hay correo: sin él no hay recuperación → es bloqueante para un servidor público.
- **Solo escritorio**: detectar móvil/tablet táctil y mostrar «versión móvil próximamente» (hay `mobile.js`; se bloquea la entrada, no se borra).
- Apagar herramientas de depuración para jugadores (`HB_DEBUG=0`), `origins` solo el dominio oficial, panel admin únicamente por túnel SSH.
- Selector de **servidor/región** reservado para el futuro (campo en `server.json`), sin implementarlo.

### Fase G · Seguridad y abuso (continuo, 2 días iniciales)
Ya existe: scrypt, límites de login/registro/mensajes, autoridad total del servidor. Añadir: límite de cmd/s por tipo, validación de rango de todos los campos, tamaño máximo de mensaje, ban por cuenta+IP, registro de auditoría de oro/objetos, actualizaciones de seguridad automáticas (`unattended-upgrades`), secretos en variables de entorno (no en `config.json` del repo).

### Fase H · Prueba de carga y lanzamiento (3 días)
1. Prueba de carga con `bench.mjs` + bots remotos desde otra región: 40 → 100 → 150 conexiones, 8 h sin avisos de «bloqueado» (criterio P0 existente).
2. **Beta cerrada** con testers de la región objetivo; medir ping real (telemetría anónima del HUD de red: RTT p50/p95 por país).
3. Checklist de salida: dominio y TLS ok · backups restaurados · monitor y alertas ok · registro con correo · `NET_PROTO` y aviso de recarga · tutorial P1 · guía de testers/reportes · plan de rollback.

## 3. Orden y esfuerzo
A (1–2 d) → **B (2–3 d)** → C (3–5 d) → D (2–3 d) → E (2 d) → F (3–4 d) → G (2 d) → H (3 d) ≈ **3–4 semanas** de trabajo. Se puede abrir una beta tras A+B+E+F (≈ 1,5 semanas); C y D afinan los ms después.

## 4. Costes orientativos
VPS 8–25 €/mes · dominio ~12 €/año · almacenamiento de backups ~1–3 €/mes · correo transaccional gratis hasta unos miles/mes · Cloudflare (DNS/Pages/Turnstile) gratis. Total ≈ **10–30 €/mes**.

## 5. Riesgos
- Jugadores de otro continente tendrán más ms que el físico permite (mitigación: predicción; a futuro, una segunda región con mundo separado).
- Node monohilo: un tick lento afecta a todos (Fases A y D lo vigilan).
- Peso del repo/`web/data`: mover los estáticos a la CDN antes del lanzamiento (ver P5, LFS).
- Sin correo no hay recuperación de cuentas (Fase F).

## 6. Decisiones abiertas
1. **Región donde viven la mayoría de jugadores** (decide el datacenter y por tanto el ping).
2. Proveedor (Hetzner/OVH/otro) y dominio.
3. Correo obligatorio en el registro: sí/no.
