# Efectos v0.85.99 (#105 #96)

- **Berserk**: magia 50 -> efecto 150 (spellfx.js). Faltaba el dibujo: ahora `P(58, …)` (fx58), como Game.cpp:7182 `m_pEffectSpr[58]`. La auditoría del resto de efectos no halló otros sin dibujar (57 y 73-77 no se lanzan en el original).
- **Log (F9)**: `ChatWin.fit` ajusta tamaño y posición a `gui.W/H` en cada fotograma. Toggle: F9 / botón 💬 móvil.
- Test: tests/efectos-v85-99.test.mjs. Sin verificación visual.
