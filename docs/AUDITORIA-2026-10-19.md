# Auditoría 2026-10-19 (audit_F: combate/magia/HUD frente al original)

Versión hbweb en la que se entrega: la actual de `web/data/version.json` (sin subir versión ni commit, según el encargo).

## Corregido
- **Exp por golpe a NPC** (`combatsys.js damageNpc`; original `char/combat.cpp` ~1491-1520):
  - en cruzada (`w.crusade`) la exp por golpe se divide entre 3;
  - Rabbit/Cat (tipos 55/56 de NPC.cfg) no dan exp por golpe si el atacante tiene nivel > 100.
  - Test: `tests/exp-original.test.mjs`.
- `tools/test.sh`: verde, 225 tests (incluye net-* y online). No había fallos reales previos.

## Registrado, no tocado (riesgo o decisión de producto)
Lista ya en `docs/ESTADO.md` (sección de auditoría):
- SA de arma (tipos 1-5, veneno de NPC); orden de modificadores (fightzone/apocalipsis/flags/cruzada); knockback (actionLimit 4); contraataque 1/3.
- Magia: Confuse 3/4, ICE_LINEAR (Earthworm, tipo 27; HG.cpp:10671), Berserk en NPCs (HG.cpp ~11470), rango de varita <41/<=39.
- NpcActionQuery modos 1,7,8,9,4,6; SkillDlg Manufacture/Alchemy; NpcTalk/Quest como ventanas ND_GAME2; sonido UI `PlaySound('E',14,5)`; HUD audit_C.

## Pendiente de la rama kill (no verificado)
- La exp al matar (`npcsys.js killNpc`, HG.cpp:6593) no aplica la regla de cruzada ni 55/56 (en el original esas reglas solo están en el camino por golpe de combat.cpp; no confirmado el del kill).
- Comprobación de invocados (`m_bIsSummoned`) en el camino por golpe: el port da exp 0 a invocados por otra vía, no verificada.

## No verificado
- Fórmulas, textos, drops, spawns y mapas: no se llegó a auditarlos.
- Notas hermanas audit_D/E: parcialmente obsoletas (datos/balance/cast delay y aturdimiento/Defense Shield ya corregidos según ESTADO v0.85.77/79).

## Combate/magia, segunda pasada (audit G, sin commit ni versión)
Archivos tocados: `combatsys.js`, `magicsys.js`, `itemsys.js`. Test: `tests/combat-audit-g.test.mjs`.

### Corregido
- **Contraataque** (`combat.cpp:1316-1331`): sin contraataque si el NPC es del mismo bando que el atacante (salvo tipos 21/55/56), si es una cp (51) o tiene ataque permanente.
- **actionLimit** (`combat.cpp:1253-1295`): `damageNpc` ya no resta vida a límites 1, 2, 4 y 6 (antes solo lo evitaba `strikeNpc` para 1/2/6).
- **Exp por golpe** a invocados (`n.master`): ninguna (`combat.cpp:1491`, `m_bIsSummoned`).
- **Protection From Arrows** contra Dark-Elf (54) y Arrow Guard Tower (36) lejanos: el golpe falla (`combat.cpp:664-671`).
- **Berserk sobre NPC** (`HG.cpp:11475-11481`): compara el bando efectivo del NPC (`n.side` de los invocados, si no `cfg.side`) con el del lanzador; antes solo miraba `cfg.side` y nunca valía para invocados.
- **Earthworm-Strike** (cfg tipo 27, `DAMAGE_AREA_NOSPOT_SPDOWN`, `HG.cpp:10859`): además del daño baja el aguante de los jugadores alcanzados con dice(v7,v8)+v9.
- **Manuales de hechizo** (`ITEMEFFECTTYPE_STUDYMAGIC`, `HG.cpp:17736`): antes "no implementado"; ahora enseñan el hechizo sin oro si Int >= ReqInt y se gastan siempre.

### Verificado, coincide
Berserk x2 solo con attackMode<20 y antes de VIT/cerca; orden de modificadores de jugador (VIT, +10 DarkExecutor, mínimo 1, acierto, combo, crítico, fightzone, apocalipsis, banderas, cruzada); absorción por parte del cuerpo y escudo; stun por oro/55; SA 50/51/52 del objetivo; poción HP/MP/SP/HPSTOCK; Berserk NPC exige actionLimit 0.

### Sin resolver
- **Numeración de tipos de magia**: el enum de `Magic.h` del servidor está desplazado 1 respecto a los números del `Magic.cfg` desde 26 (el cfg da Blizzard 26, Earthworm 27, Armor-Break 28, Cancellation 29…). El port usa la numeración del cfg (Earthworm→25, Scan→33 en `magic.json`); `ICE_LINEAR` del servidor (`HG.cpp:10671`) corresponde al Blizzard (26 del port, ya implementado). No se toca sin una fuente que lo zanje.
- **Manuales de habilidad**: el original da nivel 20 (SpecEffectValue1||v2) y gasta siempre el objeto; el port da 100 y no lo gasta si ya se tiene. Es decisión de producto declarada (bots y `bot-crit`/`bot-manuals`/`pets` dependen); corregirlo exige rehacer esos bots.
- **SA de arma** (tipos 1-5: mitad de vida, hielo, parálisis, matar, curar; veneno de NPC): sigue sin activarse (`saActive`); necesita la carga/activación del cliente (fuera de este alcance).
- **Retroceso con actionLimit 4**: sin NPC de ese tipo en `npc.json`; no aplica. **Estructuras de cruzada** del mismo bando (return 0), **SA 62** (reputación), **RAGPROTECTIONTIME** tras entrar, **berserk slate / tablillas** (SLATES) y **Lottery**: no existen en el port.
- **Drops** (`DropConfig.cpp`) y **summon control mode 1**: no auditados en esta pasada.

