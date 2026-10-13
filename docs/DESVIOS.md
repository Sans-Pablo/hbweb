# Desvíos respecto al Helbreath original (2026-10-13, hbweb 0.80.2)

Qué hay en el original y no en nuestro port, qué hay en el port y no en el original, y qué está a medias.
Base: servidor `Helbreath.HGServerConsole` (HG.cpp 40.8k líneas, combat.cpp, Npc.cpp, Client.cpp…), `Helbreath.ServerFiles/Config/*.cfg` y cliente `Helbreath.Client/Game.cpp` (43.6k líneas), contra `web/src/shared`, `web/src/client` y `web/data`.

**Método y límites.** Sale de leer listas de funciones/ficheros y de buscar palabras clave en nuestro código. Es un mapa fiable de *qué existe*; NO prueba que lo que existe sea idéntico. Las filas marcadas «(a verificar)» son hipótesis por búsqueda de texto. Estados: ✅ presente · 🟡 parcial · ❌ falta · ➕ invento del port (no existe en el original) · ⏸ aplazado a propósito (`docs/FUTURO.md`).

## 0. Resumen: a qué distancia estamos

| Área | Original | Port | Lectura |
|---|---|---|---|
| Objetos (`Item*.cfg`) | ~609 | 568 | ~93 %. Faltan ~40 (a listar con diff de IDs) |
| Magias (`Magic.cfg`) | 66 | 64 | ~97 % |
| NPC/monstruos (`Npc.cfg`) | 135 entradas | 63 | **~47 %.** Faltan casi todas las estructuras de guerra (torres, cañones, gates, mercenarios por bando), pixies, Ghost/Vampire/Scarecrow, GHK/TK/BG, Princess, Energy-Sphere… |
| Mapas (`MAPDATA`/`GServer.cfg`) | 85 (84 en servidor) | 41 | ~48 %. Faltan Elvine, nieve, muchos mapas de bando y de dungeon |
| Quests (`Quest.cfg`) | 151 | invención propia (22 por clase, acto 1) | ➕ otro sistema, no es el original |
| Guerra (Crusade/Heldenian/Apocalypse) | ~640 líneas de referencias | 0 | ❌ ausente por completo |
| Reputación/PK/criminal | sí | no | 🟡 núcleo portado (systems/pk.js) |
| Sistema de bandos (Aresden/Elvine/Istria/Neutral) | núcleo del juego | no hay elección de bando | ⏸ |
| Cliente: ventanas (`DrawDialogBox_*`) | 46 | la mayoría de las comunes | 🟡 faltan las de guerra, slates, fishing, DK, majestic… |
| Cliente: texto sobre cabezas | tipos 20/21-23/41-42 con fuente de sprites | daño/“fallo” en canvas | 🟡 ver §3 |

Resumen en una frase: **el combate, la magia, los ítems y la economía base están cerca del original; lo que nos aleja de «HB base» es el contenido de mundo (mapas, NPC de guerra), el sistema de bandos/guerra/PK y buena parte del lado visual de textos y efectos.**

## 1. Combate y personaje

| Mecánica | Original | Port | Estado |
|---|---|---|---|
| Daño de hechizo (`Effect_Damage_Spot`) | dados + `dmg*(Mag/3.3)/100` + `addMagic` | `magic.js spellDamage` | ✅ |
| Bonus de daño mágico de héroe (`m_heroArmourBonus==2 → +4`), `m_addMagicDmgPct` | sí | `inventory.heroBonus`, `magic.spellDamage` | ✅ (v0.80.3) |
| Bonus en zona de lucha (`isFightZone`, +1/3) y de cruzada | sí (HG.cpp ~18050-18110) | zona de lucha ✅ en `spellDamage`; cruzada ❌ | 🟡 |
| Hambre (`m_iHungerStatus`) | sí | `hunger` presente | ✅ (a verificar fórmulas) |
| Modo seguro de ataque (`m_bIsSafeAttackMode`) | sí | modo paz/ataque con Tab (0.80.2) | ✅ |
| Penalización de muerte (`PenaltyItemDrop`) | sí | `combatsys.penaltyDrop` (0.80.2) | ✅ |
| Contador PK (`m_iPKCount`), criminal, reputación | sí | no | 🟡 portado, falta UI y cárcel real |
| Contador de kills enemigos (`m_iEnemyKillCount`), contribución, `m_iWarContribution` | sí | no | ❌ |
| Habilidad especial por arma / `m_iSpecialAbilityTime` | sí (18 refs) | `special` en 14 ficheros, de otro origen | 🟡 (a verificar si es la del original) |
| Resistencias (`m_iAddResistMagic`…) | sí | `rules.js`/`combat.js` | ✅ |
| Daño de pets/summons | estándar | ➕ sistema propio (talentos, bolas, evoluciones) | ➕ |
| Críticos con Alt+clic, dash corriendo | no existe | sí | ➕ |
| Mensajes de combate sobre la cabeza | tipos del cliente | ver §3 | 🟡 |
| Nivel máximo | del original | `MAX_LEVEL` en `combatsys.js` | ✅ (a confirmar) |

