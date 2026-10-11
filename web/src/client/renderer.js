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
import { DUMMY_COLORS } from "../shared/systems/talents.js";
import { radiusOf } from "../shared/systems/dummy.js";
import { itemDef, itemName, groundKey } from "./names.js";
import { attrLines } from "../shared/attributes.js";
const guildLine = e => { const g = e.guild ? [e.guild.name, e.guild.rank] : e.gd; return g ? g[0] + (g[1] === 0 ? " Guildmaster" : " Guildsman") : null; };
import { sellPriceOf } from "../shared/systems/shopsys.js";
import { isStack } from "../shared/items.js";
import { miniOf } from "./compicon.js";
import { posOf, playerSprite, mobSprite, actionAt } from "./anim.js";
import { bodyKey, drawPerson, apparelOf, DEFAULT_LOOK } from "./look.js";

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
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.spr = assets.sprites;
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
    this.cam = null; this.chunks.clear(); this.buildMinimap();
  }

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

  groundChunk(cx, cy) {
    const hd = !!this.spr.hd, k = cx + "," + cy + (hd ? "h" : "");
    let c = this.chunks.get(k);
    if (c) return c;
    const Q = hd ? 2 : 1;                                   // remastered: el suelo se pregenera al doble de resolución
    c = document.createElement("canvas");
    c.width = c.height = CHUNK * T * Q;
    const g = c.getContext("2d");
    g.scale(Q, Q);
    g.imageSmoothingEnabled = hd; g.imageSmoothingQuality = "high";
    let ready = true;
    for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) {
      const t = this.grid.tile(cx * CHUNK + i, cy * CHUNK + j);
      if (t) {
        if (!this.spr.ready("t" + t.spr)) ready = false;
        else if (hd && this.spr.hdm["t" + t.spr] && this.spr.src("t" + t.spr)[1] === 1) ready = false;   // espera a la hoja HD
        this.spr.put(g, "t" + t.spr, t.frame, i * T, j * T);
      }
    }
    // Una hoja pendiente no debe dejar un bloque vacío guardado para toda la partida.
    if (ready) this.chunks.set(k, c);
    if (this.chunks.size > 96) this.chunks.delete(this.chunks.keys().next().value);
    return c;
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

    // 1) suelo
    const span = CHUNK * T;
    for (let cy = Math.floor(camY / span); cy * span < camY + VH; cy++)
      for (let cx = Math.floor(camX / span); cx * span < camX + VW; cx++)
        if (cx >= 0 && cy >= 0) ctx.drawImage(this.groundChunk(cx, cy), cx * span - camX, cy * span - camY, span, span);

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


    this.drawPetOrder(s, camX, camY);

    // sprites HD: se reducen con suavizado (los de 1x siguen sin él, como el original)
    ctx.imageSmoothingEnabled = !!this.spr.hd; ctx.imageSmoothingQuality = "high";
    // 3) objetos en el suelo
    const labels = [];
    for (const list of s.world.items.values()) {
      const it = list[list.length - 1];
      const x = it.x * T + 16 - camX, y = it.y * T + 16 - camY;
      if (x < -40 || y < -40 || x > VW + 40 || y > VH + 40) continue;
      const d = itemDef(it.id);
      if (d) this.spr.put(ctx, groundKey(d), d.spriteFrame, x, y);
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
      const R = (radiusOf(e.clvl || 1, e.dcls) + 0.5) * T, col = DUMMY_COLORS[e.dcls] || "#fff", pulse = 0.5 + 0.2 * Math.sin(performance.now() / 500);
      ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y + 4, R, 0, Math.PI * 2); ctx.stroke(); ctx.restore();       // alcance euclídeo (dummy.inRange): círculo
    }
    const buckets = new Map();
    // compañeros que desaparecen (guardados en la bola, cambio de mapa...): se desvanecen en vez de borrarse de golpe
    const nowMs = performance.now(), mapId = s.world.map?.id, seen = this.seenComp || (this.seenComp = new Map()), fades = this.fades || (this.fades = new Map());
    for (const [id, o] of seen) if (!s.world.ents.has(id)) {
      seen.delete(id);
      if (!o.e.dead && o.map === mapId) fades.set(id, { e: o.e, t0: nowMs });
    }
    for (const e of s.world.ents.values()) if (e.comp && !e.dead) seen.set(e.id, { e, map: mapId });
    for (const [id, f] of fades) {
      const k = (nowMs - f.t0) / 1000;
      if (k >= 1 || s.world.ents.has(id)) { fades.delete(id); continue; }
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
    for (let j = -2; j <= rows + 8; j++) {
      const ty = ty0 + j;
      for (let i = -7; i <= cols + 7; i++) {
        const tx = tx0 + i;
        const list = buckets.get(ty * 100000 + tx);
        if (list) {
          if (list.length > 1) list.sort((a, b) => (a[0].dead ? 0 : 1) - (b[0].dead ? 0 : 1));
          for (const [e, x, y] of list) this.drawEntity(e, x, y, s, overlays);
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

    if (s.showGrid) this.drawGrid(camX, camY, tx0, ty0, cols, rows);
    this.drawTeleportMarks(s, camX, camY, tx0, ty0, cols, rows);

    // 5) luz (remastered): viñeta y una luz cálida alrededor del personaje
    if (remaster && this.lighting !== false) {
      const cx = ppx - camX, cy = ppy - camY - 20, R = Math.max(VW, VH) * 0.75;
      const g = ctx.createRadialGradient(cx, cy, 60, cx, cy, R);
      g.addColorStop(0, "rgba(255,200,120,0.06)");
      g.addColorStop(0.45, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(5,6,14,0.62)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);
    }

    // 5b) noche y lluvia
    if (s.sky) s.sky.draw(ctx, VW, VH, s.fx?.sp);

    // 6) barras de vida, nombres, etiquetas, efectos
    this.rects = [];
    for (const o of overlays) o();
    for (const [x, y, text, color] of labels) this.label(x, y, text, color);
    for (const o of this.bq) o();                       // bocadillos: encima de nombres y etiquetas, sin pisarse entre sí
    this.bq = [];
    s.fx.draw(ctx, camX, camY, this.mode);
    if (remaster && s.clickFx) this.drawClickFx(s.clickFx, camX, camY);
    if (s.showMinimap) (s.mapStyle === "overlay" ? this.drawOverlayMap : this.drawMinimap).call(this, s, ppx, ppy);
    ctx.restore();
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

  // Orden al summon: línea de puntos desde él hasta la casilla (gris, "ve allí") o hasta el objetivo (roja, "ataca"). Desaparece al cumplirse o a los 15 s; el summon que anda solo no dibuja nada.
  drawPetOrder(s, camX, camY) {
    const o = s.petOrder; if (!o) return;
    const w = s.world, { ctx } = this, perf = performance.now();
    const pet = [...w.ents.values()].find(e => e.comp && e.master === s.me?.id && !e.dead);
    let tx, ty;
    if (o.kind === "go") { tx = o.x; ty = o.y; if (pet && pet.x === tx && pet.y === ty) o.done = true; }
    else { const t = w.ents.get(o.target); if (!t || t.dead) o.done = true; else { tx = t.x; ty = t.y; } }
    if (!pet || o.done || perf - o.at > 15000) { s.petOrder = null; if (o.done || !pet) o.at = -1e9; return; }
    const atk = o.kind === "atk", fade = Math.min(1, (15000 - (perf - o.at)) / 1500);
    ctx.save(); ctx.lineWidth = 2; ctx.setLineDash([3, 6]); ctx.lineCap = "round";
    ctx.strokeStyle = atk ? "rgba(255,70,60," + 0.85 * fade + ")" : "rgba(200,200,205," + 0.8 * fade + ")"; ctx.lineDashOffset = -perf / 60;
    ctx.beginPath(); ctx.moveTo(pet.x * T + 16 - camX, pet.y * T + 18 - camY); ctx.lineTo(tx * T + 16 - camX, ty * T + 18 - camY); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = atk ? "rgba(255,70,60," + 0.9 * fade + ")" : "rgba(200,200,205," + 0.9 * fade + ")";
    ctx.beginPath(); ctx.arc(tx * T + 16 - camX, ty * T + 18 - camY, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

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
      this.label(x, y - 40, gate.label + (closed ? " (cerrado)" : near ? " · E" : ""), closed ? "#e0a090" : "#bde8ff");
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
      if (e.name === "Frost") {
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
    if (e.kind === "npc" && e.comp && e.clvl >= 10 && (e.name === "Demon" || e.name === "Frost")) this.emberTrail(e, x, y, true);
    const remaster = this.mode === "remastered";
    const time = s.world.time;
    const hovered = s.hoverEnt === e || s.hoverCit === e;
    const flashAge = performance.now() - (s.fx.flash.get(e.id) || -1e9);

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
      spr.shadow(ctx, body, f, x, y, remaster ? 0.5 : 0.75);
      drawPerson(ctx, spr, gender, look, group, d, f, x, y, ap);
      ctx.globalAlpha = 1;
      if (ice) spr.tinted(ctx, body, f, x, y, "#4a8cff", 0.5);
      if (zerk) spr.tinted(ctx, body, f, x, y, "#ff2a1a", 0.35);
      this.auras(e, x, y, w, false);
      if (remaster && flashAge < 140) spr.tinted(ctx, body, f, x, y, "#ff3020", 0.55 * (1 - flashAge / 140));
      // nombre de los demás jugadores y bocadillo de chat
      const other = s.pid !== undefined && e.id !== s.pid;
      const bubble = s.bubbles && s.bubbles.get(e.id);
      const talking = bubble && performance.now() < bubble.until;
      if (talking) this.bq.push(() => this.label(x, y - 62 - (other && !e.dead ? 17 : 0), bubble.text.length > 64 ? bubble.text.slice(0, 63) + "…" : bubble.text, "#ffffff", true));   // los bocadillos se dibujan al final y esquivan lo ya escrito
      overlays.push(() => {
        const yy = y - 78;
        if (!other && s.pid !== undefined && !e.dead) {              // mi nombre se ve siempre
          const gl = guildLine(e);                                       // DEF_MSG_GUILDMASTER / GUILDSMAN: «<Guild> Guildmaster» en gris bajo el nombre
          this.origName(x, y, gl ? [[e.name, "255,255,255"], [gl, "180,180,180"]] : [[e.name, "255,255,255"]]);
        } else if (other && !e.dead && s.hoverPlayer === e) {          // el de los demás solo al pasar el ratón por encima
          const party = s.me?.party?.names?.includes(e.name);
          const nm = e.name + (party ? ", Party Member" : "");          // BGET_NPC_NAME23
          const mine = s.me?.side || 0, foe = e.arena || (e.pk > 0) || (mine > 0 && e.side > 0 && e.side !== mine);     // _iGetFOE: rojo enemigo (otro bando) / verde aliado
          const sideName = e.side === 1 ? "Aresden Combatant" : e.side === 2 ? "Elvine Combatant" : "Traveller";
          const gl = guildLine(e);
          this.origName(x, y, [[nm, "255,255,255"], [foe && !(mine > 0 && e.side > 0) ? "Criminal" : sideName, foe ? "255,0,0" : "30,200,30"], ...(gl ? [[gl, "180,180,180"]] : [])]);   // DRAW_OBJECT_NAME60 / DEF_MSG_PK
        }
      });
      return;
    }

    // monstruo
    let { key, f } = mobSprite(e, time, k => this.spr.frames(k));
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
      if (cc && e.name === "Demon" && e.clvl < 30) { /* Lv < 30: sin efecto de casteo */ }
      else if (cc && (e.name === "Liche" || e.name === "Frost") && e.clvl < 30) { /* idem */ }
      else if (cc) { if (e.name === "Demon") { const ag = performance.now() - cc.at; flare = Math.max(0, Math.min(1, ag / 200, (1700 - ag) / 600)); } this.castCircle(ctx, x, y, cc, e, s.fx || this.fx); } }          // círculo de casteo del summon en nivel máximo: bajo sus pies, antes de la sombra y el sprite
    ctx.globalAlpha = alpha;
    if (!e.dead && !NO_SHADOW.has(e.type)) spr.shadow(ctx, key, f, x, y, remaster ? 0.45 : 0.75);   // DrawObject_OnStop: sin sombra
    const big = e.crystal ? 1.8 : e.boss === 4 ? 1.44 : e.boss ? 1.2 : 1;           // el último jefe (dorado) un 20 % mayor que los demás
    if (big !== 1) { ctx.save(); ctx.translate(x, y); ctx.scale(big, big); ctx.translate(-x, -y); }          // jefe: sprite un 20 % mayor y teñido
    const hover = 0;
    if (hover) { ctx.save(); ctx.translate(0, -hover); }
    const isD = e.comp && e.name === "Demon", isF = e.comp && e.name === "Frost";
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
    if (e.comp && e.name === "Liche") spr.tinted(ctx, key, f, x, y, "#000000", 0.35);        // Liche: su color original, solo más oscuro
    if (e.comp && e.name === "Demon" && e.clvl < 10 && alive) spr.tinted(ctx, key, f, x, y, "#000000", 0.38);   // Demon Lv < 10: brasa apagada (ceniza); se enciende al llegar al 10
    if (flare > 0 && alive) spr.tinted(ctx, key, f, x, y, "#ff8a20", 0.3 * flare, "lighter");   // Demon casteando: el cuerpo arde
    if (e.crystal && alive) spr.tinted(ctx, key, f, x, y, "#8fe8ff", 0.2 + 0.15 * Math.sin(time / 260 + e.id), "lighter");
    if (e.shield && alive) spr.tinted(ctx, key, f, x, y, "#bff0ff", 0.35 + 0.15 * Math.sin(time / 200), "lighter");   // escudo de hielo
    if (e.wrath && alive) spr.tinted(ctx, key, f, x, y, "#ffb020", 0.07 * e.wrath, "lighter");                // contador de furia del rey dorado
    if (big !== 1) ctx.restore();
    if (hover) ctx.restore();
    if (e.shield && alive) { ctx.strokeStyle = "rgba(170,230,255,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 20, 30, 40, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (alive && (sget(s.world, e, "ice") || (e.chillUntil || 0) > s.world.time)) spr.tinted(ctx, key, f, x, y, "#4a8cff", 0.5);
    if (alive && sget(s.world, e, "berserk")) spr.tinted(ctx, key, f, x, y, "#ff2a1a", 0.35);
    if (alive) this.auras(e, x, y, s.world, true);
    if (remaster) {
      if (flashAge < 150) spr.tinted(ctx, key, f, x, y, "#ffffff", 0.75 * (1 - flashAge / 150));
      else if (hovered && alive) spr.tinted(ctx, key, f, x, y, "#ffe8b0", 0.22, "lighter");
    }
    if (e.comp && e.dcls && alive) {                                                       // Dummy: el color indica su clase (verde Healer, amarillo Buffer, azul Aura)
      spr.tinted(ctx, key, f, x, y, DUMMY_COLORS[e.dcls] || "#fff", 0.5);
    }
    { const glow = Math.max(this.fx?.evoGlow?.(e.id) || 0, e.evoK > 0 ? e.evoK * (0.15 + 0.2 * Math.abs(Math.sin(performance.now() / 1000 * (1 + 10 * e.evoK) * Math.PI))) : 0);
      if (glow > 0 && !e.dead) spr.tinted(ctx, key, f, x, y, "#ffffff", Math.min(1, glow), "lighter"); }
    const fade = alive ? 1 : act === ACT.DYING ? Math.max(0, 1 - (time - (e.actStart || 0)) / Math.max(1, e.actDur || 700) * 1.6) : 0;   // al morir las luces se apagan en fundido
    if (e.comp && fade > 0 && (e.name === "Liche" ? e.clvl >= 20 : e.name === "Demon" ? e.clvl >= 10 : e.clvl >= 20 && e.name === "Frost")) {   // summon evolucionado en nivel máximo: aura propia continua (solo Demon, Frost y Liche Lv 50)
      const sp = this.fx?.sp, seed = e.id * 997, T = time + seed, rnd = (k) => { const h = Math.sin(k * 12.9898 + e.id) * 43758.5453; return h - Math.floor(h); };
      ctx.save(); ctx.globalAlpha = (e.name === "Liche" ? 1 : 0.5) * fade;                            // Demon y Frost más sutiles, a la altura del Liche
      if (e.name === "Demon") {                                                          // Lv 10 ojos de brasa, 40 calor y chispas lentas, 50 más intensos
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
      } else if (e.name === "Liche") {                                                   // oscuridad que da miedo: sombra bajo él, humo negro que sube, ojos ardientes (mirando hacia abajo, abajo-izquierda y abajo-derecha)
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

    if (sc !== 1) ctx.restore();

    // encima de todo: nombre y vida
    if (e.dead) return;
    const top = y - this.mobHeight(key, f) * sc * (e.boss === 4 ? 1.44 : e.boss ? 1.2 : 1) - 6;
    if (remaster && e.kind !== "citizen" && (s.world.map?.kind === "dungeon" || e.hp < e.maxHp || hovered || e.arena)) {
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
    if (hovered || e.arena || e.comp) {
      overlays.push(() => {
        const name = (e.special && remaster ? "★ " : "") + ((e.comp || e.arena) ? (e.nick || e.name) + (e.clvl ? " Lv " + e.clvl : "") : e.crystal ? "Cristal de hielo" : e.ghost ? "Fantasma skeleton" : e.boss ? BOSS_NAMES[e.boss] : e.name);
        const owner = e.comp && e.master != null ? s.world.ents.get(e.master)?.name : null;
        const side = e.comp ? ["(" + (owner || "Friendly") + ")", "30,255,30"] : e.kind === "citizen" ? ["(Friendly)", "30,255,30"] : ["(Enemy)", "255,0,0"];          // el compañero muestra el nombre de su dueño          // DRAW_OBJECT_NAME89 / 90
        this.origName(x, y, [[name, e.special && remaster ? AURA[e.special] : "255,255,255"], side]);
      });
    }
  }

  // Escala fija por especie (altura del fotograma de reposo la primera vez que se ve): solo se reducen los más altos que el personaje
  petScale(e, key, f) {
    const c = this.petScales || (this.petScales = new Map());
    if (!c.has(e.name)) {
      const fr = this.spr.frame(key, f), h = fr ? fr[3] : 0;
      if (!h || !this.spr.ready(key)) return 1;
      c.set(e.name, h > CHAR_H ? (CHAR_H / 2) / h : 0.7);          // los pequeños nacen al 70 %
    }
    // tamaño por etapas (niveles 10, 25, 40 y 50; companion.SIZE_STAGES): crece a saltos hasta el tamaño real al 50
    const lich = e.name === "Liche", K = lich ? [0.5, 1] : [0, 0.3, 0.55, 0.8, 1], st = lich ? (e.clvl >= 10 ? 1 : 0) : sizeStep(e.clvl);   // Liche: mediano hasta el 9, tamaño normal desde el 10
    const base = c.get(e.name), k = K[st], size = base + (1 - base) * k;
    const ratio = st > 0 ? (base + (1 - base) * K[st - 1]) / size : 1;                  // tamaño de la etapa anterior / actual (para la animación de evolución)
    const pulse = e.evoK > 0 ? 1 + 0.05 * Math.sin(performance.now() / 1000 * (2 + 14 * e.evoK) * Math.PI) * (0.4 + e.evoK) : 1;     // último nivel antes de evolucionar: late cada vez más rápido
    return size * (this.fx?.popScale?.(e.id, ratio) ?? 1) * pulse;
  }

  // Orbe violeta del báculo del Liche: centroide de los píxeles violeta más altos del fotograma (relativo al pivote); se calcula una vez por fotograma
  // Círculo de casteo (summon Lv 50, 1700 ms): nace girando, se sostiene pulsando y se apaga. Todo es elipse en perspectiva y va BAJO el sprite.
  castCircle(ctx, x, y, cc, e, fx) {
    const ck = (performance.now() - cc.at) / 1700;
    if (ck >= 1) { fx.scast.delete(e.id); return; }
    const cfg = CAST_CFG[cc.sc] || CAST_CFG.def, col = hexRgb(cfg.color), core = hexRgb(cfg.core), br = cfg.bright;
    const grow = Math.min(1, ck / 0.22), ease = 1 - (1 - grow) ** 3, po = Math.max(0, (ck - 0.7) / 0.3), out = 1 - po * po * (3 - 2 * po), a = ease * out * br;     // final: 510 ms, se cierra hacia el centro mientras se desvanece
    const R = Math.max(0.5, (cfg.size * ease + 3 * Math.sin(ck * 18) * ease) * (1 - 0.3 * po * po)), ry = 0.42, cy = y + 3, rot = ck * 4.2, T = ck * 1700;
    const rgba = (c, al) => "rgba(" + c + "," + Math.max(0, al).toFixed(3) + ")";
    const ring = (r, w, al, dash) => { r = Math.max(0.1, r); ctx.lineWidth = w; ctx.strokeStyle = rgba(col, al); ctx.setLineDash(dash || []); ctx.beginPath(); ctx.ellipse(x, cy, r, r * ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); };
    const pt = (q, r) => [x + Math.cos(q) * r, cy + Math.sin(q) * r * ry];
    if (cc.sc === "Frost") return this.iceNova(ctx, x, cy, { R: cfg.size, ry, T, a: ease * br, col, core, rgba }, e);
    if (cc.sc === "Demon") return this.infernoBurst(ctx, x, cy, { R: cfg.size, ry, T, a: ease * br, col, core, rgba }, e);   // el Demon no es mago: en vez de círculo, erupción de lava (fireCircle queda sin uso)
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
    if (L >= 50) {                                                                          // Lv 50: grietas de lava en el suelo
      const ca = Math.max(0, 1 - Math.max(0, ck - 0.4) / 0.6); ctx.lineCap = "round";
      for (let n = 0; n < nC; n++) {
        const a0 = n * 2 * Math.PI / nC + rnd(n) * 0.5, len = Rr * (0.6 + 0.4 * rnd(n + 9)) * eo; let px = x, py = cy;
        ctx.strokeStyle = rgba(core, 0.7 * ca); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(px, py);
        for (let sg = 1; sg <= 5; sg++) { const a = a0 + (rnd(n * 7 + sg) - 0.5) * 0.7, r = len * sg / 5; px = x + Math.cos(a) * r; py = cy + Math.sin(a) * r * ry; ctx.lineTo(px, py); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Frost: nova de hielo al castear (Lv 30/40/50 cada vez mayor). Onda azul que se expande desde los pies, grietas de escarcha en el suelo y esquirlas que saltan. Bajo el sprite.
  iceNova(ctx, x, cy, k, e) {
    const { R, ry, T, col, core, rgba } = k, ck = T / 1700, L = e.clvl, sc = L >= 50 ? 1.15 : L >= 40 ? 0.95 : 0.75, Rr = R * sc, nC = L >= 50 ? 9 : L >= 40 ? 7 : 5;
    const rnd = (n) => { const q = Math.sin(n * 12.9898 + e.id) * 43758.5453; return q - Math.floor(q); };
    const ex = Math.min(1, ck / 0.35), ee = 1 - (1 - ex) ** 3, fa = Math.max(0, 1 - Math.max(0, ck - 0.45) / 0.55);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const g = ctx.createRadialGradient(x, cy, 0, x, cy, Rr * 1.1); g.addColorStop(0, rgba(core, 0.35 * fa)); g.addColorStop(0.6, rgba(col, 0.2 * fa)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, Rr * 1.1, Rr * 1.1 * ry, 0, 0, Math.PI * 2); ctx.fill();
    const wr = Math.max(0.5, Rr * ee);                                                      // onda que se expande
    ctx.strokeStyle = rgba(core, 0.8 * fa); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(x, cy, wr, wr * ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(col, 0.5 * fa); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, cy, wr * 0.7, wr * 0.7 * ry, 0, 0, Math.PI * 2); ctx.stroke();
    for (let n = 0; n < nC; n++) {                                                         // grietas de escarcha que se abren desde los pies
      const a0 = n * 2 * Math.PI / nC + rnd(n) * 0.5, len = Rr * (0.65 + 0.35 * rnd(n + 9)) * ee; let px = x, py = cy;
      ctx.strokeStyle = rgba(core, 0.75 * fa); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(px, py);
      for (let sg = 1; sg <= 5; sg++) { const a = a0 + (rnd(n * 7 + sg) - 0.5) * 0.7, r = len * sg / 5; px = x + Math.cos(a) * r; py = cy + Math.sin(a) * r * ry; ctx.lineTo(px, py); }
      ctx.stroke();
      const sh = Math.min(1, Math.max(0, (ck - 0.15 - n * 0.02) / 0.3)) * fa;                // esquirla de hielo al final de la grieta
      if (sh > 0) { const h = 14 * sh * sc; ctx.fillStyle = rgba(core, 0.7 * sh); ctx.beginPath(); ctx.moveTo(px - 2, py); ctx.lineTo(px, py - h); ctx.lineTo(px + 2, py); ctx.closePath(); ctx.fill(); }
    }
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

  // casillas de teletransporte (p. ej. la entrada a Promise Land en el borde del mapa): rombo azul que late, para saber dónde pisar
  drawTeleportMarks(s, camX, camY, tx0, ty0, cols, rows) {
    const tps = s.world?.teleports; if (!tps?.size) return;
    const { ctx } = this, k = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const tx = tx0 + i, ty = ty0 + j;
      if (!tps.has(this.grid.idx(tx, ty))) continue;
      const x = tx * T - camX + T / 2, y = ty * T - camY + T / 2;
      ctx.fillStyle = "rgba(90,170,255," + (0.12 + 0.14 * k) + ")";
      ctx.beginPath(); ctx.moveTo(x, y - T / 2); ctx.lineTo(x + T / 2, y); ctx.lineTo(x, y + T / 2); ctx.lineTo(x - T / 2, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(170,225,255," + (0.5 + 0.4 * k) + ")"; ctx.lineWidth = 1.5; ctx.stroke();
    }
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
  buildMinimap() {
    const g = this.grid;
    const m = document.createElement("canvas");
    m.width = g.w; m.height = g.h;
    const c = m.getContext("2d");
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const t = g.tile(x, y), key = "t" + t.spr, fr = this.spr.frame(key, t.frame);
      if (!fr || !this.spr.ready(key)) { c.fillStyle = g.blocked(x, y) ? "#302c28" : "#71675b"; c.fillRect(x, y, 1, 1); continue; }
      c.drawImage(this.spr.img[key], fr[0], fr[1], fr[2], fr[3], x, y, 1, 1);
    }
    c.fillStyle = "rgba(0,0,0,.35)";
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.blocked(x, y)) c.fillRect(x, y, 1, 1);
    this.minimap = m;
    // versión "líneas" para el mapa superpuesto: solo los bordes de lo que bloquea el paso
    const o = document.createElement("canvas");
    o.width = g.w; o.height = g.h;
    const oc = o.getContext("2d");
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.blocked(x, y)) {
        const edge = !g.blocked(x - 1, y) || !g.blocked(x + 1, y) || !g.blocked(x, y - 1) || !g.blocked(x, y + 1);
        if (edge) { oc.fillStyle = "rgba(226,208,150,.9)"; oc.fillRect(x, y, 1, 1); }
      } else { oc.fillStyle = "rgba(90,140,200,.18)"; oc.fillRect(x, y, 1, 1); }
    }
    this.overlayImg = o;
  }

  // sprite pequeño (reposo, de frente) de mi summon sobre el minimapa; false si su hoja aún no está cargada
  miniPet(e, x, y, h) {
    const m = miniOf(e.name, k => this.spr.frames(k)); if (!m || !this.spr.ready(m.key)) return false;
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
  minimapHit(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const vx = ((clientX - r.left) * this.dpr - this.ox) / this.scale, vy = ((clientY - r.top) * this.dpr - this.oy) / this.scale;
    const size = this.miniSize || (this.mode === "remastered" ? 170 : 140), pad = 10, x0 = this.viewW - size - pad, top = this.miniTop ?? pad;
    return vx >= x0 - 3 && vx <= x0 + size + 3 && vy >= top - 3 && vy <= top + size + 3;
  }

  drawMinimap(s, ppx, ppy) {
    const { ctx } = this;
    const remaster = this.mode === "remastered";
    const size = this.miniSize || (remaster ? 170 : 140), pad = 10, x0 = this.viewW - size - pad, y0 = this.miniTop ?? pad;      // en móvil (mobile.js) más pequeño y bajo los botones
    const sc = size / this.grid.w;
    ctx.globalAlpha = remaster ? 0.9 : 1;
    ctx.fillStyle = "#14161a";
    ctx.fillRect(x0 - 3, y0 - 3, size + 6, size + 6);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.minimap, x0, y0, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
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
    ctx.fillStyle = "#9fe07f";
    ctx.beginPath(); ctx.arc(x0 + ppx / T * sc, y0 + ppy / T * sc, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

