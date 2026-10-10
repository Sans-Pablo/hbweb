# Dummy (summon de apoyo único)

INVENTO del port (no existe en el original). Usa el NPC `Dummy` de NPC.cfg y los hechizos de Magic.cfg. Código: `shared/systems/dummy.js`, talentos en `talents.js`, ficha del compañero en `companion.js`.

- **Único**: es una bola de compañero (Gail la vende como las demás); solo hay un compañero activo, así que llevar un Dummy es jugar de apoyo.
- **Frágil**: vida `6 + 1,2 × nivel` (66 al nivel 50). No ataca. Los monstruos cercanos lo prefieren (reflejo de agro: la distancia cuenta la mitad) y él avisa con un bocadillo (12 s entre avisos).
- **Clases** (la primera magia fija la clase; reiniciar talentos cuesta oro): Healer (verde: Heal, Great Heal), Buffer (amarillo: Defense Shield, Great Defense Shield, Protection From Magic, Berserk), Aura (azul: regeneración de vida, experiencia, defensa, maná). Cada rango potencia la magia; las avanzadas piden nivel.
- **Área**: radio 1 al nivel 1 → 6 al 50 (Chebyshev). Se dibuja el cuadro del área en el suelo. Modo Stay/Follow con el botón de modo.
- **Solo grupo**: dueño, miembros de su party y los compañeros de todos.
- **Auras**: % proporcional al nivel y al rango (nivel 50, rango 5: vida 3 %/s, maná 2 %/s, exp +25 %, daño recibido -20 %). Se renuevan cada segundo a quien esté dentro.
- **MASS** (talento de nivel 30, 60 s de recarga): Healer = Great Heal a todo el grupo; Buffer = todos sus buffs a todo el grupo; Aura = auras x2 durante 20 s. Ignora el radio (mismo mapa).
- Estado `pfm` (Protection From Magic): reduce el daño elemental/mágico recibido.
- Test: `tests/dummy.test.mjs`.

## 0.36.0 — Vampiric Aura y Resurrection (Dummy de aura)
- `dvamp` (nivel 25, 5 rangos): `AURA_PER_LEVEL.dvamp = 0,16` → hasta 8 % del daño que hace el aliado (dentro del radio) vuelve como vida (`damageNpc`, `auraVamp`).
- `dres` (nivel 40, 3 rangos, Magic.cfg 94): si un jugador del grupo está caído a ≤ radio+2, el Dummy gasta 200 de maná, lo levanta con 40 % + 10 %/rango de vida y emite `respawn`/`resurrected`. Recarga 180 s − 40 s por rango extra.
- Test: `tests/dummy.test.mjs` («OK dummy vamp/res»).