## 2. Magia

| Mecánica | Original | Port | Estado |
|---|---|---|---|
| 66 hechizos de `Magic.cfg` | sí | 64 | 🟡 faltan 2 (listar) |
| Costes de maná, aprendizaje por Int/Mag | sí | `magic.js manaCost`, `magicsys` | ✅ |
| Polymorph | `Magic.cfg` | no | ❌ |
| Slates (Pergaminos/«Slate» de 59 refs en servidor) | sí | no | ❌ |
| Invisibilidad, Berserk, Protección, Cancelación, Absorción | sí | presentes | ✅ |
| Hechizos psíquicos / escuelas de summon | no existen | sí (`psychic`, `schools`) | ➕ |
| Full mage (stats 200, sin maná) | no | herramienta de testing | ➕ |
| **Texto del conjuro sobre la cabeza** («Fire Ball!») | `OBJECTMAGIC` → `CMsg(41, "<nombre>!")`, rojo, fuente de sprites, sube y se desvanece | **no existe** (solo `petskill` en el log) | ❌ — el ejemplo que pediste |

## 3. Cliente: textos, fuentes y efectos

| Elemento | Original | Port | Estado |
|---|---|---|---|
| Fuente de sprites (`SPRID_INTERFACE_SPRFONTS2`, `PutString_SprFont3`, 95 glifos × tipos) | usada para daño/conjuros/avisos | `fx.js` `sprFontDraw`: hoja `interface2_1`, 3 tipos, sombra (0,+1)/(+1,+1) y tinte | ✅ daño, fallo y nombre del conjuro (en el resto de avisos sigue canvas) |
| Chat sobre la cabeza (tipo 20 amarillo, retardo 650 ms) | sí | chat propio | 🟡 |
| Texto de conjuro sobre la cabeza (tipo 41/42, rojo, sube) | sí | no | ❌ |
| Números de daño tipo 21-23 (3 tamaños de fuente de sprites, 1-3 líneas de 20 caracteres) | sí | `fx.js "damage"` con la fuente de sprites (tipo por daño <12/<40/más) | 🟡 (sin apilado de líneas) |
| ~285 puntos de creación de efectos (`bAddNewEffect`) | sí | `fx.js` con efectos recreados | 🟡 (sin conteo de paridad) |
| Detalle gráfico (`m_cDetailLevel`: transparencias) | sí | no | ❌ |
| `DrawEffectLights`, `DrawTopMsg`, `DrawDialogBox_WarningMsg`/`15AgeMsg`/`ShutDownMsg` | sí | parcial | 🟡 |
| Ventanas de guerra (CrusadeJob, Commander, Constructor, Soldier, CMDHall) | sí | no | ❌ |
| Slates, Fishing, DKMenuSet, ChangeStatsMajestic, FeedBackCard, ItemUpgrade | sí | ItemUpgrade a verificar; el resto no | ❌ |
| Ventanas comunes (Inventory, Character, Magic, Skill, Party, Bank, Shop, Exchange, Guild, Quest, Help, FriendList, Map/GuideMap, SysMenu, Resurect) | sí | sí, con sprites originales | ✅ |
| Ventanas ➕ propias | no | tutorial, talentos de pets, bestiario, observador, devtools, selector de cripta | ➕ |
| Textos de interfaz | inglés | inglés + i18n ES/EN | ✅ (regla 6) |
| Sonido/música | original | recreado; rediseño aplazado | ⏸ |

## 4. Mundo y contenido

