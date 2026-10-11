# Diseño de evoluciones de summons (propuesta)

Complementa `DISENO_SUMMONS.md`. Datos de `web/data/npc.json` (NPC.cfg). Sustituye las especies superiores propuestas allí, que no tenían en cuenta el elemento nativo de cada mob (por ejemplo, Giant-Lizard es de hielo).

**Actos:** cada tier va unido a un acto del jugador (1–50, 50–100, 100–150, 150–180, 180+); ver [ACTOS.md](ACTOS.md), que también reserva poderes y mejoras por acto.

## 1. Cómo funciona hoy y qué cambia

- Hoy hay **una** evolución: al nv 50 el summon vivo y guardado se cambia en el hospital por la especie superior a nv 1 (`TIER2` en `schools.js`).
- El poder del summon sale del **jugador** (`statsOf`: vida = maxHp del dueño × factor, daño = golpe medio × cuota) y de un rango de especie. Los hitDice del mob no se usan. Por eso las líneas se pueden armar por tema sin que un mob débil quede roto.
- Propuesta: generalizar `TIER2` a una **cadena** (`EVOLVE = {Orc: "Hellbound", Hellbound: "Cyclops", …}`), con `tier` 1 a 5 guardado en la bola y multiplicadores por tier. Cada evolución repite la regla actual (nv 50, vivo, guardado → bola nueva nv 1, mismo nombre).

## 2. Líneas evolutivas (cada mob aparece en una sola)

| Línea | Escuela de magia | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---|---|---|---|---|---|---|
| Fuego | Fuego | Orc | Hellbound | Cyclops | Demon | Fire-Wyvern o Tigerworm (apex) |
| Hielo | Hielo | Tentocle | Ice-Golem | Frost | Giant-Lizard | Wyvern (apex) |
| Rayo | Rayo | Giant-Plant | Cannibal-Plant | Beholder | Liche | Centaurus |
| Tierra | Tierra | Stone-Golem | Clay-Golem | Mountain-Giant | Ettin | Minotaurs |
| Veneno / Pantano | Veneno | Amphis | Scorpion | Giant-Frog | Giant-Crayfish | Claw-Turtle |
| Control | Control | Skeleton | Zombie | Stalker | Gagoyle | Hellclaw (apex) |
| Ilusión y Sigilo | Ilusión | Cat | Dark-Elf | MasterMage-Orc | Nizie | — |
| Sustento | Sustento | Rabbit | Rudolph | Unicorn | — | — |
| Bestia | Sin magia (daño físico) | Slime | Giant-Ant | DireBoar o Troll (rama) | Orge | WereWolf |
| Asedio (Cruzada) | Sin magia (físico y área) | Light War Beetle | Battle Golem | Babarian | Catapult | Heavy Battle Tank |
| Dummy Healer | Dummy | Dummy | Scarecrow | Temple Knight | TPKnight | God's Hand Knight |
| Dummy Buffer | Dummy | Dummy | Sorceress | — | — | — |
| Dummy Aura | Dummy | Dummy | Mana Collector (inmóvil) | — | — | — |

Las filas de Asedio y Dummy usan mobs de Cruzada del original (`Npc.cfg` completo, 135 NPC; el `npc.json` del port solo tiene 56). Detalle, estado de sprites y descartes en [ACTOS.md](ACTOS.md) sección 3. Ilusión T5 pasa a DarkKnight.

"Hasta 4 evoluciones" = hasta 5 formas. Fuego, Hielo, Rayo, Tierra, Veneno, Control y Bestia llegan a 4 evoluciones. Ilusión tiene 3 y Sustento 2, para que no todas las líneas sean iguales.

Los apex (Fire-Wyvern, Tigerworm, Wyvern, Hellclaw) son jefes de mapa. Conviene que su evolución exija un ítem raro que dejen ellos, no solo nivel 50.

## 3. Progresión por tier

