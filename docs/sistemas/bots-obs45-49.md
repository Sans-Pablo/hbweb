# Bots obs. 45-49 (v0.85.91)
- **45 cursor**: `gui.js` dibuja el cursor con `mouse.seen` (en los márgenes del panorámico la x GUI es negativa).
- **46 presas triviales**: `bot.trivialPrey`: residente nivel ≥10 no ataca ni busca monstruos con exp <4 % del nivel (pickTarget y hunt). Completo (0.85.91): `council.farmDry` (granja sin presas rentables) baja el peso de "hunt" x0.25 y adelanta el viaje (`_tripAt`, residents.js) → cripta o Promise Land (EKs); el equipo lo cubren las compras/misiones existentes. Test `tests/bot-obs46.test.mjs` (simulación: el bot sale a la cripta tras detectar la granja seca).
- **47 mago con Wing Helm**: la reserva de puntos ya no cuenta como Str en casters (`poolStr`), y se desequipa lo puesto que incumple `reqOk`.
- **48 guerrero sin placas**: compra y equipa PlateMail/PlateLeggings/FullHelm cuando es usable y puede pagar; una sola vez reparte de nuevo sus stats por su build (`r.warV`, `residents.rebuild`).
- **49 reset suave**: `bot.softReset` (sin objetos, stats según build, habilidades 100, 1.000.000 de oro, estudia magias); `botsSoft` en `adventure.js`, op `botssoft` en `debug.js`, botón en F1 → Herramientas → Bots.
Test: `tests/bot-obs45-49.test.mjs`.
