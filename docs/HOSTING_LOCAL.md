# Hospedar el servidor en el PC local: alternativas y flujo de versiones estables

Contexto (v0.80.1): el servidor ya es un Node sin dependencias; el puerto (`argv[2]`/`PORT`) y la carpeta de datos (`HB_DATA`) son configurables, así que **varias instancias en el mismo PC son posibles sin tocar código**. Presupuesto aceptado: unos pocos €/mes. Prioridad: versiones **estables y testeables**, no solo "que conecte".

> Precios y límites de terceros: sacados de búsquedas web de oct-2026 (fuentes de terceros que a veces se contradicen). **Verificar en la web oficial antes de pagar.**

## 1. Dos problemas distintos

1. **Conectividad**: cómo llega un jugador de fuera a tu PC (sección 2).
2. **Estabilidad/versiones**: cómo evitar que probar una versión rompa el servidor al que juegan tus amigos (sección 3). Esta parte es independiente del túnel elegido y es la más valiosa.

## 2. Alternativas de conectividad

| Opción | Coste | Latencia añadida | Estabilidad | Esfuerzo | Notas |
|---|---|---|---|---|---|
| **A. Port-forward + DDNS** (router → PC, Caddy/Node con TLS) | 0–12 €/año (dominio) | **Ninguna** (directo) | Alta si el ISP da IP pública | Medio | Imposible con **CGNAT** (comprobar: la IP WAN del router ≠ la que ve `ifconfig.me`). Expone tu IP de casa. Hay que abrir puerto y gestionar TLS (`wss://` obligatorio desde GitHub Pages). |
| **B. Cloudflare Tunnel (con dominio propio)** | tú pagas solo el dominio (~10 €/año); el túnel es gratis | Un salto por el borde de Cloudflare (unos pocos ms si tienes PoP cerca) | Buena; URL fija; reconexión automática; oculta tu IP | Bajo-medio | Soporta **WebSocket** (nuestro juego es WS sobre HTTPS, no TCP crudo, así que no necesita Spectrum). Vigilar la letra pequeña de uso de ancho de banda no-HTML en plan gratis; en WS de baja tasa (JSON a 20 Hz) es muy poco tráfico. Es la opción **recomendada para empezar**. |
| **C. Túnel inverso a un VPS barato** (WireGuard o frp/Chisel + Caddy en el VPS) | VPS ~4–6 €/mes | Un salto (PC → VPS → jugador); si el VPS está cerca de los jugadores, ≈ igual que A | Muy alta y **IP fija pública**, funciona con CGNAT | Medio-alto | Control total, sin límites de terceros, y es **el mismo VPS que sirve de "low cost" y de futuro servidor real** (ver `HOSTING_ESCALA.md`): migrar luego es mover el Node al VPS y quitar el túnel. Pangolin es cómodo pero está pensado para HTTP; para nosotros (HTTP/WS) vale, WireGuard+Caddy es más simple y estable. |
| **D. Tailscale Funnel** (actual) | 0 | Va por relays de Tailscale; ancho de banda con límites **no publicados** y no configurables | Media; sin SLA | Ya hecho | Válido para pruebas con 2–3 personas; no para "oficial". Alternativa privada: **Tailscale solo-tailnet** (los amigos instalan Tailscale y entran por la IP del tailnet): gratis, directo P2P casi siempre, pero el cliente en GitHub Pages (https) no puede hablar `ws://` a una IP privada → habría que servir el cliente también desde el PC. |
| **E. ngrok de pago** | ≈ 8–10 €/mes (plan de entrada, ~5 GB de transferencia incluida; dominio fijo) o pago por uso (~18–20 €) | Un salto | Buena, pero **la cuota de datos** puede quedarse corta y el precio sube | Ya hecho | Cómodo, pero el más caro por lo que da. Solo si no quieres dominio ni VPS. |
| **F. playit.gg** | 0 / premium barato | Relay | Media | Bajo | Orientado a TCP/UDP de juegos; innecesario para nosotros (somos HTTP/WS). Descartada. |

