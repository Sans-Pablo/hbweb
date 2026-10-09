# Compañeros (clase Cazador)
Invento del port (el original no los tiene). Código: `shared/systems/companion.js` + `npcsys.js` (spawn/seguimiento) + `itemsys.js` (usar bola). Test: `tests/companion.test.mjs`.
- **Bola**: instancia de GreenBall..PearlBall (Item.cfg 651–655) con `inst.comp = {sp, lvl, exp, on}`; peso 1. Se guarda en mochila/almacén/save (`comp`), y `p.hunt` guarda los contadores.
- **Obtención**: `onKill` cuenta muertes del jugador por especie (`SPECIES`: 500–1000 en la versión final). Build de pruebas: `HUNT.kills = 10` (null = tabla); `?hunt=N` divide más.
- **Uso**: `use` sobre la bola → `toggleCompanion` (elige+invoca / guarda). Summon Creature con bola elegida invoca siempre esa especie (`spawnCompanion`). Tirar o depositar la bola lo guarda. `Adventure.transfer` lo re-invoca en el mapa nuevo. No caduca ni cuenta para magery/20.
- **Stats compartidas**: daño = `avgHit(dueño) × share`, `share = min(0,5, (0,15 + 0,01·nv) × (0,85 + 0,03·rango))`; vida = `maxHp × min(0,8, 0,3 + 0,01·nv)`. Se refresca cada decisión (`refreshCompanion`).
- **Experiencia**: 25 % de la del dueño en cada muerte propia; 50 % de `exp/3` del monstruo en las suyas. Curva `30·nv^1,7`. Tope: nivel del dueño (máx. 60).
- Cliente: `compicon.js` (sprite pequeño sobre la bola), `hud.describeBall` (tooltip), eventos `ball`, `companion`, `companion-lvl`.
- **Aggro**: los monstruos eligen el más cercano entre jugador y compañero (`npcThink`); el compañero hiere y atrae al monstruo (`followerAttack`). `companionStruck`: vida y defensa del compañero; al caer, `penalize` (25 % de `need(lvl)`, baja de nivel si no alcanza) y vuelve a la bola. Los demás seguidores (hechizo) siguen sin ser objetivo.
- **Muerte del jugador**: `combatsys.deathPenalty` (25 % de la exp. del nivel; baja nivel y puntos; no en zona de lucha).
- **Voz**: `voice.json` sección `companion` (generada por `tools/mkvoice_companion.py`); `voice.js talkPet/onPetEvent`.
- **Bola**: color por especie = complementario del sprite (`compicon.drawBall`), 15 % más grande; al recogerla conserva `comp` (evento `pickup.comp`); `addToBag` borra la x,y del suelo.
- Pendiente: habilidades por especie; compañero en multijugador (snapshot).
- **Hospital** (v0.12.0): NPC «Gail» (`role "pethospital"`, junto al inicio de Aresfarm y en Aresden 142,52; ficha y sprite originales sin uso). Órdenes `petbuy` (bola de cualquier especie, 1 de oro, solo pruebas), `petheal` (cura 2 de oro por punto de vida; revivir `reviveCost` = (1500+400·nv)·(1+0,15·rango)). Cliente: cuadro 41 en `npcdialogs.js`.
- **Caído**: `inst.comp.down` (no se puede invocar); la vida viaja en `comp.hp` y se recupera 2 % cada 6 s a los 8 s sin recibir daño.
- **Modo y objetivo**: `comp.mode` `attack`|`peace` (`petmode`, clic en el símbolo del compañero junto al de combate); `pettarget` (Ctrl+Q sobre un monstruo) fija `pet.cTarget`, que se ataca aunque esté en paz.
- **HUD**: `gui.petPanel` (miniatura que se vacía de arriba abajo, símbolo ATQ/PAZ, barra con nombre/nivel/vida). Compañeros más altos que el personaje se dibujan a la mitad de su altura (`renderer.petScale`).
- Test: `tests/pets.test.mjs` (también cubre los manuales de habilidad, `STUDYSKILL` en `itemsys.js`).
