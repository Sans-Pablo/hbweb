# Tercera ciudad / tercer bando — análisis de viabilidad

Estado: **solo análisis** (2026-10-16, v0.85.25, sin cambios de código). Pedido: evaluar una tercera ciudad además de Aresden y Elvine.

## 1. Veredicto corto
- **El original NO tiene tercer bando.** Solo existen `ARESDEN`, `ELVINE` y `NEUTRAL` (viajero). Una tercera facción es **invención nuestra**, no portado: choca con la regla de fidelidad (§6) y debe marcarse INVENTO en `docs/DESVIOS.md`.
- **Técnicamente viable y barato en lógica, caro en contenido.** El port ya modela el bando como número (`side` 0 = viajero, 1 = Aresden, 2 = Elvine) y casi todas las reglas son comparaciones de igualdad (`a.side === b.side`, `side !== 0`): un `side 3` funciona gratis ahí. Lo caro: mapas, NPC, equipo, textos, bots y todo lo que hoy asume «el otro bando» o solo 1/2.
- **Recomendación:** empezar por la **ciudad neutral (alternativa B)**, coherente con el original (el viajero/`neutral` existe) y de ~1,5-2 semanas. El tercer bando completo (C) solo si se decide explícitamente que el juego se aparta del original en esto.

## 2. Qué dice el original
Fuente: `C:\Users\sansp\Documents\HelbreathOriginal`.
- Constantes: `NPC_GUARDB_ARESDEN = 99`, `NPC_GUARDB_ELVINE = 100` (`Shared/npcType.h`); `char/Unit.h:44 IsNeutral()` → `m_side == NEUTRAL`. `STATUS_ARESDEN` aparece comentado en `Shared/common.h:73` (el bando viaja en bits de estado del paquete de dibujo: solo caben 2 bandos + neutral).
- `HG.cpp`/servidor: ~109 referencias a `ARESDEN`, ~108 a `ELVINE`, 25 a `NEUTRAL`, 186 a `m_side`. Todo el servidor asume dos bandos explícitos (`m_stCityStatus`, torres/banderas de Heldenian `m_iHeldenianAresdenLeftTower…`, cruzada, crímenes por ciudad, `sideMapJail`).
- `Config/Teleport.cfg`: columnas `side` (`aresden|elvine|attacker|defender`), `neutral?`, `crim?`. Es tabular y el port la lee (`teleport.js` `SIDE_NAME`), así que un tercer nombre entra sin código nuevo en rutas.
- Sirve de referencia para una ciudad neutral: viajeros (tope nivel 50: `NOTIFY_MSG_HANDLER64 "Travelers cannot level up to 51. Become a citizen."`), rutas `neutral=TRUE`, mapas sin dueño (Middleland, Astoria, Abaddon).
- Lo que **impide** el tercer bando fiel: nada lo define (ni mapas, ni guardia, ni equipo de bando 3, ni textos). Todo sería invento.

## 3. Dónde está codificado el 2-bandos en hbweb (v0.85.25)
Búsqueda: `\bside\b` ≈ 153 usos en `web/src` + `server`; «aresden/elvine» ≈ 550 líneas (con tests y datos).