### Recomendación
1. **Ahora (0 € + dominio ~10 €/año): B, Cloudflare Tunnel con dominio propio.** URL estable (`juego.tudominio`), TLS gratis, IP oculta, arranca como servicio de Windows. Sustituye a ngrok/Funnel.
2. **Si Cloudflare da jitter o límites, o hay CGNAT que lo impida: C**, un VPS de ~5 € como punto de entrada con WireGuard hacia tu PC. Es también el camino natural al servidor oficial.
3. **A (port-forward)** solo si tu ISP te da IP pública y quieres cero saltos; es lo que da el mejor ping desde casa.
4. Descartar F y, salvo comodidad, E.

Medir antes de decidir: con `?server=` apuntando a cada opción, comparar el RTT del HUD (p50/p95) desde 2–3 amigos reales durante una sesión. El tráfico del juego es pequeño; lo que distingue las opciones es el **jitter**, no el ancho de banda.

## 3. Estabilidad y testabilidad en un solo PC

### 3.1 Tres canales en el mismo PC
| Canal | Puerto | `HB_DATA` | Código | Quién entra |
|---|---|---|---|---|
| **stable** | 8088 | `D:\hb\data-stable` | carpeta `D:\hb\releases\vX.Y.Z` (tag) | amigos / jugadores |
| **beta** | 8089 | `D:\hb\data-beta` (copia de stable cuando se quiere) | `main` o el release candidate | testers que aceptan romper cosas |
| **dev** | 8090 | `D:\hb\data-dev` | tu carpeta de trabajo | solo tú |

- Cada canal es un proceso Node independiente con **su propia base de datos**, así una prueba no puede corromper cuentas reales.
- Un túnel (Cloudflare) con tres hostnames: `juego.` → 8088, `beta.` → 8089 (dev solo local). Un cliente por canal: `server.json` distinto o `?server=wss://beta.…`.
- **Los releases se despliegan como carpetas inmutables** (`releases\v0.80.1`, `releases\v0.81.0`…) y un enlace/ruta `current` apunta a una. Actualizar = parar, cambiar `current`, arrancar. **Rollback = volver a apuntar a la carpeta anterior** (segundos), sin recompilar nada (no hay build).
- Regla: solo se promociona a stable lo que pasó antes por beta ≥ 48 h sin incidentes.

### 3.2 Pipeline de promoción (script `tools/promover.ps1`, por escribir)
1. `tools/test.sh` verde (obligatorio; hoy ya existe).
2. `release.sh X.Y.Z` crea el tag y la carpeta `releases\vX.Y.Z`.
3. Despliegue a **beta**: copia de `data-stable` → `data-beta` (para probar migraciones con datos reales), arranque en 8089.
4. Checklist de beta (lista de F1/`news.json`) + `tools/e2e.py` + `bench.mjs` con 40 bots.
5. Promoción a **stable**: backup de `data-stable` → aviso en el juego "reinicio en 60 s" → `/save` → cambio de `current` → arranque → comprobar `/health`.
6. Si el health falla en 60 s: **rollback automático** a la versión anterior y restauración del backup si hubo migración.

### 3.3 Compatibilidad cliente/servidor
- El cliente en GitHub Pages se actualiza solo; el servidor stable no. Hoy `NET_PROTO` obliga a recargar. Añadir: el servidor anuncia `{version, proto}` en el saludo y el cliente muestra "servidor en vX, tú en vY" si difieren, en vez de fallar mudo.
- Mejor: **el cliente también se versiona por canal** (rama/carpeta de Pages `stable/` y `beta/`), para que el cliente stable nunca hable con un servidor beta ni al revés.
- Las migraciones de datos (`store.mjs`) deben ser **hacia delante y reversibles por backup**: antes de arrancar una versión con migración, backup automático con el nombre de la versión.

