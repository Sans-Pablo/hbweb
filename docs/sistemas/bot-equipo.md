# Equipo y estadísticas de los bots (0.85.48)
- **Fuerza de arma**: `builds.js swingStr` = max(peso/100, velocidad*13); `allocate(p,total,need)` cubre primero esa Str; `ilv` penaliza armas sin Str.
- **Bonos**: `bonusScore` suma al item level los atributos que busca cada clase (mago HP/MP/DR/PA; guerrero HP/DR/PA/MA/MR); contra mago pesa MA/MR, contra físico PA (`b.foeKind`).
- **Sin desnudos**: `usable` exige los requisitos Str/Dex/Int de cascos y armaduras.
- **Sin pociones**: la poca vida sin pociones lanza Recall (también fuera de cripta/PvP) y vuelve a comprar; ya no "descansa" en el campo.
- **Mago puro**: no pega con la vara (se aparta/espera maná) salvo contra magos o con Absolute Magic Protection.
Test: `tests/bot-gear.test.mjs`.
