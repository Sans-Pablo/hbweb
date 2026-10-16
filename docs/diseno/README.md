# Diseño unificado de ventanas — 3 direcciones

Prototipos estáticos (abrir en el navegador). Cada uno muestra Inventory, Warehouse, Quests y mini Auto Hunt con marco, cabecera, bolas (minimizar izquierda, cerrar derecha, como `gui.js`), pestañas, botones, listas, buscador y barra. Sin turquesa; paleta `THEME` de `window.js` (oro #e0b84a/#f2c14e). Se regeneran con `node docs/diseno/build.mjs`. El marco es una imitación CSS; en producción se usaría `gamedialog_1` (ver `docs/SPRITES.md`).

| | A · Piedra clásica | B · Pergamino plano | C · Híbrido |
|---|---|---|---|
| Archivo | `direccion-A.html` | `direccion-B.html` | `direccion-C.html` |
| Marco | madera/metal grueso, interior pergamino claro | filete dorado 1px, interior oscuro | madera fina, interior oscuro |
| Cabecera | barra de madera | barra marrón plana | barra degradada de madera |
| Bolas | plateadas redondas | cuadradas pequeñas | redondas |
| Fidelidad al original | máxima | baja | alta |
| Legibilidad | media (texto oscuro sobre beis) | alta | alta |
| Coste de aplicar | bajo (ya es el estilo actual) | medio: reescribir el dibujo del marco | medio: marco sprite + rellenos planos |

**Recomendación:** C. Mantiene la identidad del original (regla de oro del proyecto) y unifica listas, pestañas y botones con una sola receta. A es lo que ya hay, y las diferencias entre ventanas vienen de que cada una pinta sus propios controles. B es lo más limpio pero choca con la fidelidad.
