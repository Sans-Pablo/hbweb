# Saber de ítems (v0.85.65)
`web/src/shared/systems/botlore.js`. Los bots anotan, por cada ítem equipado, exp/min y muertes (`w.itemLore`, compartido por todo el mundo).
`factor(w,id)` (0.8–1.25, 1 sin datos suficientes) multiplica el item level en `ilv` de `bot.js`, así que equipan y compran según lo que rinde de verdad.
Reinicio de stats y reparto: ya existían (`respec.js`, `builds.js`, reinicio forzado al cambiar de arma en `residents.js`). Test: `tests/botlore.test.mjs`.
