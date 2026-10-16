// Caché de personajes compuestos: cada persona (cuerpo + ropa interior + pelo + armadura + arma + escudo…) se pinta una sola vez
// por (aspecto, acción, dirección, fotograma) y se guarda, recortada, en una página de atlas. Después cuesta un único drawImage
// en vez de 8-15 piezas con tintes (los teñidos usan lienzos temporales y composición, lo más caro). Misma calidad: se compone a
// la resolución en pantalla (S px por píxel de mundo, máx. 2) con suavizado alto y se vuelca tal cual.
import { drawPerson, bodyKey } from "./look.js";
import { hex3 } from "./glcompose.js";
import { WEAPON_RGB } from "./assets.js";

const PW = 2048, PH = 2048, MAXP = 8;          // páginas de atlas: 8 × 16 MB, la más antigua se recicla entera
const LW = 440, LH = 440, OX = 220, OY = 320;    // lienzo de trabajo (px de mundo) y posición del pivote en él
const GAP = 2;

export class PersonCache {
  constructor(spr, glc = null) {
    this.spr = spr; this.glc = glc;                 // glc: compositor WebGL2 (?gl=1); sin él, Canvas2D como siempre
    if (!spr.wtCache) spr.wtCache = new Map();    // el grabador hereda la caché de armas teñidas (si no, la crearía por su cuenta)
    this.pages = []; this.cur = -1; this.map = new Map(); this.epoch = glc ? glc.epoch : 0;
    this.S = 0; this.scratch = null; this.budget = 6; this.frame = 0;
    this.st = { hit: 0, comp: 0, direct: 0, recycled: 0, msComp: 0, msDirect: 0, msHit: 0, warm: 0, msWarm: 0, cp: { clear: 0, put: 0, tint: 0, weap: 0, atlas: 0, n: 0 } };
    this.seen = new Map();
    const rec = this.rec = Object.create(spr);
    rec.bb = null; rec.miss = 0;
    const track = (key, f, x, y) => {
      const fr = spr.frame(key, f); if (!fr) return;
      if (!spr.ready(key)) { rec.miss++; return; }
      const bb = rec.bb || (rec.bb = [1e9, 1e9, -1e9, -1e9]), x0 = x + fr[4], y0 = y + fr[5];
      if (x0 < bb[0]) bb[0] = x0; if (y0 < bb[1]) bb[1] = y0;
      if (x0 + fr[2] > bb[2]) bb[2] = x0 + fr[2]; if (y0 + fr[3] > bb[3]) bb[3] = y0 + fr[3];
    };
    const cp = this.st.cp, tm = (k, fn) => { const t = performance.now(); fn(); cp[k] += performance.now() - t; };
    rec.put = (c, key, f, x, y) => { track(key, f, x, y); tm("put", () => spr.put(c, key, f, x, y)); };
    rec.tintedHair = (c, key, f, x, y, rgb, add) => { track(key, f, x, y); tm("tint", () => spr.tintedHair(c, key, f, x, y, rgb, add)); };
    rec.putWeapon = (c, key, f, x, y, col) => { track(key, f, x, y); tm("weap", () => spr.putWeapon(c, key, f, x, y, col)); };
    if (glc) {                                       // mismas piezas y orden, pero teñidas en el shader (sin lienzos temporales)
      const gq = (key, f, x, y, mode, tint) => {
        const fr = spr.frame(key, f); if (!fr || !spr.ready(key)) return;
        const [img, k] = spr.src(key);
        if (!glc.quad(img, fr[0] * k, fr[1] * k, fr[2] * k, fr[3] * k, x + fr[4], y + fr[5], fr[2], fr[3], mode, tint)) rec.miss++;      // hoja sin subir y presupuesto agotado: se reintenta
      };
      rec.put = (c, key, f, x, y) => { track(key, f, x, y); tm("put", () => gq(key, f, x, y, 0)); };
      rec.tintedHair = (c, key, f, x, y, rgb, add) => { track(key, f, x, y); tm("tint", () => gq(key, f, x, y, add ? 2 : 1, hex3(rgb))); };
      rec.putWeapon = (c, key, f, x, y, col) => {
        track(key, f, x, y); const o = WEAPON_RGB[col];
        tm("weap", () => o ? gq(key, f, x, y, 3, [o[0] / 255, o[1] / 255, o[2] / 255]) : gq(key, f, x, y, 0));
      };
    }
  }

