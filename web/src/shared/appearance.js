// Equipo visible de un personaje (Client/Game.cpp, DrawObject_On*; Server: bEquipItemHandler -> m_sAppr2..4).
// ap = {armor, arms, pants, boots, mantle, helm, shield, weapon, col?}: cada una es el valor "Appr" del objeto equipado (0 = nada).
// Compartido: el cliente lo calcula con su mochila; el servidor lo manda al resto de jugadores (no ven nuestra mochila).
export const ARMOR_OF_POS = { 1: "helm", 2: "armor", 3: "arms", 4: "pants", 5: "boots", 7: "shield", 8: "weapon", 9: "weapon", 12: "mantle", 13: "armor" };
export function apparelOf(e, itemDef) {
  if (!e.equip || !e.bag) return e.ap || null;
  const ap = {};
  for (const [pos, uid] of Object.entries(e.equip)) {
    const it = e.bag.find(b => b.uid === uid), d = it && itemDef(it.id), k = ARMOR_OF_POS[pos];
    if (!d || !k || !d.appr) continue;
    ap[k] = k === "armor" && d.appr >= 100 ? d.appr - 100 : d.appr;
    if (it.color) (ap.col || (ap.col = {}))[k] = it.color;
  }
  const gd = e.guild || (e.gd && { name: e.gd[0], cape: e.gd[2], boots: e.gd[3] });          // colores del guild (INVENTO): capa y botas puestas se ven del color elegido
  if (gd) { if (gd.cape > 0 && ap.mantle) (ap.col || (ap.col = {})).mantle = gd.cape; if (gd.boots > 0 && ap.boots) (ap.col || (ap.col = {})).boots = gd.boots; }
  return ap;
}