| Área | Archivos | Qué asume |
|---|---|---|
| Creación | `client/create.js:49` | selector rota 1↔2 (`v<1?2:v>2?1`), nombre `side===1?Aresden:Elvine` |
| Personaje | `shared/systems/player.js:44,62,107,147` | `side: c.side===2?2:1` (**fuerza 1 o 2: un 3 caería a Aresden**); se guarda y carga en saves |
| Mundo/spawn | `shared/adventure.js:167,176,178,210` | `homeOf(p)` = elvfarm si 2, si no arefarm; residentes `idx>=20 → 2` (20+20) |
| PK/cárcel | `systems/pk.js` (`JAIL_MAP`, `OWN_CITY`, `w.crimes={1:0,2:0}`) | tablas fijas por bando |
| Teleports | `systems/teleport.js` (`SIDE_NAME={1,2}`) | nombre del bando → fila de Teleport.cfg |
| Combate/PvP | `systems/combatsys.js:76,99,107,129,383` | igualdad y `!==0`: **valen con 3 bandos** |
| Magia | `systems/magicsys.js:260,281,307,323,335` | igualdad con el lanzador: valen con 3 |
| Guild | `systems/guild.js:38,42,52` | `side===1\|\|side===2` para fundar (ampliar); mismo bando para invitar: vale |
| Chat de bando | `world.js:181`, `server.mjs:719` | filtra por `v.side===me.side`: vale |
| Render/nombre | `client/renderer.js:670`, `client/dialogs.js:36`; `server.mjs:633` (`o.sd`) | cadena fija «Aresden/Elvine Combatant»/Traveller; `sd` es número libre |
| Observador/paneles | `client/observer.js`, `dashboard.js`, `watchpanel.js`, `server.mjs:654` | columnas/orden/colores por 2 bandos |
| Bots/residentes | `systems/residents.js` (21 refs), `bot.js`, `autoplay.js`, `citizens.js` | ciudad por bando, reparto 20+20 |
| Tutorial/quests | `systems/tutorial.js`, `quests.js` | textos y rutas por ciudad |
| i18n/lore | `client/i18n.js`, `tools/magia_lore.mjs` | textos de las dos ciudades |
| Mapas | `web/data/maps/` (169; **40 con prefijo are/elv**: ciudad, `brk11-22`, farm, `uni`, `wrhus`, `jail`, `d1`; compartidos `bsmith_*`, `cityhall_*`, `cmdhall_*`, `gldhall_*`, `gshop_*`, `cath_*` con sufijo `_1/_2` = bando) | cada ciudad ≈ 20 mapas |
| Tests | ~25 tests citan Aresden/Elvine (`maps, pvp, farm-side, create-side, hero, sky, exits, residents-*, net-*`) | fixtures de 2 bandos |

El port **no tiene** Crusade, Heldenian ni Apocalypse (`DESVIOS.md:17,90`, `AUDITORIA_DATOS.md:26`). Eso abarata el tercer bando (no hay guerra que triplicar) pero también significa que hoy la «guerra de bandos» se reduce a PvP en zonas de lucha.

## 4. Coste por área (alternativa C, tercer bando completo)
Días de trabajo con el flujo actual (agente + verificación en navegador).

| Área | Trabajo | Días |
|---|---|---|
| Mapas/terreno | Ciudad + ~15-20 mapas (barracks, almacén, herrero, tienda, catedral, cityhall, cárcel, granja, uni, mazmorra d1). Reetiquetar `.bin` existentes es rápido; ciudad con terreno propio = diseño | 6-12 |
| Spawns | `*.spawns.json` por mapa (generador: `spawns.md`); guardia propia sin sprite original (reutilizar skin) | 1-2 |
| NPC y shops | Duplicar NPC de ciudad (tienda, herrero, almacén, mago, hospital, William/Gail) y `shops.json`; ~12 NPC | 2-3 |
| Quests | Reapuntar cadenas por ciudad (`quests.js`, actos) | 1-3 |
| Items/equipo de facción | Tercer set con requisito de bando + sprites HD (regla «Siempre HD»); diseño nuevo | 4-8 |
| PvP/reglas | Ya vale por igualdad; revisar cárcel/crímenes/reputación, `fightZone` | 1-2 |
| Crystals/Heldenian/Apocalypse | No existen en el port. Si se portan, **N=3 rompe su diseño 1v1** (dos torres/banderas, atacante/defensor) | 0 ahora (+10-20 futuro) |
| Cliente UI/sprites/textos | Selector de 3 bandos, cartel de nombre, color de bando, chat, i18n ES/EN, minimapa, observador/paneles | 2-4 |
| Servidor/persistencia/migración | `side` ya persiste como número; corregir clamp 1/2 (`player.js:44,107`); subir versión de save/`PROTO`; los 1/2 existentes no cambian; opcional comando admin «cambiar bando» | 1-2 |
| Bots/residentes | 40 residentes 20+20 → repartir en 3, `spawnResident`, `homeOf`, informes de bots | 2-3 |
| Tests | Parametrizar ~25 tests + nuevos (create-side, pvp triple, exits, teleports, saves) | 2-4 |
| Docs | ESTADO, DESVIOS (INVENTO), fichas | 1 |
| **Total C** | | **≈ 25-45 días** (5-9 semanas) |

