// Dibujo del mundo. Dos modos sobre la misma simulación, como Diablo II Resurrected:
//   classic    -> 800x600 del original, cámara fija al personaje, sin efectos añadidos
//   remastered -> pantalla completa (más campo de visión), cámara suave, zoom con la rueda,
//                 luz y viñeta, destellos, barras de vida, etiquetas de objetos, partículas
import { TILE as T, ACT, TRANSLUCENT_MOBS, CORPSE_MS, DX, DY } from "../shared/const.js";
import { sget } from "../shared/systems/status.js";
import { itemDef, itemName, groundKey } from "./names.js";
import { posOf, playerSprite, mobSprite, actionAt } from "./anim.js";
import { bodyKey, drawPerson, apparelOf, DEFAULT_LOOK } from "./look.js";

const CHUNK = 16;                       // casillas por bloque de suelo pregenerado
const CLASSIC_W = 800, CLASSIC_H = 600;
const AURA = { 1: "255,210,80", 2: "120,220,255", 3: "200,120,255", 5: "255,120,80" };

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
        if (this.grid.procedural) {
          g.fillStyle = t.blocked ? "#302c28" : "#71675b";
          g.fillRect(i * T, j * T, T, T);
        }
        if (!this.spr.ready("t" + t.spr)) ready = false;
        else if (hd && this.spr.hdm["t" + t.spr] && this.spr.src("t" + t.spr)[1] === 1) ready = false;   // espera a la hoja HD
        this.spr.put(g, "t" + t.spr, t.frame, i * T, j * T);
        if (this.grid.procedural && !t.blocked) {
          g.fillStyle = "rgba(24,21,29,.35)"; g.fillRect(i * T, j * T, T, T);
        }
        if (this.grid.procedural && t.blocked) {
          const x = cx * CHUNK + i, y = cy * CHUNK + j;
          const edge = !this.grid.blocked(x - 1, y) || !this.grid.blocked(x + 1, y) || !this.grid.blocked(x, y - 1) || !this.grid.blocked(x, y + 1);
          g.fillStyle = edge ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.5)"; g.fillRect(i * T, j * T, T, T);
          if (!this.grid.blocked(x, y + 1)) {
            g.fillStyle = "#65564a"; g.fillRect(i * T, j * T + T - 6, T, 2);
            g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(i * T, j * T + T - 4, T, 4);
          }
        }
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
        labels.push([x, y - 14, it.id === 90 ? it.count + " oro" : itemName(it.id, it.attr), it.id === 90 ? "#f0d080" : it.attr ? "#9fe39a" : "#e8e2d0"]);
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
    for (const o of overlays) o();
    for (const [x, y, text, color] of labels) this.label(x, y, text, color);
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

  drawDungeonInfo(s) {
    const { ctx } = this, map = s.world.map;
    const room = this.grid.rooms?.find(r => s.me.x >= r.x && s.me.x < r.x + r.w && s.me.y >= r.y && s.me.y < r.y + r.h);
    const remaining = map.remainingEnemies ?? [...s.world.ents.values()].filter(e => e.kind === "npc" && !e.dead).length;
    ctx.save();
    ctx.fillStyle = "rgba(15,14,19,.85)"; ctx.fillRect(10, 10, 290, 48);
    ctx.textAlign = "left"; ctx.font = "bold 13px Tahoma, sans-serif";
    ctx.fillStyle = "#e8dcc3"; ctx.fillText(room?.name || "Galerías de la cripta", 20, 29);
    ctx.font = "12px Tahoma, sans-serif"; ctx.fillStyle = remaining ? "#e5bca0" : "#9fe07f";
    ctx.fillText(remaining ? "Esqueletos restantes: " + remaining + " / " + map.totalEnemies : "¡Cripta despejada! Recoge el botín y regresa (E).", 20, 47);
    ctx.restore();
  }

  drawPortals(s, camX, camY) {
    const { ctx } = this;
    for (const gate of s.world.map?.portals || []) {
      const x = gate.x * T + 16 - camX, y = gate.y * T + 16 - camY;
      if (x < -150 || y < -80 || x > this.viewW + 150 || y > this.viewH + 80) continue;
      ctx.save();
      ctx.fillStyle = "rgba(15,20,33,.9)"; ctx.strokeStyle = "#8ccde8"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + 5, 15, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(140,205,232,.65)"; ctx.beginPath(); ctx.ellipse(x, y - 10, 10, 19, 0, 0, Math.PI * 2); ctx.stroke();
      const near = Math.max(Math.abs(gate.x - s.me.x), Math.abs(gate.y - s.me.y)) <= 1;
      this.label(x, y - 36, gate.label + (near ? " · E" : ""), "#bde8ff");
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
      const { group, f, d } = playerSprite(e, time);
      const look = e.look || DEFAULT_LOOK, gender = e.gender || 1;
      const body = bodyKey(gender, look, group, d);
      const w = s.world, invis = sget(w, e, "invis"), ice = sget(w, e, "ice"), zerk = sget(w, e, "berserk");
      if (invis && e.id !== s.pid) return;                                   // los demás no ven a un invisible
      this.auras(e, x, y, w, true);
      if (invis) ctx.globalAlpha = 0.4;
      spr.shadow(ctx, body, f, x, y, remaster ? 0.5 : 0.75);
      drawPerson(ctx, spr, gender, look, group, d, f, x, y, apparelOf(e, itemDef));
      ctx.globalAlpha = 1;
      if (ice) spr.tinted(ctx, body, f, x, y, "#4a8cff", 0.5);
      if (zerk) spr.tinted(ctx, body, f, x, y, "#ff2a1a", 0.35);
      this.auras(e, x, y, w, false);
      if (remaster && flashAge < 140) spr.tinted(ctx, body, f, x, y, "#ff3020", 0.55 * (1 - flashAge / 140));
      // nombre de los demás jugadores y bocadillo de chat
      const other = s.pid !== undefined && e.id !== s.pid;
      const bubble = s.bubbles && s.bubbles.get(e.id);
      overlays.push(() => {
        let yy = y - 78;
        if (bubble && performance.now() < bubble.until) {
          this.label(x, yy, bubble.text.length > 48 ? bubble.text.slice(0, 47) + "…" : bubble.text, "#ffffff");
          yy -= 17;
        }
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
    const { key, f } = mobSprite(e, time, k => this.spr.frames(k));
    const act = actionAt(e, time);
    let alpha = TRANSLUCENT_MOBS.has(e.type) ? 0.62 : 1;
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
    ctx.globalAlpha = alpha;
    if (!e.dead) spr.shadow(ctx, key, f, x, y, remaster ? 0.45 : 0.75);
    spr.put(ctx, key, f, x, y);
    ctx.globalAlpha = 1;
    if (!e.dead && sget(s.world, e, "ice")) spr.tinted(ctx, key, f, x, y, "#4a8cff", 0.5);
    if (!e.dead && sget(s.world, e, "berserk")) spr.tinted(ctx, key, f, x, y, "#ff2a1a", 0.35);
    if (!e.dead) this.auras(e, x, y, s.world, true);
    if (remaster) {
      if (flashAge < 150) spr.tinted(ctx, key, f, x, y, "#ffffff", 0.75 * (1 - flashAge / 150));
      else if (hovered && !e.dead) spr.tinted(ctx, key, f, x, y, "#ffe8b0", 0.22, "lighter");
    }

    // encima de todo: nombre y vida
    if (e.dead) return;
    const top = y - this.mobHeight(key, f) - 6;
    if (remaster && e.kind !== "citizen" && (s.world.map?.kind === "dungeon" || e.hp < e.maxHp || hovered)) {
      overlays.push(() => {
        const w = 30, k = e.hp / e.maxHp;
        ctx.fillStyle = "rgba(0,0,0,.65)";
        ctx.fillRect(x - w / 2 - 1, top - 1, w + 2, 5);
        ctx.fillStyle = k > 0.5 ? "#6fcf4f" : k > 0.25 ? "#e3b341" : "#e0493b";
        ctx.fillRect(x - w / 2, top, w * k, 3);
      });
    }
    if (hovered || remaster && e.kind !== "citizen" && s.world.map?.kind === "dungeon") {
      overlays.push(() => {
        const name = (e.special && remaster ? "★ " : "") + e.name;
        if (remaster) this.label(x, top - 8, name, e.special ? "rgb(" + AURA[e.special] + ")" : "#f2e6c8");
        else {
          ctx.font = "12px 'Courier New', monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "#000"; ctx.fillText(e.name, x + 1, y + 21);
          ctx.fillStyle = "#fff"; ctx.fillText(e.name, x, y + 20);
        }
      });
    }
  }

  mobHeight(key, f) {
    const fr = this.spr.frame(key, f);
    return fr ? -fr[5] : 40;
  }

  label(x, y, text, color) {
    const { ctx } = this;
    ctx.font = "600 11px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    const w = ctx.measureText(text).width + 10;
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

