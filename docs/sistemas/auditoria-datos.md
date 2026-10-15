# Auditoría de datos vs original
Herramienta `tools/audit_datos.mjs` (parsea `Item*.cfg`, `Npc.cfg`, `Magic.cfg`, `Teleport.cfg`, `Skill.cfg` del original y los compara con `web/data`).
Test `tests/original-data.test.mjs` (se omite si no hay copia del original; `HB_ORIGINAL_CFG` cambia la ruta) contra `docs/auditoria_baseline.json`.
Informe y clasificación: `docs/AUDITORIA_DATOS.md`.
