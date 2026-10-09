// Compañeros (clase Cazador). INVENTO del port, sin equivalente en el original; se apoya en lo que sí existe:
// el hechizo Summon Creature (npcsys.summonFor) y los objetos GreenBall..PearlBall de Item.cfg (651..655) como "bola" contenedora.
//  - Cada N muertes de una especie invocable, el jugador recibe una Bola de esa especie (nivel 1). Usarla la elige como compañero
//    (siempre esa especie) y lo invoca; volver a usarla lo guarda. La bola guarda especie, nivel y experiencia (inst.comp).
//  - Estadísticas COMPARTIDAS: el daño y la vida del compañero salen del daño medio y la vida del dueño, multiplicados por una
//    cuota que crece con el nivel del compañero; así sumar su daño al del jugador nunca desequilibra (cuota máxima 0,5).
//  - Experiencia: el compañero recibe el 25 % de lo que gana el dueño y el 50 % de la de sus propias muertes (el dueño no gana por ellas).
import { newInst } from "./itemsys.js";
import { groundPush } from "./ground.js";
import * as Inv from "../inventory.js";
import { MAX_ITEMS } from "../items.js";

export const HUNT = { scale: 1, kills: 10 };  // build de pruebas: 10 muertes por bola (kills = null usa la tabla SPECIES: 500–1000); ?hunt=N las divide aún más
export const MAX_COMP_LEVEL = 60;
// especie -> muertes para una bola, id de Item.cfg de la bola; el orden es el rango (poder de la especie)
export const SPECIES = {
  "Slime": [500, 651], "Giant-Ant": [500, 651], "Amphis": [500, 652], "Orc": [600, 652], "Skeleton": [600, 653], "Clay-Golem": [700, 653],
  "Stone-Golem": [700, 654], "Orc-Mage": [800, 654], "Hellbound": [900, 655], "Cyclops": [1000, 655], "Troll": [1000, 655], "Orge": [1000, 655],
};
const RANKS = Object.keys(SPECIES);
export const rankOf = sp => Math.max(0, RANKS.indexOf(sp));
export const need = lvl => Math.floor(30 * Math.pow(lvl, 1.7));              // experiencia para subir desde `lvl`
export const killsFor = sp => Math.max(1, Math.round((HUNT.kills ?? SPECIES[sp][0]) * HUNT.scale));
export const activeBall = p => p.bag.find(i => i.comp && i.comp.on);

// daño medio de un golpe del jugador (playerStrike sin azar)
export function avgHit(p) {
  const fx = p.eff || {}, str = p.stats.str;
  if (!fx.wtype) return Math.max(1, (Math.floor(str / 12) + 1) / 2);
  const m = fx.sm || [1, 1, 0], base = m[0] * (m[1] + 1) / 2 + m[2];
  return Math.max(1, fx.wtype < 40 ? base * (1 + str / 500) : base + (Math.floor(str / 20) + 1) / 2);
}
// cuota del daño del dueño que aporta el compañero
export const shareOf = (lvl, sp) => Math.min(0.5, (0.15 + 0.01 * lvl) * (0.85 + 0.03 * rankOf(sp)));
export function statsOf(p, c) {
  const share = shareOf(c.lvl, c.sp);
  return { share, dmg: Math.max(1, Math.round(avgHit(p) * share)), hp: Math.max(5, Math.round(p.maxHp * Math.min(0.8, 0.3 + 0.01 * c.lvl))) };
}

// Muerte de un monstruo a manos del jugador: contador de especie (bola) y experiencia del compañero
export function onKill(w, p, n, xp) {
  const act = activeBall(p);
  if (act) addExp(w, p, act, Math.floor(xp * 0.25));
  const sp = n.name;
  if (n.master || !SPECIES[sp]) return;
  p.hunt = p.hunt || {};
  p.hunt[sp] = (p.hunt[sp] || 0) + 1;
  if (p.hunt[sp] < killsFor(sp)) return;
  p.hunt[sp] = 0;
  const ball = newInst(w, SPECIES[sp][1]);
  ball.comp = { sp, lvl: 1, exp: 0, on: false };
  const d = w.data.item(ball.id);
  if (d && p.bag.length < MAX_ITEMS && Inv.canCarry(p, w.data, { ...d, weight: 100 }, 1, ball)) Inv.addToBag(p, w.data, ball);
  else if (d) groundPush(w, p.x, p.y, ball);
  w.emit({ t: "ball", id: p.id, sp, uid: ball.uid });
}

// Muerte del compañero: pierde el 25 % de la experiencia de su nivel y, si no le alcanza, un nivel
export function penalize(w, p, inst) {
  const c = inst.comp, loss = Math.floor(need(c.lvl) * 0.25);
  c.exp -= loss;
  while (c.exp < 0 && c.lvl > 1) { c.lvl--; c.exp += need(c.lvl); }
  c.exp = Math.max(0, c.exp);
  w.emit({ t: "companion-lost", id: p.id, sp: c.sp, lvl: c.lvl, loss });
}

export function addExp(w, p, inst, xp) {
  const c = inst.comp, cap = Math.min(MAX_COMP_LEVEL, p.level);
  if (xp <= 0 || c.lvl >= cap) return;
  c.exp += xp;
  while (c.lvl < cap && c.exp >= need(c.lvl)) {
    c.exp -= need(c.lvl); c.lvl++;
    w.emit({ t: "companion-lvl", id: p.id, sp: c.sp, lvl: c.lvl });
  }
  if (c.lvl >= cap) c.exp = Math.min(c.exp, need(c.lvl) - 1);
}
