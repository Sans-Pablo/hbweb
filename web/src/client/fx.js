import { itemName } from "./names.js";
import { look } from "../shared/systems/evolutions.js";
// Efectos visuales del cliente: números de daño, avisos flotantes, chispas.
// No influyen en el juego; solo leen los eventos de la simulación.
import { posOf } from "./anim.js";
import { TILE } from "../shared/const.js";
import { SpellFx } from "./spellfx.js";

const SPELL_COLORS = { 0: "197,138,255", 1: "176,138,74", 2: "207,230,255", 3: "255,122,42", 4: "74,168,255" };

const FX_EVO_MS = 3000;
// Fuente de sprites del cliente original (Game.cpp PutString_SprFont3, hoja interface2 nº1): 3 tipos × 95 glifos, cada uno con su
// ancho; sombra negra en (0,+1) y (+1,+1) y el glifo teñido encima. Tipo por mensaje: 21→2, 22→1, 23→0 (iFontSize = 23 - tipo).
const SPRFONT = { man: null, img: null, tint: null };
function loadSprFont() {
  if (SPRFONT.img) return;
  SPRFONT.img = new Image(); SPRFONT.tint = document.createElement("canvas");
  fetch("data/ui.json").then(r => r.json()).then(m => { SPRFONT.man = m.interface2_1; SPRFONT.img.src = "data/ui/" + m.interface2_1.png; }).catch(() => {});
}
const sprFontReady = () => !!(SPRFONT.man && SPRFONT.img.complete && SPRFONT.img.naturalWidth);
function sprFontWidth(text, type) {
  let w = 0;
  for (const ch of text) { const f = SPRFONT.man.frames[ch.charCodeAt(0) - 32 + 95 * type]; if (f) w += f[2]; }
  return w;
}
// Cada texto (cifra de daño, mensaje…) se compone una sola vez —sombra y glifos teñidos— en un canvas pequeño y luego es un drawImage
const SPRTXT = new Map(), SPRTXT_MAX = 200, SPRPAD = 12;
function sprFontBake(text, type, rgb) {
  const fr = SPRFONT.man.frames, W = sprFontWidth(text, type), H = 40;
  const c = document.createElement("canvas"); c.width = W + SPRPAD * 2; c.height = H + SPRPAD * 2;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  const t = document.createElement("canvas"), tg = t.getContext("2d");
  let x = SPRPAD;
  for (const ch of text) {
    const f = fr[ch.charCodeAt(0) - 32 + 95 * type];
    if (!f) continue;
    const [sx, sy, sw, sh, px, py] = f, oy = SPRPAD + 12;
    t.width = sw; t.height = sh;
    tg.drawImage(SPRFONT.img, sx, sy, sw, sh, 0, 0, sw, sh);
    tg.globalCompositeOperation = "source-atop"; tg.fillStyle = "rgb(" + rgb + ")"; tg.fillRect(0, 0, sw, sh);
    g.globalAlpha = 0.7;
    g.drawImage(SPRFONT.img, sx, sy, sw, sh, x + px, oy + py + 1, sw, sh);
    g.drawImage(SPRFONT.img, sx, sy, sw, sh, x + px + 1, oy + py + 1, sw, sh);
    g.globalAlpha = 1;
    g.drawImage(t, 0, 0, sw, sh, x + px, oy + py, sw, sh);
    x += sw;
  }
  return c;
}
function sprFontDraw(ctx, text, cx, y, type, rgb, alpha = 1) {
  const key = type + "|" + rgb + "|" + text;
  let c = SPRTXT.get(key);
  if (!c) {
    if (SPRTXT.size >= SPRTXT_MAX) SPRTXT.delete(SPRTXT.keys().next().value);
    c = sprFontBake(text, type, rgb); SPRTXT.set(key, c);
  }
  const x = Math.round(cx - sprFontWidth(text, type) / 2);
  const ga = ctx.globalAlpha, sm = ctx.imageSmoothingEnabled;
  ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, x - SPRPAD, y - SPRPAD - 12);
  ctx.globalAlpha = ga; ctx.imageSmoothingEnabled = sm;
}
export class Fx {
  constructor(world, me) {
    this.world = world;
    this.me = me;
    this.texts = [];
    this.critT = new Map();
    this.parts = [];
    this.flash = new Map();          // id -> hora del último golpe (destello)
    this.rings = [];
    this.bolts = [];
    this.evo = new Map();            // id -> inicio de la animación de evolución (crece, encoge, crece, encoge y queda grande, con brillo)
    this.scast = new Map();          // id del summon en nivel máximo -> {at, sc}: círculo de casteo mientras lanza la magia
    this.pop = new Map();            // id -> hora de la re-invocación (entrada con rebote del compañero que cambia de tamaño)
    this.sp = new SpellFx();         // efectos de hechizos del cliente original
    this.sp.hook = (n, x, y) => this.onSfx?.(n, x, y);
    this.sp.load();
    loadSprFont();
  }