  newFrame() {
    this.budget = 6; this.frame++; this.seen.clear();
    if (this.glc) { this.glc.newFrame(); if (this.glc.epoch !== this.epoch) { this.epoch = this.glc.epoch; this.flush(); } }   // contexto WebGL restaurado: lo compuesto antes puede ser negro
  }

  keyOf(gender, look, group, d, f, ap) {
    const c = ap && ap.col;
    return (this.spr.hd ? "H" : "N") + gender + "|" + look.skin + "," + look.under + "," + look.hair + "," + look.hairCol + "|" + group + "," + d + "," + f + "|" +
      (ap ? ap.armor + "," + ap.arms + "," + ap.pants + "," + ap.boots + "," + ap.mantle + "," + ap.helm + "," + ap.shield + "," + ap.weapon : "") + (c ? "|" + Object.keys(c).sort().map(k => k + c[k]).join(",") : "");   // con el nombre de la ranura: capa y botas del mismo color no deben compartir imagen
  }

  // Precalienta (tras dibujar las entidades, con el tiempo sobrante) los 2 fotogramas siguientes de cada persona vista este fotograma:
  // cuando llegue su turno ya estarán en el atlas y costarán un drawImage. Tope de tiempo por fotograma: ms.
  warm(ms) {
    const spr = this.spr; if (spr.recolor || spr.modelFx || !this.S) return;
    const t0 = performance.now();
    if (this.glc) this.glc.pump(2);                  // subidas de hojas aplazadas, repartidas entre fotogramas
    for (const a of this.seen.values()) {
      const n = spr.frames(bodyKey(a.gender, a.look, a.group, a.d)); if (n < 2) continue;
      for (let i = 1; i <= 2; i++) {
        if (performance.now() - t0 > ms) { this.st.msWarm += performance.now() - t0; return; }
        const f = (a.f + i) % n, key = this.keyOf(a.gender, a.look, a.group, a.d, f, a.ap);
        const e = this.map.get(key);
        if (e && (e.t === undefined || this.frame - e.t < 8)) continue;
        if (e) this.map.delete(key);
        if (this.compose(key, a.gender, a.look, a.group, a.d, f, a.ap)) { this.st.warm++; this.st.msWarm += performance.now() - t0; return; }   // una por fotograma: cada una cuesta ~10 ms
      }
    }
    this.st.msWarm += performance.now() - t0;
  }

  setScale(S) {
    if (S === this.S) return;
    this.S = S; this.flush();
    if (this.glc) { this.scratch = this.glc.cv; return; }
    this.scratch = document.createElement("canvas"); this.scratch.width = Math.ceil(LW * S); this.scratch.height = Math.ceil(LH * S);
    this.sg = this.scratch.getContext("2d"); this.sg.imageSmoothingEnabled = true; this.sg.imageSmoothingQuality = "high";
  }

  flush() { this.pages = []; this.cur = -1; this.map.clear(); }

  alloc(w, h) {
    let p = this.pages[this.cur];
    if (!p || p.y + (p.x + w > PW ? p.rowH : 0) + h > PH) {                // no cabe: página siguiente (o se recicla la más antigua)
      this.cur++;
      if (this.cur >= MAXP) this.cur = 0;
      p = this.pages[this.cur];
      if (!p) { const cv = document.createElement("canvas"); cv.width = PW; cv.height = PH; p = this.pages[this.cur] = { cv, g: cv.getContext("2d"), keys: [] }; }
      else { for (const k of p.keys) this.map.delete(k); p.g.clearRect(0, 0, PW, PH); this.st.recycled++; }
      p.keys = []; p.x = p.y = p.rowH = 0;
    }
    if (p.x + w > PW) { p.y += p.rowH + GAP; p.x = 0; p.rowH = 0; }
    const r = { p, x: p.x, y: p.y };
    p.x += w + GAP; if (h > p.rowH) p.rowH = h;
    return r;
  }

