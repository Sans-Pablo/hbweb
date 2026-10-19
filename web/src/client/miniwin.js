// Mini ventanas (formato común). Modelo: la mini del auto hunt (autowin.js); la misión actual (questwin.js) usa el mismo componente.
// Una subclase solo implementa `rows(me, world)` y devuelve la lista de filas; MiniWin las pinta con el mismo estilo y ajusta su altura:
//   {k:"head", text, color}              título de la mini (criatura, misión…)
//   {k:"kv", label, value, color, bold}  etiqueta a la izquierda, valor en la columna fija
//   {k:"text", text, color, size}        párrafo que se parte en líneas
//   {k:"btn", label, fn, color, primary} botón a todo el ancho (p. ej. «Reiniciar»)
// Cerrar (bola derecha) y minimizar (bola izquierda) los pone Win (window.js).
import { Win, THEME } from "./window.js";
import { LAYOUT, drawFrameBall } from "./uistyle.js";
import { t } from "./i18n.js";

export const MINI_W = 230, MINI_ROW = 18, MINI_COL = 90, MINI_MIN_W = 170, MINI_MAX_W = 520;
export class MiniWin extends Win {
  constructor(o) { super({ w: MINI_W, h: 80, ...o }); this.ch = 40; this.clear = false; this.minH = 0; }
  rows() { return []; }
  // modo transparente: sin marco de piedra, solo un velo suave para que el texto se lea sobre el juego
  paintFrame(g, c) {
    if (!this.clear) return super.paintFrame(g, c);
    c.fillStyle = "rgba(10,8,4,.28)"; c.fillRect(0, 0, this.w, this.h); c.strokeStyle = "rgba(224,184,74,.35)"; c.strokeRect(.5, .5, this.w - 1, this.h - 1);
  }
  // ancho y alto mínimos elegidos con el asa de abajo a la derecha; el texto se parte al nuevo ancho y la altura nunca baja de lo que ocupan las filas
  setSize(w, h) {
    this.w = Math.max(MINI_MIN_W, Math.min(MINI_MAX_W, Math.round(w))); this.minH = Math.max(0, Math.round(h));
    this.inner = { ...this.inner, w: this.w - 2 * LAYOUT.padX };
  }
  resize(h) {
    const nh = Math.max(60, this.minH, Math.ceil(h) + LAYOUT.padTop + LAYOUT.padBottom);
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
    this.grips(ui);
  }
  // bola de abajo a la izquierda: transparente / opaca; asa de abajo a la derecha: arrastrar para cambiar el tamaño
  grips(ui) {
    const w = this.w, h = this.h;
    this.ball(ui, 9, h - 9, "o", this.clear ? "Opaca" : "Transparente", () => { this.clear = !this.clear; return true; });
    const over = ui.hov(w - 17, h - 17, 16, 16), c = ui.c;
    drawFrameBall(c, w - 9, h - 9, "o", over);
    c.strokeStyle = over ? "#fff" : "#f0e2bd"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(w - 12, h - 7); c.lineTo(w - 7, h - 12); c.moveTo(w - 12, h - 10); c.lineTo(w - 10, h - 12); c.stroke(); c.lineWidth = 1;
    ui.hit(w - 17, h - 17, 16, 16, { drag: (lx, ly) => { this.setSize(lx + 9, ly + 9); }, tip: "Redimensionar" });
    if (over) this.g.tip(t("Redimensionar"), this.g.mouse.x + 12, this.g.mouse.y + 14);
  }
}
