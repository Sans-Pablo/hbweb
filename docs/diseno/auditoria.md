# Auditoría de inconsistencias entre ventanas (sobre capturas reales, v0.85.25)

Orden: de más a menos visible. Solo diagnóstico; no se ha tocado producción.

## Botones
1. **Personaje (1): AUTO** (`dialogs.js:57`) es un rectángulo plano marrón con borde claro; Party y Level Set usan el sprite de piedra `dialogtext_1`. Además el texto "AUTO" es blanco/negrita y los demás llevan su rótulo en el sprite. Propuesta: sprite de piedra con rótulo propio (o texto centrado sobre el sprite vacío).
2. **Menú automático (74)**: "Cazar / Ir a…" y los 4 botones de rareza son piedra plana oscura con texto claro; "Empezar" es rectángulo con borde dorado y texto distinto. Tres estilos de botón en una ventana.
3. **Misión mini (76)**: "Diario" es piedra plana ancha; no coincide con los sprites de piedra del inventario ("Tienda", "Manufacture").
4. Alturas de botón mezcladas: 13 (inventario), 20 (personaje), ~18 (auto), sin norma (LAYOUT.btnH=20).

## Bolas y cabecera
5. Bola de minimizar solo aparece en algunas ventanas (almacén, inventario, personaje); diario y menú auto solo tienen cerrar. Decidir regla única.
6. Títulos: inventario sin título visible; almacén y personaje en rojo con adorno; diario y menú auto en gris oscuro sin adorno; minis en gris. Tres estilos de cabecera.
7. Idiomas mezclados: almacén y personaje en inglés (original, regla de oro 6); diario, auto y minis en español (propios). Es esperado, pero se nota en la misma pantalla.

## Fondos, listas y campos
8. Fondo: pergamino claro/rayado (almacén, personaje) frente a madera oscura (inventario) frente a tablero oscuro liso (diario, auto, minis).
9. Texto: dorado (diario), blanco (auto), negro (personaje), crema (minis). Sin jerarquía común.
10. Búsqueda: solo el almacén tiene barra de búsqueda y no se parece a ningún otro campo.
11. Casillas del menú auto (checkbox) con estilo propio; las de personaje son campos hundidos.

## Márgenes
12. Lateral útil: inventario 22, personaje ~20, auto ~28, diario ~28. Cabecera 20 en todas, pero el primer contenido empieza en 26..44 según ventana.
13. Auto mini mide 230x96 y misión mini 230x174: mismo ancho, marcos de distinta altura.

## Recomendación
Primero unificar botones (1-4), luego regla de bolas (5) y cabecera (6), y al final fondo/texto (8-9).
