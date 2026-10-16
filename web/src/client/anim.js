// Qué sprite y qué fotograma toca dibujar para cada entidad en cada momento.
// Mismas reglas que el cliente original (Client/Game.cpp, DrawObject_On*).
import { ACT, TILE, PLAYER, mobFrames } from "../shared/const.js";

const TIMED = new Set([ACT.MOVE, ACT.RUN, ACT.ATTACKMOVE, ACT.ATTACK, ACT.MAGIC, ACT.GETITEM, ACT.DAMAGE]);

// Acción efectiva: al acabar un paso o un golpe vuelve a "quieto"
export function actionAt(e, time) {
  if (TIMED.has(e.act) && time >= e.actStart + e.actDur) return ACT.STOP;
  if (e.act === ACT.DYING && time >= e.actStart + e.actDur) return ACT.DEAD;
  return e.act;
}
const progress = (e, time) => (e.actDur > 0 ? Math.min(1, Math.max(0, (time - e.actStart) / e.actDur)) : 1);

// OBJECTATTACKMOVE (Game.cpp DrawObject_OnAttackMove ~8419+, MapData.cpp:33-34): 13 fotogramas (0..12) de 78 ms. La posición es la casilla NUEVA y el cuerpo
// se dibuja detrás de ella: 32 px (fotograma 0, la casilla de origen), 26, 16 y 0 desde el fotograma 3; el fantasma (bDashDraw) 26 px en el 2 y 16 px en el 3.
// dy extra de +1/+2/+1 px en los fotogramas 1/2/3. Dirección 1-8 -> vector hacia atrás (dir1 dy+, dir2 dy+/dx-, dir3 dx-, dir4 dx-/dy-, ...).
export const DASH_BACK = [0, [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1]];
const DASH_PX = [32, 26, 16], DASH_DY = [0, 1, 2, 1], DASH_GHOST = [0, 0, 26 - 16, 16 - 0];
export const dashFrame = (e, time) => (e.act === ACT.ATTACKMOVE && time < e.actStart + e.actDur ? Math.min(12, Math.floor(progress(e, time) * 13)) : -1);
export const dashGhost = (e, time) => { const f = dashFrame(e, time); return f >= 0 && f < 4 ? DASH_GHOST[f] : 0; };
// Centro de la entidad en píxeles del mundo, interpolando el paso
export function posOf(e, time) {
  const df = dashFrame(e, time);
  if (df >= 0) { const v = DASH_BACK[e.dir] || [0, 0], b = DASH_PX[df] || 0; return [e.x * TILE + 16 - v[0] * b, e.y * TILE + 16 - v[1] * b + (DASH_DY[df] || 0)]; }
  let k = 1;
  if ((e.act === ACT.MOVE || e.act === ACT.RUN || (e.act === ACT.DAMAGE && e.knockAt === e.actStart)) && time < e.actStart + e.actDur) k = progress(e, time);
  return [(e.fx + (e.x - e.fx) * k) * TILE + 16, (e.fy + (e.y - e.fy) * k) * TILE + 16];
}

// Jugador: grupo de Wm/Mpt/Mhr y fotograma
//   0 quieto, 1 quieto en combate, 2 andar, 3 andar en combate, 4 correr, 6 atacar, 7 atacar con arco,
//   9 recoger, 10 daño, 11 morir
export function playerSprite(e, time, bow = false) {
  const act = actionAt(e, time), p = progress(e, time);
  const combat = !!e.combatMode || time - e.lastCombat < PLAYER.combatStanceMs;
  let group, f;
  switch (act) {
    case ACT.MOVE: group = combat ? 3 : 2; f = Math.min(7, Math.floor(p * 8)); break;
    case ACT.RUN: group = 4; f = Math.min(7, Math.floor(p * 8)); break;
    case ACT.ATTACKMOVE: { group = bow ? 7 : 6; const f13 = Math.min(12, Math.floor(p * 13)); f = f13 < 4 ? f13 : f13 < 10 ? 4 : f13 - 5; break; }   // cFrame 4..9 -> 4, 10 -> 5, 11 -> 6, 12 -> 7 (DrawObject_OnAttackMove)
    case ACT.ATTACK: group = bow ? 7 : 6; f = Math.min(7, Math.floor(p * 8)); break;
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
  const sp = e.cfg.sprite;       // y sin clase aún, el summon de apoyo ya se ve como hechicera (nunca como el muñeco)                                       // el Dummy usa un sprite original por clase
  const key = g => sp + (g * 8 + e.dir - 1);
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
