# Arma de daño máximo del guerrero (v0.85.82, INVENTO del port)

Petición del propietario: los guerreros apuntan a Barbarian Hammer, Battle Hammer, Battle Axe y Giant Sword, algunos con Flameberge, siempre maximizando el daño.

- Código: `web/src/shared/systems/botweapon.js` (puntuación) y `bot.js` `errands` (compra/equipa en el reabastecimiento). Test: `tests/bot-warrior-weapon.test.mjs`.
- Candidatas (Item.cfg, todas a dos manos, equipPos 9): BarbarianHammer, BattleHammer, BattleAxe, GiantSword, Flameberge (y sus +N del botín). Otras (MasterBHammer…) no se compran.
- Daño esperado = dados (v1-v6: pequeño y grande) × (1 + Str/500) × acierto (`hitChance`: maestría del arma + 50 + Dex-50 contra defensa 80) ÷ intervalo (`PLAYER.attackMs` + nibbles de velocidad × 96, con `speedNib = speed - Str/13`).
- Puntuación = dps×2,6 + extra del atributo del objeto (item level), por factor de prioridad (martillo bárbaro 1,08 > Battle Hammer 1,05 > Battle Axe 1,03 > Giant Sword 1,01: solo desempata) o ×1,7 para Flameberge si el bot es «de Flameberge».
- «De Flameberge»: 25 % de los guerreros, decidido una vez con `w.rng()` (`b.flam`), determinista.
- Solo cambia de arma si la nueva supera a la actual en un 5 %. Requisitos reales: nivel (`levelLimit`) y peso ≤ Str×100 (Barbarian Hammer pide Str 200). Compra con oro (precio+60) y, si no puede ponérsela, devuelve el dinero.
- Arma a dos manos libera el escudo (inventory.js); los bots guerreros no vuelven a ponérselo.
- Limitaciones: el reparto de puntos solo mira la Str del arma puesta; juez/venta de armas sobrantes sigue por item level.

## Pociones (v0.85.86)
`potionUseful(w, item, deficit)` en bot.js: poción HP/MP = v1d(v2)+v3 (HG.cpp UseItemHandler); el bot solo bebe si le falta al menos su media (23 con 2d12+10). Test: bot-potions-subshop, simulación bot-sim-potions-weapons.

## Str tras el reset (v0.85.86)
`strNeedOf` (bot.js) = max(Str del arma puesta, `warTargetNeed`): la Str de la primera arma de la lista (Flameberge primero si el bot la sigue; luego Barbarian > Battle Hammer > Battle Axe > Giant Sword) permitida por su nivel y alcanzable con Str+puntos. Se usa en maxOut y en spendPoints (spawn, resetAll, restartBots, bots140). Test: bot-war-str-target.

## Tabla de Str por arma (v0.85.87, Pablo)
`builds.WAR_STR`: Barbarian Hammer 200, Battle Hammer 182, Battle Axe 170, Giant Sword 160, Hammer 160, Flameberge 160 (swingStr = max(peso/100, vel×13) pide 195/182/169/156/156/130; Flameberge usa 160 como la Giant Sword). `warTargetNeed` elige el arma por nivel y alcance y devuelve esta Str; `allocate` da Str, luego Int (36 con Paralyze o 10, por hash del personaje, `warInt`), Dex en múltiplos de 10 y el resto a Vit. Nivel 140: 417 puntos, Str 200 cuesta 186 e Int 36, 26: sobran ~205. Test: war-str-table.

## Builds de guerrero y mago (v0.85.88, Pablo)
- Guerrero (`builds.WAR_BUILDS`): berserker (flam, 25 %): Flameberge con Str 130 (swingStr = 130) + Int 59 (Berserk, reqInt 59); giant59: Giant Sword/Hammer Str 160 + Int 59; heavy36/heavy10: arma pesada por nivel + Int 36 (Paralyze) o 10. Elección por hash del id.
- Reparto: Str del arma > Int del build > Dex hasta 100 > resto Vit ~80 % y Dex ~20 % (múltiplos de 10); nunca a Mag/Cha. Antes de nivel 100 el pozo no llega: la mitad a Dex, el resto a Vit. Nivel 140 (417 puntos): Str 200 + Int 59 + Dex 100 gastan ~323, sobran ~94 para Vit/Dex.
- Mago (`MAGE_BUILDS`): blizzard Int 195 (Blizzard), control Int 200 (Mass Illusion Movement 95, Earth Shock Wave 96 no se vende), support Int 133 (Mass Ice Strike). A nivel >=100: Mag 60 % (soporte 40 %) del resto y Vit el sobrante; compra primero el hechizo clave (`botmagic.MAGE_KEY`). 140 llega: Int 200 cuesta ~182 puntos.
- Límite: el mago de soporte solo tiene los stats y los hechizos; seguir al guerrero y los buffs no están hechos. Test: `tests/bot-builds88.test.mjs`, `tests/war-str-table.test.mjs`.

## Builds aprobados (v0.85.89)
- WAR_BUILDS: bh, bh36, bbh, bbh36, gs, gs36, gs59, ba, ba36, fl, fl36, fl59 (Str por arma 182/200/160/170/130, Int 10/36/59, Dex 120, Mag 10, resto Vit). Mago: blizzard, control, support. Tests war-str-table y bot-builds88.
- Los stats base del bot suman 68 (14/12/12/10/10/10), no 60: Vit queda 8 sobre la tabla; el mago no baja de Str 14.
