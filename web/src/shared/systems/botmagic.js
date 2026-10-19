// MAGIA DE LOS BOTS (INVENTO del port, 0.85.26). Un bot mago/invocador usa las MISMAS órdenes y reglas que un jugador:
//  - APRENDE hechizos con `{t:"learn"}` (MagicSys.learn: Int >= ReqInt de Magic.cfg, pagar el coste; coste < 0 = no se vende; RequestStudyMagicHandler).
//  - La maestría de Magia (skills[4], castChance) sube lanzando: Item.cfg no tiene manual de Magia.
//  - LANZA con `{t:"cast"}` (magicsys.js usable: sin escudo ni arma a dos manos, en la mano derecha solo varita, maná suficiente, 1 s entre hechizos;
//    los de categoría 1 no se lanzan en zona segura).
// La elección (qué ataque, cuándo curar, cuándo escudo, reservar maná para curarse) es INVENTO: el código original no tiene bots.
import { EQUIP, EFFECT } from "../items.js";
import { dist } from "../const.js";
import * as M from "../magic.js";
import { SKILL } from "../skills.js";
import { isCaster, isMage, WAR_INT, mageBuildOf } from "./builds.js";
import { landChance } from "./botformulas.js";
import { sget } from "./status.js";

// Orden de estudio: primero curar y el misil, luego escudo y ataques fuertes, al final los de apoyo caros (ids de Magic.cfg).
// v0.85.46: compran TODO lo que sirve para pelear (ataque, paralizar, PFM) en cuanto tienen Int y oro; lo caro (Energy Strike, Lightning Strike, Meteor, Blizzard) al final.
export const STUDY_ORDER = [1, 0, 12, 33, 35, 57, 60, 45, 47, 43, 25, 13, 32, 34, 10, 20, 21, 23, 28, 30, 24, 41, 44, 50, 54, 65, 72, 63, 74, 81, 91];   // v0.85.68: Ice Strike y Energy Strike antes que lo demás; al final los de zona (Mass Ice/Chill Wind, Blizzard)
export const WAR_STUDY = [12, 33, 32, 34, 35, 25, 13, 24, 50];        // guerrero con Int 36: PFM, Invisibility, Detect, Paralyze (Magic.cfg reqInt 32/30/30/36)
const INVIS = 32, DETECT = 34, FIREFIELD = 41, SPIKE = 54, BERSERK = 50, AMP = 65, PFA = 24;   // ids de Magic.cfg (claves de magic.json)
export const ATTACK = [91, 81, 74, 72, 63, 60, 57, 47, 43, 45, 30, 20, 10, 0];   // Blizzard, Meteor Strike, Lightning Strike, Energy Strike, Ice Strike, Triple Energy Bolt, Lightning, Chill Wind, Fire Strike, Fire Ball, Energy Bolt, Magic Missile
export const HEALS = [21, 1];                            // Great Heal, Heal
export const SHIELDS = [44, 13];                         // Great Defense Shield, Defense Shield
export const PARALYZE = [35, 25];                       // Paralyze, Hold Person (contra jugadores: el combo del mago es paralizar y rematar)
const PFM = 33, DSHIELD = 13;                                         // Protection From Magic (contra otro lanzador)
const MINOR_HP = 150;                                  // v0.85.99 (obs. 99): por debajo de esta vida el monstruo es menor: no se gasta Paralyze en él
const GOLD_RESERVE = 150;                               // oro que no gasta en hechizos (pociones y comida)
export const CAST_RANGE = 9;
const HEAL_RANGE = 8;                  // la orden admite 11 (magicsys.js); se queda corto para no fallar por el movimiento del objetivo

const isWand = p => p.eff?.wtype >= 34 && p.eff?.wtype <= 39;
export const handsOk = p => p.equip[EQUIP.LHAND] === undefined && p.equip[EQUIP.TWOHAND] === undefined && (p.equip[EQUIP.RHAND] === undefined || isWand(p));
export const canCast = p => isCaster(p) && handsOk(p);
const known = (p, id) => !!p.magic?.[id];
const costOf = (w, p, id) => M.manaCost(p, w.magic[id], id, !!w.fightZone);

// v0.85.88 (Pablo): el hechizo clave de cada build de mago se compra antes que nada (Blizzard 91 / Mass Illusion Movement 95 / Mass Ice Strike 72 y los de apoyo: PFM 33, PFA 24, Berserk 50, Paralyze 35)
const MAGE_KEY = { blizzard: [91], control: [95], support: [72, 33, 24, 50, 35] };
// v0.85.76 (obs. 37): con Int, el bot compra TODAS las magias que pueda (primero su lista de siempre, luego el resto de Magic.cfg por Int exigida)
export const studyList = (w, p) => { const first = isCaster(p) ? [...(MAGE_KEY[mageBuildOf(p).id] || []), ...STUDY_ORDER] : WAR_STUDY; return [...first, ...Object.keys(w.magic).map(Number).filter(id => !first.includes(id)).sort((a, b) => (w.magic[a].reqInt - w.magic[b].reqInt) || a - b)]; };
// Huida con Invisibility (obs. 37): con poca vida y un enemigo encima, se hace invisible antes de correr o lanzar Recall. true = gastó el turno.
export function escapeInvis(adv, w, p, b) {
  if (!w.magic || p.dead || !known(p, INVIS) || sget(w, p, "invis") || !handsOk(p) || w.busy(p) || !ready(w, p, b) && !(!isCaster(p) && w.time - (p.lastCast || -1e9) >= M.CAST_COOLDOWN_MS)) return false;
  if (!w.magic[INVIS] || p.mp < costOf(w, p, INVIS) || M.castChance(p, INVIS) < 15 || !cool(b, "escinv", 12000, w)) return false;
  stamp(b, "escinv", w); return cast(adv, w, p, b, INVIS, p.x, p.y);
}
// Aprende lo que pueda (Int y oro). Un recado, una magia como mucho.
export function study(w, p, b, log) {
  if (!w.magic || (!isCaster(p) && p.stats.int < 20)) return false;
  for (const id of studyList(w, p)) {
    const sp = w.magic[id];
    if (!sp || known(p, id) || sp.cost < 0 || p.stats.int < sp.reqInt || p.gold < sp.cost + GOLD_RESERVE) continue;
    const before = p.gold;
    w.command(p.id, { t: "learn", spell: id });
    if (known(p, id)) { log(`Aprendo ${sp.name || "el hechizo " + id} (${before - p.gold} de oro, Int ${sp.reqInt}).`); return true; }
  }
  return false;
}

