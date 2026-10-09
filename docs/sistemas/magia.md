# Magia

Código: `shared/magic.js` (costes, probabilidad, potencia), `shared/systems/magicsys.js` (lanzar, resolver por tipo), `fields.js` (campos), `status.js` (efectos).
Origen: `HGServer/Game.cpp` `PlayerMagicHandler` (~17200–18700) y `Files/Magic.cfg` (`web/data/magic.json`).
Modo de prueba: `MAGIC_MODE.free` (sin maná ni requisitos); los tests lo desactivan.

## Tipos de `Magic.cfg` (`DEF_MAGICTYPE_*`, `Magic.h`)
| Tipo | Estado | Notas |
| --- | --- | --- |
| 1 daño a un objetivo, 3/21/25 área, 19/30 lineal, 22 temblor, 23/26 hielo, 28 rompe-armaduras | portado | resistencia mágica, absorción, mitad de experiencia en área |
| 2 curar, 7 recuperar, 10 crear comida, 11 escudos, 12 paralizar, 13 invisibilidad, 14 campos, 15 posesión, 17 veneno, 18 furia, 29 cancelación, 33 escaneo | portado | |
| 8 recall | portado (solo uno mismo) | |
| 9 invocar | portado | seguidor según Magery, máximo magery/20, 300 s, sin experiencia ni botín (`npcsys.summonFor`) |
| 16 confusión, 31 inhibición, 32 resurrección | sin efecto | solo afectan a otros jugadores |
| 4, 5, 6, 20 | sin efecto | sin hechizos en `Magic.cfg` que afecten a monstruos |

## Pendiente
Efectos visuales 102–172 de los tipos 19–33 que aún no tengan sprite; teletransporte entre mapas por hechizo; PvP.
