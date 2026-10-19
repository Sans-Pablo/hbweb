# Bots más listos (0.85.61) — INVENTO del port

Cinco reglas aprobadas desde `docs/observaciones.json`:
1. **Puerta de preparación** (`bot.js readyToHunt`): sin arma o con equipo mejor en la mochila no sale a cazar hasta agotar 3 recados (`b.prep`); después sale con `b.gearGap` y solo ataca presas fáciles (ratio ≥ 3). Los residentes quedan fuera.
2. **Cíclope → PFM**: `worthBuff` suma `magicLevel·1.5` (×3 jefe) de los lanzadores hostiles cercanos; ≥ `BUFF_MIN` (6) justifica PFM/AMP.
3. **Escudo de Defensa**: ya no es defensivo; solo contra-PFM en PvP mientras espera.
4. **`worthBuff(w,p,range)`** decide PFM/AMP en combate, `plan()` y guerreros.
5. **Hechizo por eficiencia** (`spellValue`, `cheapest`): menor coste de maná para matar (daño × resistencia × absorción × probabilidad de lanzar); empate ±10 % → menos lanzamientos.

Test: `tests/botsmart.test.mjs`.

## v0.85.62
Recall propio (botmagic.recallSelf), sin buffs en granja (noBuffZone), cura por vida que falta (bestHeal) y huida con 5+ enemigos (swarmed), SP compartido (23/28),
magos que esperan maná en vez de usar el báculo (hasAttack), descasteo (magicsys castTok + combatsys damagePlayer, evento castbreak) y reparto de stats
(builds.allocate: requisitos → Dex/Mag en decenas → Vit; reinicio único con statV en player.js y RESET_V=5 en residents.js).

## 0.85.63
- botitems.isJunk: equipo que no mejora y vale <150 se vende con 14+ objetos en la mochila.
- residents.helpAlly: el PL acude a aliados con enemigos cerca antes de ir al foso.
