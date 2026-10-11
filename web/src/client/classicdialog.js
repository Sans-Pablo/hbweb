// Cuadro de diálogo con el formato clásico de Helbreath (marco de madera "gamedialog_1" fotograma 2, texto en tinta oscura,
// botón «Ok» abajo a la derecha). Todos los cuadros nuevos del port deben heredar de esta clase para verse igual.
//
//   class Mio extends ClassicDialog {
//     constructor() { super({ id: 50, title: "Mi cuadro", tabs: ["Uno", "Dos"] }); }
//     rows(me) { return [{ text: "Fila", right: "10", color: null, tip: "ayuda", data: ... }]; }   // lista que se pinta con rueda y resalte
//     pick(row, me, g) { ... }                                                                       // clic en una fila
//     drawBody(g, me, lx, ly) { ... }                                                                // pintado extra opcional (cabecera)
//
// REGLAS DE MAQUETACIÓN (todas las comprueba tools/lint_dialogs.py; un cuadro nuevo debe salir limpio):
//   1. Zona útil: x entre 12 y w-12; y entre 60 (bajo las pestañas) y 288. Por debajo de 288 solo está el botón Ok (x w-104..w-30, y 292..312).
//   2. Nada se pinta sobre el Ok. Un texto fijo («footer») va en la zona de ayuda (y 262..286, dos líneas), nunca en y>288: usa `footer`/hintText.
//   3. Texto de longitud variable (nombres, textos traducidos): envuélvelo con this.wrap(g, texto, ancho) o recórtalo; el inglés suele ser más largo que el español.
//   4. Dos textos en la misma línea no se pisan: la columna derecha (`right`) reserva ~44 px; calcula x con medida, no a ojo.
//   5. Los botones propios van encima de y 288 y con hover/clic en la MISMA caja; no sobrescribas hoverOk() sin dibujar tu propio Ok que cierre (g.close(this.id)).
//   6. Todo texto nuevo en español lleva su entrada en i18n.js (la comprobación visual se hace en inglés).
//   7. Filas: top + visible*rowH <= 256 (el constructor lo calcula si no pasas `visible`).
//   }
//   gui.register(new Mio());   y   gui.open(50)
export const INK = "#2d1919", DARK = "#040032", WHITE = "#fff", RED = "#c31919";
const inside = (lx, ly, x1, x2, y1, y2) => lx > x1 && lx < x2 && ly > y1 && ly < y2;