## 5. Alternativas
**A) Una ciudad más sin bando (hub de viajeros)** — ≈ 6-12 días. `side` sigue 0/1/2; los viajeros la usan de hogar. Pros: casi no toca código; encaja con `neutral=TRUE`. Contras: sin identidad de facción, solo contenido de mapas.

**B) Ciudad neutral con reglas propias (zona segura/mercado/puerto)** — ≈ 8-15 días (**recomendada**). PvP deshabilitado dentro, tiendas abiertas a ambos bandos, teleports `neutral=TRUE`, comercio (`trade.js`). Pros: coherente con el original; resuelve «un sitio donde se juntan los dos bandos»; no rompe nada. Contras: no es una tercera facción.

**C) Tercer bando completo** — ≈ 25-45 días. Pros: es lo pedido; el `side` numérico lo soporta. Contras: INVENTO; el cliente original solo contempla 2 bandos; arte nuevo (mapas, guardia, equipo); balance 3 vías (dos contra uno) sin Crusade que lo regule; futura guerra no encaja.

**D) Tercer bando «ligero»: etiqueta `side 3` sin ciudad propia** — ≈ 5-8 días (mercenarios/neutrales armados que viven en la ciudad de B). Pros: barato, reutiliza B. Contras: bando sin territorio; sigue siendo invento.

## 6. Riesgos
1. **Fidelidad:** C y D son invento. Mitigar: marcar en DESVIOS.md y flag en `balance.json` para desactivar.
2. **Degradación silenciosa:** `player.js:44` y `create.js:49` envuelven a 1/2: un side 3 acabaría en Aresden si no se corrige **antes** de crear contenido.
3. **Desequilibrio:** 3 bandos con 40 bots y pocos jugadores → ciudades vacías, dos contra uno. Mitigar con bots por bando y tope.
4. **Arte HD:** cada pieza nueva de equipo/NPC necesita versión HD visible en localhost.
5. **Guerra futura:** Crusade/Heldenian/Apocalypse asumen 2 bandos.
6. **Mapas `_1/_2`:** el sufijo es el bando; un tercero necesita `_3` y que los tests de mapas/salidas lo admitan.
7. **Datos:** `guild.side`, `w.crimes`, `JAIL_MAP/OWN_CITY`, informes de bots → leer 1/2/3 con default seguro.

## 7. Fases propuestas
1. **F0 Decisión + marca de INVENTO** (0,5 d): elegir A/B/C/D; DESVIOS.md; flag en `balance.json`.
2. **F1 Bando como dato** (2-3 d): ensanchar `side` a 1..3 (player, create, guild, teleport, pk, crimes, cárcel), migración de saves con default seguro, pruebas de igualdad en combate/magia/chat. Sin contenido.
3. **F2 Ciudad base** (B/A: 6-10 d; C: 8-15 d): mapas, spawns, NPC, tiendas, teleports; tests `maps`, `exits`.
4. **F3 Bots/residentes** (2-3 d).
5. **F4 UI/textos/i18n/sprites HD** (3-6 d).
6. **F5 Equipo y misiones de bando** (solo C, 5-10 d).
7. **F6 Tests y verificación en navegador** (2-4 d); documentación.

Estimación: **B ≈ 1,5-2 semanas · D ≈ 1-1,5 semanas · A ≈ 1-2 semanas · C ≈ 5-9 semanas** (≈ 4-5 si se reutilizan tiles y sprites de las ciudades existentes).

## 8. Preguntas abiertas
1. ¿Prima la fidelidad (→ B) o una facción nueva real (→ C)?
2. ¿Nombre, lore y estética de la tercera ciudad?
3. ¿Habrá guerra futura (Crusade/Heldenian)? ¿Cómo se reparte en 3?
4. ¿Se aceptan mapas reutilizados/reetiquetados en el primer release?
5. ¿Cuántos bots por ciudad?