// RECALL (v0.85.62, obs. 10): el bot ya no usa el botón del port; lanza el hechizo Recall (Magic.cfg 12, tipo 8, sobre sí mismo) si lo sabe y tiene maná.
// Si aún no lo aprendió (sin Int/oro), recurre al botón para no quedar atrapado; el mago sin manos libres las libera antes (ensureHands).
export const RECALL = 12;
export function recallSelf(adv, w, p, b) {
  const sp = w.magic?.[RECALL];
  if (sp && known(p, RECALL) && p.mp >= costOf(w, p, RECALL) && !p.dead) {
    if (!handsOk(p) && isCaster(p)) { ensureHands(adv, w, p, b, () => {}); return; }
    b.castAt = w.time; adv.command(p.id, { t: "cast", spell: RECALL, x: p.x, y: p.y }); return;
  }
  adv.command(p.id, { t: "recall" });
}

// El mago puro lleva las manos libres o una varita: se quita escudo, armas a dos manos y espadas (si no, el hechizo se rechaza).
// v0.85.90: el mago de SOPORTE lleva la Tower Shield en la mochila (Magic: _bIsItemOnHand bloquea lanzar con escudo): se la pone solo sin maná y en pelea
// (a tanquear mientras bebe/recupera) y se la quita al volver al 40 % de maná.
const towerOf = (w, p) => p.bag.find(i => /^TowerShield/.test(w.data.item(i.id)?.name || ""));
export function ensureHands(adv, w, p, b, log) {
  if (isMage(p) && mageBuildOf(p).id === "support" && p.maxMp > 0) {
    const f = p.mp / p.maxMp, hf = p.hp / Math.max(1, p.maxHp), tw = towerOf(w, p), worn = p.equip[EQUIP.LHAND] !== undefined && p.equip[EQUIP.LHAND] === tw?.uid;
    if (worn && (f < 0.4 || hf < 0.7) && p.equip[EQUIP.TWOHAND] === undefined) return false;                      // la mantiene hasta recuperar maná
    if (!worn && tw && handsOk(p) && (f < 0.12 || hf < 0.5) && w.time - (p.lastCombat || -1e9) < 3000 && w.time - (b.shieldAt || -1e9) > 20000) { b.shieldAt = w.time; adv.command(p.id, { t: "equip", uid: tw.uid }); log("Mago de soporte: sin maná, me pongo la Tower Shield ("+(hf < 0.5 ? "me pegan" : "sin maná")+")."); return true; }
  }
  if (!isMage(p) || handsOk(p) || w.time - (b.handsAt || -1e9) < 8000) return false;
  b.handsAt = w.time;
  for (const slot of [EQUIP.LHAND, EQUIP.TWOHAND]) { const u = p.equip[slot]; if (u !== undefined) { adv.command(p.id, { t: "unequip", uid: u }); log("Mago: libero las manos para poder lanzar."); return true; } }
  const wand = p.bag.find(i => { const d = w.data.item(i.id); return d && d.equipPos === EQUIP.RHAND && d.appr >= 34 && d.appr < 40 && !(d.levelLimit > p.level); });
  if (wand) { adv.command(p.id, { t: "equip", uid: wand.uid }); log("Mago: me pongo la varita para poder lanzar."); return true; }
  for (const slot of [EQUIP.LHAND, EQUIP.TWOHAND, EQUIP.RHAND]) {
    const uid = p.equip[slot];
    if (uid !== undefined && !(slot === EQUIP.RHAND && isWand(p))) { adv.command(p.id, { t: "unequip", uid }); log("Mago: libero las manos para poder lanzar."); return true; }
  }
  return false;
}

function ready(w, p, b) {
  return !p.dead && canCast(p) && !w.busy(p) && w.time - (p.lastCast || -1e9) >= M.CAST_COOLDOWN_MS && w.time - (b.castAt || -1e9) >= 1100;
}
// v0.85.100 (#113): lo que sirve en PvE. Confusion/Illusion (tipo 16, p.ej. Mass Illusion Movement) y Inhibition (31) solo afectan a jugadores (magicsys.js case 16/31): contra un monstruo
// se gastaba el maná en balde. La tabla sale de los datos del hechizo, no de un número a mano.
export const pveUseless = (w, id, t) => !!t && t.kind !== "player" && [16, 31].includes(w.magic?.[id]?.type);
function cast(adv, w, p, b, id, x, y) {
  if (pveUseless(w, id, [...w.ents.values()].find(e => !e.dead && e.x === x && e.y === y && e !== p))) return false;
  b.castAt = w.time;
  adv.command(p.id, { t: "cast", spell: id, x, y });
  return true;
}

