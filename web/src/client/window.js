// Sistema de ventanas del juego: todo dibujado en el lienzo 800x600 con el marco clásico de Helbreath (gamedialog_1, fotograma 2) y
// los botones de piedra de DialogText. Sustituye a los paneles HTML (F1, diario de misiones, avisos...): el cursor es siempre el del juego.
//
// Uso (modo inmediato): se hereda de `Win` y se escribe `body(ui, me, world)`, que se llama en cada fotograma:
//   class Mi extends Win { constructor() { super({ id: 70, title: "Mi ventana", w: 400, h: 300 }); }
//     body(ui) { ui.text(24, 40, "Hola"); ui.btn(24, 60, 80, "Ok", () => this.g.close(this.id)); } }
//   gui.register(new Mi());   // y gui.toggle(70)
// Las coordenadas del cuerpo son locales a la ventana (0,0 = esquina del marco); el área útil es `this.inner`.
// Widgets: text, para, head, rule, btn, check, slider, input (texto o número), combo (lista con filtro), scroll (zona con barra) y `Flow`
// para colocar filas que saltan de línea. Ver docs/sistemas/ventanas.md.
import { t } from "./i18n.js";
import { font, LAYOUT, drawFrameBall } from "./uistyle.js";

export const THEME = {
  txt: "#f0e2bd", dim: "#a89a78", hi: "#ffe9a0", head: "#f2c14e", good: "#9fe07f", bad: "#ff8a6a", link: "#8fc7ff",
  title: "#2d1919", field: "#120d06", fieldOn: "#1d150a", line: "#6b5835", lineOn: "#e0b84a", sel: "rgba(224,184,74,.28)",
  pad: 8, gap: 6, row: 24,                       // márgenes: separación al borde del hueco, entre piezas y alto de fila
};
// Casilla neutra al estilo del original (cuadros de objeto de Game.cpp: hueco gris oscuro con bisel); en reposo no destaca y se enciende al pasar/seleccionar
export function drawSlot(c, x, y, s, on = false, sel = false) {
  c.save(); c.fillStyle = on ? "rgba(150,150,150,.38)" : "rgba(60,60,60,.28)"; c.fillRect(x, y, s, s);
  c.strokeStyle = on || sel ? (sel ? THEME.lineOn : "rgba(225,225,225,.85)") : "rgba(20,20,20,.55)"; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, s - 1, s - 1);
  c.strokeStyle = on ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.12)"; c.beginPath(); c.moveTo(x + 1.5, y + s - 1.5); c.lineTo(x + 1.5, y + 1.5); c.lineTo(x + s - 1.5, y + 1.5); c.stroke(); c.restore();
}
const MIN_W = 170, MIN_H = 26;
const KEY = "gamedialog_1", FRAME = 2, BTN = "dialogtext_1";
const cache = new Map();

// ---------------------------------------------------------------- piezas del marco y de los botones (se recortan de las hojas originales)
function mk(w, h) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d"); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high"; return [cv, c]; }
// rellena (dx,dy,dw,dh) repitiendo el trozo (fx,fy,fw,fh) de la hoja; con `mirror`, cada baldosa se voltea para que no se note la junta
function tile(c, img, k, ox, oy, S, fx, fy, fw, fh, dx, dy, dw, dh, mx, my) {
  c.save(); c.beginPath(); c.rect(dx * S, dy * S, dw * S, dh * S); c.clip();
  for (let j = 0, y = dy; y < dy + dh; j++, y += fh) for (let i = 0, x = dx; x < dx + dw; i++, x += fw) {
    c.save(); c.translate((x + (mx && i & 1 ? fw : 0)) * S, (y + (my && j & 1 ? fh : 0)) * S); c.scale(mx && i & 1 ? -1 : 1, my && j & 1 ? -1 : 1);
    c.drawImage(img, (ox + fx) * k, (oy + fy) * k, fw * k, fh * k, 0, 0, fw * S, fh * S); c.restore();
  }
  c.restore();
}
function sheet(g, key, f) {
  const [img, k] = g.uiSrc(key), fr = g.manifest[key].frames[f];
  return img && img.naturalWidth ? { img, k, ox: fr[0], oy: fr[1], fw: fr[2], fh: fr[3] } : null;
}
const scaleOf = g => Math.max(1, Math.min(3, Math.ceil(g.scale * g.dpr)));

