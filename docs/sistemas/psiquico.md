# Summons psíquicos (v0.79.0)
INVENTO del port. Control y debilitación para cualquier clase, sin daño directo. Código: `systems/psychic.js`; test: `tests/psychic.test.mjs`.

- **Especies:** Tentocle → Beholder (Movimiento), Unicorn → Centaurus (Interferencia), Giant-Frog → Stalker (Territorio). `PSY_OF` en `evolutions.js`.
- **Psychic Controller** (id 9004, sprite de la Kloness Wand 863, 3000 de oro en el herrero): debe estar en la mano. Sin él el summon se retira (`staffOk`, familia `psychic`). Cualquier clase, magos incluidos.
- **IA:** lanza solo, como el Dummy, con su maná y recargas (`Tal.ready/pay`), un hechizo por GCD (2,2 s), alcance 10. Prioridad: enemigos (jugadores hostiles con PvP y monstruos) → mascotas enemigas → NPC de ciudad solo si el dueño lo marcó.
- **Efectos** (ids de Magic.cfg usados solo por su estado; duración corta, sin renovar mientras dure; resistencia mágica del objetivo):
  - Movimiento: Hold 25 (5 s), Illusion Movement 77 (6 s, movimiento errático / pierde objetivo), Chill Wind 45 (8 s, `ice`).
  - Interferencia: Inhibition 83 (solo jugadores), Cancellation 76, Confusion 62, Armor Break 66 (+25 % daño recibido, 10 s), Staminar Drain 11 (solo jugadores, -30 % SP).
  - Territorio: Fire Field 41, Spike Field 54, Poison Cloud 46: campos `nd` (sin daño) que retienen/ralentizan 9 s.
- Jefes y `magicLevel >= 6` no sufren Hold ni raíces. Inhibition/Drain no afectan a monstruos; veneno en monstruos = ralentización.
- **Fuera de alcance:** contramagias (Vulnerability, Defense Break, Slow, Physical Weakness, Haste, Minor Berserk).
- **0 restricciones** (herramientas, `free`): ignora el báculo y el tope de nivel de las mascotas, para probar evoluciones.
- Panel de estados (gui.js `statusPanel`): añade Illusion y Armor Break con cuenta atrás. `NET_PROTO` 9.
- Mascotas: ahora andan un 25 % más deprisa (`PET_MOVE` en `npcsys.js`).
