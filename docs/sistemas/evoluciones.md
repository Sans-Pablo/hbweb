# Evoluciones de compañeros (tabla única)

INVENTO del port. Todo lo que depende de «qué bola evoluciona a cuál» sale de `web/src/shared/systems/evolutions.js` (`CHAINS`). Para cambiar una cadena se edita solo esa tabla.

Campos: `base` (bola normal), `evo` (especie superior, solo en el hospital con la base a nivel 50), `school` (fire|ice|lightning|null), `family` (báculo que exige la superior o null), `look` (aspecto/efectos del renderer), `es`/`en` (ficha).

Cadenas actuales: Orc→Demon (fuego), Tutelary-Angel→Frost (hielo; el sprite del ángel se amplía con `fit` hasta ~90 % de la altura del personaje al nivel 50), Tentocle→Beholder (sin skills ni magia), Skeleton→Liche (rayo), Dark-Elf→Elf-Master, Unicorn→Centaurus, Scorpion→Giant-Crayfish, Guard→Temple-Knight (estas cuatro sin magia, báculo ni habilidad). Cannibal-Plant queda como bola normal.

Quién la lee: `schools.js` (SCHOOL_OF/TIER2), `classgear.js` (STAFF_FOR), `summoninfo.js` (fichas), `i18n.js`, `renderer.js`/`fx.js`/`voice.js`/`bestiario` (`look()`), `talents.fixSupport` (`fixLegacy`: ya no hay especies heredadas).

Añadir una cadena: una línea en `CHAINS`, ambas especies en `SPECIES` (companion.js) y en `npc.json` (`tools/convert_mobs.py` si hay que clonar), y su gusto en `TASTE`. Test: `tests/evolutions.test.mjs`.

## Compra de bolas
`tests/summon-buy-all.test.mjs` recorre `SPECIES`: las evoluciones no se compran; el resto sí (mochila, ficha `infoOf`, invocar y guardar). Tras cambiar `shared/*` hay que reiniciar el servidor online, que si no sigue con el código anterior.

## Nombre visible y tamaños
`NICK`/`shown(sp)` (evolutions.js) dan el nombre que ve el jugador: Tutelary-Angel = «Pixie» (la clave de datos no cambia). El Pixie (`fit` 0.6) flota unos píxeles sobre el suelo. Los compañeros crecen en 3 tamaños (niveles 1, 25 y 50; `companion.SIZE_STAGES`); Unicorn, Dark-Elf y Guard nacen al 85 % (`BIRTH` en `renderer.petScale`).
