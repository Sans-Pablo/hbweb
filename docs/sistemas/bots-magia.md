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