  // true si dibujó al personaje desde la caché; false = el llamador lo dibuja pieza a pieza (sin hojas listas, sin presupuesto, bestiario…)
  draw(ctx, gender, look, group, d, f, x, y, ap, S) {
    const spr = this.spr;
    if (spr.recolor || spr.modelFx) return false;
    this.setScale(S);
    const T0 = performance.now(), key = this.keyOf(gender, look, group, d, f, ap);
    this.seen.set(key, { gender, look, group, d, f, ap });
    let e = this.map.get(key);
    if (e && e.t !== undefined) { if (this.frame - e.t < 8) return false; e = null; }          // falta alguna hoja: se reintenta cada 8 fotogramas
    if (!e) {
      if (this.budget <= 0) { this.st.direct++; return false; }
      this.budget--;
      e = this.compose(key, gender, look, group, d, f, ap);
      if (!e) { this.st.direct++; return false; }
      this.blit(ctx, e, x, y, S);
      this.st.comp++; this.st.msComp += performance.now() - T0;
      return true;
    }
    this.st.hit++;
    this.blit(ctx, e, x, y, S);
    this.st.msHit += performance.now() - T0;
    return true;
  }

  // El atlas ya está a resolución de pantalla (~1:1): con "medium" Chrome regeneraba los mipmaps de la página en cada cambio. Se restaura la calidad del llamador.
  blit(ctx, e, x, y, S) {
    const q0 = ctx.imageSmoothingQuality; ctx.imageSmoothingQuality = "low";
    ctx.drawImage(e.p.cv, e.sx, e.sy, e.w, e.h, x + e.dx, y + e.dy, e.w / S, e.h / S);
    ctx.imageSmoothingQuality = q0;
  }

  compose(key, gender, look, group, d, f, ap) {
    const { spr, rec, sg, S } = this;
    const cp = this.st.cp, T0 = performance.now(); cp.n++;
    rec.bb = null; rec.miss = 0;
    if (this.glc && this.glc.lost) { this.map.set(key, { t: this.frame }); return null; }          // contexto perdido: no se cachea nada
    if (this.glc) this.glc.begin(Math.ceil(LW * S), Math.ceil(LH * S), S, OX, OY);
    else { sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, this.scratch.width, this.scratch.height); }
    cp.clear += performance.now() - T0;
    if (!this.glc) sg.setTransform(S, 0, 0, S, OX * S, OY * S);
    drawPerson(sg, rec, gender, look, group, d, f, 0, 0, ap);
    if (this.glc) { const T = performance.now(); this.glc.flush(); cp.put += performance.now() - T; }      // una composición = un solo drawArrays
    const bb = rec.bb;
    if (rec.miss || !bb || bb[0] < -OX + 1 || bb[1] < -OY + 1 || bb[2] > LW - OX - 1 || bb[3] > LH - OY - 1) {
      this.map.set(key, { t: this.frame });                                             // reintentar más tarde
      return null;
    }
    const x0 = Math.floor((OX + bb[0]) * S) - 1, y0 = Math.floor((OY + bb[1]) * S) - 1;
    const w = Math.ceil((OX + bb[2]) * S) + 1 - x0, h = Math.ceil((OY + bb[3]) * S) + 1 - y0;
    const T1 = performance.now(), a = this.alloc(w, h);
    a.p.g.drawImage(this.scratch, x0, y0, w, h, a.x, a.y, w, h);
    cp.atlas += performance.now() - T1;
    const e = { p: a.p, sx: a.x, sy: a.y, w, h, dx: x0 / S - OX, dy: y0 / S - OY };
    a.p.keys.push(key); this.map.set(key, e);
    return e;
  }
}
