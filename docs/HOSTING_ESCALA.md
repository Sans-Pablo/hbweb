# Escenarios de hospedaje: servidor global (100 jugadores) y servidor «low cost» (amigos y pruebas)

Complementa `docs/HOSTING.md` (fases técnicas). Aquí: **dimensionamiento, arquitectura, coste, equipo y calendario** de dos escenarios. Fecha: 2026-10-13, v0.80.1.

> Los precios son **estimaciones de rango** (cambian a menudo): verificar en la web del proveedor al contratar. Lo medido va marcado como *medido*; lo demás es proyección y debe confirmarse en la Fase A de `HOSTING.md`.

---

## 0. Lo que sabemos del sistema (base de cálculo)

| Dato | Valor | Origen |
|---|---|---|
| Tick de simulación | 20 Hz (50 ms) | `server.mjs` `TICK_MS` |
| Coste CPU del tick, 40 bots, ~190 entidades, 1 mapa | **0,36 ms medio · 1,4 ms p95 · 3,7 ms máx** | *medido* con `tools/bench.mjs` (20 vCPU de desarrollo; el banco limita a 40 bots) |
| Margen del tick | ~35× sobre el medio, ~35× sobre el p95 | 50 ms / 1,4 ms |
| Hilos | 1 (Node) | arquitectura |
| Protocolo | WebSocket propio, mensajes JSON | `server.mjs`, `connection.js` |
| Persistencia | SQLite + WAL, guardado cada 5 s, backup cada 6 h | `store.mjs` |
| Instancias por jugador | granja + criptas por jugador | `adventure.js` |
| Cliente | ~450 MB de datos (`web/data`), carga por partes | `streaming.js`, `bundles.js` |

**Qué NO está medido** (y por tanto es el riesgo del plan): coste de serializar y enviar el estado a 100 clientes; coste de 100 criptas simultáneas (una por jugador); memoria por proceso; tamaño real de cada mensaje; tiempo de la primera carga del cliente. La Fase A de `HOSTING.md` los mide antes de comprar nada grande.

**Conclusión de partida:** a 100 jugadores la simulación cabe de sobra en **un solo proceso de un solo hilo**. Lo que cuesta dinero y trabajo no es la CPU, es: (1) la **distancia** (ms), (2) la **disponibilidad** (HA, backups, monitor), (3) el **ancho de banda** (JSON vs binario), (4) la **operación** (despliegues, moderación, soporte).

---

## 1. Escenario PROFESIONAL: servidor global, 100 jugadores simultáneos (CCU)

### 1.1 Qué significa «100 CCU»
CCU = jugadores conectados a la vez en el pico. Proporciones típicas de un juego online pequeño (referencia, no medida aquí):

| CCU pico | Jugadores activos diarios (DAU) | Cuentas registradas |
|---|---|---|
| 100 | 500 – 1 000 | 2 000 – 10 000 |

Implica: **picos por franja horaria** (la media del día ≈ 30–50 % del pico), registros en oleada el día del lanzamiento y soporte/moderación real.

### 1.2 Decisión de arquitectura: «reinos» regionales, no un mundo único
Un mundo único no da pocos ms a todo el mundo (la distancia manda: mismo continente 40–100 ms, transoceánico 150–250 ms). La solución profesional con este tamaño:

- **Reinos regionales independientes** (p. ej. *Sudamérica*, *Europa*, *Norteamérica*), cada uno con su propio servidor, mundo y economía. Cada jugador elige reino al crear personaje y juega siempre cerca de su servidor → ping bajo para todos.
- **100 CCU globales ≈ 30–40 por reino**, muy por debajo de lo que aguanta un proceso: sobra capacidad en cada uno.
- **Cuenta global** (un solo usuario/contraseña/correo para todos los reinos) como evolución; en la primera versión, **cuentas por reino** (más simple) con migración posterior.
- Descartado (por ahora): mundo único con reenvío entre regiones y sharding por mapas; solo tendría sentido pasados ~500 CCU y duplica la complejidad.

> Alternativa de menor alcance: **un solo reino** en la región donde está la mayoría. Es el 40 % del coste y del trabajo; los jugadores lejanos tendrán más ms. Recomendada si la mayoría está en una región.

```
Jugador (navegador, solo escritorio)
   │  HTTPS (estáticos: CDN, caché, HTTP/3)          WSS directo, DNS sin proxy
   ▼                                                       ▼
 Cloudflare Pages/R2  ── cliente + sprites          juego-sa / juego-eu / juego-na
 (global, sin coste de salida)                            │ (Caddy TLS → Node, systemd)
                                                          │   SQLite WAL ─ Litestream ─► almacenamiento de objetos
 Servicio web/registro (correo, Turnstile) ◄── tokens ────┘   standby caliente (failover manual/semiauto)
 Monitor externo · alertas · panel admin por SSH · logs
```

