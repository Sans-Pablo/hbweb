# Bots: clase por ítems, flechas, aliados y bloqueos (v0.77.0)
- `builds.js`: `fitByItems` (arco→cazador/ágil, báculo→invocador/arcano, resto→guerrero), `itemSig`, `canRespecToday` (tope `DAILY_CAP`=2). En `residents.js` `rebuild`: un reinicio obligatorio por bot (`forcedDone`) y otro si cambia el arma clave; puede cambiar el arquetipo.
- Summon: se invoca solo con maná, no en descanso/Recall; se guarda al descansar o viajar.
- `bot.js`: `allyBonus` (defiende aliados y busca el último golpe); sin flechas no dispara (compra/Recall); con Recall en curso no ataca. `b.stuck` registra bloqueos y `residents.js` los reporta (y los pide a `obsstats.ask`).
- Cripta: el Recall interrumpido se reintenta defendiéndose y se informa a las 4 veces.
- Tests: `bot-forced-respec`, `bot-arrows-allies`.
