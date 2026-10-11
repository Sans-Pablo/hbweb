// REINICIO DE ESTADÍSTICAS (INVENTO del port: el original no deja repartir de nuevo los puntos). El mago de las tiendas (Gandlf, tipo 19) devuelve
// todos los puntos gastados al fondo de puntos libres a cambio de oro, para probar otro reparto (build) o un arma nueva. Lo usan jugadores y habitantes.
export const RESPEC = { base: 10, reach: 8, mageType: 19 };
export const respecCost = p => 300 + 60 * p.level;
export const mageNear = (w, p) => { for (const e of w.ents.values()) if (e.kind === "citizen" && e.type === RESPEC.mageType && Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= RESPEC.reach) return e; return null; };

export function respec(w, p, cmd) {
  if (p.dead) return false;
  if (!mageNear(w, p)) return w.reject(p, cmd, "acércate al mago");
  const cost = respecCost(p);
  if (p.gold < cost) { w.emit({ t: "nogold", id: p.id }); return false; }
  let back = 0;
  for (const k of Object.keys(p.stats)) { const give = Math.max(0, p.stats[k] - RESPEC.base); back += give; p.stats[k] -= give; }
  if (back <= 0) return w.reject(p, cmd, "no hay puntos que recuperar");
  p.gold -= cost; p.pool += back;
  p.respecs = (p.respecs | 0) + 1;
  w.recalc(p);
  w.emit({ t: "statreset", id: p.id, cost, points: back });
  return true;
}
