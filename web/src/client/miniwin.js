// Mini ventanas (formato común). Modelo: la mini del auto hunt (autowin.js); la misión actual (questwin.js) usa el mismo componente.
// Una subclase solo implementa `rows(me, world)` y devuelve la lista de filas; MiniWin las pinta con el mismo estilo y ajusta su altura:
//   {k:"head", text, color}              título de la mini (criatura, misión…)
//   {k:"kv", label, value, color, bold}  etiqueta a la izquierda, valor en la columna fija
//   {k:"text", text, color, size}        párrafo que se parte en líneas
//   {k:"btn", label, fn, color, primary} botón a todo el ancho (p. ej. «Reiniciar»)
// Cerrar (bola derecha) y minimizar (bola izquierda) los pone Win (window.js).
import { Win, THEME } from "./window.js";
import { LAYOUT } from "./uistyle.js";
import { t } from "./i18n.js";

export const MINI_W = 230, MINI_ROW = 18, MINI_COL = 90;
export class MiniWin extends Win {
  constructor(o) { super({ w: MINI_W, h: 80, ...o }); this.ch = 40; }
  rows() { return []; }
  resize(h) {
    const nh = Math.max(60, Math.ceil(h) + LAYOUT.padTop + LAYOUT.padBottom);
    if (this.minimized) { if (this.full) this.full.h = nh; return; }
    if (nh !== this.h) { this.h = nh; this.inner = { ...this.inner, h: nh - LAYOUT.padTop - LAYOUT.padBottom }; }
  }
  body(ui, me, world) {
    const I = this.inner; let y = I.y;
    for (const r of this.rows(me, world) || []) {
      if (r.k === "head") { ui.text(I.x, y, r.text, r.color || THEME.head); y += MINI_ROW + 2; }
      else if (r.k === "kv") { ui.text(I.x, y, t(r.label), THEME.txt); ui.text(I.x + MINI_COL, y, r.value, r.color || THEME.txt, { bold: !!r.bold }); y += MINI_ROW; }
      else if (r.k === "text") { y += ui.para(I.x, y, I.w, r.text, r.color || THEME.txt, { size: r.size || 11 }) + 4; }
      else if (r.k === "btn") { ui.btn(I.x, y + 2, I.w, r.label, r.fn, { primary: !!r.primary, color: r.color }); y += 26; }
    }
    this.resize(y - I.y);
  }
}
