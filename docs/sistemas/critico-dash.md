# Crítico y dash

Cifras **del original** (verificadas contra `HelbreathOriginal`): servidor `char/combat.cpp` ~222-290 (bonos), `HG.cpp` ~842 y ~2422 (gasto y carga por reloj),
`char/combat.cpp` ~1118/1196 (carga al recibir golpes); cliente `Game.cpp` `_iGetAttackType` ~20845 y órdenes de ataque ~30903-31100. Constantes en `shared/combat.js#CRIT`.

## Crítico («super ataque»)
- **Cargas** `p.superAttack`, tope `nivel/10` (sin mínimo): +1 cada 13 pasadas del reloj de 3 s (`chargeCritTick`, ≈39 s), +1 cada 15 golpes **recibidos** (`damagePlayer`),
  +1 con probabilidad `chargeCrit`% al recibir un golpe de monstruo (atributo de armadura). Golpear ya no carga nada.
- **Alt + clic** sobre un enemigo: el siguiente ataque va con `crit:true`. Exige carga y **maestría 100** en la habilidad del arma (mano = habilidad 5); gasta una carga.
- **Efecto** (`critDashBonus`): daño += daño·nivel/100 (redondeado); luego por habilidad: espada corta ×2; arco y espada larga +10 % y +30 de puntería; hacha +20 %;
  martillo +20 % y +20 de puntería; báculo +20 % y +50 de puntería; mano/esgrima solo lo del nivel; siempre +100 de puntería. Ya no se ignora defensa.
- No portado: ataques de tormenta (StormBlade, tipo 30) ni rangos de crítico a distancia (el cliente original permite críticos hasta 3–5 casillas según arma).

## Dash (`OBJECTATTACKMOVE`)
- Corriendo (activo por defecto), objetivo a alcance + 1, maestría 100 en el arma y aliento: avanza un paso y golpea (`bIsDash`).
- Bono: +20 de puntería; espada larga +10 % de daño, hacha y martillo +20 %. Servidor: `world.js` comando `attack` (`cmd.dash`, `p.lastRun`, `sp >= 2`).
- Diferencia conocida: el original permite el dash a 2 casillas en diagonal/recta; aquí «alcance + 1».

## Controles
Shift+clic izq. = el summon va a la casilla; Shift+clic der. = el summon ataca; Alt+clic = crítico (`controller.js`, `atk()`).

## Protocolo y pruebas
`NET_PROTO` = 8 (el comando `attack` lleva `crit`/`dash`; no cambia). Test: `tests/crit-dash.test.mjs`.
