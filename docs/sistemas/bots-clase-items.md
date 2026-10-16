# Bots: clase por ítems, flechas, aliados y bloqueos (v0.77.0)
- `builds.js`: `fitByItems` (arco→cazador/ágil, báculo→invocador/arcano, resto→guerrero), `itemSig`, `canRespecToday` (tope `DAILY_CAP`=2). En `residents.js` `rebuild`: un reinicio obligatorio por bot (`forcedDone`) y otro si cambia el arma clave; puede cambiar el arquetipo.
- Summon: se invoca solo con maná, no en descanso/Recall; se guarda al descansar o viajar.
- `bot.js`: `allyBonus` (defiende aliados y busca el último golpe); sin flechas no dispara (compra/Recall); con Recall en curso no ataca. `b.stuck` registra bloqueos y `residents.js` los reporta (y los pide a `obsstats.ask`).
- Cripta: el Recall interrumpido se reintenta defendiéndose y se informa a las 4 veces.
- Tests: `bot-forced-respec`, `bot-arrows-allies`.

## Botín del suelo y peso de los atributos
- `lootValue` (bot.js) decide qué recoge un bot: usa `judge` (botitems.js). Equipar (500+) > guardar/comerciar (50+) > basura solo si se vende por ≥120 de oro (≥400 con la mochila al 60 %). Elige el botín por valor/(distancia+2).
- `itemlevel.js`: tablas `W1` (armas), `D1` (armaduras) y `SUB` (secundarios) dan el peso de cada atributo por lo que hace en `applyEquipAttr`; afilado/ágil/antiguo no dependen de v1. Test: `tests/bot-loot.test.mjs`.

## Lanzadores (0.85.26)
`ilv` en bot.js suma `casterBonus` (botmagic.js) para bots lanzadores: bastones con ahorro de maná o daño mágico y amuletos de resistencia se equipan antes que armas planas. Ver `bots-magia.md`.
