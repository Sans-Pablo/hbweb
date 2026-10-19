# Equipo de clase y báculos de escuela (v0.62.0)
Invento del port (no está en el original). Código: `shared/classgear.js` (se aplica en el constructor de `GameData` con `applyGear`, sobre el `Item.cfg` convertido; no se toca `items.json`). Test: `tests/classgear.test.mjs`.
- **Clase por pieza**: `classesOf(d)` mira cabeza/cuerpo/brazos/piernas. Mago: Robe, ChainHose, Wizard/DarkMage Hauberk, Wizard-Hat. Guerrero: placas, cotas, Knight/DarkKnight/SangAh, cualquier casco. Invocador: Leather, ChainHose, Hauberk normal, Wizard-Cap. Camisas, pantalones y piezas Hero (salvo gorro) son libres. La comprobación única es `Inv.equip` (`solo para …`); los bots la ignoran y lo ya equipado no se revisa.
- **Niveles**: `remapLevel` deja ≤30 igual y reparte el resto hasta 50 (`MAX_GEAR_LEVEL`).
- **Báculos**: Ice Wand (861/862, antes BerserkWand), Darkness Staff (865/866, ResurWand), Hero Staff (746). `STAFF_FOR`: Frost→hielo (Tentocle es libre), Liche→oscuridad, Demon→fuego. Sin el báculo en `equip[8]` `toggleCompanion` rechaza y el tick de `npcsys` guarda al summon. Orc y Cannibal-Plant no exigen báculo.
- **Maestros** (ids inventados 9001..9003, mismo sprite que su báculo): nivel 50 (`buyLevel`), 1 de oro, tinte 19..21 (sin halo ni partículas). Solo valen como el báculo de su familia; no dan poder extra. Filas añadidas a la tienda del herrero en `assets.js`.
- **Tintes**: `d.tint` indexa `DYE_RGB` (16..21); lo usan el arma en mano (`appearance.js` → `ap.col.weapon`) y los iconos (`gui.putGame` con clave `ipNN#tinte`).

v0.85.62: los báculos maestros inventados se eliminaron (MASTERS vacío); quedan los de hielo, oscuridad y fuego de Item.cfg.


## v0.85.76 (obs. 33)
`CLASS_GEAR = false` en `classgear.js`: sin restricción por clase (como el original, que solo mira Item.cfg). Poner a `true` reactiva las reglas.