export function frameCanvas(g, w, h) {
  const s = sheet(g, KEY, FRAME); if (!s) return null;
  const S = scaleOf(g), id = `f${w}x${h}@${S}:${s.k}`; let e = cache.get(id); if (e) return e;
  const [cv, c] = mk(w * S, h * S), { img, k, ox, oy } = s, T = (...a) => tile(c, img, k, ox, oy, S, ...a);
  const sl = (fx, fy, fw, fh, dx, dy) => c.drawImage(img, (ox + fx) * k, (oy + fy) * k, fw * k, fh * k, dx * S, dy * S, fw * S, fh * S);
  T(160, 245, 70, 66, 17, 31, w - 34, h - 53, true, true);                       // fondo: un trozo liso de la piedra central
  T(40, 0, 90, 31, 24, 0, w - 48, 31, true, false); T(40, 317, 90, 22, 24, h - 22, w - 48, 22, true, false);
  T(0, 60, 17, 140, 0, 31, 17, h - 53, false, true); T(241, 60, 17, 140, w - 17, 31, 17, h - 53, false, true);
  sl(0, 0, 24, 31, 0, 0); sl(234, 0, 24, 31, w - 24, 0); sl(0, 317, 24, 22, 0, h - 22); sl(234, 317, 24, 22, w - 24, h - 22);
  c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(17 * S, 31 * S, (w - 34) * S, S); c.fillRect(17 * S, 31 * S, S, (h - 53) * S);          // hueco hundido
  c.fillStyle = "rgba(255,225,170,.28)"; c.fillRect(17 * S, (h - 23) * S, (w - 34) * S, S); c.fillRect((w - 18) * S, 31 * S, S, (h - 53) * S);
  cache.set(id, e = cv); return e;
}
// botón de piedra sin rótulo: tapas del «Ok» original y el centro repetido (el texto va pintado aparte)
export function buttonCanvas(g, w, hover) {
  const s = sheet(g, BTN, hover ? 1 : 0); if (!s) return null;
  const S = scaleOf(g), id = `b${w}${hover ? "h" : ""}@${S}:${s.k}`; let e = cache.get(id); if (e) return e;
  const [cv, c] = mk(w * S, 20 * S), { img, k, ox, oy } = s;
  tile(c, img, k, ox, oy, S, 22, 0, 6, 20, 11, 0, w - 22, 20, true, false);
  c.drawImage(img, ox * k, oy * k, 22 * k, 20 * k, 0, 0, 22 * S, 20 * S);
  c.drawImage(img, (ox + 52) * k, oy * k, 22 * k, 20 * k, (w - 22) * S, 0, 22 * S, 20 * S);
  cache.set(id, e = cv); return e;
}

const wraps = new Map();
export function wrap(c, s, w, size = 12, bold = false) {
  const key = `${size}${bold ? "b" : ""}|${w}|${s}`; let r = wraps.get(key); if (r) return r;
  c.font = font(size, bold); r = [];
  for (const para of s.split("\n")) {
    let cur = "";
    for (const word of para.split(" ")) {
      const test = cur ? cur + " " + word : word;
      if (cur && c.measureText(test).width > w) { r.push(cur); cur = word; } else cur = test;
    }
    r.push(cur);
  }
  if (wraps.size > 600) wraps.clear();
  wraps.set(key, r); return r;
}

// ---------------------------------------------------------------- dibujo por fotograma
export class Ui {
  constructor(win, g) {
    this.win = win; this.g = g; this.c = g.ctx; this.ox = 0; this.oy = 0; this.clip = { x: 0, y: 0, w: win.w, h: win.h };
    this.hits = win.hits = []; this.m = { x: g.mouse.x - win.x, y: g.mouse.y - win.y }; this.view = null;
  }
  // ---- zonas sensibles (en coordenadas de la ventana; se recortan a la zona visible del scroll)
  hit(x, y, w, h, o) {
    const cl = this.clip; let ax = x + this.ox, ay = y + this.oy; const x2 = Math.min(ax + w, cl.x + cl.w), y2 = Math.min(ay + h, cl.y + cl.h);
    ax = Math.max(ax, cl.x); ay = Math.max(ay, cl.y); if (x2 <= ax || y2 <= ay) return;
    this.hits.push({ x: ax, y: ay, w: x2 - ax, h: y2 - ay, ...o });
  }
  hov(x, y, w, h) {
    const pr = this.win.popRect, m = this.m;
    if (pr && !this.inPop && m.x >= pr.x && m.x < pr.x + pr.w && m.y >= pr.y && m.y < pr.y + pr.h) return false;
    const cl = this.clip, ax = x + this.ox, ay = y + this.oy;
    return m.x >= Math.max(ax, cl.x) && m.x < Math.min(ax + w, cl.x + cl.w) && m.y >= Math.max(ay, cl.y) && m.y < Math.min(ay + h, cl.y + cl.h);
  }
  vis(y, h = 0) { return !this.view || (y + h >= this.view.t && y <= this.view.b); }
  tw(s, size = 12, bold = false) { this.c.font = font(size, bold); return this.c.measureText(t(s)).width; }

