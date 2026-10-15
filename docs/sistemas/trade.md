# Trade entre jugadores (v0.83.8)
Código: `web/src/shared/systems/trade.js`, cliente `web/src/client/trade.js`, test `tests/trade.test.mjs`. Invento del port a partir del cuadro de intercambio del original.
- `tradereq {name, uid?}`: con `uid` (objeto arrastrado sobre un jugador, `main.js` `onItemDrop`, ≤10 casillas) el objeto queda ya ofrecido al abrirse el trato.
- Mochila llena: lo que no cabe va a `p.pending` (máx. `PENDING_MAX`=12, se guarda en la partida) y `Trade.deliver` lo mete cada segundo cuando hay peso y casillas. Eventos `queued` y `delivered`. Si la cola tampoco admite lo que sobra, `nofit` y no se confirma.
- El oro siempre entra. Sin cambio de protocolo (campos opcionales).