## Cliente de diálogos/HUD (sesión hb-fidelidad-ui; sin commit ni release)
Original: `Game.cpp` DrawDialogBox_NpcActionQuery (34250) / DlgBoxClick_NpcActionQuery (36707), DrawDialogBox_SkillDlg (35358), `lan_eng.h`. Test: `tests/npcquery-alchemy.test.mjs`.

**Encontradas y corregidas**
- NpcActionQuery modos 7/8/9: cajas de clic/hover x 25..100 y 125..175 (el port usaba 25..120/125..210), filas y 30..45 / 50..65 (el port 25..45 / 45..65); hover de todos los enlaces con y..y+15 (el port y-5..y+15).
- Modos 7-9: título y subrayado en negro (0,0,0) como el original; el subrayado del modo 9 ("Cityhall Officer", x66) faltaba.
- Modo 9 "Talk": además del aviso, abre el texto del ayuntamiento (TALKTONPC 4, `talk.json` 154) y no cierra el cuadro (el original no lo cierra).
- Modos 0/4/5 "Talk": solo se dibuja y actúa con NpcTalk (21) cerrado; en 0/5 faltaban los avisos TALKING_TO_* ("Talking to Shop Keeper...", etc.).
- Modo 3 (almacén): texto alineado en sX..sX+240 (el port usaba el ancho 215/252) y mensaje "There is no empty space left in warehouse." (el port decía "here is no…", error de la auditoría B: `lan_eng.h` DLGBOX_CLICK_NPCACTION_QUERY9 lleva "There").
- Con el intercambio abierto (id 33 del port = 27 original) el clic del menú dice "Item transaction not finished." y no actúa.
- Sonido de UI: `DlgBoxClick_NpcActionQuery` no llama a `PlaySound`; el port sonaba E14 en cualquier clic aprovechado. Marca `silent` en el diálogo y `gui.js` la respeta (el resto de cuadros sigue sonando).
- **SkillDlg alquimia (id 26, modos 1/2)**: antes el cliente no mandaba nunca la orden `alchemy` (la lógica de servidor existía pero era inalcanzable). Ahora: doble clic en el AlchemyBowl (spriteFrame 55) o botón del libro de magia → panel `interface2_0` frame 1 con 6 huecos (posiciones 55/100/145 × 55/100, +5/+8), soltar ingredientes (EAT/CONSUME/NONE, pilas hasta su cantidad, "There is no more space for ingredients."), «Try Now!» → «Creating...» 3 s con temblor y E41, al final orden `alchemy` y E42. Mensajes "Using alchemy skill...", "Mixing a potion...", y los avisos NOTIFY_MSG_HANDLER46-49 (éxito, fallo, nivel bajo, ingredientes incorrectos). Textos de maestría 0: INVENTORY9/16 de `lan_eng.h`.
- HUD/log: `AddEventList` no repite una línea igual a la última (solo dentro de los 5 s en que sigue visible, para no tragar avisos legítimos pasado el tiempo); color del evento tipo 1 del historial 130,255,130 (`chatwin.js`, era 130,200,130). (Otros puntos de audit_C —"Required Exp", tooltips del panel, dx aleatorio de fx— ya estaban corregidos en el árbol.)

**Sin resolver (decisión o fuera de alcance)**
- NpcActionQuery modo 1 (Give/Exchange sobre otro jugador, límite 4 casillas): el servidor del port no tiene "dar objeto a jugador"; el port salta directo al intercambio al soltar el objeto sobre un jugador (main.js, "estilo Olympia"). Pendiente de decidir si se restaura el menú.
- Fabricación (SkillDlg modos 3-8, BuildItem.cfg/CraftItem.cfg, yunque frame 113, Crafting): sin portar; no existe en el servidor del port (ver `docs/sistemas/alquimia.md`). Solo existe `manufill` de main.js.
- Alquimia: DemonPotion (receta 20) no existe en `items.json`; el peso/orden de recetas sigue el servidor del port.
- Banco `MAXBANKITEMS`: original 121 (`Game.h:86`), port 200 (`shopsys.js`, shared; no tocado).
- Modo 6 (Gail): el port abre el diálogo 51 solo si existe; el flujo Heldenian no se ha auditado.
- Sonidos de UI: el port suena E14 en todo clic aprovechado por un cuadro; el original lo decide botón a botón (244 `PlaySound('E',14,5)` en Game.cpp). Solo se ha corregido el menú de NPC.
- HUD no tocado por límite de archivos (renderer.js): nombres sobre cabezas (orden nombre/guild/side, Berserked/Frozen), burbujas de chat, minimapa, cursor 8/1/2.