  at(id) {
    const e = this.world.ents.get(id);
    return e ? posOf(e, this.world.time) : null;
  }
  // spr = tipo de la fuente de sprites (21-23, como los mensajes de cabeza del original) y color "r,g,b"
  text(id, text, color, big = false, dy = 0, size = 0, spr = 0) {
    const p = this.at(id);
    if (!p) return;
    this.texts.push({ x: p[0], y: p[1] - 64 + dy, text, color, big, size, spr, born: performance.now(), dx: 0 });
  }

  onEvent(ev) {
    const mine = ev.id === this.me;
    switch (ev.t) {
      case "damage":
        this.flash.set(ev.id, performance.now());
        // Game.cpp (OBJECTDAMAGE): "-N" en amarillo (m_wR[13]*2), tamaño por daño (<12 / <40 / más); golpe mortal = «-N!» (OBJECTDYING); crítico = «Critical» (MOTION_EVENT_HANDLER3)
        this.text(ev.id, ev.crit || (this.critT.get(ev.id) > performance.now() - 400) ? "Critical" : "-" + ev.amount + (ev.hp <= 0 ? "!" : ""), "#e8dc3c", false, 0, ev.amount >= 40 ? 20 : ev.amount >= 12 ? 16 : 13, ev.crit || (this.critT.get(ev.id) > performance.now() - 400) || ev.amount >= 40 ? 23 : ev.amount >= 12 ? 22 : 21);
        if (!mine) this.burst(ev.id, 6, "rgba(180,20,20,", 1.4);
        break;
      case "dummy-cast": if (ev.max || (ev.lvl >= 30 && ["Demon", "Liche", "Frost"].includes(look(ev.sc)))) this.scast.set(ev.nid, { at: performance.now(), sc: ev.sc }); break;
      case "crit": if (ev.crit) this.critT.set(ev.target, performance.now()); break;
      case "miss": break;   // un golpe normal que falla no muestra texto (ticket 7); «Failed» queda solo para la resistencia a hechizos
      case "attack": {                                       // arco: la flecha sale en el fotograma 5 de 8 del gesto (MapData.cpp, OwnerFrame == 5)
        const c = this.world.ents.get(ev.id);
        if (!c) break;
        const sx = c.x, sy = c.y, tx = ev.tx, ty = ev.ty, dur = c.actDur || 296;
        // fotograma 5: destello del ataque crítico (V3 ≥ 20 → efecto 20-27) y, con StormBlade, el efecto 81 (MapData.cpp OBJECTATTACK; el 250 usa un sprite ausente)
        if (ev.at >= 20 || ev.wt === 15) setTimeout(() => { if (ev.at >= 20) this.sp.add(ev.at, sx, sy, tx, ty); if (ev.wt === 15) this.sp.add(81, sx, sy, tx, ty); }, dur * 5 / 8);
        if (!ev.bow) break;
        setTimeout(() => this.sp.add(2, sx, sy, tx, ty), dur * 5 / 8);
        break;
      }
      // Game.cpp OBJECTMAGIC: sobre el lanzador aparece «<Nombre del hechizo>!» (CMsg tipo 41, rojo 255,80,80)
      case "cast": { const m = this.world.magic?.[ev.spell]; if (m?.name) this.text(ev.id, m.name + "!", "#ff5050", false, 0, 14, 22); break; }
      case "spell": {
        const c = this.world.ents.get(ev.id);
        this.sp.spell(ev.spell, c ? c.x : ev.x, c ? c.y : ev.y, ev.x, ev.y);
        break;
      }
      case "dummy-crit": this.text(ev.nid, "CRITICAL!", ev.cls === "healer" ? "#7fff7f" : ev.cls === "buffer" ? "#ffe84a" : "#7fc4ff", true, -18); break;
      case "castfail": this.text(ev.id, "el hechizo falla", "#a9b4c2"); break;
      case "resist": break;
      case "levelup": {
        const p = this.at(ev.id);
        if (p) this.rings.push({ x: p[0], y: p[1], born: performance.now() });
        this.burst(ev.id, 40, "rgba(255,214,90,", 2.5);
        break;
      }
      case "companion-resummon": {                            // cambio de tamaño del compañero: sale con un destello y vuelve más grande
        const ox = ev.fx * TILE + 16, oy = ev.fy * TILE + 16, nx = ev.x * TILE + 16, ny = ev.y * TILE + 16, now = performance.now();
        this.rings.push({ x: ox, y: oy, born: now }, { x: nx, y: ny, born: now + 120 });
        this.sp.spell(31, ev.fx, ev.fy, ev.fx, ev.fy);                       // Summon Creature (Magic.cfg 31): el efecto original de invocar
        this.sp.spell(31, ev.x, ev.y, ev.x, ev.y);
        for (let i = 0; i < 46; i++) {                                         // columna de chispas violetas/doradas al aparecer
          const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * 2.2;
          this.parts.push({ x: nx, y: ny - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2.4, life: 600 + Math.random() * 700, born: now + 100, rgba: i % 2 ? "rgba(255,214,90," : "rgba(197,138,255," });
        }
        this.sparks(ox, oy - 10, 20, "197,138,255");
        this.evo.set(ev.nid, now + 100);
        break;
      }
      case "pickup":
        if (mine) this.text(ev.id, ev.item === 90 ? "+" + ev.count + " oro" : "+" + (ev.count > 1 ? ev.count + " " : "") + itemName(ev.item, ev.attr, ev.comp), "#f0d080");
        break;
      case "use": if (mine && ev.amount) this.text(ev.id, "+" + ev.amount + { hp: " HP", mp: " MP", sp: " SP", food: " comida" }[ev.stat], { hp: "#7fe07f", mp: "#7fb2ff", sp: "#9fe07f", food: "#e0c07f" }[ev.stat] || "#fff"); break;
    }
  }

