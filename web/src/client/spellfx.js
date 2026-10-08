// Efectos de hechizos del cliente original (Game.cpp: bAddNewEffect, bEffectFrameCounter, DrawEffects).
// Los números de efecto son los mismos: 100 + número de hechizo = proyectil/aura del hechizo, y los
// bajos (5, 6, 7, 8, 9, 10, 11, 12, 15...) son explosiones y chispas. Sprites: data/fx.json (EFFECT*.PAK).
import { dirTo } from "../shared/const.js";

const rnd = n => Math.floor(Math.random() * n);

// CMisc::GetPoint: avanza `count` pasos de Bresenham desde (x0,y0) hacia (x1,y1); devuelve [x, y, error]
function getPoint(x0, y0, x1, y1, error, count) {
  if (x0 === x1 && y0 === y1) return [x0, y0, error];
  let dx = x1 - x0, dy = y1 - y0, xi = 1, yi = 1, rx = x0, ry = y0, n = 0;
  if (dx < 0) { xi = -1; dx = -dx; }
  if (dy < 0) { yi = -1; dy = -dy; }
  if (dx > dy) {
    for (let i = 0; i <= dx; i++) { error += dy; if (error > dx) { error -= dx; ry += yi; } rx += xi; if (++n >= count) break; }
  } else {
    for (let i = 0; i <= dy; i++) { error += dx; if (error > dy) { error -= dy; rx += xi; } ry += yi; if (++n >= count) break; }
  }
  return [rx, ry, error];
}

// parámetros de cada efecto: [fotograma máximo, ms por fotograma]
const SETUP = {
  4: [12, 100], 5: [11, 10], 6: [14, 10], 7: [5, 50], 8: [4, 30], 9: [14, 30], 10: [14, 10], 11: [8, 30], 12: [10, 30], 15: [16, 80],
  30: [15, 20], 31: [15, 20],
  100: [0, 20], 101: [14, 80], 110: [0, 20], 120: [0, 20], 121: [14, 80], 130: [0, 20], 137: [0, 20], 143: [7, 10],
  147: [0, 20], 156: [3, 130], 161: [0, 20],
};

export class SpellFx {
  constructor() {
    this.list = [];
    this.man = null;
    this.img = {};
    this.hook = null;                 // (sonido, x, y) -> reproducir
  }

  async load() {
    try { this.man = await (await fetch("data/fx.json")).json(); } catch { return; }
    for (const k of Object.keys(this.man)) { const i = new Image(); i.src = "data/fx/" + this.man[k].png; this.img[k] = i; }
  }

  // bAddNewEffect(tipo, x, y, dx, dy, fotograma inicial). Para los hechizos x,y y dx,dy son casillas.
  add(type, sx, sy, dx, dy, start = 0, v1 = 0) {
    const set = SETUP[type];
    if (!set) return null;
    const e = { type, sx, sy, dx, dy, v1, frame: start, max: set[0], ft: set[1], t: performance.now(), mx: sx, my: sy, rx: 0, ry: 0, err: 0, dir: 1 };
    switch (type) {
      case 100: case 110: case 120: case 130: case 137: case 161:
        e.mx = sx * 32 + 16; e.my = sy * 32 + 16 - 40; e.dir = dirTo(sx, sy, dx, dy) || 1;
        this.hook?.("E1", sx, sy);
        break;
      case 101: case 121: this.hook?.("E5", dx, dy); break;
      case 143: e.mx = sx * 32; e.my = sy * 32 - 50; e.rx = 5 - rnd(10); e.ry = 5 - rnd(10); this.hook?.("E40", dx, dy); break;
      case 147: case 156: break;
      case 9: e.rx = 6 - rnd(12); e.ry = -8 - rnd(6); break;
      case 11: e.rx = 6 - rnd(12); e.ry = -2 - rnd(4); break;
      case 12: e.rx = 8 - rnd(16); e.ry = 4 - rnd(12); break;
      case 5: case 30: case 31: this.hook?.("E4", sx / 32 | 0, sy / 32 | 0); break;
      case 4: break;
    }
    if (type === 15) e.ry = -1;
    this.list.push(e);
    return e;
  }

  // Un hechizo lanzado por la entidad en (cx,cy) contra la casilla (tx,ty).
  spell(id, cx, cy, tx, ty) {
    const t = id + 100;
    if (t === 147) { const e = this.add(147, cx, cy, tx, ty); if (e) { e.mx = cx * 32 + 16; e.my = cy * 32 - 24; } return; }
    if (t === 156) { this.add(156, cx, cy, tx, ty); return; }
    if (t === 143) { this.add(143, tx, ty, tx, ty); return; }
    if (t === 101 || t === 121) { this.add(t, tx, ty, tx, ty); return; }
    this.add(t, cx, cy, tx, ty);
  }