| Elemento | Original | Port | Estado |
|---|---|---|---|
| Mapas | 85 | 41 | 🟡 faltan mapas de Elvine, nieve y bandos ⏸ |
| Monstruos «normales» (Slime…Abaddon) | ~55 | casi todos | ✅ |
| Estructuras de guerra (AGT/CGT/MS/DT/ESG/GMG/LWB/…× 3 bandos), Sor/ATK/Elf/DSK/HBT/CT/Bar/AGC | sí | no | ❌ |
| NPC de ciudad (Gandlf, Howard, Tom, William, Kennedy, McGaffin, Perry, Devlin, Gail, ShopKeeper) | sí | presentes | ✅ |
| NPC de guardia por bando (`Guard-Aresden/Elvine/Istria/Neutral`) | sí | `Guard` genérico | 🟡 |
| Ghost, Vampire, Scarecrow, Pixies (Fire/Ice/Earth/Air), Princess, GHK/TK/BG, Energy-Sphere, gate-a/e/i | sí | no | ❌ |
| NPC propios | no existen | Healer, Buffer, Aura, Elf-Master, Temple-Knight, Tutelary-Angel | ➕ |
| Granjas, criptas por jugador, jefes con fases | no existen | sí | ➕ |
| Arena | no | sí | ➕ (con bandera aplazada) |
| Sistema de quests | 151 `Quest.cfg` | 22/clase propia | ➕ |
| Teleport.cfg, DupItemID.cfg | sí | `teleport` presente | 🟡 teleport.json + validador, sin diálogo |
| Crusade, Heldenian, Apocalypse | sí | no | ❌ |
| Eventos de mundo/DelayedEvents | sí | no | ❌ |
| Hero items (`m_bIsHeroItem` no encontrado; héroe por bono de armadura) | sí | `drops.js` | 🟡 |

## 5. Economía y social

| Mecánica | Original | Port | Estado |
|---|---|---|---|
| Tiendas, venta, reparación | sí | `shopsys` | ✅ |
| Banco | sí | presente | ✅ (a verificar) |
| Intercambio | sí | `trade.js` | ✅ |
| Gremios (`CreateNewGuild`…), Party, Amigos, Susurros | sí | presentes | ✅ |
| Mejora de objetos (`ItemUpgrade`, `m_iGizonItemUpgradeLeft`, 101 refs) | sí | prácticamente ausente | ❌ |
| Alquimia / Manufactura (Potion.cfg, BuildItem.cfg, CraftItem.cfg) | sí | ficheros de artesano propios (`artesanos`) | 🟡 / ➕ |
| Minería, pesca | `SKILL_MINING`, `SKILL_FISHING` | habilidades presentes, contenido a verificar | 🟡 |
| Puestos de venta de jugadores | no | sí | ➕ |
| Oro sin sumideros | n/a | problema de balance del port (RELEASE_TESTERS) | ➕ |

## 6. Servidor, datos y administración

| Elemento | Original | Port | Estado |
|---|---|---|---|
| Login Server + HG Server separados, múltiples mapas por proceso | sí | un servidor Node con mundo compartido | ➕ arquitectura distinta |
| Persistencia | SQL/ficheros | `hb.sqlite` + `server/data` | ➕ |
| Comandos GM / admin | sí | `devtools` (F1 → Herramientas) | ➕ |
| Bots | no | sí | ➕ |
| Simulación determinista compartida cliente/servidor | no | sí | ➕ |

## 7. Lo más importante para acercarnos a «HB base» (propuesta)

1. **Visual rápido (bajo riesgo):** texto de conjuro sobre la cabeza (§2/§3), fuente de sprites `interface2` para daño y avisos, detalle gráfico.
2. **Datos que faltan:** diff de IDs de `Item*.cfg` y `Magic.cfg` (40 ítems / 2 magias), alinear nombres de NPC, importar los 72 NPC y 44 mapas que faltan (`tools/convert_all.py --only npcs,maps`).
3. **Reglas de combate pequeñas:** bonos de héroe y de zona de lucha en `spellDamage`.
4. **Sistema grande (decisión de producto):** bandos + PK/reputación + Crusade/Heldenian. Es lo que define el HB original y hoy no existe; requiere decidir si el primer release (solo acto 1) lo necesita.
5. **Mejora de objetos y slates:** contenido original con ficha y test.

## 8. Pendiente de verificar (siguiente pasada)
Listar IDs exactos de ítems/magias que faltan; contrastar cada 🟡 «(a verificar)» leyendo el código; contar efectos visuales de `Game.cpp` frente a `fx.js`; revisar `DelayedEvents.cpp` y `Astoria.cpp` para eventos de mundo.
