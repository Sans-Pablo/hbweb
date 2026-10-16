// COMIDA DE SUMMONS PARA LOS BOTS (INVENTO del port). Un bot con summon le compra y le da su comida preferida (companion.js#TASTE.love) para mejorarlo:
// primero al principal (el primero de sus bolas activas), luego a los demás. Solo cuenta la comida de estadística (el pescado),
// que sube puntos permanentes hasta FEED_CAP; la que solo cura no se da (no mejora al summon). Ticket 14: la comida de estadística es el PESCADO. Precio fijo por pieza.
import * as Comp from "./companion.js";
import * as Inv from "../inventory.js";
import { gold as ledger } from "./ledger.js";

export const FOOD_PRICE = 60, RESERVE = 250, PER_ERRAND = 4;

// Comida de estadística preferida de una bola que aún le puede subir algo: { id, stat } o null
export function wanted(inst) {
  const c = inst.comp;
  for (const id of Object.keys(Comp.FISH_FEED).map(Number)) {
    const st = Comp.FISH_FEED[id];
    if (Comp.tasteOf(c.sp, id) !== "hate" && (c.fb?.[st] || 0) < Comp.FEED_CAP) return { id, stat: st };
  }
  return null;
}

// Compra (o gasta de la mochila) y da comida a las bolas activas, la principal primero. Devuelve cuántas piezas dio.
// market=false (habitantes, 0.78.0): no compra «de la nada»; solo gasta la comida que ya lleva (la compró en un puesto de granjero/pescador)
export function feedSummons(w, p, log, market = true) {
  if (p.dead) return 0;
  let given = 0;
  for (const inst of Comp.activeBalls(p)) {
    let n = 0, want;
    while (given < PER_ERRAND && (want = wanted(inst))) {
      const d = w.data.item(want.id); if (!d) break;
      const own = p.bag.find(i => i.id === want.id);
      if (!own && (!market || p.gold < FOOD_PRICE + RESERVE)) break;
      if (Comp.feed(w, p, d, inst.uid) !== true) break;                                  // lo rechazó o no puede más: no se gasta nada
      if (own) { if ((own.count || 1) > 1) own.count--; else Inv.removeFromBag(p, own.uid); } else ledger(w, p, -FOOD_PRICE, "summon_food");
      n++; given++;
    }
    if (n) log?.(`Le di comida preferida (${n} piezas) a mi summon ${inst.comp.nm || inst.comp.sp}: así mejora.`);
  }
  return given;
}
