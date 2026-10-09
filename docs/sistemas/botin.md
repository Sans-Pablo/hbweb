# Botín por nivel, únicos de rey y rareza

Propio del port (la tabla base sigue siendo `NpcDeadItemGenerator`, `shared/drops.js`). Tests: `tests/loot.test.mjs`, `tests/bossloot.test.mjs`.

## Escala con la profundidad (`depth` = nivel de la cripta; 0 fuera)
- Probabilidad de oro: `6000 − 100·nivel` sobre 10000 (mínimo 3500): más equipo cuanto más hondo.
- Nivel de generación efectivo: `max(gen del monstruo, 1 + ceil(nivel/2.2))`, tope 10 (tablas MELEE/ARMOR existentes).
- `rollAttributes(..., bonus = floor(nivel/5))`: el valor es la mejor de `1+bonus` tiradas y el segundo atributo sale con umbral `6000 − 400·bonus`.

## Únicos de rey (siempre, 1 por rey, objetos reales de Item.cfg, IDs sin tocar)
| Rey | Objetos |
|---|---|
| 1 carmesí (fuego) | 645 NecklaceOfEfreet, 638 KnecklaceOfFirePro |
| 2 umbrío | 633 RingofDemonpower, 648 NecklaceOfLiche |
| 3 glacial | 643 KnecklaceOfIceEle, 642 KnecklaceOfIcePro |
| 4 dorado | 631 RingoftheAbaddon, 735 RingofDragonpower, 860 NecklaceOfXelima |

Caen junto al cadáver (`uniqueSpot`) a los 0,6·morir + 200 ms. Fuente: `shared/rarity.js` (`BOSS_UNIQUE`).

## Protección elemental (ADDEFFECT 7 luz, 9 fuego, 10 hielo, 11 veneno)
`inventory.js recalc` → `p.eff.prot[elem]` (tope 90 %). `damagePlayer(w,p,dmg,from,elem)` reduce el daño. Elementos aplicados: campos FIRE/FIRE3 (fuego), ICESTORM (hielo), PCLOUD (veneno), `explode` (fuego), brasas del rey carmesí (fuego). Protección al hielo ≥ 50 = inmune a la ralentización de la escarcha del rey glacial.

## Rareza visible
`rarityOf(id, attr)`: 0 normal, 1 mágico (algún atributo), 2 raro (dos atributos con suma ≥12 o valor ≥10), 3 único. Colores `RARITY_COLOR` (blanco, azul, dorado, naranja). Objetos raros/únicos en el suelo: etiqueta siempre visible + rayo de luz; el evento `drop` de botín lleva `r` y `attr` (solo del botín de monstruos) → registro «¡Objeto único!/raro!» y sonido (E12 / E30) si estás a ≤14 casillas.
