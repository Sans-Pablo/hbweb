// Peligros del suelo que un jugador esquiva: campos de fuego/hielo/veneno de los hechizos (fields.js) y las zonas de los jefes de la cripta (bosses.js: brasas,
// avisos, suelo helado). Los bots lo usan para no quedarse parados en el fuego (INVENTO del port: en el original no hay jefes; los campos sí, ver fields.js).
import { dist } from "../const.js";
import { DYN } from "./fields.js";

const R_FIELD = { [DYN.FIRE]: 1, [DYN.FIRE3]: 1, [DYN.PCLOUD]: 1, [DYN.ICESTORM]: 2 };
export function hazardAt(w, x, y, soon = 0) {
  if (w.dyn) for (const f of w.dyn) { const r = R_FIELD[f.type]; if (r !== undefined && w.time < f.until && Math.max(Math.abs(f.x - x), Math.abs(f.y - y)) <= r) return true; }
  if (w.bfx) for (const z of w.bfx) {
    if (z.until + soon <= w.time) continue;
    if (z.kind === "ember") { if (z.x === x && z.y === y) return true; }
    else if (z.kind === "warn" || z.kind === "frost") { if (Math.max(Math.abs(z.x - x), Math.abs(z.y - y)) <= (z.r || 0)) return true; }
  }
  return false;
}
// casilla libre y sin peligro más cercana (anillos crecientes); null si no hay en 6
export function safeSpot(w, p) {
  for (let r = 1; r <= 6; r++) {
    let best = null, bd = 1e9;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      const x = p.x + i, y = p.y + j;
      if (!w.grid.inside(x, y) || w.grid.blocked(x, y) || w.teleports.has(w.grid.idx(x, y)) || hazardAt(w, x, y, 400)) continue;
      const o = w.grid.occupant(x, y); if (o !== undefined && o !== p.id) continue;
      const d = dist(p, { x, y }); if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) return best;
  }
  return null;
}
