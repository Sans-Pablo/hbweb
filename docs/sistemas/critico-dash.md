# Crítico y dash (v0.78.0)

**Aviso de fidelidad.** El código original (`/root/HelbreathServer`) no estaba en la máquina de esta versión: la mecánica existe en el original
(`m_bSuperAttackMode`, `bIsDash`; ver `combate.md`) pero **las cifras de aquí son una aproximación de diseño, no copia**. Están en `shared/combat.js#CRIT`
con un comentario que lo dice. Cuando haya acceso al original hay que sustituirlas.

## Crítico
- Cada golpe que acierta carga `p.critBar` (`CRIT.barPerHit` = 6 sobre `barFull` = 100). Al llegar a 100 se concede una carga `p.superAttack` (tope `max(1, nivel/10)`).
- **Alt + clic** sobre un monstruo o jugador enemigo: el siguiente ataque va con `crit:true`. Solo vale si hay carga; si no, es un ataque normal.
- Efecto (`strikeNpc` ctx.crit): ignora `CRIT.ignoreDef` % de la defensa y multiplica el daño por `CRIT.mult` (1,5). Evento público `crit`.

## Dash
- Atacar **corriendo** (correr es el estado por defecto, Ctrl+R lo alterna) a una casilla más allá del alcance: el personaje avanza y golpea en el mismo paso.
- Condiciones (servidor, `world.js` comando `attack`): `cmd.dash`, hueco = alcance + 1, alcance < 4, había corrido hace menos de `PLAYER.runMs*3` (`p.lastRun`) y `sp >= 2` (gasta 2).
- Multiplicador `CRIT.dashMult` (1,3).

## Controles
Shift+clic izq. = el summon ataca; Shift+clic der. = el summon va a la casilla; Alt+clic = crítico (`controller.js`, `atk()`).

## Protocolo y pruebas
`NET_PROTO` = 8 (el comando `attack` lleva `crit`/`dash`). Test: `tests/crit-dash.test.mjs`.
