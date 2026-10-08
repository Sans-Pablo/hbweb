// Simulación del juego: el papel del servidor (HGServer). No sabe nada de dibujo ni del
// navegador, así que el mismo código corre en el navegador (modo local) y en Node (servidor).
//
// El cliente le manda órdenes (`command`) y lee el estado y los eventos. Cada orden la valida
// igual que el servidor original (tiempos mínimos, casilla libre, distancia).
// La lógica está repartida en sistemas (systems/*.js); este archivo solo guarda el estado y el bucle.
import { ACT, DX, DY, LIMITS, PLAYER, dirTo, dist } from "./const.js";
import * as R from "./rules.js";
import * as Player from "./systems/player.js";
import * as Combat from "./systems/combatsys.js";
import * as Npc from "./systems/npcsys.js";
import * as ItemSys from "./systems/itemsys.js";
import { tickVitals } from "./systems/vitals.js";
import * as MagicSys from "./systems/magicsys.js";
import { CAST_MS } from "./magic.js";

export class World {
  constructor({ grid, npcDb, data, spawns = [], rng = Math.random, start, ids = null }) {
    this.grid = grid;
    this.npcDb = npcDb;
    this.data = data;                // GameData: objetos, hechizos y monstruos
    this.magic = data.magic;
    this.rng = rng;
    this.start = start;
    this.time = 0;
    this.ents = new Map();
    this.items = new Map();          // índice de casilla -> [{uid, id, count, life, x, y}] (el último está encima)
    this.events = [];
    this.timers = [];
    this.ids = ids || { ent: 1, item: 1 };
    this.generators = spawns.map(s => ({ ...s, alive: 0 }));
    for (const g of this.generators) for (let i = 0; i < g.max; i++) Npc.spawnFrom(this, g);
  }

  get nextId() { return this.ids.ent; }
  set nextId(v) { this.ids.ent = v; }
  get nextItem() { return this.ids.item; }
  set nextItem(v) { this.ids.item = v; }

  // ------------------------------------------------------------------ utilidades
  emit(ev) { ev.time = this.time; this.events.push(ev); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  after(ms, fn) { this.timers.push({ at: this.time + ms, fn }); }
  setAct(e, act, dur) { e.act = act; e.actStart = this.time; e.actDur = dur; }
  busy(e) { return this.time < e.busyUntil; }
  reject(p, cmd, why) { this.emit({ t: "reject", id: p.id, cmd: cmd.t, why }); return false; }

  makeEnt(kind, x, y) {
    const e = { id: this.nextId++, kind, x, y, fx: x, fy: y, dir: 5, act: ACT.STOP, actStart: this.time, actDur: 0, busyUntil: 0, dead: false };
    this.ents.set(e.id, e);
    this.grid.occupy(x, y, e.id);
    return e;
  }

  freeSpotNear(x, y, radius = 6) {
    for (let r = 0; r <= radius; r++)
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++)
        if (this.grid.free(x + i, y + j)) return [x + i, y + j];
    return null;
  }

  tryStep(e, d, dur, act) {
    const nx = e.x + DX[d], ny = e.y + DY[d];
    e.dir = d;
    if (!this.grid.free(nx, ny, e.id)) return false;
    this.grid.release(e.x, e.y, e.id);
    this.grid.occupy(nx, ny, e.id);
    e.fx = e.x; e.fy = e.y; e.x = nx; e.y = ny;
    this.setAct(e, act, dur);
    e.busyUntil = this.time + dur;
    this.emit({ t: "step", id: e.id });
    return true;
  }

  // ------------------------------------------------------------------ jugadores (systems/player.js)
  addPlayer(name, save = null, create = null) { return Player.addPlayer(this, name, save, create); }
  saveOf(id) { return Player.saveOf(this, id); }
  removePlayer(id) { Player.removePlayer(this, id); }
  recalc(p) { Player.recalc(this, p); }
  killNpc(n, p) { Npc.killNpc(this, n, p); }

  // ------------------------------------------------------------------ órdenes del cliente
  command(id, cmd) {
    const p = this.ents.get(id);
    if (!p || p.kind !== "player") return false;
    const fn = COMMANDS[cmd.t];
    if (!fn) return false;
    if (p.dead && !FOR_DEAD.has(cmd.t)) return this.reject(p, cmd, "muerto");
    return fn(this, p, cmd);
  }

