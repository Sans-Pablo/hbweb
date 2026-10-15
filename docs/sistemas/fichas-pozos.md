# Fichas de objeto y pozos (ticket 14, v0.84.9)
- `gui.itemTooltip` (client/gui.js): cabecera dorada con icono y nombre (color de rareza), línea de daño/defensa en negrita, bonificaciones en verde, y tras un separador peso/fuerza/durabilidad atenuados. Los textos son los de `hud.describe`; no hay cadenas nuevas.
- `renderer.pitMob` (client/renderer.js): mini sprite del Skeleton (`miniOf`) sobre cada puerta `target:"down"` de la cripta; aro del color de `BOSS_COLORS` si el piso siguiente es de jefe (cada 5); atenuado si el pozo está cerrado.
- Original: el formato «Olympia» no está en el código original; la disposición es propia. Test: `tests/fichas-pozos.test.mjs` (estático).
