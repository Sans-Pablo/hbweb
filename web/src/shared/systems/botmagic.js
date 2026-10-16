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
import { isCaster, isMage, WAR_INT } from "./builds.js";
import { sget } from "./status.js";

// Orden de estudio: primero curar y el misil, luego escudo y ataques fuertes, al final los de apoyo caros (ids de Magic.cfg).
// v0.85.46: compran TODO lo que sirve para pelear (ataque, paralizar, PFM) en cuanto tienen Int y oro; lo caro (Energy Strike, Lightning Strike, Meteor, Blizzard) al final.
export const STUDY_ORDER = [1, 0, 33, 25, 35, 13, 32, 34, 10, 20, 21, 30, 24, 41, 47, 43, 44, 50, 54, 45, 57, 60, 65, 74, 81, 91];
export const WAR_STUDY = [33, 32, 34, 35, 25, 13, 24];          // guerrero con Int 36: PFM, Invisibility, Detect, Paralyze (Magic.cfg reqInt 32/30/30/36)
const INVIS = 32, DETECT = 34, FIREFIELD = 41, SPIKE = 54, BERSERK = 50, AMP = 65, PFA = 24;   // ids de Magic.cfg (claves de magic.json)
export const ATTACK = [91, 81, 74, 60, 57, 47, 43, 45, 30, 20, 10, 0];   // Blizzard, Meteor Strike, Lightning Strike, Energy Strike, Ice Strike, Triple Energy Bolt, Lightning, Chill Wind, Fire Strike, Fire Ball, Energy Bolt, Magic Missile
export const HEALS = [21, 1];                            // Great Heal, Heal
export const SHIELDS = [44, 13];                         // Great Defense Shield, Defense Shield
export const PARALYZE = [35, 25];                       // Paralyze, Hold Person (contra jugadores: el combo del mago es paralizar y rematar)
const PFM = 33;                                         // Protection From Magic (contra otro lanzador)
const GOLD_RESERVE = 150;                               // oro que no gasta en hechizos (pociones y comida)
const CAST_RANGE = 9, HEAL_RANGE = 8;                   // la orden admite 11 (magicsys.js); se queda corto para no fallar por el movimiento del objetivo

const isWand = p => p.eff?.wtype >= 34 && p.eff?.wtype <= 39;
export const handsOk = p => p.equip[EQUIP.LHAND] === undefined && p.equip[EQUIP.TWOHAND] === undefined && (p.equip[EQUIP.RHAND] === undefined || isWand(p));
export const canCast = p => isCaster(p) && handsOk(p);
const known = (p, id) => !!p.magic?.[id];
const costOf = (w, p, id) => M.manaCost(p, w.magic[id], id, !!w.fightZone);

// Aprende lo que pueda (Int y oro). Un recado, una magia como mucho.
export function study(w, p, b, log) {
  if (!w.magic || (!isCaster(p) && p.stats.int < 26)) return false;
  for (const id of isCaster(p) ? STUDY_ORDER : WAR_STUDY) {
    const sp = w.magic[id];
    if (!sp || known(p, id) || sp.cost < 0 || p.stats.int < sp.reqInt || p.gold < sp.cost + GOLD_RESERVE) continue;
    const before = p.gold;
    w.command(p.id, { t: "learn", spell: id });
    if (known(p, id)) { log(`Aprendo ${sp.name || "el hechizo " + id} (${before - p.gold} de oro, Int ${sp.reqInt}).`); return true; }
  }
  return false;
}

