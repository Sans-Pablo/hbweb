# Diseño de summons por escuela (propuesta)

Base: `schools.js` (escuelas de fuego, hielo y rayo), `dummy.js` (apoyo) y `Magic.cfg` / `NPC.cfg` tal cual (`web/data/magic.json`, `npc.json`).
Regla del sistema actual: el jugador no lanza nada por su cuenta. `usable` solo acepta magias de escuela y las paga el maná del summon.
Cada escuela = una especie base (nv 1-50) que cambia a una especie superior en el hospital al nv 50.

## A. Ya existen

| Escuela | Base → superior | Magias (id de Magic.cfg) |
|---|---|---|
| Fuego | Orc → Demon | Fire Ball 20, Fire Strike 30, Fire Wall 40, Fire Field 41, Mass Fire Strike 61, Meteor Strike 81 |
| Hielo | Tentocle → Frost | Chill Wind 45, Ice Storm 55, Ice Strike 57, Mass Chill Wind 63, Mass Ice Strike 72, Blizzard 91 |
| Rayo | Cannibal-Plant → Liche | Magic Missile 0, Energy Bolt 10, Lightning Arrow 37, Lightning 43, Triple Energy Bolt 47, Lightning Bolt 51, Mass Lightning Arrow 56, Energy Strike 60, Bloody Shock Wave 70, Lightning Strike 74, Mass Magic Missile 82 |
| Apoyo (Dummy) | Dummy (único) | Heal 1, Great Heal 21, Defense Shield 13, Great Defense Shield 44, Protection From Magic 33, Berserk 50, auras, Resurrection 94 |

## B. Magias que hoy nadie puede lanzar (hueco del diseño)

Tierra (sin escuela), veneno, control (Hold, Paralyze…), ilusión, sigilo, utilidad (Recall, Create Food, Staminar…), Armor Break, Scan, Cancellation, Inhibition Casting, Summon Creature, Protection From Arrow 24, Absolute Magic Protection 65.

## C. Escuelas nuevas propuestas

| Escuela | Rol | Base → superior | Magias |
|---|---|---|---|
| **Tierra** | Daño de zona y romper defensa | Stone-Golem → Giant-Lizard | Tremor 38, Spike Field 54, Earthworm Strike 64, Armor Break 66, Earth Shock Wave 96 |
| **Veneno** | Daño sobre tiempo | Scorpion → Giant-Crayfish | Poison 27, Poison Cloud 46, Mass Poison 53, Cloud Kill 73 |
| **Control** | Inmovilizar y cortar magia | Beholder → Gagoyle | Staminar Drain 11, Hold Person 25, Possession 26, Paralyze 35, Cancellation 76, Inhibition Casting 83 |
| **Ilusión** | Confundir | MasterMage-Orc → Nizie | Confuse Language 42, Confusion 62, Mass Confusion 71, Illusion 80, Mass Illusion 90 |
| **Sigilo / Explorador** | Info y movilidad | Stalker → Dark-Elf | Recall 12, Celebrating Light 14, Invisibility 32, Detect Invisibility 34, Scan 67 |
| **Sustento** | Resistencia fuera de combate | Rudolph → Unicorn | Create Food 2, Staminar Recovery 23, Great Staminar Recovery 28, Cure 36 |

## D. Lo que necesita el jugador según la actividad

| Actividad | Summons |
|---|---|
| Cazar solo | Rayo o Fuego + Dummy (curación) + Sustento |
| Cazar en grupo | Fuego o Hielo + Dummy buffer |
| Jefes | Tierra (Armor Break) + Control (Hold, Paralyze) + Dummy |
| PvP | Control + Ilusión + Rayo + Dummy |
| Mazmorras y exploración | Sigilo + Tierra + Sustento |

## E. Decisiones pendientes

1. Dummy: hoy no tiene Protection From Arrow 24 ni Absolute Magic Protection 65. ¿Se añaden a Buffer?
2. Illusion Movement 77 y Mass Illusion Movement 95 son de rayo (type 21): ¿se pasan a Ilusión?
3. Summon Creature 31: ¿escuela propia (Invocador) o se descarta?
4. Una sola bola activa: ¿se mantiene (rotar en combate cuesta turno) o se permiten 2 (principal + apoyo)?
5. Las especies superiores propuestas (Giant-Lizard, Giant-Crayfish, Gagoyle, Nizie, Dark-Elf, Unicorn) son mobs fuertes del juego. Hay que revisar que sus sprites funcionen como compañero.
