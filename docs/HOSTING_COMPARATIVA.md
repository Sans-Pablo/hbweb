# Comparativa de alojamiento: costes, latencia y riesgos

Fecha de los datos: **2026-10-19** (WebSearch). Complementa `HOSTING.md`, `HOSTING_ESCALA.md` y `HOSTING_LOCAL.md`.
**Aviso de fiabilidad:** los precios de VPS cambiaron mucho en 2026 (Hetzner subió ~30-50 % el 1-abr-2026 por el coste de DRAM/NVMe) y las fuentes se contradicen. Las cifras marcadas «≈» son estimaciones; **confirmar en la web del proveedor antes de pagar**. Los 450 MB y los consumos de CPU/red vienen de los docs previos.

Premisas del juego: servidor Node monohilo, 0,36 ms/tick con 40 bots, WebSocket JSON ≈ 0,3-0,6 TB/mes a 100 CCU (estimado en HOSTING_ESCALA). Lo que decide es **distancia**, no CPU: cualquier VPS de 2 vCPU / 2-4 GB sobra.

## 1. Dónde corre el servidor de juego

| Opción | €/mes | €/año | Latencia (jugador→servidor) | Tráfico incluido | HA / backups | Operación | Riesgos principales |
|---|---|---|---|---|---|---|---|
| **PC local + Tailscale Funnel** | 0 | 0 | Depende de tu casa; Funnel va por relays de Tailscale (salto extra, sin SLA); solo puertos 443/8443/10000 | Sin cifra publicada («límites no configurables») | Ninguna: se apaga con el PC; backup manual | Muy fácil | Caída = juego caído; IP/uplink residencial; Funnel no es para producción; expones tu casa |
| **PC local + Cloudflare Tunnel** | 0 (+ dominio) | 0 + dominio | Sale por la red de Cloudflare (suele ser mejor que Funnel); un salto extra de ~5-30 ms | Sin límite publicado para WebSocket de uso normal (verificar ToS) | Igual que arriba | Fácil (cloudflared + dominio en Cloudflare) | Mismo punto único de fallo; subida residencial; ToS orientado a web, no a juego en tiempo real |
| **Hetzner Cloud** (CX/CPX, DE/FI; US-VA/OR) | ≈ 4-8 € (CX23 ≈ 5,99 € con IPv4; rango visto 4-8 €) | ≈ 50-95 € | **EU excelente**; US este desde Virginia; Hetzner no tiene Sudamérica | 20 TB (EU); solo ~1 TB en US | Backups opcionales +20 %; snapshots | Fácil-medio | Subida de precios 2026; en US menos tráfico y +20 % precio; sin región LATAM |
| **OVHcloud VPS** | ≈ 5-8 € (no verificado) | ≈ 60-100 € | EU (Gravelines/Roubaix), Canadá (Beauharnois = «US este» razonable), US; sin Sudamérica | Normalmente ilimitado/alto | Backup de pago | Medio | Precios no verificados esta vez; soporte irregular |
| **DigitalOcean** (Droplet) | ≈ 4-6 $ (1 TB incl.) | ≈ 50-75 $ | EU (AMS/FRA/LON), US (NYC/SF), sin Sudamérica | 1 TB en el plan básico | Backups semanales de pago | Fácil | Más caro por recurso; exceso de tráfico se cobra |
| **Vultr** (Cloud Compute) | ≈ 6 $ (2 TB incl.) | ≈ 72 $ | **Único con São Paulo** (desde 2021), también EU/US/Mexico | 2 TB en el plan de 6 $ | Backups diarios de pago | Fácil | Sao Paulo suele costar más que otras regiones (no verificado); latencia buena para Brasil/Cono Sur |
| **Oracle Cloud Free Tier** | 0 | 0 | Solo región elegida al crear la cuenta (ej. Frankfurt, Ashburn, São Paulo) | Alto (no confirmado) | Ninguna garantizada | Medio-difícil | **Recorte jun-2026: ARM pasó de 4 OCPU/24 GB a 2 OCPU/12 GB**; **reclama instancias «inactivas»** (CPU p95 < 20 % en 7 días: nuestro servidor lo cumpliría); capacidad no garantizada; cuentas suspendidas sin aviso. Solo para pruebas |
| **VPS en LATAM de pago** (proveedores locales) | ≈ 18-30 $ (2 vCPU/4 GB) | ≈ 215-360 $ | Mejor ping para Sudamérica | 0,5-2 TB típico | Variable | Medio | Más caro y menos estándar; solo si la comunidad es mayoritariamente sudamericana |