### 3.4 Operación 24/7 en Windows
- **Servicio de Windows** con NSSM o WinSW (reinicio automático al fallar y al arrancar el PC, logs rotados) en lugar de `iniciar.ps1`; un servicio por canal. `cloudflared` también como servicio.
- Energía: *Nunca suspender* (también el disco y USB), Windows Update con horas activas y reinicio programado fuera del pico; opcional **SAI** (≈ 40–60 €, único coste puntual realmente útil: protege SQLite y el router).
- Wi-Fi no: **cable**. Si el ISP lo permite, IP del PC reservada en el router.
- `/health` (versión, proto, jugadores, tick ms, antigüedad del último backup) + monitor externo gratuito (UptimeRobot/Better Stack) avisando por Telegram/Discord.
- **Backups**: SQLite con `VACUUM INTO` cada hora (local, rotación 48) y diario cifrado a almacenamiento externo (Backblaze B2 / R2, ~1 €/mes). Probar una restauración.
- Si el PC es también el de uso diario/juegos: el pico de CPU del PC puede afectar al tick; fijar prioridad "alta" del servicio y medir con el HUD (el tick medido es 0,36 ms, hay margen).

### 3.5 Qué testear siempre
- `online.test.mjs`, `net-*.test.mjs`, `bench.mjs` (40 bots, 8 h sin "bloqueado"), `e2e.py` con 2 jugadores.
- Prueba de **reinicio**: matar el proceso con jugadores conectados → deben reconectar y conservar el progreso (hoy no hay reanudación; ver Fase C.6 de `HOSTING.md`).
- Prueba de **rollback**: promover una versión deliberadamente rota a beta y comprobar que el script vuelve atrás.

## 4. Coste total orientativo
| Plan | Coste |
|---|---|
| Cloudflare Tunnel + dominio + 3 canales + backups gratis | ≈ **1 €/mes** (dominio) |
| + SAI | +40–60 € una vez |
| + backups externos | +1 €/mes |
| Variante VPS relay (C) | +4–6 €/mes |
| ngrok de pago (E) | 8–20 €/mes |

## 5. Plan de implementación (≈ 3–4 días)
1. (0,5 d) Dominio + Cloudflare Tunnel con 2 hostnames; mover `server.json` y `origins`; medir RTT contra Funnel.
2. (1 d) Estructura `releases/` + `current`, servicios NSSM (stable/beta), `tools/promover.ps1` con backup, health-check y rollback.
3. (0,5 d) `/health` y saludo `{version, proto}` + aviso en el cliente; canal de cliente `stable/`/`beta/`.
4. (0,5 d) Backups horarios/diarios + restauración probada + alertas.
5. (1 d) Pruebas de reinicio/rollback y sesión con amigos midiendo RTT p50/p95.

## 6. Decisiones abiertas
1. ¿Tienes dominio propio, o lo compramos (~10 €/año)?
2. ¿Tu ISP te da IP pública (para valorar A) o CGNAT? (Se comprueba en 1 min.)
3. ¿El PC es solo para esto o también tu máquina de uso diario/juegos?
4. ¿Quieres beta abierta a amigos, o solo stable + dev tuyo?

## Fuentes consultadas
- [Cloudflare Tunnel para servidores de juego](https://space-node.net/blog/cloudflare-tunnel-game-server-guide-2026) (blog de un hosting; la cifra de 5–20 ms no está verificada)
- [Alternativas a playit.gg](https://pinggy.io/amp/blog/best_playit_gg_alternatives/)
- [Precios de ngrok 2026](https://www.toolsurf.com/ngrok-pricing-in-2025-every-plan-explained-free-personal-pro-enterprise-2026-plans-features-best-deals-compared/), [resumen de Orb](https://withorb.com/blog/ngrok-pricing) (fuentes contradictorias; verificar en ngrok.com/pricing)
- [Tailscale Funnel (doc oficial)](https://tailscale.com/docs/features/tailscale-funnel.md), [límites de Funnel](https://www.ssdnodes.com/learn/tailscale-funnel-limits-and-ports)
- [Pangolin como proxy inverso con túnel](https://ramnode.com/guides/pangolin), [Pangolin en VPS (Contabo)](https://contabo.com/blog/de/pangolin-vps-selbst-hosten/)
