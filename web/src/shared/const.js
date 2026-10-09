// Constantes del juego compartidas por la simulación (el futuro servidor) y el cliente.
// Todo lo que viene del código original lleva el archivo de origen.
import { MOB_FRAMES } from "./mobtiming.gen.js";

export const NET_PROTO = 2;           // versión del protocolo cliente-servidor (server/server.mjs): si cambia, los clientes viejos deben recargar
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

// Monstruos (Client/MapData.cpp): tiempo por fotograma y fotogramas lógicos de cada acción, generados en mobtiming.gen.js.
// Valores por omisión del original: andar 8 fotogramas, atacar 4, daño 8, morir 8.
export const MOB_DEFAULT_MAX = { stop: 3, move: 7, attack: 3, damage: 7, dying: 7 };
export function mobFrames(type, act) {
  const t = (MOB_FRAMES[type] || MOB_FRAMES[10])[act] || {};
  return { time: t.time ?? MOB_FRAMES[10][act].time, count: (t.max ?? MOB_DEFAULT_MAX[act]) + 1 };
}
export function mobDurations(type) {
  const f = a => mobFrames(type, a);
  return {
    stopFrame: f("stop").time,
    move: Math.round(f("move").count * f("move").time),
    attack: Math.round(f("attack").count * f("attack").time),
    damage: Math.round(f("damage").count * f("damage").time),
    dying: Math.round(f("dying").count * f("dying").time),
  };
}

// Los monstruos que el cliente dibuja semitransparentes
export const TRANSLUCENT_MOBS = new Set([10]);

export const CORPSE_MS = 10000;             // cuánto queda el cadáver antes de desaparecer
export const CHASE_LIMIT = 12;              // casillas: más lejos, el monstruo pierde el objetivo

