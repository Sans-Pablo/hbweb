# Auditoría motor/servidor vs original (v0.85.9)

Original: `HelbreathOriginal/Helbreath.HGServerConsole/Helbreath.HGServerConsole/` (HG.cpp, char/combat.cpp, char/Client.cpp, Shared/Skilltypes.h).
Estado: OK = igual · CORREGIDO = diferente y arreglado en esta versión (test `tests/audit-motor.test.mjs`) · DIFERENTE = pendiente (decisión o trabajo grande) · FALTA = no existe en el port.

## Combate
| sistema | original | nuestro | estado |
|---|---|---|---|
| Acierto, daño base, armaduras, escudo, combo | combat.cpp ~200-900 | shared/combat.js, rules.js | OK (revisado antes) |
| Crítico y dash | combat.cpp ~222-290, Game.cpp `_iGetAttackType` | combat.js:41-81 | OK |
| Flechas / clima en arco | iCalculateAttackEffect | systems/weather.js | OK |
| Alcance cuerpo a cuerpo 845 (original 3, port 4) | — | combatsys.js | DIFERENTE (menor) |
| Efecto Lucky y zona de lucha ×4/3 en melé | combat.cpp | — | FALTA |
| Magia de área/línea (`Effect_Damage_Spot_DamageMove`) | HG.cpp:18534 | magicsys.js | DIFERENTE (aprox.) |

## Magia
| sistema | original | nuestro | estado |
|---|---|---|---|
| Alcance de lanzamiento (11) | HG.cpp:10241 | magicsys.js (antes 14) | CORREGIDO |
| Clima sobre prob. de éxito | HG.cpp:10317-10323 | magic.js `weatherCast`/`castChance` | CORREGIDO |
| Clima sobre daño (+1 hechizos 10/37/43/51, −1 a 20/30) | HG.cpp:22933 | magic.js `weatherBonus` | CORREGIDO |
| Cancellation: cualquier objetivo, quita también inhibición | HG.cpp:10595-10606 | magicsys.js caso 29 | CORREGIDO |
| Inhibition: sin tirada de resistencia; solo la anula Protect AMP | HG.cpp:10608-10613 | magicsys.js caso 31 | CORREGIDO |
| Resistencia mágica sube al resistir | combat.cpp:54 | magicsys.js `resist()` | CORREGIDO |
| Resistencia al veneno sube al resistir | combat.cpp:69 | magicsys.js caso 17 | CORREGIDO |
| Modo ataque seguro (maná ×1.1) | HG.cpp | — | CORREGIDO (flag `safeAttack` por jugador, comando `safemode`; ver docs/sistemas/magia-original.md) |
| Hold: chequeos de grupo / zona segura | HG.cpp | magicsys.js | CORREGIDO |
| Confuse: área, solo bando contrario | HG.cpp | magicsys.js caso 16 | CORREGIDO |
| Ice: excluir neutrales | HG.cpp | magicsys.js | CORREGIDO |
| Rotura de armadura (ArmorLifeDecrement) | HG.cpp | — | FALTA |
| Resurrection: mismo bando, enfriamiento, consume hechizo | HG.cpp | magicsys.js caso 32, tickResurrection | IGUAL (tests/magic-resurrection) |
| Tipos 4, 6, 20 (Polymorph), 24, 27: sin hechizos en Magic.cfg | Magic.h | — | N/A (no hay datos) |
| Mapa sin ataque (solo Create/Teleport) y magicLimited por mapa | HG.cpp:10255-10260 | magicsys.js cast | IGUAL (tests/magic-types) |
| Reliquias Astoria (evento completo) | Astoria.cpp | — | FALTA (sin mapa ni bandos de evento) |
| Recall (10 s desde el último daño), Summon (tope y bando), Create dynamic | HG.cpp | magicsys.js | verificado (sistema 12; ver ficha) |
| Efectos de objetos: SP cura veneno, WARM, MAGIC (invisibilidad/detectar), CHANGEATTR | HG.cpp:17551-17919 | itemsys.js `useItem`, magicsys.js `castItem` | verificado (sistema 23; pendientes en la ficha) |