### 1.3 Dimensionamiento por reino (≈ 35 CCU, margen ×3 = ~100 CCU)
| Recurso | Cálculo | Dimensión recomendada |
|---|---|---|
| CPU | Tick 0,4–1,5 ms *medido* con 40 bots; extrapolación con 100 jugadores + criptas + red: ≤ 10 ms (presupuesto 50) | 2–4 vCPU **de rendimiento monohilo alto** (frecuencia alta, no «compartida») |
| RAM | por medir (datos del mundo + 100 sesiones); reserva | 4–8 GB |
| Disco | SQLite + backups locales | 40–80 GB NVMe |
| Red | JSON actual por medir; objetivo binario+AOI 3–8 KB/s por cliente | 100 CCU × 5 KB/s ≈ 0,5 MB/s ≈ 4 Mbps pico; tráfico real ≈ 0,3–0,6 TB/mes |
| Conexiones | 100 WebSocket | trivial |

**Riesgo de ancho de banda:** si el protocolo JSON actual mandase 40 KB/s por cliente, serían ~10 TB/mes a 100 CCU constantes: caro en proveedores que cobran salida. Por eso el paso a **binario + interés por área (AOI)** (Fase C) está en el camino crítico del coste. Preferir proveedores con transferencia incluida (Hetzner/OVH).

### 1.4 Disponibilidad (SLO) y recuperación
| Objetivo | Valor | Qué exige |
|---|---|---|
| Disponibilidad | **99,5 %** (≈ 3,6 h/mes) como meta realista; 99,9 % (≈ 43 min/mes) con standby | standby caliente + runbook |
| RPO (datos que se pueden perder) | ≤ 5 s con replicación continua; 1 h como mínimo | Litestream (WAL → objeto) + backups |
| RTO (tiempo de recuperación) | ≤ 15 min (restaurar en servidor standby) | imagen reproducible + `deploy.sh` + DNS TTL bajo |
| Ping | RTT p95 **< 60 ms** en la región del reino | VPS en la región, sin túnel |
| Tick | p99 < 25 ms, medio < 10 ms | monitorización de bucle de eventos |
| Reconexiones involuntarias | < 1 por jugador/hora | reanudación de sesión |

### 1.5 Operación profesional
- **Entornos:** `dev` (tu PC) · `staging` (réplica pequeña, mismos artefactos) · `prod` por reino. El mismo paquete se promueve; la diferencia es solo configuración.
- **CI/CD:** GitHub Actions: tests (`tools/test.sh`), lint, build del cliente, subida a la CDN, despliegue al servidor por SSH/artefacto con **versión** (`version.json`), aviso en juego, `/save`, reinicio, comprobación `/health`, **rollback** a la versión anterior en un comando. Ventanas de despliegue fuera del pico.
- **Observabilidad:** métricas (jugadores, RTT p50/p95, tick ms, retraso del bucle, bytes/s, memoria, errores) en un panel (Grafana Cloud gratis / Prometheus + Grafana); logs estructurados rotados; trazas de error (Sentry); **alertas** a Discord/Telegram (caída, tick > 25 ms, disco > 80 %, backup fallido).
- **Seguridad:** secretos fuera del repo, SSH con clave, parches automáticos, anti-DDoS del proveedor, límites por IP/cuenta, auditoría de oro/objetos, panel de admin solo por túnel SSH, RGPD (política de privacidad, borrado de cuenta, retención de IP limitada).
- **Moderación y soporte:** comandos admin ya existentes (`/kick`, `/mute`, `/ban`…), registro de sanciones, canal de reportes (Discord), plantilla de respuesta; página de estado pública.
- **Copias:** local horaria + continua a objeto + semanal a un segundo proveedor; **restauración probada** trimestralmente.
- **Runbooks:** servidor caído, disco lleno, tick lento, base corrupta, ataque DDoS, despliegue fallido, cambio de DNS a standby.

