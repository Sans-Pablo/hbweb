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
import { tickVitals, runStepsPerSp } from "./systems/vitals.js";
import * as MagicSys from "./systems/magicsys.js";
import * as Shop from "./systems/shopsys.js";
import * as Companion from "./systems/companion.js";
import * as Debug from "./systems/debug.js";
import * as Arena from "./systems/arena.js";
import * as Tutorial from "./systems/tutorial.js";
import { tickFields, tickPoison } from "./systems/fields.js";
import { sget, sclear } from "./systems/status.js";
import { tickSky } from "./systems/weather.js";
import * as Party from "./systems/party.js";
import { CAST_MS, MAGIC_MODE, NO_PLAYER_MAGIC } from "./magic.js";

export const RECALL_CHANNEL_MS = 3000, RECALL_COOLDOWN_MS = 60000;
export class World {
  constructor({ grid, npcDb, data, spawns = [], rng = Math.random, start, ids = null, teleports = [] }) {
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
    this.teleports = new Map(teleports.map(t => [grid.idx(t.x, t.y), t]));    // casillas de teletransporte (teleport-loc del mapa)
    this.dayOrNight = 1;             // 1 día, 2 noche (m_cDayOrNight)
    this.weather = 0;                // 0 despejado, 1..3 lluvia ligera/media/fuerte
    this.weatherUntil = 0;
    this.fixedDay = false;           // mapas de "fixed-day-mode": siempre de día y sin clima
    this.clock = null;               // () => minuto de la hora; sin reloj siempre es de día
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
  removePlayer(id) { const p = this.ents.get(id); if (p?.kind === "player") Party.leave(this, p, true); Player.removePlayer(this, id); }
  recalc(p) { Player.recalc(this, p); }

  // Zona sin ataque (CMap::_SetupNoAttackArea + iGetAttribute): los rectángulos de noAttack (-10 = todo el mapa);
  // iGetAttribute devuelve -1 a menos de 20 casillas del borde, y eso también bloquea los hechizos de ataque.
  safeAt(x, y) {
    const m = this.meta; if (!m) return false;
    if (x < 20 || y < 20 || x >= this.grid.w - 20 || y >= this.grid.h - 20) return true;
    for (const r of m.noAttack || []) {
      if (r[1] === -10) return true;
      if (r[1] > 0 && x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return true;
    }
    return false;
  }
  killNpc(n, p) { Npc.killNpc(this, n, p); }

  // ------------------------------------------------------------------ órdenes del cliente
  command(id, cmd) {
    const p = this.ents.get(id);
    if (!p || p.kind !== "player") return false;
    const fn = COMMANDS[cmd.t];
    if (!fn) return false;
    if (p.dead && !FOR_DEAD.has(cmd.t)) return this.reject(p, cmd, "muerto");
    if (this.map?.kind === "arena" && ARENA_BLOCKED.has(cmd.t)) return this.reject(p, cmd, "en la arena solo se mira");      // el público no pelea: solo pelean los summons
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
        if (e.kind === "npc") { if (!(this.dbgFreeze && !e.master)) Npc.npcThink(this, e); }
        else if (e.kind === "player" && !e.dead && this.time - e.lastVitals >= 1000) { e.lastVitals = this.time; tickVitals(this, e); tickPoison(this, e); }
      }
      if (this.time - (this.tFields ?? 0) >= 1000) { this.tFields = this.time; tickFields(this); }
      Arena.tickArena(this);
      tickSky(this);
    }
  }
}

const ARENA_BLOCKED = new Set(["attack", "prepare", "cast", "pickup", "petorder", "pettarget", "petmode", "petgo"]);
const FOR_DEAD = new Set(["respawn", "say"]);