  // ---- texto
  text(x, y, s, color = THEME.txt, o = {}) { if (this.vis(y, 14)) this.g.text(x, y, s, color, { shadow: true, ...o }); return this; }
  head(x, y, s) { this.text(x, y, s, THEME.head, { bold: true, shadow: true }); }
  rule(x, y, w) { const c = this.c; c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(x, y, w, 1); c.fillStyle = "rgba(255,225,170,.18)"; c.fillRect(x, y + 1, w, 1); }
  // párrafo con saltos de línea; devuelve la altura que ocupa
  para(x, y, w, s, color = THEME.txt, o = {}) {
    const size = o.size || 12, lh = o.lh || size + 3, lines = wrap(this.c, t(s), w, size, o.bold);
    for (let i = 0; i < lines.length; i++) if (lines[i] && this.vis(y + i * lh, lh)) this.g.text(x, y + i * lh, lines[i], color, { shadow: true, ...o });
    return lines.length * lh;
  }

  // ---- botón de piedra: fn se llama al soltar... al pulsar (como el resto de cuadros del juego)
  btn(x, y, w, label, fn, o = {}) {
    const h = 20, over = !o.disabled && this.hov(x, y, w, h), on = over || o.active;
    if (this.vis(y, h)) {
      const cv = buttonCanvas(this.g, w, on), dn = over && this.g.mouse.down ? 1 : 0;
      if (cv) this.c.drawImage(cv, 0, 0, cv.width, cv.height, x + dn, y + dn, w, h); else { this.c.fillStyle = on ? "#8a5a2a" : "#5a5248"; this.c.fillRect(x, y, w, h); }
      if (o.primary && !o.disabled) { this.c.strokeStyle = over ? "#fff0b0" : THEME.lineOn; this.c.strokeRect(x + dn + 1.5, y + dn + 1.5, w - 3, h - 3); }   // botón principal (Ok): filete dorado
      this.g.text(x + w / 2 + dn, y + 4 + dn, label, o.disabled ? "#8a8272" : o.color || (o.primary ? "#ffe9a0" : on ? "#ffe08a" : "#fff"), { align: "center", shadow: true, bold: !!o.primary });
    }
    if (!o.disabled) this.hit(x, y, w, h, { fn, tip: o.tip });
    if (over && o.tip) this.g.tip(o.tip, this.g.mouse.x + 12, this.g.mouse.y + 14);
    return w;
  }
  // ---- casilla
  check(x, y, label, on, set, o = {}) {
    const c = this.c, over = this.hov(x, y, 14 + 6 + this.tw(label), 14);
    if (this.vis(y, 14)) {
      c.fillStyle = THEME.field; c.fillRect(x, y, 14, 14); c.strokeStyle = over ? THEME.lineOn : THEME.line; c.strokeRect(x + .5, y + .5, 13, 13);
      if (on) { c.strokeStyle = THEME.good; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 3, y + 7); c.lineTo(x + 6, y + 10); c.lineTo(x + 11, y + 4); c.stroke(); c.lineWidth = 1; }
      this.g.text(x + 20, y + 1, label, over ? THEME.hi : THEME.txt, o.shadow === false ? {} : { shadow: true });
    }
    this.hit(x, y, 20 + this.tw(label), 14, { fn: () => set(!on) });
  }
  // ---- deslizador (captura el ratón mientras se arrastra)
  slider(x, y, w, v, min, max, set, o = {}) {
    const c = this.c, k = (v - min) / (max - min), kx = x + 6 + Math.round((w - 12) * Math.max(0, Math.min(1, k))), over = this.hov(x, y, w, 16);
    if (this.vis(y, 16)) {
      c.fillStyle = THEME.field; c.fillRect(x, y + 6, w, 4); c.strokeStyle = THEME.line; c.strokeRect(x + .5, y + 6.5, w - 1, 3);
      c.fillStyle = THEME.lineOn; c.fillRect(x + 1, y + 7, kx - x - 1, 2);
      c.fillStyle = over || this.win.dragging ? "#ffe08a" : "#c9a55a"; c.fillRect(kx - 4, y + 1, 8, 14); c.strokeStyle = "#2a1c08"; c.strokeRect(kx - 3.5, y + 1.5, 7, 13);
    }
    const pick = mx => { const q = Math.max(0, Math.min(1, (mx - this.win.x - (x + this.ox) - 6) / (w - 12))); let n = min + q * (max - min); if (o.step) n = Math.round(n / o.step) * o.step; set(Math.max(min, Math.min(max, n))); };
    this.hit(x - 4, y, w + 8, 16, { drag: (mx) => pick(mx + this.win.x) });
  }

  // ---- campo de texto o de número
  input(id, x, y, w, o = {}) {
    const win = this.win, c = this.c, foc = win.focus === id, h = 20, over = this.hov(x, y, w, h);
    if (win.vals[id] === undefined) win.vals[id] = String(o.def ?? "");
    const v = win.vals[id];
    win.fields[id] = { num: o.num, min: o.min, max: o.max, enter: o.enter, maxLen: o.maxLen, step: o.step || 1, def: o.def };
    if (this.vis(y, h)) {
      c.fillStyle = foc ? THEME.fieldOn : THEME.field; c.fillRect(x, y, w, h); c.strokeStyle = foc ? THEME.lineOn : over ? "#a88a48" : THEME.line; c.strokeRect(x + .5, y + .5, w - 1, h - 1);
      c.save(); c.beginPath(); c.rect(x + 2, y, w - (o.arrow ? 18 : 4), h); c.clip();
      const shown = o.pass ? "•".repeat(v.length) : v, tw = this.tw(shown) , tx = Math.min(x + 5, x + w - (o.arrow ? 20 : 6) - tw);
      if (!v && !foc && o.ph) this.g.text(x + 5, y + 4, o.ph, "#6e6350"); else this.g.text(tx, y + 4, shown, THEME.txt);
      if (foc && Math.floor(performance.now() / 450) % 2 === 0) { c.fillStyle = THEME.hi; c.fillRect(Math.round(tx + tw) + 1, y + 3, 1, 14); }
      c.restore();
      if (o.arrow) { c.fillStyle = foc ? THEME.lineOn : "#a89a78"; c.beginPath(); c.moveTo(x + w - 14, y + 8); c.lineTo(x + w - 6, y + 8); c.lineTo(x + w - 10, y + 13); c.fill(); }
    }
    const step = dir => { const f = win.fields[id], n = (parseFloat(win.vals[id]) || 0) + dir * f.step; win.setNum(id, n); };
    this.hit(x, y, w, h, { fn: () => { if (win.focus !== id) win.focusOn(id); else if (o.arrow) win.blur(); }, wheel: o.num ? step : null, tip: o.tip });
    if (over && o.tip) this.g.tip(o.tip, this.g.mouse.x + 12, this.g.mouse.y + 14);
    return v;
  }
  // ---- buscador para ventanas con listas: campo con lupa y × para borrar; devuelve el texto buscado en minúsculas
  search(id, x, y, w, o = {}) {
    const win = this.win, c = this.c, q = this.input(id, x + 18, y, w - 18, { ph: o.ph || t("Buscar…"), maxLen: 40, tip: o.tip });
    if (this.vis(y, 20)) {
      c.strokeStyle = THEME.dim; c.lineWidth = 1.5; c.beginPath(); c.arc(x + 7, y + 8, 4, 0, 7); c.moveTo(x + 10, y + 11); c.lineTo(x + 14, y + 15); c.stroke(); c.lineWidth = 1;
      if (q) { const over = this.hov(x + w - 18, y, 18, 20); this.g.text(x + w - 12, y + 4, "×", over ? THEME.hi : THEME.dim, { align: "center" }); }
    }
    if (q) this.hit(x + w - 18, y, 18, 20, { fn: () => { win.vals[id] = ""; win.blur(); } });
    return q.trim().toLowerCase();
  }
  // ---- lista desplegable con filtro al escribir; `strict` obliga a que el valor sea una de las opciones
  combo(id, x, y, w, options, o = {}) {
    const win = this.win;
    if (win.vals[id] === undefined) win.vals[id] = String(o.def ?? options[0] ?? "");
    win.combos[id] = { options, strict: o.strict !== false && !o.free, rect: { x: x + this.ox, y: y + this.oy, w, h: 20 } };
    if (win.focus === id) win.lastOk[id] = win.lastOk[id] ?? win.vals[id];
    return this.input(id, x, y, w, { ...o, arrow: true });
  }
  // ---- zona con scroll (rueda + barra arrastrable). fn(ui, anchoUtil) dibuja el contenido y devuelve su altura
  scroll(key, x, y, w, h, fn) {
    const win = this.win, c = this.c, s = win.sc[key] || (win.sc[key] = { off: 0, h: 0 }), max = Math.max(0, s.h - h), sb = max > 0 ? 10 : 0;
    s.off = Math.max(0, Math.min(max, s.off));
    this.hit(x, y, w, h, { wheel: dir => { s.off = Math.max(0, Math.min(Math.max(0, s.h - h), s.off - dir * 30)); } });
    const sv = [this.ox, this.oy, this.clip, this.view];
    c.save(); c.beginPath(); c.rect(x, y, w - sb, h); c.clip(); c.translate(x, y - s.off);
    const cl = this.clip, ax = x + this.ox, ay = y + this.oy, nx = Math.max(ax, cl.x), ny = Math.max(ay, cl.y);
    this.clip = { x: nx, y: ny, w: Math.max(0, Math.min(ax + w - sb, cl.x + cl.w) - nx), h: Math.max(0, Math.min(ay + h, cl.y + cl.h) - ny) };
    this.ox += x; this.oy += y - s.off; this.view = { t: s.off - 14, b: s.off + h };
    s.h = fn(this, w - sb - 6) || 0;
    c.restore(); [this.ox, this.oy, this.clip, this.view] = sv;
    if (max > 0) {
      const tx = x + w - 8, th = Math.max(22, h * h / s.h), ty = y + (h - th) * (s.off / max), over = this.hov(tx, y, 8, h);
      c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(tx, y, 8, h); c.strokeStyle = THEME.line; c.strokeRect(tx + .5, y + .5, 7, h - 1);
      c.fillStyle = over || s.grab != null ? "#d4b46a" : "#a88a48"; c.fillRect(tx + 1, ty + 1, 6, th - 2);
      this.hit(tx - 2, y, 12, h, { drag: (mx, my, first) => {
        if (first) s.grab = my - (ty + this.oy) >= 0 && my - (ty + this.oy) <= th ? my - (ty + this.oy) : th / 2;
        const q = (my - this.oy - y - s.grab) / Math.max(1, h - th); s.off = Math.max(0, Math.min(max, q * max));
      }, end: () => { s.grab = null; } });
    }
    return s;
  }

  // ---- lo que va por encima de todo: la lista desplegable del campo con el foco
  finish() {
    const win = this.win, c = this.c, id = win.focus, cb = id && win.combos[id];
    win.popRect = null; win.popList = null;
    if (!cb) return;
    const v = win.vals[id], q = win.typed ? v.toLowerCase() : "";
    const list = cb.options.filter(o => !q || String(o).toLowerCase().includes(q)), rh = 16, rows = Math.min(8, list.length);
    win.popList = list;
    if (!rows) return;
    if (win.popHi >= list.length) win.popHi = list.length - 1;
    if (win.popHi < 0 && list.length) win.popHi = Math.max(0, list.findIndex(o => String(o) === v));
    win.popOff = Math.max(0, Math.min(list.length - rows, win.popOff));
    const r = cb.rect, ph = rows * rh + 2; let py = r.y + r.h + 1; if (py + ph > win.h - 6) py = Math.max(4, r.y - ph - 1);
    const pw = Math.max(r.w, 140), px = Math.min(r.x, win.w - pw - 4);
    win.popRect = { x: px, y: py, w: pw, h: ph };
    this.inPop = true; const sv = [this.clip, this.ox, this.oy, this.view]; this.clip = { x: 0, y: 0, w: win.w, h: win.h }; this.ox = this.oy = 0; this.view = null;
    c.fillStyle = "#0e0a04"; c.fillRect(px, py, pw, ph); c.strokeStyle = THEME.lineOn; c.strokeRect(px + .5, py + .5, pw - 1, ph - 1);
    for (let i = 0; i < rows; i++) {
      const idx = i + win.popOff, ry = py + 1 + i * rh, over = this.hov(px, ry, pw - 8, rh);
      if (over) win.popHi = idx;
      if (idx === win.popHi) { c.fillStyle = THEME.sel; c.fillRect(px + 1, ry, pw - 2, rh); }
      c.save(); c.beginPath(); c.rect(px + 2, ry, pw - 12, rh); c.clip(); this.g.text(px + 5, ry + 2, String(list[idx]), idx === win.popHi ? THEME.hi : THEME.txt); c.restore();
      this.hit(px, ry, pw - 8, rh, { pop: true, fn: () => win.pick(id, list[idx]) });
    }
    this.hit(px, py, pw, ph, { pop: true, wheel: dir => { win.popOff = Math.max(0, Math.min(list.length - rows, win.popOff - dir)); } });
    if (list.length > rows) {
      const th = Math.max(10, (ph - 4) * rows / list.length), ty = py + 2 + (ph - 4 - th) * (win.popOff / (list.length - rows));
      c.fillStyle = "#a88a48"; c.fillRect(px + pw - 6, ty, 4, th);
    }
    [this.clip, this.ox, this.oy, this.view] = sv; this.inPop = false;
  }
}