  // un paso del contador de fotogramas de un efecto
  step(e) {
    e.frame++;
    const near = (px, py) => Math.abs(e.mx - px) <= 2 && Math.abs(e.my - py) <= 2;
    const fly = () => { [e.mx, e.my, e.err] = getPoint(e.mx, e.my, e.dx * 32 + 16, e.dy * 32 + 16, e.err, 50); };
    const burst = (n, spread) => { for (let i = 0; i < n; i++) this.add(9, e.mx + spread / 2 - rnd(spread), e.my + spread / 2 - rnd(spread), 0, 0, -rnd(2)); };
    const end = () => { e.dead = true; };
    switch (e.type) {
      case 5: case 30: case 31:
        if (e.frame === 1) for (let i = 0; i < 5; i++) this.add(12, e.mx + 5 - rnd(10), e.my + 5 - rnd(10), 0, 0, -rnd(2));
        if (e.frame === 7) for (let i = 0; i < 3; i++) this.add(15, e.mx + 5 - rnd(10), e.my + 5 - rnd(10), 0, 0, 0);
        if (e.frame > e.max) end();
        break;
      case 6: if (e.frame === 1) burst(5, 10); if (e.frame >= e.max) end(); break;
      case 7: if (e.frame === 1) burst(3, 10); if (e.frame >= e.max) end(); break;
      case 9: case 11: e.mx += e.rx; e.my += e.ry; e.ry++; if (e.frame > e.max) end(); break;
      case 10: if (e.frame === 1) burst(11, 40); if (e.frame >= e.max) end(); break;
      case 12: e.mx += e.rx; e.my += e.ry; if (e.frame > e.max) end(); break;
      case 15: e.my += e.ry; if (e.frame > e.max) end(); break;
      case 100:
        fly(); this.add(8, e.mx + rnd(20) - 10, e.my + rnd(20) - 10, 0, 0, -rnd(4));
        if (near(e.dx * 32 + 16, e.dy * 32 + 16)) { this.add(7, e.dx * 32 + 16, e.dy * 32 + 16, 0, 0, 0); this.hook?.("E5", e.dx, e.dy); end(); }
        break;
      case 110:
        fly(); this.add(8, e.mx + rnd(20) - 10, e.my + rnd(20) - 10, 0, 0, -rnd(4)); this.add(8, e.mx + rnd(20) - 10, e.my + rnd(20) - 10, 0, 0, -rnd(4));
        if (near(e.dx * 32 + 16, e.dy * 32 + 16)) { this.add(6, e.dx * 32 + 16, e.dy * 32 + 16, 0, 0, 0); this.hook?.("E4", e.dx, e.dy); end(); }
        break;
      case 120:
        fly();
        if (near(e.dx * 32 + 16, e.dy * 32 + 16)) { this.add(5, e.dx * 32 + 16, e.dy * 32 + 16, 0, 0, 0); end(); }
        break;
      case 130:
        fly();
        if (near(e.dx * 32 + 16, e.dy * 32 + 16)) {
          const X = e.dx * 32 + 16, Y = e.dy * 32 + 16;
          this.add(5, X, Y, 0, 0, 0); this.add(5, X - 30, Y - 15, 0, 0, -7); this.add(5, X + 35, Y - 30, 0, 0, -5); this.add(5, X + 20, Y + 30, 0, 0, -3);
          end();
        }
        break;
      case 137:
        fly(); for (let i = 0; i < 3; i++) this.add(8, e.mx + rnd(20) - 10, e.my + rnd(20) - 10, 0, 0, -rnd(4));
        e.trail = e.trail || []; e.trail.unshift([e.mx, e.my]); e.trail.length = Math.min(e.trail.length, 6);
        if (near(e.dx * 32 + 16, e.dy * 32 + 16)) { this.add(10, e.dx * 32 + 16, e.dy * 32 + 16, 0, 0, 0); this.hook?.("E47", e.dx, e.dy); end(); }
        break;
      case 143:
        if (e.frame > e.max) { this.add(10, e.dx * 32 + 16, e.dy * 32 + 16, 0, 0, 0); end(); }
        break;
      case 147:
        this.add(110, e.sx, e.sy, e.dx - 1, e.dy - 1); this.add(110, e.sx, e.sy, e.dx + 1, e.dy - 1); this.add(110, e.sx, e.sy, e.dx + 1, e.dy + 1);
        this.add(7, e.dx * 32 + 16, e.dy * 32 + 16, 0, 0, 0); this.hook?.("E1", e.sx, e.sy);
        end();
        break;
      case 156:
        if (e.frame > e.max) end();
        else { this.add(137, e.sx, e.sy, e.dx, e.dy); this.hook?.("E1", e.sx, e.sy); }
        break;
      case 161:
        fly();
        if (near(e.dx * 32 + 16, e.dy * 32 + 16)) {
          const X = e.dx * 32 + 16, Y = e.dy * 32 + 16;
          this.add(30, X, Y, 0, 0, 0); this.add(31, X - 30, Y - 15, 0, 0, -7); this.add(31, X + 35, Y - 30, 0, 0, -5); this.add(31, X + 20, Y + 30, 0, 0, -3);
          end();
        }
        break;
      default: if (e.frame > e.max) end();
    }
  }

