// INVENTO del port (v0.85.47): el original llega a nivel 180 y Int 200+; aquí el tope es nivel 50 (3 puntos por nivel: un mago puro llega a Int ~110-115).
// Se reescalan Int mínima y precio de libro al cargar los datos (Magic.cfg y magic.json no se tocan; las ids y nombres son los originales).
//  - Int: hasta 30 igual que el original; por encima, la mitad del exceso (Energy Strike 67→49, Lightning Strike 123→77, Meteor 169→100, Blizzard 195→113).
//  - Oro: el oro ya no cae de los monstruos (solo venta de botín, 50 por nivel y misiones; objeto mediano 600, el 10 % más caro 10000): hasta 2000 igual; por encima, 35 % del exceso
//    (Energy Strike 5000→3100, Lightning Strike 35000→13600, Meteor 40000→15300, Blizzard 43000→16400).
export const scaleReqInt = r => (r <= 30 ? r : Math.round(30 + (r - 30) * 0.5));
export const scaleCost = c => (c <= 2000 ? c : Math.round((2000 + (c - 2000) * 0.35) / 100) * 100);
export function balanceMagic(magic) {
  const out = {};
  for (const [id, m] of Object.entries(magic || {})) out[id] = m && m.cost >= 0 ? { ...m, reqInt: scaleReqInt(m.reqInt | 0), cost: scaleCost(m.cost) } : m;
  return out;
}
