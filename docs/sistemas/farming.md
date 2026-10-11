# Agricultura (farming)

Réplica de la agricultura del servidor original. Código: `web/src/shared/systems/farming.js`. Test: `tests/farming.test.mjs`.

- **Sembrar** (HG.cpp `ITEMEFFECTTYPE_ITEMFARM`): usar una bolsa de semillas (801-814, effectType 30) mirando una casilla de cultivo (flag 0x20 del `Grid`, `grid.farm`). Exige maestría de Farming >= nivel de la semilla; máximo 200 cultivos.
- **Cuidar** (combat.cpp + Skill.cpp, tablas `CROPS`/`DROP`): atacar el NPC «Crops» con la azada (objeto 232, wtype 27). Etapas de crecimiento 18/8/1 de `buildCount`.
- **Cosecha** (`bCropsItemDrop`): al terminar sale el producto (`PRODUCT`: 820-832; el Ginseng original 731 es el 721 del port) y experiencia.
- **Tiendas**: la 1 vende semillas y el manual; la 2, la azada.

## Alimentar al summon (idea del port)
Arrastrar un producto sobre la bola (o usarlo con un compañero activo): Tomate +1 vida máx., Uva +1 maná máx. (también la Uva azul), Champiñón +1 ataque (tope 100 por stat, `c.fb`); se ve en la ventana del summon («Farm: …»). El resto cura al summon en vez de los caramelos; el Ginseng lo revive.

## Bots
El 30% de los bots son granjeros (`b.farmer`): compran azada y semillas, buscan casillas de cultivo, siembran, cuidan con la azada y recogen los productos para comerciar. Solo actúan en mapas con casillas de cultivo.
