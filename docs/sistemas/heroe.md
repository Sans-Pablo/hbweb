# Conjunto de héroe y bonos de daño mágico

Original: `HG.cpp` `CheckHeroItemEquipped` (ids de `items.h` 403-426) y `combat.cpp:211`.

- `inventory.heroBonus(p)`: casco+coraza+brazales+pantalón del mismo bando/sexo → `eff.hero` = 1 (guerrero) o 2 (mago).
- Héroe 1: +100 acierto y +5 daño (S/M y L) en `combat.js`.
- Héroe 2: +4 al daño de hechizo. `addMagicPct` (arma ManaSave v5=1) suma `dmg*pct/100`. Zona de lucha: +1/3.
- Orden en `magic.spellDamage`: dados+k → Mag/3.3 % → héroe → addMagic → % → zona de lucha.
- Test: `tests/hero.test.mjs`.
