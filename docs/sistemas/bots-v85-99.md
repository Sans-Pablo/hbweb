# Bots v0.85.99 (obs. 70, 95–106)
- #99 `cheapest` (botmagic.js): sin Magic Missile si el mago conoce otro ataque; Paralyze a monstruos solo si maxHp >= MINOR_HP (150).
- #103/#104 `sameCity`: mismo `side` >0 fuera de `fightZone` → ni hechizos ni Detect Invisibility ni cuenta como enemigo.
- #70 bot.js: magos compran/equipan Wizard-Hat (Mag 130) o Wizard-Cap (Mag 110) según nivel y requisitos.
- #95/#100 `potionUseful` con umbral 1.3x y tope de pociones de maná; sin pociones con maná lleno; recall a comprar.
- #98/#101/#102 stats y kits (builds.js, residents.js): Marek Str 40, magos sin escudo de torre/yelmo alado, Horned-Helm antes que FullHelm, martillo/giant sword a 160 Str.
- #106 `sellExtra`: vender/guardar solo en ciudad; con carga >=75 % o mochila >=30 el bot vuelve a la ciudad (cooldown 120 s).
- #97 `readyToHunt`: sin armadura caza solo presas fáciles tras 3 intentos y compra al volver.
- Aproximaciones: #106 no recorre a pie tienda/herrería; el bucle de learn y Aresfarm (61,77) no eran fallos reproducibles.
Test: tests/bot-v85-99.test.mjs.

## Simulación (tools/sim-bots-v85-99.mjs, 40 residentes nv140, 12000 ticks = 10 min, semillas 11 y 23)
| Medida | s11 | s23 |
|---|---|---|
| Magic Missile con otro ataque conocido (#99) | 0 | 0 |
| Paralyze a monstruo menor (#99) | 0 | 0 |
| Detect Invisibility a vecino de ciudad (#103) | 0 | 0 |
| Hechizos a vecinos de ciudad (#104) | 52 | 27 |
| Pociones de maná usadas / con maná lleno (#100) | 431 / 0 | 384 / 0 |
| Magos con Wizard-Hat/Cap | 6 de 18 | 6 de 18 |
| Viajes a ciudad desde campo/cripta (#106) | 39 | 32 |
| Bots quietos >=60 s | 12 | 15 |
- Los hechizos a vecinos son apoyo (Berserk, PFM, AMP, Great Heal) y Fire Field para quitar una parálisis a un aliado: intencionado (`friend`).
- Quietos: granjeros/pescadores trabajando y bots en tiendas. CORRECCIÓN (0.85.100): lo de «Ivo, Petra y Quill parados en la entrada de la cripta» fue una falsa alarma: eran pescadores/apoyo en la granja (ver bots-v85-100.md).
- Sin medir: ventas concretas (#106) ni almacén.