// ELECCIÓN POR EFICIENCIA DE MANÁ (v0.85.61, obs. 5): contra un monstruo, para cada hechizo conocido: lanzamientos = ceil(vida / daño medio útil), coste = lanzamientos x maná.
// Daño útil = dados del hechizo (Magic.cfg: v4-v6 el golpe; los de tipo 21/26 «Strike/Blizzard» v7-v9) con el bono de Mag, por la probabilidad de entrar (1 - resistencia mágica del
// monstruo, sin resistir) y menos su absorción. Gana el de menor coste; a igualdad (10 %) el de menos lanzamientos. Esqueletos (resist 40): el Strike supera al Bolt repetido.
export function spellValue(w, p, id, t) {
  const sp = w.magic[id]; if (!sp) return null;
  const strike = sp.type === 21 || sp.type === 26, n = strike ? sp.v7 : sp.v4, d = strike ? sp.v8 : sp.v5, k = strike ? sp.v9 : sp.v6;
  let dmg = (n * (d + 1) / 2 + k) * (1 + ((p.stats.mag || 1) / 3.3) / 100);
  dmg *= 1 - (t.cfg?.absDamage || t.absDamage || 0) / 100;
  const land = id >= 80 ? 1 : Math.max(0.05, 1 - (t.cfg?.resistMagic || 0) / 100);
  const eff = dmg * land * Math.min(1, M.castChance(p, id) / 100);
  if (eff <= 0.5) return null;
  const casts = Math.ceil(Math.max(1, t.hp) / eff);
  return { id, casts, cost: casts * costOf(w, p, id) };
}
// v0.85.89 (Pablo: magos con maná lleno que solo tiran Magic Missile): la eficiencia pura elige SIEMPRE el misil contra un monstruo de la granja (8 de maná frente a 170 del
// Blizzard) y el maná se queda al 80-98 %. Con el maná por encima de RICH gana el que mata en MENOS lanzamientos y, a igualdad, el más potente; por debajo, la eficiencia.
export const RICH = 0.5;
// v0.85.97 (obs. 72/80, Pablo: un mago mató un Orc con Blizzard): con maná de sobra no se elige «el que menos lanzamientos necesita» a ciegas; entre los hechizos que matan en
// (mínimo + 1) lanzamientos como mucho gana el de MENOR coste de maná. Así el Blizzard (43000 de coste en los logs de zzzz) se guarda para hordas y bichos duros.
export function cheapest(w, p, t, keep) {
  const L = [], rich = p.maxMp > 0 && p.mp / p.maxMp >= RICH, noMM = ATTACK.some(h => h !== 0 && known(p, h) && w.magic[h]);   // v0.85.99 (obs. 99): con otro ataque conocido, nunca Magic Missile
  for (const a of ATTACK) {
    if (a === 0 && noMM) continue;
    if (!known(p, a) || !w.magic[a] || p.mp < costOf(w, p, a) + keep || M.castChance(p, a) < 40) continue;
    const v = spellValue(w, p, a, t); if (v) L.push(v);
  }
  if (!L.length) return undefined;
  const minC = Math.min(...L.map(v => v.casts)), pool = rich ? L.filter(v => !(v.casts > minC + 1)) : L;
  let best = null;
  for (const v of pool) if (!best || v.cost < best.cost * 0.9 || (v.cost <= best.cost * 1.1 && v.casts < best.casts)) best = v;
  return (best || L[0]).id;
}
// #117 (revisión de bots: 57 hechizos aprendidos y solo 1-2 usados): rotación de ataque contra un rival. Cada ROT_EVERY lanzamientos cambia al siguiente hechizo útil de la lista
// (ATTACK, de mayor a menor potencia); con menos del 40 % de maná usa el más barato; a más de 7 casillas se queda con el más potente (el rival tiene tiempo de acercarse).
export const ROT_EVERY = 6, ROT_LOW_MANA = 0.4, ROT_FAR = 7;
export function rotateAttack(w, p, t, pv, okAtk) {
  const L = ATTACK.filter(okAtk), many = L.some(a => a !== 0), pool = many ? L.filter(a => a !== 0) : L;
  if (!pool.length) return undefined;
  if (p.maxMp > 0 && p.mp / p.maxMp < ROT_LOW_MANA) return pool.reduce((m, a) => costOf(w, p, a) < costOf(w, p, m) ? a : m);
  if (dist(p, t) > ROT_FAR) return pool[0];
  return pool[Math.floor((pv?.atkN || 0) / ROT_EVERY) % pool.length];
}
// Ataque: lanza el mejor hechizo que pueda pagar al monstruo `t`. Devuelve true si lanzó (el bot no pega en ese turno).
export function fight(adv, w, p, b, t, log) {
  if (!t || !ready(w, p, b) || w.safeAt(p.x, p.y) || dist(p, t) > CAST_RANGE) return false;
  if (t.kind === "player" && sameCity(w, p, t)) return false;
  if (t.kind === "player") {
    // TÁCTICA DE PVP (v0.85.53): 1) siempre intenta paralizar; 2) si no "entra", sospecha de Protection From Magic y prueba con un ataque;
    // 3) si el ataque tampoco hace daño, hay protección: espera a que se le vaya y repite Paralyze; 4) paralizado: Spike Field encima (le quita el sitio
    // al Fire Field rival) y remata con magia. Lo deduce lanzando magias, como un jugador (no lee el estado del rival).
    // v0.85.92 (obs. 59): la memoria de PFM/fallos es por rival (90 s) y no se pierde al cambiar de objetivo (antes se reiniciaba y repetía 100+ Paralyze inútiles)
    const mem = (b.pvm ||= {}), old = mem[t.id], pv = (b.pv = old && w.time - old.seen < 90000 ? old : (mem[t.id] = { id: t.id, fails: 0, waits: 0, waitUntil: 0 })); pv.seen = w.time;
    if (pv.parAt && w.time - pv.parAt > 1600) { if (!sget(w, t, "hold")) pv.fails++; else pv.fails = 0; pv.parAt = 0; }
    if (pv.probeAt && w.time - pv.probeAt > 1600) {
      if (t.hp < pv.probeHp) { pv.fails = 0; log(`⚔ Mi ataque le entra a ${t.name}: no tiene PFM, el Paralyze falló por suerte; lo reintento.`); }
      else { pv.waits++; pv.waitUntil = w.time + 6000; pv.fails = 0; log(`⚔ Mi ataque no le hace nada a ${t.name}: tiene protección mágica. Espero 6 s a que se le vaya y repito Paralyze (espera ${pv.waits}).`); }
      pv.probeAt = 0;
    }
    if (w.time < pv.waitUntil) {                                                  // v0.85.61 (obs. 3): único uso del Defense Shield: contra un rival con PFM (necesita que su magia entre)
      if (pv.waits >= 1 && known(p, DSHIELD) && w.magic[DSHIELD] && !sget(w, p, "protect") && p.mp >= costOf(w, p, DSHIELD) + 30 && cool(b, "dsh", 20000, w)) { stamp(b, "dsh", w); log("⚔ El rival tiene PFM: lanzo Defense Shield para aguantar mientras se le acaba."); return cast(adv, w, p, b, DSHIELD, p.x, p.y); }
      return pv.waits < 3;
    }                              // espera sin gastar maná; tras 3 esperas (protección absoluta) se defiende con la vara
    const area = pvpArea(w, p, b, t, 0);
    if (area !== undefined && !sget(w, t, "hold")) { log(`⚔ Varios rivales juntos: ${w.magic[area].name || "area"} sobre ${t.name}.`); return cast(adv, w, p, b, area, t.x, t.y); }
    { const top = mostThreatening(w, p, b, t, 4); if (top && top !== t && !sget(w, top, "hold") && dist(p, top) <= CAST_RANGE) { b.target = top; t = top; } }
    const par = PARALYZE.find(h => known(p, h) && w.magic[h] && p.mp >= costOf(w, p, h) && M.castChance(p, h) >= 40 && landChance(p, h, t) >= 30), held = sget(w, t, "hold");
    if (par !== undefined && !held && (t.eff?.addPR || 0) < 500) {
      const atk = ATTACK.find(a => known(p, a) && w.magic[a] && p.mp >= costOf(w, p, a) && M.castChance(p, a) >= 40);
      if (pv.fails >= 2 && atk !== undefined) { pv.probeAt = w.time; pv.probeHp = t.hp; log(`⚔ ${pv.fails} Paralyze seguidos no entran a ${t.name}: ¿PFM? Pruebo con ${w.magic[atk].name || "un ataque"} para comprobarlo.`); return cast(adv, w, p, b, atk, t.x, t.y); }
      pv.parAt = w.time; log(`⚔ Paralizo a ${t.name} con ${w.magic[par].name || "un hechizo"}.`); return cast(adv, w, p, b, par, t.x, t.y);
    }
    if (held && known(p, SPIKE) && w.magic[SPIKE] && w.time - (pv.spikeAt || -1e9) > 9000 && p.mp >= costOf(w, p, SPIKE) + 30) { pv.spikeAt = w.time; log(`⚔ ${t.name} está paralizado: Spike Field en su casilla para que no puedan quitárselo con Fire Field.`); return cast(adv, w, p, b, SPIKE, t.x, t.y); }
    // v0.85.55: el daño rompe la parálisis: si hay un compañero cuerpo a cuerpo junto al paralizado, el mago NO tira ataques; deja que peguen los guerreros.
    if (held) { for (const q of w.ents.values()) if (q !== p && q.kind === "player" && friend(p, b, q) && !isCaster(q) && dist(q, t) <= 5) { if (b.spellLog !== "wait" + t.id) { b.spellLog = "wait" + t.id; log(`⚔ ${t.name} está paralizado: no lo toco con magia, que peguen los guerreros (el daño rompe la parálisis).`); } return false; } }
    if (held && b.spellLog !== "held" + t.id) { b.spellLog = "held" + t.id; log(`⚔ Remato con magia a ${t.name} (paralizado, sin guerreros cerca).`); }
  }
  // Reserva de maná (v0.85.55): siempre queda para curarse y para volver a paralizar (x2 contra jugadores), por si llegan enemigos.
  const parKeep = PARALYZE.some(h => known(p, h) && w.magic[h]) ? costOf(w, p, PARALYZE.find(h => known(p, h) && w.magic[h])) * (t.kind === "player" ? 2 : 1) : 0;
  const healKeep = (HEALS.some(h => known(p, h)) ? costOf(w, p, HEALS.find(h => known(p, h))) : 0) + parKeep;
  // v0.85.69: con el rival ya paralizado la reserva de maná no hace falta (no puede pegar) y se remata con hielo, que no libera la parálisis (releaseHold: elem "ice")
  const heldFoe = t.kind === "player" && sget(w, t, "hold"), keep = heldFoe ? (HEALS.some(h => known(p, h)) ? costOf(w, p, HEALS[HEALS.length - 1]) : 0) : healKeep;
  const okAtk = a => known(p, a) && w.magic[a] && p.mp >= costOf(w, p, a) + keep && M.castChance(p, a) >= 40;
  const iceId = heldFoe ? ATTACK.find(a => okAtk(a) && w.magic[a].attr === 4) : undefined;
  let id = t.kind === "player" ? (iceId ?? rotateAttack(w, p, t, b.pv, okAtk)) : cheapest(w, p, t, healKeep);
  if (t.kind === "player" && b.pv && id !== undefined && id !== iceId) b.pv.atkN = (b.pv.atkN || 0) + 1;
  if (t.kind !== "player") {                                                   // v0.85.81: horda (4 o más monstruos juntos al objetivo): base Paralyze + Blizzard como el replay zzzz_620 (Blizzard 31, Paralyze 21 de 147 lanzamientos)
    const grp = npcsNear(w, t, 3);
    const rich = p.maxMp > 0 && p.mp / p.maxMp >= RICH;                        // v0.85.89: con maná de sobra el área sale desde 2 monstruos (y Mass Ice Strike cuenta como área)
    if (grp.length >= (rich ? 2 : 4)) {
      const area = (rich ? [91, 72, 96, 70] : AOE).filter(a => known(p, a) && w.magic[a] && p.mp >= costOf(w, p, a) + healKeep && M.castChance(p, a) >= 40).sort((x, y) => costOf(w, p, x) - costOf(w, p, y))[0];
      const par = PARALYZE[0], hit = w.time - (p.lastCombat || -1e9) < 2500;
      const near = [...w.ents.values()].find(e => e.kind === "npc" && !e.dead && !e.master && e.target === p.id && dist(p, e) <= 2 && !sget(w, e, "hold") && (e.cfg?.resistMagic || 0) < 60 && (e.maxHp || e.hp) >= MINOR_HP);
      if (hit && near && known(p, par) && w.magic[par] && p.mp >= costOf(w, p, par) + healKeep && cool(b, "hpar" + near.id, 6000, w)) { stamp(b, "hpar" + near.id, w); log(`Horda (${grp.length}): paralizo a ${near.name} que ya me alcanza.`); return cast(adv, w, p, b, par, near.x, near.y); }
      if (area !== undefined) id = area;
    }
  }
  if (t.kind !== "player") { const k = mageKit(w, p, b, t, healKeep); if (k) { log(k.msg); return cast(adv, w, p, b, k.id, k.x, k.y); } }
  if (id === undefined) return false;
  if (b.spellLog !== id) { b.spellLog = id; log(`${t.kind === "player" ? "⚔ " : ""}Lanzo ${w.magic[id].name || "hechizo " + id} a ${t.name} (maná ${p.mp}/${p.maxMp}).`); }
  return cast(adv, w, p, b, id, t.x, t.y);
}

