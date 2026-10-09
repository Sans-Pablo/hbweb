# Voz (personalidad)
Invento del port: el original no habla. No toca reglas, solo pinta burbujas de chat.
- Datos: `web/data/voice.json` (generado, versionado; frases `es`/`en`, `tone` w/j/d). Lógica: `client/voice.js` (sin DOM). Test: `tests/voice.test.mjs`.
- Personaje: tono y charlatanería salen del hash del nombre. Elige frases evitando las 3 últimas; probabilidad × charlatanería; enfriamiento por clave.
- Disparadores: eventos `purchased/nogold/sold/repaired/bankfull/cantcarry/broken/levelup/death/damage(<25%)/time/weather`; abrir menú de NPC (`noteNpc`, 60 s por NPC); entrar en cripta; cercanía de un generador (rect ±9, una vez por visita, 35%); charla de fondo cada 50–120 s.
- Pit: frase por nombre de monstruo (60%) o por peligro `hitDice / max(20, maxHp/2.5)`: <0.6 fácil, <1.3 parejo, resto mortal.
- Habitantes: respuesta diferida (~0,9 s) por rol (shop/blacksmith/warehouse/mage/town) y murmullo si estás a ≤6 casillas. Burbuja `#ffe9a8` (renderer, rama mobs).
- Añadir frases: editar el generador y regenerar; toda frase lleva `es` y `en`.
