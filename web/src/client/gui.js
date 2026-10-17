// Interfaz del cliente original dibujada sobre un lienzo de 800x600 (los sprites salen de
// GameDialog.pak, GameDialog2.pak, DialogText.pak e interface2.pak; ver tools/convert_ui.py).
// Las posiciones son las de Client/Game.cpp (DrawDialogBox_IconPannel, DrawDialogBox_GaugePannel...).
// El panel inferior es el cuadro 30; los demás cuadros se registran en `dialogs` y se pueden arrastrar.
import { miniOf } from "./compicon.js";
import { shown } from "../shared/systems/evolutions.js";
import { need } from "../shared/systems/companion.js";
import { SCHOOL_OF, SCHOOL_NAMES } from "../shared/systems/schools.js";
import { DUMMY_NAMES, CLS_OF } from "../shared/systems/talents.js";
import { t } from "./i18n.js";
import { MAX_LEVEL } from "../shared/levelcap.js";
import { font, MIN_SIZE, drawFrameBall } from "./uistyle.js";
import { DYE_RGB } from "./look.js";
import { WEAPON_RGB } from "./assets.js";
import { imgUrl } from "./imgurl.js";
const UI_IA_VERSION = "ui-0.80.1";          // subir al regenerar web/data/ui_ia

export const W = 800, H = 600;
const RESX = 80, RESY = 120, ADDX = 10;            // desplazamientos del cliente modificado a 800x600
const DIGIT_SPACE = [6, 4, 6, 6, 6, 6, 6, 6, 6, 6, 6];   // __cSpace2

const NO_OBSTACLE = new Set([10, 17, 20]);                       // pequeños: no cuentan como obstáculo para colocar los demás
const NO_AVOID = new Set([10, 17, 20, 46, 47]);                  // chat, cantidad y menú de NPC: pequeños, pegados al cursor / abajo

