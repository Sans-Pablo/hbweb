// Qué sprite y qué fotograma toca dibujar para cada entidad en cada momento.
// Mismas reglas que el cliente original (Client/Game.cpp, DrawObject_On*).
import { ACT, TILE, PLAYER, mobFrames } from "../shared/const.js";

const TIMED = new Set([ACT.MOVE, ACT.RUN, ACT.ATTACK, ACT.MAGIC, ACT.GETITEM, ACT.DAMAGE]);

// Acción efectiva: al acabar un paso o un golpe vuelve a "quieto"
export function actionAt(e, time) {
  if (TIMED.has(e.act) && time >= e.actStart + e.actDur) return ACT.STOP;
  if (e.act === ACT.DYING && time >= e.actStart + e.actDur) return ACT.DEAD;
  return e.act;
}
const progress = (e, time) => (e.actDur > 0 ? Math.min(1, Math.max(0, (time - e.actStart) / e.actDur)) : 1);

// Centro de la entidad en píxeles del mundo, interpolando el paso
export function posOf(e, time) {
  let k = 1;
  if ((e.act === ACT.MOVE || e.act === ACT.RUN) && time < e.actStart + e.actDur) k = progress(e, time);
  return [(e.fx + (e.x - e.fx) * k) * TILE + 16, (e.fy + (e.y - e.fy) * k) * TILE + 16];
}

// Jugador: grupo de Wm/Mpt/Mhr y fotograma
//   0 quieto, 1 quieto en combate, 2 andar, 3 andar en combate, 4 correr, 6 atacar,
//   9 recoger, 10 daño, 11 morir
export function playerSprite(e, time) {
  const act = actionAt(e, time), p = progress(e, time);
  const combat = time - e.lastCombat < PLAYER.combatStanceMs;
  let group, f;
  switch (act) {
    case ACT.MOVE: group = combat ? 3 : 2; f = Math.min(7, Math.floor(p * 8)); break;
    case ACT.RUN: group = 4; f = Math.min(7, Math.floor(p * 8)); break;
    case ACT.ATTACK: group = 6; f = Math.min(7, Math.floor(p * 8)); break;
    case ACT.MAGIC: group = 8; f = Math.min(15, Math.floor(p * 16)); break;
    case ACT.GETITEM: group = 9; f = Math.min(3, Math.floor(p * 4)); break;
    case ACT.DAMAGE: group = 10; f = Math.min(3, Math.floor(p * 4)); break;
    case ACT.DYING: group = 11; f = Math.min(7, Math.floor(p * 8)); break;
    case ACT.DEAD: group = 11; f = 7; break;
    default: {
      group = combat ? 1 : 0;
      const since = time - (e.actStart + e.actDur);
      f = Math.floor(Math.max(0, since) / PLAYER.idleFrameMs) % 8;
    }
  }
  return { group, f, d: e.dir - 1 };
}

// Monstruo: 5 grupos x 8 direcciones (0 quieto, 1 andar, 2 atacar, 3 daño, 4 morir), 4 fotogramas
// Hoja del .pak de cada acción de un monstruo (Client/Game.cpp, DrawObject_On*): 0 reposo, 1 andar, 2 atacar, 3 daño, 4 morir.
// Wyvern y Fire-Wyvern (66, 73) solo tienen tres hojas.
const WYVERN = { stop: 0, move: 1, attack: 0, damage: 0, dying: 2 };
const sheet = (type, act) => (type === 66 || type === 73 ? WYVERN[act] : { stop: 0, move: 1, attack: 2, damage: 3, dying: 4 }[act]);

// Los fotogramas lógicos del original (MapData.cpp) se reparten sobre los de la hoja. Daño y muerte empiezan con los 4 del reposo
// (cFrame < 4 -> hoja 0) y siguen con los de su propia hoja (cFrame - 4).
export function mobSprite(e, time, count = () => 4) {
  if (e.kind === "citizen") return { key: e.cfg.sprite + (e.dir - 1), f: Math.floor((time + e.phase) / e.dur.stopFrame) % 8 };   // NPC de ciudad: 8 fotogramas de reposo
  const act = actionAt(e, time), p = progress(e, time), t = e.type;
  const key = g => e.cfg.sprite + (g * 8 + e.dir - 1);
  const n = g => Math.max(1, count(key(g)) || 4);
  const scaled = (g, a) => ({ key: key(g), f: Math.min(n(g) - 1, Math.floor(p * n(g))) });
  const two = (a, last) => {                                           // 4 fotogramas de la hoja 0 y el resto de su hoja
    const L = mobFrames(t, a).count, i = Math.min(L - 1, Math.floor(p * L)), g = sheet(t, a);
    if (g === 0 || L <= 4) return { key: key(g), f: Math.min(n(g) - 1, Math.floor(i * n(g) / L)) };
    return i < 4 ? { key: key(0), f: Math.min(n(0) - 1, i) } : { key: key(g), f: Math.min(n(g) - 1, i - 4) };
  };
  switch (act) {
    case ACT.MOVE: return scaled(sheet(t, "move"));
    case ACT.ATTACK: return scaled(sheet(t, "attack"));
    case ACT.DAMAGE: return two("damage");
    case ACT.DYING: return two("dying");
    case ACT.DEAD: { const g = sheet(t, "dying"); return { key: key(g), f: n(g) - 1 }; }
    default: { const g = sheet(t, "stop"); return { key: key(g), f: Math.floor((time + e.phase) / e.dur.stopFrame) % n(g) }; }
  }
}
