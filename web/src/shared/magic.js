// Magia: fórmulas del servidor original (PlayerMagicHandler, Effect_Damage_Spot, bCheckResistingMagicSuccess).
import { dice, MIN_HIT, MAX_HIT } from "./rules.js";
import * as Bal from "./balance.js";

const MC_PROB = [0, 300, 250, 200, 150, 100, 80, 70, 60, 50, 40];       // _tmp_iMCProb
const MC_PENALTY = [0, 5, 5, 8, 8, 10, 14, 28, 32, 36, 40];             // _tmp_iMLevelPenalty

export const MAGIC_TYPE = { DAMAGE_SPOT: 1, HPUP_SPOT: 2, DAMAGE_AREA: 3 };
// Todos los tipos de Magic.cfg salvo la invocación (9), que necesita monstruos aliados
export const SUPPORTED_TYPES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 28, 29, 30, 31, 32, 33]);

// CMisc::GetPoint2: casilla n pasos más allá de (x0,y0) siguiendo la recta hacia (x1,y1)
export function linePoint(x0, y0, x1, y1, count) {
  if (x0 === x1 && y0 === y1) return [x0, y0];
  let dx = x1 - x0, dy = y1 - y0, error = 0, rx = x0, ry = y0, cnt = 0;
  const xi = dx >= 0 ? 1 : -1, yi = dy >= 0 ? 1 : -1;
  dx = Math.abs(dx); dy = Math.abs(dy);
  if (dx > dy) {
    for (let i = 0; i <= dx; i++) {
      error += dy;
      if (error > dx) { error -= dx; ry += yi; }
      rx += xi;
      if (++cnt >= count) break;
    }
  } else {
    for (let i = 0; i <= dy; i++) {
      error += dx;
      if (error > dy) { error -= dy; rx += xi; }
      ry += yi;
      if (++cnt >= count) break;
    }
  }
  return [rx, ry];
}
// Animación de lanzar: 16 fotogramas (MapData.cpp:35-36, OBJECTMAGIC MaxFrame 15, FrameTime 88) y retardo por maestría
// iDelay = -(maestría de Magic * 0.13) entero (MapData.cpp:1994-1998): 88 ms a maestría 0, 75 ms a 100.
export const CAST_FRAMES = 16, CAST_FRAME_MS = 88;
export const castMs = skill => CAST_FRAMES * (CAST_FRAME_MS + Math.trunc(-(Math.max(0, Math.min(100, skill || 0)) * 0.13)));
export const CAST_MS = castMs(100);
export const CAST_COOLDOWN_MS = 1000;                                   // el servidor expulsa si se lanza más rápido
export const circleOf = id => Math.floor(id / 10) + 1;

// corrección por nivel respecto al círculo del hechizo (se usa dos veces en el original)
function levelAdjust(result, circle, level) {
  const lm = Math.floor(level / 10);
  if (circle === lm) return result;
  if (circle > lm) {
    const v1 = level - lm * 10, v2 = Math.abs(circle - lm) * MC_PENALTY[circle], v3 = Math.abs(circle - lm) * 10;
    return result - Math.abs(v2 - Math.floor((v1 / v3) * v2));
  }
  return result + 5 * Math.abs(circle - lm);
}

// Probabilidad (%) de que el hechizo salga (si < 100 se tira 1d100).
// Clima sobre la probabilidad (PlayerMagicHandler HG.cpp:10317): lluvia 1/2/3 resta 1/24, 1/12, 1/5.
export const weatherCast = (r, weather) => weather === 1 ? r - Math.floor(r / 24) : weather === 2 ? r - Math.floor(r / 12) : weather === 3 ? r - Math.floor(r / 5) : r;
// Bono de clima al daño (iGetWhetherMagicBonusEffect HG.cpp:22933): con lluvia +1 a los hechizos 10, 37, 43, 51 y -1 a 20 y 30.
export function weatherBonus(id, weather) {
  if (weather < 1 || weather > 3) return 0;
  return id === 10 || id === 37 || id === 43 || id === 51 ? 1 : id === 20 || id === 30 ? -1 : 0;
}
export function castChance(p, id, weather = 0) {
  const circle = circleOf(id), mastery = p.skills[4] || 1;
  let r = Math.floor((mastery / 100) * MC_PROB[circle]);
  if (p.stats.int > 50) r += Math.floor((p.stats.int - 50) / 2);
  r = levelAdjust(r, circle, p.level);
  r = weatherCast(r, weather);
  r += p.eff.castBonus || 0;                                 // atributo "Special" de las varitas
  return r <= 0 ? 1 : r;
}

// Maná que cuesta: el ahorro de maná lo reduce; las varitas tipo 34 suman 20.
// Reglas del servidor original: hay que aprender cada hechizo (Int y oro), cuesta maná, se lanza con manos libres o varita y puede fallar.
// free = modo de pruebas (todo aprendido, sin maná) y player = false lo cierra: solo para tests y depuración.
export const MAGIC_MODE = { free: false, player: true };
// modo «Full mage» (F1 → Herramientas): por jugador, equivale a MAGIC_MODE.free solo para él (todo aprendido, sin maná)
export const freeFor = p => MAGIC_MODE.free || !!(p && p.fullMage);
export const NO_PLAYER_MAGIC = "los hechizos están cerrados";
export function manaCost(p, spell, id, fightZone = false) {
  if (freeFor(p)) return 0;
  let c = Bal.scale(spell.mana, Bal.spellManaMul(id));
  if (p.safeAttack && !fightZone) c = Math.trunc(c * 1.1);          // PlayerMagicHandler (HG.cpp:10337): modo ataque seguro fuera de zona de lucha -> iManaCost *= 1.1 (entero), antes del ahorro de maná
  if (p.eff.manaSave > 0) { c = Math.floor(c - (p.eff.manaSave / 100) * c); if (c <= 0) c = 1; }
  if (p.eff.wtype === 34) c += 20;
  return c;
}

// "Acierto" mágico del lanzador contra la resistencia del objetivo.
export function castPower(p, id) {
  let r = p.skills[4] || 0;
  if (p.stats.mag > 50) r += p.stats.mag - 50;
  r = levelAdjust(r, circleOf(id), p.level);
  r += p.eff.addAR;
  return r <= 0 ? 1 : r;
}

// bCheckResistingMagicSuccess: true si el objetivo resiste.
export function resists(rng, power, resistRatio) {
  if (resistRatio < 1) resistRatio = 1;
  let dest = Math.floor((power / resistRatio) * 50);
  dest = Math.max(MIN_HIT, Math.min(MAX_HIT, dest));
  return dice(rng, 1, 100) > dest;
}

// Daño de un hechizo: dados + bonificación de Magia (mag/3.3 %) + daño mágico añadido.
export function spellDamage(rng, p, n, d, k, fightZone = false) {
  let dmg = dice(rng, n, d) + k;
  if (dmg <= 0) dmg = 0;
  dmg = Math.floor(dmg + dmg * (((p.stats.mag <= 0 ? 1 : p.stats.mag) / 3.3) / 100) + 0.5);   // HG.cpp Effect_Damage_Spot: Mag<=0 cuenta como 1
  if (p.eff.hero === 2) dmg += 4;                                    // m_heroArmourBonus == 2 (conjunto de héroe de mago)
  dmg += p.eff.addMagic || 0;
  dmg += Math.trunc(dmg * (p.eff.addMagicPct || 0) / 100);           // m_addMagicDmgPct
  dmg = Math.max(0, dmg);
  if (fightZone) dmg += Math.trunc(dmg / 3);                        // mapa de zona de lucha: +1/3
  return dmg;
}
