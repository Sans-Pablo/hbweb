// Efectos de hechizos del cliente original (Game.cpp: bAddNewEffect, bEffectFrameCounter, DrawEffects).
// Los números de efecto son los mismos: 100 + número de hechizo = proyectil/aura del hechizo, y los
// bajos (5, 6, 7, 8, 9, 10, 11, 12, 15...) son explosiones y chispas. Sprites: data/fx.json (EFFECT*.PAK).
// Las coordenadas de los efectos "bajos" son píxeles de mundo; las de los hechizos (>= 100), casillas.
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
// CMisc::cGetNextMoveDir
function nextDir(sx, sy, dx, dy) {
  if (sx === dx && sy === dy) return 0;
  if (sx === dx) return sy > dy ? 1 : 5;
  if (sy === dy) return sx > dx ? 7 : 3;
  if (sx > dx && sy > dy) return 8;
  if (sx < dx && sy > dy) return 2;
  if (sx > dx && sy < dy) return 6;
  return 4;
}

// parámetros de cada efecto (extraídos de bAddNewEffect): [fotograma máximo, ms por fotograma] y su sonido
const SETUP = {"8":[4,30],"9":[14,30],"11":[8,30],"12":[10,30],"14":[4,100],"15":[16,80],"1":[2,10],"2":[0,10],"4":[12,100],"5":[11,10],"6":[14,10],"10":[14,10],"7":[5,50],"13":[18,20],"16":[0,20],"17":[0,20],"18":[10,50],"20":[0,10],"21":[0,10],"22":[0,10],"23":[0,10],"24":[0,10],"25":[0,10],"26":[0,10],"27":[0,10],"30":[9,40],"31":[8,40],"252":[8,40],"32":[4,100],"33":[16,10],"34":[0,20],"35":[18,40],"36":[15,40],"40":[15,30],"41":[14,20],"42":[14,20],"43":[14,20],"44":[14,20],"45":[14,20],"46":[14,20],"47":[12,20],"48":[12,20],"49":[12,20],"50":[12,50],"51":[9,80],"52":[15,80],"53":[15,80],"54":[10,15],"55":[10,15],"56":[14,30],"57":[16,80],"60":[10,50],"61":[16,10],"62":[6,100],"63":[16,20],"64":[15,20],"65":[30,80],"66":[14,30],"67":[27,10],"68":[17,30],"69":[11,30],"70":[11,30],"71":[0,20],"72":[15,20],"73":[15,60],"74":[19,40],"75":[16,40],"76":[16,40],"77":[16,40],"80":[30,25],"81":[27,40],"82":[30,40],"100":[0,20],"101":[14,80],"111":[14,80],"121":[14,80],"123":[14,80],"128":[14,80],"102":[13,120],"122":[13,120],"126":[13,120],"127":[13,120],"134":[13,120],"136":[13,120],"142":[13,120],"152":[13,120],"153":[13,120],"162":[13,120],"171":[13,120],"110":[0,20],"112":[12,80],"131":[12,80],"132":[12,80],"113":[12,120],"144":[12,120],"114":[0,20],"120":[0,20],"124":[0,20],"133":[0,20],"125":[0,20],"135":[0,20],"130":[0,20],"137":[0,20],"138":[2,10],"143":[7,10],"145":[2,10],"147":[0,20],"150":[11,100],"177":[11,100],"180":[11,100],"183":[11,100],"190":[11,100],"195":[11,100],"151":[10,10],"156":[3,130],"157":[2,10],"160":[7,80],"161":[0,20],"251":[0,20],"163":[2,10],"164":[1,10],"165":[21,70],"166":[13,80],"170":[7,80],"172":[2,10],"174":[5,120],"176":[23,60],"181":[10,25],"182":[0,20],"244":[29,80],"191":[7,80],"242":[30,40],"243":[19,18],"194":[30,40],"196":[30,25],"200":[15,25],"201":[15,25],"202":[15,25],"203":[18,70],"204":[12,70],"205":[12,70],"206":[3,70],"250":[0,10]};
const SND = {"4":12,"5":4,"6":2,"10":2,"7":3,"30":4,"31":4,"252":4,"35":4,"36":4,"40":45,"41":46,"42":46,"43":46,"44":46,"45":46,"46":46,"47":46,"48":46,"49":46,"50":47,"52":5,"53":5,"56":45,"61":4,"66":4,"68":4,"69":42,"70":42,"72":47,"100":1,"101":5,"111":5,"121":5,"123":5,"128":5,"102":5,"122":5,"126":5,"127":5,"134":5,"136":5,"142":5,"152":5,"153":5,"162":5,"171":5,"110":1,"112":5,"131":5,"132":5,"113":5,"144":5,"120":1,"130":1,"137":1,"138":4,"143":40,"150":5,"177":5,"180":5,"183":5,"190":5,"195":5,"151":40,"161":1,"251":1,"164":4,"165":5,"166":5,"176":5,"182":1};

