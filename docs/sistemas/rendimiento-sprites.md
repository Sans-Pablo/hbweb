# Rendimiento de sprites (carga, memoria y fps)

Encargo y fases: `docs/PLAN_RENDIMIENTO.md`. Skill del agente: `.claude/skills/rendimiento-sprites/SKILL.md`. Contexto previo: `docs/sistemas/carga.md`.
Herramientas: `tools/sprite_audit.py` (inventario), `tools/perf/run.py` (carga/memoria/fotogramas), `tools/perf/visual.py` (paridad visual), `tools/perf.py` (escenarios de dibujo con bots, preexistente), presupuestos en `tools/perf/budget.json`, base en `tools/perf/baseline.json`.

## Criterios de aceptación
1. `sprite_audit.py --check` sin hojas fuera de presupuesto (decodificada ≤ 32 MB, disco ≤ 4 MB, lado ≤ 4096) ni ilegibles.
2. `perf/run.py --check`: arranque ≤ 600 hojas pedidas, ≤ 300 MB decodificados, ≤ 30 MB transferidos; teleport ≤ 200 MB decodificados nuevos.
3. Con GPU real (`--gpu`): caminar ≤ 3 fotogramas > 50 ms en 20 s, p99 ≤ 40 ms; teleport p99 ≤ 60 ms.
4. `perf/visual.py --compare`: OK en las 4 escenas, clásico y remastered.
5. Sin regresión: `tools/test.sh` verde (incluido `online`/`net-*`).

## Cómo medir
```
python3 tools/sprite_audit.py [--deep] [--json out.json] [--check]
python3 tools/perf/run.py [--hd on|off] [--mobile] [--seconds 20] [--out f.json] [--baseline tools/perf/baseline.json] [--check] [--gpu]
python3 tools/perf/visual.py --save tools/perf/results/ref      # antes
python3 tools/perf/visual.py --compare tools/perf/results/ref   # después
python3 tools/perf.py                                           # coste de dibujo con bots/monstruos/magias
```
Métricas de `run.py`: `ready_ms` (carga de la página), `transfer_bytes` (hojas), `decoded_bytes` (ancho×alto×4 de toda `Image` creada y completa; **se cuentan también las ya soltadas por el navegador, así que es un techo**), `sheets_requested`, `frame_p50/p95/p99_ms`, `frames_over_50ms`, `long_tasks_over_50ms`. Dónde mide: `INIT` (se inyecta antes de la página) registra rAF, `PerformanceObserver('longtask')` y envuelve `window.Image`.

## Base (2026-10-13, Chromium headless, GL por software)
Ver tabla en `docs/PLAN_RENDIMIENTO.md` §2. Resumen: 1 442 hojas / 71 MB / 1,5 GB decodificados al arrancar; teleport p99 1 050 ms; `sprites_hd/m0_3_5.webp` vacío (0 bytes).

## Limitaciones conocidas de las herramientas
- GL por software: tiempos de fotograma pesimistas, solo comparativos.
- `visual.py` espera 4 s fijos por escena (F0 lo sustituye por una señal determinista) y tolera 0,5 % de píxeles distintos (agua y nubes animan).
- `decoded_bytes` no descuenta las hojas que el navegador ya liberó.

## Intentos (tabla viva; una fila por cambio probado)
| Fecha | Fase | Cambio | Métrica antes → después | Decisión |
|---|---|---|---|---|
| 2026-10-13 | F0 | Herramientas de medición y base | – | Hecho |
