// Tutorial para jugadores nuevos (cliente). Guion y estado en shared/systems/tutorial.js; aquí se detectan los objetivos y se dibuja:
//  - cuadro de conversación (id 46): cara del que habla a la izquierda y texto a la derecha, con efecto de máquina de escribir;
//    Espacio / Intro / clic avanzan. Las caras salen de los sprites del juego: el personaje con su aspecto y equipo, los NPC recortados.
//  - rastreador del objetivo (id 47) con la flecha hacia el destino, «Saltar paso» y «Saltar tutorial» (pide confirmar).
// No decide reglas: manda órdenes `tut` y reacciona a eventos. Es sencillo de probar sin DOM (ver tests/tutorial.test.mjs).
import { STEPS, SPEAKERS, TOTAL, SHOP_DOOR } from "../shared/systems/tutorial.js";
import { drawPerson, apparelOf } from "./look.js";
import { miniOf } from "./compicon.js";

export const BOX_ID = 46, TRACK_ID = 47;
const UI = {
  next: { es: "Siguiente ▶", en: "Next ▶" }, end: { es: "Cerrar ▶", en: "Close ▶" },
  skip: { es: "Saltar tutorial", en: "Skip tutorial" }, sure: { es: "¿Seguro? Pulsa de nuevo", en: "Sure? Click again" },
  skipStep: { es: "Saltar paso", en: "Skip step" }, goal: { es: "Objetivo", en: "Goal" }, title: { es: "Tutorial", en: "Tutorial" },
  tiles: { es: "casillas", en: "tiles" }, done: { es: "¡Tutorial completado!", en: "Tutorial complete!" }, skipped: { es: "Tutorial saltado. Puedes repetirlo con /tutorial.", en: "Tutorial skipped. Repeat it with /tutorial." },
  key: { es: "Espacio / Intro", en: "Space / Enter" },
};
const SPEED = 55;                                  // letras por segundo

export class Tutorial {
  // deps: { gui, send(cmd), lang(), now(), pid, spr, itemDef(id), runOn(), panelOpen(id), log(msg), toast(msg), want(keys) }
  constructor(d) {
    this.d = d; this.st = "off"; this.i = 0; this.phase = "idle"; this.li = 0; this.t0 = 0; this.prog = 0; this.confirm = 0;
    this.last = null; this.dummy = null; this.asked = false; this.suppress = false;
    d.gui.register(this.boxDialog()); d.gui.register(this.trackDialog());
  }
  get step() { return STEPS[this.i]; }
  get on() { return this.st === "on" && !!this.step; }
  tx(o) { return o ? o[this.d.lang()] ?? o.es : ""; }

  // ---------------------------------------------------------------- estado y flujo
  onState(ev) {
    this.st = ev.st; this.claimed = ev.claimed || [];
    if (ev.st !== "on") { this.i = ev.i; this.hide(); return; }
    if (this.phase === "idle" || ev.i > this.i) { this.i = ev.i; this.enter(); }       // el cliente nunca retrocede por un eco atrasado del servidor
  }
  enter() {
    const s = this.step; if (!s) return this.hide();
    this.phase = "lines"; this.li = 0; this.t0 = this.d.now(); this.prog = 0; this.moved = 0; this.last = null; this.kills = 0;
    if (s.grant) this.d.send({ t: "tut", op: "grant", what: s.grant });
    this.preload();
    this.d.gui.close(TRACK_ID);
    if (s.lines.length) this.d.gui.open(BOX_ID); else this.afterLines();
  }
  preload() { for (const l of [...(this.step?.lines || []), ...(this.step?.after || [])]) this.portrait(l.w, true); }
  lines() { return this.phase === "after" ? this.step.after : this.step.lines; }
  line() { return this.lines()[this.li]; }
  full(l) { return this.tx(l); }
  shown() { return Math.floor((this.d.now() - this.t0) / 1000 * SPEED); }
  typing() { const l = this.line(); return !!l && this.shown() < this.full(l).length; }
  // Espacio / Intro / clic: primero completa el texto; luego pasa a la siguiente línea
  advance() {
    if (this.phase !== "lines" && this.phase !== "after") return false;
    if (this.typing()) { this.t0 = -1e9; return true; }
    this.li++; this.t0 = this.d.now();
    if (this.li >= this.lines().length) return this.afterLines(), true;
    return true;
  }
  afterLines() {
    this.d.gui.close(BOX_ID);
    if (this.phase === "after" || !this.step.goal) return this.finishStep();
    this.phase = "goal"; this.d.gui.open(TRACK_ID); this.startGoal();
  }
  goalDone() {
    this.d.gui.close(TRACK_ID);
    if (this.step.after?.length) { this.phase = "after"; this.li = 0; this.t0 = this.d.now(); this.d.gui.open(BOX_ID); } else this.finishStep();
  }
  finishStep() {
    const n = this.i + 1;
    this.d.send({ t: "tut", op: "step", i: n });
    this.i = n;
    if (n >= TOTAL) { this.st = "done"; this.hide(); this.d.toast(this.tx(UI.done)); return; }
    this.enter();
  }
  hide() { this.phase = "idle"; this.d.gui.close(BOX_ID); this.d.gui.close(TRACK_ID); }
  skipStep() { if (this.phase === "goal") this.goalDone(); }
  skipAll() { this.d.send({ t: "tut", op: "skip" }); this.st = "skip"; this.hide(); this.d.toast(this.tx(UI.skipped)); }
  restart() { this.d.send({ t: "tut", op: "reset" }); this.st = "on"; this.i = 0; this.enter(); }

