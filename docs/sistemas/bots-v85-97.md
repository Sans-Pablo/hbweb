# Bots v0.85.97 — tanda de 32 observaciones y lecciones de los logs

Test: `tests/bot-v85-97.test.mjs`.

## Equipo y compras
- Requisitos de armadura (`REQ`/`meetsReq` en botitems.js) y memoria de lo vendido (`SOLD_MEMORY` 10 min) para no recomprar lo que acaban de vender (obs. 50, 54, 63).
- Piedras (Zemstone, 650/656/657): se recogen y se venden por `|precio|/2` (`Shop.STONES`) (obs. 84).
- Objetos Master: ni se compran ni se ven en el diálogo de la tienda (obs. 53).
- Guerreros llevan arco y flechas (obs. 81; el uso táctico del arco NO está hecho).
- `wish()` suma +30 a lo básico asequible con ≤3 unidades (obs. 85).
- Los no residentes también ignoran presas triviales (obs. 53).

## Magia
- `cheapest()` reescrita: el mago elige el hechizo más barato que mata/avanza (obs. 72/80).
- Mago adyacente espera hasta 4 s el enfriamiento en vez de pegar con el bastón (obs. 80).
- Estudia hechizos con Int>=20 en sus recados (obs. 65/76/86).
- Paralyze (case 12 de magicsys) se rompe si un bot ya no puede pelear con el objetivo (obs. 62).
- Limitador `manualAt`: una habilidad de manual probada se reintenta tras 5 min (obs. 55).

## Lecciones de los logs reales (replays de «zzzz», bugs.jsonl)
- Un mago nv140 con 780 mp gasta ~600 en 2ndmiddle sin pociones y luego recuerda (Recall) y descansa en wrhus_1f.
  Hechizos usados: Ice Strike ×57, Energy Strike ×60, Blizzard ×8 (el jugador prefiere el barato y reserva Blizzard para grupos).
- Mapas del jugador: arefarm → 2ndmiddle → wrhus_1f/gshop_1f; presas Orc, Skeleton, Giant-Ant, Slime; sin muertes.
- Aplicado a los bots: compran pociones de maná (test), descansan por debajo de ~25 % de maná (bot-rest) y esperan enfriamiento en vez de pegar.
- NO aplicado: duelos PvP con persecución, cambio de sets, tácticas de arco (tickets abiertos).

## Sin cerrar
52/60 (duelos PvP sin final), 64, 66, 67, 69, 70, 73, 75, 77, 61/82/83 (administración).

## Ampliación v0.85.98
52/60 duelo sin progreso (20 s) cambia de rival; 64/69/74 el juez valora bonus de rol y `botvalues.json` ajustable (endpoint admin + panel); 67 botín modesto y caza si sin oro; 75 F5; 77 botín de cripta profunda; 79 escudo de torre por vida. 66/70/73 sin cambio (ver tickets). Test: tests/bot-v85-98.test.mjs.