| Tier | Vida | Daño | Maná | Nivel que pide cada magia | Magias que gana | Coste de evolucionar |
|---|---|---|---|---|---|---|
| 1 | ×1,0 | ×1,0 | ×1,0 | 100 % | Las 3 primeras de la escuela | — |
| 2 | ×1,4 | ×1,2 | ×1,6 | 80 % | Las del medio | Oro + piedra de evolución común |
| 3 | ×1,9 | ×1,45 | ×2,4 | 65 % | Las de área | Oro + piedra de evolución rara |
| 4 | ×2,5 | ×1,7 | ×3,4 | 50 % | Las avanzadas | Oro + piedra rara + ítem de jefe de zona |
| 5 | ×3,2 | ×2,0 | ×4,5 | 40 % | Las máximas (Meteor, Blizzard, Earth Shock Wave, etc.) | Oro + ítem de jefe apex |

Los valores del tier 2 son los que ya usa el juego (1,5 / 1,25 / 1,6, redondeados). Los demás son un punto de partida para ajustar en pruebas.

Cada evolución:
- Reinicia el nivel a 1, pero conserva el nombre y las magias ya enseñadas.
- Mantiene el maná que se recupera con caramelos.
- Las magias del libro del summon se heredan al evolucionar.

## 4. Mobs que no son summon

Ciudadanos y guardias (ShopKeeper-W, Gandlf, Howard, Tom, William, Kennedy, Gail, McGaffin, Perry, Devlin) y Crops. Dummy tiene su propio árbol.

## 5. Listado completo del NPC.cfg (ordenado por vida)

