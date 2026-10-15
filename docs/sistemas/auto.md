# Modo automático (/auto)

INVENTO del port (Olympia tenía auto-caza; el original no). Lógica pura en `shared/systems/autoplay.js`, ejecutada solo en el cliente (`Controller.update`): emite las mismas intenciones que un clic (`attack`, `pickup`, `move`), así que el servidor valida cada paso y no hay cambio de protocolo.

- `/auto hunt <criatura>` (alias de orders.js: slime, orcos…): ataca a la presa de ese tipo más cercana (≤ 40 casillas); sin presas recoge el botín a ≤ 7 casillas (lo que no cabe se salta tras 3 intentos); para con vida < 35 %, al morir o tras 20 s sin presas ni botín.
- `/auto run <almacén|tienda|herrería|mago|granjero|hospital|hechicero de mascotas>`: camina hasta el habitante más cercano de ese tipo (NPC.cfg: Warehouse Keeper 20, Shop Keeper 15, BlackSmith 24, Magician 19; el resto por `role`) y abre su diálogo. Si no hay en el mapa, avisa y para.
- `/auto stop`, cualquier clic o clic derecho lo cancelan.
- Test: `tests/autoplay.test.mjs`.
