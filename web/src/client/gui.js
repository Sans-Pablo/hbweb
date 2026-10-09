// Interfaz del cliente original dibujada sobre un lienzo de 800x600 (los sprites salen de
// GameDialog.pak, GameDialog2.pak, DialogText.pak e interface2.pak; ver tools/convert_ui.py).
// Las posiciones son las de Client/Game.cpp (DrawDialogBox_IconPannel, DrawDialogBox_GaugePannel...).
// El panel inferior es el cuadro 30; los demás cuadros se registran en `dialogs` y se pueden arrastrar.
import { miniOf } from "./compicon.js";
import { t } from "./i18n.js";

export const W = 800, H = 600;
const RESX = 80, RESY = 120, ADDX = 10;            // desplazamientos del cliente modificado a 800x600
const DIGIT_SPACE = [6, 4, 6, 6, 6, 6, 6, 6, 6, 6, 6];   // __cSpace2

const NO_AVOID = new Set([10, 17, 20]);                  // chat, cantidad y menú de NPC: pequeños, pegados al cursor / abajo

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
  }

  async load() {
    this.manifest = await (await fetch("data/ui.json")).json();
    await Promise.all(Object.keys(this.manifest).map(k => new Promise(res => {
      const i = new Image();
      i.onload = i.onerror = res;
      i.src = "data/ui/" + this.manifest[k].png;
      this.img[k] = i;
    })));
  }
  get ready() { return !!this.manifest; }

  // coloca el lienzo sobre el área visible del juego (rect en píxeles CSS) y fija la escala 800x600
  place(rect, dpr) {
    this.dpr = dpr || 1;
    this.scale = Math.min(rect.w / W, rect.h / H);
    const cssW = W * this.scale, cssH = H * this.scale;
    this.rect = { x: rect.x + (rect.w - cssW) / 2, y: rect.y + rect.h - cssH, w: cssW, h: cssH };
    const s = this.cv.style;
    s.left = this.rect.x + "px"; s.top = this.rect.y + "px"; s.width = cssW + "px"; s.height = cssH + "px";
    const pw = Math.round(cssW * this.dpr), ph = Math.round(cssH * this.dpr);
    if (this.cv.width !== pw || this.cv.height !== ph) { this.cv.width = pw; this.cv.height = ph; }
  }

  // coordenadas de ventana (CSS) -> coordenadas 800x600
  toGui(cx, cy) { return [(cx - this.rect.x) / this.scale, (cy - this.rect.y) / this.scale]; }

  // ---------------------------------------------------------------- sprites del juego (item-pack...)
  setGameSprites(spr) { this.spr = spr; this._px = {}; }
  putGame(key, f, x, y, alpha = 1) {
    const fr = this.spr && this.spr.frame(key, f); if (!fr || !this.spr.ready(key)) return;
    const [sx, sy, w, h, px, py] = fr;
    if (alpha !== 1) this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(this.spr.img[key], sx, sy, w, h, x + px, y + py, w, h);
    if (alpha !== 1) this.ctx.globalAlpha = 1;
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
    const img = this.img[key]; if (!img || !img.naturalWidth) return;
    let [sx, sy, sw, sh, px, py] = fr;
    if (w !== null) { if (vertical) sh = Math.min(sh, w); else sw = Math.min(sw, w); }
    if (sw <= 0 || sh <= 0) return;
    const c = this.ctx;
    if (alpha !== 1) c.globalAlpha = alpha;
    c.drawImage(img, sx, sy, sw, sh, x + px, y + py, sw, sh);
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
    const m = this.manifest[key], fr = m.frames[f], img = this.img[key];
    if (!fr || !img || !img.naturalWidth) return;
    const [sx, sy, sw, sh, px, py] = fr;
    const t = this._t || (this._t = document.createElement("canvas")), g = t.getContext("2d");
    t.width = sw; t.height = sh;
    g.clearRect(0, 0, sw, sh);
    g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    g.fillRect(0, 0, sw, sh);
    this.ctx.drawImage(t, x + px, y + py);
  }

  // fotograma teñido multiplicando por un color CSS (aproxima PutSpriteRGB; p. ej. el pelo)
  mul(key, f, x, y, color) {
    const m = this.manifest[key], fr = m && m.frames[f], img = this.img[key];
    if (!fr || !img || !img.naturalWidth) return;
    const [sx, sy, sw, sh, px, py] = fr;
    const t = this._m || (this._m = document.createElement("canvas")), g = t.getContext("2d");
    t.width = sw; t.height = sh;
    g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, sw, sh);
    g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    g.globalCompositeOperation = "multiply"; g.fillStyle = color; g.fillRect(0, 0, sw, sh);
    g.globalCompositeOperation = "destination-in"; g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    this.ctx.drawImage(t, x + px, y + py);
  }

  // texto con la letra del cliente (GDI): sombra de 1 píxel opcional
  text(x, y, s, color = "#fafadc", { align = "left", shadow = false, bold = false, size = 12 } = {}) {
    const c = this.ctx;
    s = t(s);
    c.font = (bold ? "bold " : "") + size + "px Tahoma, Verdana, sans-serif";
    c.textBaseline = "top";
    c.textAlign = align;
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
  open(id) { if (!this.dialogs.has(id)) return; this.close(id, true); this.order.push(id); this.dialogs.get(id).onOpen?.(this); this.avoidOverlap(id); }
  // Al abrir un cuadro grande, se coloca en el hueco libre más cercano a su sitio si pisaría a otro ya abierto (los pequeños de cantidad/menú/chat se quedan donde el original los pone)
  avoidOverlap(id) {
    if (NO_AVOID.has(id)) return;
    const d = this.dialogs.get(id), others = this.order.filter(o => o !== id && !NO_AVOID.has(o)).map(o => this.dialogs.get(o));
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
  close(id, quiet) { const i = this.order.indexOf(id); if (i >= 0) { this.order.splice(i, 1); if (!quiet) this.dialogs.get(id).onClose?.(this); } }
  toggle(id) { if (this.isOpen(id)) this.close(id); else this.open(id); }
  closeAll() { for (const id of [...this.order]) this.close(id); }
  front(id) { const i = this.order.indexOf(id); if (i >= 0) { this.order.splice(i, 1); this.order.push(id); } }
  dialogAt(x, y) {
    for (let i = this.order.length - 1; i >= 0; i--) {
      const d = this.dialogs.get(this.order[i]);
      if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
    }
    return null;
  }
  // ¿está el puntero sobre la interfaz (y no sobre el mundo)?
  over(cx, cy) {
    const [x, y] = this.toGui(cx, cy);
    return this.dialogAt(x, y) !== null || y >= 548 - 0 && y < H && x >= 0 && x < W;
  }

  // ---------------------------------------------------------------- ratón
  move(cx, cy) {
    const [x, y] = this.toGui(cx, cy);
    this.mouse.x = x; this.mouse.y = y;
    if (this.drag) {
      const d = this.dialogs.get(this.drag.id);
      d.x = Math.max(0, Math.min(W - d.w, x - this.drag.dx));
      d.y = Math.max(0, Math.min(H - 52 - 20, y - this.drag.dy));
    }
  }
  // devuelve true si la interfaz se queda con el clic
  down(cx, cy, button, me) {
    const [x, y] = this.toGui(cx, cy);
    this.mouse.x = x; this.mouse.y = y; this.mouse.down = true;
    const d = this.dialogAt(x, y);
    if (d) {
      if (button === 2) { if (!d.fixed) this.close(d.id); return true; }      // clic derecho: cierra el cuadro
      this.front(d.id);
      const now = performance.now(), dbl = button === 0 && this.lastClick && this.lastClick.id === d.id && now - this.lastClick.t < 400 && Math.hypot(x - this.lastClick.x, y - this.lastClick.y) < 6;
      this.lastClick = { id: d.id, t: now, x, y };
      if (dbl && d.dbl?.(this, x - d.x, y - d.y, me)) { this.lastClick = null; return true; }
      if (button === 0 && d.press?.(this, x - d.x, y - d.y, me)) return true;       // empieza a arrastrar un objeto
      const used = button === 0 && d.click?.(this, x - d.x, y - d.y, me, { button });
      if (used) this.onSound?.(14);
      if (!used && button === 0 && !d.fixed) this.drag = { id: d.id, dx: x - d.x, dy: y - d.y };
      return true;
    }
    if (me && button === 0 && x >= 720 && x <= 780 && y >= 510 && y <= 525) {      // "Level Up!" / "Restart"
      if (me.dead) this.onAction?.("restart"); else if (me.pool > 0) this.toggle(12);
      return true;
    }
    if (this.petBall && button === 0 && x >= 103 && x <= 204 && y >= 515 && y <= 538) { this.onAction?.("petname"); return true; }   // clic en el nombre del compañero: renombrar
    if (y >= 548 && y < H) { if (button === 0) this.panelClick(x, y, me); return true; }
    return false;
  }
  // rueda del ratón: la recibe el cuadro de arriba bajo el cursor (p. ej. círculos de magia). true = consumida
  wheel(cx, cy, dy) {
    const [x, y] = this.toGui(cx, cy), d = this.dialogAt(x, y);
    if (d && d.wheel) { d.wheel(this, dy < 0 ? 1 : -1); return true; }
    return !!d;
  }
  up(cx, cy) {
    this.mouse.down = false; this.drag = null;
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
    if (this.petBall && x > 411 && x < 449) this.onAction?.("petmode");
    else if (x > 362 + a && x < 404 + a) this.onAction?.("combat");
    else if (x > 413 + a && x < 447 + a) this.onAction?.("char");
    else if (x > 447 + a && x < 484 + a) this.onAction?.("pets");        // botón nuevo «Summons» (en el puesto del antiguo inventario)
    else if (x > 484 + a && x < 521 + a) this.onAction?.("inv");
    else if (x > 521 + a && x < 558 + a) this.onAction?.("skill");
    else if (x > 558 + a && x < 595 + a) this.onAction?.("chat");
    else if (x > 595 + a && x < 631 + a) this.onAction?.("sys");
  }

  // ---------------------------------------------------------------- fotograma
  draw(me, world, info = {}) {
    if (!this.ready) return;
    const c = this.ctx;
    c.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.imageSmoothingEnabled = false;
    this.tips = [];
    this.info = info;
    if (me) this.gauges(me, world, info);
    for (const id of this.order) {
      const d = this.dialogs.get(id);
      c.save(); c.translate(d.x, d.y);
      c.beginPath(); c.rect(0, 0, d.w, d.h); c.clip();
      d.draw(this, me, world);
      c.restore();
    }
    if (this.item) this.item.draw(this, this.mouse.x, this.mouse.y);
    this.itemTooltip(me);
    for (const [x, y, s] of this.tips) this.text(x, y, s, "#fafadc", { shadow: true });
    if (info.cursor !== undefined && this.mouse.x >= 0) this.put("interface_0", info.cursor, this.mouse.x, this.mouse.y);   // cursor del cliente original
  }

  // estadísticas del objeto que se arrastra o sobre el que está el cursor
  itemTooltip(me) {
    const uid = this.item ? this.item.uid : this.hoverUid;
    this.hoverUid = null;
    if (!uid || !me || !this.describe) return;
    const info = this.describe(uid); if (!info) return;
    const c = this.ctx, rows = [[info.name, "#ffe9a0", true], ...info.lines.map(l => [l.t, l.c || "#e8e8d0", false])];
    c.font = "12px Tahoma, Verdana, sans-serif";
    const w = Math.max(...rows.map(r => c.measureText(r[0]).width)) + 14, h = rows.length * 14 + 10;
    let x = this.mouse.x + 18, y = this.mouse.y + 14;
    if (x + w > W) x = this.mouse.x - w - 8;
    if (y + h > H) y = H - h;
    c.fillStyle = "rgba(10,8,4,.88)"; c.fillRect(x, y, w, h);
    c.strokeStyle = "#8a7a4a"; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1);
    rows.forEach((r, i) => this.text(x + 7, y + 5 + i * 14, r[0], r[1], { bold: r[2] }));
  }

  // panel inferior (DrawDialogBox_IconPannel y DrawDialogBox_GaugePannel)
  // Compañero (invento del port): símbolo de paz/ataque junto al del personaje (clic = cambiar), miniatura que se vacía de arriba abajo
  // con su vida y una barra con su nombre y vida.
  petPanel(me, world, a) {
    const ball = me.bag && me.bag.find(i => i.comp && i.comp.on);
    this.petBall = ball || null;
    if (!ball) return;
    const c = ball.comp, pet = [...world.ents.values()].find(e => e.comp && e.master === me.id && !e.dead);
    const hp = pet ? pet.hp : Math.max(0, c.hp || 0), max = pet ? pet.maxHp : Math.max(1, c.max || 1), k = Math.max(0, Math.min(1, hp / Math.max(1, max)));
    const bx = 411, by = 436 + RESY, cx = this.ctx, m = this.mouse, atk = c.mode !== "peace";
    cx.fillStyle = "rgba(10,8,4,.7)"; cx.fillRect(bx, by, 38, 38);
    cx.strokeStyle = atk ? "#c85a3c" : "#6fae5a"; cx.lineWidth = 1; cx.strokeRect(bx + .5, by + .5, 37, 37);
    const mi = this.spr && miniOf(c.sp, kk => this.spr.frames(kk));
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
    cx.fillStyle = k > .5 ? "#6fcf4f" : k > .25 ? "#e3b341" : "#e0493b"; cx.fillRect(x0, y0, Math.round(wd * k), 6);
    this.text(x0, y0 - 14, (c.nm || c.sp) + " nv " + c.lvl + "  " + Math.ceil(hp) + "/" + max, "#e8dcc3", { shadow: true, size: 11 });
    if (m.x > bx && m.x < bx + 38 && m.y > by && m.y < by + 38) this.tip((c.nm || c.sp) + ": " + (atk ? "Attack" : "Peace") + " (click)");
    else if (m.x > x0 && m.x < x0 + wd && m.y > y0 - 14 && m.y < y0 + 8) this.tip((c.nm || c.sp) + " " + Math.ceil(hp) + "/" + max + " (click: rename)");
  }

  // Intercambia dos casillas de iconos de la barra (copia de la imagen horneada): el icono del libro de hechizos pasa a ser «Summons»
  // y el inventario ocupa su sitio a la derecha. El original no tiene este botón (invento del port).
  swapSlots(xa, xb) {
    const m = this.manifest && this.manifest.gamedialog2_6, img = this.img.gamedialog2_6, fr = m && m.frames[14];
    if (!fr || !img || !img.naturalWidth) return;
    const [sx, sy, , , px, py] = fr, w = 37, h = 41, k = 554 - 548 - py, c = this.ctx;
    c.drawImage(img, sx + (xb - px), sy + k, w, h, xa, 554, w, h);
    c.drawImage(img, sx + (xa - px), sy + k, w, h, xb, 554, w, h);
  }

  gauges(me, world, info) {
    const m = this.mouse, a = RESX + ADDX;
    this.put("gamedialog2_6", 14, 0, 548);
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
    this.swapSlots(447 + a, 484 + a);
    if (this.flags.safe) this.put("gamedialog2_6", 4, 368 + a - 2, 440 + RESY);
    else if (this.flags.combat) this.put("gamedialog2_6", 5, 368 + a - 1, 440 + RESY);
    if (m.x > 362 + a && m.x < 404 + a && m.y > 434 + RESY && m.y < 475 + RESY) {
      this.put("gamedialog2_6", 16, 362 + a - 1, 434 + RESY);
      this.tip(this.flags.combat ? (this.flags.safe ? "Safe Attack" : "Attack") : "Peace");
    }
    const ctrl = info.ctrl;
    const mid = ctrl ? "Rest Exp: " + Math.max(0, me.nextExp - me.exp) : (world.map?.name || "") + " (" + me.x + "," + me.y + ")";
    this.aligned(140 + RESX + 1, 323 + RESX + 1, 456 + RESY + 1, mid, "#000");
    this.aligned(140 + RESX, 323 + RESX, 456 + RESY, mid, "#c8c878");

    if (m.y > 436 + RESY && m.y < 478 + RESY) {
      const icons = [[410, 6, 2, "Character"], [447, 8, 0, "Summons"], [484, 7, 1, "Inventory"], [521, 9, 1, "Skills"], [558, 10, 0, "Chat Log"], [595, 11, 1, "System Menu"]];
      for (const [x0, f, dx, name] of icons) {
        if (m.x > x0 + a && m.x < x0 + 37 + a) { this.put("gamedialog2_6", f, x0 + a + dx, 434 + RESY); this.tip(name, m.x - (f === 11 ? 20 : 10)); }
      }
    }
    if (m.x > 400 && m.x < 410 && m.y > 432 + RESY) this.tip("Hunger (" + (100 - me.hunger) + "%)", m.x - 20);
  }

  blink(x, y, s) {
    const v = Math.floor(performance.now() / 3) % 255;
    this.text(x, y, s, `rgb(${v},${v},0)`, { shadow: true, bold: true });
  }
}
