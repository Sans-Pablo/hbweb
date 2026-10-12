# Bots (jugadores simulados) — INVENTO del port

Código: `shared/systems/bot.js`, `Adventure.spawnBot/botOp` (`adventure.js`), `debug.js` (ops `bot`, `botclear`), `client/devtools.js` (F1 → Bots). Tests: `tests/bot.test.mjs`, `tests/net-bot.test.mjs`.

- **Qué son**: entidades `kind: "player"` sin conexión. Se ven y cuentan como jugadores (grupo, HP en el marco de grupo, equipo visible `ap`) y deciden con las MISMAS órdenes que un cliente (`adv.command`: move, attack, pickup, equip, use, stat, say, respawn): no tienen atajos de reglas.
- **Invocar**: F1 → Bots (cuenta con herramientas de admin, `HB_DEBUG`): *Invocar bot* (entra en tu grupo y te sigue), *Bot suelto* (caza por su cuenta alrededor de su punto de nacimiento), *Quitar bots*. Hasta 10 por orden y 40 en total; nivel inicial 1–50. Los bots de un jugador se van cuando éste sale.
- **Comportamiento** (`run`, cada 100 ms): reaparece solo 3 s tras morir; sigue al dueño (también al cambiar de mapa o entrar en la cripta); elige el monstruo más cercano que amenace al grupo, ignora los que lo matarían en 3 golpes y los jefes si nivel < 40; ataca a su alcance (`reachOf`), camina con A* (`path.js`); bebe RedPotion con < 45 % de vida y descansa hasta el 75 %; come con hambre; recoge oro y botín útil cercano; dice «Level N!».
- **Recados** (cada 3,5 s fuera de combate, `errands`): reparte puntos (50 % Str, 30 % Vit, 20 % Dex), repone pociones y comida, se equipa lo que lleve si es mejor y **compra por catálogo** (sin ir a la tienda: usa el precio de Item.cfg y su oro; la prueba real es `Inv.equip`, si no puede usarlo lo devuelve) y vende lo que sobra. Al nacer: 400 + 250·nivel de oro y un equipo completo.
- **Limitaciones**: no persisten (no se guardan), no lanzan magia ni usan summons, no hacen misiones ni usan el almacén; el servidor no los cuenta como conectados. Siguientes pasos naturales: perfiles (arquero, mago), tienda real, guardado y reaparición automática al arrancar el servidor para poblar el mundo.

## Armaduras, hilos y chat ambiental (0.50.6)
- `botitems.wish`: la ganancia se mide relativa a lo que ya lleva en el hueco (`gain/(have+6)`), así las armaduras compiten con las armas; `errands()` visita primero el hueco más flojo.
- Hilos: `residents.noteThread`/`threadOf` recuerdan quién charla con quién; dentro del hilo la respuesta tiene enfriamiento 5 s, más alcance y prioridad.
- `human.js`: `chatter` (chat ambiental enlatado) es falso por defecto; se activa con `/api/admin/human`.

## v0.64.0
Pociones hasta 40 (con oro), sin cambios escudo/dos manos, lecciones de muerte (`dlv`) caducan a 20 min (`dlt`), `bossPreview` con la escala de `dungeon.js`.

