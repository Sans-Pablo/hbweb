// BUILDS (reparto de puntos) de los habitantes (INVENTO del port). Cada habitante empieza con el de su arquetipo y, con el tiempo, prueba otros: va al mago
// (reinicio de estadísticas, respec.js), se reparte los puntos de otra forma y mide cuánta experiencia por minuto saca con cada uno. Así descubren qué
// funciona (más vida, más daño, más inteligencia para los summons…) y se quedan con lo mejor o siguen explorando.
import * as R from "../rules.js";
import { realStats, parseAttr } from "../attributes.js";
import { EQUIP } from "../items.js";

export const BUILDS = {
  balanced: { es: "equilibrado", w: { str: 0.35, vit: 0.35, dex: 0.2, int: 0.05, mag: 0.05 } },
  tank:     { es: "resistente", w: { vit: 0.55, str: 0.3, dex: 0.15 } },
  glass:    { es: "cañón de cristal", w: { str: 0.55, dex: 0.3, vit: 0.15 } },
  agile:    { es: "ágil", w: { dex: 0.5, str: 0.25, vit: 0.25 } },
  summoner: { es: "invocador", w: { int: 0.3, mag: 0.15, vit: 0.35, str: 0.2 } },
  vanguard: { es: "guerrero", w: { dex: 0.5, vit: 0.4, str: 0.1 } },                               // Guerrero de misiones: el jefe de cripta se aguanta con vida
  mage:     { es: "mago", w: { int: 0.6, mag: 0.25, vit: 0.15 } },                                // v0.85.47: Blizzard pide Int 113 (magicbal.js); v0.85.46: más Int y Mag. v0.85.26: lanzador puro. INT para aprender y lanzar (Magic Missile pide 18, Fire Ball 26, Fire Strike 34), MAG para el maná
  arcane:   { es: "arcano", w: { vit: 0.4, int: 0.3, mag: 0.15, str: 0.15 } },                      // Mago e Invocador de misiones: vida y mente
};
const QUEST_BUILD = { warrior: "vanguard", mage: "arcane", summoner: "arcane" };
export const DEFAULT_BUILD = { warrior: "glass", hunter: "agile", trader: "balanced", wanderer: "balanced", scholar: "summoner" };
// v0.85.53: SOLO DOS CLASES, guerrero ("vanguard") y mago ("mage"). Cualquier build antiguo (invocador, arcano, cañón de cristal…) se reduce a una de las dos.
const MAGE_LIKE = new Set(["mage", "arcane", "summoner"]);
export const buildOf = p => (MAGE_LIKE.has(p.res?.build) || p.bot?.mage || (!p.res?.build && (p.quests?.cls === "mage" || p.quests?.cls === "summoner" || p.res?.arch === "scholar"))) ? "mage" : "vanguard";
// Int mínima del guerrero: 36 (Invisibility 30, Detect 30, PFM 32, Paralyze 36 de Magic.cfg) para apoyar y paralizar sin dejar la espada
export const WAR_INT = 36;
// ¿Gasta puntos en INT/MAG y lanza hechizos con las manos libres o una varita? (botmagic.js)
export const isCaster = p => buildOf(p) === "mage";
// Mago puro: sin arma cuerpo a cuerpo (solo se lanza con las manos libres o con varita, magicsys.js usable())
export const isMage = p => buildOf(p) === "mage";

// FUERZA DE UN ARMA (v0.85.48): para ponérsela hace falta Str >= peso/100 (inventory.js equip) y el golpe pierde velocidad mientras
// speed - floor(Str/13) > 0 (inventory.js calcEff speedNib). "Golpe completo" = las dos cosas cubiertas: Str >= max(peso/100, speed*13).
export function swingStr(d, inst) {
  if (!d) return 0;
  const r = realStats(d, inst);
  return Math.max(Math.ceil(r.weight / 100), r.speed * 13);
}
// Fuerza que pide el arma que lleva en la mano (0 si no lleva o es el mago puro: la varita pesa poco)
export function weaponStrNeed(p, data) {
  let need = 0;
  for (const slot of [EQUIP.RHAND, EQUIP.TWOHAND]) {
    const uid = p.equip?.[slot], i = uid !== undefined && p.bag.find(x => x.uid === uid);
    if (i) need = Math.max(need, swingStr(data.item(i.id), i));
  }
  return need;
}

