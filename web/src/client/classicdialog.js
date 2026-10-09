// Cuadro de diálogo con el formato clásico de Helbreath (marco de madera "gamedialog_1" fotograma 2, texto en tinta oscura,
// botón «Ok» abajo a la derecha). Todos los cuadros nuevos del port deben heredar de esta clase para verse igual.
//
//   class Mio extends ClassicDialog {
//     constructor() { super({ id: 50, title: "Mi cuadro", tabs: ["Uno", "Dos"] }); }
//     rows(me) { return [{ text: "Fila", right: "10", color: null, tip: "ayuda", data: ... }]; }   // lista que se pinta con rueda y resalte
//     pick(row, me, g) { ... }                                                                       // clic en una fila
//     drawBody(g, me, lx, ly) { ... }                                                                // pintado extra opcional (cabecera)
//   }
//   gui.register(new Mio());   y   gui.open(50)
export const INK = "#2d1919", DARK = "#040032", WHITE = "#fff", RED = "#c31919";
const inside = (lx, ly, x1, x2, y1, y2) => lx > x1 && lx < x2 && ly > y1 && ly < y2;

export class ClassicDialog {
  constructor({ id, x = 150, y = 110, w = 258, h = 339, title = "", tabs = [], rowH = 17, top = 80, visible = null, footer = "" }) {
    visible = visible ?? Math.max(1, Math.floor((256 - top) / rowH));                     // las filas acaban donde empieza la zona de ayuda (y 260)
    Object.assign(this, { id, x, y, w, h, title, tabs, rowH, top, visible, footer, tab: 0, view: 0 });
  }
  // --- para sobrescribir
  rows() { return []; }
  pick() {}
  drawBody() {}
  onTab() {}
  // --- pintado
  tabX(i) { return 30 + i * Math.floor((this.w - 50) / Math.max(1, this.tabs.length)); }
  draw(g, me) {
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
      const y = this.top + i * this.rowH, over = inside(lx, ly, 10, this.w - 12, y - 1, y + this.rowH - 2);
      const col = over ? WHITE : r.color || DARK;
      g.text(14, y, r.text, col, { size: 11 });
      if (r.right != null) g.text(this.w - 44, y, String(r.right), col, { size: 11 });
      if (over && r.tip) hint = r.tip;
    }
    if (rows.length > this.visible) g.text(this.w - 22, this.top - 14, this.view > 0 ? "▲" : " ", INK, { size: 9 }), g.text(this.w - 22, this.top + this.visible * this.rowH, this.view + this.visible < rows.length ? "▼" : " ", INK, { size: 9 });
    this.hintText = "";
    if (this.hintOver) hint = this.hintOver(lx, ly, me) || hint;
    if (hint) this.paintHint(g, hint);
    else if (this.footer) g.text(14, 308, this.footer, INK, { size: 9 });
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
    const lines = this.wrap(g, text, this.w - 36).slice(0, 2);
    lines.forEach((l, i) => g.text(14, 262 + i * 12, l, INK, { size: 10 }));
  }
  hoverOk(lx, ly) { return lx >= this.w - 104 && lx <= this.w - 30 && ly >= 292 && ly <= 312; }
  click(g, lx, ly, me) {
    if (this.hoverOk(lx, ly)) { g.close(this.id); return true; }
    for (let i = 0; i < this.tabs.length; i++) { const x = this.tabX(i); if (inside(lx, ly, x - 5, x + 85, 38, 58)) { this.tab = i; this.view = 0; this.onTab(i, me); return true; } }
    const rows = this.rows(me) || [], i = Math.floor((ly - this.top) / this.rowH);
    if (ly >= this.top && i >= 0 && i < this.visible && lx > 10 && lx < this.w - 12) { const r = rows[i + this.view]; if (r && !r.disabled) this.pick(r, me, g); }
    return true;
  }
  wheel(g, d) { this.view -= d; }
}
