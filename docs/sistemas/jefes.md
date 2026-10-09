# Mecánicas únicas de los jefes (v0.17.0)

Invento del port (el original no tiene jefes de mazmorra). Código: `shared/systems/bosses.js`; ganchos en `npcsys.js` (`npcThink`, `petHurt`, `killNpc`, `companionHurt`), `combatsys.js` (`damageNpc`, `npcStrikes`), `fields.js` y `world.js` (ralentización por hielo). Pintado: `client/renderer.js` (`drawBossFx`, tintes y aros). Los números están al principio de `bosses.js`.

Todo lo visual vive en `w.bfx` (zonas de aviso, brasas, suelo helado, rugido, salto, vínculo de drenaje) y en banderas de las entidades (`shield`, `clone`, `crystal`, `hasClones`, `wrath`). Los auxiliares (`aux`, con `owner`: huesos, clones, cristales) mueren con su jefe, no dan botín ni experiencia y no cuentan como enemigos del nivel.

| Jefe | Mecánicas |
|---|---|
| 1 Carmesí (nivel 5) | **Furia**: hasta 2× más rápido al perder vida; rugido que aturde 1 s al 50 % y al 25 %. **Brasas**: aviso de 1,2 s y 3×3 casillas de fuego durante 6 s bajo un jugador o compañero (cada 6 s; 3,5 s bajo el 50 %). **Huesos**: 3 esqueletos por cada 20 % perdido; cada uno que muere cura el 3 % al jefe. Mantiene el Fire Field de la v0.13. |
| 2 Umbrío (nivel 10) | **Salto a la espalda** (aviso 0,6 s, cada 7 s; 5 s bajo el 50 %). **Drenaje**: enlaza a un compañero (o jugador) 6 s; roba el 4 % de su vida por segundo y cura al jefe; se rompe a más de 10 casillas. **Clones** al 75 % y 40 %: 2 clones con poca vida; con clones vivos el real recibe el 35 % (aro violeta bajo sus pies). |
| 3 Glacial (nivel 15) | **Suelo helado** 14 s (radio 2/3/4 según la vida): +50 % de tiempo por paso. **Congelación** del compañero 3 s (a un jugador sin compañero: parálisis 1,5 s); un jugador a ≤2 casillas lo libera en 1 s. **Escudo de hielo** al 80/55/30 %: inmune hasta destruir 3 cristales (sprite del mineral 2 de `item-dynamic`); al romperse queda aturdido 2,5 s. |
| 4 Dorado (nivel 20) | **Fases**: >66 % brasas, 33–66 % salto + drenaje, <33 % suelo helado (r 3), escudo de hielo al 20 %. **Contador de furia**: cada golpe que acierta sube hasta 10 niveles: +5 % daño y +15 % oro del botín (monedas en el suelo: nivel × 400). **Aura reflectante**: el 30 % del daño de hechizo vuelve al lanzador (los compañeros de la rama Warrior no lo sufren). |

Herramientas: F1 → Herramientas → «vida del jefe» fija la vida del jefe más cercano para provocar fases. Test: `tests/bosses.test.mjs`.