// BONOS QUE BUSCA CADA CLASE (v0.85.48, INVENTO): el mago quiere HP, MP, DR y PA (absorción física); el guerrero HP, DR, PA, MA (absorción mágica) y MR.
// Tipos de atributo secundario (attributes.js applyEquipAttr): 3 DR, 4 HP, 6 MP, 7 MR, 8 PA, 9 MA. `foe` ('magic'|'phys') sesga el set hacia MA/MR o PA.
// v0.85.56 (petición del autor): el SEGUNDO stat pesa mucho y su valor es convexo (+70 vale mucho más que 7×10). Guerrero: HP > MR > MA; mago: MP > HP > DR > PA.
const WANT = { mage: { 6: 1.6, 4: 1.3, 3: 0.9, 8: 0.7, 9: 0.3, 7: 0.3 }, war: { 4: 1.6, 7: 1.3, 9: 1.1, 3: 0.7, 8: 0.7, 6: 0.1 } };
// Armas: probabilidad de acierto (tipo 2) muy valiosa, luego ataque consecutivo (10) y reputación/exp (11)
const WEAPON_WANT = { 2: 1.8, 10: 1.3, 11: 1.0, 12: 0.4 };
export const convex = v2 => v2 * (1 + v2 / 10);
export function bonusScore(p, d, attr, foe) {
  if (!attr || !d) return 0;
  const { t2, v2 } = parseAttr(attr), weapon = d.equipPos >= EQUIP.RHAND && d.equipPos <= EQUIP.TWOHAND, wt = { ...(weapon ? WEAPON_WANT : WANT[isCaster(p) ? "mage" : "war"]) };
  if (!weapon) { if (foe === "magic") { wt[9] = (wt[9] || 0) * 1.8 + 0.4; wt[7] = (wt[7] || 0) * 1.8 + 0.4; } else if (foe === "phys") wt[8] = (wt[8] || 0) * 1.8 + 0.4; }
  let v = (wt[t2] || 0) * convex(v2) * 1.2;
  if (!weapon && setWanted(p) === t2) v += 40;                                // set de situación: con poca vida/maná lo que lleve ese stat
  // armadura ligera (pide poca Str): la Str ahorrada va a Mag/Vit; un mago con cota ligera con MP vale muchísimo
  if (!weapon && d.v4 === 10 && d.v5 > 0 && d.v5 < 100) v += (100 - d.v5) * 0.06 * (isCaster(p) ? 1.5 : 0.5);
  return v;
}
// Set de situación: HP (todo lo que lleve HP) con poca vida; MP (mago) con poco maná. Devuelve el tipo de secundario a priorizar o 0.
export function setWanted(p) {
  if (p.hp / p.maxHp < 0.4) return 4;
  if (isCaster(p) && p.maxMp > 0 && p.mp / p.maxMp < 0.25) return 6;
  return 0;
}

// Reparte `total` puntos según el build respetando el tope de cada estadística. `need` = Str que pide su arma: se cubre primero (hasta el 70% de los puntos).
export function allocate(p, total, need = 0) {
  const w = { ...BUILDS[buildOf(p)].w }, out = {}, ks = Object.keys(w);
  // v0.85.54 (fórmulas, botformulas.js): con Int >= 50 un punto de Mag rinde más que uno de Int (poder +1, MR +1, daño +0.3 %; la Int solo +0.5 de probabilidad de lanzar)
  if (buildOf(p) === "mage" && p.stats.int >= 50 && w.int && w.mag) { const m = Math.min(0.2, w.int - 0.3); w.int -= m; w.mag += m; }
  let left = total;
  const first = Math.max(0, Math.min(need - p.stats.str, Math.floor(total * 0.7), R.STAT_LIMIT - p.stats.str));
  if (first > 0) { out.str = first; left -= first; total -= first; }
  if (buildOf(p) !== "mage") { const iq = Math.max(0, Math.min(WAR_INT - p.stats.int, left, R.STAT_LIMIT - p.stats.int)); if (iq > 0) { out.int = iq; left -= iq; total -= iq; } }
  for (const k of ks) { const n = Math.min(Math.round(total * w[k]), R.STAT_LIMIT - p.stats[k] - (out[k] || 0), left); if (n > 0) { out[k] = (out[k] || 0) + n; left -= n; } }
  for (const k of ks) { if (left <= 0) break; const n = Math.min(left, R.STAT_LIMIT - p.stats[k] - (out[k] || 0)); if (n > 0) { out[k] = (out[k] || 0) + n; left -= n; } }
  return out;
}

