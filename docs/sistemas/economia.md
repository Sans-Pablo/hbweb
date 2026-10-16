# Economía: libro de oro y monitor (fase 1)

Manual de origen: `HBWeb_Admin_Economy_Monitor_Technical_Manual.docx`. Fase 1 = instrumentación; sin cambio de economía y sin interfaz (el panel `/admin/economy` es la fase 2).

## Libro de oro (`web/src/shared/systems/ledger.js`)
- `gold(w, p, delta, reason, opts)` es el único punto por el que cambia `p.gold`. Devuelve el delta aplicado.
- `cls`: `faucet` (crea oro), `sink` (lo destruye) o `transfer` (solo lo mueve; el total no cambia). Por defecto delta>0 = faucet, delta<0 = sink.
- `opts`: `cls`, `peer` (contraparte de una transferencia), `debug` (marca `artificial:"debug"`), `artificial`.
- Artificial = `bot` (bots, residentes, ciudadanos) o `debug`. El monitor los excluye por defecto.
- Determinista: sin `Date.now`/`Math.random`. Sale por `w.econHook(w, ev)` o, si no existe, por el sumidero global `setEconSink(fn)`; el cliente nunca ve estos eventos (no pasan por `w.emit`).
- Motivos (`reason`): arena_bet/refund/payout, pvp_bounty, levelup, companion_hospital/shop/ball/retrain, fishing_rod, fish_sale, learn_spell, pet_grimoire, quest_reward, resident_death, respec, shop_buy/sell/repair, stall_buy/stall_collect (transfer), summon_food, trade (transfer, ambas patas), tutorial_gift/reward, debug.
- Sin convertir (a propósito): oro de bots (`bot.js`, `botitems.js`; economía artificial), `inventory.addToBag` con GOLD (ya no cae oro) y `teleport.pay` (sin uso).

## Persistencia (`server/store.mjs`, `server/server.mjs`)
- Tabla `econ_events(event_id PK, ts, gt, reason, cls, delta, actor, peer, artificial, bal, map)`; `INSERT OR IGNORE` por `event_id` (= arranque:contador) para que sea idempotente.
- `st.econAdd(ev)` solo encola; se escribe en el siguiente `flush` (misma transacción que las partidas).
- Consultas: `econEvents`, `econSummary`, `econSeries` con filtros `from/to/reason/actor/artificial("all")/limit/bucket`.
- Modo JSON de reserva: funciones vacías (no hay monitor).

## Test
`tests/ledger.test.mjs`: clases, transferencia sin cambio de total, artificial, idempotencia, consultas y reinicio.
