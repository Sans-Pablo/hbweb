# Criminales, reputación y contadores de muertes

Fuente: `char/Client.cpp` (`ApplyPKPenalty`, `IncPKCount`, `DecPKCount`, `ApplyElo`, rama de muerte de `Killed`) y `HG.cpp` (`PK_KillRewardHandler`, `EnemyKillRewardHandler`). Código: `shared/systems/pk.js`, enganchado en `combatsys.pvpCredit`.

Estado del jugador: `pkCount`, `reputation`, `enemyKillCount`, `rewardGold`, `elo` (1500; K=16). Se guardan en `saveOf`.

- Matar a un inocente de tu bando (o un viajero a un inocente): `applyPKPenalty` → pierdes 2 tiradas de exp (`d(nivel/2+1,50)`), `pkCount+1`, `reputation-5`, crimen en la ciudad y cárcel 3 min (evento `jail`, aún sin teletransporte).
- Matar a un criminal: paga `nivel*3` de oro de recompensa si quien mata no es criminal (`pkcaptured`).
- Matar a un enemigo de otro bando: exp `(3d(3·nivel)+nivel)/3`, oro `1d(nivel)`, `enemyKillCount` y Elo si su nivel ≥ 30 (≥ 80 si el atacante lo es).
- Categoría por `pkCount`: 1-3 criminal, 4-11 asesino, 12+ matarife; objetos soltados 3/6/12 (`penaltyLevel`).
- Un criminal del propio bando es atacable (`canFight`). El nombre rojo "Criminal" usa `pk` público.

Pendiente: teletransporte real a la cárcel, `DecPKCount` por tiempo, pantalla de contribución de cruzada.
