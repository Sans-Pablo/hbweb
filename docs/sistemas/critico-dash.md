# Crítico y dash

Cifras **del original** (verificadas contra `HelbreathOriginal`): servidor `char/combat.cpp` ~222-290 (bonos), `HG.cpp` ~842 y ~2422 (gasto y carga por reloj),
`char/combat.cpp` ~1118/1196 (carga al recibir golpes); cliente `Game.cpp` `_iGetAttackType` ~20845 y órdenes de ataque ~30903-31100. Constantes en `shared/combat.js#CRIT`.

## Crítico («super ataque»)
- **Cargas** `p.superAttack`, tope `nivel/10` (sin mínimo): +1 cada 13 pasadas del reloj de 3 s (`chargeCritTick`, ≈39 s), +1 cada 15 golpes **recibidos** (`damagePlayer`),
  +1 con probabilidad `chargeCrit`% al recibir un golpe de monstruo (atributo de armadura). Golpear ya no carga nada.
- **Alt + clic** sobre un enemigo: el siguiente ataque va con `crit:true`. Exige carga y **maestría 100** en la habilidad del arma (mano = habilidad 5); gasta una carga.
- **Efecto** (`critDashBonus`): daño += daño·nivel/100 (redondeado); luego por habilidad: espada corta ×2; arco y espada larga +10 % y +30 de puntería; hacha +20 %;
  martillo +20 % y +20 de puntería; báculo +20 % y +50 de puntería; mano/esgrima solo lo del nivel; siempre +100 de puntería. Ya no se ignora defensa.
- **Alcance del crítico** (`combatsys.reachOf(..., crit)`, cliente `_iGetAttackType`): espada larga 3, esgrima 4, StormBlade (845) 5, resto 4. Sin carga o sin maestría 100 el golpe es normal.

## Dash (`OBJECTATTACKMOVE`)
- Objetivo **exactamente a 2 casillas en línea recta o diagonal**, maestría 100 en el arma y aliento (`sp >= 1`, original `m_iSP > 0`): avanza un paso y golpea. **No exige haber corrido antes** (antes el servidor lo rechazaba de pie y el cliente reenviaba la orden sin parar). No vale con StormBlade (alcance ≥ 4).
- Bono: +20 de puntería; espada larga +10 % de daño, hacha y martillo +20 %. Servidor: `world.js` comando `attack` (`cmd.dash`, `sp >= 1`).

## Controles
Ctrl+clic = atacar; con el objetivo a 2 casillas en línea, arma de alcance 1, con Shift mantenido (el modo correr no vale; diferencia deliberada con `||m_bRunningMode`), SP>0 y maestría 100 = dash (v0.85.29); Alt+clic = crítico (`controller.js`, `atk()`). Los controles Shift del summon se quitaron (v0.84.18): Shift es la tecla de correr del original.

## Protocolo y pruebas
`NET_PROTO` = 8 (el comando `attack` lleva `crit`/`dash`; no cambia). Tests: `tests/crit-dash.test.mjs`, `tests/bot-crit.test.mjs` (los bots maestros usan crítico y dash: `systems/bot.js`, bloque melee).

## v0.84.19
- Con el contador de críticos lleno, mantener Alt resalta el icono (Game.cpp 16221-16235); `gui.alt` lo fija el controlador y se limpia al perder el foco.

## v0.85.5
- Revisado contra combat.cpp/HG.cpp: la furia no duplica un crítico (attackMode>=20); `eff.critBonus` (ITEMSTAT_CRITICAL) se suma a sm y l en el crítico; el paso del dash no gasta SP (iClientMotion_Move_Handler con bIsRun=FALSE).

## 0.85.23
- Cartel Critical: el original guarda el daño en un byte sin signo leído como char con signo; 128-255 muestran "Critical", 0 muestra " * Failed! *" (fx.js).
- Dash completo (OBJECTATTACKMOVE): `PLAYER.dashMs = 12*78`, golpe a los 4 fotogramas (`dashHitMs`), evento `dash`, `ACT.ATTACKMOVE = 7`; cliente: anim.js, renderer.js (fantasma), connection.js. NET_PROTO 13.