const COMMANDS = {
  respawn: (w, p) => Player.respawn(w, p),
  say(w, p, cmd) {
    let text = String(cmd.text || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120);
    if (text[0] === "$") { text = text.slice(1).trim(); return text ? Party.chat(w, p, text) : false; }        // chat de grupo
    if (text) w.emit({ t: "chat", id: p.id, name: p.name, text });
    return !!text;
  },
  move(w, p, cmd) {
    if (w.busy(p)) return w.reject(p, cmd, "ocupado");
    if (sget(w, p, "hold")) return w.reject(p, cmd, "paralizado");
    if (w.time - p.lastMove < LIMITS.moveMs) return w.reject(p, cmd, "demasiado rápido");
    const run = !!cmd.run && p.sp >= 1;                       // sin resistencia no se corre
    const slow = sget(w, p, "ice") || (p.chillUntil || 0) > w.time ? 1.5 : 1;                 // helado (suelo del rey glacial, tormenta de hielo): un 50 % más lento
    if (!w.tryStep(p, cmd.dir, (run ? PLAYER.runMs : PLAYER.walkMs) * slow, run ? ACT.RUN : ACT.MOVE)) return w.reject(p, cmd, "bloqueado");
    if (run && (p.runSteps = (p.runSteps || 0) + 1) >= runStepsPerSp(p.level)) { p.runSteps = 0; p.sp -= 1; }
    p.lastMove = w.time;
    // al llegar a una casilla de teletransporte, el servidor original (RequestTeleportHandler) te manda al destino
    const tp = w.teleports.get(w.grid.idx(p.x, p.y));
    if (tp) { const x = p.x, y = p.y; w.after((run ? PLAYER.runMs : PLAYER.walkMs) * slow, () => { if (!p.dead && w.ents.get(p.id) === p && p.x === x && p.y === y) w.hooks?.teleport?.(p, tp); }); }
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
    if (dist(p, t) > Combat.reachOf(w, p, t)) return w.reject(p, cmd, "lejos");
    p.dir = dirTo(p.x, p.y, t.x, t.y);
    sclear(w, p, "invis");                                    // atacar rompe la invisibilidad
    const ms = attackMs(p);
    w.setAct(p, ACT.ATTACK, ms);
    p.busyUntil = w.time + ms;
    p.lastAttack = p.lastCombat = w.time;
    // arco (wType 2): el cliente dibuja la flecha hacia (tx, ty); sin flechas se hace el gesto sin disparo (wType 0)
    w.emit({ t: "attack", id: p.id, target: t.id, bow: !!(p.eff.bow && Combat.arrowOf(w, p)), tx: t.x, ty: t.y });
    w.after(ms * PLAYER.attackHitAt, () => Combat.playerHit(w, p, t));
    return true;
  },
  prepare: (w, p, cmd) => (MAGIC_MODE.player ? MagicSys.prepare(w, p, cmd) : w.reject(p, cmd, NO_PLAYER_MAGIC)),
  cast: (w, p, cmd) => (MAGIC_MODE.player ? MagicSys.cast(w, p, cmd) : w.reject(p, cmd, NO_PLAYER_MAGIC)),
  learn: (w, p, cmd) => (MAGIC_MODE.player ? MagicSys.learn(w, p, cmd.spell) : w.reject(p, cmd, NO_PLAYER_MAGIC)),
  pickup: (w, p) => ItemSys.startPickup(w, p),
  partyreq: (w, p, cmd) => Party.request(w, p, String(cmd.name || "").slice(0, 12), cmd.auto === true),
  partyaccept: (w, p, cmd) => Party.answer(w, p, cmd.r | 0),
  partyleave: (w, p) => Party.leave(w, p),
  buy: (w, p, cmd) => Shop.buy(w, p, cmd),
  sellreq: (w, p, cmd) => Shop.sellRequest(w, p, cmd),
  sellconfirm: (w, p, cmd) => Shop.sellConfirm(w, p, cmd.uid, cmd.count | 0),
  selllist: (w, p, cmd) => Shop.sellList(w, p, cmd),
  repairreq: (w, p, cmd) => Shop.repairRequest(w, p, cmd),
  repairconfirm: (w, p, cmd) => Shop.repairConfirm(w, p, cmd),
  deposit: (w, p, cmd) => Shop.deposit(w, p, cmd),
  withdraw: (w, p, cmd) => Shop.withdraw(w, p, cmd),
  petheal: (w, p, cmd) => Companion.treat(w, p, cmd),
  petbuy: (w, p, cmd) => Companion.buyBall(w, p, cmd),
  petup: (w, p, cmd) => Companion.tradeUp(w, p, cmd),
  candybuy: (w, p, cmd) => Companion.buyCandy(w, p, cmd),
  tut: (w, p, cmd) => Tutorial.command(w, p, cmd),
  arenainfo: (w, p, cmd) => Arena.info(w, p, cmd),
  arenabet: (w, p, cmd) => Arena.bet(w, p, cmd),
  petname: (w, p, cmd) => Companion.rename(w, p, cmd.name),
  dbg: (w, p, cmd) => Debug.run(w, p, cmd),
  talent: (w, p, cmd) => Companion.learnTalent(w, p, cmd),
  talreset: (w, p, cmd) => Companion.resetTalents(w, p, cmd),
  // Botón «Recall» de la barra (invento del port; el hechizo Recall del original sigue en magicsys): canaliza 3 s inmóvil y fuera de combate
  // y te lleva a la granja; 60 s de enfriamiento. Un segundo pulso mientras canaliza lo cancela.
  recall(w, p, cmd) {
    if (!w.hooks?.recall) return w.reject(p, cmd, "no disponible");
    if (p.recallTok) { p.recallTok = 0; w.emit({ t: "recallfail", id: p.id, why: "cancel" }); return true; }
    if (w.time < (p.recallCd || 0)) return w.reject(p, cmd, "recall en recarga: " + Math.ceil((p.recallCd - w.time) / 1000) + " s");
    const tok = p.recallTok = (p.recallSeq = (p.recallSeq || 0) + 1), at = w.time, x = p.x, y = p.y;
    w.emit({ t: "recalling", id: p.id, ms: RECALL_CHANNEL_MS });
    w.after(RECALL_CHANNEL_MS, () => {
      if (p.recallTok !== tok) return;
      p.recallTok = 0;
      if (p.dead || w.ents.get(p.id) !== p || p.x !== x || p.y !== y || p.lastCombat > at) return w.emit({ t: "recallfail", id: p.id, why: "moved" });
      p.recallCd = w.time + RECALL_COOLDOWN_MS;
      w.emit({ t: "recalled", id: p.id });
      w.hooks.recall(p);
    });
    return true;
  },
  petmode: (w, p, cmd) => Companion.setMode(w, p, cmd.mode),
  petgo: (w, p, cmd) => Companion.setGo(w, p, cmd.x, cmd.y),
  pettarget: (w, p, cmd) => Companion.setTarget(w, p, cmd.target),
  drop(w, p, cmd) { return cmd.gold ? ItemSys.dropGold(w, p, cmd.gold) : ItemSys.dropItem(w, p, cmd.uid, cmd.count | 0); },
  equip: (w, p, cmd) => ItemSys.equipCmd(w, p, cmd.uid),
  unequip: (w, p, cmd) => ItemSys.unequipCmd(w, p, cmd.uid),
  use(w, p, cmd) {
    let uid = cmd.uid;
    if (uid === undefined && cmd.item !== undefined) uid = p.bag.find(i => i.id === cmd.item)?.uid;   // por id de objeto (atajos)
    return ItemSys.useItem(w, p, uid, cmd.dest);
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
    const n = Math.max(1, Math.min(p.pool, R.STAT_LIMIT - p.stats[cmd.stat], Math.floor(Number(cmd.n)) || 1));   // varios puntos en una sola orden (el servidor limita los mensajes por segundo)
    p.stats[cmd.stat] += n;
    p.pool -= n;
    w.recalc(p);
    w.emit({ t: "stats", id: p.id });
    return true;
  },
};

// Duración de la animación de ataque: el arma lenta alarga cada fotograma 12 ms por punto (Client/MapData.cpp).
export function attackMs(p) { return PLAYER.attackMs + p.eff.speedNib * 12 * 8; }