export class ClassicDialog {
  constructor({ id, x = 150, y = 110, w = 258, h = 339, title = "", tabs = [], rowH = 17, top = 80, visible = null, footer = "" }) {
    visible = visible ?? Math.max(1, Math.floor((256 - top) / rowH));                     // las filas acaban donde empieza la zona de ayuda (y 260)
    Object.assign(this, { id, x, y, w, h, title, tabs, rowH, top, visible, footer, tab: 0, view: 0, mx: 14 });      // mx = margen izquierdo del texto
  }
  // --- para sobrescribir
  rows() { return []; }
  pick() {}
  drawBody() {}
  onTab() {}
  // --- pintado
  tabX(i) { return 30 + i * Math.floor((this.w - 50) / Math.max(1, this.tabs.length)); }
  draw(g, me) {
    if (g.lintOn) g.lint = [];
    this.draw_(g, me);
    if (g.lintOn) { this.lintReport(g.lint); g.lint = null; }
  }
  // Comprobación automática de maquetación (tools/lint_dialogs.py): textos fuera del marco, sobre el botón Ok o encima de otros textos
  lintReport(rs) {
    const bad = (window.hbLint ||= {})[this.id] ||= new Set(), ok = { x: this.w - 104, y: 292, w: 74, h: 20 };
    const hit = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 2 && b.y < a.y + a.h - 2;
    rs.forEach((r, i) => {
      if (r.x < 12 || r.x + r.w > this.w - 12) bad.add("fuera del marco: " + r.s);
      if (r.y + r.h > 290 && hit(r, ok) || r.y + r.h > 292 && r.y < 312 && r.x + r.w > ok.x - 2 && r.x < ok.x + ok.w) bad.add("sobre el botón Ok: " + r.s);
      for (let j = i + 1; j < rs.length; j++) if (hit(r, rs[j])) bad.add("se superpone: «" + r.s + "» con «" + rs[j].s + "»");
    });
  }
  draw_(g, me) {
    const lx = g.mouse.x - this.x, ly = g.mouse.y - this.y, rows = this.rows(me) || [];
    g.put("gamedialog_1", 2, 0, 0);
    g.put("dialogtext_1", this.hoverOk(lx, ly) ? 1 : 0, this.w - 104, 292);
    if (this.title) g.aligned(0, this.w, 22, this.title, INK, { bold: true });
    this.tabs.forEach((name, i) => {
      const x = this.tabX(i), over = inside(lx, ly, x - 5, x + 85, 38, 58);
      g.text(x, 42, name, this.tab === i ? RED : over ? WHITE : DARK, { bold: true });
    });
    this.drawBody(g, me, lx, ly);
    this.view = Math.max(0, Math.min(this.view, Math.max(0, rows.length - this.visible)));
    let hint = this.hintText || "";
    for (let i = 0; i < this.visible; i++) {
      const r = rows[i + this.view]; if (!r) break;
      const y = this.top + i * this.rowH, over = inside(lx, ly, this.mx - 4, this.w - 12, y - 1, y + this.rowH - 2);
      const col = over ? WHITE : r.color || DARK;
      g.text(this.mx, y, r.text, col, { size: 11 });
      if (r.right != null) g.text(this.w - 44, y, String(r.right), col, { size: 11 });
      if (over && r.tip) hint = r.tip;
    }
    if (rows.length > this.visible) g.text(this.w - 22, this.top - 14, this.view > 0 ? "▲" : " ", INK, { size: 9 }), g.text(this.w - 22, this.top + this.visible * this.rowH, this.view + this.visible < rows.length ? "▼" : " ", INK, { size: 9 });
    this.hintText = "";
    if (this.hintOver) hint = this.hintOver(lx, ly, me) || hint;
    if (hint) this.paintHint(g, hint);
    else if (this.footer) this.paintHint(g, this.footer);
  }
  // Texto de ayuda en una zona fija del cuadro (no flota junto al ratón: no tapa filas ni estorba al hacer clic)
  wrap(g, text, maxW, size = 10) {
    const c = g.ctx; c.font = size + "px Tahoma, Verdana, sans-serif";
    const out = []; let line = "";
    for (const word of String(text).split(" ")) {
      const t = line ? line + " " + word : word;
      if (c.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }
  paintHint(g, text) {
    const lines = this.wrap(g, text, this.w - this.mx - 22).slice(0, 2);
    lines.forEach((l, i) => g.text(this.mx, 262 + i * 12, l, INK, { size: 10 }));
  }
  hoverOk(lx, ly) { return lx >= this.w - 104 && lx <= this.w - 30 && ly >= 292 && ly <= 312; }
  click(g, lx, ly, me) {
    if (this.hoverOk(lx, ly)) { g.close(this.id); return true; }
    for (let i = 0; i < this.tabs.length; i++) { const x = this.tabX(i); if (inside(lx, ly, x - 5, x + 85, 38, 58)) { this.tab = i; this.view = 0; this.onTab(i, me); return true; } }
    const rows = this.rows(me) || [], i = Math.floor((ly - this.top) / this.rowH);
    if (ly >= this.top && i >= 0 && i < this.visible && lx > this.mx - 4 && lx < this.w - 12) { const r = rows[i + this.view]; if (r && !r.disabled) { this.pick(r, me, g); return true; } }
    return this.fixed === true;       // clic en un hueco: se agarra el cuadro para moverlo (gui.down)
  }
  wheel(g, d) { this.view -= d; }
}