### 1.6 Coste mensual estimado (3 reinos; rangos, verificar)
| Partida | Por reino | ×3 reinos |
|---|---|---|
| VPS principal (2–4 vCPU alto rendimiento, 4–8 GB) | 20–45 € | 60–135 € |
| Standby caliente (más pequeño) | 10–25 € | 30–75 € |
| Backups / objeto (Litestream, segunda copia) | 2–5 € | 6–15 € |
| Transferencia (si no está incluida) | 0–10 € | 0–30 € |
| **Subtotal infraestructura de juego** | **32–85 €** | **96–255 €** |
| Dominio, DNS, CDN/Pages/R2, Turnstile | — | 1–5 € |
| Correo transaccional (Resend/Mailgun) | — | 0–20 € |
| Errores/logs (Sentry/Grafana, planes gratis o bajos) | — | 0–30 € |
| Monitor externo + página de estado | — | 0–10 € |
| **TOTAL aproximado** | | **≈ 100–320 €/mes** |

Con **un solo reino** (sin standby): ≈ 30–60 €/mes. Con standby: ≈ 50–100 €/mes. Los costes humanos no están incluidos.

### 1.7 Qué hay que construir (épicas, 1 desarrollador)
| # | Épica | Contenido | Días |
|---|---|---|---|
| E1 | Medición y observabilidad | HUD de red, métricas del servidor, panel, alertas | 4 |
| E2 | Infra de producción | VPS, Caddy/TLS, systemd, kernel, firewall, Litestream, `deploy.sh`, rollback, `/health` | 5 |
| E3 | Protocolo binario + AOI | formato compacto, deltas, interés por área, `NET_PROTO` 11, reconexión con reanudación, órdenes procesadas al llegar | 8 |
| E4 | Rendimiento | perfil con 100+, persistencia fuera del tick, tope de bots, GC | 4 |
| E5 | Reinos | `realms.json`, selector en cliente, un servidor por reino, ficha de personaje por reino | 4 |
| E6 | Cuenta global *(opcional, fase 2)* | servicio de identidad, tokens firmados, migración de cuentas | 8 |
| E7 | Web, registro y correo | landing, registro con verificación, recuperación, Turnstile, términos, bloqueo móvil, caché persistente | 6 |
| E8 | Seguridad y antiabuso | validación total de entradas, auditoría de economía, ban cuenta+IP, límites afinados | 5 |
| E9 | HA y recuperación | standby, restauración ensayada, runbooks, simulacro de caída | 4 |
| E10 | Carga y caos | 150 conexiones remotas, 8 h, pérdida de paquetes, caída y recuperación | 4 |
| E11 | Beta y lanzamiento | beta cerrada, telemetría de ping por país, checklist, comunicación | 5 |
| | **Total (sin E6)** | | **≈ 49 días laborables ≈ 10 semanas** (≈ 12 con E6) |

Con **un reino**: se quita E5 y se reduce E9/E10 → **≈ 6–7 semanas**.

### 1.8 Calendario orientativo (un reino primero, luego se replica)
| Semana | Hito |
|---|---|
| 1 | E1 medir + E2 servidor real en producción (primera mejora grande de ping) |
| 2–3 | E3 protocolo binario/AOI, órdenes inmediatas |
| 4 | E4 rendimiento + E7 registro con correo |
| 5 | E8 seguridad + E9 HA/backups ensayados |
| 6 | E10 pruebas de carga y caos → **beta cerrada** |
| 7–8 | Correcciones de la beta, E11 lanzamiento del primer reino |
| 9–10 | Segundo y tercer reino (E5), página de estado, soporte |

### 1.9 Riesgos y mitigaciones
| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Un tick lento afecta a todos (hilo único) | M | A | alerta en 25 ms; tope de bots; perfil periódico; si hace falta, un proceso por grupo de mapas |
| Coste de ancho de banda por JSON | M | M | E3 antes del lanzamiento; medir en Fase A |
| Pérdida de datos / base corrupta | B | A | Litestream + copias + restauración ensayada |
| Ataque DDoS al puerto del juego | M | A | proveedor con anti-DDoS, límites, IP de origen oculta tras DNS |
| Trampas / duplicación de objetos | M | A | servidor autoritativo (ya), auditoría de economía, límites |
| Mundo repartido en reinos con poca gente | M | M | empezar con 1–2 reinos; abrir más según demanda |
| Dependencia de una sola persona | A | A | runbooks, despliegue reproducible, documentación (`docs/`) |
| Peso de `web/data` (450 MB) | A | M | CDN + `.webp` + caché persistente + carga por partes |
| Cumplimiento RGPD | M | M | política de privacidad, borrado, minimizar datos |

---

## 2. Escenario LOW COST: amigos + pruebas de funcionalidades

Objetivo: **barato, rápido de montar, 10–20 personas, con herramientas de test activas.** No necesita HA, standby ni correo.