// v0.85.90 (Pablo: los magos de control y soporte solo tiraban Magic Missile): cada build usa SU juego de hechizos contra monstruos, con maná por encima de RICH
// (y la reserva de curación): control = Mass Illusion Movement (95) sobre grupos + Paralyze al que ya le alcanza; soporte = Paralyze + PFM (33) + AMP (65) antes de pelear.
// Invento del port (el original no tiene bots); ignora noBuffZone porque la petición es verlos lanzar también en la granja.
export function mageKit(w, p, b, t, keep) {
  const build = isMage(p) ? mageBuildOf(p).id : null; if (build !== "control" && build !== "support") return null;
  const ok = id => known(p, id) && w.magic[id] && p.mp >= costOf(w, p, id) + keep && M.castChance(p, id) >= 40;
  const grp = npcsNear(w, t, 3).length;
  if (build === "control" && grp >= 1 && ok(95) && !pveUseless(w, 95, t) && cool(b, "mim", 8000, w)) { stamp(b, "mim", w); return { id: 95, x: t.x, y: t.y, msg: `Mass Illusion Movement sobre ${grp} monstruos junto a ${t.name}.` }; }
  if (build === "support" && !sget(w, p, "protect") && cool(b, "kitprot", 30000, w)) {
    const id = [AMP, PFM].find(ok); if (id !== undefined) { stamp(b, "kitprot", w); return { id, x: p.x, y: p.y, msg: `Me protejo con ${w.magic[id].name} antes de seguir.` }; }
  }
  const par = PARALYZE.find(ok);
  if (par !== undefined) {
    const near = [...w.ents.values()].find(e => e.kind === "npc" && !e.dead && !e.master && e.target === p.id && dist(p, e) <= 2 && !sget(w, e, "hold") && (e.cfg?.resistMagic || 0) < 60 && (e.maxHp || e.hp) >= MINOR_HP && cool(b, "kpar" + e.id, 6000, w));
    if (near) { stamp(b, "kpar" + near.id, w); return { id: par, x: near.x, y: near.y, msg: `Paralizo a ${near.name} que ya me alcanza.` }; }
  }
  return null;
}
// PVP DE MAGO (v0.85.78, INVENTO a partir del replay de 'zzzz' 2026-10-17: 157 hechizos, 47 Blizzard, 35 Paralyze, 16 Great Heal, 17 golpes): contra grupos usa area
// (Blizzard 91, Earth Shock Wave 96, Bloody Shock Wave 70), paraliza primero al mas peligroso y cura solo con margen. El original no tiene bots.
export const AOE = [91, 96, 70];
export const npcsNear = (w, c, r) => { const L = []; for (const e of w.ents.values()) if (e.kind === "npc" && !e.dead && !e.master && e.hp > 0 && dist(e, c) <= r) L.push(e); return L; };
export const hordeAround = (w, p, r) => npcsNear(w, p, r).length;
// reserva de maná para el hechizo caro: dos lanzamientos del ataque más fuerte que conoce (si tiene poción azul se bebe antes de quedarse sin él)
export function manaFloor(w, p) { const a = ATTACK.find(h => known(p, h) && w.magic[h]); return a === undefined ? 0 : Math.min(p.maxMp * 0.6, costOf(w, p, a) * 2); }
export const foesNear = (w, p, b, c, r) => { const L = []; for (const q of w.ents.values()) if (q !== p && q.kind === "player" && !q.dead && q.hp > 0 && !sameCity(w, p, q) && !friend(p, b, q) && dist(q, c) <= r) L.push(q); return L; };
// amenaza: lanzadores (arma magica o mas MP que PV) y vida alta pesan mas; el casi muerto menos
export const threat = q => ((q.eff?.wtype >= 34 && q.eff?.wtype <= 39 || q.mp > q.hp) ? 2 : 1) * (1 + (q.level || 1) / 100) * (0.5 + q.hp / Math.max(1, q.maxHp || 1));
export const mostThreatening = (w, p, b, c, r) => foesNear(w, p, b, c, r).sort((a, z) => threat(z) - threat(a))[0];
// area contra grupo: 2 o mas rivales a <= 3 casillas del objetivo; el area mas barata que dañe (mana por rival alcanzado)
export function pvpArea(w, p, b, t, keep) {
  const grp = foesNear(w, p, b, t, 3); if (grp.length < 2) return undefined;
  return AOE.filter(a => known(p, a) && w.magic[a] && p.mp >= costOf(w, p, a) + keep && M.castChance(p, a) >= 40).sort((x, y) => costOf(w, p, x) - costOf(w, p, y))[0];
}
// Great Heal con margen: con 2 o mas rivales encima se huye antes que curar (salvo vida critica)
export const healSafe = (w, p, b) => foesNear(w, p, b, p, 3).length < 2 || p.hp / p.maxHp < 0.25;

