import { itemName } from "./names.js";
// Efectos visuales del cliente: números de daño, avisos flotantes, chispas.
// No influyen en el juego; solo leen los eventos de la simulación.
import { posOf } from "./anim.js";
import { TILE } from "../shared/const.js";

const SPELL_COLORS = { 0: "197,138,255", 1: "176,138,74", 2: "207,230,255", 3: "255,122,42", 4: "74,168,255" };

export class Fx {
  constructor(world, me) {
    this.world = world;
    this.me = me;
    this.texts = [];
    this.parts = [];
    this.flash = new Map();          // id -> hora del último golpe (destello)
    this.rings = [];
    this.bolts = [];                 // proyectiles y explosiones de hechizos
  }

  at(id) {
    const e = this.world.ents.get(id);
    return e ? posOf(e, this.world.time) : null;
  }
  text(id, text, color, big = false, dy = 0) {
    const p = this.at(id);
    if (!p) return;
    this.texts.push({ x: p[0], y: p[1] - 64 + dy, text, color, big, born: performance.now(), dx: (Math.random() - 0.5) * 14 });
  }

  onEvent(ev) {
    const mine = ev.id === this.me;
    switch (ev.t) {
      case "damage":
        this.flash.set(ev.id, performance.now());
        this.text(ev.id, String(ev.amount), mine ? "#ff5a4a" : "#fff3d6", ev.amount >= 8);
        if (!mine) this.burst(ev.id, 6, "rgba(180,20,20,", 1.4);
        break;
      case "miss": this.text(ev.id, "fallo", "#a9b4c2"); break;
      case "spell": {
        const from = this.at(ev.id), col = SPELL_COLORS[ev.attr] || SPELL_COLORS[0];
        const tx = ev.x * TILE + 16, ty = ev.y * TILE + 16;
        if (from) this.bolts.push({ x1: from[0], y1: from[1] - 26, x2: tx, y2: ty - 8, col, born: performance.now(), area: ev.type === 3 ? 2 : 0.6 });
        this.sparks(tx, ty - 8, ev.type === 3 ? 26 : 12, col);
        break;
      }
      case "heal": this.text(ev.id, "+" + ev.amount, "#7fe07f"); this.burst(ev.id, 16, "rgba(120,255,140,", 1.2); break;
      case "castfail": this.text(ev.id, "el hechizo falla", "#a9b4c2"); break;
      case "resist": this.text(ev.id, "resiste", "#a9b4c2"); break;
      case "exp": if (mine) this.text(ev.id, "+" + ev.amount + " exp", "#e6c869", false, -16); break;
      case "levelup": {
        const p = this.at(ev.id);
        if (p) this.rings.push({ x: p[0], y: p[1], born: performance.now() });
        this.burst(ev.id, 40, "rgba(255,214,90,", 2.5);
        break;
      }
      case "pickup":
        if (mine) this.text(ev.id, ev.item === 90 ? "+" + ev.count + " oro" : "+" + (ev.count > 1 ? ev.count + " " : "") + itemName(ev.item), "#f0d080");
        break;
      case "use": if (mine && ev.amount) this.text(ev.id, "+" + ev.amount + { hp: " vida", mp: " maná", sp: " resistencia", food: " comida" }[ev.stat], { hp: "#7fe07f", mp: "#7fb2ff", sp: "#9fe07f", food: "#e0c07f" }[ev.stat] || "#fff"); break;
    }
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

  // classic = texto plano como el original (sube y desaparece); remastered = animado
  draw(ctx, camX, camY, mode) {
    const now = performance.now();
    const remaster = mode === "remastered";
    // anillos de subida de nivel
    if (remaster) for (const r of this.rings) {
      const k = (now - r.born) / 900;
      if (k > 1) continue;
      ctx.strokeStyle = "rgba(255,214,90," + (1 - k) + ")";
      ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.ellipse(r.x - camX, r.y - camY + 4, 10 + 60 * k, 5 + 30 * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.rings = this.rings.filter(r => now - r.born < 900);
    // hechizos: proyectil que viaja 250 ms y explosión
    for (const b of this.bolts) {
      const t = now - b.born;
      if (t < 250) {
        const k = t / 250, x = b.x1 + (b.x2 - b.x1) * k - camX, y = b.y1 + (b.y2 - b.y1) * k - camY;
        const g = ctx.createRadialGradient(x, y, 1, x, y, 11);
        g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.35, "rgba(" + b.col + ",.8)"); g.addColorStop(1, "rgba(" + b.col + ",0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
      } else if (t < 650) {
        const k = (t - 250) / 400, r = (10 + 26 * k) * (b.area > 1 ? 1.8 : 1);
        ctx.strokeStyle = "rgba(" + b.col + "," + (1 - k) + ")"; ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(b.x2 - camX, b.y2 - camY, r, 0, Math.PI * 2); ctx.stroke();
      }
    }
    this.bolts = this.bolts.filter(b => now - b.born < 650);
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
      if (remaster) {
        const pop = age < 120 ? 1 + 0.6 * (1 - age / 120) : 1;
        size = (t.big ? 18 : 14) * pop;
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
