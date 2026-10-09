// Dibujo del mundo. Dos modos sobre la misma simulación, como Diablo II Resurrected:
//   classic    -> 800x600 del original, cámara fija al personaje, sin efectos añadidos
//   remastered -> pantalla completa (más campo de visión), cámara suave, zoom con la rueda,
//                 luz y viñeta, destellos, barras de vida, etiquetas de objetos, partículas
import { t } from "./i18n.js";
import { BOSS_COLORS, BOSS_NAMES } from "../shared/dungeon.js";
const CHAR_H = 56;          // altura aproximada del personaje (fotograma de cuerpo): referencia para reducir a los compañeros altos
import { TILE as T, ACT, TRANSLUCENT_MOBS, CORPSE_MS, DX, DY } from "../shared/const.js";
import { sget } from "../shared/systems/status.js";
import { itemDef, itemName, groundKey } from "./names.js";
import { posOf, playerSprite, mobSprite, actionAt } from "./anim.js";
import { bodyKey, drawPerson, apparelOf, DEFAULT_LOOK } from "./look.js";

const CHUNK = 16;                       // casillas por bloque de suelo pregenerado
const CLASSIC_W = 800, CLASSIC_H = 600;
const AURA = { 1: "255,210,80", 2: "120,220,255", 3: "200,120,255", 4: "120,160,255", 5: "255,120,80", 6: "120,255,140", 7: "255,150,40", 8: "255,60,60" };