const T = 32;

export class SpellFx {
  constructor() {
    this.list = [];
    this.man = null;
    this.img = {};
    this.hook = null;                 // (sonido, x, y) -> reproducir
    this.off = false;
  }

  async load() {
    try { this.man = await (await fetch("data/fx.json")).json(); } catch { return; }
    for (const k of Object.keys(this.man)) { const i = new Image(); i.src = "data/fx/" + this.man[k].png; this.img[k] = i; }
  }

  snd(n, x, y) { this.hook?.("E" + n, x, y); }

  // bAddNewEffect(tipo, x, y, dx, dy, fotograma inicial, v1). Los hechizos (>= 100) traen casillas; el resto, píxeles.
  add(type, sx, sy, dx = 0, dy = 0, start = 0, v1 = 0) {
    const set = SETUP[type];
    if (!set) return null;
    const e = { type, sx, sy, dx, dy, v1, frame: start, max: set[0], ft: set[1], t: performance.now(), mx: sx, my: sy, rx: 0, ry: 0, err: 0, dir: 1 };
    const px = c => c * T + 16;
    switch (type) {
      case 16: case 34: case 71: case 196: e.mx = sx * T; e.my = sy * T - (type === 71 || type === 196 ? 0 : 40); e.err = 0; break;
      case 100: case 110: case 120: case 130: case 137: case 161: case 182: case 251:
        e.mx = px(sx); e.my = px(sy) - 40; e.dir = dirTo(sx, sy, dx, dy) || 1; break;
      case 143: case 151: e.mx = type === 151 ? px(sx) : px(dx); e.my = (type === 151 ? px(sy) : px(dy)) - 50; e.rx = 5 - rnd(10); e.ry = 5 - rnd(10); break;
      case 41: case 42: case 43: case 44: case 45: case 46: case 47: case 48: case 49: e.my = sy - 220; e.v1 = 20; break;
      case 60: e.mx = sx + 300; e.my = sy - 460; break;
      case 181: e.mx = px(dx) - 16 + 300; e.my = px(dy) - 16 - 460; break;
      case 9: e.rx = 6 - rnd(12); e.ry = -8 - rnd(6); break;
      case 11: e.rx = 6 - rnd(12); e.ry = -2 - rnd(4); break;
      case 12: e.rx = 8 - rnd(16); e.ry = 4 - rnd(12); break;
      case 14: e.my = sy - 10 - rnd(16); break;
      case 15: e.ry = -1; break;
      case 80: e.v1 = v1; break;
    }
    if (type === 114) {                                          // Celebrating Light: chispas de colores sobre el objetivo
      for (let i = 0; i < 5; i++) this.add(69 + rnd(2), px(dx) + 20 - rnd(40), px(dy) + 20 - rnd(40), 0, 0, -12 + i * 3);
      return null;
    }
    if (type === 124 || type === 133) { this.add(52, px(dx), px(dy)); return null; }
    if (type === 125 || type === 135) { this.add(53, px(dx), px(dy)); this.snd(5, dx, dy); return null; }
    if (type === 138 || type === 164) {
      for (let i = 0; i < 15; i++) this.add(14, px(dx) + rnd(120) - 60, px(dy) + rnd(80) - 40);
      this.snd(4, dx, dy);
    }
    if (SND[type] && type !== 138 && type !== 164 && type < 100) this.snd(SND[type], (e.mx / T) | 0, (e.my / T) | 0);
    else if (SND[type] && type >= 100 && type !== 138 && type !== 164) this.snd(SND[type], type >= 130 && type % 10 === 0 || type === 100 || type === 110 || type === 120 || type === 137 || type === 161 || type === 182 ? sx : dx, type >= 130 && type % 10 === 0 || type === 100 || type === 110 || type === 120 || type === 137 || type === 161 || type === 182 ? sy : dy);
    this.list.push(e);
    return e;
  }

