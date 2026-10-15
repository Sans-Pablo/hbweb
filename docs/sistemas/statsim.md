# Simulador de estadísticas (`/stats`)
INVENTO del port, al estilo del simulador de Olympia. Ventana del lienzo (`client/statsim.js`, id 73) que deja repartir puntos de prueba en Str/Vit/Dex/Int/Mag/Chr y ver cómo cambian HP, MP, SP y carga, sin gastar nada ni mandar órdenes al servidor.
- Se abre con `/stats` (o `/simula`, `/sim`) en el chat; alterna abrir/cerrar.
- Presupuesto = `me.pool` (puntos sin gastar). La casilla «Sin límite» lo quita para probar builds completas. Tope 200 por atributo (como el cuadro Level Up, `dialogs.js`).
- Control de nivel simulado (1–200). Ctrl = pasos de 5.
- Fórmulas: las del juego (`shared/rules.js` maxHP/maxMP/maxSP, `shared/inventory.js` maxLoad), en `shared/systems/statsim.js` (`simulate`, `bump`, `spent`), sin DOM.
- Solo atributos base (sin equipo ni bonos).
- Test: `tests/statsim.test.mjs`. Sin cambios de protocolo ni de estado.