// colocador de filas que saltan de línea (para barras de herramientas con muchos campos)
export class Flow {
  constructor(ui, x, y, w, o = {}) { this.ui = ui; this.x0 = this.x = x; this.y = y; this.r = x + w; this.gap = o.gap ?? 6; this.rh = o.rh ?? 24; }
  put(wd, fn) { if (this.x + wd > this.r && this.x > this.x0) this.nl(); fn(this.x, this.y); this.x += wd + this.gap; return this; }
  nl(extra = 0) { this.x = this.x0; this.y += this.rh + extra; return this; }
  text(s, color) { return this.put(this.ui.tw(s), (x, y) => this.ui.text(x, y + 4, s, color)); }
  btn(label, fn, o = {}) { const wd = Math.max(o.w || 0, this.ui.tw(label) + 22); return this.put(wd, (x, y) => this.ui.btn(x, y, wd, label, fn, o)); }
  input(id, wd, o) { return this.put(wd, (x, y) => this.ui.input(id, x, y, wd, o)); }
  combo(id, wd, opts, o) { return this.put(wd, (x, y) => this.ui.combo(id, x, y, wd, opts, o)); }
  get bottom() { return this.y + this.rh; }
}

// ---------------------------------------------------------------- la ventana
export class Win {
  constructor(o) {
    Object.assign(this, { title: "", modal: false, esc: true }, o);
    this.x = o.x ?? Math.round((800 - o.w) / 2); this.y = o.y ?? Math.max(4, Math.round((548 - o.h) / 2));
    this.vals = {}; this.fields = {}; this.combos = {}; this.sc = {}; this.hits = []; this.lastOk = {};
    this.focus = null; this.typed = false; this.popHi = -1; this.popOff = 0;
    this.inner = { x: LAYOUT.padX, y: LAYOUT.padTop, w: o.w - 2 * LAYOUT.padX, h: o.h - LAYOUT.padTop - LAYOUT.padBottom };
  }
  onOpen(g) { this.g = g; this.focus = null; this.popRect = null; this.opened?.(g); }
  // ---- campos
  v(id, def = "") { return this.vals[id] ?? def; }
  n(id, def = 0) {
    const f = this.fields[id] || {}; let n = parseFloat(this.vals[id]); if (!Number.isFinite(n)) n = def;
    if (f.min != null) n = Math.max(f.min, n); if (f.max != null) n = Math.min(f.max, n); return n;
  }
  setNum(id, n) { const f = this.fields[id] || {}; if (f.min != null) n = Math.max(f.min, n); if (f.max != null) n = Math.min(f.max, n); this.vals[id] = String(Math.round(n * 100) / 100); }
  focusOn(id) { this.blur(); this.focus = id; this.typed = false; this.popHi = -1; this.popOff = 0; if (this.combos[id]) this.lastOk[id] = this.vals[id]; }
  blur() {
    const id = this.focus; if (!id) return; this.focus = null;
    const cb = this.combos[id], f = this.fields[id];
    if (cb && cb.strict && !cb.options.some(o => String(o) === this.vals[id])) this.vals[id] = this.lastOk[id] ?? String(cb.options[0] ?? "");
    if (f && f.num) this.vals[id] === "" || this.vals[id] === "-" ? this.vals[id] = String(f.def ?? f.min ?? 0) : this.setNum(id, parseFloat(this.vals[id]) || 0);
  }
  pick(id, val) { this.vals[id] = String(val); this.lastOk[id] = this.vals[id]; this.focus = null; this.fields[id]?.enter?.(); this.onPick?.(id, val); }