### 2.1 Opciones (de menor a mayor esfuerzo)
| Opción | Coste/mes | Siempre on | Ping | Notas |
|---|---|---|---|---|
| **A. VPS pequeño (recomendada)** | **≈ 4–7 €** | sí | bueno (elige región de tus amigos) | 2 vCPU / 2–4 GB compartidos; Caddy + systemd; es el mismo montaje que producción → las pruebas sirven |
| B. Nivel gratuito de un proveedor (p. ej. VM ARM de Oracle Cloud) | 0 € | sí | depende de la región disponible | capacidad no garantizada, política de cuentas inactivas; válido para probar |
| C. Tu PC + Tailscale (red privada, amigos invitados a tu *tailnet*) | 0 € | no (PC encendido) | muy bueno (conexión directa) | nadie más entra; cero exposición pública; ideal para pruebas puntuales |
| D. Tu PC + túnel público (estado actual) | 0 € | no | medio (salto extra) | sirve ya, es lo menos fiable |

**Recomendación:** **A** como «servidor de amigos y pruebas» permanente, y **C/D** solo para trabajo del día a día.

### 2.2 Montaje (opción A)
- VPS en la región de tus amigos · Ubuntu LTS · Node LTS · Caddy (TLS automático) · systemd con reinicio · `ufw`.
- Dominio: subdominio propio (~1 €/mes si compras uno) o uno gratuito de DNS dinámico; el cliente estático sigue en GitHub Pages o pasa a Cloudflare Pages (gratis).
- `config.json`: `maxPlayers` 10–20, `residents` 8–10 (menos bots → menos CPU), `origins` con tu dominio, `HB_DEBUG=1` y `HB_NO_LIMITS=1` **activos** (herramientas de depuración para probar todo), cuentas por **código de invitación** (solo tus amigos se registran).
- **Perfil de configuración** `profile: "friends" | "official"` (nuevo) que cambia de golpe los valores por defecto: depuración, límites, bots, registro abierto/por invitación, backups.
- Backups: copia diaria de `hb.sqlite` a almacenamiento gratuito (Backblaze B2 10 GB / R2); un script, sin Litestream.
- Despliegue: el mismo `deploy.sh` que producción (git pull → tests → reinicio). Actualización de versión visible en el juego (`version.json`).
- Monitor gratuito (UptimeRobot) con aviso a tu móvil.

### 2.3 Para probar todas las funcionalidades
- Herramientas de F1 → Herramientas (ya existen) abiertas; comando para **crear y reiniciar personajes** de prueba, dar oro/objetos y subir nivel.
- Reinicio de mundo limpio con un comando (`HB_DATA` distinto) para repetir pruebas desde cero.
- Mini checklist de pruebas por versión en `news.json` (F1), como ya se hace con los testers.
- Informe de bots (`Ver informe de bots.bat`) y bots como carga ligera: 8–10 residentes + los amigos.

### 2.4 Coste y esfuerzo
| | |
|---|---|
| Coste | **≈ 5–8 €/mes** (VPS 4–7 € + dominio opcional ~1 €; el resto gratis) |
| Esfuerzo | **≈ 4 días**: perfil de configuración 1 · VPS + Caddy + systemd + deploy 1 · invitaciones 1 · backups y monitor 0,5 · pruebas 0,5 |
| Capacidad | cómodo para 10–20 jugadores; el cuello sería RAM/CPU compartida, no la simulación |
| Límites | sin standby ni 99,9 %; puede caerse y reiniciar; ping depende de dónde esté tu amigo respecto al VPS |

---

## 3. Camino recomendado (de low cost a profesional sin tirar nada)
1. **Ahora (semana 1):** montar el *low cost* en un VPS (sección 2). Es el **banco de pruebas real** de lo demás: ahí se mide red, memoria y tamaño de mensajes (Fase A).
2. **Con esos datos:** decidir región/es y proveedor; hacer E3 (binario + AOI) y E4.
3. **Primer reino oficial** con HA mínima (backups continuos + standby frío) y beta cerrada.
4. **Después, según demanda real:** más reinos, cuenta global (E6), standby caliente.

Cada paso reutiliza el anterior: el servidor de amigos es el primer entorno `staging` del oficial.

## 4. Decisiones que necesito de ti
1. ¿Dónde viven tus amigos y tus futuros jugadores (países)? Decide el centro de datos y cuántos reinos.
2. ¿Un reino (más barato y rápido) o varios reinos desde el lanzamiento?
3. ¿Cuenta global entre reinos o cuentas por reino al principio?
4. Presupuesto mensual objetivo para el servidor oficial (30–60 €, 100–150 € o más).
5. ¿Quién da soporte y modera (solo tú, o hay más gente)?
