// Habitantes de las ciudades (tendero, herrero, almacenero, mago...): NPC pacíficos que no se mueven ni se pueden atacar.
// Ocupan su casilla y los clics del jugador los abren como menú (Client/Game.cpp, CommandProcessor).

// Tiempo por fotograma de reposo (8 fotogramas), Client/MapData.cpp: m_stFrame[tipo][DEF_OBJECTSTOP]
const STOP_MS = { 15: 180, 19: 250, 20: 250, 24: 150 };

// NPC de la tienda general que el servidor original pone en otros mapas (el mago está en la torre): aquí, junto al tendero.
export const EXTRA_CITIZENS = { gshop_1f: [{ name: "Gandlf", x: 61, y: 42 }] };

export function spawnCitizen(w, name, x, y) {
  const cfg = w.npcDb[name];
  if (!cfg || !cfg.town) return null;
  const spot = w.grid.free(x, y) ? [x, y] : w.freeSpotNear(x, y, 3);
  if (!spot) return null;
  const n = w.makeEnt("citizen", spot[0], spot[1]);
  Object.assign(n, { name, type: cfg.type, cfg, dir: 5, hp: 1, maxHp: 1, phase: Math.floor(w.rng() * 1000), special: 0, dur: { stopFrame: STOP_MS[cfg.type] || 200 } });
  return n;
}

// Pone los habitantes que indica el mapa (línea npc = ... con su primer waypoint) y los extra
export function populate(w, meta, id) {
  for (const npc of meta.npcs || []) {
    const wp = meta.waypoints?.[String(npc.wp[0])];
    if (wp) spawnCitizen(w, npc.name, wp[0], wp[1]);
  }
  for (const c of EXTRA_CITIZENS[id] || []) spawnCitizen(w, c.name, c.x, c.y);
}