  // ---------------------------------------------------------------- objetivos
  startGoal() { this.prog = 0; this.moved = 0; this.last = null; this.kills = 0; }
  note(kind, extra = {}) {                                   // eventos del juego -> progreso
    if (this.phase !== "goal") return;
    const g = this.step.goal; if (!g) return;
    let ok = false;
    switch (kind) {
      case "equip": ok = g.k === "equip"; break;
      case "kill": if (g.k === "kill") { this.kills++; ok = this.kills >= (g.n || 1); } break;
      case "pickup": ok = g.k === "pickup"; break;
      case "use": ok = g.k === "use" && /potion/i.test(extra.name || ""); break;
      case "talk": ok = g.k === "talk" && extra.name === g.npc; break;
      case "buy": ok = g.k === "buy"; break;
      case "pet": ok = g.k === "pet"; break;
      case "petuse": ok = g.k === "petuse"; break;
    }
    if (ok) this.goalDone();
  }
  onEvent(ev) {
    const me = this.d.pid;
    if (ev.t === "tutorial" && ev.id === me) return this.onState(ev);
    if (ev.t === "tutdummy" && ev.id === me) this.dummy = ev.target;
    if (ev.id !== me && !(ev.t === "death" && ev.by === me)) return;
    switch (ev.t) {
      case "equip": this.note("equip"); break;
      case "death": if (ev.by === me) this.note("kill"); break;
      case "pickup": this.note("pickup"); break;
      case "use": this.note("use", { name: this.d.itemDef(ev.item)?.name || "" }); break;
      case "purchased": this.note("buy"); break;
      case "petbought": this.note("pet"); break;
      case "companion": if (ev.on) this.note("petuse"); break;
    }
  }
  noteTalk(cit) { this.note("talk", { name: cit?.name }); }
  // cada fotograma: objetivos que se miden en el estado del juego (andar, correr, cuadros abiertos, mapa)
  update(me, world) {
    if (!this.asked && me) { this.asked = true; this.d.send({ t: "tut", op: "get" }); }
    if (!me || !this.on || this.phase !== "goal") return;
    const g = this.step.goal;
    switch (g.k) {
      case "move": {
        if (this.last && (this.last[0] !== me.x || this.last[1] !== me.y)) this.moved += Math.max(Math.abs(me.x - this.last[0]), Math.abs(me.y - this.last[1]));
        this.last = [me.x, me.y]; this.prog = Math.min(1, this.moved / g.n);
        if (this.moved >= g.n) this.goalDone();
        break;
      }
      case "run": if (this.d.runOn()) this.goalDone(); break;
      case "panel": if (this.d.panelOpen(g.id)) this.goalDone(); break;
      case "map": if (world?.map?.id === g.id) this.goalDone(); break;
    }
  }
  // destino de la flecha: [x, y] en casillas del mapa actual, o null
  target(me, world) {
    if (!this.on || this.phase !== "goal") return null;
    const g = this.step.goal;
    if (g.k === "map") return world.map?.id === "arefarm" ? (g.at || SHOP_DOOR) : null;
    if (g.k === "talk" || g.k === "pet") { const name = g.k === "pet" ? SPEAKERS.p.npc : g.npc; for (const e of world.ents.values()) if (e.name === name && e.kind === "citizen") return [e.x, e.y]; }
    if (g.k === "kill") { const e = this.dummy && world.ents.get(this.dummy); if (e && !e.dead) return [e.x, e.y]; }
    return null;
  }

