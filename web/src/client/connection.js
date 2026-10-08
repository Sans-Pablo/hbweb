// Conexión con el "servidor". Dos implementaciones con la misma forma:
//   join(nombre) -> id   send(orden) -> bool   update(dt) -> eventos   state -> vista del mundo
//   LocalConnection: la simulación corre dentro de la página (un jugador).
//   NetConnection:   la simulación corre en server/server.mjs y llega por WebSocket.
import { generateDungeon, FARM_PORTAL } from "../shared/dungeon.js";
import { ACT, DX, DY, PLAYER, LIMITS, mobDurations } from "../shared/const.js";

export class LocalConnection {
  constructor(adventure) {
    this.adventure = adventure;
    this.pid = null;
    this.online = false;
  }
  // ¿ya hay un personaje guardado con esta cuenta?
  static hasSave(name) { try { return !!localStorage.getItem("hbweb.save." + String(name).toLowerCase()); } catch { return false; } }
  async join(name, create = null) {
    this.key = "hbweb.save." + String(name).toLowerCase();
    let save;
    try { save = JSON.parse(localStorage.getItem(this.key) || "null") || undefined; } catch {}
    this.returning = !!save;
    this.pid = this.adventure.addPlayer((create && create.name) || name, save, create);
    this.lastSave = 0;
    if (!save) this.save();
    addEventListener("pagehide", () => this.save());
    return this.pid;
  }
  // el progreso queda en el navegador de cada jugador (sin servidor)
  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.adventure.saveOf(this.pid))); } catch {}
  }
  send(cmd) { return this.adventure.command(this.pid, cmd); }
  update(dt) {
    this.adventure.tick(dt);
    if (this.key && (this.lastSave += dt) > 10000) { this.lastSave = 0; this.save(); }
    const events = this.adventure.drainEvents();
    return events.get(this.state.map.id) || [];
  }
  get state() { return this.adventure.worldFor(this.pid); }
}

// Copia del mundo en el cliente: las entidades que el servidor nos cuenta, con los mismos
// campos que usa World, para que el dibujo, la interfaz y el control no noten la diferencia.
class MirrorWorld {
  constructor(grid, npcDb, data) {
    this.grid = grid;
    this.farmGrid = grid;
    this.map = { id: "arefarm", kind: "farm", name: "Aresfarm", portals: [FARM_PORTAL] };
    this.npcDb = npcDb;
    this.data = data;
    this.time = 0;
    this.ents = new Map();
    this.items = new Map();
  }
  busy(e) { return this.time < e.busyUntil; }
  rebuildOccupancy() {
    this.grid.occ.clear();
    for (const e of this.ents.values()) if (!e.dead) this.grid.occupy(e.x, e.y, e.id);
  }
}

export class NetConnection {
  constructor(grid, npcDb, data, maps = {}) {
    this.maps = maps;
    this.world = new MirrorWorld(grid, npcDb, data);
    this.pid = null;
    this.online = true;
    this.events = [];
    this.seq = 0;
    this.ack = 0;
    this.serverTime = 0;
    this.recvAt = 0;
    this.resync = false;
    this.status = "conectando";
    this.ping = 0;
  }

