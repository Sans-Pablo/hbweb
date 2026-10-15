// Dibujo del mundo. Dos modos sobre la misma simulación, como Diablo II Resurrected:
//   classic    -> 800x600 del original, cámara fija al personaje, sin efectos añadidos
//   remastered -> pantalla completa (más campo de visión), cámara suave, zoom con la rueda,
//                 luz y viñeta, destellos, barras de vida, etiquetas de objetos, partículas
import { rarityOf, RARITY_COLOR } from "../shared/rarity.js";
import { t } from "./i18n.js";
import { BOSS_COLORS, BOSS_NAMES } from "../shared/dungeon.js";
const CHAR_H = 56;          // altura aproximada del personaje (fotograma de cuerpo): referencia para reducir a los compañeros altos
import { TILE as T, ACT, TRANSLUCENT_MOBS, CORPSE_MS, DX, DY } from "../shared/const.js";
import { sget } from "../shared/systems/status.js";
import { sizeStep } from "../shared/systems/companion.js";
import { look, FIT } from "../shared/systems/evolutions.js";
import { DUMMY_COLORS, DUMMY_NAMES } from "../shared/systems/talents.js";
import { radiusOf } from "../shared/systems/dummy.js";
import { itemDef, itemName, groundKey } from "./names.js";
import { attrLines } from "../shared/attributes.js";
import { MAP_NAMES, ALLOWED_MAPS } from "../shared/adventure.js";
const guildLine = e => { const g = e.guild ? [e.guild.name, e.guild.rank] : e.gd; return g ? g[0] + (g[1] === 0 ? " Guildmaster" : " Guildsman") : null; };
import { sellPriceOf } from "../shared/systems/shopsys.js";
import { isStack } from "../shared/items.js";
import { miniOf } from "./compicon.js";
import { CROP_NAMES } from "../shared/systems/farming.js";
import { posOf, playerSprite, mobSprite, actionAt } from "./anim.js";
import { bodyKey, drawPerson, apparelOf, DEFAULT_LOOK } from "./look.js";
import { PersonCache } from "./composed.js";
import { GLCompose } from "./glcompose.js";

const CHUNK = 16;                       // casillas por bloque de suelo pregenerado
const CLASSIC_W = 800, CLASSIC_H = 600;
const AURA = { 1: "255,210,80", 2: "120,220,255", 3: "200,120,255", 4: "120,160,255", 5: "255,120,80", 6: "120,255,140", 7: "255,150,40", 8: "255,60,60" };

// Client/Game.cpp, DrawObject_On*: monstruos sin sombra (Slime, Tigerworm, Plant, Ice-Golem, esfera, Abaddon, puerta...)
const NO_SHADOW = new Set([10, 35, 50, 51, 60, 65, 81, 91]);

// Círculo de casteo por especie (web/data/cast_circle.json, editable y guardable desde el bestiario): color, color del núcleo, brillo (0-1.5) y radio en px
export const CAST_CFG = { Liche: { color: "#be64ff", core: "#ebc8ff", bright: 0.6, size: 46 }, Demon: { color: "#ff5a1e", core: "#ffc878", bright: 0.6, size: 46 }, Frost: { color: "#82c8ff", core: "#e6f8ff", bright: 0.6, size: 46 }, def: { color: "#ffdc78", core: "#fff5c8", bright: 0.6, size: 46 } };
fetch("data/cast_circle.json").then(r => r.ok ? r.json() : null).then(j => { if (j) for (const k in j) CAST_CFG[k] = { ...CAST_CFG[k], ...j[k] }; }).catch(() => {});
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(",");

