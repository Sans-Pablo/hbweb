# Paralyze / Hold Person

Original: `HG.cpp` MAGICTYPE_HOLDOBJECT (~11102): `m_cMagicEffectStatus[HOLDOBJECT] = v4` (1 = Hold Person, 2 = Paralyze), liberación diferida a los `last` segundos; `HG.cpp` ~957: solo impide **andar** (bGetMoveable=FALSE). Atacar y lanzar siguen permitidos.
Golpes (`char/combat.cpp` ~1186 jugador, ~1476 NPC): Hold Person se libera con cualquier golpe; **Paralyze no se libera** (en NPC solo con >50 dados de golpe y 1d10==5).
Código: `combatsys.js releaseHold` (se llama desde `damagePlayer` y `hitNpc`), `magicsys.js` caso 12. Test: `tests/paralyze.test.mjs`.
Antes el port soltaba al NPC paralizado con 1/3 de probabilidad por golpe, sin distinguir tipo.
