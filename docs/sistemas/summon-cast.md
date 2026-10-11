# Casteo de los summons de escuela

- El summon activo (bola con `comp.on`) lanza la magia de su escuela (Orc/Demon fuego, Tentocle/Frost hielo, Cannibal-Plant/Liche rayo); gasta SU maná y el servidor comprueba nivel y maná del summon (`magicsys.js`).
- A nivel 50 (`max`) el casteo dura 1700 ms con un efecto en el suelo (`renderer.castCircle`): círculo para la mayoría, nova de hielo (Frost) y erupción de lava (Demon).
- Las áreas (Blizzard…) no dañan a los summons propios ni a los del grupo (`tgt.master === p.id`).
- Cambiar de summon activo reinicia la magia elegida para F4 (`hud.renderBook`, `ballUid`).
- Las órdenes al summon (ir a / atacar) dibujan una línea de puntos (`renderer.drawPetOrder`).
- Tests: `regress-0506.test.mjs`, `regress-0507.test.mjs`, `pvp.test.mjs`.
