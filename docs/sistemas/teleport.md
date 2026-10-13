# Teleport (Teleport.cfg)
Original: `Teleport.cfg` + HG `RequestTeleportAndLoadingSettings`. `tools/convert_teleport.mjs` → `web/data/teleport.json` (16 rutas).
`systems/teleport.js`: `available`/`check`/`pay` validan NPC, mapa origen, nivel, bando, oro y la regla criminal (pkCount>0 solo rutas crim=TRUE).
**Pendiente:** el mapa destino debe estar en `ALLOWED_MAPS` (mundo reducido); aún no hay diálogo de William/Gail que llame a `check`. Rutas attacker/defender (Heldenian) sin uso.
Test: `tests/teleport.test.mjs`.
