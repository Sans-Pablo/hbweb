// Entrada del jugador -> intenciones -> órdenes al servidor.
// Igual que el cliente original, el camino se calcula aquí y se manda paso a paso;
// el servidor (World) valida cada paso y cada golpe.
import { TILE as T, PLAYER, dist } from "../shared/const.js";
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

    canvas.addEventListener("pointerdown", e => {
      e.preventDefault();
      ui.unlockAudio();
      this.pointer = [e.clientX, e.clientY];
      this.down = true;
      canvas.setPointerCapture?.(e.pointerId);
      this.click(true);
    });
    canvas.addEventListener("pointermove", e => { this.pointer = [e.clientX, e.clientY]; });
    canvas.addEventListener("pointerup", () => { this.down = false; });
    canvas.addEventListener("pointercancel", () => { this.down = false; });
    canvas.addEventListener("pointerleave", () => { if (!this.down) this.pointer = null; });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    canvas.addEventListener("wheel", e => {
      if (renderer.mode !== "remastered") return;
      e.preventDefault();
      renderer.setZoom(renderer.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });

    addEventListener("keydown", e => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (e.key === " " || e.key === "Alt" || e.key === "Tab") e.preventDefault();
      if (!e.repeat) ui.unlockAudio();
      this.keys.add(k);
      if (e.repeat) return;
      switch (k) {
        case "1": case "insert": ui.quick("hp"); break;
        case "2": case "delete": ui.quick("mp"); break;
        case "3": ui.quick("sp"); break;
        case " ": this.conn.send({ t: "pickup" }); break;
        default: ui.key(k);
      }
    });
    addEventListener("keyup", e => this.keys.delete(e.key.toLowerCase()));
    addEventListener("blur", () => { this.keys.clear(); this.down = false; });
  }

  get world() { return this.conn.state; }
  get me() { return this.world.ents.get(this.conn.pid); }

  // monstruo bajo el cursor: el sprite ocupa la casilla de los pies y lo que hay encima
  pick(wx, wy) {
    let best = null, bestD = 1e9;
    const time = this.world.time;
    for (const e of this.world.ents.values()) {
      if (e.kind !== "npc" || e.dead) continue;
      const [px, py] = posOf(e, time);
      const { key, f } = mobSprite(e, time);
      const h = Math.max(30, this.r.mobHeight(key, f));
      if (Math.abs(wx - px) > 20 || wy < py - h || wy > py + 14) continue;
      const d = Math.hypot(wx - px, wy - (py - h / 2));
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  click(first) {
    if (!this.pointer) return;
    const me = this.me;
    if (!me || me.dead) return;
    const [wx, wy] = this.r.toWorld(this.pointer[0], this.pointer[1]);
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    const ent = this.pick(wx, wy);
    if (ent) { this.intent = { t: "attack", id: ent.id }; return; }
    if (!first && this.intent && this.intent.t === "attack") return;   // mantener pulsado sigue atacando
    if (tx === me.x && ty === me.y) { this.intent = null; this.conn.send({ t: "pickup" }); return; }
    if (this.world.items.has(this.grid.idx(tx, ty))) { this.intent = { t: "pickup", x: tx, y: ty }; }
    else this.intent = { t: "move", x: tx, y: ty };
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
    } else { this.hover = null; this.hoverEnt = null; }
    if (!me || me.dead) { this.intent = null; this.path = []; return; }

    // mantener pulsado = seguir andando hacia el cursor (como Diablo / el original)
    if (this.down && performance.now() - this.lastHold > 120) { this.lastHold = performance.now(); this.click(false); }

    if (world.busy(me)) return;
    const run = this.ui.run && me.sp >= 1;
    const it = this.intent;
    if (!it) { this.path = []; return; }

    if (it.t === "attack") {
      const t = world.ents.get(it.id);
      if (!t || t.dead) { this.intent = null; this.path = []; return; }
      if (dist(me, t) <= 1) {
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
