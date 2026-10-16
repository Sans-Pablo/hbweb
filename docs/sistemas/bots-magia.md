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