export class Renderer {
  constructor(canvas, assets, grid) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: new URLSearchParams(location.search).get("desync") === "1" });      // desynchronized (?desync=1): sin esperar al compositor; en 0.83.2 causó parpadeo, por eso es opcional
    this.spr = assets.sprites;
    this.glc = null;                                       // compositor WebGL2 (teñidos y tono del suelo en shader), por defecto desde 0.83.4; ?gl=0 lo apaga y vuelve al 2D
    if (new URLSearchParams(location.search).get("gl") !== "0") { try { this.glc = new GLCompose(); } catch (e) { console.warn("WebGL2 no disponible, sigue el 2D", e); } }
    this.pcache = new PersonCache(this.spr, this.glc);               // personajes compuestos en atlas: un drawImage por persona
    this.pf = {};                                          // perfilador (?prof=1): fases a omitir {ground, ents, light, fx, med}
    this.pt = { ground: 0, ents: 0, light: 0, fx: 0 };      // ms por fase del último fotograma (registro de rendimiento)
    this.grid = grid;
    this.mapName = assets.meta.map;
    this.mode = "remastered";
    this.spr.hd = true;
    this.zoom = 1;
    this.cam = null;
    this.chunks = new Map();
    this.buildMinimap();
    this.resize();
  }

  setMap(grid, name) {
    this.grid = grid; this.mapName = name;
    this.cam = null; this.chunks.clear(); this.late?.clear(); this.wip?.clear(); this.buildMinimap();   // late/wip también: guardaban bloques del mapa anterior
  }

  // Luz dinámica (remastered): una capa de ambiente oscuro a la que cada personaje le abre un foco cálido, más un brillo aditivo encima.
  // Sombras largas: se alargan e inclinan hacia el lado contrario de la luz principal (arriba a la derecha).
  drawLights(s, ctx, VW, VH, camX, camY, time) {
    const L = this.lc || (this.lc = document.createElement("canvas")), g = L.getContext("2d");
    if (L.width !== VW || L.height !== VH) { L.width = VW; L.height = VH; }
    const night = s.sky?.night || 0, dark = 0.34 + 0.4 * night;
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, VW, VH);
    g.fillStyle = night > 0.05 ? "rgba(6,8,28," + dark + ")" : "rgba(14,12,30," + dark + ")";
    g.fillRect(0, 0, VW, VH);
    g.globalCompositeOperation = "destination-out";
    const spots = [];
    for (const e of s.world.ents.values()) {
      if (e.kind !== "player" || e.dead) continue;
      const [px, py] = posOf(e, time), x = px - camX, y = py - camY - 18;
      if (x < -300 || y < -300 || x > VW + 300 || y > VH + 300) continue;
      spots.push([x, y, e === s.me ? 230 + 60 * night : 130]);
    }
    for (const [x, y, R] of spots) {
      const f = 1 + 0.03 * Math.sin(time / 260 + x), r = R * f, h = g.createRadialGradient(x, y, 8, x, y, r);
      h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(0.55, "rgba(0,0,0,0.7)"); h.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = h; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.drawImage(L, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const [x, y, R] of spots) {
      const r = R * 0.9, h = ctx.createRadialGradient(x, y, 4, x, y, r);
      h.addColorStop(0, "rgba(255,190,110,0.20)"); h.addColorStop(0.5, "rgba(255,150,70,0.07)"); h.addColorStop(1, "rgba(255,140,60,0)");
      ctx.fillStyle = h; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
    const v = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(4,4,12,0.45)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
  }
  get shK() { return this.mode === "remastered" && this.lightFx ? [0.42, 0.6] : [1 / 3, 1 / 3]; }

  setMode(m) { this.mode = m; this.spr.hd = m === "remastered" && this.hdOpt !== false; this.cam = null; this.layout(); }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * this.dpr)), h = Math.max(1, Math.round(r.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.layout();
  }

  layout() {
    const cw = this.canvas.width, ch = this.canvas.height;
    if (this.mode === "classic") {
      this.scale = Math.min(cw / CLASSIC_W, ch / CLASSIC_H);
      this.viewW = CLASSIC_W; this.viewH = CLASSIC_H;
      this.ox = Math.round((cw - CLASSIC_W * this.scale) / 2);
      this.oy = Math.round((ch - CLASSIC_H * this.scale) / 2);
    } else {
      // misma altura de mundo que el original (600) y todo el ancho que dé la pantalla
      // en vertical (móvil) se limita por el ancho para no ver solo 9 casillas
      this.scale = Math.min(ch / CLASSIC_H, cw / 640) * this.zoom;
      this.viewW = cw / this.scale; this.viewH = ch / this.scale;
      this.ox = 0; this.oy = 0;
    }
    // rectángulo visible en píxeles CSS (para colocar el HUD encima)
    this.viewRect = {
      x: this.ox / this.dpr, y: this.oy / this.dpr,
      w: (this.viewW * this.scale) / this.dpr, h: (this.viewH * this.scale) / this.dpr,
    };
  }

  setZoom(z) { this.zoom = Math.max(0.75, Math.min(1.75, z)); this.layout(); }

  // píxel de pantalla (CSS) -> píxel del mundo
  toWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const px = (clientX - r.left) * this.dpr, py = (clientY - r.top) * this.dpr;
    return [(px - this.ox) / this.scale + this.camX, (py - this.oy) / this.scale + this.camY];
  }

  // rows: filas de casillas que se dibujan en esta llamada (el precalentado reparte un bloque entre varios fotogramas)
  groundChunk(cx, cy, rows = CHUNK) {
    const hd = !!this.spr.hd, k = cx + "," + cy + (hd ? "h" : "");
    let c = this.chunks.get(k);
    if (c) return c;
    const late = this.late || (this.late = new Map()), lt = late.get(k), now = performance.now();
    // bloque con hojas aún sin cargar: solo se rehace cuando llega alguna de las que faltaban (o cada 3 s por si una no llega nunca); antes, cada fotograma (40-200 ms c/u)
    if (lt && now - lt.t < 3000 && !lt.miss.some(m => this.spr.ready(m) && !(hd && this.spr.hdm[m] && this.spr.src(m)[1] === 1))) return lt.c;
    // Al llegar una hoja, los ~9 bloques visibles que la esperaban se rehacían en el mismo fotograma (28-33 ms de suelo durante ~12 s tras entrar, medido con ?prof=1): uno por fotograma, el resto sigue con la versión anterior
    if (lt && !this.wip?.has(k)) { if (this.lateBuilt >= 1) return lt.c; this.lateBuilt = 1; }
    const Q = hd ? 2 : 1;                                   // remastered: el suelo se pregenera al doble de resolución
    const wip = this.wip || (this.wip = new Map());
    let st = wip.get(k);
    if (!st) {
      c = document.createElement("canvas"); c.width = c.height = CHUNK * T * Q;
      const g = c.getContext("2d"); g.scale(Q, Q);
      g.imageSmoothingEnabled = hd; g.imageSmoothingQuality = "high";
      st = { c, g, j: 0, ready: true, miss: new Set() }; wip.set(k, st);
    }
    const { g } = st;
    const t0 = performance.now();
    // el precalentado (rows < CHUNK) corta a los 4 ms (mínimo una fila): en los primeros segundos cada fila cuesta 20-30 ms (hojas recién subidas a GPU) y 3 filas daban pasos de 60-230 ms
    for (const end = Math.min(CHUNK, st.j + rows); st.j < end && !(rows < CHUNK && st.j > 0 && performance.now() - t0 > 4); st.j++) for (let i = 0; i < CHUNK; i++) {
      const t = this.grid.tile(cx * CHUNK + i, cy * CHUNK + st.j);
      if (t) {
        if (!this.spr.ready("t" + t.spr)) { st.ready = false; st.miss.add("t" + t.spr); }
        else if (hd && this.spr.hdm["t" + t.spr] && this.spr.src("t" + t.spr)[1] === 1) { st.ready = false; st.miss.add("t" + t.spr); }   // espera a la hoja HD
        this.spr.put(g, "t" + t.spr, t.frame, i * T, st.j * T);
      }
    }
    if (st.j < CHUNK) return null;                          // a medias: quien lo pide por precalentado lo ignora
    if (hd && rows < CHUNK && !st.fin) { st.fin = true; return null; }   // el ajuste de tono (1024 px, varios drawImage) va en otro fotograma: antes se sumaba al último reparto de filas y daba el tirón
    wip.delete(k);
    if (st.ready && hd) {
      // El ajuste de tono pinta (multiply/lighter) sobre todo el bloque: donde no hay casilla (interiores: tienda, herrería, almacén; borde del mapa) dejaba manchas blancas/grises.
      // Se guarda el alfa original y se recorta el resultado a él.
      if (this.glc) this.blendTone(st.c, g, cx, cy, Q);          // en el shader: ya respeta el alfa del bloque
      else {
        const keep = this.toneMask || (this.toneMask = document.createElement("canvas")), kg = keep.getContext("2d");
        keep.width = st.c.width; keep.height = st.c.height; kg.drawImage(st.c, 0, 0);
        this.blendTone(st.c, g, cx, cy, Q);
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-in"; g.drawImage(keep, 0, 0); g.restore();
      }
    }
    // Una hoja pendiente no debe dejar un bloque vacío guardado para toda la partida.
    if (st.ready) { this.chunks.set(k, st.c); late.delete(k); } else late.set(k, { c: st.c, t: now, miss: [...st.miss] });
    if (this.chunks.size > 160) this.chunks.delete(this.chunks.keys().next().value);
    return st.c;
  }

  // color medio de una casilla (null si tiene transparencia: bordes y mezclas no se tocan)
  tileMean(t) {
    const key = "t" + t.spr, m = this.tmCache || (this.tmCache = new Map());
    let sheet = m.get(key);
    if (!sheet) {                                                  // una sola lectura por hoja: se reduce entera y se promedia en la CPU
      sheet = new Map(); m.set(key, sheet);
      const [img, k] = this.spr.src(key), S = 8, fs = T * k;       // 8x8 píxeles por casilla
      const w = Math.ceil(img.naturalWidth / fs) * S, h = Math.ceil(img.naturalHeight / fs) * S;
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const x = cv.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data;
      for (let f = 0, fr; (fr = this.spr.frame(key, f)); f++) {
        const gx = Math.round(fr[0] * k / fs) * S, gy = Math.round(fr[1] * k / fs) * S;
        let r = 0, g = 0, b = 0, a = 0;
        for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) { const o = ((gy + yy) * w + gx + xx) * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; a += d[o + 3]; }
        sheet.set(f, a < S * S * 250 ? null : [r / (S * S), g / (S * S), b / (S * S)]);
      }
    }
    return sheet.get(t.frame) ?? null;
  }
  // Las casillas del original tienen cada una su tono: se acerca el de cada casilla al de su vecindario (factor interpolado entre centros, sin saltos en los bordes)
  blendTone(c, g, cx, cy, Q) {
    const N = CHUNK, M = N + 2, mean = [];                       // medias de la rejilla con 1 casilla de margen
    for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++) { const t = this.grid.tile(cx * N + i, cy * N + j); mean.push(t && this.spr.ready("t" + t.spr) ? this.tileMean(t) : null); }
    const at = (i, j) => mean[(j + 1) * (N + 2) + (i + 1)];
    const fac = new Float32Array((N + 2) * (N + 2) * 3).fill(1);
    for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++) {
      const m0 = at(i, j); if (!m0) continue;
      const s = [0, 0, 0]; let n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const o = (i + di >= -1 && i + di <= N && j + dj >= -1 && j + dj <= N) ? at(i + di, j + dj) : null; if (o) { s[0] += o[0]; s[1] += o[1]; s[2] += o[2]; n++; } }
      for (let k = 0; k < 3; k++) fac[((j + 1) * M + i + 1) * 3 + k] = Math.min(1.15, Math.max(0.87, 1 + 0.85 * (s[k] / n / Math.max(m0[k], 8) - 1)));
    }
    // En la GPU: mapa de factores (1 px por casilla) ampliado con suavizado = interpolación bilineal entre centros.
    // Oscurecer = multiply; aclarar = suma (aprox.), sin recorrer píxeles en la CPU.
    const mk = (f) => { const cv = this.tnCv || (this.tnCv = [document.createElement("canvas"), document.createElement("canvas")]); return cv; };
    const [dk, br] = mk(); dk.width = dk.height = br.width = br.height = M;
    const dx = dk.getContext("2d"), bx = br.getContext("2d"), di = dx.createImageData(M, M), bi = bx.createImageData(M, M);
    for (let n = 0; n < M * M; n++) for (let k = 0; k < 3; k++) {
      const f = fac[n * 3 + k]; di.data[n * 4 + k] = Math.min(f, 1) * 255; bi.data[n * 4 + k] = Math.max(f - 1, 0) * 700;
      if (k === 0) { di.data[n * 4 + 3] = 255; bi.data[n * 4 + 3] = 255; }
    }
    dx.putImageData(di, 0, 0); bx.putImageData(bi, 0, 0);
    const P = T * Q;
    if (this.glc) {
      this.glc.tone(c, dk, br, N, M);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "copy"; g.drawImage(this.glc.cv, 0, 0); g.restore();
      return;
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.globalCompositeOperation = "multiply"; g.drawImage(dk, -P, -P, M * P, M * P);
    g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.14; g.drawImage(br, -P, -P, M * P, M * P);
    g.restore();
  }

  // ---------------------------------------------------------------- fotograma
  render(s) {
    const { ctx } = this;
    this.fx = s.fx;
    const remaster = this.mode === "remastered";
    const time = s.world.time;
    const [ppx, ppy] = posOf(s.me, time);

    // cámara: fija al personaje (clásico) o con un pequeño seguimiento suave (remastered)
    const tx = ppx - this.viewW / 2, ty = ppy - this.viewH / 2 - 4;
    if (!this.cam || !remaster) this.cam = [tx, ty];
    else {
      const k = 1 - Math.exp(-s.dt / 70);
      this.cam[0] += (tx - this.cam[0]) * k;
      this.cam[1] += (ty - this.cam[1]) * k;
      if (Math.abs(tx - this.cam[0]) > 200 || Math.abs(ty - this.cam[1]) > 200) this.cam = [tx, ty];
    }
    // alineada a píxel físico: sin temblor
    const q = this.quake, qa = q && performance.now() < q.until ? q.amp : 0;                  // temblor de pantalla (Demon al castear)
    const camX = this.camX = Math.round((this.cam[0] + (qa ? (Math.random() - 0.5) * 2 * qa : 0)) * this.scale) / this.scale;
    const camY = this.camY = Math.round((this.cam[1] + (qa ? (Math.random() - 0.5) * 2 * qa : 0)) * this.scale) / this.scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = remaster ? "#000" : "#0b0c0e";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, this.viewW, this.viewH); ctx.clip();

    const VW = this.viewW, VH = this.viewH;
    const tx0 = Math.floor(camX / T), ty0 = Math.floor(camY / T);
    const cols = Math.ceil(VW / T) + 1, rows = Math.ceil(VH / T) + 1;

    const P0 = performance.now();
    this.pcache.newFrame(); this.lateBuilt = 0;
    // 1) suelo
    const span = CHUNK * T;
    if (!this.pf.ground) for (let cy = Math.floor(camY / span); cy * span < camY + VH; cy++)
      for (let cx = Math.floor(camX / span); cx * span < camX + VW; cx++)
        if (cx >= 0 && cy >= 0) {
          // bordes del bloque alineados a píxel físico: con zoom fraccionario quedaba una línea oscura entre bloques
          const sc = this.scale, x0 = Math.floor((cx * span - camX) * sc), y0 = Math.floor((cy * span - camY) * sc);
          const x1 = Math.ceil(((cx + 1) * span - camX) * sc), y1 = Math.ceil(((cy + 1) * span - camY) * sc);
          ctx.drawImage(this.groundChunk(cx, cy), x0 / sc, y0 / sc, (x1 - x0) / sc, (y1 - y0) / sc);
        }

    // precalienta (1 paso por fotograma) los bloques de alrededor, primero los que quedan en la dirección de la marcha: sin tirón al correr
    {
      const hdk = this.spr.hd ? "h" : "", c0x = Math.floor(camX / span), c0y = Math.floor(camY / span), c1x = Math.floor((camX + VW) / span), c1y = Math.floor((camY + VH) / span);
      const pv = this.pcam, dt = Math.max(s.dt || 16, 1); this.pcam = [camX, camY];
      let vx = 0, vy = 0;
      if (pv) { vx = (camX - pv[0]) / dt; vy = (camY - pv[1]) / dt; }
      const lim = span * 1.5, ax = Math.max(-lim, Math.min(lim, vx * 1500)), ay = Math.max(-lim, Math.min(lim, vy * 1500));
      const mx = camX + VW / 2 + ax, my = camY + VH / 2 + ay;
      let best = null, bd = Infinity;
      for (let cy = c0y - 2; cy <= c1y + 2; cy++)
        for (let cx = c0x - 2; cx <= c1x + 2; cx++) {
          if (cx < 0 || cy < 0 || this.chunks.has(cx + "," + cy + hdk)) continue;
          const d = Math.hypot((cx + 0.5) * span - mx, (cy + 0.5) * span - my);
          if (d < bd) { bd = d; best = [cx, cy]; }
        }
      if (best) this.groundChunk(best[0], best[1], 3);
    }

    this.drawPortals(s, camX, camY);
    this.drawFields(s, camX, camY);
    this.drawBossFx(s, camX, camY);

    // 2) ayudas sobre el suelo (solo remastered): casilla bajo el cursor y ruta prevista
    if (remaster) {
      if (s.hover && !s.hoverEnt && !s.showGrid) {
        const [hx, hy] = s.hover;
        ctx.strokeStyle = this.grid.blocked(hx, hy) ? "rgba(230,90,80,.55)" : "rgba(255,240,200,.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(hx * T - camX + .5, hy * T - camY + .5, T - 1, T - 1);
      }
      if (s.path && s.path.length) {
        let x = s.me.x, y = s.me.y;
        ctx.fillStyle = "rgba(255,230,160,.5)";
        for (const d of s.path) {
          x += DX[d]; y += DY[d];
          ctx.beginPath(); ctx.arc(x * T + 16 - camX, y * T + 18 - camY, 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }
    }


    // sprites HD: se reducen con suavizado (los de 1x siguen sin él, como el original)
    ctx.imageSmoothingEnabled = !!this.spr.hd; ctx.imageSmoothingQuality = (this.q || 0) >= 1 ? "low" : "medium";     // "high" re-muestrea cada sprite con un filtro caro: con 30 personajes en pantalla eran 20 fps
    const P1 = performance.now();
    // 3) objetos en el suelo
    const labels = [];
    for (const list of s.world.items.values()) {
      const it = list[list.length - 1];
      const x = it.x * T + 16 - camX, y = it.y * T + 16 - camY;
      if (x < -40 || y < -40 || x > VW + 40 || y > VH + 40) continue;
      const d = itemDef(it.id);
      if (d) { if (s.bigItems) { ctx.save(); ctx.translate(x, y); ctx.scale(1.6, 1.6); this.spr.put(ctx, groundKey(d), d.spriteFrame, 0, 0); ctx.restore(); } else this.spr.put(ctx, groundKey(d), d.spriteFrame, x, y); }      // /bigitems
      const rar = it.id === 90 ? 0 : rarityOf(it.id, it.attr);
      if (rar >= 2) {                                                   // rayo de luz sobre el botín raro/único
        const g = ctx.createLinearGradient(0, y - 70, 0, y);
        g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, RARITY_COLOR[rar] + (rar === 3 ? "cc" : "88"));
        ctx.fillStyle = g; ctx.fillRect(x - 2, y - 70, 4, 70);
      }
      if (s.labels || rar >= 2 || (s.hover && s.hover[0] === it.x && s.hover[1] === it.y)) {
        labels.push([x, y - 14, it.id === 90 ? it.count + " oro" : itemName(it.id, it.attr, it.comp), it.id === 90 ? "#f0d080" : rar ? RARITY_COLOR[rar] : "#e8e2d0"]);
        if (s.groundInfo !== false && it.id !== 90 && d && !it.comp) {                            // atributos y precio de venta: para saber qué conviene recoger
          const info = attrLines(it.attr).join(" · "), price = sellPriceOf(d, it, isStack(d) ? it.count : 1);
          if (info) labels.push([x, y - 1, info, "#9fe39a"]);
          if (price && s.groundCost !== false) labels.push([x, y - 1 + (info ? 13 : 0), "Venta " + price.toLocaleString("en") + " oro", "#f0d080"]);
        }
      }
    }

    // 4) personajes y objetos del mapa, fila a fila (orden del cliente original)
    for (const e of s.world.ents.values()) {                                              // área de efecto del Dummy: anillo del color de su clase, por DEBAJO de los personajes
      if (!(e.comp && e.dcls && !e.dead && e.master === s.pid)) continue;
      const [px, py] = posOf(e, time), x = px - camX, y = py - camY;
      const R = (radiusOf(e.clvl || 1, e.dcls) + 0.5) * T, col = DUMMY_COLORS[e.dcls] || "#fff";
      ctx.save(); const g = ctx.createRadialGradient(x, y + 4, R * 0.6, x, y + 4, R); g.addColorStop(0, col + "00"); g.addColorStop(1, col + "26");       // BUG-015: velo muy tenue hacia el borde + línea fina discontinua (antes un anillo grueso pulsante)
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + 4, R, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.28; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.arc(x, y + 4, R, 0, Math.PI * 2); ctx.stroke(); ctx.restore();       // alcance euclídeo (dummy.inRange): círculo
    }
    const buckets = new Map();
    // compañeros que desaparecen (guardados en la bola, cambio de mapa...): se desvanecen en vez de borrarse de golpe
    const nowMs = performance.now(), mapId = s.world.map?.id, seen = this.seenComp || (this.seenComp = new Map()), fades = this.fades || (this.fades = new Map());
    for (const [id, o] of seen) if (!s.world.ents.has(id)) {
      seen.delete(id);
      if (!o.e.dead && o.map === mapId) fades.set(id, { e: o.e, t0: nowMs });
    }
    for (const e of s.world.ents.values()) { if (e.fadeAlpha != null && !fades.has(e.id)) delete e.fadeAlpha; if (e.comp && !e.dead) seen.set(e.id, { e, map: mapId }); }
    for (const [id, f] of fades) {
      const k = (nowMs - f.t0) / 1000;
      if (k >= 1 || s.world.ents.has(id)) { delete f.e.fadeAlpha; fades.delete(id); continue; }       // BUG-011: sin esto la opacidad parcial se quedaba pegada y el cuerpo del compañero no volvía a verse del todo
      f.e.fadeAlpha = 1 - k;
    }
    const bucket = e => {
      const [px, py] = posOf(e, time);
      if (px < camX - 120 || px > camX + VW + 120 || py < camY - 120 || py > camY + VH + 200) return;
      const moving = (e.act === ACT.MOVE || e.act === ACT.RUN) && time < e.actStart + e.actDur;
      const row = moving ? Math.max(e.y, e.fy) : e.y;
      const col = Math.round((px - 16) / T);
      const k = row * 100000 + col;
      let list = buckets.get(k);
      if (!list) buckets.set(k, (list = []));
      list.push([e, px - camX, py - camY]);
    };
    for (const e of s.world.ents.values()) bucket(e);
    for (const f of fades.values()) bucket(f.e);
    const overlays = [];
    this.bq = [];
    this.crowdNow = 0;                                   // LOD: con mucha gente en pantalla se omiten las sombras (el fotograma anterior decide)
    this.crowd = this.crowdLast || 0;
    for (let j = -2; j <= rows + 8; j++) {
      const ty = ty0 + j;
      for (let i = -7; i <= cols + 7; i++) {
        const tx = tx0 + i;
        const list = buckets.get(ty * 100000 + tx);
        if (list) {
          if (list.length > 1) list.sort((a, b) => (a[0].dead ? 0 : 1) - (b[0].dead ? 0 : 1));
          for (const [e, x, y] of list) { this.crowdNow++; if (!this.pf.ents) this.drawEntity(e, x, y, s, overlays); }
        }
        const t = this.grid.tile(tx, ty);
        if (!t || !t.obj) continue;
        const cx = tx * T + 16 - camX, cy = ty * T + 16 - camY;
        if (t.obj >= 100 && t.obj < 150) {             // árbol: sombra + árbol
          ctx.globalAlpha = 0.45;
          this.spr.put(ctx, "t" + (t.obj + 50), t.objFrame, cx, cy);
          ctx.globalAlpha = 1;
        }
        this.spr.put(ctx, "t" + t.obj, t.objFrame, cx - 16, cy - 16);
      }
    }

    this.crowdLast = this.crowdNow;
    const P2 = performance.now();
    this.pcache.warm(3);                                  // tiempo sobrante: precalienta los fotogramas siguientes de los personajes visibles
    if (s.showGrid) this.drawGrid(camX, camY, tx0, ty0, cols, rows);
    this.drawTeleportMarks(s, camX, camY, tx0, ty0, cols, rows);

    // 5) sin luz propia: el original no tiene viñeta ni luz dinámica (ticket 12); solo noche y lluvia (5b)

    // 5b) noche y lluvia
    if (s.sky && !this.pf.light) s.sky.draw(ctx, VW, VH, s.fx?.sp);

    const P3 = performance.now();
    // 6) barras de vida, nombres, etiquetas, efectos
    this.rects = [];
    if (!this.pf.fx) for (const o of overlays) o();
    for (const [x, y, text, color] of labels) this.label(x, y, text, color);
    for (const o of this.bq) o();                       // bocadillos: encima de nombres y etiquetas, sin pisarse entre sí
    this.bq = [];
    if (!this.pf.fx) s.fx.draw(ctx, camX, camY, this.mode); else s.fx.cull?.();      // perfilador: sin pintar, pero sin acumular partículas
    if (remaster && s.clickFx) this.drawClickFx(s.clickFx, camX, camY);
    if (s.showMinimap) (s.mapStyle === "overlay" ? this.drawOverlayMap : this.drawMinimap).call(this, s, ppx, ppy);
    ctx.restore();
    const P4 = performance.now(), pt = this.pt;
    pt.ground = P1 - P0; pt.ents = P2 - P1; pt.light = P3 - P2; pt.fx = P4 - P3;
  }

  // Auras de los escudos y del veneno (CheckActiveAura / CheckActiveAura2 del cliente original)
  auras(e, x, y, w, below) {
    if (!e.st || !below) return;
    const sp = this.fx?.sp || null;
    if (!sp) return;
    const t = performance.now(), ctx = this.ctx, pr = sget(w, e, "protect");
    if (pr === 3 || pr === 4) sp.put(ctx, 80, Math.floor(t / 80) % 17, x + 75, y + 107, "add", .5);
    if (pr === 2 || pr === 5) sp.put(ctx, 79, Math.floor(t / 80) % 15, x + 101, y + 135, "add", .7);
    if (pr === 1) sp.put(ctx, 72, Math.floor(t / 80) % 30, x, y + 35, "add", .7);
    if (sget(w, e, "poison")) sp.put(ctx, 81, Math.floor(t / 80) % 21, x + 115, y + 120 - (e.kind === "player" ? 75 : 40), "add", .7);
  }

  // Objetos dinámicos de los campos de hechizos: fuego, nube venenosa, tormenta de hielo y pinchos
  drawFields(s, camX, camY) {
    const dyn = s.world.dyn, sp = s.fx?.sp;
    if (!dyn || !dyn.length || !sp) return;
    const ctx = this.ctx, now = s.world.time;
    for (const f of dyn) {
      const x = f.x * T - camX, y = f.y * T - camY;
      if (x < -120 || y < -160 || x > this.viewW + 120 || y > this.viewH + 80) continue;
      const age = now - f.born, fr = Math.floor(age / 100) + (f.x * 7 + f.y * 3);
      const left = f.until - now;
      switch (f.type) {
        case 1: case 14: {
          const a = [.25, .5, .7][Math.floor(Math.random() * 3)];
          sp.put(ctx, 0, 1, x + 16, y + 16, "add", a);
          sp.put(ctx, 9, Math.floor((fr % 24) / 3), x + 16, y + 16, "add", .8);
          break;
        }
        case 10: {
          const phase = age < 800 ? Math.floor(age / 100) : left < 800 ? 16 + Math.floor((800 - left) / 100) : 8 + (fr % 8);
          sp.put(ctx, 23, Math.min(23, phase), x + 16 + Math.floor(Math.random() * 2), y + 16 + Math.floor(Math.random() * 2), "over", .5);
          break;
        }
        case 8:
          sp.put(ctx, 0, 1, x + 16, y + 16, "add", .6);
          sp.put(ctx, 13, fr % 10, x + 16, y + 16, "over", .7);
          break;
        case 9:
          sp.put(ctx, 17, fr % 13, x + 16, y + 16, "add", .7);
          break;
      }
    }
  }

  // Efectos de las mecánicas de los jefes (shared/systems/bosses.js): avisos, brasas, suelo helado, rugido, saltos, drenaje y enlaces del escudo
  drawBossFx(s, camX, camY) {
    const w = s.world, sp = s.fx?.sp, ctx = this.ctx;
    if (!sp) return;
    const now = w.time, perf = performance.now();
    const px = t => t * T - camX, py = t => t * T - camY;
    for (const z of w.bfx || []) {
      if (z.until <= now) continue;
      const prog = Math.min(1, (now - z.born) / Math.max(1, z.until - z.born)), r = z.r || 0;
      switch (z.kind) {
        case "warn": {                                                       // aviso: casillas que se rellenan antes del golpe
          ctx.fillStyle = z.col || "#ff5a1a"; ctx.strokeStyle = z.col || "#ff5a1a"; ctx.lineWidth = 2;
          ctx.globalAlpha = 0.12 + 0.3 * prog;
          ctx.fillRect(px(z.x - r), py(z.y - r), (2 * r + 1) * T, (2 * r + 1) * T);
          ctx.globalAlpha = 0.5 + 0.4 * Math.sin(perf / 90);
          ctx.strokeRect(px(z.x - r) + 1, py(z.y - r) + 1, (2 * r + 1) * T - 2, (2 * r + 1) * T - 2);
          ctx.globalAlpha = 1;
          break;
        }
        case "ember": {
          const x = px(z.x), y = py(z.y), fr = Math.floor((now - z.born) / 100) + z.x * 7 + z.y * 3;
          sp.put(ctx, 0, 1, x + 16, y + 16, "add", [.25, .5, .7][Math.floor(Math.random() * 3)]);
          sp.put(ctx, 9, Math.floor((fr % 24) / 3), x + 16, y + 16, "add", .8);
          break;
        }
        case "frost": {
          const fade = Math.min(1, (z.until - now) / 1500, (now - z.born) / 400 + .2);
          ctx.globalAlpha = 0.2 * fade; ctx.fillStyle = "#9fdcff";
          ctx.fillRect(px(z.x - r), py(z.y - r), (2 * r + 1) * T, (2 * r + 1) * T);
          ctx.globalAlpha = 1;
          for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
            const x = px(z.x + i), y = py(z.y + j);
            sp.put(ctx, 0, 1, x + 16, y + 16, "add", .18 * fade);
            if (Math.abs(i) === r && Math.abs(j) === r) sp.put(ctx, 13, Math.floor(perf / 110 + i * 3 + j) % 10, x + 16, y + 16, "over", .45 * fade);        // pinchos de hielo solo en las esquinas
          }
          break;
        }
        case "roar": {
          ctx.strokeStyle = "rgba(255,80,40," + (1 - prog) + ")"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(px(z.x) + 16, py(z.y) + 16, (r + .5) * T * prog + 8, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "blink": {
          const g = ctx.createLinearGradient(0, py(z.y) - 90, 0, py(z.y) + 20);
          g.addColorStop(0, "rgba(180,100,255,0)"); g.addColorStop(1, "rgba(180,100,255," + (0.7 * (1 - prog)) + ")");
          ctx.fillStyle = g; ctx.fillRect(px(z.x) + 4, py(z.y) - 90, 24, 110);
          break;
        }
        case "drain": {
          const a = w.ents.get(z.from), b = w.ents.get(z.to);
          if (!a || !b) break;
          ctx.strokeStyle = "rgba(190,90,255,.85)"; ctx.lineWidth = 3; ctx.beginPath();
          for (let k = 0; k <= 12; k++) {
            const t = k / 12, x = px(a.x) + 16 + (b.x - a.x) * T * t + Math.sin(perf / 70 + k) * 4, y = py(a.y) - 4 + (b.y - a.y) * T * t + Math.cos(perf / 80 + k) * 4;
            k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
          break;
        }
      }
    }
    // el escudo del jefe glacial: hilos de luz desde cada cristal hasta él
    for (const b of w.ents.values()) {
      if (!b.shield || b.dead) continue;
      for (const c of w.ents.values()) {
        if (!c.crystal || c.dead || c.owner !== b.id) continue;
        ctx.strokeStyle = "rgba(170,240,255," + (0.65 + 0.3 * Math.sin(perf / 150)) + ")"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(px(c.x) + 16, py(c.y) - 6); ctx.lineTo(px(b.x) + 16, py(b.y) - 20); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }

  // arena de apuestas (systems/arena.js): arena de arena con borde discontinuo dorado sobre el suelo de Aresfarm

  drawPortals(s, camX, camY) {
    const { ctx } = this;
    for (const gate of s.world.map?.portals || []) {
      const x = gate.x * T + 16 - camX, y = gate.y * T + 16 - camY;
      if (x < -150 || y < -80 || x > this.viewW + 150 || y > this.viewH + 80) continue;
      ctx.save();
      const near = Math.max(Math.abs(gate.x - s.me.x), Math.abs(gate.y - s.me.y)) <= 1;
      const closed = gate.locked && (s.world.map.remainingEnemies ?? 1) > 0;
      // salida = puerta de la entrada de dungeon del original, pegada a la pared izquierda; bajada = el hueco con escalera de la granja
      // (tools/make_crypt_assets.py); cerrada = apagada
      const pit = true, key = "cryptpit", oy = 0;          // hueco con escalera de teselas originales para bajada y salida
      ctx.globalAlpha = closed ? 0.6 : 1;
      this.spr.put(ctx, key, 0, x, y + oy);
      ctx.globalAlpha = 1;
      if (closed) this.spr.tinted(ctx, key, 0, x, y + oy, "#000000", 0.35);
      else if (near) this.spr.tinted(ctx, key, 0, x, y + oy, "#ffd890", 0.12 + 0.08 * Math.sin(s.world.time / 220), "lighter");
      const over = s.hover && Math.max(Math.abs(gate.x - s.hover[0]), Math.abs(gate.y - s.hover[1])) <= 1;     // el rótulo solo aparece al pasar el ratón o al estar junto a la entrada
      if (over || near) this.label(x, y - 40, gate.label + (closed ? " (cerrado)" : near ? " · E" : ""), closed ? "#e0a090" : "#bde8ff");
      ctx.restore();
    }
  }

  // Demon Lv 50: al caminar deja una estela sutil de brasas pequeñas que se apagan en ~1,2 s (como la nieve del Frost). Coordenadas de mundo (this.cam = cámara);
  // en el bestiario, sin cámara, el suelo se desliza hacia atrás a velocidad de paso.
  emberTrail(e, x, y, casting) {
    const ctx = this.ctx, now = performance.now(), DX = [0, 0, 1, 1, 1, 0, -1, -1, -1], DY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
    const cx = this.cam ? this.camX : DX[e.dir | 0] * now * 0.045, cy = this.cam ? this.camY : DY[e.dir | 0] * now * 0.045;
    const crk = this.crk || (this.crk = new Map());
    let L = crk.get(e.id); if (!L) crk.set(e.id, (L = []));
    const wx = x + cx, wy = y + cy, last = L[L.length - 1];
    if (casting && (e.act === ACT.MOVE || e.act === ACT.RUN) && !e.dead && (!last || Math.hypot(wx - last.x, wy - last.y) > 6)) { L.push({ x: wx + (Math.random() - 0.5) * 8, y: wy + (Math.random() - 0.5) * 3, t: now, r: Math.random() }); if (L.length > 30) L.shift(); }
    while (L.length && now - L[0].t > 1200) L.shift();
    if (!L.length) { crk.delete(e.id); return; }
    for (const c of L) {                                           // llamitas del Fire Field que se encogen y se apagan (Frost: huella de escarcha y vaho que sube)
      const k = (now - c.t) / 1200;
      if (look(e.name) === "Frost") {
        const px = c.x - cx, py = c.y - cy; ctx.save(); ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(170,225,255," + (0.35 * (1 - k)).toFixed(3) + ")"; ctx.beginPath(); ctx.ellipse(px, py, 3.2 - k, 1.4, 0, 0, Math.PI * 2); ctx.fill();
        const vg = ctx.createRadialGradient(px, py - 4 - k * 14, 0, px, py - 4 - k * 14, 4 + k * 5); vg.addColorStop(0, "rgba(225,245,255," + (0.22 * (1 - k)).toFixed(3) + ")"); vg.addColorStop(1, "rgba(225,245,255,0)");
        ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(px, py - 4 - k * 14, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore(); continue;
      }
      this.flame(c.x - cx, c.y - cy, 0.2 * (1 - k * 0.6), (1 - k) * 0.7, Math.floor(now / 100 + c.r * 8));
    }
  }

  // Llama del Fire Field original (fx.json hoja 9, aditiva), escalada; (x, y) = base de la llama
  flame(x, y, sc, a, f, flip) {
    const sp = this.fx?.sp, m = sp?.man?.fx9, img = sp?.getImg("fx9");
    if (!m || !img || !img.naturalWidth || a <= 0) return;
    const fr = m.frames[((f % 8) + 8) % 8], [sx, sy, sw, sh, px, py] = fr, ctx = this.ctx;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, a);
    if (flip) { ctx.translate(0, 2 * y); ctx.scale(1, -1); }                                      // llama al revés (cuelga hacia abajo)
    ctx.drawImage(img, sx, sy, sw, sh, Math.round(x + px * sc), Math.round(y - sh * sc),Math.max(1, Math.round(sw * sc)), Math.max(1, Math.round(sh * sc)));
    ctx.restore();
  }

  drawEntity(e, x, y, s, overlays) {
    const { ctx, spr } = this;
    if (e.kind === "npc" && e.comp && e.clvl >= 10 && (look(e.name) === "Demon" || look(e.name) === "Frost")) this.emberTrail(e, x, y, true);
    const remaster = this.mode === "remastered";
    const time = s.world.time;
    const hovered = s.hoverEnt === e || s.hoverCit === e;
    const flashAge = performance.now() - (s.fx.flash.get(e.id) || -1e9);
    if (e.stall) {          // BUG-001: un puesto de jugador se ve como un mostrador con géneros (sprites reales de objetos; el original no trae cofre)
      this.stallChest(x, y);
      overlays.push(() => this.origName(x, y - 6, [[e.stall.owner, "255,255,255"], ["(" + e.stall.title + ")", "255,220,120"]]));
      return;
    }

    if (e.kind === "player") {
      const ap = apparelOf(e, itemDef), bow = !!ap && ap.weapon >= 40 && ap.weapon < 60;        // arma 40..59 = arco (DrawObject_OnAttack)
      let { group, f, d } = playerSprite(e, time, bow);
      const look = e.look || DEFAULT_LOOK, gender = e.gender || 1;
      if (group === 7 && !this.spr.has(bodyKey(gender, look, 7, d))) group = 6;
      const body = bodyKey(gender, look, group, d);
      const w = s.world, invis = sget(w, e, "invis"), ice = sget(w, e, "ice") || (e.chillUntil || 0) > w.time, zerk = sget(w, e, "berserk");
      if (invis && e.id !== s.pid) return;                                   // los demás no ven a un invisible
      this.auras(e, x, y, w, true);
      if (invis) ctx.globalAlpha = 0.4;
      if (this.crowd < (this.crowdMax || 70) || e.id === s.pid) spr.shadow(ctx, body, f, x, y, remaster ? 0.5 : 0.75, ...this.shK);
      if (!this.pcache.draw(ctx, gender, look, group, d, f, x, y, ap, Math.min(2, Math.ceil(this.scale * 2) / 2))) { const T = performance.now(); drawPerson(ctx, spr, gender, look, group, d, f, x, y, ap); this.pcache.st.msDirect += performance.now() - T; this.pcache.st.nDirect = (this.pcache.st.nDirect || 0) + 1; }
      ctx.globalAlpha = 1;
      if (ice) spr.tinted(ctx, body, f, x, y, "#4a8cff", 0.5);
      if (zerk) spr.transRGB(ctx, body, f, x, y, 0, -5, -5);     // Game.cpp: PutTransSpriteRGB(…, 0, -5, -5)
      this.auras(e, x, y, w, false);
      if (remaster && flashAge < 140) spr.tinted(ctx, body, f, x, y, "#ff3020", 0.55 * (1 - flashAge / 140));
      // nombre de los demás jugadores y bocadillo de chat
      const other = s.pid !== undefined && e.id !== s.pid;
      const bubble = s.bubbles && s.bubbles.get(e.id);
      const talking = bubble && performance.now() < bubble.until;
      if (talking) this.bq.push(() => this.label(x, y - 62 - (other && !e.dead ? 17 : 0), bubble.text.length > 64 ? bubble.text.slice(0, 63) + "…" : bubble.text, "#ffffff", true));   // los bocadillos se dibujan al final y esquivan lo ya escrito
      overlays.push(() => {
        const yy = y - 78;
        if (!other && s.pid !== undefined && !e.dead && s.hoverSelf) {   // mi nombre, como el de los demás, solo al pasar el ratón (Game.cpp DrawObjects: nombre únicamente bajo el cursor)
          const gl = guildLine(e);                                       // DEF_MSG_GUILDMASTER / GUILDSMAN: «<Guild> Guildmaster» en gris bajo el nombre
          this.origName(x, y, gl ? [[e.name, "255,255,255"], [gl, "180,180,180"]] : [[e.name, "255,255,255"]]);
        } else if (other && !e.dead && s.hoverPlayer === e) {          // el de los demás solo al pasar el ratón por encima
          const party = s.me?.party?.names?.includes(e.name);
          const nm = e.name + (party ? ", Party Member" : "");          // BGET_NPC_NAME23
          const mine = s.me?.side || 0, foe = e.arena || (e.pk > 0) || (mine > 0 && e.side > 0 && e.side !== mine);     // _iGetFOE: rojo enemigo (otro bando) / verde aliado
          const sideName = e.side === 1 ? "Aresden Combatant" : e.side === 2 ? "Elvine Combatant" : "Traveller";
          const gl = guildLine(e);
          this.origName(x, y, [[nm, "255,255,255"], [foe && !(mine > 0 && e.side > 0) ? "Criminal" : sideName, foe ? "255,0,0" : mine > 0 && e.side > 0 ? "30,200,30" : "50,50,255"], ...(gl ? [[gl, "180,180,180"]] : [])]);   // DRAW_OBJECT_NAME60 / DEF_MSG_PK
        }
      });
      return;
    }

    // monstruo
    let { key, f } = mobSprite(e, time, k => this.spr.frames(k));
    if (e.crop) { key = "crop" + (31 + (e.dir || 1)); f = Math.min(2, Math.max(0, (e.a2 & 255) - 1)); }             // cultivo: hoja crop32.. (Game.cpp), fotograma = fase de crecimiento
    if (e.crystal) { key = "id1"; f = 1; }                                                     // cristal de hielo del jefe glacial: mineral 2 de item-dynamic (Game.cpp, DEF_DYNAMICOBJECT_MINERAL2)
    const act = actionAt(e, time);
    const alive = !e.dead && act !== ACT.DYING && act !== ACT.DEAD;                          // al morir se apagan todos los efectos y tintes (auras, escudo, ojos, orbe…)
    let alpha = TRANSLUCENT_MOBS.has(e.type) ? 0.62 : 1;
    if (e.fadeAlpha != null) alpha *= e.fadeAlpha;                                             // compañero guardado: se desvanece
    if (e.ghost) alpha *= 0.3;                                                                 // esqueleto fantasma: 30 % de opacidad
    if (e.clone) alpha *= 0.5 + 0.12 * Math.sin(time / 130 + e.id);                           // clon de sombra del rey umbrío: translúcido y parpadeante
    if (e.boss === 2 && !e.clone && e.hasClones && alive) {                                  // el real: aro violeta bajo los pies
      ctx.strokeStyle = "rgba(190,120,255," + (0.55 + 0.3 * Math.sin(time / 200)) + ")"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + 4, 26, 12, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (act === ACT.DEAD) {
      const left = e.actStart + e.actDur + CORPSE_MS - time;
      if (remaster && left < 1500) alpha *= Math.max(0, left / 1500);
    }
    if (remaster && e.special && alive) {
      const pulse = 0.55 + 0.25 * Math.sin(time / 220);
      const g = ctx.createRadialGradient(x, y + 2, 2, x, y + 2, 26);
      g.addColorStop(0, "rgba(" + AURA[e.special] + "," + pulse + ")");
      g.addColorStop(1, "rgba(" + AURA[e.special] + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y + 2, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Compañeros más altos que el personaje: nacen a la mitad de su altura (un golem es un mini golem) y crecen con el nivel hasta el tamaño real al nivel 50
    const sc = e.comp ? this.petScale(e, key, f) : 1;
    if (sc !== 1) { ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y); }
    let flare = 0;                                                                         // Demon al castear: el cuerpo se enciende (0..1)
    { const cc = e.comp && !e.dead && (s.fx || this.fx)?.scast?.get(e.id);
      if (cc && look(e.name) === "Demon" && e.clvl < 30) { /* Lv < 30: sin efecto de casteo */ }
      else if (cc && (look(e.name) === "Liche" || look(e.name) === "Frost") && e.clvl < 30) { /* idem */ }
      else if (cc) { if (look(e.name) === "Demon") { const ag = performance.now() - cc.at; flare = Math.max(0, Math.min(1, ag / 200, (1700 - ag) / 600)); } this.castCircle(ctx, x, y, cc, e, s.fx || this.fx); } }          // círculo de casteo del summon en nivel máximo: bajo sus pies, antes de la sombra y el sprite
    ctx.globalAlpha = alpha;
    if (!e.dead && !NO_SHADOW.has(e.type) && this.crowd < (this.crowdMax || 70)) spr.shadow(ctx, key, f, x, y, remaster ? 0.45 : 0.75, ...this.shK);   // DrawObject_OnStop: sin sombra
    const big = e.crystal ? 1.8 : e.boss === 4 ? 1.44 : e.boss ? 1.2 : 1;           // el último jefe (dorado) un 20 % mayor que los demás
    if (big !== 1) { ctx.save(); ctx.translate(x, y); ctx.scale(big, big); ctx.translate(-x, -y); }          // jefe: sprite un 20 % mayor y teñido
    const hover = e.comp && e.name === "Tutelary-Angel" ? 10 * (e.clvl >= 50 ? 1.2 : 1) + 1.5 * Math.sin(performance.now() / 450 + e.id) : 0;   // Pixie: flota sobre el suelo (la sombra queda abajo)
    if (hover) { ctx.save(); ctx.translate(0, -hover); }
    const isD = e.comp && look(e.name) === "Demon", isF = e.comp && look(e.name) === "Frost";
    if ((isD || isF) && e.clvl >= 30 && alive) {                                          // Demon/Frost Lv >= 30: brillo en el borde del sprite (fuego / hielo); la intensidad recorre el contorno (se dibuja detrás del cuerpo)
      const L = e.clvl, rad = L >= 50 ? 1.8 : L >= 40 ? 1.5 : 1.2, tt = performance.now() / 1000, c1 = isF ? "#d8f4ff" : "#ffb030", c2 = isF ? "#3a8cff" : "#ff4a08";
      for (let n = 0; n < 12; n++) {
        const an = n * Math.PI / 6, w = 0.5 + 0.5 * Math.sin(tt * 3.2 - an * 2 + e.id);
        spr.tinted(ctx, key, f, x + Math.cos(an) * rad, y + Math.sin(an) * rad, w > 0.6 ? c1 : c2, (0.025 + 0.065 * w) * alpha, "lighter");
      }
    }
    spr.put(ctx, key, f, x, y);
    if (isD && e.clvl >= 20 && alive) {                                                  // Demon Lv 20: el cuerpo late como brasa y las grietas oscuras se ven al rojo; Lv 30: huesos y venas de las alas; 50: más venas
      const pu = 0.5 + 0.5 * Math.sin(performance.now() / 420 + e.id), L = e.clvl;
      if (L < 30) { spr.tinted(ctx, key, f, x, y, "#ff2a00", (0.05 + 0.07 * pu) * alpha, "lighter"); spr.veins(ctx, key, f, x, y, "#ff7a18", (0.07 + 0.06 * pu) * alpha, 45); }
      else spr.veins(ctx, key, f, x, y, "#ff5a10", (0.11 + 0.08 * Math.sin(performance.now() / 420 + e.id)) * alpha * (L >= 50 ? 1 : 0.75), L >= 50 ? 95 : 75);
    }
    if (isF && e.clvl >= 50 && alive) spr.veins(ctx, key, f, x, y, "#7fd0ff", (0.12 + 0.08 * Math.sin(performance.now() / 500 + e.id)) * alpha, 95);   // venas de hielo brillantes
    if (isF && e.clvl < 10 && alive) spr.tinted(ctx, key, f, x, y, "#1c2536", 0.4);        // Frost Lv < 10: hielo apagado, gris azulado oscuro
    if (e.boss && alive) spr.tinted(ctx, key, f, x, y, BOSS_COLORS[e.boss] || "#ff3b2e", 0.5);
    else if (e.kind === "npc" && alive && !e.clone && !e.crystal && !e.comp && !e.master && s.world.map?.kind === "dungeon")      // esbirros: tinte leve del rey del tramo, para que el jefe resalte
      spr.tinted(ctx, key, f, x, y, BOSS_COLORS[Math.min(4, Math.ceil((s.world.map.level || 1) / 5))], 0.14);
    if (e.comp && look(e.name) === "Liche") spr.tinted(ctx, key, f, x, y, "#000000", 0.35);        // Liche: su color original, solo más oscuro
    if (e.comp && look(e.name) === "Demon" && e.clvl < 10 && alive) spr.tinted(ctx, key, f, x, y, "#000000", 0.38);   // Demon Lv < 10: brasa apagada (ceniza); se enciende al llegar al 10
    if (flare > 0 && alive) spr.tinted(ctx, key, f, x, y, "#ff8a20", 0.3 * flare, "lighter");   // Demon casteando: el cuerpo arde
    if (e.crystal && alive) spr.tinted(ctx, key, f, x, y, "#8fe8ff", 0.2 + 0.15 * Math.sin(time / 260 + e.id), "lighter");
    if (e.shield && alive) spr.tinted(ctx, key, f, x, y, "#bff0ff", 0.35 + 0.15 * Math.sin(time / 200), "lighter");   // escudo de hielo
    if (e.wrath && alive) spr.tinted(ctx, key, f, x, y, "#ffb020", 0.07 * e.wrath, "lighter");                // contador de furia del rey dorado
    if (big !== 1) ctx.restore();
    if (hover) ctx.restore();
    if (e.shield && alive) { ctx.strokeStyle = "rgba(170,230,255,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 20, 30, 40, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (alive && (sget(s.world, e, "ice") || (e.chillUntil || 0) > s.world.time)) spr.tinted(ctx, key, f, x, y, "#4a8cff", 0.5);
    if (alive && sget(s.world, e, "berserk")) spr.transRGB(ctx, key, f, x, y, 0, -5, -5);
    if (alive) this.auras(e, x, y, s.world, true);
    if (remaster) {
      if (flashAge < 150) spr.tinted(ctx, key, f, x, y, "#ffffff", 0.75 * (1 - flashAge / 150));
      else if (hovered && alive) spr.tinted(ctx, key, f, x, y, "#ffe8b0", 0.22, "lighter");
    }
    { const glow = Math.max(this.fx?.evoGlow?.(e.id) || 0, e.evoK > 0 ? e.evoK * (0.15 + 0.2 * Math.abs(Math.sin(performance.now() / 1000 * (1 + 10 * e.evoK) * Math.PI))) : 0);
      if (glow > 0 && !e.dead) spr.tinted(ctx, key, f, x, y, "#ffffff", Math.min(1, glow), "lighter"); }
    if (e.comp && look(e.name) === "Cyclops" && e.clvl >= 50 && (act === ACT.DYING || act === ACT.DEAD)) {   // Cyclops Lv 50 eléctrico: al caer, descargas recorren el cuerpo y se van apagando
      const t = time - (e.actStart || 0), lin = Math.max(0, 1 - t / ((e.actDur || 700) + 2600)), inten = lin * lin;   // curva que cae rápido y se arrastra: se va apagando
      this.clawPos(key, f); const bb = this._cbox?.get(key + ":" + f);
      if (inten > 0 && bb) {
        const ep = Math.floor(time / 60), rnd = (q) => { const h = Math.sin(q * 12.9898 + e.id) * 43758.5453; return h - Math.floor(h); };
        const live = rnd(ep * 1.7 + 3) < 0.35 + 0.65 * lin;                              // cada vez más cortes: la corriente falla y vuelve
        const px = (u) => x + bb.x0 + (bb.x1 - bb.x0) * u, py = (v) => y + bb.y0 + (bb.y1 - bb.y0) * v;
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (live) spr.tinted(ctx, key, f, x, y, "#7fb8ff", Math.min(1, inten * (0.25 + 0.5 * rnd(ep))), "lighter");        // el cuerpo parpadea en azul eléctrico
        for (let a = 0; a < (live ? Math.ceil(5 * lin) : 0); a++) {                          // menos arcos cada vez; arcos entre puntos del cuerpo, cambian cada 60 ms
          let u = rnd(ep * 7 + a * 13), v = 0.1 + 0.8 * rnd(ep * 5 + a * 17);
          const u2 = Math.min(1, Math.max(0, u + (rnd(ep * 3 + a * 19) - 0.5) * 0.7)), v2 = Math.min(1, Math.max(0, v + (rnd(ep * 11 + a * 23) - 0.5) * 0.5));
          ctx.beginPath(); ctx.moveTo(px(u), py(v));
          for (let k = 1; k <= 5; k++) { const w = k / 5, j = k === 5 ? 0 : (rnd(ep * 3 + a * 11 + k * 29) - 0.5) * 9; ctx.lineTo(px(u + (u2 - u) * w) + j, py(v + (v2 - v) * w) - j * 0.6); }
          ctx.strokeStyle = "rgba(90,170,255," + (0.45 * inten).toFixed(2) + ")"; ctx.lineWidth = 3; ctx.stroke();
          ctx.strokeStyle = "rgba(235,250,255," + (0.9 * inten).toFixed(2) + ")"; ctx.lineWidth = 1; ctx.stroke();
        }
        for (let k = 0; k < Math.ceil(6 * lin); k++) { const q = (time / 450 + rnd(k + 70)) % 1; ctx.fillStyle = "rgba(200,235,255," + (0.9 * (1 - q) * inten).toFixed(2) + ")"; ctx.fillRect(px(rnd(k + 80)), py(rnd(k + 90)) - q * 14, 2, 2); }
        ctx.restore();
      }
    }
    const fade = alive ? 1 : act === ACT.DYING ? Math.max(0, 1 - (time - (e.actStart || 0)) / Math.max(1, e.actDur || 700) * 1.6) : 0;   // al morir las luces se apagan en fundido
    // Ticket 5: el aura de evolución no titila sin parar; late una vez por minuto (~6 s, fundido suave), con fase propia por criatura.
    const evoEnv = (() => { const per = 60000, dur = 6000, ph = (time + (e.id * 7919) % per) % per; return ph < dur ? Math.sin(ph / dur * Math.PI) : 0; })();
    if (e.comp && fade > 0 && evoEnv > 0.02 && (look(e.name) === "Liche" ? e.clvl >= 20 : look(e.name) === "Demon" ? e.clvl >= 10 : look(e.name) === "Cyclops" || look(e.name) === "Tutelary-Angel" ? e.clvl >= 30 : e.clvl >= 20 && look(e.name) === "Frost")) {   // summon evolucionado en nivel máximo: aura propia continua (solo Demon, Frost y Liche Lv 50)
      const sp = this.fx?.sp, seed = e.id * 997, T = time + seed, rnd = (k) => { const h = Math.sin(k * 12.9898 + e.id) * 43758.5453; return h - Math.floor(h); };
      ctx.save(); ctx.globalAlpha = (look(e.name) === "Liche" || look(e.name) === "Cyclops" ? 1 : 0.5) * fade * evoEnv;                          // Demon y Frost más sutiles, a la altura del Liche
      if (look(e.name) === "Demon") {                                                          // Lv 10 ojos de brasa, 40 calor y chispas lentas, 50 más intensos
        const L = e.clvl, pulse = 0.5 + 0.5 * Math.sin(T / 380);
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        const ea = (0.6 + 0.35 * pulse) * Math.max(0, 1 - (1 - fade) * 2.5), an = this.spr.anchors?.[key]?.eyes?.[f];          // ojos en el ancla de la cara de ESTE fotograma (anchors.json)
        if (an && ea > 0) for (const dx0 of [-3, 3]) { const ex2 = x + an[0] + dx0 * (e.dir === 5 ? 1 : 0.7), ey2 = y + an[1]; const eg = ctx.createRadialGradient(ex2, ey2, 0, ex2, ey2, 5); eg.addColorStop(0, "rgba(255," + (L >= 50 ? 200 : 120) + ",40," + ea.toFixed(2) + ")"); eg.addColorStop(1, "rgba(200,20,0,0)"); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex2, ey2, 6, 0, Math.PI * 2); ctx.fill(); }
        if (L >= 40) {
          const ns = L >= 50 ? 14 : 8;
          for (let n = 0; n < ns; n++) {                                                // chispas lentas que suben de los hombros
            const q = ((T / 2600 + rnd(n + 7)) % 1), px = x + (n % 2 ? 1 : -1) * (8 + rnd(n + 30) * 14) + Math.sin(q * 6 + n) * 4, py = y - 40 - q * 46;
            ctx.fillStyle = "rgba(255," + (120 + 100 * rnd(n + 50) | 0) + ",40," + (0.9 * Math.sin(q * Math.PI)).toFixed(2) + ")"; ctx.fillRect(px, py, 2, 2);
          }
          ctx.lineWidth = 1.5; ctx.lineCap = "round";
          for (let n = 0; n < 3; n++) {                                                // ondas de calor sobre los hombros y la cabeza
            const q = ((T / 1800 + n / 3) % 1); ctx.strokeStyle = "rgba(255,150,60," + (0.12 * Math.sin(q * Math.PI)).toFixed(3) + ")"; ctx.beginPath();
            for (let k = -22; k <= 22; k += 4) { const px = x + k, py = y - 52 - q * 24 + Math.sin(k * 0.3 + T / 260) * 2.5; k === -22 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.stroke();
          }
        }
        ctx.restore();
      } else if (look(e.name) === "Cyclops") {                                                 // Lv 50 eléctrico: arcos que saltan de las pinzas de las manos, halo azul y chispas
        const cl = this.clawPos(key, f), L = e.clvl, full = L >= 50, body = L >= 40, wk = full ? 1 : body ? 0.7 : 0.4;   // 30 solo destello en las pinzas, 40 + efecto en el cuerpo, 50 todos los efectos
        const pa = full && act === ACT.ATTACK ? (time - (e.actStart || 0)) / Math.max(1, e.actDur || 600) : -1, chg = pa < 0 || pa > 1 ? 0 : pa < 0.7 ? pa / 0.7 : 1 - (pa - 0.7) / 0.3;   // ataque: carga leve de poder, sube hasta el golpe (70 %) y se descarga
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (let n = 0; n < (cl?.length || 0); n++) {
          const tx = x + cl[n].x, ty = y + cl[n].y, pu = 0.5 + 0.5 * Math.sin(T / 90 + n * 2);
          const hg = ctx.createRadialGradient(tx, ty, 0, tx, ty, (17 + 3 * pu + 7 * chg) * (0.6 + 0.4 * wk)); hg.addColorStop(0, "rgba(235,250,255," + Math.min(1, 0.55 + 0.25 * pu + 0.3 * chg).toFixed(2) + ")"); hg.addColorStop(0.4, "rgba(90,170,255," + (0.3 + 0.12 * pu).toFixed(2) + ")"); hg.addColorStop(1, "rgba(40,90,255,0)");
          ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(tx, ty, 26, 0, Math.PI * 2); ctx.fill();
          if (chg > 0 && pa < 0.7) for (let k = 0; k < 5; k++) {                       // chispas que se pliegan hacia la pinza mientras carga
            const an = rnd(k * 7 + n * 3 + 1) * Math.PI * 2, rr = (1 - pa / 0.7) * (10 + 16 * rnd(k + n * 5 + 9)) + 2;
            ctx.fillStyle = "rgba(215,240,255," + (0.35 + 0.5 * chg).toFixed(2) + ")"; ctx.fillRect(tx + Math.cos(an + T / 300) * rr, ty + Math.sin(an + T / 300) * rr, 2, 2);
          }
          const ep = Math.floor(T / 70);                                              // los arcos cambian cada ~70 ms (parpadeo eléctrico)
          for (let a = 0; a < (full ? 2 : 0); a++) {
            const r0 = rnd(ep * 7 + a * 13 + n * 31), r1 = rnd(ep * 5 + a * 17 + n * 47), ang = r0 * Math.PI * 2, len = 8 + r1 * 11 + 6 * chg;
            let px = tx, py = ty; const ex = tx + Math.cos(ang) * len, ey = ty + Math.sin(ang) * len, seg = 5;
            ctx.beginPath(); ctx.moveTo(px, py);
            for (let k = 1; k <= seg; k++) { const u = k / seg, j = k === seg ? 0 : (rnd(ep * 3 + a * 11 + k * 19 + n * 53) - 0.5) * 9; px = tx + (ex - tx) * u - Math.sin(ang) * j; py = ty + (ey - ty) * u + Math.cos(ang) * j; ctx.lineTo(px, py); }
            ctx.strokeStyle = "rgba(90,170,255,0.4)"; ctx.lineWidth = 3; ctx.stroke();
            ctx.strokeStyle = "rgba(235,250,255,0.85)"; ctx.lineWidth = 1; ctx.stroke();
          }
          for (let k = 0; k < (full ? 2 : 0); k++) { const q = ((T / 500 + rnd(k + n * 9 + 5)) % 1); ctx.fillStyle = "rgba(200,235,255," + (0.9 * (1 - q)).toFixed(2) + ")"; ctx.fillRect(tx + (rnd(k + n * 7 + 20) - 0.5) * 18, ty + (rnd(k + n * 5 + 40) - 0.5) * 18 - q * 10, 2, 2); }
        }
        if (true) {                                                                     // destello blanco: el halo de las pinzas se enciende de golpe a intervalos
          const fq = (T / 1300) % 1, fa = fq < 0.12 ? 1 - fq / 0.12 : 0;
          if (fa > 0) for (const c of cl || []) { const tx = x + c.x, ty = y + c.y, fg = ctx.createRadialGradient(tx, ty, 0, tx, ty, 22); fg.addColorStop(0, "rgba(255,255,255," + (0.9 * fa).toFixed(2) + ")"); fg.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(tx, ty, 22, 0, Math.PI * 2); ctx.fill(); }
        }
        const bb = body && this._cbox?.get(key + ":" + f);
        if (bb) {                                                                       // electricidad mínima sobre el cuerpo: parpadeo azul tenue y pequeños arcos que saltan por la piel
          const eb = Math.floor(T / 130), bx = (u) => x + bb.x0 + (bb.x1 - bb.x0) * u, by = (v) => y + bb.y0 + (bb.y1 - bb.y0) * v;
          if (rnd(eb * 2.3 + 1) > 0.6) this.spr.tinted(ctx, key, f, x, y, "#7fb8ff", 0.08 + 0.1 * rnd(eb), "lighter");
          for (let a = 0; a < 2; a++) {
            if (rnd(eb * 3 + a * 7 + 11) < 0.45) continue;
            const u = 0.25 + 0.5 * rnd(eb * 5 + a * 13), v = 0.15 + 0.7 * rnd(eb * 7 + a * 17), ang = rnd(eb * 9 + a * 19) * Math.PI * 2;
            ctx.beginPath(); ctx.moveTo(bx(u), by(v));
            for (let k = 1; k <= 3; k++) ctx.lineTo(bx(u) + Math.cos(ang) * k * 3 + (rnd(eb * 4 + a * 5 + k * 23) - 0.5) * 4, by(v) + Math.sin(ang) * k * 3 + (rnd(eb * 6 + a * 3 + k * 29) - 0.5) * 4);
            ctx.strokeStyle = "rgba(90,170,255,0.3)"; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = "rgba(225,245,255,0.75)"; ctx.lineWidth = 1; ctx.stroke();
          }
        }
        if (full && cl?.length === 2 && rnd(Math.floor(T / 110)) > 0.7) {                  // de cuando en cuando un arco salta de una pinza a la otra
          const ep = Math.floor(T / 110); ctx.beginPath(); ctx.moveTo(x + cl[0].x, y + cl[0].y);
          for (let k = 1; k <= 7; k++) { const u = k / 7, j = k === 7 ? 0 : (rnd(ep * 9 + k * 23) - 0.5) * 12; ctx.lineTo(x + cl[0].x + (cl[1].x - cl[0].x) * u, y + cl[0].y + (cl[1].y - cl[0].y) * u + j); }
          ctx.strokeStyle = "rgba(90,170,255,0.5)"; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = "rgba(235,250,255,0.9)"; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.restore();
      } else if (e.name === "Tutelary-Angel") {                                               // Pixie: 30 destellos en las alas y motas, 40 + brillo en el cuerpo y motas orbitando, 50 + halo y copos de luz
        const L = e.clvl, full = L >= 50, body = L >= 40; this.clawPos(key, f); const bb = this._cbox?.get(key + ":" + f);
        if (bb) {
          const hv = hover, bx = (u) => x + bb.x0 + (bb.x1 - bb.x0) * u, by = (v) => y - hv + bb.y0 + (bb.y1 - bb.y0) * v, cx = bx(0.5), cy = by(0.5), st = Math.floor(T / 90);
          ctx.save(); ctx.globalCompositeOperation = "lighter";
          const fq = (T / 1500) % 1, fa = fq < 0.14 ? 1 - fq / 0.14 : 0;                    // destello blanco en las puntas de las alas a intervalos
          if (fa > 0) for (const u of [0.05, 0.95]) { const tx = bx(u), ty = by(0.3), fg = ctx.createRadialGradient(tx, ty, 0, tx, ty, 9); fg.addColorStop(0, "rgba(255,255,255," + (0.85 * fa).toFixed(2) + ")"); fg.addColorStop(1, "rgba(255,240,200,0)"); ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(tx, ty, 9, 0, Math.PI * 2); ctx.fill(); }
          for (let n = 0; n < 3; n++) { const q = ((T / 1800 + rnd(n + 3)) % 1); ctx.fillStyle = "rgba(255,245,200," + (0.8 * Math.sin(q * Math.PI)).toFixed(2) + ")"; ctx.fillRect(Math.round(cx + (rnd(n + 11) - 0.5) * 22), Math.round(cy - q * 16), 2, 2); }   // motas de polvo de luz que suben
          if (body) {
            if (rnd(Math.floor(T / 130) * 2.3 + 1) > 0.5) this.spr.tinted(ctx, key, f, x, y - hv, "#d8f4ff", 0.08 + 0.08 * rnd(Math.floor(T / 130)), "lighter");   // el cuerpo parpadea en azul hielo
            for (let n = 0; n < 5; n++) { const an = T / 1100 + n * Math.PI * 2 / 5, ox = Math.round(cx + Math.cos(an) * 15), oy = Math.round(cy + Math.sin(an) * 6 - 2); ctx.fillStyle = "rgba(190,235,255," + (0.55 + 0.35 * Math.sin(T / 200 + n)).toFixed(2) + ")"; ctx.fillRect(ox, oy, 2, 2); }   // motas que la orbitan
          }
          if (full) {
            const hy = by(0) - 3; ctx.strokeStyle = "rgba(255,235,160," + (0.5 + 0.2 * Math.sin(T / 300)).toFixed(2) + ")"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, hy, 7, 2.2, 0, 0, Math.PI * 2); ctx.stroke();   // halo sobre la cabeza
            for (let n = 0; n < 6; n++) { const q = ((T / 2400 + rnd(n + 21)) % 1); ctx.fillStyle = "rgba(235,248,255," + (0.85 * Math.sin(q * Math.PI)).toFixed(2) + ")"; ctx.fillRect(Math.round(cx + (rnd(n + 31) - 0.5) * 30 + Math.sin(q * 5 + n) * 3), Math.round(by(0.1) + q * 26), 2, 2); }   // copos de luz que caen
            if (st % 3 === 0) this.spr.tinted(ctx, key, f, x, y - hv, "#fff6d0", 0.06, "lighter");
          }
          ctx.restore();
        }
      } else if (look(e.name) === "Liche") {                                                   // oscuridad que da miedo: sombra bajo él, humo negro que sube, ojos ardientes (mirando hacia abajo, abajo-izquierda y abajo-derecha)
        const pulse = 0.5 + 0.5 * Math.sin(T / 420);
        ctx.save();
        const smoke = e.clvl >= 30, eyes = e.clvl >= 50;                                   // Lv 20 báculo encendido, 30 humo (y círculo), 50 ojos rojos
        if (smoke) {
        const g = ctx.createRadialGradient(x, y, 3, x, y, 40); g.addColorStop(0, "rgba(0,0,0," + (0.7 + 0.2 * pulse).toFixed(2) + ")"); g.addColorStop(0.6, "rgba(25,0,45,0.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 2, 40, 18, 0, 0, Math.PI * 2); ctx.fill();
        for (let n = 0; n < 9; n++) {                                                   // jirones de humo oscuro
          const q = ((T / 2200 + rnd(n + 7)) % 1), px = x + (rnd(n + 30) - 0.5) * 36 + Math.sin(q * 5 + n * 2) * 7, py = y - 2 - q * 62, r = 6 + q * 9;
          const sg = ctx.createRadialGradient(px, py, 0, px, py, r); sg.addColorStop(0, "rgba(8,0,18," + (0.5 * Math.sin(q * Math.PI)).toFixed(2) + ")"); sg.addColorStop(1, "rgba(8,0,18,0)");
          ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        }
        }
        ctx.globalCompositeOperation = "lighter";
        const ea = (0.55 + 0.4 * pulse) * Math.max(0, 1 - (1 - fade) * 2.5), an = this.spr.anchors?.[key]?.eyes?.[f];           // dos ojos rojos en el ancla de la cara de ESTE fotograma (anchors.json); se apagan antes que el orbe
        if (eyes && an && ea > 0) for (const dx0 of [-3, 3]) { const ex2 = x + an[0] + dx0 * (e.dir === 5 ? 1 : 0.7), ey2 = y + an[1]; const eg = ctx.createRadialGradient(ex2, ey2, 0, ex2, ey2, 5); eg.addColorStop(0, "rgba(255,40,40," + ea.toFixed(2) + ")"); eg.addColorStop(1, "rgba(120,0,40,0)"); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex2, ey2, 6, 0, Math.PI * 2); ctx.fill(); }
        const orb = this.spr.anchors?.[key]?.orb?.[f] ? { x: this.spr.anchors[key].orb[f][0], y: this.spr.anchors[key].orb[f][1] } : this.orbPos(key, f);                                                // orbe violeta del báculo: halo que late y chispas que suben
        if (orb) {
          const ox = x + orb.x, oy = y + orb.y, op = 0.5 + 0.5 * Math.sin(T / 300);
          const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, 13 + 3 * op); og.addColorStop(0, "rgba(230,170,255," + (0.55 + 0.3 * op).toFixed(2) + ")"); og.addColorStop(0.45, "rgba(160,60,255," + (0.3 + 0.2 * op).toFixed(2) + ")"); og.addColorStop(1, "rgba(80,0,160,0)");
          ctx.fillStyle = og; ctx.beginPath(); ctx.arc(ox, oy, 17, 0, Math.PI * 2); ctx.fill();
          for (let n = 0; n < 5; n++) { const q = ((T / 900 + rnd(n + 60)) % 1); ctx.fillStyle = "rgba(210,130,255," + (0.9 * (1 - q)).toFixed(2) + ")"; ctx.fillRect(ox + (rnd(n + 70) - 0.5) * 12 + Math.sin(q * 7 + n) * 3, oy - q * 22, 2, 2); }
        }
        ctx.restore();
      } else {                                                                           // Frost: 20 nieve y bruma, 30 ojos y báculo, 40 cristales, 50 viento helado en espiral
        const L = e.clvl; ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
        { const nm = L >= 40 ? 5 : 3;                                                   // bruma fría a los pies
          for (let n = 0; n < nm; n++) { const q = ((T / 3200 + n / nm) % 1), mx = x + Math.sin(T / 1500 + n * 2.1) * 16 + (n - nm / 2) * 9, my = y - 1 - q * 8, r = 13 + q * 6;
            const mg = ctx.createRadialGradient(mx, my, 0, mx, my, r); mg.addColorStop(0, "rgba(200,232,255," + ((L >= 40 ? 0.2 : 0.13) * Math.sin(q * Math.PI)).toFixed(3) + ")"); mg.addColorStop(1, "rgba(200,232,255,0)");
            ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(mx, my, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); } }
        for (let n = 0; n < 12; n++) {                                                  // copos finos que caen despacio
          const q = ((T / 4200 + rnd(n + 90)) % 1), px = x - 30 + rnd(n + 100) * 60 + Math.sin(q * 8 + n) * 5, py = y - 70 + q * 70;
          ctx.fillStyle = "rgba(235,250,255," + (0.8 * Math.sin(q * Math.PI)).toFixed(2) + ")"; ctx.fillRect(px, py, 1.5, 1.5);
        }
        if (L >= 30) {
          const pu = 0.5 + 0.5 * Math.sin(T / 380), ea = (0.6 + 0.35 * pu) * Math.max(0, 1 - (1 - fade) * 2.5), an = this.spr.anchors?.[key]?.eyes?.[f];          // ojos azules en el ancla de la cara
          if (an && ea > 0) for (const dx0 of [-3, 3]) { const ex2 = x + an[0] + dx0, ey2 = y + an[1]; const eg = ctx.createRadialGradient(ex2, ey2, 0, ex2, ey2, 5); eg.addColorStop(0, "rgba(150,230,255," + ea.toFixed(2) + ")"); eg.addColorStop(1, "rgba(30,90,255,0)"); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex2, ey2, 6, 0, Math.PI * 2); ctx.fill(); }
        }
        if (L >= 40) for (let n = 0; n < 3; n++) {                                      // cristales de hielo flotando junto a los hombros
          const sd = n % 2 ? 1 : -1, cx2 = x + sd * (20 + 3 * Math.sin(T / 700 + n)), cy2 = y - 52 + Math.sin(T / 600 + n * 2) * 4 - n * 7, r = 3 + (n === 1 ? 1.5 : 0);
          ctx.fillStyle = "rgba(190,235,255,0.75)"; ctx.beginPath(); ctx.moveTo(cx2, cy2 - r * 1.7); ctx.lineTo(cx2 + r * 0.6, cy2); ctx.lineTo(cx2, cy2 + r * 1.7); ctx.lineTo(cx2 - r * 0.6, cy2); ctx.closePath(); ctx.fill();
        }
        if (L >= 50) for (let n = 0; n < 5; n++) {                                                   // ráfagas que orbitan el cuerpo
          const lvl = n / 5, rx = 24 + (n % 2) * 8, base = T / (520 + n * 90) * (n % 2 ? -1 : 1) + n * 1.9, cy = y - 8 - lvl * 40;
          for (let k = 0; k < 12; k++) {
            const a = base - k * 0.09 * (n % 2 ? -1 : 1), al = 0.5 * (1 - k / 12);
            ctx.strokeStyle = "rgba(" + (k < 3 ? "235,250,255" : "150,210,255") + "," + al.toFixed(2) + ")"; ctx.lineWidth = 2.2 - k * 0.12;
            const a2 = a - 0.09 * (n % 2 ? -1 : 1);
            ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * rx, cy + Math.sin(a) * rx * 0.38); ctx.lineTo(x + Math.cos(a2) * rx, cy + Math.sin(a2) * rx * 0.38); ctx.stroke();
          }
        }
        if (L >= 50) for (let n = 0; n < 10; n++) {                                     // copos arrastrados por el viento
          const q = ((T / 1800 + rnd(n + 3)) % 1), px = x - 34 + q * 68 + Math.sin(q * 9 + n) * 4, py = y - 8 - rnd(n + 50) * 46 + Math.sin(q * 7 + n) * 5;
          ctx.fillStyle = "rgba(230,248,255," + (0.8 * Math.sin(q * Math.PI)).toFixed(2) + ")"; ctx.fillRect(px, py, 2, 2);
        }
        if (L >= 40) for (let n = 0; n < 4; n++) {                                      // destellos de cristal
          const ph = ((T + n * 700) % 2800) / 2800, ep = Math.floor((T + n * 700) / 2800); if (ph > 0.35) continue;
          const tw = Math.sin(ph / 0.35 * Math.PI), r = 2 + 5 * tw, sx = x + (rnd(ep * 4 + n + 60) - 0.5) * 38, sy = y - 6 - rnd(ep * 4 + n + 90) * 44;
          ctx.fillStyle = "rgba(205,240,255," + (0.9 * tw).toFixed(2) + ")";
          ctx.beginPath(); ctx.moveTo(sx, sy - r); ctx.lineTo(sx + r * 0.22, sy - r * 0.22); ctx.lineTo(sx + r, sy); ctx.lineTo(sx + r * 0.22, sy + r * 0.22);
          ctx.lineTo(sx, sy + r); ctx.lineTo(sx - r * 0.22, sy + r * 0.22); ctx.lineTo(sx - r, sy); ctx.lineTo(sx - r * 0.22, sy - r * 0.22); ctx.closePath(); ctx.fill();
        }
        if (L >= 50) { const hg = ctx.createRadialGradient(x, y - 30, 4, x, y - 30, 48); hg.addColorStop(0, "rgba(120,200,255," + (0.12 + 0.06 * Math.sin(T / 380)).toFixed(2) + ")"); hg.addColorStop(1, "rgba(80,150,255,0)"); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y - 30, 48, 0, Math.PI * 2); ctx.fill(); }   // aura gélida
        if (L >= 30) { const tp = this.tipPos(key, f);                                                 // báculo helado: cristal que late, anillo de escarcha y copos que caen de la punta
          if (tp) {
            const tx = x + tp.x, ty = y + tp.y, tpu = 0.5 + 0.5 * Math.sin(T / 330);
            const sg = ctx.createRadialGradient(tx, ty, 0, tx, ty, 14 + 3 * tpu); sg.addColorStop(0, "rgba(235,252,255," + (0.65 + 0.25 * tpu).toFixed(2) + ")"); sg.addColorStop(0.45, "rgba(120,200,255," + (0.3 + 0.15 * tpu).toFixed(2) + ")"); sg.addColorStop(1, "rgba(60,130,255,0)");
            ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(tx, ty, 17, 0, Math.PI * 2); ctx.fill();
            const r2 = 3 + 5 * tpu; ctx.fillStyle = "rgba(230,250,255," + (0.5 + 0.4 * tpu).toFixed(2) + ")";
            ctx.beginPath(); ctx.moveTo(tx, ty - r2 * 1.6); ctx.lineTo(tx + r2 * 0.2, ty - r2 * 0.2); ctx.lineTo(tx + r2 * 1.6, ty); ctx.lineTo(tx + r2 * 0.2, ty + r2 * 0.2); ctx.lineTo(tx, ty + r2 * 1.6); ctx.lineTo(tx - r2 * 0.2, ty + r2 * 0.2); ctx.lineTo(tx - r2 * 1.6, ty); ctx.lineTo(tx - r2 * 0.2, ty - r2 * 0.2); ctx.closePath(); ctx.fill();
            for (let n = 0; n < 5; n++) { const q = ((T / 1200 + rnd(n + 160)) % 1); ctx.fillStyle = "rgba(210,242,255," + (0.9 * (1 - q)).toFixed(2) + ")"; ctx.fillRect(tx + (rnd(n + 170) - 0.5) * 14 + Math.sin(q * 6 + n) * 2, ty + 3 + q * 24, 2, 2); }
          } }
        ctx.restore();
        if (L >= 50) spr.tinted(ctx, key, f, x, y, "#9fd8ff", 0.07, "lighter");
      }
      ctx.restore();
    }

    // Healer / Buffer / Aura (summons de apoyo, INVENTO del port): efectos desde el nivel 30, más ricos al 40 y al 50, cada clase con su color y su motivo
    if (e.comp && e.dcls && e.clvl >= 30 && fade > 0) {
      const L = e.clvl, cl = e.dcls, T = time + e.id * 997, rnd = (k) => { const h = Math.sin(k * 12.9898 + e.id) * 43758.5453; return h - Math.floor(h); };
      const H = this.mobHeight(key, f) || 60, RGB = { healer: "90,235,110", buffer: "255,222,70", aura: "90,170,255" }[cl], WH = { healer: "220,255,225", buffer: "255,246,200", aura: "215,235,255" }[cl];
      const pu = 0.5 + 0.5 * Math.sin(T / 420), A = (v) => (v * fade).toFixed(3);
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
      { const gg = ctx.createRadialGradient(x, y - 2, 2, x, y - 2, 30);                                      // luz de la clase en el suelo
        gg.addColorStop(0, "rgba(" + RGB + "," + A(0.26 + 0.1 * pu) + ")"); gg.addColorStop(1, "rgba(" + RGB + ",0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(x, y - 2, 30, 11, 0, 0, Math.PI * 2); ctx.fill(); }
      const mote = (n, vy, spread, sz) => { const q = (T / vy + rnd(n + 11)) % 1, px = x + (rnd(n + 31) - 0.5) * spread + Math.sin(q * 6 + n) * 3, py = y - 4 - q * (H + 10);
        ctx.fillStyle = "rgba(" + (n % 3 ? RGB : WH) + "," + A(0.9 * Math.sin(q * Math.PI)) + ")"; ctx.fillRect(px, py, sz, sz); };
      for (let n = 0; n < (L >= 50 ? 14 : L >= 40 ? 9 : 5); n++) mote(n, cl === "aura" ? 2600 : 3000, 38, 2);   // motas que suben
      if (cl === "healer") {
        if (L >= 40) for (let n = 0; n < (L >= 50 ? 4 : 2); n++) {                                          // cruces de curación que flotan hacia arriba
          const q = (T / 2800 + n / 4) % 1, px = x + Math.sin(n * 2.4 + T / 1500) * 18, py = y - 8 - q * (H + 4), r = 3 + 2 * Math.sin(q * Math.PI);
          ctx.fillStyle = "rgba(" + WH + "," + A(0.85 * Math.sin(q * Math.PI)) + ")"; ctx.fillRect(px - r, py - r / 3, r * 2, r * 0.66); ctx.fillRect(px - r / 3, py - r, r * 0.66, r * 2);
        }
        if (L >= 50) {
          const q = (T / 2400) % 1;                                                                           // pulso de curación: anillo que se expande por el suelo
          ctx.strokeStyle = "rgba(" + RGB + "," + A(0.55 * (1 - q)) + ")"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 10 + q * 44, (10 + q * 44) * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
          const hy = y - H - 6 + Math.sin(T / 600) * 1.5;                                                     // halo sobre la cabeza
          ctx.strokeStyle = "rgba(" + WH + "," + A(0.55 + 0.3 * pu) + ")"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(x, hy, 9, 3, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = "rgba(" + RGB + "," + A(0.25) + ")"; ctx.lineWidth = 3.4; ctx.stroke();
        }
      } else if (cl === "buffer") {
        const R = L >= 50 ? 26 : 22;
        if (L >= 40) for (let n = 0; n < 3; n++) {                                                            // escudos-rombo que orbitan el cuerpo
          const a = T / 900 + n * Math.PI * 2 / 3, px = x + Math.cos(a) * R, py = y - H * 0.5 + Math.sin(a) * R * 0.3, r = 4 + (Math.sin(a) > 0 ? 1.5 : 0), al = 0.55 + 0.4 * Math.sin(a);
          ctx.fillStyle = "rgba(" + RGB + "," + A(al) + ")"; ctx.beginPath(); ctx.moveTo(px, py - r * 1.5); ctx.lineTo(px + r, py); ctx.lineTo(px, py + r * 1.5); ctx.lineTo(px - r, py); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "rgba(" + WH + "," + A(al * 0.8) + ")"; ctx.lineWidth = 1; ctx.stroke();
        }
        if (L >= 50) {
          const a0 = T / 1700;                                                                                // runa hexagonal que gira bajo los pies y rayos dorados
          ctx.strokeStyle = "rgba(" + RGB + "," + A(0.5 + 0.2 * pu) + ")"; ctx.lineWidth = 1.5; ctx.beginPath();
          for (let k = 0; k <= 6; k++) { const a = a0 + k * Math.PI / 3, px = x + Math.cos(a) * 24, py = y + Math.sin(a) * 9; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
          ctx.strokeStyle = "rgba(" + WH + "," + A(0.3) + ")"; ctx.beginPath(); ctx.ellipse(x, y, 17, 6, 0, 0, Math.PI * 2); ctx.stroke();
          for (let n = 0; n < 6; n++) { const a = a0 + n * Math.PI / 3, px = x + Math.cos(a) * 24, py = y + Math.sin(a) * 9, q = (T / 1500 + n / 6) % 1;
            ctx.fillStyle = "rgba(" + WH + "," + A(0.7 * Math.sin(q * Math.PI)) + ")"; ctx.fillRect(px - 1, py - q * 26, 2, 7); }
        }
      } else {
        const rings = L >= 50 ? 3 : L >= 40 ? 2 : 1;
        for (let n = 0; n < rings; n++) {                                                                     // ondas concéntricas del aura que se expanden por el suelo
          const q = (T / 2600 + n / rings) % 1, rx = 8 + q * 46;
          ctx.strokeStyle = "rgba(" + RGB + "," + A(0.5 * (1 - q)) + ")"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
        }
        if (L >= 40) for (let n = 0; n < (L >= 50 ? 4 : 2); n++) {                                           // volutas que se enroscan alrededor del cuerpo
          const a = T / 700 + n * Math.PI / 2, q = (T / 2200 + n / 4) % 1, px = x + Math.cos(a) * (14 + 5 * q), py = y - 4 - q * H * 0.9 + Math.sin(a) * 4;
          const sg = ctx.createRadialGradient(px, py, 0, px, py, 5); sg.addColorStop(0, "rgba(" + WH + "," + A(0.85 * Math.sin(q * Math.PI)) + ")"); sg.addColorStop(1, "rgba(" + RGB + ",0)");
          ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
        }
        if (L >= 50) {
          const cy = y - H * 0.55, hg = ctx.createRadialGradient(x, cy, 6, x, cy, 46); hg.addColorStop(0, "rgba(" + RGB + "," + A(0.14 + 0.07 * pu) + ")"); hg.addColorStop(1, "rgba(" + RGB + ",0)");
          ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, cy, 46, 0, Math.PI * 2); ctx.fill();                      // resplandor del aura
          for (let n = 0; n < 8; n++) { const a = n * Math.PI / 4 + T / 5000, r1 = 14 + 4 * pu, r2 = 24 + 8 * pu;
            ctx.strokeStyle = "rgba(" + WH + "," + A(0.22) + ")"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(x + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke(); }
        }
      }
      ctx.restore();
      if (L >= 50) spr.tinted(ctx, key, f, x, y, "rgb(" + RGB + ")", 0.06 + 0.03 * pu, "lighter");
    }

    if (sc !== 1) ctx.restore();

    // encima de todo: nombre y vida
    if (e.dead) return;
    const top = y - this.mobHeight(key, f) * sc * (e.boss === 4 ? 1.44 : e.boss ? 1.2 : 1) - 6;
    if (false && e.kind !== "citizen" && !e.crop && (s.world.map?.kind === "dungeon" || e.hp < e.maxHp || hovered || e.arena)) {
      overlays.push(() => {
        const w = 30, k = e.hp / e.maxHp;
        ctx.fillStyle = "rgba(0,0,0,.65)";
        ctx.fillRect(x - w / 2 - 1, top - 1, w + 2, 5);
        ctx.fillStyle = k > 0.5 ? "#6fcf4f" : k > 0.25 ? "#e3b341" : "#e0493b";
        ctx.fillRect(x - w / 2, top, w * k, 3);
      });
    }
    const say = s.bubbles && s.bubbles.get(e.id);          // frase de un habitante (voice.js)
    if (say && performance.now() < say.until) this.bq.push(() => this.label(x, top - (hovered ? 26 : 4), say.text.length > 64 ? say.text.slice(0, 63) + "…" : say.text, "#ffe9a8", true));
    if (hovered || e.arena || e.comp || e.stall) {
      overlays.push(() => {
        const name = e.stall ? e.stall.owner : e.crop ? (CROP_NAMES[e.crop] || "Crop") : (e.special && remaster ? "★ " : "") + ((e.comp || e.arena) ? (e.nick || e.name) + (e.clvl ? " Lv " + e.clvl : "") : e.crystal ? "Cristal de hielo" : e.ghost ? "Fantasma skeleton" : e.boss ? BOSS_NAMES[e.boss] : e.name);
        const ownerE = e.comp && e.master != null ? s.world.ents.get(e.master) : null, owner = ownerE?.name || null;
        const mineSide = s.me?.side || 0, foeSummon = !!ownerE && ownerE.id !== s.pid && (ownerE.arena || ownerE.pk > 0 || (mineSide > 0 && ownerE.side > 0 && ownerE.side !== mineSide));   // summon de un enemigo: nombre en rojo (_iGetFOE)
        const side = e.crop ? ["(Crop)", "30,255,30"] : e.comp ? ["(" + (owner || "Friendly") + (e.dcls ? " · " + DUMMY_NAMES[e.dcls] : "") + ")", e.dcls ? hexRgb(DUMMY_COLORS[e.dcls]) : foeSummon ? "255,0,0" : "30,255,30"] : e.stall ? ["(" + e.stall.title + ")", "255,220,120"] : e.kind === "citizen" ? ["(Friendly)", "30,255,30"] : ["(Enemy)", "255,0,0"];          // el compañero muestra el nombre de su dueño          // DRAW_OBJECT_NAME89 / 90
        this.origName(x, y, [[name, foeSummon ? "255,60,60" : e.special && remaster ? AURA[e.special] : "255,255,255"], side]);
      });
    }
  }

  // Puesto: género expuesto con sprites reales del original (cesta de flores, baguette, saco de semillas), sin dibujo propio
  stallChest(x, y) {
    const c = this.ctx;
    c.fillStyle = "rgba(0,0,0,.28)"; c.beginPath(); c.ellipse(x, y + 2, 22, 7, 0, 0, Math.PI * 2); c.fill();
    for (const [id, dx, dy] of [[98, -14, 0], [801, 14, 0], [521, 0, -3]]) { const d = itemDef(id); if (d) this.spr.put(c, groundKey(d), d.spriteFrame, x + dx, y + dy); }
  }


  // Escala fija por especie (altura del fotograma de reposo la primera vez que se ve): solo se reducen los más altos que el personaje
  petScale(e, key, f) {
    const BIRTH = { Unicorn: 0.85, "Dark-Elf": 0.85, Guard: 0.85 };
    if (e.dcls) {                                                                   // Healer/Buffer/Aura summon: sprite original de unidad reducido a la altura del personaje
      const c = this.petScales || (this.petScales = new Map()), k = "d:" + e.dcls;
      if (!c.has(k)) { const fr = this.spr.frame(key, f), h = fr ? fr[3] : 0; if (!h || !this.spr.ready(key)) return 1; c.set(k, h > CHAR_H ? CHAR_H / h : 1); }
      return c.get(k);
    }
    const c = this.petScales || (this.petScales = new Map());
    if (!c.has(e.name)) {
      const fr = this.spr.frame(key, f), h = fr ? fr[3] : 0;
      if (!h || !this.spr.ready(key)) return 1;
      c.set(e.name, h > CHAR_H ? (CHAR_H / 2) / h : 0.7);          // los pequeños nacen al 70 %
      if (BIRTH[e.name]) c.set(e.name, BIRTH[e.name]);              // Unicorn, Dark-Elf y Guard: nacen más grandes
      if (FIT[e.name] && h) c.set("fit:" + e.name, FIT[e.name] * CHAR_H / h);   // sprite original pequeño (Ángel tutelar): al 50 casi a la altura del personaje (evolutions.js, campo fit)
    }
    // tamaño por etapas (3 tamaños: niveles 1, 25 y 50; companion.SIZE_STAGES): crece a saltos hasta el tamaño real al 50
    const lich = look(e.name) === "Liche", cyc = look(e.name) === "Cyclops" || e.name === "Tutelary-Angel", K = lich ? [0.5, 1] : cyc ? [0.45, 0.63, 0.82, 1] : [0, 0.5, 1], st = lich ? (e.clvl >= 10 ? 1 : 0) : sizeStep(e.clvl, e.name);   // Liche: mediano hasta el 9, tamaño normal desde el 10
    const base = c.get(e.name), k = K[st], size = base + (1 - base) * k;
    const ratio = st > 0 ? (base + (1 - base) * K[st - 1]) / size : 1;                  // tamaño de la etapa anterior / actual (para la animación de evolución)
    const pulse = e.evoK > 0 ? 1 + 0.05 * Math.sin(performance.now() / 1000 * (2 + 14 * e.evoK) * Math.PI) * (0.4 + e.evoK) : 1;     // último nivel antes de evolucionar: late cada vez más rápido
    return size * (c.get("fit:" + e.name) || 1) * (this.fx?.popScale?.(e.id, ratio) ?? 1) * pulse;
  }

  // Orbe violeta del báculo del Liche: centroide de los píxeles violeta más altos del fotograma (relativo al pivote); se calcula una vez por fotograma
  // Círculo de casteo (summon Lv 50, 1700 ms): nace girando, se sostiene pulsando y se apaga. Todo es elipse en perspectiva y va BAJO el sprite.
  castCircle(ctx, x, y, cc, e, fx) {
    const ck = (performance.now() - cc.at) / 1700;
    if (ck >= 1) { fx.scast.delete(e.id); return; }
    const cfg = CAST_CFG[look(cc.sc)] || CAST_CFG.def, col = hexRgb(cfg.color), core = hexRgb(cfg.core), br = cfg.bright;
    const grow = Math.min(1, ck / 0.22), ease = 1 - (1 - grow) ** 3, po = Math.max(0, (ck - 0.7) / 0.3), out = 1 - po * po * (3 - 2 * po), a = ease * out * br;     // final: 510 ms, se cierra hacia el centro mientras se desvanece
    const R = Math.max(0.5, (cfg.size * ease + 3 * Math.sin(ck * 18) * ease) * (1 - 0.3 * po * po)), ry = 0.42, cy = y + 3, rot = ck * 4.2, T = ck * 1700;
    const rgba = (c, al) => "rgba(" + c + "," + Math.max(0, al).toFixed(3) + ")";
    const ring = (r, w, al, dash) => { r = Math.max(0.1, r); ctx.lineWidth = w; ctx.strokeStyle = rgba(col, al); ctx.setLineDash(dash || []); ctx.beginPath(); ctx.ellipse(x, cy, r, r * ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); };
    const pt = (q, r) => [x + Math.cos(q) * r, cy + Math.sin(q) * r * ry];
    if (look(cc.sc) === "Frost") return this.iceNova(ctx, x, cy, { R: cfg.size, ry, T, a: ease * br, col, core, rgba }, e);
    if (look(cc.sc) === "Demon") return this.infernoBurst(ctx, x, cy, { R: cfg.size, ry, T, a: ease * br, col, core, rgba }, e);   // el Demon no es mago: en vez de círculo, erupción de lava (fireCircle queda sin uso)
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const g = ctx.createRadialGradient(x, cy, 0, x, cy, R * 1.25);                                  // resplandor del suelo
    g.addColorStop(0, rgba(col, 0.6 * a)); g.addColorStop(0.65, rgba(col, 0.25 * a)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, R * 1.25, R * 1.25 * ry, 0, 0, Math.PI * 2); ctx.fill();
    ring(R, 2.4, 1 * a); ring(R - 6, 1.2, 0.7 * a, [3, 4]); ring(R * 0.62, 1.6, 0.8 * a);          // anillos: exterior, de runas y medio
    for (let n = 0; n < 36; n++) { const q = -rot * 0.5 + n * Math.PI / 18, [px, py] = pt(q, R + 3.5), [qx, qy] = pt(q, R + (n % 3 ? 5.5 : 8)); ctx.strokeStyle = rgba(col, (n % 3 ? 0.4 : 0.8) * a); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke(); }
    ctx.strokeStyle = rgba(col, 0.75 * a); ctx.lineWidth = 1.2;                                     // hexagrama: dos triángulos que giran en sentidos opuestos
    for (const s of [1, -1]) { ctx.beginPath(); for (let n = 0; n <= 3; n++) { const [px, py] = pt(s * rot + n * 2 * Math.PI / 3 + (s > 0 ? 0 : Math.PI / 3), R * 0.62); n ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
    for (let n = 0; n < 6; n++) { const [px, py] = pt(rot * 1.6 + n * Math.PI / 3, R * 0.8); ctx.fillStyle = rgba(core, 0.85 * a); ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill(); }   // gemas orbitando
    const pulse = 0.5 + 0.5 * Math.sin(T / 90), c = ctx.createRadialGradient(x, cy, 0, x, cy, 11);   // núcleo
    c.addColorStop(0, rgba(core, (0.55 + 0.3 * pulse) * a)); c.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, cy, 11, 11 * ry * 1.4, 0, 0, Math.PI * 2); ctx.fill();
    for (let n = 0; n < 16; n++) {                                                                  // chispas que suben del círculo
      const sd = (Math.sin(n * 91.7 + e.id) * 43758.5453) % 1, ph = ((T / 900 + Math.abs(sd) + n / 16) % 1), q = n * 2.399 + sd * 6, r = R * (0.25 + 0.7 * Math.abs(Math.cos(n * 1.7)));
      const [px, py] = pt(q, r); ctx.fillStyle = rgba(core, 0.9 * a * (1 - ph)); ctx.fillRect(px - 1, py - ph * 46 - 1, 2, 2 + (n % 3 === 0 ? 1 : 0));
    }
    ctx.restore();
  }
  // Demon: erupción infernal al castear (Lv 30/40/50 = 5/7/9 grietas y géiseres, cada vez más grande). Onda de calor, grietas de lava que se abren desde los pies
  // y géiseres de fuego que brotan escalonados al final de cada grieta. Elipse en perspectiva, bajo el sprite.
  infernoBurst(ctx, x, cy, k, e) {
    const { R, ry, T, a, col, core, rgba } = k, ck = T / 1700, L = e.clvl, sc = L >= 50 ? 1 : L >= 40 ? 0.82 : 0.65, nC = L >= 50 ? 9 : L >= 40 ? 7 : 5, Rr = R * sc;
    const rnd = (n) => { const q = Math.sin(n * 12.9898 + e.id) * 43758.5453; return q - Math.floor(q); };
    const open = Math.min(1, ck / 0.3), eo = 1 - (1 - open) ** 3, heat = 1;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const g = ctx.createRadialGradient(x, cy, 0, x, cy, Rr * 1.1); g.addColorStop(0, rgba(core, 0.4 * a)); g.addColorStop(0.5, rgba(col, 0.22 * a)); g.addColorStop(1, rgba(col, 0));
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - ck * 1.1); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, Rr * 1.1, Rr * 1.1 * ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // TREMOR de fuego: el efecto 138 del cliente original (Game.cpp bAddNewEffect: 15 nubes del efecto 14 = hoja 11, fotogramas 28+, dispersas en 120x80 px sobre el
    // objetivo, 100 ms por fotograma) teñido de rojo bajo el Demon, y la pantalla tiembra mientras dura el temblor.
    if (T < 450) this.quake = { until: performance.now() + 60, amp: (2 + 3 * sc) * (1 - T / 450) };
    const fs = this.fx?.sp, mf = fs?.man?.fx11, im = fs?.getImg("fx11");
    if (mf && im && im.naturalWidth) {
      const tint = (f) => {                                                                        // fotograma de la nube con el color de lava (se guarda una vez)
        const c = this._tf || (this._tf = new Map()); if (c.has(f)) return c.get(f);
        const fr = mf.frames[f]; if (!fr) return null;
        const cv = document.createElement("canvas"); cv.width = fr[2]; cv.height = fr[3]; const g = cv.getContext("2d");
        g.drawImage(im, fr[0], fr[1], fr[2], fr[3], 0, 0, fr[2], fr[3]);
        g.globalCompositeOperation = "multiply"; g.fillStyle = "rgb(255,70,18)"; g.fillRect(0, 0, fr[2], fr[3]);
        g.globalCompositeOperation = "destination-in"; g.drawImage(im, fr[0], fr[1], fr[2], fr[3], 0, 0, fr[2], fr[3]);
        const o = { cv, px: fr[4], py: fr[5] }; c.set(f, o); return o;
      };
      ctx.globalCompositeOperation = "lighter";
      for (let n = 0; n < 15; n++) {
        const f = Math.floor((T - rnd(n + 20) * 150) / 100); if (f < 0 || f > 14) continue;
        const o = tint(28 + f); if (!o) continue;
        const px = x + (rnd(n + 30) - 0.5) * 120 * sc, py = cy + (rnd(n + 40) - 0.5) * 80 * sc * 0.8 - 6;
        ctx.globalAlpha = Math.min(1, 0.9 * a * 1.3); ctx.drawImage(o.cv, Math.round(px + o.px), Math.round(py + o.py));
      }
      ctx.globalAlpha = 1;
    }
    const HIT = 0.12, hk = Math.max(0, ck - HIT), reveal = Math.min(1, hk / 0.18), erase = Math.max(0, Math.min(1, (ck - 0.55) / 0.35));       // la fisura nace en el centro (bajo el Demon), se dibuja hacia los bordes (sin crecer ni encogerse) y luego se borra desde su inicio
    const lerp = (P, u) => { const t = u * (P.length - 1), i = Math.min(P.length - 2, Math.floor(t)), q = t - i; return [P[i][0] + (P[i + 1][0] - P[i][0]) * q, P[i][1] + (P[i + 1][1] - P[i][1]) * q]; };
    const ribbon = (P, u0, u1, w, tp, wob) => {                                                    // cinta continua (un solo trazo, sin juntas) de la fisura entre u0 y u1, afinándose hacia la punta
      if (u1 - u0 < 0.01) return;
      const m = 14, L = [], R = [];
      for (let i = 0; i <= m; i++) {
        const u = u0 + (u1 - u0) * i / m, p = lerp(P, u), p2 = lerp(P, Math.min(1, u + 0.03)), p1 = lerp(P, Math.max(0, u - 0.03));
        let dx = p2[0] - p1[0], dy = (p2[1] - p1[1]) / ry; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        const hw = 0.5 * w * (1 - tp * u) * (1 + wob * Math.sin(u * 23 + P[0][0]));
        L.push([p[0] - dy * hw, p[1] + dx * hw * ry]); R.push([p[0] + dy * hw, p[1] - dx * hw * ry]);
      }
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (const q of L) ctx.lineTo(q[0], q[1]); for (let i = m; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); ctx.fill();
    };
    const cracks = [];
    for (let n = 0; n < nC; n++) {
      const ang = n * 2 * Math.PI / nC + rnd(n) * 0.5, full = Rr * (1.5 + 0.5 * rnd(n + 9)), pts = [];
      for (let j = 0; j <= 10; j++) { const r = full * j / 10, jit = j ? (j % 2 ? 1 : -1) * (1.5 + rnd(n * 7 + j) * 3.5) : 0; pts.push([x + Math.cos(ang) * r - Math.sin(ang) * jit, cy + (Math.sin(ang) * r + Math.cos(ang) * jit) * ry]); }
      cracks.push({ P: pts, u0: 0, u1: 1, w: 1 });
      const ub = 0.35 + 0.3 * rnd(n + 3), bp = lerp(pts, ub), ba = ang + (rnd(n + 5) > 0.5 ? 1 : -1) * (0.5 + 0.3 * rnd(n + 6)), bl = full * 0.4, bpts = [];       // una rama que sale de la grieta
      for (let j = 0; j <= 6; j++) { const r = bl * j / 6, jit = j ? (j % 2 ? 1 : -1) * (2 + rnd(n * 5 + j) * 3) : 0; bpts.push([bp[0] + Math.cos(ba) * r - Math.sin(ba) * jit, bp[1] + (Math.sin(ba) * r + Math.cos(ba) * jit) * ry]); }
      cracks.push({ P: bpts, u0: ub, u1: 1, w: 0.55 });
    }
    for (const c of cracks) {                                                                      // el rango visible (reveal..erase) se reparte en la rama a partir de donde nace
      const ua = Math.max(0, Math.min(1, (erase - c.u0) / (1 - c.u0))), ub2 = Math.max(0, Math.min(1, (reveal - c.u0) / (1 - c.u0)));
      c.a = c.u0 ? ua : erase; c.b = c.u0 ? ub2 : reveal;
    }
    ctx.globalCompositeOperation = "source-over";                                                  // el hueco oscuro del suelo
    ctx.fillStyle = "rgba(8,3,2," + (0.92 * Math.min(1, a)).toFixed(3) + ")";
    for (const c of cracks) ribbon(c.P, c.a, c.b, 8 * c.w, 0.55, 0.25);
    ctx.globalCompositeOperation = "lighter";                                                      // la lava que brilla dentro
    for (const [w, al, cc2] of [[5, 0.22 * heat, col], [2.4, 0.85, col], [1.1, 0.95 * heat, core]]) {
      ctx.fillStyle = rgba(cc2, al * a);
      for (const c of cracks) ribbon(c.P, c.a, c.b, w * c.w, 0.6, 0.35);
    }
    ctx.restore();
  }
  // Frost: nova de hielo al castear (Lv 30/40/50 cada vez mayor). Onda azul que se expande desde los pies, grietas de escarcha en el suelo y esquirlas que saltan. Bajo el sprite.
  iceNova(ctx, x, cy, k, e) {
    const { R, ry, T, col, core, rgba } = k, ck = T / 1700, L = e.clvl, sc = L >= 50 ? 1.15 : L >= 40 ? 0.95 : 0.75, Rr = R * sc;
    const ex = Math.min(1, ck / 0.35), ee = 1 - (1 - ex) ** 3, fa = Math.max(0, 1 - Math.max(0, ck - 0.45) / 0.55);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const g = ctx.createRadialGradient(x, cy, 0, x, cy, Rr * 1.1); g.addColorStop(0, rgba(core, 0.35 * fa)); g.addColorStop(0.6, rgba(col, 0.2 * fa)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, Rr * 1.1, Rr * 1.1 * ry, 0, 0, Math.PI * 2); ctx.fill();
    const wr = Math.max(0.5, Rr * ee);                                                      // onda que se expande
    ctx.strokeStyle = rgba(core, 0.8 * fa); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(x, cy, wr, wr * ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(col, 0.5 * fa); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, cy, wr * 0.7, wr * 0.7 * ry, 0, 0, Math.PI * 2); ctx.stroke();
    const flake = (R0, rot, al, lw) => {                                                    // copo de nieve de seis brazos con ramas, aplastado en perspectiva
      ctx.strokeStyle = rgba(core, al); ctx.lineWidth = lw;
      for (let n = 0; n < 6; n++) {
        const an = rot + n * Math.PI / 3, c = Math.cos(an), sn = Math.sin(an), P = (r, off = 0) => [x + c * r - sn * off, cy + (sn * r + c * off) * ry];
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(...P(R0));
        for (const [u, bl] of [[0.4, 0.28], [0.68, 0.2]]) { const [bx, by] = P(R0 * u); ctx.moveTo(bx, by); ctx.lineTo(...P(R0 * (u + bl), R0 * bl)); ctx.moveTo(bx, by); ctx.lineTo(...P(R0 * (u + bl), -R0 * bl)); }
        ctx.stroke();
        const [tx, ty] = P(R0 * 1.04); ctx.fillStyle = rgba(core, al); ctx.beginPath(); ctx.ellipse(tx, ty, 1.8, 1.8 * ry * 1.4, 0, 0, Math.PI * 2); ctx.fill();
      }
    };
    const fz = Math.min(1, ck / 0.3), fe = 1 - (1 - fz) ** 3;
    flake(Rr * 0.95 * fe, T / 1700 * 0.5, 0.85 * fa, 1.8);                                  // el icono del copo bajo los pies, gira despacio
    ctx.strokeStyle = rgba(col, 0.4 * fa); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, cy, Rr * 0.5 * fe, Rr * 0.5 * fe * ry, 0, 0, Math.PI * 2); ctx.stroke();
    if (L >= 50) flake(Rr * 0.5 * fe, -T / 1700 * 0.8, 0.7 * fa, 1.2);                     // Lv 50: segundo copo interior en sentido contrario
    ctx.restore();
  }
  // Demon (antiguo): pentagrama de fuego invertido. Anillo con lenguas de llama, pentagrama que late al rojo vivo (gira despacio), una llama en cada punta,
  // runas en el anillo medio y núcleo de lava; brasas suben del suelo. Misma elipse en perspectiva que el resto de círculos.
  fireCircle(ctx, x, cy, k, e) {
    const { R, ry, rot, T, a, col, core, rgba, ring, pt } = k, fl = (n, t) => { const q = Math.sin((n + Math.floor(t / 70)) * 12.9898 + e.id) * 43758.5453; return q - Math.floor(q); };   // parpadeo a pasos
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const g = ctx.createRadialGradient(x, cy, 0, x, cy, R * 1.3);                                   // suelo incandescente
    g.addColorStop(0, rgba(core, 0.45 * a)); g.addColorStop(0.4, rgba(col, 0.35 * a)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, R * 1.3, R * 1.3 * ry, 0, 0, Math.PI * 2); ctx.fill();
    ring(R, 2.6, a); ring(R * 0.9, 1.1, 0.6 * a, [2, 3]);
    ctx.fillStyle = rgba(col, 0.75 * a);                                                            // lenguas de llama sobre el anillo exterior
    for (let n = 0; n < 40; n++) {
      const q = n * Math.PI / 20 + rot * 0.15, h = 4 + fl(n, T) * 9 + 3 * Math.sin(T / 120 + n), [bx, by] = pt(q, R), [lx, ly] = pt(q - 0.07, R), [rx, rY] = pt(q + 0.07, R);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(bx + Math.sin(T / 150 + n) * 1.5, by - h); ctx.lineTo(rx, rY); ctx.fill();
    }
    const heat = 0.65 + 0.35 * Math.sin(T / 110), pr = R * 0.86, P = [];                             // pentagrama invertido (punta hacia abajo)
    for (let n = 0; n < 5; n++) P.push(pt(Math.PI / 2 + rot * 0.35 + n * 2 * Math.PI / 5, pr));
    for (const [w, al, c] of [[5, 0.25, col], [2.2, 0.9, col], [0.9, 0.9, core]]) {                 // trazo con halo, cuerpo y filo caliente
      ctx.strokeStyle = rgba(c, al * a * (w > 2 ? heat : 1)); ctx.lineWidth = w; ctx.beginPath();
      for (let n = 0; n <= 5; n++) { const [px, py] = P[(n * 2) % 5]; n ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
    }
    ring(pr * 0.38, 1.2, 0.7 * a, [2, 2]);
    for (const [px, py] of P) {                                                                     // llama en cada punta del pentagrama
      const h = 12 + fl(px, T) * 10 + 4 * Math.sin(T / 90 + px);
      const fg = ctx.createRadialGradient(px, py - h * 0.4, 0, px, py - h * 0.4, h * 0.9); fg.addColorStop(0, rgba(core, 0.85 * a)); fg.addColorStop(0.5, rgba(col, 0.5 * a)); fg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(px - 4, py); ctx.quadraticCurveTo(px - 3, py - h * 0.6, px + Math.sin(T / 110 + px) * 2, py - h); ctx.quadraticCurveTo(px + 3, py - h * 0.6, px + 4, py); ctx.fill();
    }
    ctx.fillStyle = rgba(core, 0.8 * a);                                                            // runas (marcas) en el anillo medio, contra-giro
    for (let n = 0; n < 10; n++) { const q = -rot * 0.6 + n * Math.PI / 5, [px, py] = pt(q, R * 0.95 - 3); ctx.fillRect(px - 1, py - 2.5, 2, 5); }
    const c = ctx.createRadialGradient(x, cy, 0, x, cy, 12);                                        // núcleo de lava
    c.addColorStop(0, rgba(core, (0.6 + 0.3 * heat) * a)); c.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, cy, 12, 12 * ry * 1.4, 0, 0, Math.PI * 2); ctx.fill();
    for (let n = 0; n < 22; n++) {                                                                  // brasas
      const sd = Math.abs(Math.sin(n * 91.7 + e.id)), ph = (T / 1000 + sd + n / 22) % 1, [px, py] = pt(n * 2.399 + sd * 6, R * (0.2 + 0.75 * Math.abs(Math.cos(n * 1.7))));
      ctx.fillStyle = rgba(n % 2 ? core : col, 0.95 * a * (1 - ph)); ctx.fillRect(Math.round(px + Math.sin(ph * 6 + n) * 3), Math.round(py - ph * 52), 2, 2 + (n % 3 ? 0 : 2));
    }
    ctx.restore();
  }
  orbPos(key, f) {
    const c = this._orb || (this._orb = new Map()), id = key + ":" + f;
    if (c.has(id)) return c.get(id);
    const fr = this.spr.frame(key, f); if (!fr || !this.spr.ready(key)) return null;
    const [sx, sy, w, h, pvx, pvy] = fr, [img, k] = this.spr.src(key);
    const cv = this._orbCv || (this._orbCv = document.createElement("canvas"));
    cv.width = w * k; cv.height = h * k;
    const g = cv.getContext("2d", { willReadFrequently: true }); g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(img, sx * k, sy * k, w * k, h * k, 0, 0, w * k, h * k);
    const d = g.getImageData(0, 0, cv.width, cv.height).data, pts = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i + 2] > 100 && d[i + 2] > d[i + 1] + 45 && d[i] > d[i + 1] + 10) { const q = i / 4; pts.push([q % cv.width, Math.floor(q / cv.width)]); }
    let r = null;
    if (pts.length > 3) {
      const top = Math.min(...pts.map(p => p[1])), near = pts.filter(p => p[1] < top + 9 * k);
      r = { x: pvx + near.reduce((a, p) => a + p[0], 0) / near.length / k, y: pvy + near.reduce((a, p) => a + p[1], 0) / near.length / k };
    }
    c.set(id, r); return r;
  }

  // Pinzas de las manos del Cíclope por fotograma (relativas al pivote): lo único plateado del sprite (claro y sin color). Se agrupan los píxeles en izquierda/derecha y se toma el centro de cada grupo
  clawPos(key, f) {
    const c = this._claw || (this._claw = new Map()), id = key + ":" + f;
    if (c.has(id)) return c.get(id);
    const fr = this.spr.frame(key, f); if (!fr || !this.spr.ready(key)) return null;
    const [sx, sy, w, h, pvx, pvy] = fr, [img, k] = this.spr.src(key);
    const cv = this._orbCv || (this._orbCv = document.createElement("canvas"));
    cv.width = w * k; cv.height = h * k;
    const g = cv.getContext("2d", { willReadFrequently: true }); g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(img, sx * k, sy * k, w * k, h * k, 0, 0, w * k, h * k);
    const d = g.getImageData(0, 0, cv.width, cv.height).data, pts = []; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2]; if (d[i + 3] > 40) { const q = i / 4, qx = q % cv.width, qy = Math.floor(q / cv.width); if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy; } if (d[i + 3] > 200 && Math.min(r, gg, b) > 125 && Math.max(r, gg, b) - Math.min(r, gg, b) < 45) { const q = i / 4; pts.push([q % cv.width, Math.floor(q / cv.width)]); } }
    let res = null;
    if (pts.length >= 6) {
      const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, L = pts.filter(p => p[0] < mx), Rr = pts.filter(p => p[0] >= mx);
      const cen = a => ({ x: pvx + a.reduce((s2, p) => s2 + p[0], 0) / a.length / k, y: pvy + a.reduce((s2, p) => s2 + p[1], 0) / a.length / k });
      const side = a => a.length >= 4 ? cen(a) : null; res = [side(L), side(Rr)].filter(Boolean);
      if (res.length === 2 && Math.abs(res[0].x - res[1].x) < 6) res = [cen(pts)];            // una sola pinza visible (o de perfil): no partirla en dos
    }
    if (x1 > x0) (this._cbox || (this._cbox = new Map())).set(id, { x0: pvx + x0 / k, x1: pvx + x1 / k, y0: pvy + y0 / k, y1: pvy + y1 / k });   // silueta opaca del fotograma (para el efecto de la muerte)
    if (!res?.length && x1 > x0) {                                                            // de espaldas (dirs 1 y 8) las pinzas quedan tapadas: se estiman por la silueta, a ambos lados del torso
      const bw = x1 - x0, at = (fx) => ({ x: pvx + (x0 + bw * fx) / k, y: pvy + (y0 + (y1 - y0) * 0.4) / k });
      res = [at(0.2), at(0.8)];
    }
    if (res) res = res.map(p => ({ x: p.x, y: p.y - 2 }));
    c.set(id, res); return res;
  }

  // Punta del báculo del Frost por fotograma (relativa al pivote): el báculo es lo único azul intenso del sprite; se toma el mayor trazo conexo y su extremo más alto
  tipPos(key, f) {
    const c = this._anc || (this._anc = new Map()), id = key + ":" + f;
    if (c.has(id)) return c.get(id);
    const fr = this.spr.frame(key, f); if (!fr || !this.spr.ready(key)) return null;
    const [sx, sy, w, h, pvx, pvy] = fr, [img, k] = this.spr.src(key);
    const cv = this._orbCv || (this._orbCv = document.createElement("canvas"));
    cv.width = w * k; cv.height = h * k;
    const g = cv.getContext("2d", { willReadFrequently: true }); g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(img, sx * k, sy * k, w * k, h * k, 0, 0, w * k, h * k);
    const d = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height, lab = new Int32Array(W * H), pts = [];
    for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 200 && d[i * 4 + 2] - d[i * 4] > 70 && d[i * 4] < 110) { pts.push(i); lab[i] = -1; }
    let best = null, nl = 0;
    for (const i0 of pts) {
      if (lab[i0] !== -1) continue;
      const comp = [], st = [i0]; lab[i0] = ++nl;
      while (st.length) { const i = st.pop(); comp.push(i); const px = i % W, py = (i - px) / W;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (lab[j] === -1) { lab[j] = nl; st.push(j); } } }
      if (!best || comp.length > best.length) best = comp;
    }
    let r = null;
    if (best && best.length >= 6) { let top = H; for (const i of best) top = Math.min(top, Math.floor(i / W)); let sx2 = 0, sy2 = 0, n = 0; for (const i of best) { const py = Math.floor(i / W); if (py < top + 3 * k) { sx2 += i % W; sy2 += py; n++; } } r = { x: pvx + sx2 / n / k, y: pvy + sy2 / n / k }; }
    c.set(id, r); return r;
  }

  mobHeight(key, f) {
    const fr = this.spr.frame(key, f);
    return fr ? -fr[5] : 40;
  }

  // Nombre como DrawObjectName/DrawNpcName del cliente original (Game.cpp): PutString2 en el origen de la casilla (alineado a la izquierda),
  // sombra de 1 px, nombre en blanco y debajo (+14) la condición en su color. Líneas: [[texto, "r,g,b"], ...].
  origName(x, y, lines) {
    const { ctx } = this;
    ctx.font = "12px Tahoma, Verdana, sans-serif"; ctx.textAlign = "left";
    lines.forEach(([text, rgb], i) => {
      text = t(text);
      const lx = Math.round(x - 16), ly = Math.round(y + 18 + i * 14);
      ctx.fillStyle = "#000"; ctx.fillText(text, lx + 1, ly); ctx.fillText(text, lx, ly + 1); ctx.fillText(text, lx + 1, ly + 1);
      ctx.fillStyle = "rgb(" + rgb + ")"; ctx.fillText(text, lx, ly);
    });
  }

  label(x, y, text, color, avoid = false) {
    const { ctx } = this;
    text = t(text);
    ctx.font = "12px Tahoma, Verdana, sans-serif";                            // letra del cliente original: texto con sombra de 1 píxel, sin caja
    ctx.textAlign = "center";
    const w = ctx.measureText(text).width + 10;
    const rects = this.rects || (this.rects = []);
    const hit = yy => rects.some(r => x - w / 2 < r[2] && x + w / 2 > r[0] && yy - 11 < r[3] && yy + 4 > r[1]);
    if (avoid) for (let i = 0; i < 8 && hit(y); i++) y -= 16;                // sube hasta no pisar otra etiqueta
    rects.push([x - w / 2, y - 11, x + w / 2, y + 4]);
    ctx.fillStyle = "#000"; ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  // casillas de teletransporte: solo rótulo de destino (sin rombos; el original no los dibuja)
  drawTeleportMarks(s, camX, camY, tx0, ty0, cols, rows) {
    const tps = s.world?.teleports; if (!tps?.size) return;
    const { ctx } = this, k = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    // sin rombos azules sobre el suelo: el original no marca las casillas de salida (v0.85.10)
    // INVENTO del port (ticket 6): cada salida lleva el nombre del mapa de destino; si queda fuera de pantalla, una flecha en el borde apunta hacia ella
    // una sola flecha/rótulo por destino (la salida más cercana al centro de la vista): con dos se confundía; los destinos cerrados no llevan flecha
    const near = new Map(), cx0 = this.viewW / 2, cy0 = this.viewH / 2;
    for (const g of this.teleportGroups(tps)) {
      const d = Math.hypot(g.x * T + T / 2 - camX - cx0, g.y * T + T / 2 - camY - cy0), c = near.get(g.map);
      if (!c || d < c.d) near.set(g.map, { g, d });
    }
    for (const { g } of near.values()) {
      const x = g.x * T + T / 2 - camX, y = g.y * T + T / 2 - camY, m = 26, out = x < m || y < m || x > this.viewW - m || y > this.viewH - m;
      const txt = t(g.name || g.map) + (g.open ? "" : " (" + t("cerrado") + ")"), col = g.open ? "#bde8ff" : "#e0a090";
      if (!out) { this.label(x, y - 26, txt + (g.open ? " ▸" : ""), col); continue; }
      if (!s.dirArrows || !g.open) continue;                                  // flechas de dirección en el borde: opción «Indicadores de dirección» (apagada por defecto)
      const cx = this.viewW / 2, cy = this.viewH / 2, a = Math.atan2(y - cy, x - cx), ex = Math.max(m, Math.min(this.viewW - m, x)), ey = Math.max(m + 40, Math.min(this.viewH - m, y));
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.globalAlpha = 0.6 + 0.4 * k; ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.restore();
      this.label(Math.max(60, Math.min(this.viewW - 60, ex)), ey + (ey > cy ? -14 : 24), txt, col);
    }
  }
  // salidas del mapa agrupadas por destino (centro de cada grupo contiguo)
  teleportGroups(tps) {
    if (this._tpg?.src === tps) return this._tpg.list;
    const by = new Map(), list = [];
    for (const tp of tps.values()) { const k = tp.map + ">" + tp.dx + "," + tp.dy; (by.get(k) || by.set(k, []).get(k)).push(tp); }
    for (const a of by.values()) {
      const left = [...a];
      while (left.length) {                                        // componente contigua (8 vecinos)
        const comp = [left.pop()];
        for (let i = 0; i < comp.length; i++) for (let j = left.length - 1; j >= 0; j--) if (Math.abs(left[j].x - comp[i].x) <= 1 && Math.abs(left[j].y - comp[i].y) <= 1) comp.push(...left.splice(j, 1));
        const id = comp[0].map.toLowerCase();
        list.push({ x: comp.reduce((n, c) => n + c.x, 0) / comp.length, y: comp.reduce((n, c) => n + c.y, 0) / comp.length, map: id, name: MAP_NAMES[id], open: ALLOWED_MAPS.has(id) || id === "middled1n" });
      }
    }
    this._tpg = { src: tps, list }; return list;
  }

  drawGrid(camX, camY, tx0, ty0, cols, rows) {
    const { ctx } = this;
    ctx.lineWidth = 1 / this.scale;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const x = (tx0 + i) * T - camX, y = (ty0 + j) * T - camY;
      const t = this.grid.tile(tx0 + i, ty0 + j);
      if (!t) continue;
      if (t.blocked) { ctx.fillStyle = "rgba(200,40,40,.28)"; ctx.fillRect(x, y, T, T); }
      if (t.teleport) { ctx.fillStyle = "rgba(80,140,255,.45)"; ctx.fillRect(x, y, T, T); }
      ctx.strokeStyle = "rgba(0,0,0,.28)";
      ctx.strokeRect(x, y, T, T);
    }
  }

  drawClickFx(c, camX, camY) {
    const { ctx } = this;
    const k = (performance.now() - c.t) / 450;
    if (k >= 1) return;
    const x = c.x * T + 16 - camX, y = c.y * T + 22 - camY;
    ctx.strokeStyle = (c.ok ? "rgba(255,225,140," : "rgba(235,90,80,") + (1 - k) + ")";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, 14 * (1 - k * .5), 7 * (1 - k * .5), 0, 0, Math.PI * 2); ctx.stroke();
  }

  // ---------------------------------------------------------------- minimapa
  // Una imagen por casilla escrita directamente en un ImageData (antes: ~560 000 drawImage/fillRect por mapa, 4 s de congelación al entrar).
  // El color de cada (hoja, fotograma) se reduce una sola vez con el mismo filtro "high" de antes y se guarda.
  buildMinimap() {
    const g = this.grid, W = g.w, H = g.h;
    const mc = this.miniCol || (this.miniCol = new Map()), one = this.mini1 || (this.mini1 = (() => { const c = document.createElement("canvas"); c.width = c.height = 1; const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; return x; })());
    const m = document.createElement("canvas"); m.width = W; m.height = H;
    const o = document.createElement("canvas"); o.width = W; o.height = H;
    const md = new ImageData(W, H), od = new ImageData(W, H), a = md.data, b = od.data;
    let missing = 0;                                        // casillas cuya hoja aún no llegó: se repinta el minimapa cuando estén
    const col = (key, f, fr) => {
      const k = key + ":" + f; let v = mc.get(k);
      if (!v) { one.clearRect(0, 0, 1, 1); one.drawImage(this.spr.img[key], fr[0], fr[1], fr[2], fr[3], 0, 0, 1, 1); v = one.getImageData(0, 0, 1, 1).data; mc.set(k, v); }
      return v;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = g.tile(x, y), key = "t" + t.spr, fr = this.spr.frame(key, t.frame), i = (y * W + x) * 4, bl = g.blocked(x, y);
      let r, gg, bb, al;
      if (!fr || !this.spr.ready(key)) { missing++; if (bl) { r = 0x30; gg = 0x2c; bb = 0x28; } else { r = 0x71; gg = 0x67; bb = 0x5b; } al = 255; }
      else { const v = col(key, t.frame, fr); r = v[0]; gg = v[1]; bb = v[2]; al = v[3]; }
      if (bl) { const A = al / 255, a2 = A + .35 * (1 - A), k = a2 ? .65 * A / a2 : 0; r *= k; gg *= k; bb *= k; al = a2 * 255; }      // velo negro .35 por encima
      a[i] = r; a[i + 1] = gg; a[i + 2] = bb; a[i + 3] = al;
      // versión "líneas" para el mapa superpuesto: solo los bordes de lo que bloquea el paso
      if (bl) {
        if (!g.blocked(x - 1, y) || !g.blocked(x + 1, y) || !g.blocked(x, y - 1) || !g.blocked(x, y + 1)) { b[i] = 226; b[i + 1] = 208; b[i + 2] = 150; b[i + 3] = 230; }
      } else { b[i] = 90; b[i + 1] = 140; b[i + 2] = 200; b[i + 3] = 46; }
    }
    m.getContext("2d").putImageData(md, 0, 0); o.getContext("2d").putImageData(od, 0, 0);
    this.minimap = m; this.miniMissing = missing; this.miniTry = performance.now();
    this.overlayImg = o;
  }

  // sprite pequeño (reposo, de frente) de mi summon sobre el minimapa; false si su hoja aún no está cargada
  miniPet(e, x, y, h) {
    const m = miniOf(e.name, k => this.spr.frames(k), e.dcls); if (!m || !this.spr.ready(m.key)) return false;
    const fr = this.spr.frame(m.key, m.f); if (!fr) return false;
    const [sx, sy, w, hh] = fr, k = h / Math.max(w, hh, 1);
    this.ctx.drawImage(this.spr.img[m.key], sx, sy, w, hh, x - w * k / 2, y - hh * k / 2, w * k, hh * k);
    return true;
  }

  // Mapa superpuesto (estilo Diablo II): translúcido sobre toda la vista, centrado en el jugador
  drawOverlayMap(s, ppx, ppy) {
    const { ctx } = this;
    const sc = 4, cx = this.viewW / 2, cy = this.viewH / 2;       // 4 px por casilla
    const ox = cx - ppx / T * sc, oy = cy - ppy / T * sc;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.overlayImg, ox, oy, this.grid.w * sc, this.grid.h * sc);
    for (const e of s.world.ents.values()) {
      if (e.kind !== "npc" || e.dead) continue;
      if (e.comp || e.master) { if (e.master === s.me.id && !this.miniPet(e, ox + e.x * sc + 1, oy + e.y * sc + 1, 18)) { ctx.fillStyle = "#9fe07f"; ctx.fillRect(ox + e.x * sc, oy + e.y * sc, 3, 3); } continue; }
      ctx.fillStyle = e.special ? "#ffd34d" : "#e2584a";
      ctx.fillRect(ox + e.x * sc, oy + e.y * sc, 3, 3);
    }
    for (const e of s.world.ents.values()) {
      if (e.kind !== "player" || e === s.me || e.dead) continue;
      ctx.fillStyle = "#7fc4ff";
      ctx.fillRect(ox + e.x * sc - 1, oy + e.y * sc - 1, 5, 5);
    }
    ctx.fillStyle = "#9fe07f";
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
    ctx.restore();
  }

  // ¿está el puntero (coordenadas de ventana) sobre el minimapa de la esquina?
  // Rectángulo del minimapa: arrastrable (miniPos = esquina superior izquierda en píxeles de vista, se recuerda en localStorage);
  // en mapas pequeños (criptas) se reduce en proporción al ancho del mapa.
  miniRect() {
    let size = this.miniSize || (this.mode === "remastered" ? 170 : 140);
    if (this.grid?.w && this.grid.w < 96) size = Math.max(84, Math.round(size * this.grid.w / 96));   // mapa pequeño (cripta): minimapa proporcional, no gigante
    if (this.miniPos === undefined) { try { this.miniPos = JSON.parse(localStorage.getItem("hb.miniPos")); } catch { this.miniPos = null; } }
    const pad = 10, p = this.miniPos;
    const x0 = p ? Math.max(3, Math.min(this.viewW - size - 3, p.x)) : this.viewW - size - pad;
    const y0 = p ? Math.max(3, Math.min(this.viewH - size - 3, p.y)) : this.miniTop ?? pad;
    return { size, x0, y0 };
  }
  toView(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) * this.dpr - this.ox) / this.scale, y: ((clientY - r.top) * this.dpr - this.oy) / this.scale };
  }
  minimapHit(clientX, clientY) {
    const { x: vx, y: vy } = this.toView(clientX, clientY), { size, x0, y0 } = this.miniRect();
    return vx >= x0 - 3 && vx <= x0 + size + 3 && vy >= y0 - 3 && vy <= y0 + size + 3;
  }
  miniDragStart(clientX, clientY) { const v = this.toView(clientX, clientY), m = this.miniRect(); this.miniGrab = { dx: v.x - m.x0, dy: v.y - m.y0 }; }
  miniDragMove(clientX, clientY) { if (!this.miniGrab) return; const v = this.toView(clientX, clientY); this.miniPos = { x: Math.round(v.x - this.miniGrab.dx), y: Math.round(v.y - this.miniGrab.dy) }; }
  miniDragEnd() { if (!this.miniGrab) return; this.miniGrab = null; try { localStorage.setItem("hb.miniPos", JSON.stringify(this.miniPos)); } catch {} }
  miniReset() { this.miniPos = null; try { localStorage.removeItem("hb.miniPos"); } catch {} }

  drawMinimap(s, ppx, ppy) {
    const { ctx } = this;
    const remaster = this.mode === "remastered";
    const { size, x0, y0 } = this.miniRect();      // en móvil (mobile.js) más pequeño y bajo los botones
    if (this.miniMissing && performance.now() - this.miniTry > 500) this.buildMinimap();   // las hojas del suelo llegan por tandas
    const sc = size / this.grid.w;
    ctx.globalAlpha = remaster ? 0.9 : 1;
    ctx.fillStyle = "#14161a";
    ctx.fillRect(x0 - 3, y0 - 3, size + 6, size + 6);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.minimap, x0, y0, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    if (this.miniMissing) { ctx.fillStyle = "rgba(20,22,26,.55)"; ctx.fillRect(x0, y0, size, size); ctx.fillStyle = "#e8dcc0"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("Cargando mapa…", x0 + size / 2, y0 + size / 2); ctx.textAlign = "left"; }
    ctx.strokeStyle = "rgba(232,220,192,.6)";
    ctx.lineWidth = 1 / this.scale;
    ctx.strokeRect(x0 + this.camX / T * sc, y0 + this.camY / T * sc, this.viewW / T * sc, this.viewH / T * sc);
    for (const e of s.world.ents.values()) {
      if (e.kind !== "npc" || e.dead) continue;
      if (e.comp || e.master) { if (e.master === s.me.id && !this.miniPet(e, x0 + e.x * sc, y0 + e.y * sc, 14)) { ctx.fillStyle = "#9fe07f"; ctx.fillRect(x0 + e.x * sc - 1, y0 + e.y * sc - 1, 3, 3); } continue; }      // mi summon: su sprite; no es un enemigo (punto rojo)
      ctx.fillStyle = e.special ? "#ffd34d" : "#e2584a";
      ctx.fillRect(x0 + e.x * sc - 1, y0 + e.y * sc - 1, 2, 2);
    }
    for (const e of s.world.ents.values()) {
      if (e.kind !== "player" || e === s.me || e.dead) continue;
      ctx.fillStyle = "#7fc4ff";
      ctx.beginPath(); ctx.arc(x0 + (e.x * T + 16) / T * sc, y0 + (e.y * T + 16) / T * sc, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const gate of s.world.map?.portals || []) {
      ctx.fillStyle = "#8de4ff"; ctx.fillRect(x0 + gate.x * sc - 2, y0 + gate.y * sc - 2, 4, 4);
    }
    if (s.world.teleports?.size) for (const g of this.teleportGroups(s.world.teleports)) { ctx.fillStyle = g.open ? "#5aaaff" : "#a06a5a"; ctx.fillRect(x0 + g.x * sc - 2, y0 + g.y * sc - 2, 4, 4); }   // salidas del mapa (ticket 6)
    ctx.fillStyle = "#9fe07f";
    ctx.beginPath(); ctx.arc(x0 + ppx / T * sc, y0 + ppy / T * sc, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

