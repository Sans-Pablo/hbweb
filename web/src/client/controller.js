// Entrada del jugador -> intenciones -> órdenes al servidor.
// Igual que el cliente original, el camino se calcula aquí y se manda paso a paso;
// el servidor (World) valida cada paso y cada golpe.
import { TILE as T, PLAYER, dist, dirTo } from "../shared/const.js";
import { reachOf, isFoe } from "../shared/systems/combatsys.js";
import { findPath } from "../shared/path.js";
import { posOf, mobSprite } from "./anim.js";
import { decide as autoDecide } from "../shared/systems/autoplay.js";

export class Controller {
  constructor({ conn, grid, renderer, canvas, ui }) {
    this.conn = conn;
    this.grid = grid;
    this.r = renderer;
    this.ui = ui;
    this.keys = new Set();
    this.intent = null;           // {t:"move", x, y} | {t:"attack", id} | {t:"pickup", x, y}
    this.path = [];
    this.auto = null;             // modo automático (autoplay.js): {kind:"hunt",mob} | {kind:"run",place}; cualquier clic lo cancela
    this.hover = null;
    this.hoverEnt = null;
    this.pointer = null;          // posición del ratón (clientX, clientY)
    this.down = false;
    this.clickFx = null;
    this.lastHold = 0;

    // Ratón como en el cliente original (Game.cpp, CommandProcessor):
    //   izquierdo = andar / correr (sobre uno mismo, recoger); Ctrl + izquierdo = atacar al objetivo;
    //   derecho = atacar al monstruo adyacente sin moverse; con un hechizo preparado el izquierdo lo lanza y el derecho cancela.
    canvas.addEventListener("pointerdown", e => {
      e.preventDefault();
      ui.unlockAudio();
      if (e.button === 2 && ui.minimapOpen?.() && renderer.minimapHit(e.clientX, e.clientY) && !ui.gui.dialogAt(...ui.gui.toGui(e.clientX, e.clientY))) { ui.closeMinimap(); return; }   // clic derecho cierra el minimapa
      if (e.button === 0 && ui.minimapOpen?.() && renderer.minimapHit(e.clientX, e.clientY) && !ui.gui.dialogAt(...ui.gui.toGui(e.clientX, e.clientY))) { renderer.miniDragStart(e.clientX, e.clientY); canvas.setPointerCapture?.(e.pointerId); return; }   // arrastrar el minimapa
      if (ui.gui.down(e.clientX, e.clientY, e.button, this.me)) { this.guiDrag = true; canvas.setPointerCapture?.(e.pointerId); return; }
      this.pointer = [e.clientX, e.clientY];
      if (e.altKey && e.button === 0) { const en = this.target().ent; if (en && (en.kind === "npc" || (en.kind === "player" && en.id !== this.me?.id))) { this.critNext = true; this.intent = { t: "attack", id: en.id }; this.path = []; return; } }   // Alt + clic: ataque crítico (el «super ataque» del original)
      this.ctrl = e.ctrlKey; this.shift = e.shiftKey;
      this.btn = e.button === 2 ? 2 : 0;
      this.down = true; this.noHold = false;
      canvas.setPointerCapture?.(e.pointerId);
      if (this.btn === 2) this.rightClick(); else this.click(true);
    });
    canvas.addEventListener("pointermove", e => { renderer.miniDragMove(e.clientX, e.clientY); ui.gui.move(e.clientX, e.clientY); this.pointer = [e.clientX, e.clientY]; this.ctrl = e.ctrlKey; this.shift = e.shiftKey; });
    addEventListener("keydown", e => { if (e.key === "Shift") this.shift = true; });                       // Game.cpp: m_bShiftPressed cuenta como correr para el dash (OBJECTATTACKMOVE)
    addEventListener("keyup", e => { if (e.key === "Shift") this.shift = false; });
    addEventListener("blur", () => { this.shift = false; ui.gui.alt = false; });
    addEventListener("keydown", e => { if (e.key === "Alt") ui.gui.alt = true; });                           // Game.cpp DrawDialogBoxs: GetAsyncKeyState(VK_MENU) ilumina el contador de críticos
    addEventListener("keyup", e => { if (e.key === "Alt") ui.gui.alt = false; });
    canvas.addEventListener("pointerup", e => { renderer.miniDragEnd(); this.down = false; this.noHold = false; this.guiDrag = false; ui.gui.up(e.clientX, e.clientY); });
    canvas.addEventListener("pointercancel", () => { this.down = false; ui.gui.up(); });
    // un objeto arrastrado nunca se queda pegado al cursor: si se suelta fuera del lienzo o se pierde el foco, se suelta igual
    addEventListener("pointermove", e => { if (ui.gui.drag) ui.gui.move(e.clientX, e.clientY); });   // el arrastre de una ventana sigue aunque el puntero salga del lienzo
    addEventListener("pointerup", e => { if (ui.gui.item || ui.gui.drag) { this.down = false; this.guiDrag = false; ui.gui.up(e.clientX, e.clientY); } });
    addEventListener("blur", () => { this.down = false; this.guiDrag = false; ui.gui.cancelDrag?.(); });
    canvas.addEventListener("pointerleave", () => { if (!this.down) this.pointer = null; });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    canvas.addEventListener("wheel", e => {
      if (ui.gui.wheel(e.clientX, e.clientY, e.deltaY)) { e.preventDefault(); return; }
      if (renderer.mode !== "remastered") return;
      e.preventDefault();
      renderer.setZoom(renderer.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });

    addEventListener("keydown", e => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLElement && e.target !== document.body && /^(BUTTON|A|SELECT|SUMMARY)$/.test(e.target.tagName)) e.target.blur();      // un botón con el foco se «pulsaría» con la barra espaciadora o Intro
      if ((e.key === " " || e.key === "Backspace" || e.key.startsWith("Arrow") || e.key === "PageDown") && !e.ctrlKey && !e.altKey) e.preventDefault();      // el navegador no desplaza ni retrocede la página
      if (ui.gui.key(e)) { e.preventDefault(); return; }       // ventanas del lienzo con campos de texto o modales
      if (ui.npcKey(e)) { e.preventDefault(); return; }       // el cuadro de cantidad se queda con el teclado
      if (!e.repeat) ui.unlockAudio();
      this.keys.add(e.key.toLowerCase());
      if (e.repeat) { if (ui.isHotkey(e)) e.preventDefault(); return; }
      ui.hotkey(e);
    });
    addEventListener("keyup", e => this.keys.delete(e.key.toLowerCase()));
    addEventListener("blur", () => { this.keys.clear(); this.down = false; });
  }

  get world() { return this.conn.state; }
  get me() { return this.world.ents.get(this.conn.pid); }

  // ¿es un jugador al que puedo atacar aquí? (misma regla que combatsys.canFight, que es la que decide en el servidor)
  enemyPlayer(e) {
    const me = this.me, w = this.world;
    if (!me || e.kind !== "player" || e === me || !(w.map?.id === "2ndmiddle" || w.map?.shared) || w.safeAt?.(me.x, me.y) || w.safeAt?.(e.x, e.y)) return false;
    if (!isFoe({ pkCount: me.pkCount || me.pk || 0, side: me.side }, { pkCount: e.pkCount || e.pk || 0, side: e.side })) return false;       // _iGetFOE: un aliado o un viajero no se ataca, ni se toca (no hace nada)
    return !(me.party && e.party && me.party.id === e.party.id);
  }

  // monstruo bajo el cursor: el sprite ocupa la casilla de los pies y lo que hay encima
  pick(wx, wy, kind = "npc") {
    let best = null, bestD = 1e9;
    const time = this.world.time;
    for (const e of this.world.ents.values()) {
      if (e.dead) continue;
      if (e.master) { const o = this.world.ents.get(e.master); if (!(kind === "npc" && e.comp && o && this.enemyPlayer(o))) continue; }   // un seguidor propio no se ataca; el del jugador enemigo (Promise Land) sí
      else if (e.kind !== kind && !(kind === "npc" && this.enemyPlayer(e))) continue;   // en Promise Land también se pueden atacar los jugadores enemigos
      const [px, py] = posOf(e, time);
      let h = 64;                                                          // jugador enemigo (Promise Land): no tiene ficha de monstruo, mide como en pickPlayer
      if (e.cfg) { const { key, f } = mobSprite(e, time, k => this.r.spr.frames(k)); h = Math.max(30, this.r.mobHeight(key, f)); }
      if (Math.abs(wx - px) > 20 || wy < py - h || wy > py + 14) continue;
      const d = Math.hypot(wx - px, wy - (py - h / 2));
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // otro jugador bajo el cursor (para invitarlo a un grupo)
  pickPlayer() {
    const [wx, wy] = this.r.toWorld(this.pointer[0], this.pointer[1]), time = this.world.time;
    let best = null, bd = 1e9;
    for (const e of this.world.ents.values()) {
      if (e.kind !== "player" || e.dead || e.id === this.me?.id) continue;
      const [px, py] = posOf(e, time);
      if (Math.abs(wx - px) > 22 || wy < py - 64 || wy > py + 14) continue;
      const d = Math.hypot(wx - px, wy - (py - 28));
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // compañero propio bajo un punto del mundo (BUG-007: soltar comida encima para dárselo)
  pickPet(wx, wy) {
    const time = this.world.time; let best = null, bd = 1e9;
    for (const e of this.world.ents.values()) {
      if (!e.comp || e.dead || e.master !== this.me?.id) continue;
      const [px, py] = posOf(e, time);
      if (Math.abs(wx - px) > 26 || wy < py - 60 || wy > py + 14) continue;
      const d = Math.hypot(wx - px, wy - (py - 24));
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // NPC de ciudad bajo un punto del mundo
  pickCitizen(wx, wy) { return this.pick(wx, wy, "citizen"); }
  // otro jugador bajo el cursor (solo para mostrar su nombre)
  playerAt(wx, wy, self = false) {
    let best = null, bestD = 1e9; const time = this.world.time;
    for (const e of this.world.ents.values()) {
      if (e.kind !== "player" || e.dead || (e.id === this.conn.pid) !== self) continue;
      const [px, py] = posOf(e, time);
      if (Math.abs(wx - px) > 18 || wy < py - 56 || wy > py + 14) continue;
      const d = Math.hypot(wx - px, wy - (py - 28));
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // posición del cursor -> {ent, x, y}
  target() {
    const [wx, wy] = this.r.toWorld(this.pointer[0], this.pointer[1]);
    const ent = this.pick(wx, wy);
    return { ent, x: ent ? ent.x : Math.floor(wx / T), y: ent ? ent.y : Math.floor(wy / T) };
  }

  // orden de ataque: Alt+clic marca un crítico (si queda carga) y correr hacia el objetivo marca el dash
  atk(t, dash) {
    const m = { t: "attack", target: t.id };
    if (this.critNext && (this.me?.superAttack || 0) > 0) m.crit = true;
    this.critNext = false;
    if (dash) m.dash = true;
    return m;
  }

  // golpe o disparo si el objetivo está al alcance (cuerpo a cuerpo 1 casilla, arco a cualquier distancia)
  strike(me, t) {
    if (dist(me, t) > reachOf(this.world, me, t, this.critNext && (me.superAttack || 0) > 0)) return false;
    if (!this.world.busy(me) && this.world.time - me.lastAttack >= PLAYER.attackCooldownMs) this.conn.send(this.atk(t));
    return true;
  }

  // Botón derecho (Client/Game.cpp, CommandProcessor, rama cRB): cancela el hechizo preparado; sobre un monstruo ataca sin moverse
  // (de cerca, o a distancia con arco); sobre un habitante de la ciudad no hace nada; sobre el suelo el personaje solo MIRA hacia
  // esa casilla (DEF_OBJECTSTOP con la nueva dirección) sin andar.
  setAuto(a) { this.auto = a; this.intent = null; this.path = []; }
  rightClick() {
    this.auto = null;
    const me = this.me;
    if (!me || me.dead || !this.pointer) return;
    if (this.ui.pointing != null || this.ui.petPointing != null) { this.ui.cancelPointing(); return; }
    if (this.ui.partyCb) { this.ui.cancelPick(); this.ui.gui.dialogs.get(32).mode = 0; return; }
    const { ent, x, y } = this.target();
    if (ent) { this.intent = null; this.path = []; this.strike(me, ent); return; }
    const [wx, wy] = this.r.toWorld(this.pointer[0], this.pointer[1]);
    if (this.pickCitizen(wx, wy)) return;
    if (x === me.x && y === me.y) return;
    const dir = dirTo(me.x, me.y, x, y);
    this.intent = null; this.path = [];
    if (dir && dir !== me.dir && !this.world.busy(me)) this.conn.send({ t: "turn", dir });
  }

  click(first) {
    if (!this.pointer) return;
    if (first && this.auto) { this.auto = null; this.ui.autoLog?.(["Modo automático cancelado.", "Auto mode cancelled."]); }
    const me = this.me;
    if (!me || me.dead) return;
    if (this.ui.partyCb) {                                // invitar a un grupo: este clic elige el personaje
      if (first) { const cb = this.ui.partyCb; this.ui.cancelPick(); this.noHold = true; this.intent = null; this.path = []; cb(this.pickPlayer()?.name || null); }
      return;
    }
    const { ent, x: tx, y: ty } = this.target();
    if (this.ui.petPointing != null) {                    // hechizo del summon (pgcast): este clic elige el objetivo
      if (first) { this.conn.send({ t: "pgcast", spell: this.ui.petPointing, x: tx, y: ty }); this.ui.cancelPointing(true); this.noHold = true; this.intent = null; this.path = []; }
      return;
    }
    if (this.ui.pointing != null) {                       // hechizo preparado: este clic elige el objetivo
      if (first) { this.conn.send({ t: "cast", spell: this.ui.pointing, x: tx, y: ty, pre: true }); this.ui.cancelPointing(true); this.noHold = true; this.intent = null; this.path = []; }
      return;
    }
    if (first && !this.ctrl) {                            // clic en un NPC de ciudad: abre su menú (no se anda hacia él)
      const [wx, wy] = this.r.toWorld(this.pointer[0], this.pointer[1]), cit = this.pickCitizen(wx, wy);
      if (cit) { this.intent = null; this.path = []; this.noHold = true; this.ui.npcClick(cit); return; }
    }
    if (!ent && first) { const [px, py] = this.r.toWorld(this.pointer[0], this.pointer[1]); if (this.playerAt(px, py)) { this.intent = null; this.path = []; this.noHold = true; return; } }   // Game.cpp: FOE >= 0 (aliado/neutral) -> el clic no hace nada
    if ((this.ctrl || (this.ui.autoAttack && ent?.kind === "npc" && !ent.comp)) && ent) { this.intent = { t: "attack", id: ent.id }; return; }     // Ctrl + izquierdo: atacar
    if (!first && this.intent && this.intent.t === "attack") return;
    if (tx === me.x && ty === me.y) { this.intent = null; this.conn.send({ t: "pickup" }); return; }
    this.intent = { t: "move", x: tx, y: ty };
    const ok = !this.grid.blocked(tx, ty);
    if (first) this.clickFx = { x: tx, y: ty, t: performance.now(), ok };
    if (!ok) this.intent = null;
  }

  update() {
    const me = this.me, world = this.world;
    // lo que hay bajo el cursor
    if (this.pointer) {
      const [wx, wy] = this.r.toWorld(this.pointer[0], this.pointer[1]);
      this.hover = [Math.floor(wx / T), Math.floor(wy / T)];
      this.hoverEnt = this.pick(wx, wy);
      this.hoverCit = this.hoverEnt ? null : this.pickCitizen(wx, wy);
      this.hoverPlayer = this.playerAt(wx, wy); this.hoverSelf = !!this.playerAt(wx, wy, true);
    } else { this.hover = null; this.hoverEnt = null; this.hoverCit = null; this.hoverPlayer = null; this.hoverSelf = false; }
    if (!me || me.dead) { this.intent = null; this.path = []; return; }

    // mantener pulsado = seguir andando hacia el cursor (como Diablo / el original)
    if (this.down && !this.noHold && performance.now() - this.lastHold > 120) { this.lastHold = performance.now(); if (this.btn === 2) this.rightClick(); else this.click(false); }

    if (world.busy(me)) return;
    if (this.auto && !this.intent) {                       // modo automático: decide como lo haría un clic
      const d = autoDecide(world, me, this.auto);
      if (d.msg) this.ui.autoLog?.(d.msg);
      if (d.stop) this.auto = null;
      if (d.open) this.ui.npcClick(d.open);
      if (d.intent) this.intent = d.intent;
    }
    const run = (this.ui.run || this.forceRun) && me.sp >= 1;
    const it = this.intent;
    if (!it) { this.path = []; return; }

    if (it.t === "attack") {
      const t = world.ents.get(it.id);
      if (!t || t.dead) { this.intent = null; this.path = []; return; }
      const critOn = this.critNext && (me.superAttack || 0) > 0, reach = reachOf(world, me, t, critOn), gap = dist(me, t);
      if (gap <= reach) {
        this.path = [];
        if (world.time - me.lastAttack >= PLAYER.attackCooldownMs) this.conn.send(this.atk(t));
        return;
      }
      const lineUp = (me.x === t.x || me.y === t.y || Math.abs(me.x - t.x) === Math.abs(me.y - t.y));      // dash: solo en línea recta o diagonal (OBJECTATTACKMOVE)
      if ((run || (this.shift && me.sp >= 1)) && gap === reach + 1 && reach < 4 && lineUp && (me.skills?.[me.eff?.wtype === 0 ? 5 : me.eff?.skill] || 0) >= 100 && world.time - me.lastAttack >= PLAYER.attackCooldownMs) {   // dash: atacar corriendo avanza y golpea con bonus
        this.path = []; this.conn.send(this.atk(t, true)); return;
      }
      const p = findPath(this.grid, me.x, me.y, t.x, t.y, me.id, 6000);
      if (p.length < 2) { this.intent = null; this.path = []; return; }
      p.pop();                                   // la última casilla es la del monstruo
      this.path = p;
      this.conn.send({ t: "move", dir: p[0], run });
      return;
    }

    if (me.x === it.x && me.y === it.y) {
      if (it.t === "pickup") this.conn.send({ t: "pickup" });
      this.intent = null; this.path = [];
      return;
    }
    const p = findPath(this.grid, me.x, me.y, it.x, it.y, me.id);
    if (!p.length) { this.intent = null; this.path = []; return; }
    this.path = p;
    if (!this.conn.send({ t: "move", dir: p[0], run })) {
      // algo se cruzó: se recalcula en el siguiente fotograma
      if (this.grid.occupant(it.x, it.y) !== undefined && dist(me, it) <= 1) { this.intent = null; this.path = []; }
    }
  }
}
