# Arena de apuestas

INVENTO del port (sin equivalente en el original). Código: `shared/systems/arena.js`; cliente: cuadro 44 en `client/npcdialogs.js`. Test: `tests/arena.test.mjs`.

## Qué es
El NPC de ciudad **Kennedy** (ficha y sprite de NPC.cfg sin función en el juego base; `role "arena"`) vive en la tienda general (`gshop_1f`, 55,43; `EXTRA_CITIZENS`). Al apostar, el jugador **viaja al mapa de arena** (`huntzone1`, sin monstruos ni teletransportes, todo el mapa sin ataque; compartido) y mira la pelea en el campo `ARENA.field` (28,24 – 44,34), de pie en `ARENA.watch`; no hay cuadro dibujado en el suelo. Al terminar vuelve solo a la tienda (`hooks.arenaBack`). El jugador es solo espectador: apuesta oro a que gana su compañero («a») o un retador generado («b»). Su compañero no viaja con él (vuelve al regresar).

## Flujo
1. Clic en Kennedy → `arenainfo` → evento `arenaoffer` (compañeros, probabilidades, cuotas, límites, historial). Hace falta un compañero (bola) sano; se elige el activo o el primero (`Cambiar de compañero` rota; `Otro retador` genera otro combate).
2. `arenabet {offer, side, amount}`: se cobra el oro, el servidor **simula el combate completo** (`simulate`, generador propio con semilla de `w.rng`) y fija el resultado en `p.bet` (`win`, `payout`).
3. Dos gladiadores reales (monstruos de la especie de cada uno, `n.arena`, intocables: `cfg.actionLimit = 5`, sin botín ni experiencia) se acercan y pelean en directo siguiendo la línea de tiempo de la simulación (golpes, fallos, hechizos, curas, escudos, muerte). `tickArena` los mueve; `npcThink` los ignora.
4. Al terminar (`finish`) se cobra (`settle`), evento `arenaend`, el historial guarda los últimos 20 y los gladiadores se retiran a los pocos segundos.

## Estadísticas y cuotas
- Compañero propio: `companion.statsOf` (equipo del dueño + talentos). Retador: especie al azar (con ficha en NPC.cfg), nivel ±4 (campeón, 8 %: +5, ×1.12, «★»), rama de talentos al azar y gasta todos sus puntos como un jugador (`Tal.learn`), misma fórmula.
- **Habilidades**: `simulate` usa TODAS las habilidades aprendidas de ambos con las reglas de `talents.support/offense`: Heal/Great Heal sobre sí mismo (<50 % / <40 % de vida), Defense Shield y Great Defense Shield (daño recibido ×0,5 / ×0,35 durante 30 s), Berserk (×2 durante 20 s), Fire Ball / Lightning / Meteor Strike (no fallan, daño `dice+v6+lvl/2` × Frenzy × Brute Force), Fortitude (1 %/s), con maná (`maxMp`, regenera 1/60 por segundo), enfriamientos y 1,8 s entre hechizos. En directo se ven como eventos `spell`/`heal`.
- «Vida de arena»: se escala la vida de ambos por igual para que el combate dure ≈ 28 s (`normalize`), y la del retador se ajusta por bisección para que la probabilidad de ganar sea 35–65 % (campeón 25–40 % para el nuestro; `balance`). Se descartan ofertas con favorito > 88 %.
- Cuota = (1 − `edge`) / probabilidad, con `edge` = 10 % (sumidero de oro), mínimo x1.05, máximo x15; probabilidad por 600 simulaciones.
- Límites: apuesta mínima 100, máxima `500 + 250·nivel`.
- El compañero real no sufre nada (pelea una copia a vida completa): sin heridas, experiencia ni penalización.

## Integridad
- Resultado fijado al apostar; el cobro no depende de la arena.
- La apuesta pendiente viaja con la partida (`saveOf` → `bet`, `restore` en `loadSave`): recargar a mitad de combate cobra el resultado fijado (no hay devolución).
- Sin aleatoriedad fuera de `w.rng` (la semilla) y del generador `lcg` propio de la simulación.

## Pendiente / ideas
Cámara de espectador, apuestas combinadas y rachas del retador.
