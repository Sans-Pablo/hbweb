// Objetos dinámicos de los hechizos de campo (CheckDynamicObjectList / DynamicObjectEffectProcessor):
// muro y campo de fuego, nube venenosa, tormenta de hielo y campo de pinchos. Se procesan una vez por segundo.
import * as Boss from "./bosses.js";
import { dice } from "../rules.js";
import { sget, sset, sclear } from "./status.js";
import { damagePlayer } from "./combatsys.js";

export const DYN = { FIRE: 1, ICESTORM: 8, SPIKE: 9, PCLOUD: 10, FIRE3: 14 };

export function addField(w, type, x, y, ms, v1 = 0, owner = 0) {
  if (!w.grid.inside(x, y)) return false;
  if (!w.dyn) w.dyn = [];
  if (w.dyn.some(f => f.x === x && f.y === y)) return false;          // una casilla, un objeto (bSetDynamicObject)
  const f = { id: w.nextId++, type, x, y, until: w.time + ms, v1, owner, born: w.time };
  w.dyn.push(f);
  w.emit({ t: "field", id: f.id, type, x, y, ms, v1 });
  return true;
}

function at(w, x, y) {
  const oid = w.grid.occupant(x, y);
  return oid === undefined ? null : w.ents.get(oid) || null;
}

// resistencia al hielo (bCheckResistingIceSuccess): solo cuenta la de los monstruos aquí
function iceResisted(w, e) {
  if (e.kind === "player") return dice(w.rng, 1, 100) <= (e.eff.addAbsWater || 0) * 2;
  const r = Math.max(1, e.cfg.resistMagic - Math.floor(e.cfg.resistMagic / 3));
  return dice(w.rng, 1, 100) <= r;
}
export { iceResisted };

// daño directo de un campo (sin atacante): al morir un monstruo no da experiencia a nadie
function hit(w, e, dmg, f) {
  if (e.dead) return;
  if (e.kind === "player") {
    if (e.st && sget(w, e, "hold")) sclear(w, e, "hold");
    damagePlayer(w, e, dmg, { id: f.owner || 0 }, f.type === DYN.FIRE || f.type === DYN.FIRE3 ? "fire" : f.type === DYN.ICESTORM ? "ice" : f.type === DYN.PCLOUD ? "poison" : undefined);
    return;
  }
  if (e.boss === 1 && f.type === DYN.FIRE) return;                    // el rey carmesí es inmune a sus llamas
  if (e.cfg.actionLimit === 1 || e.cfg.actionLimit === 2 || e.cfg.actionLimit === 4) return;
  dmg = Boss.mitigate(w, e, dmg, null, "field"); if (dmg <= 0) return;
  e.hp -= dmg;
  w.emit({ t: "damage", id: e.id, from: f.owner || 0, amount: dmg, hp: Math.max(0, e.hp), max: e.maxHp });
  if (e.hp <= 0) return w.killNpc(e, null);
  if (dice(w.rng, 1, 3) === 2) e.nextAct = w.time;
  if (sget(w, e, "hold")) sclear(w, e, "hold");
}

export function tickFields(w) {
  if (!w.dyn || !w.dyn.length) return;
  for (const f of [...w.dyn]) {
    if (w.time >= f.until) {
      w.dyn.splice(w.dyn.indexOf(f), 1);
      w.emit({ t: "fieldend", id: f.id });
      continue;
    }
    const R = f.type === DYN.ICESTORM ? 2 : (f.type === DYN.FIRE || f.type === DYN.FIRE3 || f.type === DYN.PCLOUD) ? 1 : -1;
    if (R < 0) continue;                                      // los pinchos solo se dibujan
    for (let iy = f.y - R; iy <= f.y + R; iy++) for (let ix = f.x - R; ix <= f.x + R; ix++) {
      const e = at(w, ix, iy);
      if (!e || e.dead) continue;
      if (f.type === DYN.ICESTORM) {
        hit(w, e, dice(w.rng, 3, 3) + 5, f);
        if (!e.dead && !sget(w, e, "ice") && !iceResisted(w, e)) sset(w, e, "ice", 1, 20000);
      } else if (f.type === DYN.PCLOUD) {
        hit(w, e, f.v1 < 20 ? dice(w.rng, 1, 6) : dice(w.rng, 1, 8), f);
        if (e.kind === "player" && !e.dead && !sget(w, e, "poison") && dice(w.rng, 1, 100) > 50) poison(w, e, f.v1);
      } else hit(w, e, dice(w.rng, 1, 6), f);
    }
  }
}

// Envenenar a un jugador: pierde 1d(nivel) de vida cada 12 s hasta que lo cure su resistencia (PoisonEffect)
export function poison(w, p, level) {
  if (sget(w, p, "poison")) return;
  sset(w, p, "poison", level, Infinity);
  p.tPoison = w.time;
}

export function tickPoison(w, p) {
  const lvl = sget(w, p, "poison");
  if (!lvl || w.time - p.tPoison < 12000) return;
  p.tPoison = w.time;
  const dmg = dice(w.rng, 1, lvl);
  p.hp = Math.max(1, p.hp - dmg);
  w.emit({ t: "damage", id: p.id, from: 0, amount: dmg, hp: p.hp, max: p.maxHp, poison: true });
  let prob = (p.skills[23] || 0) - 10 + (p.eff.addPR || 0);
  if (prob <= 10) prob = 10;
  if (dice(w.rng, 1, 100) <= prob) sclear(w, p, "poison");
}
