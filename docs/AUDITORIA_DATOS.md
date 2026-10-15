# Auditoría de datos y sistemas vs el original (v0.85.9)

Comparación automática: `node tools/audit_datos.mjs [carpeta_config] [--verbose] [--json f]` contra
`HelbreathOriginal/Helbreath.ServerFiles/Config` (ver `docs/ORIGINAL.md`). Las diferencias conocidas están congeladas en
`docs/auditoria_baseline.json`; `tests/original-data.test.mjs` falla si aparece una **nueva** o si desaparece un ítem/teleport original.
Aceptar un cambio deliberado: `node tools/audit_datos.mjs --json docs/auditoria_baseline.json`.

## Hallazgo principal
Nuestras tablas (`web/data/items.json`, `npc.json`, `magic.json`) se generaron desde la build `/root/HelbreathServer`, que **no es idéntica**
a la copia local del original: precios, durabilidades y algunos IDs difieren. No se corrigen en bloque (cambiaría balance, partidas guardadas
e IDs; regla 1 prohíbe renumerar). Quedan clasificadas aquí y congeladas por el test.

## Tablas
| Sistema | Original | Nuestro | Estado |
|---|---|---|---|
| Items (`Item*.cfg`) | 609 | 680 (609 + propios ≥1000/extra); 0 faltan | DIFERENTE: 558 IDs coinciden en nombre; 42 con ID/nombre distinto (637-644 `Necklace…`→`Knecklace…`, bloque 700-760 con otro orden: DK/DM/SangAh); 487 filas con algún campo distinto, 279 en `price` (nuestros +1 y armas suben, bolsas de botín `type 5→0` y precio ⅓), 93 en v2/v5 (dados), 48 en `maxLife` |
| NPC (`Npc.cfg`) | 135 | 63 (+7 propios) | DIFERENTE: 83 con campos distintos. Patrón uniforme intencionado: `actionTime` −200 y `regenTime` 3500→5000 / 4500→10000 (remaster); 20 NPC de guerra/pixies/Ghost/Vampire/Barlog/Abaddon/Princess/gates FALTAN (docs/DESVIOS.md) |
| Magias (`Magic.cfg`) | 67 | 65 | DIFERENTE: faltan #3 GM-Kill y #4 Mass-GM-Kill (solo GM); nombres con espacio en vez de guion (cosmético); `Cost` es otra escala (1 → 100…1000, precio de aprendizaje propio, no se compara); ~22 con dados/alcance distintos (Energy-Bolt, Fire-Ball, Chill-Wind, Meteor-Strike, Blizzard…) y 4 con `type` o duración distintos (Paralyze 15→50, Illusion-Movement, Scan, Earthworm) = balance de `docs/magias_diseno` |
| Teleports (`Teleport.cfg`) | 16 | 16 | OK (mismo número; nombres de mapa en vez de índice) |
| Skills (`Skill.cfg`) | 24 | sin tabla propia (`skills` en código) | A VERIFICAR: sin comparación automática |
| Quests (`Quest.cfg`) | 151 | 22/clase propias | DIFERENTE (➕ sistema propio) |
| Crafting (`BuildItem/CraftItem/Potion.cfg`) | sí | `artesanos` propios | DIFERENTE (🟡) |
| Mapas | 85 | 41 | DIFERENTE (⏸ ver DESVIOS) |
| Tiendas | por NPC | `shops.json` (existencia de ítems validada en `data.test.mjs`) | OK coherencia; precios heredan la diferencia de Items |
| Drops | `DropConfig.cpp` | `drops.js` | DIFERENTE (🟡, héroes por bono de armadura) |
| Guerra/Crusade/Heldenian, bandos | sí | no | FALTA (❌ DESVIOS) |
| Party, trade, banco, gremio, amigos | sí | presentes (`trade.js`, banco, party) | OK (verificados por `tests/*.test.mjs` y `net-*.test.mjs`) |
| Pets / summons / granjas / criptas | no existen | propios | ➕ |
| Clima / día-noche, sonido y música por mapa | sí | recreado | DIFERENTE (⏸ rediseño aplazado) |

## Decisión y pendientes
- No se modifican datos generados: cualquier alineación con la copia local exige decidir qué build manda (balance ya probado por testers) → pendiente de decisión del propietario.
- Alinear primero lo seguro: IDs 637-644 (solo nombre) y Paralyze/Illusion si se confirma el balance; añadir tabla de Skills y comparación de `BuildItem/CraftItem`.
