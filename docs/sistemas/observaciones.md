# Observaciones (observador dividido)
Panel «📝 Observaciones» de `observador.html`: mini tickets del propietario. Persisten en `docs/observaciones.json` vía `/api/admin/obs` (GET lista; POST op add|comment|state|del).
Estados: nueva → analizada (propuesta de Claude) → aprobada / corregir → hecha. Claude lee el fichero para implementar.
Los ◀ ▶ y [ ] usan `fighting()` (watchpanel.js): pelea = modo fight/flee/pit/delve y oficio distinto de granjero/pescador. Test: `tests/observer-split.test.mjs`.