## Habilidades
| sistema | original | nuestro | estado |
|---|---|---|---|
| Tabla SSN (hasta 50 = nivel; después nivel²/10) | HG.cpp:15004 | skills.js `ssnTable` | CORREGIDO |
| Multiplicador de uso ×8 / ×2 / ×1 | Skilltypes.h:30, Client.cpp:806 | skills.js `skillMultiplier` | CORREGIDO |
| Maestría total máxima (900) | combat.h MAXSKILLPOINTS, Client.cpp:460 | skills.js | CORREGIDO (700→900) |
| Pesca: sube solo al capturar, cantidad = dificultad del pez | HG.cpp:28214 | systems/fishing.js (+1 por lanzamiento) | DIFERENTE (sistema inventado) |
| Alquimia, minería, fabricación suben por uso | HG.cpp:23682, 24029, 28214 | — | FALTA (sistemas ausentes) |
| Escudo: tirada contra maestría al subir | combat.cpp | combatsys.js | DIFERENTE (parcial) |

## Estadísticas, nivel, regeneración
| sistema | original | nuestro | estado |
|---|---|---|---|
| Max HP/MP/SP, tabla de exp, puntos por nivel | HG.cpp | player.js | OK |
| Regen HP `max(dice(3,vit/3), vit/2)+reserva`, % AddHP | HG.cpp:9938-9955 | vitals.js | CORREGIDO |
| Regen MP `dice(3,mag/3)` | HG.cpp:9978 | vitals.js | CORREGIDO |
| Regen SP `10+dice(4,vit/17)` + bono por nivel | HG.cpp:10010 | vitals.js | CORREGIDO |
| Coste de correr (original: 1 SP/paso) | HG.cpp:1089-1102 | vitals.js `runStepsPerSp` (1 SP/2 pasos a nivel ≤10) | DIFERENTE (decisión del port) |
| Nivel máximo 180 y exp inventada (`giveExp`) | HG.h:196 | tope 50 | DIFERENTE (decisión del port) |
| +50 de oro al subir de nivel | HG.cpp:15052 | sin verificar | DIFERENTE |

## Muerte, PK, objetos, drops, spawns (informe de auditoría, sin corregir)
| sistema | original | nuestro | estado |
|---|---|---|---|
| Pérdida de exp al morir `dice(1, 5·pen·nivel)`, pen 1/3/6/12 según PK; /3 neutral | char/Client.cpp ~840-1391 | combatsys.js `deathPenalty` (25% fijo) | DIFERENTE |
| Pérdida de objetos al morir contra monstruo | PenaltyItemDrop | no existe | FALTA |
| Muerte por jugador (pen 2 al inocente, sin penalidad si neutral/mismo bando) | Client.cpp | combatsys.js:113 | DIFERENTE |
| Cárcel: 180 s bloqueado en mapa de bando | Client.cpp | solo `jailUntil` | FALTA |
| ApplyPKPenalty, exp/oro por matar enemigo | Client.cpp | pk.js | OK |
| Pociones HP/MP/SP, HPSTOCK | HG.cpp:17551-17900 | itemsys.js | OK |
| SpecEffectValue, WARM/FIRMSTAMINAR, SLATES, pergaminos, CHANGEATTR, STUDYMAGIC; SP cura veneno | HG.cpp:17660+ | — | FALTA |
| Probabilidades de drop, bandas 7-9, tablas por nivel, corte 30% débil | HG.cpp:6538, 29315-29990 | drops.js | DIFERENTE |
| Exp por matar: multiplicador de variedad (no original) | HG.cpp NpcKilledHandler | npcsys.js:87 | DIFERENTE (invento del port) |
| `npc.json`: exp, regen 3500, actionTime 2300; spawns 2ndmiddle (11 generadores, máx 15-20) | Config/Npc.cfg, MAPDATA | web/data/npc.json, maps/2ndmiddle.json | DIFERENTE: regenerar datos con `tools/convert_all.py` |
| Generador de spawns: tick 600 ms, 1/3, tope de objetos del mapa; cadáver dura regTime | HG.cpp:2093, 16841 | npcsys.js:106 | DIFERENTE |
| Generador aleatorio de mobs | HG.cpp:15935 | — | FALTA |

Siguientes pasos recomendados (trabajo grande, sesión aparte): regenerar `npc.json` y spawns desde Npc.cfg/MAPDATA; reescribir `deathPenalty`/`penaltyDrop`; drops según `NpcDeadItemGenerator`; efectos de objetos (slates, pergaminos); cárcel.
