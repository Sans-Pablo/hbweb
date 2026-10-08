// Qué sprite y qué fotograma toca dibujar para cada entidad en cada momento.
// Mismas reglas que el cliente original (Client/Game.cpp, DrawObject_On*).
import { ACT, TILE, PLAYER } from "../shared/const.js";

const TIMED = new Set([ACT.MOVE, ACT.RUN, ACT.ATTACK, ACT.GETITEM, ACT.DAMAGE]);

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
export function mobSprite(e, time) {
  const act = actionAt(e, time), p = progress(e, time);
  let group, f;
  switch (act) {
    case ACT.MOVE: group = 1; f = Math.min(3, Math.floor(p * 4)); break;
    case ACT.ATTACK: group = 2; f = Math.min(3, Math.floor(p * 4)); break;
    case ACT.DAMAGE: group = 3; f = Math.min(3, Math.floor(p * 4)); break;
    case ACT.DYING: group = 4; f = Math.min(3, Math.floor(p * 4)); break;
    case ACT.DEAD: group = 4; f = 3; break;
    default: group = 0; f = Math.floor((time + e.phase) / e.dur.stopFrame) % 4;
  }
  return { key: e.cfg.sprite + (group * 8 + e.dir - 1), f };
}