  // sprite `n` del cliente (m_pEffectSpr[n]); modo: "add" (aditivo), a = opacidad
  put(ctx, n, f, x, y, mode = "add", a = 1) {
    const key = "fx" + n, m = this.man && this.man[key], img = this.img[key];
    if (!m || !img || !img.naturalWidth) return;
    const fr = m.frames[Math.max(0, Math.min(m.frames.length - 1, f))];
    if (!fr) return;
    const [sx, sy, sw, sh, px, py] = fr;
    ctx.save();
    ctx.globalCompositeOperation = mode === "add" ? "lighter" : "source-over";
    ctx.globalAlpha = a;
    ctx.drawImage(img, sx, sy, sw, sh, Math.round(x + px), Math.round(y + py), sw, sh);
    ctx.restore();
  }

  update() {
    const now = performance.now();
    for (let guard = 0; guard < 400; guard++) {
      let any = false;
      for (const e of [...this.list]) {
        if (e.dead || now - e.t <= e.ft) continue;
        e.t = now; this.step(e); any = true;
      }
      void any; break;
    }
    this.list = this.list.filter(e => !e.dead);
  }

  draw(ctx, camX, camY) {
    if (!this.man) return;
    for (const e of this.list) {
      const f = e.frame, x = e.mx - camX, y = e.my - camY;
      switch (e.type) {
        case 4: if (f >= 0) this.put(ctx, 1, f, x, y - 40, "over"); break;
        case 5: if (f >= 0) this.put(ctx, 3, f, x, y); break;
        case 30: if (f >= 0) this.put(ctx, 14, f, x, y); break;
        case 31: if (f >= 0) this.put(ctx, 15, f, x, y); break;
        case 6: case 10: if (f >= 0) this.put(ctx, 6, f, x, y, "add", f < 6 ? 1 : Math.max(0, 1 - (f - 6) / 8)); break;
        case 7: if (f >= 0) this.put(ctx, 6, f, x, y, "add", f < 4 ? 1 : Math.max(0, 1 - (f - 4) / 2)); break;
        case 8: if (f >= 0 && 4 - f >= 0) this.put(ctx, 11, 4 - f, x, y); break;
        case 9: if (f >= 0) this.put(ctx, 11, rnd(5), x, y); break;
        case 11: if (f >= 0) this.put(ctx, 11, rnd(5) + 5, x, y); break;
        case 12: if (f >= 0) this.put(ctx, 11, rnd(6) + 10, x, y); break;
        case 15: if (f >= 0) this.put(ctx, 11, 33 + f, x, y, "over", .5); break;
        case 100: this.put(ctx, 0, 0, x, y); break;
        case 110: this.put(ctx, 0, 2 + rnd(4), x, y); break;
        case 120: case 130: case 161: this.put(ctx, 5, (e.dir - 1) * 4 + rnd(4), x, y); break;
        case 101: case 121: if (f >= 0) this.put(ctx, 50, f, e.dx * 32 + 16 - camX, e.dy * 32 + 16 - camY); break;
        case 137: {
          const al = [1, .7, .5, .5, .25, .25];
          (e.trail || []).slice(0, 5).forEach((p, i) => this.put(ctx, 10, (e.dir - 1) * 4 + rnd(4), p[0] - camX, p[1] - camY, "add", al[i + 1]));
          this.put(ctx, 10, (e.dir - 1) * 4 + rnd(4), x, y);
          break;
        }
        case 143: this.thunder(ctx, e.dx * 32 + 16 - camX, e.dy * 32 + 16 - camY, e.rx, e.ry); break;
      }
    }
  }

  // _DrawThunderEffect: rayo irregular desde 800 píxeles por encima del objetivo
  thunder(ctx, dX, dY, rX, rY) {
    const pts = [], n = 28;
    let seed = (rX + 20) * 131 + (rY + 20) * 17 + Math.floor(performance.now() / 40);
    const r = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    for (let i = 0; i <= n; i++) {
      const k = i / n, amp = i === n ? 0 : 22 * Math.sin(Math.PI * Math.min(1, k * 1.15));
      pts.push([dX + r() * amp, dY - 800 * (1 - k)]);
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; ctx.lineJoin = "round";
    for (const [w, c] of [[7, "rgba(30,30,100,.35)"], [4, "rgba(50,50,200,.6)"], [2, "rgba(220,230,255,.95)"]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
    ctx.restore();
  }
}
