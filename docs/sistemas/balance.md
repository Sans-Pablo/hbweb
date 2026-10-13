# Balance del juego (v0.80.6)

INVENTO del port: el original tiene números fijos; aquí hay un único módulo de ajuste para que los administradores equilibren
magias, pets, habilidades de pet, monstruos y PvP sin tocar código. **Todo vale 1 por defecto = reglas del original** (`Bal.scale`
devuelve el valor intacto con ×1, sin cambiar el redondeo).

## Piezas
- `web/src/shared/balance.js` — configuración viva `BAL` + `setBalance(src)` (limpia: 0..20, vacíos = 1) + ayudantes `spellDmgMul(id)`, `spellManaMul(id)`, `fieldMul`, `healMul`, `pvpMul`, `meleeMul`, `monsterDmgMul(nombre)`, `monsterHpMul(nombre)`, `petDmgMul/petHpMul/petSkillMul(especie)`, `scale(v, m, round)`.
- `web/data/balance.json` — valores por defecto del servidor y del modo local (no generado; se edita con la página o a mano).
- `server/server.mjs` — `GET/POST /api/admin/balance?token=…` (solo loopback + token). El POST aplica en caliente y guarda en `saves["sys:balance"]`, que prevalece sobre el JSON al arrancar.
- `web/admin/balance.html` — página de edición: pestañas Globales, Hechizos (con daño/maná, daño por maná y «vs mediana»), Monstruos, Pets, Habilidades de pet y Escuelas; exportar/importar JSON. Enlace desde `/admin`.

## Dónde se aplica
| Mando | Punto de aplicación |
|---|---|
| `spells[id].dmg` · `global.playerSpell` | `magicsys.js` daño de magias de ataque |
| `spells[id].mana` · `global.spellMana` | `magic.js manaCost(p, spell, id)` |
| `global.heal` | curas en `magicsys.js` |
| `global.field` | `fields.js hit()` (campos de fuego, nubes…) |
| `global.playerMelee` | `combatsys.js` golpe del jugador a monstruos |
| `global.pvp` | `combatsys.js` daño jugador→jugador |
| `global.monsterDmg` · `npcs[nombre].dmg` | `combatsys.js` monstruo→jugador; también sus hechizos (`npcsys.js explode`: Cíclope, explosivos) y las brasas de jefes (`bosses.js`) |
| `global.monsterHp` · `npcs[nombre].hp` | `npcsys.js spawnFrom` (al nacer) |
| `global.petDmg/petHp` · `pets[sp]` | `companion.js statsOf` |
| `global.petSkill` · `petSkills[sp]` | `petskill.js` daño de la habilidad |
| `schools.{hp,mp,dmg}` | `TIER_MULT` de `schools.js` (tier 2) |

No cubierto aún: arena, bots y `psychic.js`.

## Ajuste inicial (balance.json)
Basado en `magias-diseno.md` §8: Mass Fire Strike (61) ×0.85 daño, Mass Chill Wind (63) ×1.3 daño, escuelas `mp` 1.6 → 1.3.
Círculos 9-10: **no se tocan**. Que a nivel ≤ 50 sean casi imposibles de lanzar sale de las fórmulas originales (`MC_PROB`, `MC_PENALTY`, ajuste por nivel) y el original los pensó para nivel 100+; se mantienen tal cual, solo las escuelas los usan. Si hiciera falta, el maná de cada uno se puede ajustar en la pestaña Hechizos, pero no se cambia por defecto.

## Prueba
`tests/balance.test.mjs` (neutralidad en 1, cada mando escala lo suyo, limpieza de valores).
