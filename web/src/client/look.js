// Aspecto del personaje: piel y género (cuerpo), ropa interior y peinado con su color.
// Tipos de cuerpo (Client/Game.cpp): 1 Bm, 2 Wm, 3 Ym (hombres) y 4 Bw, 5 Ww, 6 Yw (mujeres).
export const DEFAULT_LOOK = { skin: 2, hair: 1, hairCol: 0, under: 0 };

// Color del pelo (m_wR/G/B de Game.cpp, 16 tonos). Valores de pantalla aproximados.
export const HAIR_COLORS = [
  ["Natural", null], ["Azul índigo", "#6a6ae0"], ["Oliva", "#8f8f70"], ["Dorado", "#e0b040"],
  ["Carmesí", "#d84a30"], ["Verde", "#4a9a4a"], ["Gris", "#9a9a9a"], ["Aguamarina", "#6fb4b8"],
  ["Rosa", "#e87ab0"], ["Violeta", "#9a6ab0"], ["Azul", "#3a6ad0"], ["Canela", "#d2b48c"],
  ["Caqui", "#bdb76b"], ["Amarillo", "#e0d040"], ["Rojo", "#c02020"], ["Negro", "#303030"],
];
export const SKIN_NAMES = ["", "Oscura", "Clara", "Amarilla"];
export const UNDER_NAMES = ["Blanco", "Rojo", "Azul", "Verde", "Gris", "Marrón", "Negro", "Morado"];

export const bodyKey = (gender, look, group, d) => "pb" + ((gender === 2 ? 3 : 0) + look.skin) + "_" + (group * 8 + d);
const underKey = (gender, look, group) => "pu" + (gender === 2 ? 1 : 0) + "_" + look.under + "_" + group;
const hairKey = (gender, look, group) => "ph" + (gender === 2 ? 1 : 0) + "_" + look.hair + "_" + group;

// Dibuja al personaje (sin sombra). f = fotograma dentro de la animación.
export function drawPerson(ctx, spr, gender, look, group, d, f, x, y) {
  const body = bodyKey(gender, look, group, d);
  spr.put(ctx, body, f, x, y);
  const uk = underKey(gender, look, group), hk = hairKey(gender, look, group);
  const fpd = spr.frames(uk) / 8, hpd = spr.frames(hk) / 8;
  spr.put(ctx, uk, d * fpd + f, x, y);
  const col = HAIR_COLORS[look.hairCol][1];
  if (col) spr.tintedHair(ctx, hk, d * hpd + f, x, y, col);
  else spr.put(ctx, hk, d * hpd + f, x, y);
  return body;
}