  // ---- fotograma
  // Cerrar y minimizar (mecanismo común, modelo: la mini ventana del auto hunt). La bola plateada de arriba a la derecha cierra y la de
  // arriba a la izquierda minimiza la ventana a una barrita con el título (otro clic en su bola izquierda la restaura). Opciones del
  // constructor: nox (sin cerrar), nomin (sin minimizar; las modales y las que no se pueden cerrar tampoco minimizan).
  get canMin() { return !this.nomin && !this.nox && !this.modal; }
  minimize() { if (!this.canMin || this.minimized) return; this.full = { w: this.w, h: this.h }; this.minimized = true; this.w = MIN_W; this.h = MIN_H; this.focus = null; this.popRect = null; }
  restore() { if (!this.minimized) return; this.minimized = false; this.w = this.full.w; this.h = this.full.h; }
  toggleMin() { this.minimized ? this.restore() : this.minimize(); }
  // bola de botón (diseño de las bolas plateadas del marco, ver drawFrameBall), se pinta encima de la del marco
  ball(ui, cx, cy, glyph, tip, fn) {
    const over = ui.hov(cx - 8, cy - 8, 16, 16); drawFrameBall(ui.c, cx, cy, glyph, over);
    ui.hit(cx - 8, cy - 8, 16, 16, { fn });
    if (over) this.g.tip(t(tip), this.g.mouse.x + 12, this.g.mouse.y + 14);
  }
  draw(g, me, world) {
    const c = g.ctx, ui = this.ui = new Ui(this, g); this.g = g;
    if (this.minimized) {
      c.fillStyle = "#2a2014"; c.fillRect(0, 0, this.w, this.h); c.strokeStyle = "#a88a48"; c.strokeRect(.5, .5, this.w - 1, this.h - 1);
      c.strokeStyle = "rgba(255,225,170,.25)"; c.strokeRect(1.5, 1.5, this.w - 3, this.h - 3);
      if (this.title) g.text(this.w / 2, 7, this.title, THEME.hi, { align: "center", bold: true });
      this.ball(ui, 13, this.h / 2, "o", "Restaurar", () => { this.restore(); return true; });
      this.ball(ui, this.w - 13, this.h / 2, "x", "Cerrar", () => { g.close(this.id); return true; });
      ui.finish(); return;
    }
    const fr = frameCanvas(g, this.w, this.h);
    if (fr) c.drawImage(fr, 0, 0, fr.width, fr.height, 0, 0, this.w, this.h); else { c.fillStyle = "#5a4630"; c.fillRect(0, 0, this.w, this.h); c.fillStyle = "#2a2014"; c.fillRect(17, 31, this.w - 34, this.h - 53); }
    if (this.title) g.text(this.w / 2, LAYOUT.titleY, this.title, THEME.title, { align: "center", bold: true });
    this.body(ui, me, world);
    ui.finish();
    if (!this.nox) this.ball(ui, this.w - 9, 9, "x", "Cerrar", () => { g.close(this.id); return true; });
    if (this.canMin) this.ball(ui, 9, 9, "-", "Minimizar", () => { this.minimize(); return true; });
  }
  body() {}

