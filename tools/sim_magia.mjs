// Genera docs/sistemas/magias-diseno.md: catálogo, fórmulas, lore (INVENTADO), simulaciones y guía de equilibrio de los hechizos.
// Usa los módulos reales (magic.js, schools.js, rules.js) y los datos convertidos (magic.json, npc.json): lo que sale aquí es lo que calcula el juego.
// Uso: node tools/sim_magia.mjs        (regenera el documento; las tablas siempre salen de los datos)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../web/src/shared/magic.js";
import * as Sch from "../web/src/shared/systems/schools.js";
import { npcHP } from "../web/src/shared/rules.js";
import { LORE } from "./magia_lore.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const magic = JSON.parse(fs.readFileSync(path.join(root, "web/data/magic.json"), "utf8"));
const npcs = JSON.parse(fs.readFileSync(path.join(root, "web/data/npc.json"), "utf8"));
const ids = Object.keys(magic).map(Number).sort((a, b) => a - b);

// ---------- utilidades ----------
const avg = (n, d, k) => n * (d + 1) / 2 + k;
const f1 = x => (Math.round(x * 10) / 10).toString();
const f0 = x => Math.round(x).toString();
const pc = x => Math.round(x * 100) + "%";
const ELEM = { 0: "—", 1: "Tierra", 2: "Rayo", 3: "Fuego", 4: "Hielo" };
const ATTACK = new Set([1, 3, 19, 21, 22, 23, 25, 26, 28, 30]);
const circle = M.circleOf;
const table = (head, rows) => ["| " + head.join(" | ") + " |", "| " + head.map(() => "---").join(" | ") + " |", ...rows.map(r => "| " + r.join(" | ") + " |")].join("\n");
function rngSeed(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// partes de daño de un hechizo de ataque (espejo de magicsys.js → resolve)
function parts(sp) {
  const c3 = [sp.v4, sp.v5, sp.v6], a3 = [sp.v7, sp.v8, sp.v9];
  const t = sp.type, ok = a => a[0] > 0 && a[1] > 0;
  let c = null, a = null, line = false;
  if (t === 1) c = c3;
  else if (t === 3 || t === 22) { c = c3; a = a3; }
  else if (t === 19 || t === 30 || t === 26) { c = c3; a = a3; line = true; }
  else if (t === 21 || t === 28) a = a3;
  else if (t === 23 || t === 25) a = c3;
  if (c && !ok(c)) c = null;
  if (a && !ok(a)) a = null;
  return { c, a, rx: sp.v2, ry: sp.v3, cells: (2 * sp.v2 + 1) * (2 * sp.v3 + 1), line };
}
const magF = mag => 1 + mag / 330;                                      // spellDamage: +mag/3.3 %
const dmgOne = (sp, mag, mult = 1) => { const p = parts(sp); return ((p.c ? avg(...p.c) : 0) + (p.a ? avg(...p.a) : 0)) * magF(mag) * mult; };
const dmgArea = (sp, mag, mult = 1) => { const p = parts(sp); return (p.a ? avg(...p.a) : 0) * magF(mag) * mult; };
const dmgN = (sp, mag, n, mult = 1) => dmgOne(sp, mag, mult) + (n - 1) * dmgArea(sp, mag, mult);
const hitP = (power, rr) => { rr = Math.max(1, rr); return Math.max(M.MIN_HIT ?? 15, Math.min(M.MAX_HIT ?? 99, Math.floor(power / rr * 50))) / 100; };
const mk = (level, mag, skill, int) => ({ level, stats: { mag, int }, skills: { 4: skill }, eff: { addAR: 0, castBonus: 0, addMagic: 0 } });
const PROF = { A: mk(20, 60, 40, 60), B: mk(50, 120, 80, 120), C: mk(50, 200, 100, 200) };
const PROF_NAME = { A: "A · novato (nv 20, Mag 60, Int 60, habilidad 40)", B: "B · veterano (nv 50, Mag 120, Int 120, habilidad 80)", C: "C · archimago (nv 50, Mag 200, Int 200, habilidad 100)" };
const mp = p => 2 * p.stats.mag + 2 * p.level + Math.floor(p.stats.int / 2);
const attackIds = ids.filter(i => ATTACK.has(magic[i].type) && parts(magic[i]).c || ATTACK.has(magic[i].type) && parts(magic[i]).a);
const rrs = [5, 25, 50, 70, 100];

const out = [];
const P = (...s) => out.push(...s);

// =====================================================================================================================
P(`# Magias — documento base de diseño

> Generado por \`node tools/sim_magia.mjs\` a partir de \`web/data/magic.json\` (Magic.cfg) y de los módulos reales del juego
> (\`web/src/shared/magic.js\`, \`rules.js\`, \`systems/magicsys.js\`, \`schools.js\`, \`fields.js\`, \`psychic.js\`). Las **tablas son calculadas**: si cambia un
> número del juego, se regenera el documento y las cifras se corrigen solas. Los textos de **lore son INVENTADOS** por el port (el original no tiene historia
> de los hechizos) y van señalados como tales; las **fórmulas** salen del servidor original (\`PlayerMagicHandler\`, \`Effect_Damage_Spot\`,
> \`bCheckResistingMagicSuccess\`) salvo donde se diga «invento del port».

Contenido: 1 · Visión general · 2 · Fórmulas · 3 · Catálogo por círculo (65 hechizos) · 4 · Simulaciones · 5 · Escuelas de summons · 6 · Psíquicos · 7 · Guía de equilibrio · 8 · Hallazgos y pendientes.

---

## 1. Visión general

- **65 hechizos** en 10 círculos (\`circulo = floor(id/10)+1\`). Los ids son autoritativos: no se renumeran ni se inventan.
- Campos de \`Magic.cfg\` que usa el juego: \`type\` (qué hace), \`mana\`, \`v2..v12\` (parámetros según el tipo), \`reqInt\` (Int mínima para aprender), \`cost\` (oro del libro; \`-1\` = no se vende), \`category\` (1 ataque, 0 utilidad, 2 mejora), \`attr\` (elemento) y \`last\` (duración en s).
- **Elementos:** Tierra (1), Rayo (2), Fuego (3), Hielo (4); 0 = sin elemento. Hoy el elemento no cambia el daño (no hay debilidades elementales de monstruos); sirve para repartir los hechizos entre **escuelas de summons** (fuego, hielo, rayo).
- **Dos modos de lanzar** en el port: (a) el modo base del original, en el que el jugador lanza con su Int/Mag/habilidad (\`MAGIC_MODE.schools = false\`); (b) el modo del juego actual (\`schools = true\`): los hechizos de ataque de fuego/hielo/rayo los lanza el **summon de la escuela** con su propio maná y nivel, y el jugador pone Mag y el oro/Int para enseñarle (ver §5). Tierra y sin elemento no tienen escuela: los lanza el jugador.
- **Tipos de efecto** (resueltos en \`magicsys.js\` → \`resolve\`):

${table(["type", "Qué hace", "Hechizos"], [
  ["1", "Daño a un objetivo `dice(v4,v5)+v6`", "0, 37, 43, 56"],
  ["3 / 22", "Daño al centro (v4..v6) + zona rx=v2, ry=v3 (v7..v9)", "10, 20, 30, 38, 47, 61"],
  ["19 / 30", "Rayo en línea (centro v4..v6, línea y zona v7..v9)", "51, 70"],
  ["21", "Zona sin centro aparte (v7..v9)", "60, 74, 81, 82"],
  ["23", "Zona de hielo (v4..v6) + congelación `v10` s", "45, 57, 63, 72, 75"],
  ["25 / 26", "Zona (v4..v6) · Blizzard: línea de hielo", "64, 91 · 96 (tipo 30)"],
  ["28", "Rompe-armaduras: daño de zona; ignora el escudo de «protección contra magia»", "66"],
  ["2", "Curación `dice(v4,v5)+v6`", "1, 21"],
  ["5 / 7", "Resta / recupera Stamina (SP)", "11 · 23, 28"],
  ["11", "Escudos (`v4` = nivel de protección, dura `last` s)", "13, 24, 33, 44, 65"],
  ["12", "Hold / Paralyze (inmoviliza)", "25, 35"],
  ["13", "Invisibilidad (v4=1) / Detectar invisibles (v4=2)", "32, 34"],
  ["14", "Campos en el suelo (fuego, nube, pinchos, tormenta de hielo)", "40, 41, 46, 54, 55, 73"],
  ["16", "Confusión / Ilusión (solo contra jugadores)", "42, 62, 71, 80, 90"],
  ["17", "Veneno (v4=1) / Curar (v4=0)", "27, 53 · 36"],
  ["18", "Berserk (doble daño cuerpo a cuerpo)", "50"],
  ["29 / 31 / 32", "Cancelación · Inhibición · Resurrección", "76 · 83 · 94"],
  ["8 / 9 / 10 / 15 / 33", "Recall · Invocar · Crear comida · Posesión · Scan", "12 · 31 · 2 · 26 · 67"],
]).replace(/\|\s*—\s*\|/g, "| — |")}

---

## 2. Fórmulas (la base matemática)

Todo está en \`web/src/shared/magic.js\` y \`systems/magicsys.js\`. Notación: \`floor\` = parte entera; \`1d100\` = tirada de 1 a 100; \`d(n,r)\` = suma de \`n\` dados de \`r\` caras.

### 2.1 ¿Sale el hechizo? (\`castChance\`, solo cuando lo lanza el jugador)

\`\`\`
r = floor( habilidadMagia/100 * MC_PROB[círculo] )        MC_PROB = [-, 300, 250, 200, 150, 100, 80, 70, 60, 50, 40]
si Int > 50:  r += floor((Int - 50) / 2)
r = ajusteNivel(r, círculo, nivel)
r += bonoVaritas ("Special")
si r < 100: sale con probabilidad r % (tirada 1d100 <= r); r <= 0 cuenta como 1
\`\`\`

\`ajusteNivel\` (se usa dos veces: aquí y en el acierto), con \`lm = floor(nivel/10)\`:
- círculo = lm → sin cambio.
- círculo > lm → \`r - | v2 - floor(v1/v3 * v2) |\` con \`v1 = nivel - lm*10\`, \`v2 = |círculo-lm| * MC_PENALTY[círculo]\`, \`v3 = |círculo-lm| * 10\` (\`MC_PENALTY = [-, 5, 5, 8, 8, 10, 14, 28, 32, 36, 40]\`). Es decir: lanzar un círculo por encima de tu nivel es una penalización que se **amortigua** al acercarte al siguiente tramo de 10 niveles.
- círculo < lm → \`r + 5 * (lm - círculo)\` (los círculos bajos se vuelven fiables al subir).

Fallo extra: con hambre ≤ 10 o SP ≤ 0, un 10 % de fallo. En modo escuelas (§5) **el jugador no tira esta probabilidad**: el summon no falla.

### 2.2 Acierto contra la resistencia (\`castPower\` y \`resists\`)

\`\`\`
poder = habilidadMagia + (Mag > 50 ? Mag - 50 : 0)
poder = ajusteNivel(poder, círculo, nivel) + addAR                       (addAR: bono de equipo "acierto")
rr    = resistencia del objetivo (mínimo 1)
         monstruo: cfg.resistMagic
         jugador : habilidad[3] + addMR + (Mag > 50 ? Mag - 50 : 0)
dest  = floor( poder / rr * 50 ) , acotado a [15, 99]                    (MIN_HIT, MAX_HIT)
el objetivo RESISTE si 1d100 > dest        → P(impacto) = dest / 100
\`\`\`

Consecuencias: con \`poder = 2·rr\` ya impactas al máximo (99 %); con \`poder = rr/3\` estás en el suelo (15 %). **Un 1 % de resistencia siempre queda** (el tope es 99).
Notas: los hechizos con \`id >= 80\` y el tipo 28 suman +10000 al poder — pero \`resist()\` lo vuelve a restar: **no son irresistibles**, lo único que logran es saltarse el auto-resistir del escudo «Protección contra magia» (\`protect 2\`). \`protect 5\` (Absolute Magic Protection) resiste todo.

### 2.3 Daño (\`spellDamage\`, \`hurt\`)

\`\`\`
base   = d(n, caras) + k                       (n,caras,k = v4,v5,v6 para el centro; v7,v8,v9 para la zona)
daño   = floor( base + base * (Mag/3.3)/100 + 0.5 ) + addMagic                 ≈ base * (1 + Mag/330)
si va por escuela: daño = floor(daño * factorSpell * (tier2 ? 1.25 : 1) * levelPower(nivel del summon))
monstruo con absDamage%: daño = floor(daño - daño * absDamage/100)  (si queda < 0, vale 1)
protect 2 (Protección contra magia): daño / 2
\`\`\`

Cada casilla del área es una tirada **independiente** de resistencia y de dados. Los golpes de zona dan la mitad de experiencia (\`half\`) al que mata. No dañan a tus summons ni a los de tu grupo.

### 2.4 Maná, tiempos y límites

- \`maná = mana de Magic.cfg\`, reducido por \`manaSave\` % (mínimo 1) y **+20 con varita de tipo 34**.
- Reserva del jugador: \`maxMP = 2·Mag + 2·nivel + floor(Int/2)\`.
- Animación de lanzar: 16 fotogramas × 40 ms = **640 ms**; el servidor exige **1000 ms** entre lanzamientos → máximo **1 lanzamiento/s**. Alcance 14 casillas. Los hechizos de ataque no funcionan en zona segura; lanzar rompe la invisibilidad; el inhibido no puede lanzar.
- Sin escuelas: no se puede lanzar con escudo ni arma a dos manos, y la mano derecha debe estar libre o llevar varita (wtype 34–39).

### 2.5 Campos (\`fields.js\`, tic cada 1 s)

| Campo | Daño por tic a quien está dentro | Extra |
| --- | --- | --- |
| Fuego (1) | 1d6 | — |
| Tormenta de hielo (8) | 3d3+5 (media 11) | congela 20 s (salvo resistencia al hielo) |
| Nube venenosa (10) | 1d6 si \`v1<20\`, 1d8 si no | jugadores: 50 % de envenenar (\`1d(nivel)\` cada 12 s) |
| Pinchos (9) | solo se dibuja | — |

El daño de los campos es **fijo y no escala con la Magia** (no pasa por \`spellDamage\`) y **cada casilla del campo golpea por separado en radio** (fuego/nube radio 1, hielo radio 2): ver el hallazgo de solapes en §8.

Veneno: \`1d(nivel)\` de vida cada 12 s; probabilidad de curarse por tic \`habilidad[23] - 10 + addPR\` (mínimo 10 %). Resistencia al hielo del monstruo: \`max(1, resistMagic - floor(resistMagic/3))\` %; del jugador: \`addAbsWater·2\` %.

### 2.6 Experiencia de magia (SSN)
Cada lanzamiento sube la habilidad de Magia (\`gainSSN\`, cuatro intentos por lanzamiento). Más habilidad ⇒ más poder y más probabilidad de salir; es el motor de progresión de un mago «puro».

---
`);

// =====================================================================================================================
P(`## 3. Catálogo por círculo

Cada ficha trae: datos del cfg, qué hace en el port, **lore inventado** y la valoración de equilibrio (si es de daño). Convención: \`n×d+k\` = \`d(n,d)+k\`. «Zona» = lado del cuadrado afectado (\`(2·rx+1)×(2·ry+1)\`). Los daños se muestran **sin** bono de Magia (la columna de simulación los escala).
`);
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const dpmAll = attackIds.map(i => dmgOne(magic[i], 100) / magic[i].mana);
const dpmMed = median(dpmAll);
const CIRC_TITLE = { 1: "Primer círculo — Las Chispas", 2: "Segundo círculo — Las Brasas", 3: "Tercer círculo — El Juramento", 4: "Cuarto círculo — La Marea", 5: "Quinto círculo — El Velo", 6: "Sexto círculo — La Tormenta", 7: "Séptimo círculo — El Eclipse", 8: "Octavo círculo — La Ruptura", 9: "Noveno círculo — La Cumbre", 10: "Décimo círculo — Lo Innombrable" };
const CIRC_LORE = {
  1: "Lo que se enseña a los niños con talento en las aldeas: encender una vela, cerrar un rasguño, hacer pan de la nada. Nadie los llama «magia» en voz alta.",
  2: "Las academias de las ciudades piden aquí el primer juramento: el mago ya no juega, escoge un elemento y aprende su precio en maná.",
  3: "La frontera entre el aprendiz y el oficio. Los magos de campaña suelen detenerse aquí toda la vida: cubre lo que hace falta para sobrevivir y cobrar.",
  4: "Los hechizos de la marea cambian el terreno: campos, muros y escudos. Un buen mago de este nivel hace que el combate ocurra donde él quiere.",
  5: "Veneno, furia y velos. Es el círculo de los que ganan sin que se note: debilitan, confunden y esperan.",
  6: "Aquí la magia deja de pedir permiso. Rayos, tormentas y hielo que cae del cielo; las academias exigen testigos antes de enseñarlos.",
  7: "Los hechizos del eclipse dañan a muchos a la vez y vacían la reserva de maná de quien los lanza. Se dice que cada uno cuesta un año de vida.",
  8: "Romper armaduras, cancelar lo ya hecho, ver lo oculto. El octavo círculo no crea: deshace.",
  9: "Los que llegan aquí ya no estudian: dirigen. El noveno círculo se lanza con el nombre del mago y el poder de quien lo escucha.",
  10: "Se enseña una vez, a una sola persona, y no se escribe. Los pocos que lo conocen prefieren no ser preguntados.",
};
for (let c = 1; c <= 10; c++) {
  const list = ids.filter(i => circle(i) === c);
  if (!list.length) continue;
  P(`### ${CIRC_TITLE[c]}\n\n*Lore (inventado):* ${CIRC_LORE[c]}\n`);
  for (const i of list) {
    const sp = magic[i], p = parts(sp), cat = sp.category === 1 ? "ataque" : sp.category === 2 ? "mejora" : "utilidad", L = LORE[i] || ["", ""];
    const dm = p.c || p.a ? dmgOne(sp, 100) : 0;
    const eff = (dm / sp.mana) / dpmMed;
    const verdict = !(p.c || p.a) ? "" : eff > 1.5 ? " · **eficiente** (+)" : eff < 0.6 ? " · **ineficiente** (−)" : "";
    P(`#### ${i} · ${sp.name}  \`type ${sp.type}\` · ${cat} · ${ELEM[sp.attr]}`);
    const facts = [`maná **${sp.mana}**`, `Int mín. ${sp.reqInt}`, sp.cost < 0 ? "no se vende" : `libro ${sp.cost} oro`];
    if (sp.last) facts.push(`dura ${sp.last} s`);
    if (sp.delay) facts.push(`retardo ${sp.delay}`);
    if (p.c) facts.push(`centro ${p.c[0]}d${p.c[1]}+${p.c[2]} (media ${f1(avg(...p.c))})`);
    if (p.a) facts.push(`zona ${2 * p.rx + 1}×${2 * p.ry + 1} · ${p.a[0]}d${p.a[1]}+${p.a[2]} (media ${f1(avg(...p.a))})`);
    if (p.line) facts.push("línea de impacto");
    if (sp.type === 23 || sp.type === 26) facts.push(`congela ${sp.v10} s`);
    if (sp.type === 17 && sp.v4 === 1) facts.push(`veneno nivel ${sp.v5}`);
    P(`- ${facts.join(" · ")}`);
    if (p.c || p.a) P(`- Un objetivo (Mag 100): **${f1(dm)}** · por maná **${f1(dm / sp.mana)}** (mediana de ataque ${f1(dpmMed)})${verdict}`);
    if (L[1]) P(`- **Efecto:** ${L[1]}`);
    P(`- *Lore (inventado):* ${L[0] || "—"}\n`);
  }
}
P("---\n");

// =====================================================================================================================
P(`## 4. Simulaciones de daño

Perfiles de lanzador usados (se aplican las funciones reales \`castChance\` / \`castPower\` / \`manaCost\`):

${Object.keys(PROF).map(k => `- **${PROF_NAME[k]}** — reserva de maná ${mp(PROF[k])}.`).join("\n")}

### 4.1 Daño, zona y eficiencia de todos los hechizos de ataque

\`dmg1\` = un objetivo situado en el centro (centro + zona; Mag 100). \`dmg5\` = 5 objetivos dentro de la zona (el primero recibe todo, los otros 4 solo la zona). \`/maná\` = daño por punto de maná. \`/s\` = daño por segundo sostenido a 1 lanzamiento/s. \`bar\` = daño total con la reserva completa del perfil B.
`);
const rows41 = attackIds.map(i => {
  const sp = magic[i], p = parts(sp), d1 = dmgOne(sp, 100), d5 = dmgN(sp, 100, 5), bar = Math.floor(mp(PROF.B) / sp.mana) * d1;
  return [i, sp.name, circle(i), ELEM[sp.attr], sp.mana, p.c ? f1(avg(...p.c)) : "—", p.a ? f1(avg(...p.a)) : "—", p.a ? `${2 * p.rx + 1}×${2 * p.ry + 1}` : "1", f1(d1), f1(d5), f1(d1 / sp.mana), f1(d5 / sp.mana), f1(d1), f0(bar)];
});
P(table(["id", "hechizo", "círc", "elem", "maná", "centro", "zona", "área", "dmg1", "dmg5", "/maná (1)", "/maná (5)", "/s", "bar B"], rows41));
P(`
Lectura: el daño crece con el círculo, pero **no de forma proporcional al maná**: los hechizos de un solo objetivo de los primeros círculos tienen la mejor relación daño/maná (Magic Missile, Lightning Arrow), mientras que los de círculos altos compensan con zona. El coste por zona es lineal en celdas, así que contra grupos los de 5×5+ ganan.
`);

// ---- 4.2 acierto
P(`### 4.2 Probabilidad de impacto por círculo (hechizo lanzado por el jugador)

\`P(impacto) = clamp(floor(poder/rr·50), 15, 99) %\`. El poder baja al subir el círculo si el nivel no acompaña (§2.2). Filas = círculo del hechizo; columnas = resistencia mágica del objetivo (5 ≈ Slime/Dummy, 25 Orc, 50 Stone-Golem, 70 Ogre/Cannibal-Plant, 100 Demon/Unicorn/Hellclaw).
`);
for (const k of ["A", "B", "C"]) {
  const rowsH = [];
  for (let c = 1; c <= 10; c++) {
    const id = (c - 1) * 10, pw = M.castPower(PROF[k], id);
    rowsH.push([c, pw, ...rrs.map(r => pc(hitP(pw, r)))]);
  }
  P(`**Perfil ${PROF_NAME[k]}**\n`);
  P(table(["círc", "poder", ...rrs.map(r => `rr ${r}`)], rowsH) + "\n");
}
P(`Lectura: el círculo 9–10 con un archimago nivel 50 pierde casi todo el poder por el ajuste de nivel (\`castPower\` baja >100 puntos): el diseño del original asume jugadores nivel 100+ para esos hechizos. En el port (nivel máximo 50 en el acto 1) los círculos 8–10 solo son viables **vía escuelas** (§5), donde el summon aporta su propio poder.\n`);

// ---- 4.3 probabilidad de salir
P(`### 4.3 Probabilidad de que el hechizo salga (castChance)

Perfil B (veterano) por círculo y nivel de personaje; Int 120, habilidad 80. Valores ≥ 100 % salen siempre.
`);
{
  const lv = [10, 20, 30, 40, 50, 70, 100], rows = [];
  for (let c = 1; c <= 10; c++) rows.push([c, ...lv.map(L => { const p = mk(L, 120, 80, 120); const r = M.castChance(p, (c - 1) * 10); return r >= 100 ? "100%" : r + "%"; })]);
  P(table(["círc", ...lv.map(L => `nv ${L}`)], rows) + "\n");
  const rows2 = [];
  for (const sk of [20, 40, 60, 80, 100]) rows2.push([sk, ...[1, 3, 5, 7, 9].map(c => { const p = mk(50, 120, sk, 120); const r = M.castChance(p, (c - 1) * 10); return r >= 100 ? "100%" : r + "%"; })]);
  P(`Misma tabla variando la **habilidad** (nivel 50, Int 120): círculos 1, 3, 5, 7 y 9.\n`);
  P(table(["habilidad", "círc 1", "círc 3", "círc 5", "círc 7", "círc 9"], rows2) + "\n");
}

// ---- 4.4 mana to kill
P(`### 4.4 ¿Con qué hechizo se mata mejor a cada monstruo? (maná y tiempo hasta matar)

Para cada monstruo se calcula la vida media (\`npcHP\` con \`hitDice\`), la probabilidad de impacto real (con su \`resistMagic\`), la absorción \`absDamage\` y se elige el hechizo de ataque que **minimiza el maná esperado** para matarlo, con el perfil C (Mag 200, lanzado por el jugador, 1 objetivo). Sin sobre-daño ni regeneración del monstruo.
`);
{
  const rng = rngSeed(7), names = ["Slime", "Skeleton", "Orc", "Zombie", "Troll", "Cyclops", "Orge", "Liche", "Dark-Elf", "WereWolf", "Gagoyle", "Ettin", "Demon", "Unicorn", "Hellclaw", "Tigerworm", "Wyvern"];
  const rows = [];
  for (const nm of names) {
    const n = npcs[nm]; if (!n) continue;
    let hp = 0; for (let i = 0; i < 400; i++) hp += npcHP(rng, n.hitDice); hp /= 400;
    let best = null;
    for (const i of attackIds) {
      const sp = magic[i], pw = M.castPower(PROF.C, i), h = hitP(pw, n.resistMagic);
      const d = dmgOne(sp, PROF.C.stats.mag) * (1 - n.absDamage / 100) * h;
      if (d <= 0) continue;
      const casts = hp / d, mana = casts * sp.mana;
      if (mana > mp(PROF.C) * 40) continue;
      if (!best || mana < best.mana) best = { i, h, d, casts, mana };
    }
    if (!best) { rows.push([nm, f0(hp), n.resistMagic, n.absDamage + "%", "—", "—", "—", "—", "—"]); continue; }
    rows.push([nm, f0(hp), n.resistMagic, n.absDamage + "%", `${best.i} ${magic[best.i].name}`, pc(best.h), f1(best.casts), f0(best.mana), f0(best.mana / mp(PROF.C) * 100) + "%"]);
  }
  P(table(["monstruo", "vida", "rr", "abs", "mejor hechizo", "impacto", "lanz.", "maná", "% reserva C"], rows) + "\n");
  P(`Lectura: los monstruos con **absDamage** alto (Gagoyle 80 %, Ettin 65 %, Dark-Elf 50 %) y rr 100 son casi inmunes a la magia; ahí manda el cuerpo a cuerpo. Los jefes de miles de HD (Hellclaw, Tigerworm, Wyvern) no caben en una sola reserva de maná: la magia solo es viable en grupo o con summons de escuela.\n`);
}

// ---- 4.5 escalado con Mag
P(`### 4.5 Escalado con la Magia y con varios objetivos

La Magia añade \`Mag/330\` al daño: Mag 50 = +15 %, Mag 100 = +30 %, Mag 200 = +61 %. Ejemplo de 4 hechizos de referencia (un objetivo):
`);
{
  const ref = [0, 20, 43, 61, 81];
  const rows = ref.map(i => [i, magic[i].name, magic[i].mana, ...[0, 50, 100, 150, 200].map(m => f1(dmgOne(magic[i], m)))]);
  P(table(["id", "hechizo", "maná", "Mag 0", "Mag 50", "Mag 100", "Mag 150", "Mag 200"], rows) + "\n");
  const rows2 = ref.map(i => [i, magic[i].name, ...[1, 3, 5, 8].map(n => f1(dmgN(magic[i], 100, n)))]);
  P(`Daño total según el número de objetivos dentro de la zona (Mag 100):\n`);
  P(table(["id", "hechizo", "1", "3", "5", "8"], rows2) + "\n");
}

// ---- 4.6 campos
P(`### 4.6 Campos: daño en el suelo (con solapes)

Cada casilla del campo es una entrada propia que castiga **en radio** cada segundo, así que quien está en el centro de un campo cuadrado recibe los tics de **todas** las casillas que lo cubren. Simulación exacta sobre rejilla (horizontal para muros), con las medias de dados del tic. «Centro» = casilla de máxima superposición; «borde» = esquina; «total» = estar quieto durante toda la \`last\`.
`);
{
  const R = { 1: 1, 8: 2, 10: 1 }, rowsF = [];
  for (const i of [40, 41, 46, 54, 55, 73]) {
    const sp = magic[i], r = R[sp.v10]; if (r === undefined) { rowsF.push([i, sp.name, sp.mana, sp.last, "—", "—", "—", "—", "solo dibuja"]); continue; }
    const cells = [];
    if (sp.v10 === 8) cells.push([0, 0]);
    else if (sp.v11 === 1) for (let k = -sp.v12; k <= sp.v12; k++) cells.push([k, 0]);
    else for (let x = -sp.v12; x <= sp.v12; x++) for (let y = -sp.v12; y <= sp.v12; y++) cells.push([x, y]);
    const cover = (x, y) => cells.filter(([cx, cy]) => Math.max(Math.abs(cx - x), Math.abs(cy - y)) <= r).length;
    const tic = sp.v10 === 8 ? 11 : sp.v10 === 10 ? (sp.v5 < 20 ? 3.5 : 4.5) : 3.5;
    let max = 0, min = 1e9, sum = 0, cnt = 0, edge = 0;
    for (const [x, y] of cells) { const c = cover(x, y); max = Math.max(max, c); min = Math.min(min, c); sum += c; cnt++; }
    edge = Math.min(...cells.map(([x, y]) => cover(x, y)));
    rowsF.push([i, sp.name, sp.mana, sp.last, cells.length, `${max}×${f1(tic)} = ${f1(max * tic)}/s`, `${edge}×${f1(tic)} = ${f1(edge * tic)}/s`, f0(max * tic * sp.last), `${f1(max * tic * sp.last / sp.mana)} /maná`]);
  }
  P(table(["id", "campo", "maná", "dur s", "casillas", "centro", "borde", "total centro", "eficiencia"], rowsF) + "\n");
  P(`Lectura: contra un monstruo que se queda dentro, los campos de 3×3 y 5×5 hacen cientos de puntos de daño por unos 50 de maná — **muy por encima** de cualquier hechizo de ataque directo (compara con §4.1). Es el principal desequilibrio detectado (§8). Contra jugadores (que caminan) el efecto práctico es mucho menor.\n`);
}

// ---- 4.7 veneno
P(`### 4.7 Veneno

\`Poison\` (27, nivel 15) y \`Mass Poison\` (53, nivel 40) solo afectan a jugadores: 1 de cada 12 s hace \`1d(nivel)\`. Duración media hasta curarse con habilidad de resistencia al veneno \`s\` (curación por tic = \`max(10, s-10+addPR)\` %):
`);
{
  const rowsV = [];
  for (const s of [0, 20, 40, 60, 80, 100]) {
    const p = Math.max(10, s - 10) / 100, ticks = 1 / p, mk1 = L => f0(ticks * (L + 1) / 2);
    rowsV.push([s, pc(p), f1(ticks), f0(ticks * 12) + " s", mk1(15), mk1(40)]);
  }
  P(table(["resist. veneno", "cura/tic", "tics", "duración", "daño total (niv 15)", "daño total (niv 40)"], rowsV) + "\n");
}
P("---\n");

// =====================================================================================================================
P(`## 5. Escuelas de summons (modo del juego actual)

Con \`MAGIC_MODE.schools = true\`, los hechizos **de ataque** fuego/hielo/rayo (\`OFFENSIVE = {1,3,14,19,21,22,23,25,26,28,30}\`) los lanza el summon de la escuela: Orc→Demon (fuego), Tentocle→Frost (hielo), Cannibal-Plant→Liche (rayo). Parámetros (\`schools.js\`):

\`\`\`
nivel de desbloqueo : los hechizos comprables de la escuela, ordenados por maná, se reparten entre los niveles 1..50
                      (tier 2 ×0,8)
maná del hechizo    : round(4 + 1,5·(Lh - 1))            Lh = nivel de desbloqueo (NO el maná de Magic.cfg)
Int / oro de enseñar: max(10, 2·Lh)  /  round(25·Lh^1,7 / 10)·10
poder (acierto)     : 40 + 3·nivelSummon                 (no usa la habilidad del jugador; nivel 50 → 190)
daño                : spellDamage(Mag del DUEÑO) · levelPower(nivelSummon) · (tier2 ? 1,25 : 1) · talento "frenzy"
levelPower(L)       : 0,6 + 0,8·min(50, L)/50            (0,6 al nv 1 → 1,4 al nv 50)
reserva del summon  : round((20 + 6·L) · factorMp · 2 · (tier2 ? 1,6 : 1))   (sin regeneración natural: caramelos azules)
\`\`\`

El summon cuesta mucho menos maná por hechizo que el jugador (un hechizo de 8–180 de Magic.cfg pasa a costar 4–78), así que la magia de escuela es el modo **eficiente** del juego; el límite lo pone la reserva del summon, no la del jugador.
`);
for (const school of ["fire", "ice", "lightning"]) {
  const lv = Sch.unlockLevels(magic, school), list = Object.keys(lv).map(Number).sort((a, b) => lv[a] - lv[b]);
  P(`### 5.${{ fire: 1, ice: 2, lightning: 3 }[school]} Escuela de ${Sch.SCHOOL_NAMES[school]} — ${list.length} hechizos\n`);
  const rows = list.map(i => {
    const sp = magic[i], Lh = lv[i], mana = Sch.spellMana(magic, school, i), d1 = dmgOne(sp, 100, Sch.levelPower(50)), d2 = d1 * 1.25;
    return [i, sp.name, Lh, mana, sp.mana, f1(d1), f1(d1 / mana), f1(d2), f1(d2 / mana), pc(hitP(Sch.spellPower(50), 100)), pc(hitP(Sch.spellPower(50), 60))];
  });
  P(table(["id", "hechizo", "desbloq.", "maná sch", "maná cfg", "dmg1 nv50", "/maná", "dmg1 tier2", "/maná T2", "impacto rr100", "impacto rr60"], rows));
  P(`\nSummon nivel 50 y dueño con Mag 100. «dmg1» ya incluye \`levelPower(50) = 1,4\`; tier 2 multiplica ×1,25 (y la reserva ×1,6).\n`);
}
P(`### 5.4 Progresión del summon: poder, reserva y daño por reserva

Daño total que puede entregar un summon con la **reserva completa** lanzando siempre el mejor hechizo disponible de su escuela contra un objetivo de rr 60 (dueño Mag 100, un objetivo). Cuenta solo hechizos ya desbloqueados.
`);
{
  const rows = [];
  for (const school of ["fire", "ice", "lightning"]) {
    const lv = Sch.unlockLevels(magic, school);
    for (const L of [1, 10, 25, 50]) for (const t2 of [false, true]) {
      const pool = Math.round((20 + 6 * L) * 2 * (t2 ? 1.6 : 1)), pw = Sch.spellPower(L), mult = Sch.levelPower(L) * (t2 ? 1.25 : 1);
      let best = null;
      for (const sid of Object.keys(lv).map(Number)) {
        const Lh = t2 ? Math.max(1, Math.round(lv[sid] * 0.8)) : lv[sid]; if (Lh > L) continue;
        const mana = Sch.spellMana(magic, school, sid), d = dmgOne(magic[sid], 100, mult) * hitP(pw, 60), dpm = d / mana;
        if (!best || dpm > best.dpm) best = { sid, mana, d, dpm };
      }
      if (!best) { rows.push([Sch.SCHOOL_NAMES[school], L, t2 ? "T2" : "T1", pool, "—", "—", "—", "—"]); continue; }
      rows.push([Sch.SCHOOL_NAMES[school], L, t2 ? "T2" : "T1", pool, `${best.sid} ${magic[best.sid].name}`, f1(best.d), f1(best.dpm), f0(Math.floor(pool / best.mana) * best.d)]);
    }
  }
  P(table(["escuela", "nv", "tier", "reserva", "mejor hechizo/maná", "dmg esperado", "/maná", "daño por reserva"], rows) + "\n");
  P(`Lectura: el tier 2 multiplica daño ×1,25 y reserva ×1,6 ⇒ **×2 en daño por reserva**, un salto fuerte; combinado con que sus hechizos se desbloquean un 20 % antes, es la mejora más grande de todo el sistema. Cualquier ajuste de balance en escuelas debe empezar por \`TIER_MULT\`.\n`);
}
P("---\n");

// =====================================================================================================================
P(`## 6. Hechizos psíquicos (invento del port)

\`systems/psychic.js\`: Beholder (**Movimiento**), Centaurus (**Interferencia**) y Stalker (**Territorio**) lanzan solos, sin daño directo, con el **Psychic Controller** (id 9004) en la mano. Alcance 10, recarga global 2200 ms, resistencia: \`1d100 <= min(80, rr·0,6)\` (un 60 % de rr da 36 % de resistir). Reutilizan hechizos de Magic.cfg **solo por su estado**:

${table(["rama", "id", "hechizo", "recarga", "duración", "efecto"], [
  ["Movimiento", 25, "Hold Person", "14 s", "5 s", "inmoviliza (no a magicLevel ≥ 6 ni addPR ≥ 500)"],
  ["Movimiento", 77, "Illusion Movement", "14 s", "6 s", "el monstruo pierde su objetivo; el jugador se desorienta"],
  ["Movimiento", 45, "Chill Wind", "10 s", "8 s", "congela (ralentiza)"],
  ["Interferencia", 83, "Inhibition Casting", "16 s", "8 s", "el jugador no lanza"],
  ["Interferencia", 76, "Cancellation", "20 s", "—", "quita invis, protect, berserk, pfm"],
  ["Interferencia", 62, "Confusion", "14 s", "6 s", "movimiento errático"],
  ["Interferencia", 66, "Armor Break", "18 s", "10 s", "+25 % daño recibido"],
  ["Interferencia", 11, "Staminar Drain", "15 s", "—", "−30 % de la SP máxima"],
  ["Territorio", 41, "Fire Field", "16 s", "9 s", "campo: raíz de 1,5 s (con 6 s de inmunidad)"],
  ["Territorio", 54, "Spike Field", "16 s", "9 s", "campo: ralentiza 4 s"],
  ["Territorio", 46, "Poison Cloud", "18 s", "9 s", "campo: ralentiza 4 s"],
])}

### 6.1 Tiempo de control esperado
Fracción del tiempo que un único objetivo está bajo el efecto \`duración/recarga · (1 − P(resistir))\`, sin contar el GCD ni los solapes entre hechizos (cota superior por hechizo; el efecto no se renueva mientras está activo):
`);
{
  const T = [["Hold Person", 14, 5], ["Illusion Movement", 14, 6], ["Chill Wind", 10, 8], ["Inhibition Casting", 16, 8], ["Confusion", 14, 6], ["Armor Break", 18, 10]];
  const rowsP = T.map(([nm, cd, du]) => [nm, ...[5, 30, 60, 100].map(r => { const pr = Math.min(80, r * 0.6) / 100; return pc(Math.min(1, du / cd) * (1 - pr)); })]);
  P(table(["hechizo", "rr 5", "rr 30", "rr 60", "rr 100"], rowsP) + "\n");
  P(`Lectura: ninguna rama puede mantener a un objetivo inmovilizado de forma permanente (Hold ≤ 36 % de uptime, Chill Wind ≤ 80 %). El control combinado de la rama Movimiento (Hold + Illusion + Chill Wind) sube a ~100 % de "algo activo" contra rr bajo, por diseño: su misión es evitar que un monstruo te alcance, no matarlo.\n`);
}
P("---\n");

// =====================================================================================================================
P(`## 7. Guía de equilibrio

### 7.1 Palancas (qué tocar y qué consecuencia tiene)

${table(["Palanca", "Dónde", "Efecto", "Riesgo"], [
  ["Dados del hechizo (`v4..v9`)", "`magic.json` (cfg) — **autoritativo**", "Daño directo", "Prohibido tocar sin motivo: el cfg es la especificación. Preferir palancas del port"],
  ["`MC_PROB`, `MC_PENALTY`", "`magic.js`", "Fiabilidad de lanzar por círculo", "Afecta a todo el modo base"],
  ["`MIN_HIT`/`MAX_HIT`", "`rules.js`", "Suelo/techo del acierto", "Tocarlo cambia melé y magia"],
  ["`levelPower`, `spellPower`", "`schools.js`", "Daño y acierto del summon por nivel", "Controla la curva de escuelas"],
  ["`TIER_MULT` (hp/mp/dmg)", "`schools.js`", "Salto de tier 2", "El mayor multiplicador del sistema (×2 daño por reserva)"],
  ["`spellMana`, `unlockLevels`", "`schools.js`", "Coste y nivel de aprendizaje", "Cambia el ritmo de desbloqueo"],
  ["`manaSave`, `+20 wtype 34`", "equipo", "Eficiencia", "Poca; acumulativa con otras"],
  ["Daño de campos", "`fields.js`", "Campos", "Ver solapes (§8)"],
  ["Recargas/duraciones", "`psychic.js`", "Uptime del control", "Acotar siempre < 100 %"],
])}

### 7.2 Objetivos de diseño propuestos
1. **Daño por maná decreciente con el círculo, compensado por zona.** Un hechizo de mayor círculo no debe ser mejor por maná contra un solo objetivo que los de círculos bajos; su ventaja es la zona, el control o saltarse el \`protect 2\`.
2. **Ningún hechizo debe superar ~3× la mediana de daño/maná** (hoy la mediana de ataque es ${f1(dpmMed)} /maná a Mag 100). Los que se salen por encima o por debajo están marcados en §3 y listados en §8.
3. **El control no puede ser permanente:** uptime por hechizo < ~60 % contra rr medio; sin apilar el mismo estado; inmunidad posterior tras raíces (ya hecho en el fuego psíquico).
4. **La magia no sustituye al cuerpo a cuerpo contra absorbentes** (\`absDamage\` alto): mantener ese contrapeso.
5. **El tier 2 es el premio, no una obligación:** si T2 duplica el daño por reserva, el T1 queda obsoleto. Bajar \`TIER_MULT.mp\` a 1,3 deja el salto en ~×1,6.

### 7.3 Procedimiento para añadir un hechizo nuevo
1. Si es de Magic.cfg: no inventarlo ni renumerarlo; solo ajustar su comportamiento en \`magicsys.js\` si falta.
2. Si es invento del port (como los psíquicos): id fuera del rango cfg, anotar «INVENTO» en el comentario, ficha en esta guía.
3. Calcular con este script: daño/maná, hit% por rr (5/25/50/70/100) y daño por reserva. Debe caer entre 0,6× y 1,5× la mediana de su círculo, o justificarse.
4. Test en \`tests/\`, ficha en \`docs/sistemas/\`, entrada en español con EN en \`client/i18n.js\`.
5. Si se ve para otros jugadores: \`PUBLIC\` y \`pub()\` en \`server/server.mjs\`, y subir \`NET_PROTO\`.

### 7.4 Checklist de pruebas de equilibrio
- Matar a un monstruo "de su nivel" con la magia no debe costar más del 50 % de la reserva del perfil adecuado.
- Ningún jefe cae a una sola reserva de maná.
- El hechizo de un círculo no es resistible al 100 % por un monstruo de su nivel (acierto ≥ 50 %).
- Dos hechizos de la misma escuela no pueden dominar uno al otro en daño/maná **y** zona a la vez.

---
`);

// ---- 8 hallazgos calculados
P(`## 8. Hallazgos y pendientes (calculados)
`);
{
  const rank = attackIds.map(i => ({ i, e: dmgOne(magic[i], 100) / magic[i].mana / dpmMed })).sort((a, b) => b.e - a.e);
  const top = rank.slice(0, 6), bot = rank.slice(-6).reverse();
  P(`**Más eficientes por maná (un objetivo, Mag 100, relativo a la mediana):** ${top.map(r => `${r.i} ${magic[r.i].name} (×${f1(r.e)})`).join(", ")}.\n`);
  P(`**Menos eficientes:** ${bot.map(r => `${r.i} ${magic[r.i].name} (×${f1(r.e)})`).join(", ")}.\n`);
}
P(`1. **Solape de campos (crítico).** Cada casilla de un campo golpea en radio, así que el centro de Fire Field recibe 9 tics/s (≈31 de daño/s), Cloud Kill hasta 9×4,5 y el muro de Fire Wall ~3×. Según la tabla 4.6, un Fire Field entrega ~945 de daño a quien se quede en el centro durante sus 30 s por 48 de maná (≈20 /maná, frente a ~2–3 /maná de los hechizos directos). **Verificar contra el original** (\x60Effect_Damage_Spot\x60/objetos dinámicos en \x60HGServer/Game.cpp\x60) si cada objeto de campo daña solo a quien pisa su casilla o en radio; el port hoy usa radio. **Propuesta:** el tic de campo debe golpear **una vez por entidad y segundo** (deduplicar por entidad, no por entrada), o reducir el radio a 0. Esto reduce el centro a 3,5/s y deja los campos como herramientas de control, no de daño.
2. **Los campos no escalan con Magia ni resisten magia** (no pasan por \`spellDamage\` ni \`resists\`). Es coherente con el original; mantener.
3. **Hechizos de 9.º–10.º círculo imposibles de lanzar a nivel ≤ 50** fuera de escuelas (§4.2). Si se quiere que el jugador sin escuela los use, hay que o subir \`MC_PENALTY\` más suave o limitar a escuelas (decisión actual).
4. **Tier 2 ×2 por reserva** (§5.4): el salto es grande. Valorar \`TIER_MULT.mp\` 1,6 → 1,3.
5. **Elemento sin efecto:** hielo/fuego/rayo no tienen resistencias por especie. Una posible mejora (invento a documentar) es +25 % contra la debilidad natural de la especie (Ice-Golem débil al fuego, Fire-Wyvern débil al hielo) y −25 % contra la afinidad.
6. **Curación y utilidades sin simular:** Heal/Great Heal (\`1d6+10\`, \`4d10+20\`) y los escudos no tienen simulación porque su valor depende del combate; pendiente un test que mida "vida curada por maná" y "daño evitado por escudo".
7. **Pendiente de cobertura de tests:** hay pruebas de resolución de hechizos (\`magic.test.mjs\`) pero ninguna que fije la **matriz de equilibrio** (daño/maná por hechizo). Añadir un test que falle si un hechizo de ataque se sale de [0,4×, 2,5×] de la mediana, para que los cambios de balance sean conscientes.

---

*Este documento es la base de desarrollo de la magia. Mantenerlo al día: ejecutar \`node tools/sim_magia.mjs\` tras cualquier cambio en \`magic.json\`, \`magic.js\`, \`schools.js\`, \`fields.js\` o \`psychic.js\`.*
`);

const text = out.join("\n").replace(/\r?\n/g, "\r\n");
fs.writeFileSync(path.join(root, "docs/sistemas/magias-diseno.md"), text);
console.log("OK docs/sistemas/magias-diseno.md", text.length, "bytes");
