# Artesanos: granjeros y pescadores con puesto (v0.78.0)

- Cada ciudad tiene 8 bots de oficio: 2 granjeros y 2 pescadores por bando (ver `bots.md`, `residentes.md`). El panel «Personajes» del observador los agrupa por clase y oficio (`observador-paneles.md`).
- **Producen** comida y pescado (los objetos de `Comp.FEED`); no hacen caramelos. `residents.js#produceStock`: lo que llevan en la mochila sale al puesto a `|precio de Item.cfg|` (los precios de producción vienen en negativo en `Item.cfg`).
- **Puesto con existencias limitadas**: abren en `gshop_1f` con lo que tienen (máx. `Stall.MAX_ITEMS_STALL`); al agotarse vuelven a su actividad. Detalle del puesto en `puestos.md`.
- **Compradores**: los bots con summon compran en el puesto la comida que su bola prefiere (`summonfood.js`) para subirle estadísticas. Los residentes ya no compran comida de la nada en la tienda: la comida de granja se compra a los artesanos.
- Test: `tests/craft-stall.test.mjs`, `tests/bot-jobs.test.mjs`.
