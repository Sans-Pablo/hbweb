# Mass Ice-Strike y Paralyze (v0.85.84)
Petición: «el mass ice no remueve el paralize; revisa los originales».
Original: HG.cpp Effect_Damage_Spot (~18307/18456/18834/18917): todo hechizo de daño pone `m_cMagicEffectStatus[MAGICTYPE_HOLDOBJECT] = NULL` y `RemoveFromDelayEventList(..., MAGICTYPE_HOLDOBJECT)` (jugadores y monstruos, Hold Person y Paralyze). Mass Ice-Strike usa esos caminos (DAMAGE_AREA_NOSPOT, ~10802). Solo la tormenta de hielo (campo, ~19451) suelta únicamente Hold Person.
Port: `damagePlayer` excluía todo `elem === "ice"`; ahora solo el campo (`from.field`, fields.js). Monstruos ya soltaban (`releaseHold` con skill null).
Test: tests/paralyze.test.mjs.