  // ---- ratón
  at(lx, ly, pred) {
    for (let i = this.hits.length - 1; i >= 0; i--) { const h = this.hits[i]; if (lx >= h.x && lx < h.x + h.w && ly >= h.y && ly < h.y + h.h && (!pred || pred(h))) return h; }
    return null;
  }
  click(g, lx, ly) {
    const h = this.at(lx, ly, h => h.fn || h.drag);
    const keep = h && h.pop ? this.focus : null; if (!keep) { if (!h || !h.fn || this.focus) this.blur(); }
    if (!h) return false;
    if (h.drag) { h.drag(lx, ly, true); this.dragging = true; g.cap = { fn: (gx, gy) => h.drag(gx - this.x, gy - this.y, false) }; const end = () => { this.dragging = false; h.end?.(); removeEventListener("pointerup", end); }; addEventListener("pointerup", end); return true; }
    h.fn(); return true;
  }
  wheel(g, dir) { const h = this.at(g.mouse.x - this.x, g.mouse.y - this.y, h => h.wheel); if (h) h.wheel(dir); return true; }

  // ---- teclado (solo lo que hace falta con un campo con el foco, y Esc / Intro)
  key(e, g) {
    const k = e.key, id = this.focus;
    if (id) {
      if (/^F\d+$/.test(k)) return false;
      if (e.ctrlKey || e.metaKey) {
        if (k === "v" || k === "V") { navigator.clipboard?.readText().then(s => { if (this.focus === id) { const f = this.fields[id]; this.vals[id] += f.num ? s.replace(/[^0-9.\-]/g, "") : s.replace(/[\r\n]+/g, " "); this.typed = true; } }).catch(() => {}); return true; }
        return false;
      }
      const f = this.fields[id] || {}, cb = this.combos[id];
      if (k === "Escape") { if (cb) this.vals[id] = this.lastOk[id] ?? this.vals[id]; this.blur(); return true; }
      if (k === "Enter" || k === "Tab") {
        if (cb && this.popList && this.popList.length && (this.typed || this.popHi >= 0)) { const sel = this.popList[Math.max(0, this.popHi)]; if (sel !== undefined) this.vals[id] = String(sel); }
        this.lastOk[id] = this.vals[id]; this.blur(); f.enter?.(); this.modalEnter?.(id); return true;
      }
      if (k === "Backspace") { this.vals[id] = this.vals[id].slice(0, -1); this.typed = true; this.popHi = -1; return true; }
      if (cb && (k === "ArrowDown" || k === "ArrowUp")) {
        const n = this.popList?.length || 0; if (n) { this.popHi = Math.max(0, Math.min(n - 1, (this.popHi < 0 ? (k === "ArrowDown" ? -1 : n) : this.popHi) + (k === "ArrowDown" ? 1 : -1))); if (this.popHi < this.popOff) this.popOff = this.popHi; else if (this.popHi >= this.popOff + 8) this.popOff = this.popHi - 7; }
        return true;
      }
      if (f.num && (k === "ArrowUp" || k === "ArrowDown")) { this.setNum(id, (parseFloat(this.vals[id]) || 0) + (k === "ArrowUp" ? 1 : -1) * (f.step || 1) * (e.shiftKey ? 10 : 1)); return true; }
      if (k.length === 1 && !e.altKey) {
        if (f.num && !/[0-9.\-]/.test(k)) return true;
        if (f.maxLen && this.vals[id].length >= f.maxLen) return true;
        if (!cb || !this.typed) { if (cb && !this.typed) this.vals[id] = ""; }
        this.vals[id] += k; this.typed = true; this.popHi = -1; this.popOff = 0; return true;
      }
      return true;
    }
    if (k === "Escape" && (this.esc || this.modal)) { g.close(this.id); return true; }
    return false;
  }
}

