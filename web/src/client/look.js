// Aspecto del personaje: piel y género (cuerpo), ropa interior y peinado con su color.
// Tipos de cuerpo (Client/Game.cpp): 1 Bm, 2 Wm, 3 Ym (hombres) y 4 Bw, 5 Ww, 6 Yw (mujeres).
// Colores de los tintes (índice = tabla m_wR[] de Client/Game.cpp, aclarados para multiplicar el sprite)
export const DYE_RGB = ["", "#6a6aff", "#c8c8a0", "#ffc83c", "#ff5a2e", "#3caa3c", "#8c8c8c", "#78ccd0", "#ff8cc0", "#c080c0", "#3c8cff", "#e6c296", "#e0d890", "#ffff2a", "#e02a2a", "#505050"];
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

// ---- equipo visible (Client/Game.cpp, DrawObject_On*; Server: bEquipItemHandler -> m_sAppr2..4) ----
// Ropa y armas dibujadas sobre el cuerpo. ap = {armor, arms, pants, boots, mantle, helm, shield, weapon}: cada una es el
// valor "Appr" del objeto equipado (0 = nada). Orden y grupos de animación como el cliente original.
import { apparelOf } from "../shared/appearance.js";
export { apparelOf };                  // el cálculo vive en shared/appearance.js (el servidor lo manda a los demás jugadores)
const WGROUP = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 6, 6: 4, 7: 4, 10: 5 };          // grupo del cuerpo -> grupo de arma y escudo
const WEAPON_FIRST = [0, 1, 0, 0, 0, 0, 0, 1, 1];                      // _cDrawingOrder (índice = dirección 1..8)
const MANTLE_ORDER = [0, 1, 1, 1, 0, 0, 0, 2, 2];                      // _cMantleDrawingOrder

// claves de sprites que hacen falta para el equipo (para precargarlos)
export function equipKeys(gender, ap) {
  const g = gender === 2 ? 1 : 0, keys = [];
  if (!ap) return keys;
  for (const grp of [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11]) {
    for (const [k, l] of [["armor", "a"], ["arms", "b"], ["pants", "l"], ["boots", "o"], ["mantle", "m"], ["helm", "h"]]) if (ap[k]) keys.push(l + g + "_" + ap[k] + "_" + grp);
    const wg = WGROUP[grp];
    if (wg === undefined) continue;
    if (ap.shield) keys.push("s" + g + "_" + ap.shield + "_" + wg);
    if (ap.weapon) for (let d = 0; d < 8; d++) keys.push("w" + g + "_" + ap.weapon + "_" + (wg * 8 + d));
  }
  return keys;
}

// Dibuja al personaje (sin sombra). f = fotograma dentro de la animación.
export function drawPerson(ctx, spr, gender, look, group, d, f, x, y, ap) {
  const g = gender === 2 ? 1 : 0, dir = d + 1;
  if (group === 7 && !spr.has(bodyKey(gender, look, 7, d))) group = 6;       // sin las hojas de arco (tools/convert_players.py), se usa el gesto normal
  const piece = (letter, idx, slot) => {                                       // armadura/capa/casco/botas: un sprite por grupo, 8 direcciones
    if (!idx) return;
    const key = letter + g + "_" + idx + "_" + group;
    if (!spr.has(key)) return;
    const fpd = spr.frames(key) / 8, c = ap && ap.col && ap.col[slot];
    if (c) spr.tintedHair(ctx, key, d * fpd + f, x, y, DYE_RGB[c]); else spr.put(ctx, key, d * fpd + f, x, y);
  };
  const wg = WGROUP[group];
  const weapon = () => { if (ap && ap.weapon && wg !== undefined) { const k = "w" + g + "_" + ap.weapon + "_" + (wg * 8 + d), c = ap.col && ap.col.weapon; if (c) spr.tintedHair(ctx, k, f, x, y, DYE_RGB[c]); else spr.put(ctx, k, f, x, y); } };
  const shield = () => {
    if (!ap || !ap.shield || wg === undefined) return;
    const key = "s" + g + "_" + ap.shield + "_" + wg;
    if (spr.has(key)) spr.put(ctx, key, d * (spr.frames(key) / 8) + f, x, y);
  };
  const skirt = g === 1 && ap && ap.pants === 1;
  if (WEAPON_FIRST[dir] === 1) weapon();
  const body = bodyKey(gender, look, group, d);
  spr.put(ctx, body, f, x, y);
  if (ap && ap.mantle && MANTLE_ORDER[dir] === 0) piece("m", ap.mantle, "mantle");
  const uk = underKey(gender, look, group), hk = hairKey(gender, look, group);
  const fpd = spr.frames(uk) / 8, hpd = spr.frames(hk) / 8;
  spr.put(ctx, uk, d * fpd + f, x, y);
  if (!(ap && ap.helm)) {
    const col = HAIR_COLORS[look.hairCol][1];
    if (col) spr.tintedHair(ctx, hk, d * hpd + f, x, y, col);
    else spr.put(ctx, hk, d * hpd + f, x, y);
  }
  if (ap) {
    if (skirt) piece("o", ap.boots, "boots");
    piece("l", ap.pants, "pants");
    piece("b", ap.arms, "arms");
    if (!skirt) piece("o", ap.boots, "boots");
    piece("a", ap.armor, "armor");
    piece("h", ap.helm, "helm");
    if (ap.mantle && MANTLE_ORDER[dir] === 2) piece("m", ap.mantle, "mantle");
    shield();
    if (ap.mantle && MANTLE_ORDER[dir] === 1) piece("m", ap.mantle, "mantle");
    if (WEAPON_FIRST[dir] !== 1) weapon();
  }
  return body;
}
