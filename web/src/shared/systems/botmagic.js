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
import { isCaster, isMage } from "./builds.js";
import { sget } from "./status.js";

// Orden de estudio: primero curar y el misil, luego escudo y ataques fuertes, al final los de apoyo caros (ids de Magic.cfg).
// v0.85.46: compran TODO lo que sirve para pelear (ataque, paralizar, PFM) en cuanto tienen Int y oro; lo caro (Energy Strike, Lightning Strike, Meteor, Blizzard) al final.
export const STUDY_ORDER = [1, 0, 13, 33, 10, 20, 35, 21, 30, 25, 47, 43, 44, 45, 57, 60, 74, 81, 91, 24];   // ids de Magic.cfg (claves de magic.json)
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
  if (!isCaster(p) || !w.magic) return false;
  for (const id of STUDY_ORDER) {
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
  if (t.kind === "player") {                                                    // PvP: paraliza primero (si no lo está ya) y luego remata con el mejor ataque
    const par = PARALYZE.find(h => known(p, h) && w.magic[h] && p.mp >= costOf(w, p, h) && M.castChance(p, h) >= 40);
    if (par !== undefined && !sget(w, t, "hold") && (t.eff?.addPR || 0) < 500) { log(`⚔ Paralizo a ${t.name} con ${w.magic[par].name || "un hechizo"}.`); return cast(adv, w, p, b, par, t.x, t.y); }
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
