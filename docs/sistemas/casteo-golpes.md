# Casteo cortado por golpes (v0.85.83)
Petición: «no todos los golpes cortan el casteo; revisa defense ratio y hitting probability».

## Original (char/combat.cpp ~1100-1190, CombatConfig.h, HG.cpp Effect_Damage_Spot ~18780-18830, Game.cpp ~26410)
- El casteo es del cliente; lo corta la animación de daño. El servidor solo manda el aviso si el golpe **acierta, hace daño (iAP_SM > 0) y el objetivo sigue vivo**.
- Daño >= 40 (MOVE_DAMAGE_PLAYER/NPC) -> NOTIFY_DAMAGEMOVE: siempre corta.
- Daño < 40 -> OBJECTDAMAGE solo si `dice(1,10000) >= iProb`. iProb por habilidad del arma del jugador atacante: arquería 3500, espada larga 1000, esgrima 2900, hacha 2500, martillo 2000, vara 2000; resto y monstruos 1.
- Magia: siempre corta (umbral MOVE_DAMAGE_MAGIC 50).

## Port
`hitInterrupts` en `systems/combatsys.js`, usado en `damagePlayer`. Antes cortaba cualquier daño > 0.
Acierto: `hitChance` (rules.js) = floor(ar/dr×80) acotado a 15..99, igual que combat.cpp:688.
Pendiente de revisar: bonos de ar/dr (clima, DS/GDS) no auditados uno a uno.

Test: `tests/combat-castbreak.test.mjs`.
