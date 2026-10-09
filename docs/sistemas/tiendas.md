# Tiendas, herrería, almacén y mago

Código: `shared/systems/shopsys.js` (servidor), `shared/systems/citizens.js` (colocación), `client/npcdialogs.js` (cuadros).
Origen: `HGServer/Game.cpp` (RequestPurchaseItemHandler, ReqSellItemHandler, ReqSellItemConfirmHandler, ReqRepairItemHandler,
ReqRepairItemCofirmHandler, bSetItemToBankItem, RequestRetrieveItemHandler) y `Client/Game.cpp` (DrawDialogBox_*).
Listas de venta: `contents1.txt` (tienda) y `contents2.txt` (herrero) → `web/data/shops.json`.

## NPC
| Nombre | Tipo | Cuadro | Sprite |
|---|---|---|---|
| ShopKeeper-W | 15 | 20 → 11 (tienda 1) | `shk0-7` |
| BlackSmith (Tom) | 24 | 20 → 11 (tienda 2) | `tom0-7` |
| Howard | 20 | 20 → 14 | `how0-7` |
| Gandlf | 19 | 20 → 16 | `gnd0-7` |

Se colocan en el primer waypoint de cada NPC del mapa (`populate`). Gandlf ya no se añade a `gshop_1f` (v0.18.0).
Clic izquierdo (sin Ctrl) a ≤ 8 casillas abre el menú.

## Reglas
- Compra: `buyCost` — descuento por carisma `(chr-10)/4 %`, tope la mitad menos 1. `10Arrows`/`100Arrows` compran 10/100 flechas. Hasta 50 por orden.
- Lista del cliente: `listPrice` (descuento de carisma sobre el precio base).
- Venta en dos pasos: `sellreq` → evento `sellprice` → `sellconfirm` → `sold`. Categorías 11–50: la mitad del precio; 1–10: proporcional a la vida restante más atributos; sin vida = "exhausted".
- Reparación: `repairCost` = mitad del precio menos lo que aún vale. Armas/armaduras (1–10) las arregla el herrero; 11, 12 y 43–50, el tendero.
- Lista de venta (cuadro 31): hasta 12 objetos.
- Almacén: 200 huecos (`MAX_BANK`), pilas se suman, persiste en el guardado (`bank`).
- Mensajes en inglés tal cual del original.

## Pruebas
`tests/shop.test.mjs` (descuentos, compra, venta, reparación, lista, depósito, guardado) y la comprobación visual con Playwright
(compra, venta por arrastre sobre el tendero, depósito/retirada, Learn de Gandlf).
Para probar con dinero: `/gold N` en el chat (solo partida local).