## 2. Dónde se sirve el cliente (≈450 MB)

| Opción | €/mes | Límites | Coste de ancho de banda (cada jugador nuevo baja ≈450 MB) | Riesgos |
|---|---|---|---|---|
| **GitHub Pages** (actual) | 0 | Sitio ≈ 1 GB recomendado; **~100 GB/mes de tráfico (soft)**; 10 builds/h | 100 GB ÷ 0,45 GB ≈ **~220 descargas en frío al mes**, tras lo cual pueden cortar o limitar | Se queda corto en una beta pública; sin garantía; ya cerca del tope de 1 GB |
| **Cloudflare Pages** | 0 | **25 MiB por archivo**, **20.000 archivos** (Free), 500 builds/mes | Ancho de banda estático gratis/sin límite práctico | Hay que comprobar que no haya archivos > 25 MiB ni > 20k archivos (si hay muchos sprites pequeños puede chocar) |
| **Cloudflare R2** (+ dominio propio) | ≈ 0,007 € por 450 MB (10 GB gratis) | Sin límite de archivo práctico | **Egress gratis**; Class B: 10 M lecturas/mes gratis, después 0,36 $/M | Requiere configurar CORS y caché; muchas lecturas de archivos pequeños suman operaciones |
| **Cliente servido por el propio VPS** | incluido | Tráfico del plan (1-20 TB) | 100 jugadores nuevos = 45 GB (trivial en Hetzner; ajustado en DO/Vultr si crece) | Añade carga y latencia al VPS; sin CDN |

**Conclusión:** mover el cliente a **Cloudflare R2 o Pages** (gratis en la práctica) y dejar GitHub Pages solo como reserva.

## 3. Dominio (precios 2026, aggregadores; renovación ≠ primer año)

| TLD | Registrador más barato | Precio/año aprox. | Comentario |
|---|---|---|---|
| **.com** | Cloudflare Registrar (a coste) / Spaceship | 9,98-11,08 $ | Recomendado: barato, estable y DNS gratis con Cloudflare |
| **.games** | Cloudflare / Porkbun (promo 1er año) | 26,20 $ (Cloudflare); Porkbun 7,24 $ el 1.º año y 27,29 $ renovación; ≈17 $ el más barato | Temático, razonable |
| **.gg** | Spaceship / Porkbun / NicNames | **≈ 50-52 $/año**; Namecheap 55 $ → **66 $** al renovar | Caro; solo si importa la marca |

Si se quiere ahorrar: un **.com** de ~10 $/año con subdominios (`play.`, `cdn.`, `api.`).

## 4. Regiones y latencia típica (RTT orientativo; la luz ≈ 1 ms/100 km ida, ×2 ida/vuelta; ver HOSTING.md §1)

| Región servidor | Jugadores en España/EU | US este | Sudamérica | Comentario |
|---|---|---|---|---|
| **EU** (Frankfurt/Helsinki/Falkenstein) | 20-50 ms | 90-120 | 200-250 | Mejor si la comunidad es hispana de España/Europa |
| **US este** (Ashburn/NYC) | 80-110 | 10-40 | 120-180 | Punto medio entre Américas; EU y Sudamérica aceptables para un juego con predicción |
| **LATAM** (São Paulo, Vultr) | 190-230 | 110-140 | 20-80 | Solo para comunidad sudamericana; menos oferta y más caro |

