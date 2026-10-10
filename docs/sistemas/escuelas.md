# Escuelas de magia de los summons (INVENTO del port)

Código: `shared/systems/schools.js`; integración en `magicsys.js` (`usable`, `resolve`), `talents.js` (`maxMp`, `regen`, `isSchool`), `companion.js` (`tradeUp`, `candy`, `SPECIES`).

| Escuela | Especie | Especie superior (nv 50) |
|---|---|---|
| Fuego | Orc (rojo) | Demon |
| Hielo | Tentocle (azul) | Frost |
| Rayo | Cannibal-Plant (celeste) | Liche |

- Un hechizo pertenece a una escuela si su tipo es ofensivo (1,3,14,19,21,22,23,25,26,28,30) y su atributo en Magic.cfg es 3 fuego, 4 hielo, 2 rayo. Tierra (1) y sin elemento (0) no tienen escuela.
- El jugador lo tiene en el libro y lo lanza normal (animación, probabilidad, daño con su Mag), pero `usable` exige el summon de la escuela fuera y con maná. Paga el summon (`n.mp`, guardado en `comp.mp`); el evento `spell` sale con el id del summon. Daño × Frenzy × (1 + 1 %/nivel) × 1,25 si es especie superior.
- Maná: `maxMp` ×2 en escuelas (×1,6 más en la superior). Sin regeneración natural; el caramelo azul (781, 4d8+200) lo recupera, también con la bola guardada. El maná viaja con la bola (no se rellena al reinvocar).
- Apoyo (tipos 2, 11, 18: curar, escudos, berserk) → solo Dummy. Summons normales: sin talentos de hechizo (combate únicamente).
- Cambio (`petup`, hospital): nivel 50, vivo y guardado → bola nueva nivel 1 de la especie superior con el mismo nombre. Stats ×1,5 vida, ×1,25 daño, ×1,6 maná. Demon/Frost/Liche no se compran (`buyBall`).
- `MAGIC_MODE.schools` (true en el juego) lo apagan las pruebas del sistema base.
- Test: `tests/schools.test.mjs`.

## 0.36.0 — estilo comando y nivel
- `unlockLevels/spellLevel` (schools.js): nivel del summon que pide cada magia (reparto 1–50 por maná; ×0,8 en la especie superior). `levelPower`: ×0,6 → ×1,4.
- `usable`: solo magias de escuela (cualquier otra se rechaza) y con nivel suficiente. `cast` → `command()`: el summon se gira, hace el gesto de ataque y emite `dummy-cast` con el nombre.
- Libro (`dialogs.js`): filtra por la escuela de la bola elegida; gris «(Lv N)» si el summon aún no la domina.
- Maná en pantalla: `petPanel` (barra azul), `partyFrames` (miembros y summons). Red: `pub()` envía `mp`/`mm` (NET_PROTO 4).
