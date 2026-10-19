# Bots y ventanas, obs. 38-44 (v0.85.85)
- Int del guerrero (`builds.js` `warInt`, `WAR_INT_CHOICES` 32/20/10/59): estable por id; `p.bot.warInt` lo fuerza. El estudio (`WAR_STUDY` en botmagic.js) incluye Berserk (50) y exige Int ≥ 20.
- Berserk propio: `plan()` lo lanza con objetivo a ≤4 casillas y cooldown 6 s, antes del corte de `noBuffZone` (vale en la granja). PFM propio con enemigo, cooldown 20 s.
- Mago: `CAST_RANGE` 9; la espera (hold) solo dentro de alcance; pociones de maná también con objetivo vivo; huida a ≤3 casillas (PvP pasos×7, NPC ×6).
- PvP: PFM/Paralyze/Berserk como un usuario (`support`/`utility` ya no exigen mago enemigo).
- Interfaz: Opciones estilo F1 (`optwin.js`), mini ventana clásica y autocaza por ciudad (`autoplay.js` CITIES/cityOf, `autowin.js`).
- Tests: bot-obs38-44, autoplay, bot-pvptactics, botsmart. Sin verificar en pantalla: UI de 41-43 y conducta en mundo vivo.