  // factor de entrada del compañero recién re-invocado: crece desde 0, se pasa un poco y se asienta (0,75 s)
  // Evolución estilo Pokémon: parte del tamaño anterior (ratio < 1), late dos veces (grande/pequeño) con brillo blanco y se queda en el nuevo.
  evoK(id) { const t0 = this.evo.get(id); if (t0 === undefined) return null; const k = (performance.now() - t0) / FX_EVO_MS; if (k >= 1) { this.evo.delete(id); return null; } return Math.max(0, k); }
  evoGlow(id) { const k = this.evoK(id); return k === null ? 0 : k < 0.85 ? 0.55 + 0.4 * Math.abs(Math.sin(k * Math.PI * 4)) : 0.9 * (1 - (k - 0.85) / 0.15); }
  popScale(id, ratio = 1) {
    const ek = this.evoK(id);
    if (ek !== null) {
      const ease = ek < 0.75 ? 0 : (ek - 0.75) / 0.25;                                  // el cambio de tamaño llega al final
      const osc = Math.sin(ek * Math.PI * 4) * (ek < 0.75 ? 0.4 : 0.4 * (1 - ease));     // crece, encoge, crece, encoge
      return Math.max(0.05, ratio + (1 - ratio) * ease * ease * (3 - 2 * ease) + osc * (ratio + (1 - ratio) * ease) * 0.9);
    }
    const t0 = this.pop.get(id); if (t0 === undefined) return 1;
    const k = (performance.now() - t0) / 750;
    if (k >= 1) { this.pop.delete(id); return 1; }
    if (k < 0) return 0.001;
    return k < 0.6 ? (k / 0.6) * 1.18 : 1.18 - 0.18 * ((k - 0.6) / 0.4);
  }