// CURA QUE COMPENSA (v0.85.62, obs. 9): Great Heal (28 maná) solo si la vida que falta lo justifica; si no, Heal (15). Dados de Magic.cfg: v4 x (v5+1)/2 + v6.
const healAvg = sp => sp.v4 * (sp.v5 + 1) / 2 + sp.v6;
export function bestHeal(w, p, missing) {
  const ok = HEALS.filter(h => known(p, h) && w.magic[h] && p.mp >= costOf(w, p, h)).sort((a, b) => costOf(w, p, a) - costOf(w, p, b));
  return ok.find(h => healAvg(w.magic[h]) >= missing * 0.8) ?? ok[ok.length - 1];
}
// enemigos pegándome ahora mismo (a 2 casillas): con 5 o más se corre antes que curar
export const swarmed = (w, p) => { let n = 0; for (const e of w.ents.values()) if (e.kind === "npc" && !e.dead && e.hp > 0 && dist(p, e) <= 2) n++; return n >= 5; };

// Apoyo: curarse, curar al dueño o a un compañero de grupo, y escudo en pelea. Devuelve true si lanzó.
// AMENAZA MÁGICA (v0.85.61, obs. 2 y 4): daño mágico esperable de los lanzadores hostiles cerca (nivel x cantidad; jefe pesa x3). Los monstruos sin magia dan 0.
// PFM/AMP solo se lanzan si supera BUFF_MIN: el maná y el turno del hechizo cuestan más que la protección contra un slime. Lanzadores según NPC.cfg.
export const isCasterMob = e => (e.cfg?.magicLevel || 0) > 0 && (e.cfg?.maxMana || 0) > 0;          // NPC.cfg: nivel de magia y maná (Cyclops 5/450, Liche 6/1000, Orc-Mage 3/150; Slime 0/0)
export const BUFF_MIN = 6;
export function worthBuff(w, p, range = 8) {
  let score = 0;
  for (const e of w.ents.values()) {
    if (e.kind !== "npc" || e.dead || e.master || dist(p, e) > range || !isCasterMob(e)) continue;
    score += e.cfg.magicLevel * 1.5 * (e.boss ? 3 : 1);                       // 1 Cyclops = 7,5 (sube); 1 Orc-Mage = 4,5 (no); 2 Orc-Mage = 9 (sí)
  }
  return score;
}
export function support(adv, w, p, b, log) {
  if (!ready(w, p, b)) return false;
  const inFight = w.time - (p.lastCombat || -1e9) < 6000;
  { const pl = plan(w, p, b); if (pl) { log(pl.msg); return cast(adv, w, p, b, pl.id, pl.x, pl.y); } }
  const heal = swarmed(w, p) || !healSafe(w, p, b) ? undefined : bestHeal(w, p, p.maxHp - p.hp);
  if (heal !== undefined) {
    const hpf = p.hp / p.maxHp;
    if (hpf < 0.6) { log(`Me curo con ${w.magic[heal].name || "una cura"} (${Math.round(hpf * 100)}% de vida).`); return cast(adv, w, p, b, heal, p.x, p.y); }
    let ally = null, low = 0.55;
    for (const q of w.ents.values()) {
      if (q === p || q.kind !== "player" || q.dead || dist(p, q) > HEAL_RANGE) continue;
      const mine = q.id === b.owner || (p.party?.id && q.party?.id === p.party.id);
      if (mine && q.hp / q.maxHp < low) { low = q.hp / q.maxHp; ally = q; }
    }
    if (ally) { log(`Curo a ${ally.name} (${Math.round(low * 100)}% de vida).`); const h2 = bestHeal(w, p, (1 - low) * ally.maxHp) ?? heal; return cast(adv, w, p, b, h2, ally.x, ally.y); }
  }
  const pre = !inFight && b.target?.kind === "npc" && dist(p, b.target) <= 10;            // v0.85.81: buffs al empezar la pelea (monstruo a la vista), no a mitad (zzzz_620: PFM+AMP 7 veces entre hechizos de ataque)
  if ((inFight || pre) && !noBuffZone(w) && w.time - (b.shieldAt || -1e9) > 45000 && !sget(w, p, "protect")) {
    // v0.85.61 (obs. 2-4): PFM solo si la amenaza mágica lo vale (worthBuff): ciclopes/jefes/magos rivales sí, slimes no. El escudo físico ya NO se usa de defensa (obs. 3).
    const foe = b.target?.kind === "player" ? b.target : null, mageFoe = foe && (foe.eff?.wtype >= 34 && foe.eff?.wtype <= 39 || foe.mp > foe.hp);
    if ((foe || mageFoe || worthBuff(w, p, 6) >= BUFF_MIN) && known(p, PFM) && w.magic[PFM] && p.mp >= costOf(w, p, PFM) + 20) { b.shieldAt = w.time; log(mageFoe ? "⚔ Me protejo con Protection From Magic (enemigo mago)." : "Me protejo con Protection From Magic (hay lanzadores cerca: vale la pena)."); return cast(adv, w, p, b, PFM, p.x, p.y); }
  }
  return false;
}