// Títulos de la barra minimizada de los cuadros con marco de sprite (el título del original está en el dibujo)
const LEGACY_TITLES = { 1: "Character", 2: "Inventory", 3: "Magic", 11: "Shop", 12: "Level Up", 14: "Storage", 15: "Skill", 16: "Magic Shop", 19: "System", 23: "Confirm", 31: "Sell list" };
export class Gui {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.manifest = null;
    this.img = {};
    this.mouse = { x: -1, y: -1, down: false };
    this.rect = { x: 0, y: 0, w: W, h: H };
    this.dialogs = new Map();                      // id -> { id, x, y, w, h, draw(g, me), click(g, x, y, me), title }
    this.order = [];                               // de atrás hacia delante
    this.drag = null;
    this.tips = [];
    this.onAction = null;
    this.flags = { combat: false, safe: false };
    this.mobile = false; this.W = W; this.H = H;     // modo móvil: el lienzo ocupa toda la pantalla (lógica W×H = pantalla / escala) y los cuadros se centran de uno en uno
  }

  async load() {
    this.manifest = await (await fetch("data/ui.json")).json();
    this.iaMan = await fetch("data/ui_ia.json").then(r => r.ok ? r.json() : {}).catch(() => ({}));          // cuadros con IA (tools/remaster_ui.py); solo en modo remastered
    this.iaImg = {};
    await Promise.all(Object.keys(this.manifest).map(k => new Promise(res => {
      const i = new Image();
      i.onload = i.onerror = res;
      i.src = "data/ui/" + this.manifest[k].png;
      this.img[k] = i;
    })));
  }
  get ready() { return !!this.manifest; }
  // hoja de la interfaz a usar: [imagen, factor]. La IA se pide la primera vez y, hasta que llega, se dibuja la original.
  uiSrc(key) {
    const h = this.spr && this.spr.hd && this.iaMan && this.iaMan[key];
    if (h) {
      let i = this.iaImg[key];
      if (!i) { i = this.iaImg[key] = new Image(); i.src = imgUrl("data/ui_ia/" + h.png) + "?v=" + UI_IA_VERSION; }
      if (i.complete && i.naturalWidth > 0) return [i, h.k];
    }
    return [this.img[key], 1];
  }

  // coloca el lienzo sobre el área visible del juego (rect en píxeles CSS) y fija la escala 800x600
  place(rect, dpr) {
    this.dpr = dpr || 1;
    if (this.mobile) {                                 // móvil: escala para que los cuadros (≈340 px de alto) quepan y se lean; el lienzo cubre la pantalla
      const vw = innerWidth, vh = innerHeight;
      let tall = 350, wide = 340;                      // el cuadro abierto más grande manda: debe caber entero (mín. 0.5)
      for (const id of this.order) { const d = this.dialogs.get(id); if (!d.mobileFixed) { tall = Math.max(tall, d.h + 8); wide = Math.max(wide, d.w + 8); } }
      const k = Math.max(0.5, Math.min(1.3, Math.min(vh / tall, vw / wide)));
      this.scale = k; this.W = vw / k; this.H = vh / k; this.rect = { x: 0, y: 0, w: vw, h: vh }; this.full = this.rect;
      const s = this.cv.style; s.left = "0px"; s.top = "0px"; s.width = vw + "px"; s.height = vh + "px";
      const pw = Math.round(vw * this.dpr), ph = Math.round(vh * this.dpr);
      if (this.cv.width !== pw || this.cv.height !== ph) { this.cv.width = pw; this.cv.height = ph; }
      for (const id of this.order) this.dialogs.get(id).layout?.(this);
      return;
    }
    this.scale = Math.min(rect.w / W, rect.h / H);
    const cssW = W * this.scale, cssH = H * this.scale;
    this.rect = { x: rect.x + (rect.w - cssW) / 2, y: rect.y + rect.h - cssH, w: cssW, h: cssH };
    this.full = rect;                                  // el lienzo cubre toda el área visible: las ventanas llegan al borde exacto del navegador sin recortarse
    const s = this.cv.style;
    s.left = rect.x + "px"; s.top = rect.y + "px"; s.width = rect.w + "px"; s.height = rect.h + "px";
    const pw = Math.round(rect.w * this.dpr), ph = Math.round(rect.h * this.dpr);
    if (this.cv.width !== pw || this.cv.height !== ph) { this.cv.width = pw; this.cv.height = ph; }
  }

  // coordenadas de ventana (CSS) -> coordenadas 800x600
  toGui(cx, cy) { return [(cx - this.rect.x) / this.scale, (cy - this.rect.y) / this.scale]; }

  // ---------------------------------------------------------------- sprites del juego (item-pack...)
  setGameSprites(spr) { this.spr = spr; this._px = {}; }
  putGame(key, f, x, y, alpha = 1) {
    const hash = key.indexOf("#"), ts = hash < 0 ? "" : key.slice(hash + 1), wt = ts[0] === "w" ? +ts.slice(1) : 0, tint = ts[0] === "w" ? 0 : +ts; if (hash >= 0) key = key.slice(0, hash);
    const fr = this.spr && this.spr.frame(key, f); if (!fr || !this.spr.ready(key)) return;
    const [sx, sy, w, h, px, py] = fr;
    if (alpha !== 1) this.ctx.globalAlpha = alpha;
    const [img, k] = this.spr.src(key);          // hoja con IA (ip*) cuando está cargada; si no, la original
    const sm = k > 1; if (sm) { this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = "high"; }
    if (wt) this.ctx.drawImage(this.weaponIcon(key, f, wt, fr, img, k), 0, 0, w * k, h * k, x + px, y + py, w, h);
    else if (tint) this.ctx.drawImage(this.tintedIcon(key, f, tint, fr, img, k), 0, 0, w * k, h * k, x + px, y + py, w, h);
    else this.ctx.drawImage(img, sx * k, sy * k, w * k, h * k, x + px, y + py, w, h);
    if (sm) this.ctx.imageSmoothingEnabled = false;
    if (alpha !== 1) this.ctx.globalAlpha = 1;
  }
  // icono con el tinte fijo de un báculo (multiplicado y recortado a la forma, como el pelo); se guarda un lienzo por fotograma
  tintedIcon(key, f, tint, fr, img = this.spr.img[key], z = 1) {
    const k = key + ":" + f + ":" + tint + ":" + z, c = this.tintCache || (this.tintCache = new Map());
    let cv = c.get(k);
    if (!cv) {
      const [sx, sy, w, h] = fr; cv = document.createElement("canvas"); cv.width = w * z; cv.height = h * z;
      const g = cv.getContext("2d"); g.drawImage(img, sx * z, sy * z, w * z, h * z, 0, 0, w * z, h * z);
      g.globalCompositeOperation = "multiply"; g.fillStyle = DYE_RGB[tint]; g.fillRect(0, 0, w * z, h * z);
      g.globalCompositeOperation = "destination-in"; g.drawImage(img, sx * z, sy * z, w * z, h * z, 0, 0, w * z, h * z);
      c.set(k, cv);
    }
    return cv;
  }
  // icono de arma con la paleta aditiva del original (WEAPON_RGB)
  weaponIcon(key, f, col, fr, img, z = 1) {
    const k = "w:" + key + ":" + f + ":" + col + ":" + z, c = this.tintCache || (this.tintCache = new Map());
    let cv = c.get(k);
    if (!cv) {
      const [sx, sy, w, h] = fr, off = WEAPON_RGB[col]; cv = document.createElement("canvas"); cv.width = w * z; cv.height = h * z;
      const g = cv.getContext("2d"); g.drawImage(img, sx * z, sy * z, w * z, h * z, 0, 0, w * z, h * z);
      try { const id = g.getImageData(0, 0, cv.width, cv.height), d = id.data; if (off) for (let i = 0; i < d.length; i += 4) if (d[i + 3]) for (let j = 0; j < 3; j++) d[i + j] = Math.max(0, Math.min(255, d[i + j] + off[j])); g.putImageData(id, 0, 0); } catch {}
      c.set(k, cv);
    }
    return cv;
  }
  // ¿el punto (mx, my) toca un píxel opaco del fotograma dibujado en (x, y)? (_bCheckCollison)
  hitUi(key, f, x, y, mx, my) {
    const m = this.manifest[key], fr = m && m.frames[f]; if (!fr) return false;
    return this._hit("u" + key, f, fr, this.img[key], x, y, mx, my);
  }
  hitGame(key, f, x, y, mx, my) {
    const fr = this.spr && this.spr.frame(key, f); if (!fr || !this.spr.ready(key)) return false;
    return this._hit(key, f, fr, this.spr.img[key], x, y, mx, my);
  }
  _hit(key, f, fr, img, x, y, mx, my) {
    const [sx, sy, w, h, px, py] = fr;
    const lx = Math.floor(mx - (x + px)), ly = Math.floor(my - (y + py));
    if (lx < 0 || ly < 0 || lx >= w || ly >= h) return false;
    const k = key + ":" + f;
    let c = this._px[k];
    if (!c) {
      const t = document.createElement("canvas"); t.width = w; t.height = h;
      const g = t.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, sx, sy, w, h, 0, 0, w, h);
      c = this._px[k] = g.getImageData(0, 0, w, h).data;
    }
    return c[(ly * w + lx) * 4 + 3] > 0;
  }

  // ---------------------------------------------------------------- dibujo de sprites
  // fotograma f de un sprite con su pivote en (x, y); w recorta el ancho (PutSpriteFastWidth), vertical recorta el alto
  put(key, f, x, y, w = null, vertical = false, alpha = 1) {
    const m = this.manifest && this.manifest[key]; if (!m) return;
    const fr = m.frames[f]; if (!fr) return;
    const o = this.img[key]; if (!o || !o.naturalWidth) return;
    let [sx, sy, sw, sh, px, py] = fr;
    if (w !== null) { if (vertical) sh = Math.min(sh, w); else sw = Math.min(sw, w); }
    if (sw <= 0 || sh <= 0) return;
    const c = this.ctx, [img, k] = this.uiSrc(key);
    if (alpha !== 1) c.globalAlpha = alpha;
    if (k > 1) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high"; }
    c.drawImage(img, sx * k, sy * k, sw * k, sh * k, x + px, y + py, sw, sh);
    if (k > 1) c.imageSmoothingEnabled = false;
    if (alpha !== 1) c.globalAlpha = 1;
  }

  // cifras de interface2 (PutString_SprNum): sombra negra y color
  num(x, y, text, rgb = [255, 255, 255]) {
    const c = this.ctx;
    let xp = x;
    for (const ch of String(text)) {
      const d = ch.charCodeAt(0) - 48;
      if (d < 0 || d > 9) continue;
      const f = d + 6;
      this.put("interface2_0", f, xp + 2, y);
      this.put("interface2_0", f, xp + 1, y + 1);
      this.tint("interface2_0", f, xp, y, rgb);
      xp += DIGIT_SPACE[d];
    }
    void c;
  }
  // dibuja un fotograma multiplicado por un color (PutTransSpriteRGB aproximado)
  tint(key, f, x, y, rgb) {
    const m = this.manifest[key], fr = m.frames[f], o = this.img[key];
    if (!fr || !o || !o.naturalWidth) return;
    const [sx, sy, sw, sh, px, py] = fr, [img, k] = this.uiSrc(key);
    const t = this._t || (this._t = document.createElement("canvas")), g = t.getContext("2d");
    t.width = sw * k; t.height = sh * k;
    g.clearRect(0, 0, sw * k, sh * k);
    g.drawImage(img, sx * k, sy * k, sw * k, sh * k, 0, 0, sw * k, sh * k);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    g.fillRect(0, 0, sw * k, sh * k);
    this.ctx.drawImage(t, 0, 0, sw * k, sh * k, x + px, y + py, sw, sh);
  }

  // fotograma teñido multiplicando por un color CSS (aproxima PutSpriteRGB; p. ej. el pelo)
  mul(key, f, x, y, color, add = false) {
    const m = this.manifest[key], fr = m && m.frames[f], o = this.img[key];
    if (!fr || !o || !o.naturalWidth) return;
    const [sx, sy, sw, sh, px, py] = fr, [img, k] = this.uiSrc(key), W = sw * k, H = sh * k;
    const t = this._m || (this._m = document.createElement("canvas")), g = t.getContext("2d");
    t.width = W; t.height = H;
    g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, W, H);
    g.drawImage(img, sx * k, sy * k, W, H, 0, 0, W, H);
    g.globalCompositeOperation = add ? "lighter" : "multiply"; g.globalAlpha = add ? 0.55 : 1; g.fillStyle = color; g.fillRect(0, 0, W, H); g.globalAlpha = 1;      // add: mismo mezclado que el sprite del mundo (assets.tintedHair)
    g.globalCompositeOperation = "destination-in"; g.drawImage(img, sx * k, sy * k, W, H, 0, 0, W, H);
    this.ctx.drawImage(t, 0, 0, W, H, x + px, y + py, sw, sh);
  }

  // texto con la letra del cliente (GDI): sombra de 1 píxel opcional
  text(x, y, s, color = "#fafadc", { align = "left", shadow = false, bold = false, size = 12 } = {}) {
    const c = this.ctx;
    s = t(s);
    c.font = font(size, bold);
    c.textBaseline = "top";
    c.textAlign = align;
    if (this.lint) { const w = c.measureText(s).width; this.lint.push({ s, x: align === "center" ? x - w / 2 : align === "right" ? x - w : x, y, w, h: Math.max(MIN_SIZE, size) + 1 }); }
    if (shadow) { c.fillStyle = "#000"; c.fillText(s, x + 1, y + 1); }
    c.fillStyle = color;
    c.fillText(s, x, y);
  }
  // texto centrado entre x1 y x2 (PutAlignedString)
  aligned(x1, x2, y, s, color, opts = {}) { this.text((x1 + x2) / 2, y, s, color, { ...opts, align: "center" }); }
  tip(s, x = this.mouse.x - 10, y = this.mouse.y - 20) { this.tips.push([x, y, s]); }

  // ---------------------------------------------------------------- cuadros de diálogo
  register(d) { this.dialogs.set(d.id, d); }
  isOpen(id) { return this.order.includes(id); }
  open(id) {
    if (!this.dialogs.has(id)) return;
    this.close(id, true);
    const d = this.dialogs.get(id);
    if (this.mobile && !d.mobileFixed) for (const o of [...this.order]) if (!this.dialogs.get(o).mobileFixed) this.close(o);      // móvil: un cuadro cada vez, centrado
    this.order.push(id); d.onOpen?.(this);
    if (this.mobile && this.rect && !d.mobileFixed) this.place(this.rect, this.dpr);   // reescala para que quepa
    if (this.mobile) { if (d.mobileFixed) d.layout?.(this); else { d.x = Math.max(0, (this.W - d.w) / 2); d.y = Math.max(2, (this.H - d.h) / 2); } } else {
      this.avoidOverlap(id);
      if (id === 46 || id === 47) for (const o of [...this.order]) if (o !== id && !NO_AVOID.has(o)) this.avoidOverlap(o);   // si el mensaje del tutorial aparece con cuadros ya abiertos, estos se apartan
    }
  }
  // Al abrir un cuadro grande, se coloca en el hueco libre más cercano a su sitio si pisaría a otro ya abierto (los pequeños de cantidad/menú/chat se quedan donde el original los pone)
  avoidOverlap(id) {
    if (NO_AVOID.has(id)) return;
    const d = this.dialogs.get(id), others = this.order.filter(o => o !== id && !NO_OBSTACLE.has(o)).map(o => this.dialogs.get(o));      // el mensaje del tutorial (46) y su objetivo (47) sí son obstáculo: Personaje y Mochila no lo tapan
    const area = (x, y) => others.reduce((t, o) => t + Math.max(0, Math.min(x + d.w, o.x + o.w) - Math.max(x, o.x)) * Math.max(0, Math.min(y + d.h, o.y + o.h) - Math.max(y, o.y)), 0);
    if (!area(d.x, d.y)) return;
    const maxX = Math.max(0, W - d.w), maxY = Math.max(0, 548 - d.h);
    let best = null, bd = 1e18;                                   // menos superficie tapada; a igualdad, el más cercano (sin hueco libre, el que menos pisa)
    for (let x = 0; x <= maxX; x += 10) for (let y = 0; y <= maxY; y += 10) {
      const k = area(x, y) * 1e6 + (x - d.x) ** 2 + (y - d.y) ** 2;
      if (k < bd) { bd = k; best = [x, y]; }
    }
    if (best) { d.x = best[0]; d.y = best[1]; }
  }
  close(id, quiet) { const i = this.order.indexOf(id); if (i >= 0) { this.order.splice(i, 1); { const d0 = this.dialogs.get(id); if (d0.lmin) this.legacyMin(d0); } if (!quiet) this.dialogs.get(id).onClose?.(this); if (this.mobile && !quiet && this.rect) this.place(this.rect, this.dpr); } }
  toggle(id) { if (this.isOpen(id)) this.close(id); else this.open(id); }
  closeAll() { for (const id of [...this.order]) this.close(id); }
  front(id) { const i = this.order.indexOf(id); if (i >= 0) { this.order.splice(i, 1); this.order.push(id); } }
  // cuadro modal (ventanas de `window.js` con `modal`): mientras esté abierto recibe todo el ratón y el teclado
  modal() { for (let i = this.order.length - 1; i >= 0; i--) { const d = this.dialogs.get(this.order[i]); if (d.modal && !d.hidden) return d; } return null; }
  // teclado para los cuadros con campos de texto (Win.key); true = consumida (el controlador no la usa para moverse)
  key(e) {
    for (let i = this.order.length - 1; i >= 0; i--) { const d = this.dialogs.get(this.order[i]); if (d.key && !d.hidden && d.key(e, this)) return true; if (d.modal) return true; }
    return false;
  }
  // Bolas de cerrar (derecha) y minimizar (izquierda) para los cuadros con marco propio (no Win): mecanismo común de window.js
  legacyFrame(d) { return !d.ball && !d.modal && !d.fixed && !d.nox && !this.mobile && (d.lmin || d.w >= 150); }
  ballHit(d, lx, ly) {
    if (Math.hypot(lx - (d.w - 9), ly - 9) <= 8) return "x";
    if (!d.lmin && !d.nomin && Math.hypot(lx - 9, ly - 9) <= 8) return "-";
    if (d.lmin && Math.hypot(lx - 13, ly - d.h / 2) <= 8) return "o";
    return null;
  }
  legacyMin(d) {
    if (d.lmin) { d.w = d.lmin.w; d.h = d.lmin.h; d.lmin = null; return; }
    d.lmin = { w: d.w, h: d.h }; d.w = 170; d.h = 26;
  }
  drawBall(cx, cy, glyph) { drawFrameBall(this.ctx, cx, cy, glyph, Math.hypot(this.mouse.x - this.cur.x - cx, this.mouse.y - this.cur.y - cy) <= 8); }
  frameBalls(d) { this.cur = d; this.drawBall(d.w - 9, 9, "x"); if (!d.nomin) this.drawBall(9, 9, "-"); }
  minBar(d) {
    const c = this.ctx; this.cur = d;
    c.fillStyle = "#2a2118"; c.fillRect(0, 0, d.w, d.h); c.strokeStyle = "#c9a95c"; c.strokeRect(.5, .5, d.w - 1, d.h - 1);
    this.drawBall(13, d.h / 2, "o"); this.drawBall(d.w - 13, d.h / 2, "x");
    this.aligned(24, d.w - 24, 7, d.title || LEGACY_TITLES[d.id] || "", "#f0e2bd", { bold: true, size: 11 });
  }
  dialogAt(x, y) {
    const m = this.modal();
    if (m) return x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h ? m : null;
    for (let i = this.order.length - 1; i >= 0; i--) {
      const d = this.dialogs.get(this.order[i]);
      if (d.hidden) continue;
      if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
    }
    return null;
  }
  // ¿está el puntero sobre la interfaz (y no sobre el mundo)?
  over(cx, cy) {
    const [x, y] = this.toGui(cx, cy);
    return this.modal() !== null || this.dialogAt(x, y) !== null || !this.mobile && y >= 548 - 0 && y < H && x >= 0 && x < W;
  }

  // ---------------------------------------------------------------- ratón
  move(cx, cy) {
    const [x, y] = this.toGui(cx, cy);
    this.mouse.x = x; this.mouse.y = y;
    if (this.cap) this.cap.fn(x, y);
    if (this.drag) {
      const d = this.dialogs.get(this.drag.id);
      const f = this.full || this.rect, vl = (f.x - this.rect.x) / this.scale, vr = (f.x + f.w - this.rect.x) / this.scale;   // bordes del navegador en coordenadas GUI
      d.x = Math.max(vl + 60 - d.w, Math.min(vr - 60, x - this.drag.dx));   // se puede arrastrar hasta el borde exacto del navegador (queda a la vista un asa de 60 px)
      d.y = Math.max(0, Math.min(this.H - 52 - 20, y - this.drag.dy));   // hasta el borde de la pantalla; por abajo la barra inferior (52 px) tapa la ventana, así que el asa se detiene justo encima
    }
  }
  // devuelve true si la interfaz se queda con el clic
  down(cx, cy, button, me) {
    const [x, y] = this.toGui(cx, cy);
    this.mouse.x = x; this.mouse.y = y; this.mouse.down = true;
    if (this.item) this.item = null;                                // por si quedó uno pegado
    const d = this.dialogAt(x, y);
    if (!d && this.modal()) return true;
    if (d) {
      if (button === 2 && d.modal) return true;
      if (button === 2) { if (!d.fixed) this.close(d.id); return true; }      // clic derecho: cierra el cuadro
      this.front(d.id);
      const now = performance.now(), dbl = button === 0 && this.lastClick && this.lastClick.id === d.id && now - this.lastClick.t < 400 && Math.hypot(x - this.lastClick.x, y - this.lastClick.y) < 6;
      this.lastClick = { id: d.id, t: now, x, y };
      if (dbl && d.dbl?.(this, x - d.x, y - d.y, me)) { this.lastClick = null; return true; }
      if (button === 0 && d.press?.(this, x - d.x, y - d.y, me)) return true;       // empieza a arrastrar un objeto
      if (button === 0 && this.legacyFrame(d)) { const r = this.ballHit(d, x - d.x, y - d.y); if (r) { this.onSound?.(14); if (r === "x") this.close(d.id); else this.legacyMin(d); return true; } }
      const used = (button === 0 && d.lmin) ? false : button === 0 && d.click?.(this, x - d.x, y - d.y, me, { button });
      if (used) this.onSound?.(14);
      if (!used && button === 0 && !d.fixed && !this.mobile) this.drag = { id: d.id, dx: x - d.x, dy: y - d.y };
      return true;
    }
    if (me && button === 0 && x >= 720 && x <= 780 && y >= 510 && y <= 525) {      // "Level Up!" / "Restart"
      if (me.dead) this.onAction?.("restart"); else if (me.pool > 0) this.toggle(12);
      return true;
    }
    if (this.petBall && button === 0 && x >= 103 && x <= 204 && y >= 515 && y <= 538) { this.onAction?.("petname"); return true; }   // clic en el nombre del compañero: renombrar
    if (!this.mobile && y >= 548 && y < H) { if (button === 0) this.panelClick(x, y, me); return true; }
    return false;
  }
  // rueda del ratón: la recibe el cuadro de arriba bajo el cursor (p. ej. círculos de magia). true = consumida
  wheel(cx, cy, dy) {
    const [x, y] = this.toGui(cx, cy), d = this.dialogAt(x, y);
    if (d && d.wheel) { d.wheel(this, dy < 0 ? 1 : -1); return true; }
    return !!d || !!this.modal();
  }
  cancelDrag() { this.mouse.down = false; this.drag = null; this.cap = null; this.item = null; }
  up(cx, cy) {
    this.mouse.down = false; this.drag = null; this.cap = null;
    if (this.item) {
      const it = this.item; this.item = null;
      if (cx !== undefined) { const [x, y] = this.toGui(cx, cy); this.mouse.x = x; this.mouse.y = y; }
      this.onItemDrop?.(it, this.mouse.x, this.mouse.y, this.dialogAt(this.mouse.x, this.mouse.y), cx, cy);
    }
  }

  // clic en el panel de iconos (DlgBoxClick_IconPannel)
  panelClick(x, y) {
    const a = ADDX + RESX;
    if (y <= 434 + RESY || y >= 475 + RESY) return;
    if (this.petBall && x > 322 + a && x < 360 + a) this.onAction?.("petmode");
    else if (x > 362 + a && x < 404 + a) this.onAction?.("combat");
    else if (x > 413 + a && x < 447 + a) this.onAction?.("char");
    else if (x > 447 + a && x < 484 + a) this.onAction?.("inv");
    else if (x > 484 + a && x < 521 + a) this.onAction?.("book");        // BUG-014: el libro de hechizos vuelve a su puesto original
    else if (x > 521 + a && x < 558 + a) this.onAction?.("skill");
    else if (x > 558 + a && x < 595 + a) this.onAction?.("chat");
    else if (x > 595 + a && x < 631 + a) this.onAction?.("sys");
    else if (x > 632 + a && x < 669 + a) this.onAction?.("pets");
    else if (x > 670 + a && x < 707 + a) this.onAction?.("quests");        // Misiones (ticket 6): botón propio, ya no cuelga del cuadro de personaje        // «Summons» y «Recall» (inventos del port) van tras el menú del sistema
  }

  // ---------------------------------------------------------------- fotograma
  draw(me, world, info = {}) {
    if (!this.ready) return;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
    const f = this.full || this.rect, k = this.scale * this.dpr;
    c.setTransform(k, 0, 0, k, (this.rect.x - f.x) * this.dpr, (this.rect.y - f.y) * this.dpr);
    c.imageSmoothingEnabled = false;
    this.tips = [];
    this.info = info;
    if (me && !this.mobile) { this.gauges(me, world, info); this.partyLayer(me, world); if (info?.statusPanel) this.statusPanel(me, world); }          // en móvil las barras y botones son DOM (mobile.js)
    for (const id of this.order) { const d = this.dialogs.get(id); if (this.mobile && d.mobileFixed) d.layout?.(this); }
    for (const id of this.order) {
      const d = this.dialogs.get(id);
      if (d.hidden) continue;
      if (d.modal) { c.fillStyle = "rgba(0,0,0,.45)"; const f = this.full || this.rect, o = this.scale; c.fillRect((f.x - this.rect.x) / o, (f.y - this.rect.y) / o, f.w / o, f.h / o); }
      c.save(); c.translate(d.x, d.y);
      c.beginPath(); c.rect(0, 0, d.w, d.h); c.clip();
      if (d.lmin) this.minBar(d); else { d.draw(this, me, world); if (this.legacyFrame(d)) this.frameBalls(d); }
      c.restore();
    }
    if (this.item) this.item.draw(this, this.mouse.x, this.mouse.y);
    this.itemTooltip(me);
    for (const [x, y, s] of this.tips) this.text(x, y, s, "#fafadc", { shadow: true });
    if (info.cursor !== undefined && this.mouse.x >= 0) this.put("interface_0", info.cursor, this.mouse.x, this.mouse.y);   // cursor del cliente original
  }

  // estadísticas del objeto que se arrastra o sobre el que está el cursor
  itemTooltip(me) {
    const uid = this.item ? this.item.uid : this.hoverUid, def = this.hoverDef;
    this.hoverUid = null; this.hoverDef = null;
    if (!me) return;
    const info = uid ? (this.describe && this.describe(uid)) : (def && this.describeDef && this.describeDef(def));
    if (!info) return;
    // Ficha estilo Olympia (ticket 14): cabecera con el nombre (color de rareza) y el icono, la estadística principal (daño/defensa) destacada,
    // las bonificaciones en verde y, tras una línea fina, los datos secundarios (peso, fuerza, durabilidad) atenuados.
    const c = this.ctx, MAIN = /^(Daño|Defensa|Damage|Defense)/, SUB = /^(Peso|Weight|Fuerza necesaria|Required strength)/;
    const main = [], body = [], sub = [];
    for (const l of info.lines) {
      const r = { t: l.t, c: l.c || "#e8e8d0" };
      if (MAIN.test(l.t) && !l.c) { r.c = "#fff2c0"; r.big = true; main.push(r); }
      else if (SUB.test(l.t) && !l.c) { r.c = "#a89f88"; sub.push(r); }
      else body.push(r);
    }
    const hdrH = Math.max(24, info.sprite ? 44 : 0), pad = info.sprite ? 46 : 0, RH = 14;
    c.font = "bold 13px Tahoma, Verdana, sans-serif"; let tw = c.measureText(t(info.name)).width + pad;
    c.font = "12px Tahoma, Verdana, sans-serif"; for (const r of [...main, ...body, ...sub]) tw = Math.max(tw, c.measureText(t(r.t)).width + (r.big ? 8 : 0));
    const w = Math.ceil(tw) + 20, nRows = main.length + body.length + sub.length;
    const h = hdrH + 6 + (nRows ? nRows * RH + 4 : 0) + (sub.length && main.length + body.length ? 5 : 0) + 4;
    let x = this.mouse.x + 18, y = this.mouse.y + 14;
    if (x + w > this.W) x = this.mouse.x - w - 8;
    if (y + h > this.H) y = this.H - h;
    c.fillStyle = "rgba(10,8,4,.92)"; c.fillRect(x, y, w, h);
    const gr = c.createLinearGradient(x, y, x, y + hdrH); gr.addColorStop(0, "rgba(120,92,40,.75)"); gr.addColorStop(1, "rgba(50,36,14,.75)");
    c.fillStyle = gr; c.fillRect(x + 1, y + 1, w - 2, hdrH - 1);
    c.strokeStyle = "#b8964a"; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1);
    c.fillStyle = "rgba(184,150,74,.55)"; c.fillRect(x + 1, y + hdrH, w - 2, 1);
    if (info.sprite) this.putGame(info.sprite[0], info.sprite[1], x + 25, y + hdrH / 2 + 2);
    this.text(x + 8 + pad, y + Math.round((hdrH - 13) / 2), info.name, info.color || "#ffe9a0", { bold: true, size: 13, shadow: true });
    let ty = y + hdrH + 5;
    for (const r of [...main, ...body]) { this.text(x + 9, ty, r.t, r.c, r.big ? { bold: true } : {}); ty += RH; }
    if (sub.length) { if (main.length + body.length) { c.fillStyle = "rgba(184,150,74,.3)"; c.fillRect(x + 8, ty + 1, w - 16, 1); ty += 5; } for (const r of sub) { this.text(x + 9, ty, r.t, r.c); ty += RH; } }
  }

  // panel inferior (DrawDialogBox_IconPannel y DrawDialogBox_GaugePannel)
  // Compañero (invento del port): símbolo de paz/ataque junto al del personaje (clic = cambiar), miniatura que se vacía de arriba abajo
  // con su vida y una barra con su nombre y vida.
  // estado de la cripta, en letra del cliente (texto amarillo con sombra, como "Level Up!"/"Restart")
  dungeonInfo(world) {
    const map = world.map; if (!map || map.kind !== "dungeon") return;
    const remaining = map.remainingEnemies ?? [...world.ents.values()].filter(e => e.kind === "npc" && !e.comp && !e.dead).length;
    this.text(8, 26, "Crypt level " + map.level + " / " + map.total + (map.boss ? " - BOSS" : ""), "#fafadc", { shadow: true, bold: true });
    this.text(8, 40, remaining ? "Skeletons left: " + remaining + " / " + map.totalEnemies : (map.level >= map.total ? "Crypt cleared! Find the exit (E)." : "Level cleared! Take the portal down (E)."), remaining ? "#e5bca0" : "#9fe07f", { shadow: true });
  }

  petPanel(me, world, a) {
    const ball = me.bag && me.bag.find(i => i.comp && i.comp.on);
    this.petBall = ball || null;
    if (!ball) return;
    const c = ball.comp, pet = [...world.ents.values()].find(e => e.comp && e.master === me.id && !e.dead);
    const hp = pet ? pet.hp : Math.max(0, c.hp || 0), max = pet ? pet.maxHp : Math.max(1, c.max || 1), k = Math.max(0, Math.min(1, hp / Math.max(1, max)));
    const bx = 322 + a, by = 436 + RESY, cx = this.ctx, m = this.mouse, atk = c.mode !== "peace";
    cx.fillStyle = "rgba(10,8,4,.7)"; cx.fillRect(bx, by, 38, 38);
    cx.strokeStyle = atk ? "#c85a3c" : "#6fae5a"; cx.lineWidth = 1; cx.strokeRect(bx + .5, by + .5, 37, 37);
    const mi = this.spr && miniOf(c.sp, kk => this.spr.frames(kk), c.cls);
    const fr = mi && this.spr.frame(mi.key, mi.f);
    if (fr && this.spr.ready(mi.key)) {
      const [sx, sy, w, h] = fr, s = Math.min(1, 32 / Math.max(w, h)), dw = w * s, dh = h * s, dx = bx + 19 - dw / 2, dy = by + 19 - dh / 2;
      cx.globalAlpha = .28; cx.drawImage(this.spr.img[mi.key], sx, sy, w, h, dx, dy, dw, dh); cx.globalAlpha = 1;
      cx.save(); cx.beginPath(); cx.rect(dx, dy + dh * (1 - k), dw, dh * k + 1); cx.clip();      // lo que queda de vida: se pierde desde arriba
      cx.drawImage(this.spr.img[mi.key], sx, sy, w, h, dx, dy, dw, dh); cx.restore();
    }
    this.text(bx + 36, by + 25, atk ? "ATQ" : "PAZ", atk ? "#ff9a7a" : "#9fe07f", { align: "right", shadow: true, size: 9 });
    // barra de vida del compañero, sobre la del personaje
    const x0 = 23 + RESX, y0 = 531, wd = 101;
    cx.fillStyle = "rgba(10,8,4,.7)"; cx.fillRect(x0 - 1, y0 - 1, wd + 2, 8);
    cx.fillStyle = k > .5 ? "#4caf3a" : k > .25 ? "#d8a838" : "#d8503c"; cx.fillRect(x0, y0, Math.round(wd * k), 6);
    this.text(x0, y0 - 14, (c.nm || c.sp) + " nv " + c.lvl + "  " + Math.ceil(hp) + "/" + max, "#e8dcc3", { shadow: true, size: 11 });
    // experiencia del compañero (para tentar al jugador a subirlo): barra fina bajo la de vida y números en el aviso
    const nd = need(c.lvl || 1), ek = c.lvl >= MAX_LEVEL ? 1 : Math.max(0, Math.min(1, (c.exp || 0) / nd));
    cx.fillStyle = "rgba(10,8,4,.7)"; cx.fillRect(x0 - 1, y0 + 8, wd + 2, 5);
    cx.fillStyle = "#f0c040"; cx.fillRect(x0, y0 + 9, Math.round(wd * ek), 3);
    const mpMax = pet?.maxMp ?? pet?.maxMpC ?? c.mpMax ?? 0, mp = pet ? pet.mp ?? 0 : c.mp ?? 0;
    if (mpMax > 0) {                                                       // maná del compañero (las escuelas dependen de él)
      cx.fillStyle = "rgba(10,8,4,.7)"; cx.fillRect(x0 - 1, y0 + 14, wd + 2, 6);
      cx.fillStyle = "#b070f0"; cx.fillRect(x0, y0 + 15, Math.round(wd * Math.max(0, Math.min(1, mp / mpMax))), 4);
      if (m.x > x0 && m.x < x0 + wd && m.y > y0 + 13 && m.y < y0 + 21) this.tip((c.nm || c.sp) + " MP " + Math.floor(mp) + "/" + mpMax);
    }
    const expTxt = c.lvl >= MAX_LEVEL ? "EXP MAX" : "EXP " + (c.exp || 0) + "/" + nd + " (" + Math.floor(ek * 100) + "%)";
    if (m.x > x0 && m.x < x0 + wd && m.y > y0 + 6 && m.y < y0 + 14) this.tip((c.nm || c.sp) + " lv " + c.lvl + "  " + expTxt);
    else if (m.x > bx && m.x < bx + 38 && m.y > by && m.y < by + 38) this.tip((c.nm || c.sp) + ": " + (atk ? "Attack" : "Peace") + " (click)");
    else if (m.x > x0 && m.x < x0 + wd && m.y > y0 - 14 && m.y < y0 + 8) this.tip((c.nm || c.sp) + " " + Math.ceil(hp) + "/" + max + " (click: rename)");
  }

  // huella de garra en azul: el marrón de la hoja se confundía con la mochila (dos «bolsas» en la barra)
  summonsIcon(f, x) {
    // el marco (borde naranja del hover, como el resto de la barra) va sin teñir; solo la huella se tiñe de verde (nunca turquesa)
    const c = this.ctx; this.put("summons_icon", f, x, 554);
    c.save(); c.beginPath(); c.rect(x + 8, 554 + 8, 22, 24); c.clip();
    c.filter = "hue-rotate(95deg) saturate(1.5) brightness(1.1)"; this.put("summons_icon", f, x, 554); c.restore();
  }

  // Botón de Misiones (ticket 6): mismo marco que «Summons», teñido de dorado y con un «!» encima
  questIcon(f, x) {
    // pergamino enrollado con degradados y contorno oscuro, la misma paleta que las bolas del marco y el resto de la barra (plata/marrón/oro)
    const c = this.ctx; this.put("summons_icon", f, x, 554);
    c.save(); c.beginPath(); c.rect(x + 8, 554 + 8, 22, 24); c.clip();
    const g = c.createLinearGradient(x + 8, 0, x + 30, 0); g.addColorStop(0, "#8c7440"); g.addColorStop(0.5, "#f1e6c2"); g.addColorStop(1, "#8c7440");
    c.fillStyle = "#1d1608"; c.fillRect(x + 8, 554 + 8, 22, 24);
    c.fillStyle = g; c.fillRect(x + 11, 554 + 12, 16, 16);
    c.strokeStyle = "#2a2014"; c.lineWidth = 1; c.strokeRect(x + 11.5, 554 + 12.5, 15, 15);
    for (const yy of [554 + 11, 554 + 28]) { // rollos superior e inferior
      const r = c.createLinearGradient(0, yy - 2, 0, yy + 2); r.addColorStop(0, "#f4f2ee"); r.addColorStop(0.5, "#b9b4aa"); r.addColorStop(1, "#4d463c");
      c.fillStyle = r; c.fillRect(x + 9, yy - 2, 20, 4); c.strokeRect(x + 9.5, yy - 1.5, 19, 3);
    }
    c.fillStyle = "#3a2c14"; for (let i = 0; i < 3; i++) c.fillRect(x + 14, 554 + 16 + i * 3, 10 - (i === 2 ? 4 : 0), 1);
    c.fillStyle = "#6a1a10"; c.beginPath(); c.arc(x + 24, 554 + 24, 2.2, 0, 7); c.fill();
    c.restore();
  }

  // Botón «Recall» (invento del port): estado de la canalización y del enfriamiento (relojes del cliente; el servidor manda)
  recallEvent(ev) {
    const n = performance.now(), r = this.rc || (this.rc = { ch: 0, cd: 0, chMs: 3000 });
    if (ev.t === "recalling") { r.ch = n + ev.ms; r.chMs = ev.ms; }
    else if (ev.t === "recalled") { r.ch = 0; r.cd = n + 60000; }
    else if (ev.t === "recallfail") r.ch = 0;
  }

  // Los marcos de grupo van pegados al borde izquierdo de la VENTANA (bajo el rótulo de fps), no al del lienzo 800x600 (que se centra
  // con bandas laterales en pantallas anchas): tienen su propio lienzo, a la izquierda del todo.
  partyLayer(me, world) {
    let pf = this.pf;
    if (!pf) {
      pf = this.pf = document.createElement("canvas");
      pf.style.cssText = "position:fixed;left:0;pointer-events:none;z-index:" + (this.cv.style.zIndex || 5);
      this.cv.insertAdjacentElement("afterend", pf);
    }
    const w = Math.ceil(230 * this.scale), h = Math.ceil(420 * this.scale);
    pf.style.top = this.rect.y + "px"; pf.style.width = w + "px"; pf.style.height = h + "px";
    const pw = Math.round(w * this.dpr), ph = Math.round(h * this.dpr);
    if (pf.width !== pw || pf.height !== ph) { pf.width = pw; pf.height = ph; }
    const main = this.ctx, g = pf.getContext("2d");
    g.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, 0, 0); g.clearRect(0, 0, 230, 420);
    this.ctx = g;
    try { this.partyFrames(me, world); } finally { this.ctx = main; }
  }
  // Marcos de grupo a la izquierda (como en WoW): nombre y barra de vida de cada miembro y, debajo, la de su compañero
  partyFrames(me, world) {
    if (!me.party || !world) return;
    const c = this.ctx, ents = [...world.ents.values()];
    let y = world.map?.kind === "dungeon" ? 58 : 30;                          // justo debajo del rótulo "Remastered · fps · versión" (y≈14); en las criptas, bajo el contador
    const bar = (x, y, w, h, cur, max, col) => {
      const k = Math.max(0, Math.min(1, cur / Math.max(1, max)));
      c.fillStyle = "rgba(0,0,0,.7)"; c.fillRect(x - 1, y - 1, w + 2, h + 2);
      c.fillStyle = col(k); c.fillRect(x, y, Math.round(w * k), h);
    };
    const hpCol = k => k > 0.5 ? "#4caf3a" : k > 0.25 ? "#d9a62e" : "#d6382b", mpCol = () => "#3f7fe0";
    const kindOf = pet => pet.dcls ? DUMMY_NAMES[pet.dcls] : SCHOOL_OF[pet.name] ? SCHOOL_NAMES[SCHOOL_OF[pet.name]] + " school" : CLS_OF[pet.name] ? "Support" : "Combat";
    for (const name of [me.name, ...me.party.names.filter(n => n !== me.name)]) {
      const m = name === me.name ? me : ents.find(e => e.kind === "player" && e.name === name);
      const lv = m === me ? me.level : (m?.level || me.party.lvls?.[me.party.names.indexOf(name)] || 0);
      this.text(10, y, name + (lv ? "  Lv " + lv : ""), m ? "#fafadc" : "#8a8a8a", { shadow: true });
      if (m) {
        bar(10, y + 14, 96, 8, m.dead ? 0 : m.hp, m.maxHp, hpCol); this.text(112, y + 11, m.dead ? "dead" : m.hp + "/" + m.maxHp, "#e8e8d0", { shadow: true, size: 10 });
        if (m.maxMp) { bar(10, y + 25, 96, 5, m.mp, m.maxMp, mpCol); this.text(112, y + 23, Math.floor(m.mp) + "/" + m.maxMp, "#9fc2ff", { shadow: true, size: 9 }); }
      } else this.text(10, y + 14, me.party.maps?.[me.party.names.indexOf(name)] || "?", "#8a8a8a", { shadow: true, size: 10 });         // nombre del mapa donde está
      y += m && m.maxMp ? 38 : 28;
      const pet = m && ents.find(e => e.comp && e.master === m.id && !e.dead);
      if (pet) {
        const pm = pet.maxMp ?? pet.maxMpC ?? 0;
        this.text(16, y - 3, (pet.nick || pet.name) + "  " + shown(pet.name) + " Lv " + (pet.clvl || 1), "#c9d8ff", { shadow: true, size: 10 });
        this.text(16, y + 8, kindOf(pet), "#8fa6d8", { shadow: true, size: 9 });
        bar(16, y + 19, 70, 5, pet.hp, pet.maxHp, hpCol); this.text(92, y + 18, Math.ceil(pet.hp) + "/" + pet.maxHp, "#e8e8d0", { shadow: true, size: 9 });
        if (pm) { bar(16, y + 27, 70, 4, pet.mp ?? 0, pm, mpCol); this.text(92, y + 26, Math.floor(pet.mp ?? 0) + "/" + pm, "#9fc2ff", { shadow: true, size: 9 }); }
        y += pm ? 40 : 32;
      }
      y += 8;
    }
  }

  // Panel de estados (derecha, bajo el minimapa): DR / MR del personaje con lo que le suman los buffs, y cada buff o aura con su temporizador.
  statusPanel(me, world) {
    if (me.dead) return;
    const c = this.ctx, now = world.time, left = u => (u == null ? Infinity : (u - now) / 1000);
    const fmt = s => s === Infinity ? "∞" : s >= 60 ? Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0") : Math.ceil(s) + "s";
    const rows = [], st = me.st || {}, au = me.aura && me.aura.until > now ? me.aura : null;
    let drBonus = 0, magRed = 0, dmgRed = 0;
    const add = (name, eff, secs, col) => rows.push({ name, eff, secs, col });
    const pr = st.protect && left(st.protect.until) > 0 ? st.protect.v : 0;
    if (pr === 3 || pr === 4) drBonus += pr === 3 ? 40 : 100;
    if (pr) add(({ 1: "Protection From Arrows", 2: "Protection From Magic", 3: "Defense Shield", 4: "Great Defense Shield", 5: "Absolute Magic Protection" })[pr] || "Protection", pr === 3 ? "DR +40" : pr === 4 ? "DR +100" : pr === 1 ? "arrows blocked" : "magic resisted", left(st.protect.until), "#7fd4ff");
    if (st.pfm && left(st.pfm.until) > 0) { magRed = st.pfm.v; add("Protection From Magic", "magic dmg -" + st.pfm.v + "%", left(st.pfm.until), "#b9a3ff"); }
    if (st.berserk && left(st.berserk.until) > 0) add("Berserk", "damage x2", left(st.berserk.until), "#ff9a6a");
    if (st.invis && left(st.invis.until) > 0) add("Invisibility", "unseen", left(st.invis.until), "#d8d8d8");
    for (const [k, nm, e] of [["hold", "Paralyzed", "can't move"], ["ice", "Frozen", "can't move"], ["confuse", "Confused", "random moves"], ["illusion", "Illusion", "random moves"], ["armorbreak", "Armor Break", "damage taken +25%"], ["inhibit", "Inhibited", "can't cast"], ["poison", "Poisoned", "losing HP"]]) if (st[k] && left(st[k].until) > 0) add(nm, e, left(st[k].until), "#ff6a6a");
    if (au) {
      const t = Math.max(0, (au.until - now) / 1000), by = (au.by || "Aura Summon") + (au.x2 ? " x2" : "");
      if (au.def) { dmgRed = au.def; add("Defense Aura", "damage taken -" + au.def + "%", t, "#8fd68f"); }
      if (au.vamp) add("Vampiric Aura", "heal " + au.vamp + "% of damage", t, "#e07a9a");
      if (au.regen) add("Regeneration Aura", "+" + au.regen + "% HP/s", t, "#8fd68f");
      if (au.mana) add("Mana Aura", "+" + au.mana + "% MP/s", t, "#7fa6ff");
      if (au.sta) add("Stamina Aura", "+" + au.sta + "% SP/s", t, "#e8d66a");
      if (au.exp) add("Wisdom Aura", "+" + au.exp + "% exp", t, "#e8b86a");
      rows.auraBy = by;
    }
    const fx = me.eff || {}, dr = (fx.defense ?? 0), mr = (fx.resistMagic ?? 0);
    const W = 190, x = this.W - W - 8, h = 8 + 28 + rows.length * 22 + (rows.auraBy ? 14 : 0);
    c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(x, 160, W, h);
    let y = 164;                                                       // bajo el minimapa (arriba a la derecha)
    this.text(x + 6, y, "DR " + (dr + drBonus) + (drBonus ? " (+" + drBonus + ")" : ""), drBonus ? "#7fd4ff" : "#fafadc", { shadow: true, size: 11 });
    this.text(x + 96, y, "MR " + mr, "#fafadc", { shadow: true, size: 11 }); y += 14;
    this.text(x + 6, y, "Dmg taken " + (dmgRed ? "-" + dmgRed + "%" : "0%") + "   Magic -" + magRed + "%", dmgRed || magRed ? "#8fd68f" : "#9a9a8a", { shadow: true, size: 10 }); y += 14;
    for (const r of rows) {
      this.text(x + 6, y, r.name, r.col, { shadow: true, size: 10 }); this.text(x + W - 6, y, fmt(r.secs), r.secs < 5 ? "#ff8a6a" : "#fafadc", { shadow: true, size: 10, align: "right" }); y += 10;
      this.text(x + 14, y, r.eff, "#c8c8b0", { shadow: true, size: 9 }); y += 12;
    }
    if (rows.auraBy) this.text(x + 6, y + 2, "Aura of " + rows.auraBy, "#8fa6d8", { shadow: true, size: 9 });
  }

  // Remastered (ticket 11; v0.85: antes repetía una sola columna y salían rayas estiradas): la barra inferior se prolonga hasta los bordes de la pantalla
  // repitiendo, en espejo y sin costuras, los 72 px lisos de cada extremo de la barra (a escala, sin deformar).
  edgeFill() {
    const m = this.manifest && this.manifest.gamedialog2_6, fr = m && m.frames[14], o = this.img.gamedialog2_6;
    this.edges ||= [0, 1].map(() => { const e = document.createElement("canvas"); e.style.cssText = "position:absolute;pointer-events:none;z-index:" + (this.cv.style.zIndex || 1); this.cv.parentNode.insertBefore(e, this.cv); return e; });
    const r = this.rect, host = this.cv.parentNode.getBoundingClientRect(), side = this.mobile || !this.spr?.hd || !fr || !o?.naturalWidth ? 0 : Math.max(0, (r.x - host.left));
    const [sx, sy, sw, sh, px, py] = fr || [0, 0, 0, 0, 0, 0], SEG = 72;
    this.edges.forEach((e, i) => {
      if (side < 1) { e.style.display = "none"; return; }
      const w = Math.ceil(side), h = Math.ceil(sh * this.scale), key = w + "x" + h + (this.spr?.hd ? "h" : "");
      e.style.display = "block"; e.style.width = w + "px"; e.style.height = h + "px"; e.style.top = (r.y - host.top + (548 + py) * this.scale) + "px";
      e.style.left = (i ? r.x - host.left + r.w : 0) + "px";
      if (e._k === key) return; e._k = key; e.width = w; e.height = h;
      const c = e.getContext("2d"), T = SEG * this.scale, src = i ? sx + sw - SEG : sx;
      for (let k = 0; k * T < w; k++) {                                       // baldosa k a partir del borde de la barra; las pares van en espejo
        const d0 = Math.round(k * T), d1 = Math.round((k + 1) * T) + 1, x0 = i ? d0 : w - d1 + 1, flip = k % 2 === 0;
        c.save(); if (flip) { c.translate(x0 + d1 - d0, 0); c.scale(-1, 1); c.drawImage(o, src, sy, SEG, sh, 0, 0, d1 - d0, h); } else c.drawImage(o, src, sy, SEG, sh, x0, 0, d1 - d0, h); c.restore();
      }
    });
  }

  gauges(me, world, info) {
    const m = this.mouse, a = RESX + ADDX;
    this.put("gamedialog2_6", 14, 0, 548);
    this.edgeFill();
    // barras: se recorta el fotograma "vacío" desde la izquierda según lo que falta
    const bar = (cur, max, full) => Math.max(0, Math.min(full, full - Math.floor(cur * full / Math.max(1, max))));
    this.put("gamedialog2_6", 12, 23 + RESX, 437 + RESY, bar(me.hp, me.maxHp, 101));
    this.put("gamedialog2_6", 12, 23 + RESX, 459 + RESY, bar(me.mp, me.maxMp, 101));
    this.put("gamedialog2_6", 13, 147 + RESX, 434 + RESY, bar(me.sp, me.maxSp, 167));
    const need = me.nextExp - me.prevExp;
    this.put("gamedialog2_6", 18, 0, 427 + RESY + 2, Math.max(0, Math.min(799, Math.floor((me.exp - me.prevExp) * 799 / Math.max(1, need)))));
    this.put("gamedialog2_6", 17, 401, 558, Math.max(0, Math.min(35, 35 - Math.floor(me.hunger * 35 / 100))), true);
    this.num(80 + RESX, 441 + RESY, me.hp);
    this.num(80 + RESX, 463 + RESY, me.mp);
    this.num(228 + RESX, 435 + RESY, me.sp);

    if (me.dead) this.blink(725, 510, "Restart");
    else if (me.pool > 0 && !this.isOpen(12)) this.blink(725, 510, "Level Up!");

    this.petPanel(me, world, a);
    this.dungeonInfo(world);
    if (this.flags.safe) this.put("gamedialog2_6", 4, 368 + a - 2, 440 + RESY);
    else if (this.flags.combat) this.put("gamedialog2_6", 5, 368 + a - 1, 440 + RESY);
    // contador de críticos junto al indicador paz/ataque (Game.cpp, DrawDialogBoxs final: maestría 100 = número claro; menos = oscuro)
    const crit100 = (me.skills?.[me.eff?.wtype === 0 ? 5 : me.eff?.skill] || 0) >= 100;
    if ((me.superAttack | 0) > 0 && crit100 && this.alt) this.put("gamedialog2_6", 3, 368 + a, 439 + RESY, null, false, 0.6);   // ALT pulsado: resalte (SPRID_INTERFACE_ND_ICONPANNEL frame 3, PutTransSprite en 368,439)
    if ((me.superAttack | 0) > 0) this.num(380 + a, 454 + RESY, me.superAttack, crit100 ? [220, 200, 200] : [10, 10, 10]);
    if (m.x > 362 + a && m.x < 404 + a && m.y > 434 + RESY && m.y < 475 + RESY) {
      this.put("gamedialog2_6", 16, 362 + a - 1, 434 + RESY);
      this.tip(this.flags.combat ? (this.flags.safe ? "Safe Attack" : "Attack") : "Peace");
    }
    const ctrl = info.ctrl;
    const hoverExp = m.x > 144 + a && m.x < 317 + a && m.y > 434 + RESY && m.y < 477 + RESY;   // original DrawDialogBox_... "Required Exp" (Game.cpp: texto 250,250,220 al pasar por la barra central)
    const mid = (ctrl || hoverExp) ? "Required Exp: " + Math.max(0, me.nextExp - me.exp) : (world.map?.name || "") + " (" + me.x + "," + me.y + ")";
    this.aligned(140 + RESX + 1, 323 + RESX + 1, 456 + RESY + 1, mid, "#000");
    this.aligned(140 + RESX, 323 + RESX, 456 + RESY, mid, "#fafadc");

    if (m.y > 436 + RESY && m.y < 478 + RESY) {
      const icons = [[410, 6, 2, "Character Menu"], [447, 7, 1, "Inventory"], [484, 8, 1, "Spell Book"], [521, 9, 1, "Skill List"], [558, 10, 0, "Chat History"], [595, 11, 1, "Options"], [632, -1, 0, "Summons"], [670, -2, 0, "Quests"]];
      for (const [x0, f, dx, name] of icons) {
        if (m.x > x0 + a && m.x < x0 + 37 + a) { if (f === -2) this.questIcon(1, x0 + a); else if (f < 0) this.summonsIcon(1, x0 + a); else this.put("gamedialog2_6", f, x0 + a + dx, 434 + RESY); this.tip(name, m.x - (f === 11 ? 20 : 10)); }
      }
    }
    this.summonsIcon(0, 632 + a); this.questIcon(0, 670 + a);
    if (m.x > 400 && m.x < 410 && m.y > 432 + RESY) this.tip("Hunger (" + (100 - me.hunger) + "%)", m.x - 20);
  }

  blink(x, y, s) {
    const v = Math.floor(performance.now() / 3) % 255;
    this.text(x, y, s, `rgb(${v},${v},0)`, { shadow: true, bold: true });
  }
}