  // Un hechizo lanzado por la entidad en (cx,cy) contra la casilla (tx,ty).
  spell(id, cx, cy, tx, ty) {
    this.add(id + 100, cx, cy, tx, ty);
    // Mass Magic Missile: aura sobre el lanzador
    if (id + 100 === 182) this.add(244, cx * T + 16, cy * T + 16 - 20);
  }

  // un paso del contador de fotogramas de un efecto (bEffectFrameCounter)
  step(e) {
    e.frame++;
    const f = e.frame, X = e.dx * T + 16, Y = e.dy * T + 16;
    const near = (px, py) => Math.abs(e.mx - px) <= 2 && Math.abs(e.my - py) <= 2;
    const fly = (n, tx = X, ty = Y) => { [e.mx, e.my, e.err] = getPoint(e.mx, e.my, tx, ty, e.err, n); };
    const end = () => { e.dead = true; };
    const at = (t, x, y, s = 0, v = 0) => this.add(t, x, y, 0, 0, s, v);
    const burst9 = (n, spread) => { for (let i = 0; i < n; i++) at(9, e.mx + spread / 2 - rnd(spread), e.my + spread / 2 - rnd(spread), -rnd(2)); };
    const done = () => { if (f > e.max) end(); };
    const spark8 = k => { for (let i = 0; i < k; i++) at(8, e.mx + rnd(20) - 10, e.my + rnd(20) - 10, -rnd(4)); };
    switch (e.type) {
      case 5: case 30: case 31: case 252:
        if (f === 1) for (let i = 0; i < 5; i++) at(12, e.mx + 5 - rnd(10), e.my + 5 - rnd(10), -rnd(2));
        if (f === 7) for (let i = 0; i < 3; i++) at(15, e.mx + 5 - rnd(10), e.my + 5 - rnd(10));
        done(); break;
      case 6: case 10: if (f === 1) burst9(e.type === 10 ? 11 : 5, e.type === 10 ? 40 : 10); if (f >= e.max) end(); break;
      case 7: if (f === 1) burst9(3, 10); if (f >= e.max) end(); break;
      case 9: case 11: e.mx += e.rx; e.my += e.ry; e.ry++; done(); break;
      case 12: e.mx += e.rx; e.my += e.ry; done(); break;
      case 13: if (f < 15) { e.mx += rnd(2) ? 1 : -1; e.my--; } done(); break;
      case 15: e.my += e.ry; done(); break;
      case 16:
        fly(40); spark8(1);
        if (near(e.dx, e.dy)) { at(18, e.dx, e.dy); for (let i = 0; i < 5; i++) at(9, e.mx + 20 - rnd(40), e.my + 20 - rnd(40), -rnd(2)); end(); }
        break;
      case 34:
        fly(50, e.dx, e.dy); at(33, e.mx + rnd(30) - 15, e.my + rnd(30) - 15, -rnd(4));
        if (near(e.dx, e.dy)) { at(33, e.dx, e.dy); end(); }
        break;
      case 40: case 56:
        if (f === 9) for (let i = 0; i < 5; i++) at(51, e.mx + rnd(100) - 50, e.my + rnd(70) - 35);
        done(); break;
      case 41: case 42: case 43: case 44: case 45: case 46:
        if (f >= 7) { e.mx--; e.my += e.v1; e.v1++; }
        if (f > e.max) {
          if (e.type !== 45 && e.type !== 46) {
            at(50, e.mx, e.my);
            for (let i = 0; i < 3; i++) at(14, e.mx + rnd(20) - 10, e.my + rnd(20) - 10);
            for (let i = 0; i < 2; i++) at(51, e.mx + rnd(20) - 10, e.my + rnd(20) - 10);
          }
          end();
        }
        break;
      case 47: case 48: case 49:
        if (f >= 7) { e.mx--; e.my += e.v1; e.v1 += 4; }
        if (f > e.max) {
          at(e.type === 49 ? 72 : 50, e.mx, e.my);
          for (let i = 0; i < 3; i++) at(14, e.mx + rnd(20) - 10, e.my + rnd(20) - 10);
          for (let i = 0; i < 2; i++) at(51, e.mx + rnd(20) - 10, e.my + rnd(20) - 10);
          end();
        }
        break;
      case 60: case 181:
        if (f > e.max) {
          at(61, e.mx, e.my); at(63, e.mx, e.my);
          for (let i = 0; i < 5; i++) at(12, e.mx + 5 - rnd(10), e.my + 5 - rnd(10), -rnd(2));
          end();
        } else if (f >= 0) { e.mx -= 30; e.my += 46; at(62, e.mx, e.my); }
        break;
      case 62: if (f > e.max) end(); else if (f >= 0) { e.mx += rnd(3) - 1; e.my += rnd(3) - 1; } break;
      case 65: if (f > e.max) end(); else if (f >= 0) { e.mx += rnd(3) - 1; e.my -= 4 + rnd(2); } break;
      case 68: done(); break;
      case 71:
        fly(50, e.dx, e.dy);
        at(48, e.mx + rnd(30) - 15, e.my + rnd(30) - 15); at(51, e.mx + rnd(20) - 10, e.my + rnd(20) - 10);
        if (near(e.dx, e.dy)) { at(49, e.mx, e.my); end(); }
        break;
      case 80: case 196:
        if (e.type === 196) {
          fly(40, e.dx * T + 16, e.dy * T + 16);
          at(80, e.mx + rnd(30) - 15, e.my + rnd(30) - 15, 0, 1); at(80, e.mx + rnd(20) - 10, e.my + rnd(20) - 10, 0, 0);
          if (f >= e.max) end();
        } else done();
        break;
      case 100: case 110: case 182:
        fly(50); spark8(e.type === 110 ? 2 : 1);
        if (near(X, Y)) {
          if (e.type === 100) { at(7, X, Y); this.snd(3, e.dx, e.dy); }
          else if (e.type === 110) { at(6, X, Y); this.snd(2, e.dx, e.dy); }
          end();
        } else if (e.type === 182) {
          const pX = e.dx * T + 16, pY = e.dy * T + 16;
          at(35, pX + 22, pY - 15, -7, 1); at(36, pX - 22, pY - 7, -7, 1); at(36, pX + 30, pY - 22, -5, 1); at(36, pX + 12, pY + 22, -3, 1);
        }
        break;
      case 120: case 143: case 151:
        if (f > e.max) { at(10, X, Y); this.snd(2, e.dx, e.dy); end(); }
        else { e.rx = 5 - rnd(10); e.ry = 5 - rnd(10); }
        break;
      case 145: { const bx = X - 16, by = Y - 16; for (const [ox, oy, s] of [[0, 0, 0], [-30, -15, -10], [35, -30, -6], [20, 30, -3]]) at(40, bx + ox + 16, by + oy + 16, s); end(); break; }
      case 163: {
        const bx = X, by = Y;
        for (const [ox, oy, s] of [[0, 0, 0], [-30, -15, -10], [35, -30, -6], [20, 30, -3]]) at(56, bx + ox, by + oy, s);
        for (let i = 0; i < 4; i++) at(56, bx + rnd(100) - 50, by + rnd(70) - 35, -rnd(10));
        end(); break;
      }
      case 147:
        this.add(110, e.sx, e.sy, e.dx - 1, e.dy - 1); this.add(110, e.sx, e.sy, e.dx + 1, e.dy - 1); this.add(110, e.sx, e.sy, e.dx + 1, e.dy + 1);
        at(8, e.mx + rnd(20) - 10, e.my + rnd(20) - 10, -rnd(4)); at(7, X, Y); this.snd(1, e.dx, e.dy);
        end(); break;
      case 156:
        if (f > e.max) end(); else { this.add(137, e.sx, e.sy, e.dx, e.dy); this.snd(1, e.dx, e.dy); }
        break;
      case 157: {
        at(41, X, Y);
        for (let i = 0; i < 14; i++) at(41 + rnd(3), X + rnd(100) - 50 + 10, Y + rnd(90) - 45, -i - 1);
        for (let i = 0; i < 6; i++) at(45 + rnd(2), X + rnd(100) - 50 + 10, Y + rnd(90) - 45, -i - 1 - 10);
        end(); break;
      }
      case 172: {
        at(44, X, Y);
        for (let i = 0; i < 8; i++) at(44, X + rnd(110) - 55 + 10, Y + rnd(100) - 50, -rnd(3));
        for (let i = 0; i < 16; i++) at(44, X + rnd(110) - 55 + 10, Y + rnd(100) - 50, -i - 1);
        for (let i = 0; i < 8; i++) at(45 + rnd(2), X + rnd(100) - 50 + 10, Y + rnd(90) - 45, -i - 1 - 10);
        end(); break;
      }
      case 160:
        if (f > e.max) end();
        else { this.add(16, e.sx, e.sy, X + 50 - rnd(100), Y + 50 - rnd(100)); this.snd(1, e.dx, e.dy); }
        break;
      case 161: case 130: case 137: case 251: {
        fly(50);
        if (e.type === 137) { spark8(3); e.trail = e.trail || []; e.trail.unshift([e.mx, e.my]); e.trail.length = Math.min(e.trail.length, 6); }
        if (near(X, Y)) {
          if (e.type === 137) { at(10, X, Y); this.snd(47, e.dx, e.dy); }
          else if (e.type === 130) { for (const [ox, oy, s] of [[0, 0, 0], [-30, -15, -7], [35, -30, -5], [20, 30, -3]]) at(5, X + ox, Y + oy, s); }
          else { for (const [t, ox, oy, s] of [[30, 0, 0, 0], [31, -30, -15, -7], [31, 35, -30, -5], [31, 20, 30, -3]]) at(t, X + ox, Y + oy, s); }
          end();
        }
        break;
      }
      case 164: if (f > e.max) { at(68, X, Y); end(); } break;
      case 170:
        if (f > e.max) end();
        else if (f % 2 === 0) { this.add(34, e.sx, e.sy, X + 30 - rnd(60), Y + 30 - rnd(60)); this.snd(1, e.dx, e.dy); }
        break;
      case 174:
        if (f > e.max) end();
        else { this.add(151, e.sx, e.sy, e.dx + rnd(3) - 1, e.dy + rnd(3) - 1); this.snd(1, e.dx, e.dy); }
        break;
      case 191:
        if (f > e.max) end();
        else { this.add(71, e.sx, e.sy, X - 16 + rnd(120) - 60 + 16, Y - 16 + rnd(120) - 60 + 16); this.snd(1, e.dx, e.dy); }
        break;
      case 138: if (f > e.max) end(); break;
      default: if (f > e.max) end();
    }
  }