// Client/Game.cpp, DrawObject_On*: monstruos sin sombra (Slime, Tigerworm, Plant, Ice-Golem, esfera, Abaddon, puerta...)
const NO_SHADOW = new Set([10, 35, 50, 51, 60, 65, 81, 91]);

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
    const camX = this.camX = Math.round(this.cam[0] * this.scale) / this.scale;
    const camY = this.camY = Math.round(this.cam[1] * this.scale) / this.scale;

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
      if (s.labels || (s.hover && s.hover[0] === it.x && s.hover[1] === it.y))
        labels.push([x, y - 14, it.id === 90 ? it.count + " oro" : itemName(it.id, it.attr, it.comp), it.id === 90 ? "#f0d080" : it.attr ? "#9fe39a" : "#e8e2d0"]);
    }

    // 4) personajes y objetos del mapa, fila a fila (orden del cliente original)
    const buckets = new Map();
    for (const e of s.world.ents.values()) {
      const [px, py] = posOf(e, time);
      if (px < camX - 120 || px > camX + VW + 120 || py < camY - 120 || py > camY + VH + 200) continue;
      const moving = (e.act === ACT.MOVE || e.act === ACT.RUN) && time < e.actStart + e.actDur;
      const row = moving ? Math.max(e.y, e.fy) : e.y;
      const col = Math.round((px - 16) / T);
      const k = row * 100000 + col;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push([e, px - camX, py - camY]);
    }
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
    if (s.world.map?.kind === "dungeon") this.drawDungeonInfo(s);
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

  drawDungeonInfo(s) {
    const { ctx } = this, map = s.world.map;
    const remaining = map.remainingEnemies ?? [...s.world.ents.values()].filter(e => e.kind === "npc" && !e.comp && !e.dead).length;
    ctx.save();
    ctx.fillStyle = "rgba(15,14,19,.85)"; ctx.fillRect(10, 10, 330, 48);
    ctx.textAlign = "left"; ctx.font = "bold 13px Tahoma, sans-serif";
    ctx.fillStyle = "#e8dcc3"; ctx.fillText("Nivel " + map.level + " / " + map.total + (map.boss ? " · JEFE" : ""), 20, 29);
    ctx.font = "12px Tahoma, sans-serif"; ctx.fillStyle = remaining ? "#e5bca0" : "#9fe07f";
    ctx.fillText(remaining ? "Esqueletos restantes: " + remaining + " / " + map.totalEnemies : (map.level >= map.total ? "¡Cripta despejada! Busca la salida (E)." : "¡Nivel despejado! Baja por el portal (E)."), 20, 47);
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
      const pit = gate.target === "down", key = pit ? "cryptpit" : "cryptdoor", oy = pit ? 0 : 16;
      ctx.globalAlpha = closed ? 0.6 : 1;
      this.spr.put(ctx, key, 0, x, y + oy);
      ctx.globalAlpha = 1;
      if (closed) this.spr.tinted(ctx, key, 0, x, y + oy, "#000000", 0.35);
      else if (near) this.spr.tinted(ctx, key, 0, x, y + oy, "#ffd890", 0.12 + 0.08 * Math.sin(s.world.time / 220), "lighter");
      this.label(x, y - (pit ? 40 : 72), gate.label + (closed ? " (cerrado)" : near ? " · E" : ""), closed ? "#e0a090" : "#bde8ff");
      ctx.restore();
    }
  }

  drawEntity(e, x, y, s, overlays) {
    const { ctx, spr } = this;
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
      if (talking) this.bq.push(() => this.label(x, y - 78 - (other && !e.dead ? 17 : 0), bubble.text.length > 64 ? bubble.text.slice(0, 63) + "…" : bubble.text, "#ffffff", true));   // los bocadillos se dibujan al final y esquivan lo ya escrito
      overlays.push(() => {
        const yy = y - 78;
        if (other && !e.dead) {
          if (remaster) this.label(x, yy, e.name, "#9fd2ff");
          else {
            ctx.font = "12px 'Courier New', monospace"; ctx.textAlign = "center";
            ctx.fillStyle = "#000"; ctx.fillText(e.name, x + 1, yy + 1);
            ctx.fillStyle = "#b8dcff"; ctx.fillText(e.name, x, yy);
          }
        }
      });
      return;
    }

    // monstruo
    let { key, f } = mobSprite(e, time, k => this.spr.frames(k));
    if (e.crystal) { key = "id1"; f = 1; }                                                     // cristal de hielo del jefe glacial: mineral 2 de item-dynamic (Game.cpp, DEF_DYNAMICOBJECT_MINERAL2)
    const act = actionAt(e, time);
    let alpha = TRANSLUCENT_MOBS.has(e.type) ? 0.62 : 1;
    if (e.ghost) alpha *= 0.3;                                                                 // esqueleto fantasma: 30 % de opacidad
    if (e.clone) alpha *= 0.5 + 0.12 * Math.sin(time / 130 + e.id);                           // clon de sombra del rey umbrío: translúcido y parpadeante
    if (e.boss === 2 && !e.clone && e.hasClones && !e.dead) {                                  // el real: aro violeta bajo los pies
      ctx.strokeStyle = "rgba(190,120,255," + (0.55 + 0.3 * Math.sin(time / 200)) + ")"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + 4, 26, 12, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (act === ACT.DEAD) {
      const left = e.actStart + e.actDur + CORPSE_MS - time;
      if (remaster && left < 1500) alpha *= Math.max(0, left / 1500);
    }
    if (remaster && e.special && !e.dead) {
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
    ctx.globalAlpha = alpha;
    if (!e.dead && !NO_SHADOW.has(e.type)) spr.shadow(ctx, key, f, x, y, remaster ? 0.45 : 0.75);   // DrawObject_OnStop: sin sombra
    const big = e.crystal ? 1.8 : e.boss === 4 ? 1.44 : e.boss ? 1.2 : 1;           // el último jefe (dorado) un 20 % mayor que los demás
    if (big !== 1) { ctx.save(); ctx.translate(x, y); ctx.scale(big, big); ctx.translate(-x, -y); }          // jefe: sprite un 20 % mayor y teñido
    spr.put(ctx, key, f, x, y);
    if (e.boss && !e.dead) spr.tinted(ctx, key, f, x, y, BOSS_COLORS[e.boss] || "#ff3b2e", 0.5);
    if (e.crystal && !e.dead) spr.tinted(ctx, key, f, x, y, "#8fe8ff", 0.2 + 0.15 * Math.sin(time / 260 + e.id), "lighter");
    if (e.shield && !e.dead) spr.tinted(ctx, key, f, x, y, "#bff0ff", 0.35 + 0.15 * Math.sin(time / 200), "lighter");   // escudo de hielo
    if (e.wrath && !e.dead) spr.tinted(ctx, key, f, x, y, "#ffb020", 0.07 * e.wrath, "lighter");                // contador de furia del rey dorado
    if (big !== 1) ctx.restore();
    if (e.shield && !e.dead) { ctx.strokeStyle = "rgba(170,230,255,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 20, 30, 40, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (!e.dead && (sget(s.world, e, "ice") || (e.chillUntil || 0) > s.world.time)) spr.tinted(ctx, key, f, x, y, "#4a8cff", 0.5);
    if (!e.dead && sget(s.world, e, "berserk")) spr.tinted(ctx, key, f, x, y, "#ff2a1a", 0.35);
    if (!e.dead) this.auras(e, x, y, s.world, true);
    if (remaster) {
      if (flashAge < 150) spr.tinted(ctx, key, f, x, y, "#ffffff", 0.75 * (1 - flashAge / 150));
      else if (hovered && !e.dead) spr.tinted(ctx, key, f, x, y, "#ffe8b0", 0.22, "lighter");
    }
    if (sc !== 1) ctx.restore();

    // encima de todo: nombre y vida
    if (e.dead) return;
    const top = y - this.mobHeight(key, f) * sc * (e.boss === 4 ? 1.44 : e.boss ? 1.2 : 1) - 6;
    if (remaster && e.kind !== "citizen" && (s.world.map?.kind === "dungeon" || e.hp < e.maxHp || hovered)) {
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
    if (hovered || remaster && e.kind !== "citizen" && s.world.map?.kind === "dungeon") {
      overlays.push(() => {
        const name = (e.special && remaster ? "★ " : "") + (e.comp ? (e.nick || e.name) : e.crystal ? "Cristal de hielo" : e.ghost ? "Fantasma skeleton" : e.boss ? BOSS_NAMES[e.boss] : e.name);
        if (remaster) this.label(x, top - 8, name, e.special ? "rgb(" + AURA[e.special] + ")" : "#f2e6c8");
        else {
          ctx.font = "12px 'Courier New', monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "#000"; ctx.fillText(name, x + 1, y + 21);
          ctx.fillStyle = "#fff"; ctx.fillText(name, x, y + 20);
        }
      });
    }
  }

  // Escala fija por especie (altura del fotograma de reposo la primera vez que se ve): solo se reducen los más altos que el personaje
  petScale(e, key, f) {
    const c = this.petScales || (this.petScales = new Map());
    if (!c.has(e.name)) {
      const fr = this.spr.frame(key, f), h = fr ? fr[3] : 0;
      if (!h || !this.spr.ready(key)) return 1;
      c.set(e.name, h > CHAR_H ? (CHAR_H / 2) / h : 1);
    }
    const base = c.get(e.name), k = Math.max(0, Math.min(1, ((e.clvl || 1) - 1) / 49));       // crece con el nivel: tamaño real al 50
    return base + (1 - base) * k;
  }

  mobHeight(key, f) {
    const fr = this.spr.frame(key, f);
    return fr ? -fr[5] : 40;
  }

  label(x, y, text, color, avoid = false) {
    const { ctx } = this;
    text = t(text);
    ctx.font = "600 11px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    const w = ctx.measureText(text).width + 10;
    const rects = this.rects || (this.rects = []);
    const hit = yy => rects.some(r => x - w / 2 < r[2] && x + w / 2 > r[0] && yy - 11 < r[3] && yy + 4 > r[1]);
    if (avoid) for (let i = 0; i < 8 && hit(y); i++) y -= 16;                // sube hasta no pisar otra etiqueta
    rects.push([x - w / 2, y - 11, x + w / 2, y + 4]);
    ctx.fillStyle = "rgba(12,12,16,.78)";
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - 11), Math.round(w), 15);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
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
    const size = this.mode === "remastered" ? 170 : 140, pad = 10, x0 = this.viewW - size - pad;
    return vx >= x0 - 3 && vx <= x0 + size + 3 && vy >= pad - 3 && vy <= pad + size + 3;
  }

  drawMinimap(s, ppx, ppy) {
    const { ctx } = this;
    const remaster = this.mode === "remastered";
    const size = remaster ? 170 : 140, pad = 10, x0 = this.viewW - size - pad, y0 = pad;
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

