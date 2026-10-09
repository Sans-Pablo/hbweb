# Combate

Código: `shared/combat.js` (fórmulas puras), `shared/rules.js` (dados, acierto), `shared/systems/combatsys.js` (golpes, daño, XP, muerte).
Origen: `HGServer/Game.cpp` `iCalculateAttackEffect` (línea ~52318). Auditado en octubre de 2026.

## Jugador → monstruo (comprobado)
- Sin arma: `1d(str/12)`, acierto = maestría de puños. Con arma cuerpo a cuerpo: dados + bonus del arma, luego `+ str/5 %` redondeado. Arco: dados + `1d(str/20)`.
- Acierto: `+50` base, `+(dex-50)` si dex > 50, `+AddAR`. Probabilidad = `(acierto / defensa) * 50`, entre 15 y 99; por la espalda la defensa se divide entre 2.
- Furia (berserk): daño ×2 en golpes normales. Escudo de defensa del objetivo: +40 / +100 de defensa (solo cuerpo a cuerpo). Protección contra flechas: el arco falla.
- Armas con bonus fijo: varitas de furia 732/738 +1; 847 de noche y 848 de día +4 (`w.dayOrNight`: 1 día, 2 noche).
- Daño físico extra (`addPhys`) se suma antes del mínimo de 1; después el combo (`___iCAB*`) y `AddCD` desde el segundo golpe.
- Hambre ≤ 10 o sin aliento: 1/10 de fallar. Un fallo reinicia el combo.
- Monstruo: usa el daño pequeño o grande según su tamaño; los "absorbentes" restan el % de `absDamage`; `actionLimit` 1/2 son invulnerables.
- Experiencia por golpe = daño hecho, hasta agotar `noDieRemainExp`; habilidad de arma +1 por golpe, `1d(dados de golpe)` al matar (×2 con ≤ 3 de vida).
- Contraataque: con 1/3 el monstruo herido se vuelve contra el atacante; si ya persigue a otro, solo cambia si el atacante está igual o más cerca.

## Monstruo → jugador (comprobado)
- Dados de `NPC.cfg`; acierto contra defensa (+40/+100 con escudo); furia duplica el daño.
- Resta `1d(vit/10) - 1`; la parte del cuerpo se tira en 10000 (50 % cuerpo, 25 % piernas, 15 % brazos, 10 % cabeza); absorción de armadura tope 80 %; el escudo absorbe con probabilidad = maestría de escudo.
- Desgaste de la pieza alcanzada y del escudo (solo con bando).
- Atributos de armadura: maná por daño (`transMana`) y carga de crítico (`chargeCrit`).

## Clima
La lluvia reduce el acierto de los arcos (5/10/25 %) y aumenta el desgaste de las armas cuerpo a cuerpo; ver [mundo.md](mundo.md).

## Pendiente (no portado)
- Ataque crítico / super ataque (modos 20–30, `m_bSuperAttackMode`, maestría 100) y ataque en carrera (`bIsDash`).
- Retroceso (≥ 40 de daño físico sobre el jugador) portado: `knockback` en combatsys; falta en monstruos con `actionLimit 4`.
- Reputación (Kloness), zonas de lucha, PvP, habilidades especiales (`SpecialAbility`).

## Pruebas
`tests/combat.test.mjs` (acierto, dados, furia, escudos, protección de flechas, bonus, mínimos, combo, absorción) y `tests/sim.test.mjs` (simulación completa).