| Mob | Vida (hitDice) | Daño | Alcance | Mag. nv / maná | Elemento | Línea propuesta |
|---|---|---|---|---|---|---|
| Slime | 2 | 1d4 | 1 | 0 / 0 | Neutro/Tierra | Bestia (combate puro) #1 |
| Giant-Ant | 3 | 2d3 | 1 | 0 / 0 | Neutro/Tierra | Bestia (combate puro) #2 |
| Amphis | 4 | 2d4 | 1 | 0 / 0 | Neutro/Tierra | Veneno / Pantano #1 |
| Orc | 4 | 3d3 | 1 | 0 / 0 | Neutro/Tierra | Fuego #1 |
| Rabbit | 4 | 1d5 | 1 | 0 / 0 | Neutro/Tierra | Sustento #1 |
| Cat | 4 | 2d4 | 1 | 0 / 0 | Neutro/Tierra | Ilusion y Sigilo #1 |
| Scorpion | 6 | 5d3 | 1 | 0 / 0 | Neutro/Tierra | Veneno / Pantano #2 |
| Skeleton | 8 | 5d4 | 2 | 0 / 0 | Neutro/Tierra | Control (no-muertos) #1 |
| ShopKeeper-W | 10 | 1d1 | 1 | 0 / 0 | - | No summon (ciudad / guardia / objeto) |
| Gandlf | 10 | 1d1 | 1 | 0 / 0 | - | No summon (ciudad / guardia / objeto) |
| Howard | 10 | 1d1 | 1 | 0 / 0 | - | No summon (ciudad / guardia / objeto) |
| Tom | 10 | 1d1 | 1 | 0 / 0 | - | No summon (ciudad / guardia / objeto) |
| Zombie | 10 | 4d4 | 1 | 0 / 0 | Neutro/Tierra | Control (no-muertos) #2 |
| Dummy | 10 | 0d0 | 1 | 0 / 0 | Rayo | Apoyo (árbol propio) |
| William | 10 | 1d1 | 1 | 0 / 0 | - | No summon (ciudad / guardia / objeto) |
| Kennedy | 10 | 1d1 | 1 | 0 / 0 | - | No summon (ciudad / guardia / objeto) |
| Gail | 10 | 1d1 | 1 | 0 / 0 | - | No summon (ciudad / guardia / objeto) |
| Stone-Golem | 25 | 7d4 | 1 | 0 / 0 | Neutro/Tierra | Tierra #1 |
| Clay-Golem | 30 | 7d4 | 1 | 0 / 0 | Neutro/Tierra | Tierra #2 |
| Hellbound | 35 | 7d5 | 1 | 5 / 250 | Fuego | Fuego #2 |
| Giant-Frog | 35 | 7d5 | 2 | 0 / 0 | Neutro/Tierra | Veneno / Pantano #3 |
| Rudolph | 40 | 7d5 | 1 | 5 / 0 | Fuego | Sustento #2 |
| Troll | 55 | 8d5 | 1 | 0 / 0 | Neutro/Tierra | Bestia (combate puro) #3 |
| Cyclops | 60 | 8d6 | 3 | 5 / 450 | Fuego | Fuego #3 |
| Ice-Golem | 60 | 8d6 | 1 | 11 / 0 | Hielo | Hielo #2 |
| Giant-Crayfish | 70 | 7d7 | 2 | 0 / 0 | Hielo | Veneno / Pantano #4 |
| Tentocle | 80 | 7d6 | 3 | 6 / 500 | Neutro/Tierra | Hielo #1 |
| Beholder | 100 | 8d8 | 4 | 0 / 0 | Rayo | Rayo #3 |
| Mountain-Giant | 100 | 8d7 | 2 | 0 / 0 | Neutro/Tierra | Tierra #3 |
| Giant-Plant | 100 | 8d6 | 2 | 0 / 0 | Neutro/Tierra | Rayo #1 |
| Cannibal-Plant | 105 | 8d8 | 2 | 5 / 550 | Neutro/Tierra | Rayo #2 |
| Orge | 115 | 8d7 | 3 | 0 / 0 | Rayo | Bestia (combate puro) #4 |
| Claw-Turtle | 120 | 8d9 | 2 | 0 / 0 | Hielo | Veneno / Pantano #5 |
| Liche | 130 | 8d6 | 5 | 6 / 1000 | Hielo | Rayo #4 |
| Stalker | 130 | 8d9 | 4 | 0 / 0 | Neutro/Tierra | Control (no-muertos) #3 |
| DireBoar | 130 | 8d8 | 1 | 0 / 0 | Neutro/Tierra | Bestia (combate puro) #3 |
| Frost | 130 | 8d6 | 3 | 10 / 700 | Hielo | Hielo #3 |
| WereWolf | 140 | 8d8 | 1 | 0 / 0 | Neutro/Tierra | Bestia (combate puro) #5 |
| Dark-Elf | 140 | 8d4 | 8 | 0 / 0 | Neutro/Tierra | Ilusion y Sigilo #2 |
| Ettin | 180 | 8d9 | 3 | 0 / 0 | Rayo | Tierra #4 |
| MasterMage-Orc | 250 | 8d7 | 3 | 7 / 1500 | Fuego | Ilusion y Sigilo #3 |
| Nizie | 280 | 10d10 | 3 | 10 / 2000 | Hielo | Ilusion y Sigilo #4 |
| Demon | 340 | 10d10 | 4 | 7 / 2000 | Fuego | Fuego #4 |
| Unicorn | 340 | 10d10 | 4 | 8 / 2000 | Rayo | Sustento #3 |
| Minotaurs | 340 | 13d11 | 2 | 0 / 0 | Neutro/Tierra | Tierra #5 |
| Centaurus | 350 | 12d11 | 3 | 8 / 2000 | Neutro/Tierra | Rayo #5 |
| Gagoyle | 400 | 13d10 | 5 | 7 / 2000 | Fuego | Control (no-muertos) #4 |
| Giant-Lizard | 450 | 10d10 | 2 | 8 / 700 | Hielo | Hielo #4 |
| Hellclaw | 1000 | 15d14 | 5 | 7 / 0 | Fuego | Control (no-muertos) #5 |
| Tigerworm | 2000 | 18d17 | 6 | 9 / 16000 | Fuego | Fuego #5 |
| Crops | 2000 | 0d0 | 1 | 0 / 0 | Rayo | No summon (ciudad / guardia / objeto) |
| Wyvern | 2500 | 20d18 | 7 | 12 / 16000 | Hielo | Hielo #5 |
| Fire-Wyvern | 3000 | 159990d18 | 7 | 7 / 16000 | Fuego | Fuego #5 |
| McGaffin | 3000 | 1d1 | 4 | 0 / 0 | - | No summon (ciudad / guardia / objeto) |
| Perry | 3000 | 1d1 | 4 | 0 / 0 | - | No summon (ciudad / guardia / objeto) |
| Devlin | 3000 | 1d1 | 4 | 0 / 0 | - | No summon (ciudad / guardia / objeto) |