// VALOR MÁGICO DE UN OBJETO (INVENTO): itemlevel.js solo mide daño/defensa/precio; para un lanzador un bastón con ahorro de maná o +% de daño
// mágico, o un amuleto de resistencia, valen más de lo que dice el item level. Se suma a itemLevel solo para quien lanza hechizos.
// Campos y efectos como en inventory.js calcEff: ATTACK_MANASAVE (v4 ahorro de maná, v5 = 1 y v6 = +% daño mágico), ADDEFFECT v1=1 (resistencia mágica) y v1=2 (ahorro de maná).
export function casterBonus(d) {
  if (!d) return 0;
  if (d.effectType === EFFECT.ATTACK_MANASAVE) return (d.v4 || 0) * 0.5 + (d.v5 === 1 ? (d.v6 || 0) * 0.6 : 0);
  if (d.effectType === EFFECT.ADDEFFECT) return d.v1 === 1 ? (d.v2 || 0) * 0.4 : d.v1 === 2 && d.id !== 648 ? (d.v2 || 0) * 0.6 : 0;
  return 0;
}

// ---- APOYO DE EQUIPO (v0.85.53) ----
// v0.85.99 (obs. 103/104): jugadores de la misma ciudad (mismo bando) fuera de zona de lucha no son rivales: ni ataque, ni parálisis, ni Detect Invisibility
const sameCity = (w, p, q) => q !== p && q.kind === "player" && p.side > 0 && p.side === q.side && !w.fightZone;
const friend = (p, b, q) => q !== p && q.kind === "player" && !q.dead && (q.id === b.owner || (p.party?.id && q.party?.id === p.party.id) || (p.guild && q.guild === p.guild));
const cool = (b, key, ms, w) => w.time - ((b.cd ||= {})[key] || -1e9) >= ms;
const stamp = (b, key, w) => { (b.cd ||= {})[key] = w.time; };
// Qué lanzar para el equipo, o null: Fire Field para liberar a un amigo paralizado (el fuego quita el efecto), Invisibility para salvar a un amigo con poca vida
// o para emboscar, AMP / PFM / Berserk a los amigos en pelea, Detect Invisibility si hay un rival invisible.
// v0.85.62 (obs. 12): en la granja (zona segura de entrenamiento) no se lanzan buffs; solo en cripta, Promise Land o campo abierto.
export const noBuffZone = w => w.map?.kind === "farm";
export const hasAttack = p => ATTACK.some(a => known(p, a));
export function plan(w, p, b) {
  if (!w.magic) return null;
  const inFight = w.time - (p.lastCombat || -1e9) < 6000, cost = id => (known(p, id) && w.magic[id] && M.castChance(p, id) >= 15 ? costOf(w, p, id) : 1e9);
  const spare = 25, foe = b.target?.kind === "player" ? b.target : null;
  // v0.85.83 (obs. 40): Berserk sobre sí mismo (id 50). Antes solo se lanzaba a los amigos (el bucle excluye a `p`) y nunca en la granja (noBuffZone),
  // justo donde el guerrero caza. Solo el que pelea cuerpo a cuerpo; con el objetivo cerca y maná de sobra.
  const tg = b.target;
  if (!isCaster(p) && tg && !tg.dead && dist(p, tg) <= 4 && !sget(w, p, "berserk") && cost(BERSERK) + 30 <= p.mp && cool(b, "selfbz", 6000, w)) { stamp(b, "selfbz", w); return { id: BERSERK, x: p.x, y: p.y, msg: "⚔ Me lanzo Berserk para pegar el doble." }; }
  // v0.85.100 (#110): Berserk a un guerrero amigo vale también en la granja (PvE de entrenamiento); #109: nunca a un mago (no pega con golpes físicos).
  if (noBuffZone(w)) {
    if (b.target && !b.target.dead && w.time - (p.lastCombat || -1e9) < 6000) for (const q of w.ents.values()) if (friend(p, b, q) && !isCaster(q) && dist(p, q) <= HEAL_RANGE && !sget(w, q, "berserk") && cost(BERSERK) + spare <= p.mp && cool(b, BERSERK + ":" + q.id, 40000, w)) { stamp(b, BERSERK + ":" + q.id, w); return { id: BERSERK, x: q.x, y: q.y, msg: `⚔ Apoyo a ${q.name} con Berserk.` }; }
    return null;
  }
  // v0.85.83 (obs. 44): en PvP el bot se protege como un jugador: PFM al empezar contra cualquier jugador rival (no solo magos); paralizar lo hace fight()/utility().
  if (foe && !sget(w, p, "protect") && cost(PFM) + spare <= p.mp && cool(b, "selfpfm", 20000, w)) { stamp(b, "selfpfm", w); return { id: PFM, x: p.x, y: p.y, msg: `⚔ Me protejo con Protection From Magic contra ${foe.name}.` }; }
  const allies = []; for (const q of w.ents.values()) if (friend(p, b, q) && dist(p, q) <= HEAL_RANGE) allies.push(q);
  for (const q of allies) if (sget(w, q, "hold") && cost(FIREFIELD) + spare <= p.mp && cool(b, "fire" + q.id, 2500, w)) { stamp(b, "fire" + q.id, w); return { id: FIREFIELD, x: q.x, y: q.y, msg: `⚔ ${q.name} está paralizado: Fire Field en su casilla para quitarle el efecto.` }; }
  // v0.85.62 (obs. 7): el mago da aliento a los guerreros sin SP (así gastan su maná en invisibilidad, PFM y detección)
  for (const q of allies) if (q !== p && q.kind === "player" && !isCaster(q) && q.sp < q.maxSp * 0.3) { const id = cost(28) + spare <= p.mp && q.sp < q.maxSp * 0.15 ? 28 : 23; if (cost(id) + spare <= p.mp && cool(b, "sp" + q.id, 12000, w)) { stamp(b, "sp" + q.id, w); return { id, x: q.x, y: q.y, msg: `⚔ Doy aliento a ${q.name} (SP ${q.sp}/${q.maxSp}) con ${w.magic[id].name}.` }; } }
  for (const q of allies) if (inFight && q.hp / q.maxHp < 0.35 && !sget(w, q, "invis") && cost(INVIS) + spare <= p.mp && cool(b, "inv" + q.id, 15000, w)) { stamp(b, "inv" + q.id, w); return { id: INVIS, x: q.x, y: q.y, msg: `⚔ ${q.name} está al ${Math.round(q.hp / q.maxHp * 100)}%: lo hago Invisible para salvarlo.` }; }
  if (foe && !inFight && dist(p, foe) >= 6 && !sget(w, p, "invis") && cost(INVIS) + spare <= p.mp && cool(b, "amb", 20000, w)) { stamp(b, "amb", w); return { id: INVIS, x: p.x, y: p.y, msg: `⚔ Me hago Invisible para emboscar a ${foe.name}.` }; }
  if (foe && cost(DETECT) + spare <= p.mp && cool(b, "det", 12000, w) && [...w.ents.values()].some(e => e.kind === "player" && e !== p && !friend(p, b, e) && !sameCity(w, p, e) && sget(w, e, "invis") && dist(p, e) <= 9)) { stamp(b, "det", w); return { id: DETECT, x: p.x, y: p.y, msg: "⚔ Hay un rival invisible cerca: lanzo Detect Invisibility." }; }
  if (inFight || foe) for (const q of allies) {
    for (const id of [AMP, PFM, BERSERK]) {
      if (id === BERSERK && isCaster(q)) continue;                                      // #109
      if ((id === AMP || id === PFM) && !foe && worthBuff(w, p, 9) < BUFF_MIN) continue;      // obs. 4: sin amenaza mágica no se gasta maná en protección
      const have = id === BERSERK ? sget(w, q, "berserk") : sget(w, q, "protect");
      if (!have && cost(id) + spare <= p.mp && cool(b, id + ":" + q.id, 40000, w)) { stamp(b, id + ":" + q.id, w); return { id, x: q.x, y: q.y, msg: `⚔ Apoyo a ${q.name} con ${w.magic[id].name || "un hechizo"}.` }; }
    }
  }
  return null;
}