Con predicción en cliente, hasta ~150 ms es jugable para este tipo de juego (ARPG), pero los combates PvP lo notan por encima de ~100 ms.

## 5. Recomendación por escenario

| Escenario | Servidor de juego | Cliente | Dominio | Coste aprox. |
|---|---|---|---|---|
| **Amigos / pruebas** (≤10 CCU) | Seguir en **PC + Cloudflare Tunnel** (mejor que Funnel) o Tailscale privado; si quieres 24/7, **Hetzner CX en la región de los amigos** | Cloudflare R2/Pages | Opcional; un .com de 10 $ | 0-8 €/mes (≈ 0-100 €/año) |
| **Beta pública ≈ 30 CCU** | **VPS en la región de la mayoría**: Hetzner EU si son europeos; Vultr São Paulo si son sudamericanos; Hetzner/OVH US si no hay mayoría. Caddy + systemd + backup diario SQLite a R2 | **Cloudflare R2 + dominio propio** (GitHub Pages no aguanta ~220+ descargas en frío) | **.com** en Cloudflare | ≈ 8-20 €/mes (≈ 100-250 €/año) |
| **100 CCU** | VPS de 2-4 vCPU con buen rendimiento monohilo (Hetzner CPX/CCX ≈ 15-35 €), **standby pequeño**, Litestream a R2, monitor + alertas; reino único en la región mayoritaria | R2 + caché fuerte | .com (+ .games/.gg si se quiere marca) | ≈ 40-100 €/mes (≈ 500-1.200 €/año) con standby; ver HOSTING_ESCALA §costes |

## 6. Decisiones concretas que debe tomar Pablo

1. **Región:** ¿dónde viven la mayoría de jugadores (ES/EU, US, Sudamérica)? Esto decide proveedor (Hetzner EU vs Vultr São Paulo vs US). Pregunta clave: mínimo 3 amigos de cada región medidos con `ping`/test.
2. **Proveedor del servidor:** recomendado **Hetzner** (EU) salvo mayoría sudamericana (**Vultr São Paulo**). Evitar Oracle free para algo que no sea prueba.
3. **Cliente:** mover los 450 MB a **Cloudflare R2** (o Pages si cumple 25 MiB/20k archivos) antes de abrir la beta.
4. **Dominio:** elegir **.com** (~10 $/año) vs .games (~26 $) vs .gg (~51 $) y registrador (Cloudflare Registrar recomendado).
5. **Presupuesto mensual objetivo:** ¿8 €, 20 € o 60-100 €? Marca cuál de los tres escenarios activamos.
6. **Standby/HA:** ¿ahora (solo desde 100 CCU) o con backups y reinicio en caliente en la beta?
7. **Verificar** precios actuales de Hetzner, OVH, DO y Vultr (región concreta) antes de pagar; las cifras de este documento son snapshots.

## Fuentes (WebSearch, 2026-10-19)
- Hetzner: comparativas dev.to / Better Stack / kimmo.suominen.com/stuff/cpc-2026-08.txt (precios en conflicto)
- Cloudflare R2 pricing: developers.cloudflare.com/r2/pricing
- Cloudflare Pages limits: developers.cloudflare.com/pages/platform/limits (+ changelog 2026-01-23)
- GitHub Pages limits: smartscope.blog (fuente secundaria)
- Dominios: domainoffer.net (agregador), domaindetails.com
- Oracle Free Tier: docs.oracle.com/iaas/Content/FreeTier/resourceref.htm; infoq.com/news/2026/07/oracle-cloud-free-tier-limits
- Tailscale Funnel: tailscale.com/kb/1223/tailscale-funnel
- Vultr/DO: betterstack.com y infratally.com (comparativas); São Paulo: valebyte.com
