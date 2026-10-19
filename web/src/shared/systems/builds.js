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
// v0.85.83 (obs. 38): la Int del guerrero NO es obligatoria; cada guerrero elige UNA de estas metas (Magic.cfg reqInt): 32 solo PFM/invisibilidad,
// 20 PFA/recall, 10 guerrero puro (puntos clásicos), 59 lanzarse Berserk (id 50) y cazar más rápido. Estable por personaje (hash del nombre/id).
// v0.85.87 (Pablo): ahora 36 (Paralyze), 10 (guerrero puro) o 59 (Berserk): ver WAR_BUILDS.
export const WAR_INT_CHOICES = [36, 10, 59];
export const WAR_STR = { BarbarianHammer: 200, BattleHammer: 182, BattleAxe: 170, GiantSword: 160, Hammer: 160, Flameberge: 160 };
// v0.85.87 (Pablo): BUILDS DE GUERRERO (tabla fija). "berserker" = Flameberge (Str 130, lo que pide su golpe completo: swingStr) + Int 59 (se lanza Berserk, id 50, reqInt 59);
// "giant59" = Giant Sword/Hammer (Str 160) + Int 59; "heavy36"/"heavy10" = Barbarian/Battle Hammer, Battle Axe (Str 200/182/170) con Int 36 (Paralyze) o 10.
// v0.85.89 (Pablo, TABLA APROBADA): nivel 140, todo a 10 tras el reset, 417 puntos, tope 200. Guerrero: Dex 120, Mag 10, Str del arma, Int 10/36/59 y el resto Vit.
// Str: BattleHammer 182, BarbarianHammer 200, GiantSword/Hammer 160, BattleAxe 170, Flameberge 130 (swingStr). Int 36 = Paralyze, 59 = Berserk (Magic.cfg reqInt).
const wb = (id, int, weapons) => ({ id, int, weapons });
export const WAR_BUILDS = {
  bh: wb("bh", 10, ["BattleHammer"]), bh36: wb("bh36", 36, ["BattleHammer"]),
  bbh: wb("bbh", 10, ["BarbarianHammer"]), bbh36: wb("bbh36", 36, ["BarbarianHammer"]),
  gs: wb("gs", 10, ["GiantSword", "Hammer"]), gs36: wb("gs36", 36, ["GiantSword", "Hammer"]), gs59: wb("gs59", 59, ["GiantSword", "Hammer"]),
  ba: wb("ba", 10, ["BattleAxe"]), ba36: wb("ba36", 36, ["BattleAxe"]),
  fl: wb("fl", 10, ["Flameberge"]), fl36: wb("fl36", 36, ["Flameberge"]), fl59: wb("fl59", 59, ["Flameberge"]),
};
const hashOf = p => { const s = String(p.id ?? p.name ?? ""); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const WAR_POOL = ["bh", "bh36", "bbh", "bbh36", "gs", "gs36", "gs59", "ba", "ba36"].map(k => WAR_BUILDS[k]), FLAM_POOL = ["fl", "fl36", "fl59"].map(k => WAR_BUILDS[k]);
// El 25 % que jura por la Flameberge (botweapon.flamOf) reparte entre fl/fl36/fl59; el resto por hash del personaje entre los demás
export const warBuildOf = p => WAR_BUILDS[p.bot?.wb] ? WAR_BUILDS[p.bot.wb] : p.bot?.flam ? FLAM_POOL[hashOf(p) % 3] : WAR_POOL[hashOf(p) % WAR_POOL.length];
export const warStrOf = (name, build) => { const n = String(name).replace(/\+\d$/, ""); return n === "Flameberge" ? 130 : WAR_STR[n] || 0; };
export const warInt = p => p.bot?.warInt ?? warBuildOf(p).int;
// Dex mínima de todo guerrero (Pablo)
export const WAR_DEX_MIN = 120;
// Str mínima de todo guerrero a nivel 100 o más (Pablo): por debajo no lleva armas pesadas ni aguanta el golpe completo
export const WAR_STR_MIN = 130;          // v0.85.96 (Pablo): mínimo 130 = Flameberge (warStrOf)
// v0.85.87 (Pablo): BUILDS DE MAGO (tabla fija; reqInt de Magic.cfg): blizzard = Int 195 (Blizzard id 91), control = Int 200 (Mass Illusion Movement id 95 / Earth Shock Wave id 96),
// support = Int 133 (Mass Ice Strike id 72) y más Vit. El resto: Mag y Vit.
// v0.85.89 (Pablo): MAGOS (Str 10, Dex 10 salvo soporte): blizzard Int 195/Mag 100/Vit 152; control Int 200/Mag 100/Vit 147 (Mass Illusion Movement 95, Earth Shock Wave 96);
// support Str 40 (cota de mallas + escudo de torre), Int 133, Mag 200, Vit 84 (Mass Ice Strike 72, AMP 65, buffs, Paralyze).
export const MAGE_BUILDS = {
  blizzard: { id: "blizzard", str: 40, int: 195, mag: 100 },
  control:  { id: "control",  str: 40, int: 200, mag: 100 },
  support:  { id: "support",  str: 40, int: 133, mag: 200 },
};
const MAGE_POOL = ["blizzard", "blizzard", "blizzard", "blizzard", "control", "support"].map(k => MAGE_BUILDS[k]);
export const mageBuildOf = p => p.bot?.mb ? MAGE_BUILDS[p.bot.mb] : p.res?.job === "support" ? MAGE_BUILDS.support : MAGE_POOL[hashOf(p) % MAGE_POOL.length];
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
// v0.85.98 (obs. 69): valores que fija el propietario desde el panel admin (server/data/botvalues.json): sub = multiplicador por tipo de secundario, item = puntos extra de item level por id de objeto.
export const botValues = { sub: {}, item: {} };
export const setBotValues = o => { botValues.sub = { ...(o?.sub || {}) }; botValues.item = { ...(o?.item || {}) }; };
export const itemExtra = id => Number(botValues.item[id]) || 0;
export const convex = v2 => v2 * (1 + v2 / 10);
export function bonusScore(p, d, attr, foe) {
  if (!attr || !d) return 0;
  const { t2, v2 } = parseAttr(attr), weapon = d.equipPos >= EQUIP.RHAND && d.equipPos <= EQUIP.TWOHAND, wt = { ...(weapon ? WEAPON_WANT : WANT[isCaster(p) ? "mage" : "war"]) };
  if (!weapon) { if (foe === "magic") { wt[9] = (wt[9] || 0) * 1.8 + 0.4; wt[7] = (wt[7] || 0) * 1.8 + 0.4; } else if (foe === "phys") wt[8] = (wt[8] || 0) * 1.8 + 0.4; }
  let v = (wt[t2] || 0) * (Number(botValues.sub[t2]) || 1) * convex(v2) * 1.2 + itemExtra(d.id);
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

// REPARTO (v0.85.62, obs. 14): 1) lo que pide su mejor arma/hechizo (Str del arma; Int del mago hasta `needInt`, mínimo 50; guerrero Int 36),
// 2) Dex (guerrero) o Mag (mago) en múltiplos de 10 (la mitad de lo que queda), 3) el resto a Vit. Respeta el tope de cada estadística.
export const MAGE_INT = 70;                       // v0.85.68: Ice Strike pide Int 60 y Energy Strike 67 (Magic.cfg)
export function allocate(p, total, need = 0, needInt = 0) {
  const out = {}, mage = buildOf(p) === "mage", cap = k => R.STAT_LIMIT - p.stats[k] - (out[k] || 0);
  let left = total;
  const give = (k, n) => { n = Math.max(0, Math.min(n, left, cap(k))); if (n > 0) { out[k] = (out[k] || 0) + n; left -= n; } };
  give("str", Math.min(need - p.stats.str, Math.floor(total * 0.7)));
  if (!mage) {
    // v0.85.87 (Pablo) GUERRERO: Str del arma, Int del build, Dex hasta 100 y el resto SOLO a Vit y Dex (Vit ~80 %, Dex extra en múltiplos de 10)
    if (p.level >= 100) give("str", WAR_STR_MIN - p.stats.str - (out.str || 0));                      // v0.85.91 (Pablo): ningún guerrero (tampoco el pescador/cazador con Dex alta) baja de Str 100 a nivel 100+
    give("int", warInt(p) - p.stats.int);
    give("dex", p.level >= 100 ? WAR_DEX_MIN - p.stats.dex : Math.min(100 - p.stats.dex, Math.floor(left / 2)));   // antes de nivel 100 no alcanza el pozo: la mitad a Dex y el resto a Vit (lo pide la supervivencia)
    const have = p.stats.dex + (out.dex || 0);
    if (p.level < 100) give("dex", Math.floor((have + left * 0.2) / 10) * 10 - have);
    give("vit", left); give("dex", left);
    return out;
  }
  const mb = mageBuildOf(p), big = p.level >= 100;          // MAGO: a nivel 100 o más, la Int del build (Blizzard 195, control 200, soporte 133); antes, la progresiva de siempre
  if (big) { give("str", mb.str - p.stats.str); give("int", mb.int - p.stats.int); give("mag", mb.mag - p.stats.mag); give("vit", left); for (const s of ["mag", "int", "dex", "str"]) give(s, left); return out; }
  give("int", Math.max(needInt, MAGE_INT) - p.stats.int);
  const have = p.stats.mag + (out.mag || 0), share = 0.6;
  give("mag", Math.floor((have + left * share) / 10) * 10 - have);
  if (!big) give("int", Math.floor(left * 0.3));
  give("vit", left);
  for (const s of ["mag", "int", "dex", "str"]) give(s, left);
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