  join(name) {
    return new Promise((resolve, reject) => {
      const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
      const ws = this.ws = new WebSocket(url);
      ws.onopen = () => { ws.send(JSON.stringify({ t: "join", name })); };
      ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.t === "welcome") {
          this.pid = m.id;
          this.serverTime = this.world.time = m.time;
          this.recvAt = performance.now();
          this.status = "conectado";
          this.returning = m.returning;
          resolve(m.id);
        } else if (m.t === "error") { reject(new Error(m.msg)); ws.close(); }
        else if (m.t === "s") this.onState(m);
        else if (m.t === "pong") this.ping = Math.round(performance.now() - m.c);
      };
      ws.onclose = () => {
        this.status = "desconectado";
        this.events.push({ t: "disconnected" });
        reject(new Error("No se pudo conectar con el servidor."));
      };
      setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: "ping", c: performance.now() })); }, 2000);
    });
  }

  onState(m) {
    const w = this.world;
    this.serverTime = m.time;
    this.recvAt = performance.now();
    this.ack = m.ack;
    if (m.map && m.map.id !== w.map.id) {
      w.grid = m.map.kind === "dungeon" ? generateDungeon(m.map.seed).grid : (this.maps[m.map.id]?.grid || w.farmGrid);
      w.ents.clear(); w.items.clear();
      this.resync = true;
    }
    if (m.map) w.map = m.map;
    for (const o of m.e || []) this.applyEnt(o);
    for (const id of m.g || []) w.ents.delete(id);
    if (m.it) {
      w.items.clear();
      for (const [uid, id, count, x, y, attr] of m.it) {
        const k = w.grid.idx(x, y);
        if (!w.items.has(k)) w.items.set(k, []);
        w.items.get(k).push({ uid, id, count, x, y, ...(attr ? { attr } : {}) });
      }
    }
    for (const ev of m.ev || []) {
      if (ev.t === "reject" && ev.id === this.pid) this.resync = true;
      if (ev.t === "remove") w.ents.delete(ev.id);
      this.events.push(ev);
    }
    w.rebuildOccupancy();
  }

  applyEnt(o) {
    const w = this.world;
    let e = w.ents.get(o.id);
    const isNew = !e;
    if (isNew) { e = { id: o.id, kind: o.k, name: o.name }; w.ents.set(o.id, e); }
    const own = o.id === this.pid;
    // posición y animación: para mi personaje, solo si el servidor ya procesó todo lo que
    // mandé y no coincide con lo que predije (paso rechazado), o al aparecer/morir
    const posFields = () => {
      e.x = o.x; e.y = o.y; e.fx = o.fx; e.fy = o.fy; e.dir = o.dir; e.act = o.act; e.actStart = o.s; e.actDur = o.d;
      if (own) { e.busyUntil = o.bu; e.lastAttack = o.la; e.lastMove = o.lm; }
    };
    const newAction = o.s !== e.srvS;           // el servidor empezó una acción nueva
    e.srvS = o.s;
    if (!own || isNew) posFields();
    else {
      const settled = this.ack >= this.seq && this.world.time >= e.busyUntil;
      const differs = e.x !== o.x || e.y !== o.y;
      if (this.resync || (settled && differs) || !!o.dead !== !!e.dead ||
          (newAction && (o.act === ACT.DAMAGE || o.act === ACT.DYING || o.act === ACT.STOP && o.d === 0 && !o.dead && e.dead))) {
        posFields(); this.resync = false;
      } else if (newAction && (o.act === ACT.GETITEM || o.act === ACT.MAGIC)) {
        e.act = o.act; e.actStart = this.world.time; e.actDur = o.d;   // recoger: no se predice
      }
    }
    e.dead = !!o.dead; e.hp = o.hp; e.maxHp = o.mh; e.name = o.name;
    if (o.k === "npc") {
      e.type = o.type; e.special = o.sp; e.phase = o.ph;
      if (isNew) { e.cfg = w.npcDb[o.name] || {}; e.dur = mobDurations(o.type); }
    } else {
      e.lastCombat = Math.max(e.lastCombat || -1e9, o.lc);
      if (o.lk) { e.gender = o.lk[0]; e.look = { skin: o.lk[1], hair: o.lk[2], hairCol: o.lk[3], under: o.lk[4] }; }
      if (own) Object.assign(e, {
        mp: o.mp, maxMp: o.mm, level: o.lv, exp: o.xp, prevExp: o.px, nextExp: o.nx, pool: o.pool, gold: o.gold,
        sp: o.sp, maxSp: o.ms, hunger: o.hu, weight: o.wt, maxLoad: o.ml, atkMs: o.am, dmg: o.dmg,
        bag: o.bag.map(([uid, id, count, life, attr, color, x, y]) => ({ uid, id, count, life, x, y, ...(attr ? { attr, color } : {}) })), equip: o.eq, magic: o.mg,
        stats: o.stats, defense: o.def, kills: o.kills, skills: o.skills, deadAt: o.deadAt,
      });
      if (e.busyUntil === undefined) e.busyUntil = 0;
      if (e.lastAttack === undefined) e.lastAttack = -1e9;
      if (e.lastMove === undefined) e.lastMove = -1e9;
    }
  }

  // Predicción: mis pasos y golpes empiezan al instante; el servidor confirma después.
  send(cmd) {
    const w = this.world, me = w.ents.get(this.pid);
    if (!me || this.ws.readyState !== 1) return false;
    if (cmd.t === "move" && !me.dead) {
      if (w.busy(me) || w.time - me.lastMove < LIMITS.moveMs) return false;
      const nx = me.x + DX[cmd.dir], ny = me.y + DY[cmd.dir];
      me.dir = cmd.dir;
      if (!w.grid.free(nx, ny, me.id)) return false;
      const run = cmd.run && me.sp >= 1;
      const dur = run ? PLAYER.runMs : PLAYER.walkMs;
      w.grid.release(me.x, me.y, me.id); w.grid.occupy(nx, ny, me.id);
      me.fx = me.x; me.fy = me.y; me.x = nx; me.y = ny;
      if (run) me.sp -= 1;
      me.act = run ? ACT.RUN : ACT.MOVE; me.actStart = w.time; me.actDur = dur;
      me.busyUntil = w.time + dur; me.lastMove = w.time;
      this.events.push({ t: "step", id: me.id });
    } else if (cmd.t === "attack" && !me.dead) {
      if (w.busy(me) || w.time - me.lastAttack < PLAYER.attackCooldownMs) return false;
      const t = w.ents.get(cmd.target);
      if (t) me.dir = dirToward(me, t);
      const ams = me.atkMs || PLAYER.attackMs;
      me.act = ACT.ATTACK; me.actStart = w.time; me.actDur = ams;
      me.busyUntil = w.time + ams; me.lastAttack = me.lastCombat = w.time;
    } else if (cmd.t === "pickup") {
      if (w.busy(me)) return false;
      me.busyUntil = w.time + PLAYER.getItemMs;
    }
    this.ws.send(JSON.stringify({ t: "cmd", seq: ++this.seq, cmd }));
    return true;
  }

  // reloj: el del servidor, avanzando con el tiempo real entre mensajes
  update(dt) {
    const w = this.world;
    const target = this.serverTime + (performance.now() - this.recvAt);
    if (Math.abs(target - w.time) > 400) w.time = target;
    else w.time += dt + (target - (w.time + dt)) * 0.1;
    const ev = this.events; this.events = [];
    return ev;
  }

  get state() { return this.world; }
}

function dirToward(a, b) {
  const ax = Math.sign(b.x - a.x), ay = Math.sign(b.y - a.y);
  for (let d = 1; d <= 8; d++) if (DX[d] === ax && DY[d] === ay) return d;
  return a.dir;
}