// Rendimiento (experiencia por minuto de juego) del build actual
export function perf(p, w) { const b = p.res?.bperf; return b ? (p.exp - b.exp0) / Math.max(1, (w.time - b.t0) / 60000) : 0; }
// Siguiente build a probar: primero los que no ha probado; luego el mejor conocido (con algo de exploración)
export function nextBuild(p, w) {
  const hist = p.res.builds || [], tried = new Set(hist.map(h => h.name)), cur = buildOf(p);
  const pool = Object.keys(BUILDS).filter(k => !p.quests || (k !== "glass" && k !== "agile"));          // con misiones no se prueba un build sin vida
  const fresh = pool.filter(k => !tried.has(k) && k !== cur);
  if (fresh.length && (w.rng() < 0.75 || hist.length < 2)) return fresh[Math.floor(w.rng() * fresh.length)];
  const best = hist.filter(h => h.name !== cur).sort((a, b) => b.rate - a.rate)[0];
  return best?.name || pool.filter(k => k !== cur)[Math.floor(w.rng() * (pool.length - 1))];
}
// Anota el rendimiento del build que deja
export function closeBuild(p, w) { const cur = buildOf(p), rate = Math.round(perf(p, w)), h = (p.res.builds ||= []), e = h.find(x => x.name === cur); if (e) { e.rate = Math.round((e.rate + rate) / 2); e.n++; } else h.push({ name: cur, rate, n: 1 }); }
// IDEAS DE LOS DEMÁS (INVENTO, v0.69): el reparto que mejor le ha rendido a otro habitante de su misma personalidad (mide exp/min en `res.builds`). Solo vale si supera con holgura lo mejor que él ha visto.
export function peerBest(p, others) {
  const cur = buildOf(p), mine = Math.max(0, ...(p.res.builds || []).map(h => h.rate));
  let best = null;
  for (const o of others) {
    if (o === p || !o.res || o.res.arch !== p.res.arch) continue;
    for (const h of o.res.builds || []) if (h.name !== cur && BUILDS[h.name] && h.rate > mine * 1.15 + 1 && (!p.quests || (h.name !== "glass" && h.name !== "agile")) && (!best || h.rate > best.rate)) best = { name: h.name, rate: h.rate, from: o.name };
  }
  return best;
}
// CLASE POR ÍTEMS (INVENTO, v0.77.0): lo que lleva puesto decide la clase: arco → cazador (ágil), báculo → invocador (arcano), con summon activo → invocador,
// el resto → guerrero (cañón de cristal; con misiones, vanguardia). Se reevalúa cuando cambia el arma; devuelve {arch, build}.
export function fitByItems(p) {
  const t = p.eff?.wtype || 0;
  if (p.eff?.bow) return p.quests ? { arch: "warrior", build: buildOf(p) } : { arch: "hunter", build: "agile" };
  if (t >= 34 && t < 40) return { arch: "scholar", build: "arcane" };
  if (p.res?.arch === "scholar" || p.companion || p.summon) return { arch: "scholar", build: "summoner" };
  return { arch: "warrior", build: p.quests ? "vanguard" : "glass" };
}
// Firma del equipo clave (arma en mano); cambia cuando encuentra un ítem de otra clase
export const itemSig = p => (p.eff?.bow ? "bow" : (p.eff?.wtype || 0) >= 34 && (p.eff?.wtype || 0) < 40 ? "staff" : "melee");
// Tope diario de reinicios por bot
export const DAILY_CAP = 2;
export function canRespecToday(r, w) { const d = Math.floor(w.time / 86400000); if (r.rsDay !== d) { r.rsDay = d; r.rsN = 0; } return r.rsN < DAILY_CAP; }