## Cerebro, manuales, descenso y equipo (0.65.0)
- **Cerebro**: en modo observar el servidor envía `{t:"brain", b}` cada segundo (`brainOf(adv,p)`, residents.js); el cliente lo pinta en `brainPanel` (observer.js). Test: `tests/bot-brain.test.mjs`.
- **Centro de observación** (0.67.0): `client/watchpanel.js` — `rosterPanel` (plantel agrupado por `grp` de `botList`), `observerBar` (◀ ▶, teclas [ ]), `brainPanel` con pestañas. Cambiar de bot = recarga con `#observar=ID` (el `pid` se fija al cargar). `modeOf` en residents.js da el modo.
- **Manuales**: `studyManuals` (bot.js) compra y usa el manual de la skill del arma/escudo si está a 0. Test: `bot-manuals.test.mjs`.
- **Descenso**: cada piso nuevo suma 5 min a `_delve.until`; el tope lo siguen marcando `cryptCap` y `cryptNeed`.
- **Equipo de cripta**: `recruitCrypt` invita hasta 2 habitantes libres cercanos (nv ±8, vida >70 %); un 25 % rechaza. Los seguidores bajan por el portal tras el líder.
- **Observador dividido** (0.68.0): `web/observador.html` + `client/dashboard.js`. Cuatro cuadrantes: iframe `index.html?embed=1&o=ID#observar=ID` (modo embed en main.js: sin paneles, manda `{hbBrain,id,name}` por postMessage; la consulta distinta recarga solo el marco), plantel (`/api/bots`, cada 2 s), ficha (`brainHtml` de watchpanel.js, pestaña Charlas) y estadísticas (historial de 15 min por id en el cliente).
- **Charla** (0.68.0): `speak` parte los textos largos (`splitSay`/`sayLong`, ≤108 por mensaje, máx. 4); `logTalk`/`talkCtx` guardan y devuelven la memoria de conversaciones (`res.talk`, 40). Test: `tests/bot-chat.test.mjs`.
- **Ocio** (0.69.0): `systems/leisure.js` (pesca, granja, comercio, entreno, charla, backup de guild); `r._leis`, `r.lz[kind]`; se interrumpe con una petición humana (`_pend`). Pesca: `systems/fishing.js`. Tests: `leisure`, `fishing`.
- **Arco** (0.69.0, invento): `isArcher` (bot.js) compra arco (76/75/617) y flechas (77); `botitems.judge` no los vende. Test: `archer.test.mjs`.
- **Apoyo** (0.69.0, invento): `isSupport` (hash del nombre, estudiosos); compra MagicWand (256–258), lo mantiene en mano (`hasStaff`); `pickSpecies`/`SUPPORT_PLAN` en residents.js. Test: `support-bot.test.mjs`.
- **Builds ajenos** (0.69.0, invento): `Builds.peerBest` copia el build con mejor exp/min de otro de su arquetipo (+15 %) y lo recomienda al guild. Test: `builds-peer.test.mjs`.

- **Descanso en zona segura** (0.76.0): `bot.js#restSafe` (ni Promise Land, ni cripta/arena; solo zona sin ataque). Con `b.rest` fuera de ella el bot usa Recall antes de quedarse quieto; si le pegan (`lastCombat` < 2,5 s) deja de descansar y se defiende. Test: `bot-rest.test.mjs`.
- Vaivén: `bot.js#vaiven` descarta la meta si en 18 pasos solo se pisan 4 casillas o menos (test `vaiven`); al tercero seguido, Recall.
- **Oficios fijos** (0.76.0): `residents.js#JOBS` (por nombre): 2 granjeros (Helga, Nils), 2 pescadores (Ivo, Greta) y 4 de apoyo (Petra, Lyra, Olga, Yara; 2 por bando). `attach` fija `res.job`, `bot.fixed` y el arquetipo. Granjero: `bot.farmer`, repone semillas (compra hasta 6), no sale de expedición ni se agrupa, no descansa en ocio. Pescador: `leisure.js` lo manda a pescar en tandas de ~3 min casi sin pausa y vende al terminar. Apoyo: `isSupport` siempre, `social` lo une como miembro (rango 45 casillas / 40 niveles, 25-40 min). Test: `bot-jobs.test.mjs`.

- **Pulido 0.79.3**: Recall solo cuenta interrupciones sin golpes (`cryptRecall`); `b.noFight` frena el combate al ir a la cripta (`delve`); recados en combate sin flechas; arquero sin oro ni flechas suelta el arco; `stuck.last` evita informes de atascos ya resueltos. Test: `bot-fixes.test.mjs`.
- **0.79.4**: summon a >40 casillas del dueño se teletransporta (ignora ocupado/orden vieja). Simsim 3 semillas limpias.
