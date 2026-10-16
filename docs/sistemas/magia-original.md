# Magia: portado fiel del original (HG.cpp PlayerMagicHandler)

Test por sistema: `tests/magic-safe.test.mjs` (6), `tests/magic-hold-confuse-ice.test.mjs` (7-9), y los que se añadan en cada bloque.

## 6. Modo ataque seguro
- Home alterna `flags.safe` en el cliente y manda `{t:"safemode", on}` → `p.safeAttack` (world.js, `ToggleSafeAttackModeHandler`).
- `manaCost(p, spell, id, fightZone)`: con `safeAttack` y mapa sin zona de lucha el coste se multiplica por 1,1 (entero) antes del ahorro de maná (HG.cpp:10337).
- `pk.js` ya leía `k.safeAttack` (no penalizar al criminal): ahora sí llega a valer algo.
- Desvío documentado: la puerta de ataque por relación (HG.cpp:18143, `GetPlayerRelationship`) no se aplica porque el PvP del port deja pelear también a los viajeros (ver combatsys.js `isFoe`).

## 7. Hold (HOLDOBJECT, HG.cpp:11102)
Contra un jugador no actúa si ya está inmovilizado, si lanzador u objetivo están en casilla segura (iGetAttribute 0x6 → w.safeAt), si son del mismo grupo o si addPR >= 500. Monstruos: magicLevel >= 6 o ya inmovilizado. Desvío: la regla del mismo bando en mapas de bando sin cruzada no existe en el port (no hay mapas de bando/cruzada).

## 8. Confuse (HG.cpp:11337)
Efecto de área (v2 x v3 alrededor del objetivo), solo jugadores; salta a los de su propio bando (m_side == caster->m_side, viajeros entre sí incluidos) y a los ya confundidos; el resto tira resistencia mágica.

## 9. Ice (HG.cpp:11517)
Un jugador neutral (IsNeutral, side 0) no recibe daño ni hielo. Los demás jugadores (con canFight) se congelan además de los monstruos.

## 10. Resurrection (HG.cpp:10416, 38015, 2290)
- Lanzar (magicsys.js caso 32): el objetivo es el jugador caído de la casilla. Si el lanzador no es GM: bando distinto o `specialAbilityTime != 0` → sin efecto; si no, `specialAbilityTime = 1200` (SPECABLTYTIMESEC, Client.h:34) y `magic[94] = 0` (el hechizo se gasta). El objetivo queda `beingResurrected` y recibe `resurrectask`.
- El cliente muestra el cuadro del original (dialog 50, Game.cpp:42315): «Someone intends to resurrect you. Will you revive here?»; manda `{t:"resurrect", accept}`.
- `answerResurrect`: rechazar limpia la petición; aceptar sin petición se rechaza (el original expulsa); aceptar revive en el mismo sitio con HP = maxHp/2.
- `tickResurrection` (cada segundo): baja la espera (el original resta 3 cada 3 s); con varita ResurWand (865/866) en la mano derecha, Int>=100 y Mag>=100 y espera 0 devuelve el hechizo; sin varita (si venía de ella) lo quita (HG.cpp:2290, 7973, 9502).
- `specialAbilityTime` se guarda con el personaje (HG.cpp:4147). Protocolo: NET_PROTO 12.

## 11. Tipos de magia, mapas sin ataque y magicLimited (HG.cpp:10255-10260, 10451, Magic.h)
- Enum del original (Magic.h:32): 1 daño puntual … 8 teleport, 9 summon, 10 create, 11 protect, 12 hold, 13 invisibility, 14 create-dynamic, 15 possession, 16 confuse, 17 poison, 18 berserk, 19 linear, **20 polymorph**, 21 area sin punto, 22 tremor, 23 ice, 25 area sin punto, 26 …, 28 armor break, 29 cancellation, 30 ice linear, 31 inhibition, 32 resurrection, 33 scan. El port usa los mismos números.
- Tipos 4, 6, 24, 27 (y 34) no tienen ningún hechizo en Magic.cfg ("unused"/"no spells" en Magic.h); **Polymorph (20) tampoco tiene hechizo**: el código del original solo se alcanza con un ítem/hechizo que no existe en los datos, así que no hay nada que portar (si Magic.cfg lo añade, habría que escribir el caso: estado = v[TYPE], `m_sType=18`, fin tras `last` segundos, Cancellation lo quita).
- Mapa con ataque desactivado (`m_bIsAttackEnabled == FALSE`, aquí noAttack con -10 = todo el mapa): solo se lanzan Create (10) y Teleport (8); los GM quedan exentos. `magicLimited` (meta.magicLimited, lista de ids) veta el hechizo en ese mapa, GM exento. Implementado en `magicsys.cast`. Test: `tests/magic-types.test.mjs`.
- Reliquias de Astoria (Astoria.cpp): es el evento completo de captura de reliquia (mapa astoria, bandos, altares, victoria a los RELICVICTORYTIME). El port no tiene mapa Astoria ni bandos de evento: **fuera de alcance**, queda en ESTADO como pendiente.

## 12. Recall, Summon y Create dynamic (HG.cpp:10908-11012, 11228-11305)
Test: `tests/magic-summon-recall.test.mjs`.
- **Recall**: exige más de 10 s sin recibir daño (`m_lastDamageTime`, `p.lastDamage`, que `damagePlayer` actualiza) salvo GM; si no, `nomagic` (NOTIFY_CANNOTRECALL).
- **Summon Creature**: el objetivo debe ser un jugador del mismo bando; no en zona de lucha; tope magia/20 seguidores salvo GM (`summonFor(..., nolimit)`).
- **Diferencias documentadas**: el original invoca en la casilla del objetivo (el port, en un rectángulo 5x5 alrededor del lanzador); el radio de Create-dynamic usa el mapeo propio del port (la variante cfg tiene una columna v12 extra y H/2 dejaría Fire-Wall en una casilla); no existe restricción de mapas laterales/cruzada (no hay sideMap); el botón propio de Recall del port (canal 3 s, enfriamiento 60 s) sigue vigente.
