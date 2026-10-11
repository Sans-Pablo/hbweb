# Actos y evolución de mascotas (diseño reservado, no implementado)

No existía ningún documento de actos en `docs/` (ni `ESTADO`, `PROCESO`, `sistemas/*`), así que este es el documento de referencia. Complementa `DISENO_EVOLUCIONES.md` (líneas y tiers) y `DISENO_SUMMONS.md` (escuelas). Todo lo de aquí está **guardado para más adelante**: nada se programa hasta que se apruebe.

## 1. Los 5 actos (nivel del jugador)

| Acto | Niveles del jugador | Tier de summon que desbloquea | Tema |
|---|---|---|---|
| I | 1 – 50 | Tier 1 | Aprender: granja, cripta, primeras magias |
| II | 50 – 100 | Tier 2 | Especialización: segunda forma, magias de zona |
| III | 100 – 150 | Tier 3 | Dominio: magias de área, jefes de zona |
| IV | 150 – 180 | Tier 4 | Élite: magias avanzadas, apex bosses |
| V | 180 + | Tier 5 | Endgame: forma final, magias máximas |

Los límites son inclusivos hacia arriba al cruzarlos (nivel 50 ya cuenta como Acto II al subir). Los mapas, mazmorras (`DUNGEON_V*.md`) y jefes de cada acto quedan por definir; este documento solo fija los rangos.

## 2. Cómo se unen acto y evolución

- **Se evoluciona como hoy**: bola al nv 50 (`TRADE_LEVEL`), viva, guardada, en el hospital → bola nueva nv 1 de la siguiente forma, mismo nombre y magias. Se puede hacer ya en el Acto I: **no hay puerta de acto**; el acto solo marca el rango recomendado de cada tier (qué zonas y jefes encajan con él).
- **Forma final de la cadena** (la última de su línea): al nv 50 ya no evoluciona más, pero igual cuenta como «máximo».
- **Efecto visual de nivel máximo**: cada forma evolucionada, al llegar a nv 50, gana un aura propia continua. Hoy lo hacen solo Demon (brasas rojas), Liche (oscuridad, humo y ojos rojos) y Frost (viento helado en espiral) (`renderer.js`, condición `e.comp && e.clvl >= 50`). Se amplía a todas las formas evolucionadas (ver 3.1).
- El nivel de la bola sigue en 1–50 por forma; su fuerza escala con el dueño (`statsOf`) y el multiplicador de tier, así que no hace falta subir `MAX_COMP_LEVEL`.
- **Dummy**: la clase se fija con la primera magia y cada rama sube por sus formas igual que las demás (nv 50 → evoluciona). Las ramas cortas (Buffer, Aura) terminan en su forma final y ahí obtienen el aura de nv 50.

### Rezago (propuesta, opcional)
Como ya no hay puerta de acto, el rezago solo tendría sentido si se quiere empujar a evolucionar: −10 % de vida/daño por tier de diferencia con el acto del dueño. Por defecto, sin penalización.

## 3. Evolución por acto (rediseño con Dummy y mobs de Cruzada)

Fuente: `Helbreath.ServerFiles/Config/Npc.cfg` (135 NPC; `npc.json` del port solo trae 56) y la tabla de sprites de `Helbreath.Client/Game.cpp` (`MakeSprite … Type: N`). «✔» = el sprite ya está convertido en `web/data/sprites`; «⚠» = existe en el cliente original (hay que convertirlo con `tools/convert_mobs.py`); «✖» = está en Npc.cfg pero **no tiene sprite en el cliente**, no se puede usar.

| Familia | Acto I | Acto II | Acto III | Acto IV | Acto V |
|---|---|---|---|---|---|
| Fuego | Orc | Hellbound | Cyclops | Demon | Fire-Wyvern |
| Hielo | Tentocle | Ice-Golem | Frost | Giant-Lizard | Wyvern |
| Rayo | Giant-Plant | Cannibal-Plant | Beholder | Liche | Centaurus |
| Naturaleza | Stone-Golem | Clay-Golem | **Tierra:** Mountain-Giant → Ettin → Minotaurs · **Veneno:** Giant-Frog → Giant-Crayfish → Claw-Turtle (actos III-V) | | |
| Mente | Skeleton | Zombie | **Control:** Stalker → Gagoyle → Hellclaw · **Ilusión:** Dark-Elf → MasterMage-Orc → Nizie (actos III-V) | | |
| Bestia | Slime | Giant-Ant | **Físico:** Troll → Orge → WereWolf · **Sustento:** Rudolph → Unicorn (actos III-IV) | | |
| Asedio (Cruzada) | Light War Beetle ⚠ | Battle Golem ⚠ | Babarian ⚠ | Catapult ⚠ | Heavy Battle Tank ⚠ |
| Dummy | Dummy | **Healer:** Scarecrow → Temple Knight → TPKnight → God's Hand Knight · **Buffer:** Sorceress (termina) · **Aura:** Mana Collector (termina, inmóvil) (actos II-V) | | | |

