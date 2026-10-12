// Pesca. Original: la caña (FishingRod 105, tipo USE_SKILL, categoría 43) se usa mirando al agua y sube la habilidad FISHING (HGServer/Game.cpp,
// pez como objeto dinámico + __bGetFishing...). INVENTO del port (no tenemos ese código): un lance a la casilla de agua de enfrente (hasta 3 casillas),
// con probabilidad según la maestría y un pez de la tabla por tramos de maestría. Cada lance tarda 4 s (cooldown) y sube la habilidad.
// Los peces tienen precio de venta propio (las carpas del Item.cfg traen precio negativo = no se compran, y valdrían 1) y alimentan compañeros carnívoros.
import { DX, DY } from "../const.js";
import { dice } from "../rules.js";
import * as Inv from "../inventory.js";
import { gainSSN, SKILL } from "../skills.js";
import { groundPush } from "./ground.js";
import { newInst } from "./itemsys.js";
import { giveExp } from "./combatsys.js";

export const ROD = 105, COOLDOWN = 4000, WATER = [19, 20];
// id -> [maestría mínima, peso en la tabla, precio de venta]
export const CATCH = { 100: [0, 40, 15], 573: [0, 20, 10], 103: [20, 14, 25], 575: [30, 10, 60], 102: [30, 10, 35], 570: [40, 7, 90], 101: [40, 7, 45], 571: [50, 5, 110], 572: [70, 2, 220] };
export const FISH_PRICE = Object.fromEntries(Object.entries(CATCH).map(([id, v]) => [+id, v[2]]));
export const isFish = id => id in CATCH;

export const isWater = (w, x, y) => { const t = w.grid.tile(x, y); return !!t && WATER.includes(t.spr); };
// Primera casilla de agua en la dirección que se mira (1..3 casillas); null si no hay
export function waterAhead(w, p) {
  for (let k = 1; k <= 3; k++) { const x = p.x + DX[p.dir] * k, y = p.y + DY[p.dir] * k; if (isWater(w, x, y)) return [x, y]; if (w.grid.blocked(x, y) && !isWater(w, x, y)) return null; }
  return null;
}
// Mira a la casilla de agua adyacente (8 direcciones) si hay; devuelve true si ya puede lanzar
export function faceWater(w, p) {
  if (waterAhead(w, p)) return true;
  for (let d = 1; d <= 8; d++) { const x = p.x + DX[d], y = p.y + DY[d]; if (isWater(w, x, y)) { p.dir = d; return true; } }
  return false;
}
export function nearWater(w, p, r = 1) { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (isWater(w, p.x + dx, p.y + dy)) return true; return false; }

// Usar la caña. Devuelve true si lanzó (pique o no), false si se rechazó.
export function cast(w, p) {
  if (p.dead) return false;
  if (w.time < (p.fishAt || 0)) return w.reject(p, { t: "use" }, "espera un momento antes de volver a lanzar");
  if (!waterAhead(w, p)) return w.reject(p, { t: "use" }, "no hay agua delante");
  p.fishAt = w.time + COOLDOWN;
  const lv = p.skills[SKILL.FISHING] || 0, chance = Math.min(90, 35 + lv * 0.5);
  gainSSN(p, SKILL.FISHING, 1);
  if (dice(w.rng, 1, 100) > chance) { w.emit({ t: "fish", id: p.id, item: 0 }); return true; }
  const pool = Object.entries(CATCH).filter(([, v]) => lv >= v[0]);
  let tot = 0; for (const [, v] of pool) tot += v[1];
  let r = w.rng() * tot, pick = 100;
  for (const [id, v] of pool) { r -= v[1]; if (r <= 0) { pick = +id; break; } }
  const inst = newInst(w, pick, 1);
  if (!Inv.addToBag(p, w.data, inst)) groundPush(w, p.x, p.y, inst, true);
  giveExp(w, p, dice(w.rng, 1, 4));
  w.emit({ t: "fish", id: p.id, item: pick });
  return true;
}
