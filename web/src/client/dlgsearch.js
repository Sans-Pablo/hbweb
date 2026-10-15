// Buscador para los cuadros de marco clásico (tienda, herrería, almacén, compañeros): campo con lupa en la franja inferior del marco.
// Los cuadros del lienzo nuevo usan Ui.search (window.js); este es el equivalente para las ventanas «de madera», que no tienen campos de texto.
import { font, INK } from "./uistyle.js";

export class DlgSearch {
  constructor(x = 24, y = 312, w = 150) { Object.assign(this, { x, y, w, h: 18, q: "", on: false }); }
  get text() { return this.q.trim().toLowerCase(); }
  match(s) { const q = this.text; return !q || String(s).toLowerCase().includes(q); }
  reset() { this.q = ""; this.on = false; }
  draw(g, ph = "Search…") {
    const c = g.ctx, { x, y, w, h } = this;
    c.fillStyle = "rgba(30,20,10,.82)"; c.fillRect(x, y, w, h);
    c.strokeStyle = this.on ? "#e0b84a" : "#6b5835"; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1);
    c.strokeStyle = "#a89a78"; c.beginPath(); c.arc(x + 8, y + 8, 3.5, 0, 7); c.moveTo(x + 10.5, y + 10.5); c.lineTo(x + 14, y + 14); c.stroke();
    const caret = this.on && Math.floor(performance.now() / 500) % 2 === 0 ? "|" : "";
    c.save(); c.beginPath(); c.rect(x + 18, y, w - 36, h); c.clip();
    c.font = font(11); c.textBaseline = "top"; c.textAlign = "left"; c.fillStyle = this.q ? "#f0e2bd" : "#a89a78";
    const s = this.q || (this.on ? "" : ph); const tw = c.measureText(s).width;
    c.fillText(s + caret, x + 20 - Math.max(0, tw - (w - 42)), y + 3); c.restore();
    if (this.q) { c.fillStyle = "#a89a78"; c.textAlign = "center"; c.fillText("×", x + w - 9, y + 3); c.textAlign = "left"; }
  }
  // clic en coordenadas del cuadro; devuelve true si lo ha consumido. Cualquier otro clic quita el foco.
  click(lx, ly) {
    const inB = lx >= this.x && lx < this.x + this.w && ly >= this.y && ly < this.y + this.h;
    if (inB && this.q && lx >= this.x + this.w - 18) { this.q = ""; this.on = true; return true; }
    this.on = inB; return inB;
  }
  key(e) {
    if (!this.on) return false;
    if (e.key === "Escape" || e.key === "Enter") { this.on = false; return true; }
    if (e.key === "Backspace") { this.q = this.q.slice(0, -1); return true; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && this.q.length < 40) { this.q += e.key; return true; }
    return e.key.length > 1 && e.key !== "Tab" ? false : true;
  }
}
