# Comida de summons (bots) (v0.76.0)

- INVENTO del port. Un bot con summon le da su comida preferida (`companion.js#TASTE.love`): primero al principal, luego a los demás (`summonfood.js#feedSummons`).
- Solo la comida de **estadística** (el pescado, ticket 14: la granja solo cura), que sube puntos permanentes hasta `FEED_CAP`; la que solo cura no se da.
- Precio fijo `FOOD_PRICE` = 60 por pieza, reserva de oro `RESERVE` = 250, hasta `PER_ERRAND` = 4 piezas por visita. Sin oro no compran.
- Desde 0.78.0 la comida se compra en los puestos de los artesanos (`artesanos.md`) y no «de la nada».
- Test: `tests/summon-food.test.mjs`.