// ---------------------------------------------------------------- avisos modales: sustituyen a prompt()/confirm() del navegador
class Prompt extends Win {
  constructor(id, kind) { super({ id, title: kind === "ask" ? " " : " ", w: 320, h: 150, modal: true, fixed: true }); this.kind = kind; }
  opened() {
    if (this.kind === "ask") { this.vals.v = String(this.def ?? ""); this.focusOn("v"); }
    this.done = false;
  }
  onClose() { this.finish(this.kind === "ask" ? null : false); }
  finish(val) { if (this.done) return; this.done = true; const r = this.res; this.res = null; r?.(val); }
  end(val) { this.finish(val); this.g.close(this.id); }
  modalEnter() { if (this.kind === "ask") this.end(this.vals.v); }
  body(ui) {
    const w = this.w, iw = w - 44;
    const h = ui.para(22, 40, iw, this.label || "", THEME.txt, { shadow: true });
    if (this.kind === "ask") {
      const num = this.opts?.numeric;
      ui.input("v", 22, 40 + h + 8, iw, { num, min: this.opts?.min, max: this.opts?.max, maxLen: this.opts?.maxLen, enter: () => this.end(this.vals.v) });
      const by = this.h - 50;
      ui.btn(w / 2 - 82, by, 76, "Ok", () => this.end(this.vals.v), { primary: true }); ui.btn(w / 2 + 6, by, 76, "Cancelar", () => this.end(null));
    } else {
      const by = this.h - 50;
      ui.btn(w / 2 - 82, by, 76, "Sí", () => this.end(true)); ui.btn(w / 2 + 6, by, 76, "No", () => this.end(false));
    }
  }
  key(e, g) {
    if (this.kind === "confirm") { if (e.key === "Enter" || e.key === "y" || e.key === "s") { this.end(true); return true; } if (e.key === "Escape" || e.key === "n") { this.end(false); return true; } return true; }
    return super.key(e, g);
  }
}
// gui.ask(texto, valorInicial, {numeric,min,max}) -> Promise<string|null>;  gui.confirm(texto) -> Promise<boolean>
export function registerPrompts(gui) {
  const a = new Prompt(90, "ask"), b = new Prompt(91, "confirm");
  gui.register(a); gui.register(b);
  const run = (win, label, extra) => new Promise(res => {
    if (gui.isOpen(win.id)) gui.close(win.id);
    win.label = label; win.res = res; Object.assign(win, extra);
    const lines = wrap(gui.ctx, t(label), win.w - 44).length; win.h = Math.max(130, 110 + lines * 15 + (win.kind === "ask" ? 28 : 0));
    win.y = Math.max(4, Math.round((548 - win.h) / 2));
    gui.open(win.id); gui.front(win.id);
  });
  gui.ask = (label, def = "", opts = {}) => run(a, label, { def, opts });
  gui.confirm = label => run(b, label, {});
}
