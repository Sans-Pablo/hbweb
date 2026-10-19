# Bots magos y magia de bots (0.85.26) — INVENTO del port

El original no tiene bots: todo esto usa las mismas órdenes y reglas que un jugador (`learn`, `cast`, `equip`, `unequip`, `statreset`).

- **Bot mago**: `spawnBot(owner, {mage:true})` (o `botOp` con `mage`). `p.bot.mage`, build `mage` (INT 0.45, MAG 0.2, VIT 0.35 en `builds.js`) y stats base `BOT_MAGE_STATS` (Int 18, Mag 12). `isMage`/`isCaster` en builds.js.
- **Estudio** (`botmagic.js study`): una magia por recado, orden `STUDY_ORDER`. Reglas de `MagicSys.learn`: Int ≥ reqInt de Magic.cfg, oro (con reserva de 150), coste < 0 = no se vende. No existe manual de Magia en Item.cfg; la maestría `skills[4]` sube lanzando.
- **Manos** (`ensureHands`): el mago puro se pone una varita (wtype 34–39) o se quita escudo/arma a dos manos/espada; si no, `usable` rechaza el hechizo.
- **Combate** (`fight`): mejor ataque pagable (`ATTACK`), con maná reservado para la cura y `castChance ≥ 40`; en vez de pegar. No lanza en zona segura.
- **Apoyo** (`support`): se cura o cura al dueño/grupo bajo el 55–60 % de vida; escudo (`SHIELDS`) cada 45 s en pelea.
- **Reinicio de atributos**: los residentes usan `rebuild()` de residents.js; el pool de builds incluye «mago». Respeta `respecCost` (300+60·nivel), mago NPC cercano y tope diario 2.
- **Equipo**: `casterBonus(d)` se suma al item level para lanzadores (ahorro de maná, +% daño mágico, resistencia mágica). El mago acepta varitas y bastones.
- Test: `tests/bot-mage.test.mjs`. Pendiente: `botitems.js judge` no conoce el bonus mágico.

## Táctica de PvP y dos clases (v0.85.53)
- **Solo dos clases**: guerrero (`vanguard`) y mago (`mage`), 50/50 (`residents.js rebuild`, `RESET_V = 2`; `adventure.js spawnResident`). Cualquier build antiguo cuenta como una de las dos (`builds.js buildOf`).
- **Mago contra jugador** (`botmagic.js fight`): siempre intenta Paralyze; 2 fallos seguidos → sospecha de PFM y prueba un ataque; si el ataque tampoco quita vida, hay protección mágica: espera 6 s y repite (`b.pv`). Paralizado: Spike Field en su casilla (anula el Fire Field rival) y remata. El grupo concentra el fuego en el paralizado (`bot.js pickTarget`).
- **Apoyo de equipo** (`botmagic.js plan`): Fire Field libera al amigo paralizado, Invisibility salva al amigo con <35 % de vida o prepara una emboscada, Detect Invisibility ante rivales invisibles, AMP / PFM / Berserk a los guerreros.
- **Guerrero con 36 de Int** (`builds.js WAR_INT`, `botmagic.js utility`): se quita arma y escudo, lanza Invis/PFM/Detect/Paralyze (PFM contra magos) y se reequipa.
- Tests: `tests/bot-pvptactics.test.mjs`.

## Fórmulas para los bots (v0.85.54)
`systems/botformulas.js` predice sin tirar dados: acierto `floor(ataque/defensa*80)` 15..99 (`rules.js hitChance`), daño medio (`combat.js damageRange`), MR efectiva `skill + addMR + (Mag-50)` y probabilidad de que un hechizo pase `floor(poder/MR*50)` 15..99 (`magic.js resists`, `magicsys.js`). Uso: Paralyze solo si `landChance` ≥ 25 (30 en mago); `pickTarget` pondera daño esperado (guerrero) o MR (mago); `allocate` manda más puntos a Mag al llegar a Int 50. Test: `tests/bot-formulas.test.mjs`. Pendiente: sets de equipo situacionales.

## Mejoras PvP (v0.85.55)
- Maná: `fight` deja siempre reserva para curar y 2 Paralyze (PvP).
- Parálisis: con un compañero cuerpo a cuerpo a ≤5 casillas del paralizado, el mago no lanza daño.
- Escudo: `bot.js swarmShield` equipa escudo con ≥3 atacantes (skill Shield, sin arma a dos manos).
- Stats: guerrero Str del arma > Dex > Vit; mago Int > Mag > Vit; `RESET_V` 3.
- Observador: `watchpanel.js fightChannel`, canal de TV con las peleas PvP (`pv`/`pvid` del roster).

## Anti-box y ranking de items (v0.85.56)
- `boxBreak` (bot.js): con 2+ enemigos adyacentes y <= 1 casilla libre, el objetivo pasa al más débil de los pegados. `pickTarget` suma `hp/40` (máx. 8) a monstruos para matar primero a los débiles. `encircle`: en PvP va a la casilla junto al rival más alejada de sus compañeros.
- `bonusScore` (builds.js): valor convexo `v2·(1+v2/10)`; pesos guerrero HP>MR>MA, mago MP>HP>DR>PA; armas acierto(2)>consecutivo(10)>reputación(11); armaduras ligeras (poca Str) suman, más para el mago; `setWanted` da +40 a los items con HP (vida <40 %) o MP (mago, maná <25 %) → el bot cambia de set en `errands`.
- `itemlevel.js`: HP/MP secundarios y acierto de arma valen convexos, lo que sube el precio de mercado (Plate Mail HP+70 muy valiosa).