// GUERRERO CON 36 DE INT (v0.85.53): no pelea con magia pero apoya y paraliza. Para lanzar tiene que quitarse arma y escudo (usable de magicsys.js) y se los
// vuelve a poner enseguida. Devuelve true si gastó el turno.
export function utility(adv, w, p, b, log) {
  if (isCaster(p) || !w.magic || p.dead || p.stats.int < 20 || w.safeAt(p.x, p.y) || w.busy(p)) return false;
  const t = b.target?.kind === "player" ? b.target : null;
  let pl = null;
  if (w.time - (p.lastCast || -1e9) >= M.CAST_COOLDOWN_MS && w.time - (b.castAt || -1e9) >= 1100) {
    pl = plan(w, p, b);
    if (!pl && t && dist(p, t) <= CAST_RANGE && !sget(w, t, "hold") && (t.eff?.addPR || 0) < 500 && cool(b, "wpar", 4000, w)) {
      const par = PARALYZE.find(h => known(p, h) && w.magic[h] && p.mp >= costOf(w, p, h) + 10 && M.castChance(p, h) >= 25 && landChance(p, h, t) >= 25);
      if (par !== undefined) { stamp(b, "wpar", w); pl = { id: par, x: t.x, y: t.y, msg: `⚔ Paralizo a ${t.name} (guerrero con Int ${p.stats.int}).` }; }
    }
    if (!pl && t && w.time - (p.lastCombat || -1e9) < 6000 && !sget(w, p, "protect") && known(p, PFM) && w.magic[PFM] && p.mp >= costOf(w, p, PFM) + 10 && cool(b, "wpfm", 40000, w)) { stamp(b, "wpfm", w); pl = { id: PFM, x: p.x, y: p.y, msg: `⚔ Me pongo PFM contra el mago ${t.name}.` }; }
  }
  const sw = b.swap;
  if (!pl) {                                                                      // nada que lanzar: vuelve a equiparse (una pieza por turno)
    if (sw && w.time - sw.at > 2500) { const uid = sw.uids.shift(); if (uid === undefined) b.swap = null; else { adv.command(p.id, { t: "equip", uid }); return true; } }
    return false;
  }
  if (!handsOk(p)) {                                                              // se desarma para lanzar (como mucho cada 5 s)
    if (!cool(b, "unarm", 15000, w)) return false;                            // v0.85.92 (obs. 51): 15 s (antes 5): se desarmaba/rearmaba 165-184 veces sin lanzar
    const uids = [EQUIP.LHAND, EQUIP.TWOHAND, EQUIP.RHAND].map(s => p.equip[s]).filter(u => u !== undefined);
    for (const uid of uids) adv.command(p.id, { t: "unequip", uid });
    b.swap = { at: w.time, uids: [...(sw?.uids || []), ...uids.reverse()].filter((u, i, a) => a.indexOf(u) === i) };
    stamp(b, "unarm", w); log("⚔ Me quito arma y escudo para lanzar un hechizo."); return true;
  }
  if (b.swap) b.swap.at = w.time;
  log(pl.msg); return cast(adv, w, p, b, pl.id, pl.x, pl.y);
}