  // sprite `n` del cliente (m_pEffectSpr[n]); modo: "add" (aditivo), "over" (normal), "rev" (oscurece); a = opacidad
  put(ctx, n, f, x, y, mode = "add", a = 1) {
    const key = "fx" + n, m = this.man && this.man[key], img = this.img[key];
    if (!m || !img || !img.naturalWidth || a <= 0 || mode === "rev") return;   // "rev" (resta de color) no tiene equivalente sin fondo negro
    const fr = m.frames[f];
    if (!fr) return;
    const [sx, sy, sw, sh, px, py] = fr;
    ctx.save();
    ctx.globalCompositeOperation = mode === "add" ? "lighter" : mode === "rev" ? "multiply" : "source-over";
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(img, sx, sy, sw, sh, Math.round(x + px), Math.round(y + py), sw, sh);
    ctx.restore();
  }

  update() {
    if (this.off) { this.list.length = 0; return; }
    const now = performance.now();
    for (const e of [...this.list]) {
      if (e.dead || now - e.t <= e.ft) continue;
      e.t = now; this.step(e);
    }
    this.list = this.list.filter(e => !e.dead);
    if (this.list.length > 600) this.list.splice(0, this.list.length - 600);
  }

  draw(ctx, camX, camY) {
    if (!this.man || this.off) return;
    const fade = d => Math.max(0, 1 + d / 31);                     // PutTransSpriteRGB con desplazamiento negativo
    for (const e of this.list) {
      const f = e.frame;
      if (f < 0 && !(e.type >= 100 && e.type !== 101)) continue;
      const x = e.mx - camX, y = e.my - camY;
      const tx = e.dx * T + 16 - camX, ty = e.dy * T + 16 - camY;      // posición de las auras de hechizo (casilla del objetivo)
      const P = (n, fr, xx, yy, m, a) => this.put(ctx, n, fr, xx, yy, m, a);
      switch (e.type) {
        case 4: if (f >= 9) P(1, f - 9, x, y - 40, "over", 1); break;
        case 5: P(3, f, x, y, "add", f < 7 ? 1 : fade((f - 8) * -5)); break;
        case 6: case 10: P(6, f, x, y, "add", f < 6 ? 1 : fade((f - 7) * -6)); break;
        case 7: P(6, f, x, y, "add", f < 4 ? 1 : fade((f - 4) * -3)); break;
        case 8: P(11, 4 - f, x, y); break;
        case 9: P(11, rnd(5), x, y); break;
        case 11: P(11, rnd(5) + 5, x, y); break;
        case 12: P(11, rnd(6) + 10, x, y); break;
        case 13: P(11, f < 13 ? 25 + ((f / 5) | 0) : 8 + f, x, y); break;
        case 14: P(11, 28 + f, x, y, "add", .5); break;
        case 15: P(11, 33 + f, x, y, "add", .5); break;
        case 16: P(0, 0, x, y); break;
        case 18: P(18, f, x, y, "add", .7); break;
        case 30: P(14, f, x, y); break;
        case 31: case 252: P(15, f, x, y); break;
        case 33: P(19, f, x, y); break;
        case 35: P(6, f, x - 30, y - 18); break;
        case 36: P(97, f, x, y); break;
        case 40: P(20, f, x, y, "add", .5); break;
        case 41: case 42: case 43: case 44: case 45: case 46: {
          this.put(ctx, 21, 48, e.sx - camX, e.sy - camY, "rev", .6);
          const b = 8 * (e.type - 41);
          if (f < 7) P(21, b + f, x, y, "add", fade(-8 * (6 - f)));
          else { let g = f; if (g - 5 >= 8) g = g - 5 - 8 + 5; P(21, b + (g - 5), x, y, "over", 1); }
          break;
        }
        case 47: case 48: case 49: {
          const n = e.type - 1;
          this.put(ctx, n, 0, e.sx - camX, e.sy - camY, "rev", .6);
          if (f < 7) P(n, f + 1, x, y, "add", fade(-8 * (6 - f)));
          else P(n, (f % 8) + 1, x, y, "over", 1);
          break;
        }
        case 50: P(22, f <= 6 ? f : 6, x, y, "add", f <= 6 ? 1 : fade(-5 * (f - 6))); break;
        case 51: P(28, f + 11, x, y, "add", .25); break;
        case 53: P(25, f, x, y); break;
        case 54: P(28, Math.max(0, f), x, y); break;
        case 55: P(28, Math.max(0, f), e.mx, e.my); break;
        case 56: P(29, f, x, y, "add", .5); break;
        case 60: case 181: {
          const g = f > 4 ? (f / 4) | 0 : f;
          P(31, 15 + g, x, y, "over", 1); P(31, g, x, y);
          break;
        }
        case 61: P(32, f, x, y); break;
        case 62: if (f > 0) P(31, 20 + f - 1, x, y, "rev", .7); break;
        case 63: P(33, f, x, y); break;
        case 64: P(34, f, x, y); break;
        case 66: P(39, f, x, y, "rev", .5); P(39, f, x, y); break;
        case 68:
          if (f <= 11) { P(40, f, x, y, "over", 1); P(41, f, x, y, "add", .5); P(44, f, x - 2, y - 3, "rev", .6); P(44, f, x - 4, y - 3); }
          else P(40, 11, x, y, "over", f <= 14 ? 1 : f === 15 ? .7 : f === 16 ? .5 : .25);
          break;
        case 69: P(42, f, x, y); break;
        case 70: P(43, f, x, y); break;
        case 72: P(51, f <= 8 ? f : 8, x, y, "add", f <= 8 ? 1 : fade(-(f - 8))); break;
        case 80: P(91, f, x, y, "over", 1); P(92, f, x, y); break;
        case 196: break;
        case 100: P(0, 0, x, y); break;
        case 110: P(0, 2 + rnd(4), x, y); break;
        case 101: case 121: if (f >= 0) P(50, f, tx, ty); break;
        case 102: case 124: case 125: case 126: case 127: case 133: case 134: case 135: case 136: case 142: case 152: case 153: case 162: case 171:
          if (f >= 0) P(4, f, tx, ty, "add", f < 5 ? 1 : fade((f - 5) * -5)); break;
        case 111: if (f >= 0) P(49, f, tx, ty); break;
        case 112: case 131: case 132: if (f >= 0) P(52, f, tx, ty); break;
        case 113: if (f >= 0) P(62, f, tx, ty, "add", f < 6 ? 1 : fade((f - 5) * -5)); break;
        case 144: if (f >= 0) P(63, f, tx, ty, "add", f < 9 ? 1 : fade((f - 5) * -5)); break;
        case 123: case 128: if (f >= 0) P(56, f, tx, ty); break;
        case 120: case 130: case 161: case 251: P(5, (e.dir - 1) * 4 + rnd(4), x, y); break;
        case 137: {
          const al = [1, .7, .5, .5, .25, .25];
          (e.trail || []).slice(0, 5).forEach((p, i) => P(10, (e.dir - 1) * 4 + rnd(4), p[0] - camX, p[1] - camY, "add", al[i + 1]));
          P(10, (e.dir - 1) * 4 + rnd(4), x, y);
          break;
        }
        case 143: this.thunder(ctx, e.dx * T + 16 - camX, e.dy * T + 16 - camY - 800, e.dx * T + 16 - camX, e.dy * T + 16 - camY, e.rx, e.ry, 1);
                  this.thunder(ctx, e.dx * T + 16 - camX, e.dy * T + 16 - camY - 800, e.dx * T + 16 - camX, e.dy * T + 16 - camY, e.rx + 4, e.ry + 2, 2);
                  this.thunder(ctx, e.dx * T + 16 - camX, e.dy * T + 16 - camY - 800, e.dx * T + 16 - camX, e.dy * T + 16 - camY, e.rx - 2, e.ry - 2, 2); break;
        case 151: this.thunder(ctx, x, y, tx, ty, e.rx, e.ry, 1); this.thunder(ctx, x, y, tx, ty, e.rx + 2, e.ry - 2, 2); this.thunder(ctx, x, y, tx, ty, e.rx - 2, e.ry - 2, 2); break;
        case 165: if (f >= 0) P(53, f, tx, ty); break;
        case 166: if (f >= 0) { P(55, f, tx, ty + 35, "rev", .6); P(54, f, tx, ty, "add", .5); } break;
        case 176: if (f >= 0) P(90, f, tx + 50, ty + 85); break;
        case 177: case 180: if (f >= 0) P(60, f, tx, ty, "add", f < 9 ? 1 : fade((f - 5) * -3)); break;
        case 190: case 195: if (f >= 0) P(61, f, tx, ty, "add", f < 9 ? 1 : fade((f - 5) * -3)); break;
        case 183: if (f >= 0) P(94, f, tx, ty + 40, "add", f < 9 ? 1 : fade((f - 5) * -3)); break;
        case 182: P(98, Math.max(0, f), x, y); break;
        case 244: P(96, f, x - camX + camX - 0, y); break;
        case 194: if (f >= 0) P(99, f, tx, ty); break;
        case 242: if (f >= 0) P(87, f, tx + 50, ty + 57); break;
        case 243: if (f >= 0) P(88, f, tx + 65, ty + 80); break;
      }
    }
  }