Versión fusionada: 8 familias en vez de 13 líneas; la rama se elige en el acto III (Naturaleza, Mente, Bestia) o II (Dummy). Guía visual con sprites: [img/evoluciones.svg](img/evoluciones.svg).

### Ideas clave
- **Dummy**: sigue siendo único, frágil y sin ataque; la clase (primera magia) fija la rama. **No todas las ramas necesitan 5 formas**: Healer llega al Acto V (Scarecrow → Temple Knight → TPKnight → GHK); Buffer termina en Sorceress (Acto II) y Aura en Mana Collector (Acto II, inmóvil, siempre en modo Puesto). Las ramas cortas ganan el resto de su progreso con talentos de `talents.js` (MASS, Vampiric Aura, Resurrection para Healer) y con el radio del área, no con más formas.
- **Asedio**: la línea que aprovecha la Cruzada: sin escuela, castiga estructuras y grupos con golpes en área. Complementa a Bestia (cuerpo a cuerpo) con alcance (Catapult y Tank: rango 9 en Npc.cfg).
- **Caballeros** (Temple Knight, TPKnight, GHK) → rama Healer; Sorceress → rama Buffer. Guard, Detector, torres y ElfMaster quedan libres por si luego se alargan las ramas cortas.
- **Descartados por no tener sprite en el cliente**: Ghost, Vampire y las cuatro Pixies (Npc.cfg tipos 93–98) ✖. Si en el futuro se dibujan, Pixies (Fire/Ice/Earth/Air) encajan como skins de Sustento T3 según el elemento. Tampoco entran Magma Bull, Fire Elemental ni Ugly Wyvern de la referencia de terceros: no existen en el original.
- **Fuera de las líneas** (estructuras de Cruzada sin sentido como bola): ESG, GMG, ManaStone, Energy-Sphere, Heldenian Gate, CBTurret, ACannon, Attack-Dummy, YB (aliado de 1 de vida), Abaddon (jefe final, se deja como jefe de raid sin evolución).
- Guard, Barlog, Babarian, etc. tienen una versión por bando (`-Aresden/-Elvine/-Istria`); el summon usa la skin del bando del dueño.
- Pendiente de verificar al implementar: los PAK del cliente no están en esta máquina, así que la marca ⚠ sale del código fuente (`Game.cpp`), no de las hojas de sprites.

### 3.1 Aura de nivel 50 por forma (propuesta)
Todas son efectos de dibujo (sin lógica), como las tres existentes. «Existe» = ya implementada en `renderer.js`.

| Forma (al nv 50) | Aura |
|---|---|
| Demon, Liche, Frost | Existe: brasas rojas / oscuridad con ojos rojos / viento helado |
| Hellbound, Cyclops, Fire-Wyvern, Tigerworm, Barlog | Fuego: brasas y calor, más intenso cuanto más alto el tier |
| Ice-Golem, Giant-Lizard, Wyvern | Hielo: copos y escarcha en el suelo |
| Cannibal-Plant, Beholder, Centaurus | Rayo: chispas azules que saltan por el cuerpo |
| Clay-Golem, Mountain-Giant, Ettin, Minotaurs | Tierra: polvo y piedras que flotan |
| Scorpion, Giant-Frog, Giant-Crayfish, Claw-Turtle | Veneno: burbujas verdes y vapor |
| Zombie, Stalker, Gagoyle, Hellclaw | Control: niebla violeta y runas |
| Dark-Elf, MasterMage-Orc, Nizie, DarkKnight | Ilusión: imagen doble que parpadea |
| Rudolph, Unicorn | Sustento: motas de luz doradas |
| Giant-Ant, Troll/DireBoar, Orge, WereWolf | Bestia: respiración/vaho y ojos brillantes |
| Battle Golem, Babarian, Catapult, Heavy Battle Tank | Asedio: polvo de batalla y chispas de metal |
| Scarecrow, Temple Knight, TPKnight, God's Hand Knight | Healer: halo verde |
| Sorceress | Buffer: halo amarillo con runas |
| Mana Collector | Aura: pulso azul de maná (se ve también el radio) |

Regla de dibujo: usar los mismos recursos que las tres auras actuales (gradientes, partículas simples, `tinted` con `lighter`) y escalar la intensidad por tier para que un T2 se note menos que un T5.

