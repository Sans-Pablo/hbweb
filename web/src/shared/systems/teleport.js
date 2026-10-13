// Teletransportes de pago de William/Gail. Original: Teleport.cfg + HG: RequestTeleportAndLoadingSettings / ChangeSideAndLevelCheck.
// Una ruta vale si el NPC y el mapa de origen coinciden, el nivel está en [min,max], el bando coincide (aresden/elvine; attacker/defender
// son del Heldenian y no se usan aquí), el jugador tiene el oro, y los criminales (pkCount>0) solo pasan por rutas con crim=TRUE.
// El «neutral» (side 0) solo usa rutas con neutral=TRUE.
export const SIDE_NAME = { 1: "aresden", 2: "elvine" };
let ROUTES = [];
export const setRoutes = r => { ROUTES = r; };
export const routes = () => ROUTES;

export function available(p, npc, map) {
  const side = SIDE_NAME[p.side] || "neutral";
  return ROUTES.filter(r => r.npc === npc && r.from === map && p.level >= r.min && p.level <= r.max &&
    (r.side === side || (side === "neutral" && r.neutral)) && ((p.pkCount | 0) === 0 || r.crim));
}
// Devuelve {ok, route, why}. No mueve al jugador ni cobra: lo hace el llamante (Adventure.teleport) para respetar ALLOWED_MAPS.
export function check(p, npc, from, to) {
  const r = available(p, npc, from).find(x => x.to === to.toLowerCase());
  if (!r) return { ok: false, why: "ruta no disponible" };
  if (r.cost > 0 && p.gold < r.cost) return { ok: false, why: "oro insuficiente" };
  return { ok: true, route: r };
}
export function pay(p, r) { if (r.cost > 0) p.gold -= r.cost; }