  // ------------------------------------------------------------------ bucle
  tick(dt) {
    const end = this.time + dt;
    // avanzar en pasos de como mucho 50 ms para que los temporizadores caigan en su sitio
    while (this.time < end) {
      this.time = Math.min(end, this.time + 50);
      if (this.timers.length) {
        const due = this.timers.filter(t => t.at <= this.time);
        if (due.length) {
          this.timers = this.timers.filter(t => t.at > this.time);
          due.sort((a, b) => a.at - b.at);
          for (const t of due) t.fn();
        }
      }
      for (const e of this.ents.values()) {
        if (e.kind === "npc") Npc.npcThink(this, e);
        else if (!e.dead && this.time - e.lastVitals >= 1000) { e.lastVitals = this.time; tickVitals(this, e); }
      }
    }
  }
}

const FOR_DEAD = new Set(["respawn", "say"]);

const COMMANDS = {
  respawn: (w, p) => Player.respawn(w, p),
  say(w, p, cmd) {
    const text = String(cmd.text || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120);
    if (text) w.emit({ t: "chat", id: p.id, name: p.name, text });
    return !!text;
  },
  move(w, p, cmd) {
    if (w.busy(p)) return w.reject(p, cmd, "ocupado");
    if (w.time - p.lastMove < LIMITS.moveMs) return w.reject(p, cmd, "demasiado rápido");
    const run = !!cmd.run && p.sp >= 1;                       // sin resistencia no se corre
    if (!w.tryStep(p, cmd.dir, run ? PLAYER.runMs : PLAYER.walkMs, run ? ACT.RUN : ACT.MOVE)) return w.reject(p, cmd, "bloqueado");
    if (run) p.sp -= 1;
    p.lastMove = w.time;
    return true;
  },
  turn(w, p, cmd) {
    if (!w.busy(p) && cmd.dir >= 1 && cmd.dir <= 8) p.dir = cmd.dir;
    return true;
  },
  attack(w, p, cmd) {
    const t = w.ents.get(cmd.target);
    if (!t || t.dead || t.kind !== "npc") return w.reject(p, cmd, "sin objetivo");
    if (w.busy(p)) return w.reject(p, cmd, "ocupado");
    if (w.time - p.lastAttack < PLAYER.attackCooldownMs) return w.reject(p, cmd, "demasiado rápido");
    if (dist(p, t) > 1) return w.reject(p, cmd, "lejos");
    p.dir = dirTo(p.x, p.y, t.x, t.y);
    const ms = attackMs(p);
    w.setAct(p, ACT.ATTACK, ms);
    p.busyUntil = w.time + ms;
    p.lastAttack = p.lastCombat = w.time;
    w.emit({ t: "attack", id: p.id, target: t.id });
    w.after(ms * PLAYER.attackHitAt, () => Combat.playerHit(w, p, t));
    return true;
  },
  cast: (w, p, cmd) => MagicSys.cast(w, p, cmd),
  learn: (w, p, cmd) => MagicSys.learn(w, p, cmd.spell),
  pickup: (w, p) => ItemSys.startPickup(w, p),
  drop(w, p, cmd) { return cmd.gold ? ItemSys.dropGold(w, p, cmd.gold) : ItemSys.dropItem(w, p, cmd.uid, cmd.count | 0); },
  equip: (w, p, cmd) => ItemSys.equipCmd(w, p, cmd.uid),
  unequip: (w, p, cmd) => ItemSys.unequipCmd(w, p, cmd.uid),
  use(w, p, cmd) {
    let uid = cmd.uid;
    if (uid === undefined && cmd.item !== undefined) uid = p.bag.find(i => i.id === cmd.item)?.uid;   // por id de objeto (atajos)
    return ItemSys.useItem(w, p, uid);
  },
  // posición del objeto dentro de la mochila (MSGID_REQUEST_SETITEMPOS: x 0..170, y -10..95)
  setpos(w, p, cmd) {
    const it = p.bag.find(i => i.uid === cmd.uid);
    if (!it || !Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return w.reject(p, cmd, "no tienes");
    it.x = Math.max(0, Math.min(170, Math.round(cmd.x))); it.y = Math.max(-10, Math.min(95, Math.round(cmd.y)));
    return true;
  },
  stat(w, p, cmd) {
    if (p.pool <= 0 || !(cmd.stat in p.stats) || p.stats[cmd.stat] >= R.STAT_LIMIT) return w.reject(p, cmd, "sin puntos");
    p.stats[cmd.stat]++;
    p.pool--;
    w.recalc(p);
    w.emit({ t: "stats", id: p.id });
    return true;
  },
};

// Duración de la animación de ataque: el arma lenta alarga cada fotograma 12 ms por punto (Client/MapData.cpp).
export function attackMs(p) { return PLAYER.attackMs + p.eff.speedNib * 12 * 8; }

