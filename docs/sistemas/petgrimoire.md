# Grimorio de summons (v0.82.0)

Sistema **aparte** de la magia del jugador. La magia del jugador es la original de Helbreath (`systems/magicsys.js`, comando `cast`, libro con círculos, aprender en la tienda, maná del personaje). Los hechizos de los summons no pasan por ahí.

## Piezas
- `shared/systems/petgrimoire.js` — reglas: catálogo por escuela (fuego/hielo/rayo), nivel de summon, Int y oro para enseñar, coste de maná, potencia por nivel, `teach` y `cast`.
- Comandos (world.js): `pgteach {spell, npc}` (enseñar; exige estar junto al NPC) y `pgcast {spell, x, y}` (el summon activo lanza desde **su** maná).
- Estado: `comp.grim` (ids aprendidos) en la bola del summon. Antes `comp.spells`; la evolución copia `grim`.
- NPC «Hechicero de mascotas» (`role: "petmage"`, skin Gandlf) en elvfarm y gshop_1f (`citizens.js`).
- Cliente: `client/petmage.js`, diálogo 46 con pestañas **Enseñar** y **Grimorio**; elegir un hechizo del grimorio activa el apuntado (`ui.petPointing`), clic izquierdo lanza, derecho cancela. No usa F4 ni el libro del jugador.
- Eventos: `pglearned` (solo propio), `dummy-cast` (público, el efecto visual del lanzamiento).
- `schools.js` queda con datos (multiplicadores y tablas); `arena.js`, `residents.js` y `summoninfo.js` usan `PG.*`.

## Tests
`tests/petgrimoire.test.mjs` (enseñar, lanzar, maná, NPC) y `tests/petgrimoire-all.test.mjs` (todas las escuelas y especies).
