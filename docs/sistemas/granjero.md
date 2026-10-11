# Granjero de Aresfarm (BUG-013)
Invento del port. Ciudadano `Farmer` (rol `farmer`, aspecto de tendero tipo 15 `ShopKeeper-W`) en Aresfarm (77,106), definido en `EXTRA_CITIZENS.arefarm` (`citizens.js`) y colocado por `Adventure`.
Al pulsarlo (`npcdialogs.js`, `clickNpc`) escribe una explicación en el chat y abre la tienda general filtrada a las bolsas de semillas y el Manual de Cultivo (precios de `shops.json`, tienda 1). Test: `tests/farmer.test.mjs`.