## 4. Poderes reservados por acto

Multiplicadores de `DISENO_EVOLUCIONES.md` (T1 ×1/1/1 · T2 ×1,4/1,2/1,6 · T3 ×1,9/1,45/2,4 · T4 ×2,5/1,7/3,4 · T5 ×3,2/2,0/4,5 en vida/daño/maná). Poderes por escuela y acto (ids de `Magic.cfg`):

| Escuela | Acto I | Acto II | Acto III | Acto IV | Acto V |
|---|---|---|---|---|---|
| Fuego | Fire Ball 20, Fire Strike 30 | Fire Wall 40, Fire Field 41 | Mass Fire Strike 61 | — (mejora) | Meteor Strike 81 |
| Hielo | Chill Wind 45, Ice Strike 57 | Ice Storm 55 | Mass Chill Wind 63, Mass Ice Strike 72 | — (mejora) | Blizzard 91 |
| Rayo | Magic Missile 0, Energy Bolt 10, Lightning Arrow 37 | Lightning 43, Triple Energy Bolt 47, Lightning Bolt 51 | Mass Lightning Arrow 56, Energy Strike 60 | Bloody Shock Wave 70, Lightning Strike 74 | Mass Magic Missile 82 |
| Tierra | Tremor 38 | Spike Field 54 | Earthworm Strike 64, Armor Break 66 | — (mejora) | Earth Shock Wave 96 |
| Veneno | Poison 27 | Poison Cloud 46 | Mass Poison 53 | — (mejora) | Cloud Kill 73 |
| Control | Staminar Drain 11, Hold Person 25 | Paralyze 35, Possession 26 | Cancellation 76 | Inhibition Casting 83 | — (mejora) |
| Ilusión | Confuse Language 42 | Confusion 62 | Mass Confusion 71, Illusion 80 | Mass Illusion 90 | — |
| Sigilo | Recall 12, Celebrating Light 14 | Invisibility 32 | Detect Invisibility 34 | Scan 67 | — |
| Sustento | Create Food 2, Staminar Recovery 23 | Cure 36 | Great Staminar Recovery 28 | — | — |
| Apoyo | Heal 1, Defense Shield 13 | Great Heal 21, Protection From Magic 33 | Great Defense Shield 44, Berserk 50 | Protection From Arrow 24, auras | Absolute Magic Protection 65, Resurrection 94 |

La tabla es el reparto de reserva; las magias que el diseño original ya enseña (`unlockLevels`) se reordenan al implementar. Los huecos «— (mejora)» se rellenan con la sección 5.

## 5. Mejoras de mascota por acto (reservadas)

| Acto | Mejora | Efecto propuesto |
|---|---|---|
| I | Vínculo | Tamaño visual por etapas (`SIZE_STAGES`), nombre propio, caramelos recuperan maná |
| II | Segunda forma | Un segundo hechizo prepago (cola de 2), +1 casilla de equipo ligero para la bola |
| III | Afinidad | Resistencia al elemento de la escuela (+20 %), aura pasiva pequeña para el dueño |
| IV | Despertar | Pasiva propia de la línea (p. ej. Fuego: quemadura; Hielo: ralentiza; Veneno: dura más), segunda bola activa (apoyo) |
| V | Forma final | Habilidad única de la especie apex, un cambio de pasiva por semana de juego, apariencia dorada |

## 6. Costes de evolución por acto (de `DISENO_EVOLUCIONES.md`)

| Salto | Coste |
|---|---|
| I → II | Oro + piedra común |
| II → III | Oro + piedra rara |
| III → IV | Oro + piedra rara + ítem de jefe de zona |
| IV → V | Oro + ítem de jefe apex |

## 7. Decisiones pendientes

1. ¿Los actos son rangos recomendados (propuesto, sin puerta) o hay que cumplir un nivel de jugador para evolucionar?
2. ¿Solo se evoluciona en el hospital, o también con un NPC por acto?
3. ¿Rezago del 10 % o sin penalización (propuesto: ninguna)?
4. ¿Segunda bola activa en el Acto IV, o ya desde el II?
5. Ampliar el tope de nivel del jugador sobre 180 ¿existe en el servidor original o hay que definirlo?
6. Mapas y jefes de cada acto (relación con `DUNGEON_V1–V3.md`).
7. Qué mejoras de la sección 5 se implementan primero.

## 8. Cuando se implemente

Ficha `docs/sistemas/actos.md`, cambios en `schools.js` (`EVOLVE`, `tier` por bola), `companion.js` (puerta de acto), test en `tests/`, cadenas en `i18n`, y subir `NET_PROTO` si el tier viaja por red.