// El mago puro lleva las manos libres o una varita: se quita escudo, armas a dos manos y espadas (si no, el hechizo se rechaza).
export function ensureHands(adv, w, p, b, log) {
  if (!isMage(p) || handsOk(p) || w.time - (b.handsAt || -1e9) < 8000) return false;
  b.handsAt = w.time;
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
function cast(adv, w, p, b, id, x, y) {
  b.castAt = w.time;
  adv.command(p.id, { t: "cast", spell: id, x, y });
  return true;
}

// Ataque: lanza el mejor hechizo que pueda pagar al monstruo `t`. Devuelve true si lanzó (el bot no pega en ese turno).
export function fight(adv, w, p, b, t, log) {
  if (!t || !ready(w, p, b) || w.safeAt(p.x, p.y) || dist(p, t) > CAST_RANGE) return false;
  if (t.kind === "player") {
    // TÁCTICA DE PVP (v0.85.53): 1) siempre intenta paralizar; 2) si no "entra", sospecha de Protection From Magic y prueba con un ataque;
    // 3) si el ataque tampoco hace daño, hay protección: espera a que se le vaya y repite Paralyze; 4) paralizado: Spike Field encima (le quita el sitio
    // al Fire Field rival) y remata con magia. Lo deduce lanzando magias, como un jugador (no lee el estado del rival).
    const pv = (b.pv = b.pv?.id === t.id ? b.pv : { id: t.id, fails: 0, waits: 0, waitUntil: 0 });
    if (pv.parAt && w.time - pv.parAt > 1600) { if (!sget(w, t, "hold")) pv.fails++; else pv.fails = 0; pv.parAt = 0; }
    if (pv.probeAt && w.time - pv.probeAt > 1600) {
      if (t.hp < pv.probeHp) { pv.fails = 0; log(`⚔ Mi ataque le entra a ${t.name}: no tiene PFM, el Paralyze falló por suerte; lo reintento.`); }
      else { pv.waits++; pv.waitUntil = w.time + 6000; pv.fails = 0; log(`⚔ Mi ataque no le hace nada a ${t.name}: tiene protección mágica. Espero 6 s a que se le vaya y repito Paralyze (espera ${pv.waits}).`); }
      pv.probeAt = 0;
    }
    if (w.time < pv.waitUntil) return pv.waits < 3;                              // espera sin gastar maná; tras 3 esperas (protección absoluta) se defiende con la vara
    const par = PARALYZE.find(h => known(p, h) && w.magic[h] && p.mp >= costOf(w, p, h) && M.castChance(p, h) >= 40), held = sget(w, t, "hold");
    if (par !== undefined && !held && (t.eff?.addPR || 0) < 500) {
      const atk = ATTACK.find(a => known(p, a) && w.magic[a] && p.mp >= costOf(w, p, a) && M.castChance(p, a) >= 40);
      if (pv.fails >= 2 && atk !== undefined) { pv.probeAt = w.time; pv.probeHp = t.hp; log(`⚔ ${pv.fails} Paralyze seguidos no entran a ${t.name}: ¿PFM? Pruebo con ${w.magic[atk].name || "un ataque"} para comprobarlo.`); return cast(adv, w, p, b, atk, t.x, t.y); }
      pv.parAt = w.time; log(`⚔ Paralizo a ${t.name} con ${w.magic[par].name || "un hechizo"}.`); return cast(adv, w, p, b, par, t.x, t.y);
    }
    if (held && known(p, SPIKE) && w.magic[SPIKE] && w.time - (pv.spikeAt || -1e9) > 9000 && p.mp >= costOf(w, p, SPIKE) + 30) { pv.spikeAt = w.time; log(`⚔ ${t.name} está paralizado: Spike Field en su casilla para que no puedan quitárselo con Fire Field.`); return cast(adv, w, p, b, SPIKE, t.x, t.y); }
    if (held && b.spellLog !== "held" + t.id) { b.spellLog = "held" + t.id; log(`⚔ Remato con magia a ${t.name} (paralizado).`); }
  }
  const healKeep = HEALS.some(h => known(p, h)) ? costOf(w, p, HEALS.find(h => known(p, h))) : 0;
  const id = ATTACK.find(a => known(p, a) && w.magic[a] && p.mp >= costOf(w, p, a) + healKeep && M.castChance(p, a) >= 40);
  if (id === undefined) return false;
  if (b.spellLog !== id) { b.spellLog = id; log(`${t.kind === "player" ? "⚔ " : ""}Lanzo ${w.magic[id].name || "hechizo " + id} a ${t.name} (maná ${p.mp}/${p.maxMp}).`); }
  return cast(adv, w, p, b, id, t.x, t.y);
}

// Apoyo: curarse, curar al dueño o a un compañero de grupo, y escudo en pelea. Devuelve true si lanzó.
export function support(adv, w, p, b, log) {
  if (!ready(w, p, b)) return false;
  const inFight = w.time - (p.lastCombat || -1e9) < 6000;
  { const pl = plan(w, p, b); if (pl) { log(pl.msg); return cast(adv, w, p, b, pl.id, pl.x, pl.y); } }
  const heal = HEALS.find(h => known(p, h) && w.magic[h] && p.mp >= costOf(w, p, h));
  if (heal !== undefined) {
    const hpf = p.hp / p.maxHp;
    if (hpf < 0.6) { log(`Me curo con ${w.magic[heal].name || "una cura"} (${Math.round(hpf * 100)}% de vida).`); return cast(adv, w, p, b, heal, p.x, p.y); }
    let ally = null, low = 0.55;
    for (const q of w.ents.values()) {
      if (q === p || q.kind !== "player" || q.dead || dist(p, q) > HEAL_RANGE) continue;
      const mine = q.id === b.owner || (p.party?.id && q.party?.id === p.party.id);
      if (mine && q.hp / q.maxHp < low) { low = q.hp / q.maxHp; ally = q; }
    }
    if (ally) { log(`Curo a ${ally.name} (${Math.round(low * 100)}% de vida).`); return cast(adv, w, p, b, heal, ally.x, ally.y); }
  }
  if (inFight && w.time - (b.shieldAt || -1e9) > 45000 && !sget(w, p, "protect")) {
    const foe = b.target?.kind === "player" ? b.target : null, mageFoe = foe && (foe.eff?.wtype >= 34 && foe.eff?.wtype <= 39 || foe.mp > foe.hp);      // contra otro mago, PFM; contra el resto, escudo físico
    if (mageFoe && known(p, PFM) && w.magic[PFM] && p.mp >= costOf(w, p, PFM) + 20) { b.shieldAt = w.time; log("⚔ Me protejo con Protection From Magic (enemigo mago)."); return cast(adv, w, p, b, PFM, p.x, p.y); }
    const sh = SHIELDS.find(s => known(p, s) && w.magic[s] && p.mp >= costOf(w, p, s) + 20);
    if (sh !== undefined) { b.shieldAt = w.time; log(`${mageFoe ? "⚔ " : ""}Me protejo con ${w.magic[sh].name || "un escudo"}.`); return cast(adv, w, p, b, sh, p.x, p.y); }
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
const friend = (p, b, q) => q !== p && q.kind === "player" && !q.dead && (q.id === b.owner || (p.party?.id && q.party?.id === p.party.id) || (p.guild && q.guild === p.guild));
const cool = (b, key, ms, w) => w.time - ((b.cd ||= {})[key] || -1e9) >= ms;
const stamp = (b, key, w) => { (b.cd ||= {})[key] = w.time; };
// Qué lanzar para el equipo, o null: Fire Field para liberar a un amigo paralizado (el fuego quita el efecto), Invisibility para salvar a un amigo con poca vida
// o para emboscar, AMP / PFM / Berserk a los amigos en pelea, Detect Invisibility si hay un rival invisible.
export function plan(w, p, b) {
  if (!w.magic) return null;
  const inFight = w.time - (p.lastCombat || -1e9) < 6000, cost = id => (known(p, id) && w.magic[id] && M.castChance(p, id) >= 15 ? costOf(w, p, id) : 1e9);
  const spare = 25, foe = b.target?.kind === "player" ? b.target : null;
  const allies = []; for (const q of w.ents.values()) if (friend(p, b, q) && dist(p, q) <= HEAL_RANGE) allies.push(q);
  for (const q of allies) if (sget(w, q, "hold") && cost(FIREFIELD) + spare <= p.mp && cool(b, "fire" + q.id, 2500, w)) { stamp(b, "fire" + q.id, w); return { id: FIREFIELD, x: q.x, y: q.y, msg: `⚔ ${q.name} está paralizado: Fire Field en su casilla para quitarle el efecto.` }; }
  for (const q of allies) if (inFight && q.hp / q.maxHp < 0.35 && !sget(w, q, "invis") && cost(INVIS) + spare <= p.mp && cool(b, "inv" + q.id, 15000, w)) { stamp(b, "inv" + q.id, w); return { id: INVIS, x: q.x, y: q.y, msg: `⚔ ${q.name} está al ${Math.round(q.hp / q.maxHp * 100)}%: lo hago Invisible para salvarlo.` }; }
  if (foe && !inFight && dist(p, foe) >= 6 && !sget(w, p, "invis") && cost(INVIS) + spare <= p.mp && cool(b, "amb", 20000, w)) { stamp(b, "amb", w); return { id: INVIS, x: p.x, y: p.y, msg: `⚔ Me hago Invisible para emboscar a ${foe.name}.` }; }
  if (foe && cost(DETECT) + spare <= p.mp && cool(b, "det", 12000, w) && [...w.ents.values()].some(e => e.kind === "player" && e !== p && !friend(p, b, e) && sget(w, e, "invis") && dist(p, e) <= 9)) { stamp(b, "det", w); return { id: DETECT, x: p.x, y: p.y, msg: "⚔ Hay un rival invisible cerca: lanzo Detect Invisibility." }; }
  if (inFight || foe) for (const q of allies) {
    for (const id of [AMP, PFM, BERSERK]) {
      const have = id === BERSERK ? sget(w, q, "berserk") : sget(w, q, "protect");
      if (!have && cost(id) + spare <= p.mp && cool(b, id + ":" + q.id, 40000, w)) { stamp(b, id + ":" + q.id, w); return { id, x: q.x, y: q.y, msg: `⚔ Apoyo a ${q.name} con ${w.magic[id].name || "un hechizo"}.` }; }
    }
  }
  return null;
}

// GUERRERO CON 36 DE INT (v0.85.53): no pelea con magia pero apoya y paraliza. Para lanzar tiene que quitarse arma y escudo (usable de magicsys.js) y se los
// vuelve a poner enseguida. Devuelve true si gastó el turno.
export function utility(adv, w, p, b, log) {
  if (isCaster(p) || !w.magic || p.dead || p.stats.int < 30 || w.safeAt(p.x, p.y) || w.busy(p)) return false;
  const t = b.target?.kind === "player" ? b.target : null;
  let pl = null;
  if (w.time - (p.lastCast || -1e9) >= M.CAST_COOLDOWN_MS && w.time - (b.castAt || -1e9) >= 1100) {
    pl = plan(w, p, b);
    if (!pl && t && dist(p, t) <= CAST_RANGE && !sget(w, t, "hold") && (t.eff?.addPR || 0) < 500 && cool(b, "wpar", 4000, w)) {
      const par = PARALYZE.find(h => known(p, h) && w.magic[h] && p.mp >= costOf(w, p, h) + 10 && M.castChance(p, h) >= 25);
      if (par !== undefined) { stamp(b, "wpar", w); pl = { id: par, x: t.x, y: t.y, msg: `⚔ Paralizo a ${t.name} (guerrero con Int ${p.stats.int}).` }; }
    }
    if (!pl && t && w.time - (p.lastCombat || -1e9) < 6000 && !sget(w, p, "protect") && known(p, PFM) && w.magic[PFM] && p.mp >= costOf(w, p, PFM) + 10 && cool(b, "wpfm", 40000, w) && ((t.eff?.wtype >= 34 && t.eff?.wtype <= 39) || t.mp > t.hp)) { stamp(b, "wpfm", w); pl = { id: PFM, x: p.x, y: p.y, msg: `⚔ Me pongo PFM contra el mago ${t.name}.` }; }
  }
  const sw = b.swap;
  if (!pl) {                                                                      // nada que lanzar: vuelve a equiparse (una pieza por turno)
    if (sw && w.time - sw.at > 2500) { const uid = sw.uids.shift(); if (uid === undefined) b.swap = null; else { adv.command(p.id, { t: "equip", uid }); return true; } }
    return false;
  }
  if (!handsOk(p)) {                                                              // se desarma para lanzar (como mucho cada 5 s)
    if (!cool(b, "unarm", 5000, w)) return false;
    const uids = [EQUIP.LHAND, EQUIP.TWOHAND, EQUIP.RHAND].map(s => p.equip[s]).filter(u => u !== undefined);
    for (const uid of uids) adv.command(p.id, { t: "unequip", uid });
    b.swap = { at: w.time, uids: [...(sw?.uids || []), ...uids.reverse()].filter((u, i, a) => a.indexOf(u) === i) };
    stamp(b, "unarm", w); log("⚔ Me quito arma y escudo para lanzar un hechizo."); return true;
  }
  if (b.swap) b.swap.at = w.time;
  log(pl.msg); return cast(adv, w, p, b, pl.id, pl.x, pl.y);
}