  // _DrawThunderEffect: rayo irregular que avanza a trompicones de (sx,sy) hacia (dx,dy)
  thunder(ctx, sX, sY, dX, dY, rX, rY, kind) {
    const pts = [[sX, sY]];
    let ix = sX, iy = sY, err = 0, tx = sX, ty = sY;
    for (let j = 0; j < 100; j++) {
      [tx, ty, err] = getPoint(sX, sY, dX, dY, 0, j * 10);
      switch (nextDir(ix, iy, tx, ty)) {
        case 1: rY -= 5; break; case 2: rY -= 5; rX += 5; break; case 3: rX += 5; break; case 4: rX += 5; rY += 5; break;
        case 5: rY += 5; break; case 6: rX -= 5; rY += 5; break; case 7: rX -= 5; break; case 8: rX -= 5; rY -= 5; break;
      }
      rX = Math.max(-20, Math.min(20, rX)); rY = Math.max(-20, Math.min(20, rY));
      ix += rX; iy += rY;
      pts.push([ix, iy]);
      if (Math.abs(tx - dX) < 5 && Math.abs(ty - dY) < 5) break;
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; ctx.lineJoin = "round";
    const stroke = (w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); };
    if (kind === 1) { stroke(5, "rgba(30,30,100,.45)"); stroke(3, "rgba(50,50,100,.7)"); stroke(1, "rgba(60,60,80,1)"); }
    else stroke(2, "rgba(220,230,255,.95)");
    const last = pts[pts.length - 1];
    if (kind === 1) this.put(ctx, 6, rnd(2), last[0], last[1]);
    ctx.restore();
  }
}