  sparks(x, y, n, col) {
    const rgba = "rgba(" + col + ",";
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * 1.6;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 400 + Math.random() * 400, born: performance.now(), rgba });
    }
  }

  burst(id, n, rgba, speed) {
    const p = this.at(id);
    if (!p) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * speed;
      this.parts.push({ x: p[0], y: p[1] - 24, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.2, life: 500 + Math.random() * 500, born: performance.now(), rgba });
    }
  }

  // Poda lo caducado sin pintar (perfilador ?prof=1 con fx apagado: que no se acumule)
  cull() {
    const now = performance.now();
    this.rings = this.rings.filter(r => now - r.born < 900); this.parts = this.parts.filter(p => now - p.born < p.life);
    this.texts = this.texts.filter(t => now - t.born < 1100); this.sp.update();
  }

  // classic = texto plano como el original (sube y desaparece); remastered = animado
  draw(ctx, camX, camY, mode) {
    const now = performance.now();
    const remaster = mode === "remastered";
    // anillos de subida de nivel
    if (remaster) for (const r of this.rings) {
      const k = (now - r.born) / 900;
      if (k > 1 || k < 0) continue;
      ctx.strokeStyle = "rgba(255,214,90," + (1 - k) + ")";
      ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.ellipse(r.x - camX, r.y - camY + 4, 10 + 60 * k, 5 + 30 * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.rings = this.rings.filter(r => now - r.born < 900);
    this.sp.update(); this.sp.draw(ctx, camX, camY);
    // partículas
    if (remaster) {
      for (const p of this.parts) {
        const t = now - p.born, k = t / p.life;
        if (k >= 1) continue;
        const x = p.x + p.vx * t / 16, y = p.y + p.vy * t / 16 + 0.0009 * t * t;
        ctx.fillStyle = p.rgba + (1 - k) + ")";
        ctx.fillRect(x - camX - 1, y - camY - 1, 2, 2);
      }
    }
    this.parts = this.parts.filter(p => now - p.born < p.life);
    // textos
    ctx.textAlign = "center";
    for (const t of this.texts) {
      const age = now - t.born, k = age / 1100;
      if (k >= 1) continue;
      let x = t.x - camX, y = t.y - camY - 26 * k, size = 12;
      if (t.spr && sprFontReady()) {
        const rgb = t.color.startsWith("#") ? [1, 3, 5].map(i => parseInt(t.color.slice(i, i + 2), 16)).join(",") : t.color;
        sprFontDraw(ctx, t.text, Math.round(x), Math.round(y), 23 - t.spr, rgb, k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
        continue;
      }
      if (remaster) {
        const pop = age < 120 ? 1 + 0.6 * (1 - age / 120) : 1;
        size = (t.size || (t.big ? 18 : 14)) * pop;
        x += t.dx * k;
        ctx.font = "700 " + size.toFixed(1) + "px 'Trebuchet MS', 'Segoe UI', sans-serif";
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,.85)";
        ctx.strokeText(t.text, x, y);
      } else {
        ctx.font = "12px 'Courier New', monospace";
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000";
        ctx.fillText(t.text, x + 1, y + 1);
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, y);
      ctx.globalAlpha = 1;
    }
    this.texts = this.texts.filter(t => now - t.born < 1100);
  }
}

export { TILE };
