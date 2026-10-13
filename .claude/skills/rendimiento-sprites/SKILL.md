---
name: rendimiento-sprites
description: Mejorar la carga de sprites y el rendimiento gráfico de hbweb (tirones al cargar hojas HD/IA, memoria de imagen, fps). Usar al optimizar assets.js/streaming.js/renderer.js, las hojas de sprites_hd/sprites_ia o el pipeline de recursos; mide antes y después.
---

Trabajas sobre el encargo `docs/PLAN_RENDIMIENTO.md`. Léelo entero junto con `docs/sistemas/rendimiento-sprites.md` y `docs/sistemas/carga.md` antes de tocar nada.

## Bucle (no te lo saltes)
1. **Estado**: `python3 tools/sprite_audit.py` (inventario y hojas fuera de presupuesto) y `python3 tools/perf/run.py --baseline tools/perf/baseline.json` (la base es de este entorno; si cambió la máquina, mide una nueva con `--out`).
2. **Referencia visual** una sola vez por fase: `python3 tools/perf/visual.py --save tools/perf/results/ref`.
3. **Un cambio mínimo** en la fase en curso (F0…F6 del plan). Un solo cambio por medición.
4. **Verifica**: `python3 tools/perf/run.py --check --baseline tools/perf/baseline.json`, `python3 tools/perf/visual.py --compare tools/perf/results/ref`, `python3 tools/perf.py`, `tools/test.sh`.
5. **Decide por los números**: conserva si mejora su métrica sin empeorar otra; si no, revierte y anótalo en la tabla «Intentos» de la ficha.
6. **Cierra la fase**: ficha actualizada, `docs/CHANGELOG.md` y `web/data/news.json` si un tester lo nota, `tools/release.sh X.Y.Z "Nombre" "mensaje"`, informe con la plantilla del plan (§7).

## Reglas rápidas
- Fidelidad al original y a la apariencia: la paridad visual es obligatoria; la compresión con pérdida solo con aprobación del usuario.
- Nada de `Math.random`/`Date.now` en `shared/*`. Lo experimental (GL, KTX2) detrás de flag y con el camino actual intacto.
- Datos generados desde `tools/*.py`, nunca a mano. No re-versiones binarios sin cambio real. Al cambiar hojas, sube `ASSET_VERSION`/`IA_VERSION` (`assets.js`) y `CACHE` (`web/sw.js`).
- Chromium headless usa GL por software: los tiempos de fotograma son solo comparativos; las metas `--gpu` las confirma una pasada con GPU real del usuario.
- No explores a ciegas: `docs/MAPA.md` → `Grep` → `Read` con `offset/limit`. Verifica con datos (`--eval`) antes que con capturas.
- Para y avisa al usuario si: hace falta degradar calidad visual, instalar herramientas, tocar `NET_PROTO`, o una fase no alcanza su meta tras dos intentos razonados.
