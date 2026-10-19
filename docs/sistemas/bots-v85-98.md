# Bots v0.85.98 — armadura, hechizos, party, chat y mascotas
- `armorCare` (bot.js, desde `errands`): por cada hueco de HEAD/BODY/LEGGINGS/ARMS equipa de la bolsa o compra la mejor pieza usable y asequible; repara piezas <50 % de vida. `b.armorGap` entra en `gearGap` (no caza con hueco).
- `residents.rebuild`: tras el reset olvida hechizos con `reqInt` > Int (#93).
- `combatsys.canFight`: en ffa los del mismo party no se atacan (#94).
- Chat: `say()` de bots cada 60 s y mudo en PvP; residentes `say2` solo cada 120 s en frases ociosas (#88).
- Mascotas (#90): `PET_RULES.staff` (npcsys.js) en false; sin tope de nivel por dueño (companion.js `addExp`).
- `world.attack`: objetivo muerto se ignora sin rechazo.
- #70 (Wizard Cap/Hat): inviable, Str 110/130 frente a magos con Str 10–39.
Test: tests/bot-v85-98b.test.mjs.