  // ---------------------------------------------------------------- caras
  // Devuelve { kind, ... } con lo necesario para dibujar la cara de `who`; con quiet=true sólo pide los sprites
  portrait(who, quiet = false) {
    const me = this.d.world?.().ents.get(this.d.pid);
    if (who === "n") return null;
    if (who === "me") {
      if (!me) return null;
      const ap = apparelOf(me, this.d.itemDef), look = me.look || { skin: 2, hair: 1, hairCol: 0, under: 0 };
      return { me, look, ap, gender: me.gender || 1 };
    }
    const name = SPEAKERS[who]?.npc, m = name && miniOf(name, k => this.d.spr.frames(k));
    if (!m) return null;
    if (!this.d.spr.ready(m.key)) { this.d.want([m.key]); return null; }
    return { key: m.key, f: m.f };
  }
  drawFace(g, who, x, y, size) {
    const c = g.ctx, p = this.portrait(who);
    c.save();
    c.fillStyle = "#1b140c"; c.fillRect(x, y, size, size);
    c.beginPath(); c.rect(x, y, size, size); c.clip();
    if (p && p.me) {
      const s = size / 28;                                  // cabeza y hombros del sprite ocupan ~34 px de alto; los pies quedan fuera del recuadro
      c.translate(x + size / 2, y + size / 2 + 47 * s); c.scale(s, s);
      c.imageSmoothingEnabled = true;
      drawPerson(c, this.d.spr, p.gender, p.look, 0, 4, 0, 0, 0, p.ap);
      c.imageSmoothingEnabled = false;
    } else if (p) {
      const fr = this.d.spr.frame(p.key, p.f);
      if (fr) {
        const [sx, sy, w, h] = fr, top = Math.max(8, Math.round(h * 0.42)), s = Math.min(size / w, size / top) * 0.95;
        c.imageSmoothingEnabled = true;
        c.drawImage(this.d.spr.img[p.key], sx, sy, w, top, x + (size - w * s) / 2, y + (size - top * s) / 2, w * s, top * s);
        c.imageSmoothingEnabled = false;
      }
    } else if (who === "n") { c.fillStyle = "#e0c070"; c.font = "bold 44px serif"; c.textAlign = "center"; c.fillText("!", x + size / 2, y + size * 0.72); }
    c.restore();
    c.strokeStyle = "#8a7a4a"; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, size - 2, size - 2);
    c.strokeStyle = "#3a2c14"; c.lineWidth = 1; c.strokeRect(x - .5, y - .5, size + 1, size + 1);
  }
  nameOf(who) {
    if (who === "me") return this.d.world?.().ents.get(this.d.pid)?.name || "";
    return this.tx(SPEAKERS[who]) || "";
  }

  // ---------------------------------------------------------------- cuadros
  wrap(c, text, maxW) {
    const out = []; let line = "";
    for (const word of String(text).split(" ")) {
      const t = line ? line + " " + word : word;
      if (c.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }
  panel(c, w, h) {
    c.fillStyle = "rgba(20,14,8,.93)"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#8a7a4a"; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
    c.strokeStyle = "#3a2c14"; c.lineWidth = 1; c.strokeRect(4.5, 4.5, w - 9, h - 9);
  }
  btn(g, lx, ly, x, y, w, h, label, hot) {
    const over = lx >= x && lx <= x + w && ly >= y && ly <= y + h, c = g.ctx;
    c.fillStyle = over ? "#5a4724" : hot ? "#3d2f16" : "#2a2112"; c.fillRect(x, y, w, h);
    c.strokeStyle = over ? "#e6c867" : "#8a7a4a"; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1);
    g.text(x + w / 2, y + 4, label, over ? "#fff" : "#e8dcc3", { align: "center", size: 11 });
    return over;
  }
  // caja de conversación: en móvil se ajusta al ancho de la pantalla y a lo que mide el texto
  textLines(c, text, w) { c.font = "13px Tahoma, Verdana, sans-serif"; return this.wrap(c, text, w); }
  boxDialog() {
    const self = this;
    return {
      id: BOX_ID, x: 100, y: 392, w: 600, h: 146, fixed: true, mobileFixed: true, face: 96,
      layout(g) {                                                   // móvil: ancho de pantalla, cara pequeña, alto según el texto, pegado abajo
        this.w = Math.min(600, g.W - 12); this.face = this.w < 520 ? 64 : 96;
        const l = self.line(), tw = this.w - (this.face + 32) - 14, n = l ? self.textLines(g.ctx, self.full(l), tw).length : 3;
        this.h = Math.max(this.face + 56, 40 + n * 17 + 46);
        this.x = (g.W - this.w) / 2; this.y = g.H - this.h - 6;
      },
      draw(g) {
        const c = g.ctx, l = self.line(); if (!l) return;
        if (g.mobile) this.layout(g);
        const W = this.w, H = this.h, F = this.face, tx = F + 32;
        const lx = g.mouse.x - this.x, ly = g.mouse.y - this.y;
        self.panel(c, W, H);
        self.drawFace(g, l.w, 16, 16, F);
        const nm = self.nameOf(l.w);
        if (nm) g.text(tx, 16, nm, "#f0d27a", { bold: true, size: 14, shadow: true });
        const full = self.full(l), txt = full.slice(0, self.shown());
        const lines = self.textLines(c, full, W - tx - 14); let n = 0;
        lines.forEach((ln, i) => { const part = txt.slice(n, n + ln.length + 1).slice(0, ln.length); n += ln.length + 1; if (part) g.text(tx, 38 + i * 17, part, "#f1e8d0", { size: 13 }); });
        const last = self.li + 1 >= self.lines().length, typing = self.typing();
        const pulse = (Math.floor(self.d.now() / 400) % 2) ? "#fff" : "#e0c070";
        g.text(W - 18, H - 24, typing ? "" : self.tx(last && self.i + 1 >= TOTAL ? UI.end : UI.next), pulse, { align: "right", size: 12, bold: true });
        if (!g.mobile) g.text(W - 18, H - 38, typing ? "" : "[" + self.tx(UI.key) + "]", "#a89868", { align: "right", size: 9 });
        g.text(16, H - 22, `${self.tx(UI.title)} ${Math.min(self.i + 1, TOTAL)}/${TOTAL}`, "#a89868", { size: 10 });
        self.btn(g, lx, ly, tx, H - 28, 150, 18, self.tx(self.confirm > self.d.now() ? UI.sure : UI.skip), self.confirm > self.d.now());
      },
      click(g, lx, ly) {
        if (lx >= this.face + 32 && lx <= this.face + 32 + 150 && ly >= this.h - 28 && ly <= this.h - 10) { self.askSkip(); return true; }
        self.advance(); return true;
      },
    };
  }
  askSkip() {
    if (this.confirm > this.d.now()) { this.confirm = 0; this.skipAll(); } else this.confirm = this.d.now() + 3500;
  }
  trackDialog() {
    const self = this, H = 66;
    return {
      id: TRACK_ID, x: 210, y: 8, w: 380, h: H, fixed: true, mobileFixed: true,
      layout(g) { this.w = Math.min(380, g.W - 12); this.x = (g.W - this.w) / 2; this.y = 52; },       // móvil: debajo de las barras de estado
      draw(g, me, world) {
        const c = g.ctx, s = self.step; if (!s?.goal) return;
        if (g.mobile) this.layout(g);
        const W = this.w;
        const lx = g.mouse.x - this.x, ly = g.mouse.y - this.y;
        self.panel(c, W, H);
        g.text(12, 9, `${self.tx(UI.title)} ${self.i + 1}/${TOTAL} · ${self.tx(UI.goal)}`, "#a89868", { size: 10 });
        g.text(12, 24, self.tx(s.goal), "#f0d27a", { bold: true, size: 13, shadow: true });
        g.text(12, 42, self.tx(s.goal.hint), "#d8cfae", { size: 10 });
        if (s.goal.k === "move") { c.fillStyle = "#2a2112"; c.fillRect(12, 56, 150, 4); c.fillStyle = "#6fcf4f"; c.fillRect(12, 56, 150 * self.prog, 4); }
        const tgt = me && world && self.target(me, world);
        if (tgt) {                                          // flecha hacia el destino
          const dx = tgt[0] - me.x, dy = tgt[1] - me.y, dist = Math.max(Math.abs(dx), Math.abs(dy)), ang = Math.atan2(dy, dx), ax = W - 26, ay = 20;
          c.save(); c.translate(ax, ay); c.rotate(ang);
          c.fillStyle = "#f0d27a"; c.strokeStyle = "#3a2c14"; c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(14, 0); c.lineTo(-4, -10); c.lineTo(-1, 0); c.lineTo(-4, 10); c.closePath(); c.fill(); c.stroke(); c.restore();
          g.text(ax - 22, 14, dist + " " + self.tx(UI.tiles), "#f1e8d0", { align: "right", size: 10 });
        }
        self.btn(g, lx, ly, W - 190, H - 22, 86, 16, self.tx(UI.skipStep), false);
        self.btn(g, lx, ly, W - 98, H - 22, 90, 16, self.tx(self.confirm > self.d.now() ? UI.sure : UI.skip), self.confirm > self.d.now());
      },
      click(g, lx, ly) {
        const W = this.w;
        if (ly >= H - 22 && ly <= H - 6) {
          if (lx >= W - 190 && lx <= W - 104) self.skipStep();
          else if (lx >= W - 98) self.askSkip();
        }
        return true;
      },
    };
  }
  // teclado: Espacio / Intro avanzan la conversación (devuelve true si la tecla se consumió)
  key(e) {
    if (!this.d.gui.isOpen(BOX_ID)) return false;
    if (e.key === " " || e.key === "Enter") return this.advance();
    return false;
  }
}
