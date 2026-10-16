# Alquimia
Fuente: `HG.cpp` ReqCreatePortionHandler (23503-23700) y `Config/Potion.cfg` → `web/data/potion.json` (`tools/convert_potion.mjs`).
- Orden `alchemy {uids:[hasta 6]}` (`world.js`); código en `shared/systems/alchemy.js`.
- Una casilla repetida cuenta unidades; se ordenan por id descendente y se comparan con las 12 cifras de la receta; gana la última coincidencia.
- `limit` > maestría → `potion-lowskill`; `skill = maestría - dif` (mín. 1, +5 si maestría 100); `dice(1,100) > skill` → `potion-fail` (no gasta nada).
- Éxito: SkillUp +1, consume (consumibles −N, el resto se borra), `potion-ok`, `giveExp(dice(2, dif/3))`, la poción va a la mochila o al suelo.
- Pendiente: ventana de cliente (el original usa AlchemyBowl 227); DemonPotion (receta 20) no existe en `items.json`.
- Minería (generadores por mapa) y fabricación (BuildItem.cfg/CraftItem.cfg): sin portar; ver `docs/AUDITORIA.md`.
Test: `tests/alchemy.test.mjs`.
