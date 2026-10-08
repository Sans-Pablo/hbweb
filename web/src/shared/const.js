// Constantes del juego compartidas por la simulación (el futuro servidor) y el cliente.
// Todo lo que viene del código original lleva el archivo de origen.

export const TILE = 32;

// Direcciones 1..8 = N, NE, E, SE, S, SO, O, NO (Client/Game.cpp, HGServer/Map.cpp)
export const DX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
export const DY = [0, -1, -1, 0, 1, 1, 1, 0, -1];

export function dirTo(fx, fy, tx, ty) {
  const ax = Math.sign(tx - fx), ay = Math.sign(ty - fy);
  for (let d = 1; d <= 8; d++) if (DX[d] === ax && DY[d] === ay) return d;
  return 0;
}
export const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Acciones de un objeto (Client/ActionID.h)
export const ACT = {
  STOP: 0, MOVE: 1, RUN: 2, ATTACK: 3, MAGIC: 4, GETITEM: 5, DAMAGE: 6, DYING: 10, DEAD: 101,
};

// Límites del servidor contra trampas: más de 200 ms entre pasos, más de 450 ms entre golpes.
export const LIMITS = { moveMs: 200, attackMs: 450 };

// Duraciones del jugador (Client/MapData.cpp, m_stFrame[1..6]): fotogramas x tiempo por fotograma.
// Andar y correr son algo más lentos que la animación pura porque el cliente espera la
// confirmación del servidor antes de dar el paso siguiente; estos valores son los que se
// sienten como el juego real.
export const PLAYER = {
  walkMs: 370,
  runMs: 230,
  idleFrameMs: 64,            // 32 ms, pero el cliente avanza medio fotograma (cFrame/2)
  attackMs: 8 * 37,           // 8 fotogramas x 41/1.1 ms
  attackHitAt: 0.5,           // el golpe "conecta" a mitad de la animación
  attackCooldownMs: 500,      // por encima del límite de 450 ms del servidor
  getItemMs: 4 * 50,
  damageMs: 8 * 32,
  dyingMs: 13 * 40,
  combatStanceMs: 4000,       // tras luchar, postura de combate durante 4 s (modernizado)
};

// Monstruos (Client/MapData.cpp): tiempo por fotograma de cada acción.
// Andar = 8 fotogramas lógicos; atacar = 4; morir = 8. restar = 20 en el original.
const R = 20;
export const MOB_TIMING = {
  10: { stop: 240, move: 120 - R - R - R / 1.2, attack: 90, damage: 150, dying: 240 },   // Slime
  12: { stop: 210, move: 100 - R - R, attack: 120, damage: 150, dying: 180 },           // Stone-Golem
  16: { stop: 120, move: 60 - R + 15, attack: 120, damage: 150, dying: 180 },           // Giant-Ant
  17: { stop: 120, move: 45 - R + 15, attack: 120, damage: 150, dying: 180 },           // Scorpion
  22: { stop: 250, move: 80 - R, attack: 120, damage: 150, dying: 180 },                // Amphis
};
export function mobDurations(type) {
  const t = MOB_TIMING[type] || MOB_TIMING[10];
  return {
    stopFrame: t.stop,
    move: Math.round(8 * t.move),
    attack: Math.round(4 * t.attack),
    damage: Math.round(4 * t.damage),
    dying: Math.round(8 * t.dying),
  };
}

// Los monstruos que el cliente dibuja semitransparentes
export const TRANSLUCENT_MOBS = new Set([10]);

export const CORPSE_MS = 10000;             // cuánto queda el cadáver antes de desaparecer
export const ITEM_LIFETIME_MS = 180000;     // objetos en el suelo
export const CHASE_LIMIT = 12;              // casillas: más lejos, el monstruo pierde el objetivo
