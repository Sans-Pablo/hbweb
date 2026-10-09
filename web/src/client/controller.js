// Entrada del jugador -> intenciones -> órdenes al servidor.
// Igual que el cliente original, el camino se calcula aquí y se manda paso a paso;
// el servidor (World) valida cada paso y cada golpe.
import { TILE as T, PLAYER, dist, dirTo } from "../shared/const.js";
import { reachOf } from "../shared/systems/combatsys.js";
import { findPath } from "../shared/path.js";
import { posOf, mobSprite } from "./anim.js";

export class Controller {
  constructor({ conn, grid, renderer, canvas, ui }) {
    this.conn = conn;
    this.grid = grid;
    this.r = renderer;
    this.ui = ui;
    this.keys = new Set();
    this.intent = null;           // {t:"move", x, y} | {t:"attack", id} | {t:"pickup", x, y}
    this.path = [];
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
      if (ui.gui.down(e.clientX, e.clientY, e.button, this.me)) { this.guiDrag = true; canvas.setPointerCapture?.(e.pointerId); return; }
      this.pointer = [e.clientX, e.clientY];
      if (e.altKey && e.button === 0) { this.intent = null; this.path = []; this.ui.petOrder(this.target().ent); return; }      // Alt + clic: orden de ataque al compañero
      this.ctrl = e.ctrlKey;
      this.btn = e.button === 2 ? 2 : 0;
      this.down = true; this.noHold = false;
      canvas.setPointerCapture?.(e.pointerId);
      if (this.btn === 2) this.rightClick(); else this.click(true);
    });
    canvas.addEventListener("pointermove", e => { ui.gui.move(e.clientX, e.clientY); this.pointer = [e.clientX, e.clientY]; this.ctrl = e.ctrlKey; });
    canvas.addEventListener("pointerup", e => { this.down = false; this.noHold = false; this.guiDrag = false; ui.gui.up(e.clientX, e.clientY); });
    canvas.addEventListener("pointercancel", () => { this.down = false; });
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

  // monstruo bajo el cursor: el sprite ocupa la casilla de los pies y lo que hay encima
  pick(wx, wy, kind = "npc") {
    let best = null, bestD = 1e9;
    const time = this.world.time;
    for (const e of this.world.ents.values()) {
      if (e.kind !== kind || e.dead || e.master) continue;                  // un seguidor (compañero) no se ataca
      const [px, py] = posOf(e, time);
      const { key, f } = mobSprite(e, time, k => this.r.spr.frames(k));
      const h = Math.max(30, this.r.mobHeight(key, f));
      if (Math.abs(wx - px) > 20 || wy < py - h || wy > py + 14) continue;
      const d = Math.hypot(wx - px, wy - (py - h / 2));
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // NPC de ciudad bajo un punto del mundo
  pickCitizen(wx, wy) { return this.pick(wx, wy, "citizen"); }

  // posición del cursor -> {ent, x, y}
  target() {
    const [wx, wy] = this.r.toWorld(this.pointer[0], this.pointer[1]);
    const ent = this.pick(wx, wy);
    return { ent, x: ent ? ent.x : Math.floor(wx / T), y: ent ? ent.y : Math.floor(wy / T) };
  }

  // golpe o disparo si el objetivo está al alcance (cuerpo a cuerpo 1 casilla, arco a cualquier distancia)
  strike(me, t) {
    if (dist(me, t) > reachOf(this.world, me, t)) return false;
    if (!this.world.busy(me) && this.world.time - me.lastAttack >= PLAYER.attackCooldownMs) this.conn.send({ t: "attack", target: t.id });
    return true;
  }

  // Botón derecho (Client/Game.cpp, CommandProcessor, rama cRB): cancela el hechizo preparado; sobre un monstruo ataca sin moverse
  // (de cerca, o a distancia con arco); sobre un habitante de la ciudad no hace nada; sobre el suelo el personaje solo MIRA hacia
  // esa casilla (DEF_OBJECTSTOP con la nueva dirección) sin andar.
  rightClick() {
    const me = this.me;
    if (!me || me.dead || !this.pointer) return;
    if (this.ui.pointing != null) { this.ui.cancelPointing(); return; }
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
    const me = this.me;
    if (!me || me.dead) return;
    const { ent, x: tx, y: ty } = this.target();
    if (this.ui.pointing != null) {                       // hechizo preparado: este clic elige el objetivo
      if (first) { this.conn.send({ t: "cast", spell: this.ui.pointing, x: tx, y: ty, pre: true }); this.ui.cancelPointing(true); this.noHold = true; this.intent = null; this.path = []; }
      return;
    }
    if (first && !this.ctrl) {                            // clic en un NPC de ciudad: abre su menú (no se anda hacia él)
      const [wx, wy] = this.r.toWorld(this.pointer[0], this.pointer[1]), cit = this.pickCitizen(wx, wy);
      if (cit) { this.intent = null; this.path = []; this.noHold = true; this.ui.npcClick(cit); return; }
    }
    if ((this.ctrl || this.ui.autoAttack) && ent) { this.intent = { t: "attack", id: ent.id }; return; }     // Ctrl + izquierdo: atacar
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
    } else { this.hover = null; this.hoverEnt = null; this.hoverCit = null; }
    if (!me || me.dead) { this.intent = null; this.path = []; return; }

    // mantener pulsado = seguir andando hacia el cursor (como Diablo / el original)
    if (this.down && !this.noHold && performance.now() - this.lastHold > 120) { this.lastHold = performance.now(); if (this.btn === 2) this.rightClick(); else this.click(false); }

    if (world.busy(me)) return;
    const run = (this.ui.run || this.forceRun) && me.sp >= 1;
    const it = this.intent;
    if (!it) { this.path = []; return; }

    if (it.t === "attack") {
      const t = world.ents.get(it.id);
      if (!t || t.dead) { this.intent = null; this.path = []; return; }
      if (dist(me, t) <= reachOf(world, me, t)) {
        this.path = [];
        if (world.time - me.lastAttack >= PLAYER.attackCooldownMs) this.conn.send({ t: "attack", target: t.id });
        return;
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
