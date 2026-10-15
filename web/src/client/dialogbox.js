// Constructor de cuadros de conversación («history line con opciones»), sobre el sistema de ventanas (window.js): marco de piedra,
// cara a la izquierda, nombre, texto con efecto de máquina de escribir y botones de opción abajo. Sirve para el tutorial, los NPC y las misiones.
//
//   gui.register(new DialogBox({ id: 46, spec: () => ({
//     title: "Tutorial 3/12",                                  // rótulo de la barra (opcional)
//     face: (g, x, y, size) => {...},                          // pinta la cara (opcional; sin ella el texto ocupa todo el ancho)
//     name: "Gandlf",                                          // nombre del que habla (opcional)
//     text: "Hola…", shown: 12,                                // texto completo y letras visibles (shown ausente = todo)
//     options: [{ label: "Siguiente ▶", fn, primary: true, tip, disabled }],     // botones; con numbered:true van numerados y las teclas 1-9 los eligen (lista de respuestas)
//     hint: "[Espacio / Intro]",                               // línea tenue a la izquierda de los botones (opcional)
//     extra: (ui, x, y, w, box) => h,                               // pintado propio bajo el texto (barra de progreso…); devuelve su alto
//     click: () => {...},                                      // clic en cualquier hueco del cuadro (p. ej. avanzar)
//   }), place: (g, box) => {...} }));                          // place: coloca el cuadro (móvil: ajusta ancho y posición)
//
// Reglas: el cuadro no se cierra solo dentro de draw (lo hace quien lo abre con gui.close); los textos ya vienen traducidos.
import { Win, THEME, wrap } from "./window.js";

const TXT = 13, LH = 17;
export class DialogBox extends Win {
  constructor({ id, spec, place = null, w = 600, face = 80, top = null, nox = true }) {
    super({ id, title: "", w, h: 150, x: Math.round((800 - w) / 2), y: top ?? 392, fixed: true, nox, esc: false });
    Object.assign(this, { spec, placer: place, mobileFixed: true, maxFace: face, face, maxW: w, me: null, world: null });
  }
  layout(g) {                                                          // lo llama gui al reescalar y (en móvil) cada fotograma
    const s = this.spec(this.me, this.world) || {}, hasFace = !!s.face;
    const bw = Math.min(this.maxW, g.W - 12); this.w = bw; const F = hasFace ? (this.face = bw < 520 ? Math.min(64, this.maxFace) : this.maxFace) : 0;
    const tw = this.w - 44 - (hasFace ? F + 14 : 0);
    const lines = s.text ? wrap(g.ctx, s.text, tw, TXT).length : 0, name = s.name ? 20 : 0;
    const ex = s.extra ? s.extra(null, 0, 0, tw, this) : 0;                    // alto que pide el pintado propio (con ui nula solo mide)
    const content = Math.max(F, name + lines * LH + ex), btn = s.options?.length || s.hint ? 28 : 0;
    this.h = 38 + content + btn + 24;
    this.inner = { x: 22, y: 38, w: this.w - 44, h: this.h - 64 };
    this.placer?.(g, this);
  }
  draw(g, me, world) {
    this.me = me; this.world = world;
    const s = this.spec(me, world); if (!s) return;
    this.cur = s; this.title = s.title || ""; this.layout(g);
    super.draw(g, me, world);
  }
  body(ui) {
    const s = this.cur, F = s.face ? this.face : 0, I = this.inner, x0 = I.x + (F ? F + 14 : 0), tw = I.w - (F ? F + 14 : 0);
    if (s.click) ui.hit(0, 0, this.w, this.h, { fn: s.click });          // fondo: un clic en cualquier hueco (las zonas de después tienen prioridad)
    if (F) s.face(ui.g, I.x, I.y, F);
    let y = I.y;
    if (s.name) { ui.text(x0, y, s.name, THEME.head, { bold: true, size: 14, shadow: true }); y += 20; }
    if (s.text) {
      const lines = wrap(ui.c, s.text, tw, TXT); let n = 0, left = s.shown ?? 1e9;
      for (let i = 0; i < lines.length; i++) {
        const part = lines[i].slice(0, Math.max(0, left)); left -= lines[i].length + 1;
        if (part) ui.text(x0, y + i * LH, part, THEME.txt, { size: TXT });
        n++;
      }
      y += n * LH;
    }
    if (s.extra) s.extra(ui, x0, y, tw, this);
    const opts = s.options || [], by = this.h - 22 - 20 - 2;
    if (s.hint) ui.text(I.x, by + 4, s.hint, THEME.dim, { size: 10 });
    let x = I.x + I.w;                                                   // los botones se apilan desde la derecha
    for (let i = opts.length - 1; i >= 0; i--) {
      const o = opts[i], wd = Math.max(o.w || 0, Math.ceil(ui.tw(o.label, 12, !!o.primary)) + 26);
      x -= wd; ui.btn(x, by, wd, (s.numbered ? `${i + 1}. ` : "") + o.label, o.fn, o); x -= 6;
    }
  }
  key(e, g) {
    const o = this.cur?.options;
    if (o && this.cur.numbered && /^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { const op = o[+e.key - 1]; if (op && !op.disabled) { op.fn(); return true; } }
    return super.key(e, g);
  }
}