## Rematar al paralizado (v0.85.69)
Con el rival en `hold`, `botmagic.fight` baja la reserva de maná a una curación y prefiere hechizos de hielo (`attr 4`): el daño de hielo no libera la parálisis (`combatsys.releaseHold`). Si un cuerpo a cuerpo está a ≤2 casillas el mago se aparta 3 (`bot.js`), porque cada golpe rompe el lanzamiento (`castbreak`). Test: `tests/mage-pvp-damage.test.mjs`; diagnóstico: `tools/mage-duel.mjs`.


## v0.85.76 (obs. 34, 35, 37)
- Carisma: `BOT_STATS.chr` 10; solo `futureMaster(name)` (1 de cada 5) sube a 20 para fundar guild.
- PvP/PvE: `r._dom` (residents.pits) = zona con foso dominado >8 s; `pickTarget` ignora jugadores lejanos si domina y prioriza jugadores si no.
- Magias: `studyList` = lista de siempre + resto de Magic.cfg por Int exigida; `escapeInvis` lanza Invisibility al huir (necesita manos libres). Test `bot-obs34-37.test.mjs`.

## Mago PvP por replay (v0.85.78)
- Fuente: replay de zzzz (157 hechizos: Blizzard 47, Paralyze 35, Great Heal 16, Berserk 10, Shock Waves 16; 17 golpes).
- **Área** (`pvpArea`): 2+ rivales a <=3 casillas del objetivo → el área más barata conocida (Blizzard 91, Earth Shock Wave 96, Bloody Shock Wave 70).
- **Amenaza** (`threat`/`mostThreatening`): lanzadores y vida alta pesan más; el mago paraliza primero al más peligroso a <=4 del objetivo.
- **Cura con margen** (`healSafe`): con 2+ rivales a <=3 no cura (huye) salvo vida <25 %.
- Buffs defensivos: ya solo contra magos o amenaza mágica (worthBuff). Bastón: sin cambios (el mago ya prefiere hechizos).
- Test: tests/bot-mage-pvp-aoe.test.mjs. Todo INVENTO del port.

## Maná, horda y buffs (v0.85.81, INVENTO sobre datos de los replays zzzz)
- Beber BluePotion: maná < max(35 % del máximo, 2 lanzamientos del ataque más caro, tope 60 %) en pelea (≤10 s), cada ≥600 ms. Datos: replay zzzz_620 (mago nv140, 2ndmiddle): 48 usos, MP medio al beber 27 %, mínimo 13/780.
- Compra: hasta min(50, oro/45) BluePotion (el dueño compró 43).
- RedPotion: umbral del gen +0,15 con ≥3 monstruos a ≤3 casillas (zzzz_620: HP mín. 339/980 rodeado, 0 muertes).
- Horda (≥4 monstruos a ≤3 del objetivo): Paralyze al que ya le alcanza (reintento por objetivo cada 6 s) y área (Blizzard 91…) si el maná cubre coste + reserva de cura; si no, el báculo/cuerpo a cuerpo (ya no gasta maná caro).
- Buffs PFM/AMP: también con el monstruo a ≤10 casillas antes de pelear, no solo en pelea (zzzz_620: 7 buffs intercalados con ataques).

## Variedad de hechizos (v0.85.89)
- Fallo: con maná lleno el mago solo lanzaba Magic Missile (`cheapest` elegía lo más barato). Ahora `RICH`=0.5: con maná >=50 % elige el hechizo menos lanzado y de mayor coste; con 2+ monstruos usa área [91,72,96,70].
- Censo 300 s, 6 magos nv140 (seed 7): antes MM 391, EB 129, Blizzard 4, Mass Ice 0; ahora MM 269, EB 76, Blizzard 40, Mass Ice 32, maná medio 42-67 %. Test bot-mage-cast-variety; tools/cast-census.mjs. INVENTO del port.

## Kit de control y soporte (v0.85.90)
- `botmagic.mageKit`: control lanza Mass Illusion Movement (95) con monstruo y otro cerca (enfriamiento 8 s); soporte se pone AMP o PFM (30 s); ambos Paralyze (35/25) al monstruo que les ataca a <=2 casillas. Solo exige maná + reserva de curación.
- Soporte (Str 40): `errands` compra Chain Mail y Tower Shield ANTES de estudiar (los hechizos agotan el oro; `maxOut` lo llama antes de `BM.study`). La cota se viste; la torre va en la mochila porque un escudo en LHAND bloquea el casteo (`_bIsItemOnHand`, Game.cpp; magicsys.js). `ensureHands` la equipa con maná <12 % en pelea y la quita al 40 %. Los bucles genéricos de equipo ignoran LHAND para magos.
- Censo 300 s seed 7: MM 222, EB 78, Blizzard 27, Mass Ice 12, MIM 16, Paralyze 7, AMP 4. Test bot-mage-kit90. INVENTO del port.
