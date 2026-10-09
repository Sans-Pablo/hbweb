# Compañeros (clase Cazador)
Invento del port (el original no los tiene). Código: `shared/systems/companion.js` + `npcsys.js` (spawn/seguimiento) + `itemsys.js` (usar bola). Test: `tests/companion.test.mjs`.
- **Bola**: instancia de GreenBall..PearlBall (Item.cfg 651–655) con `inst.comp = {sp, lvl, exp, on}`; peso 1. Se guarda en mochila/almacén/save (`comp`), y `p.hunt` guarda los contadores.
- **Obtención**: `onKill` cuenta muertes del jugador por especie (`SPECIES`: 500–1000). `HUNT.scale` (URL `?hunt=N`) reduce el umbral para pruebas.
- **Uso**: `use` sobre la bola → `toggleCompanion` (elige+invoca / guarda). Summon Creature con bola elegida invoca siempre esa especie (`spawnCompanion`). Tirar o depositar la bola lo guarda. `Adventure.transfer` lo re-invoca en el mapa nuevo. No caduca ni cuenta para magery/20.
- **Stats compartidas**: daño = `avgHit(dueño) × share`, `share = min(0,5, (0,15 + 0,01·nv) × (0,85 + 0,03·rango))`; vida = `maxHp × min(0,8, 0,3 + 0,01·nv)`. Se refresca cada decisión (`refreshCompanion`).
- **Experiencia**: 25 % de la del dueño en cada muerte propia; 50 % de `exp/3` del monstruo en las suyas. Curva `30·nv^1,7`. Tope: nivel del dueño (máx. 60).
- Cliente: `compicon.js` (sprite pequeño sobre la bola), `hud.describeBall` (tooltip), eventos `ball`, `companion`, `companion-lvl`.
- Pendiente: que los monstruos puedan atacar al compañero; habilidades por especie; compañero en multijugador (snapshot).
