// Conexión con el "servidor". Dos implementaciones con la misma forma:
//   join(nombre) -> id   send(orden) -> bool   update(dt) -> eventos   state -> vista del mundo
//   LocalConnection: la simulación corre dentro de la página (un jugador).
//   NetConnection:   la simulación corre en server/server.mjs y llega por WebSocket.
import { generateLevel } from "../shared/dungeon.js";
import { ACT, DX, DY, PLAYER, LIMITS, NET_PROTO, mobDurations } from "../shared/const.js";

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
    this.map = { id: "arefarm", kind: "farm", name: "Aresfarm", portals: [] };
    this.npcDb = npcDb;
    this.data = data;
    this.time = 0;
    this.ents = new Map();
    this.items = new Map();
    this.dayOrNight = 1; this.weather = 0; this.fixedDay = false; this.dyn = []; this.bfx = []; this.generators = []; this.meta = null;
  }
  busy(e) { return this.time < e.busyUntil; }
  rebuildOccupancy() {
    this.grid.occ.clear();
    for (const e of this.ents.values()) if (!e.dead) this.grid.occupy(e.x, e.y, e.id);
  }
}

// Suavizado de los pasos de OTROS jugadores/monstruos online. Los estados llegan a 20 Hz y con jitter (túnel, wifi): si cada paso
// arrancase al llegar, el personaje se pararía un instante cuando el siguiente llega tarde y daría un salto al llegar. Se muestra
// con un pequeño retardo fijo (REMOTE_DELAY) y los pasos se encadenan: el siguiente empieza donde acaba el anterior, y un
// "parado" que llega antes de acabar el paso visible no lo corta (anim.js lo pasa a STOP solo al terminar).
export const REMOTE_DELAY = 120;
const isStep = a => a === ACT.MOVE || a === ACT.RUN;
// devuelve true si el estado `o` debe dejar intacta la animación actual de `e` (no sobrescribir posición/acto)
export function smoothRemote(e, o, time) {
  const curEnd = e.actStart + e.actDur;
  const inStep = isStep(e.act) && time < curEnd;
  if (isStep(o.act)) {
    let start = o.s + REMOTE_DELAY;
    if (inStep && e.x === o.fx && e.y === o.fy && start < curEnd) start = curEnd;   // encadenar con el paso en curso
    return { keep: false, start };
  }
  // parado en el mismo sitio al que ya voy: dejar acabar el paso
  if (inStep && o.act === ACT.STOP && o.x === e.x && o.y === e.y) return { keep: true };
  return { keep: false, start: o.s };
}

export class NetConnection {
  // base: dirección del servidor ("" = el mismo que sirve la web; si no, p. ej. https://mi-pc.ngrok-free.app); spawns: generadores de la granja (para cargar sus monstruos)
  constructor(grid, npcDb, data, maps = {}, base = "", spawns = []) {
    this.maps = maps;
    this.base = base;
    this.farmSpawns = spawns;
    this.world = new MirrorWorld(grid, npcDb, data);
    this.world.generators = spawns;
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
    this.waiting = null;
    this.admin = false;
  }

  // dirección del WebSocket: http(s)://host -> ws(s)://host/ws
  get wsUrl() {
    const b = this.base || location.origin;
    return b.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
  }

  // abre la conexión (si no está abierta) y espera un mensaje concreto del servidor
  open() {
    if (this.ws && this.ws.readyState === 1) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = this.ws = new WebSocket(this.wsUrl); } catch (e) { reject(new Error("Dirección del servidor no válida.")); return; }
      let opened = false;
      ws.onopen = () => { opened = true; resolve(); };
      ws.onmessage = e => this.onMessage(JSON.parse(e.data));
      ws.onclose = () => {
        clearInterval(this.pinger);
        if (!opened) { reject(new Error("No se pudo conectar con el servidor.")); return; }
        this.status = "desconectado";
        if (this.waiting) { this.waiting.reject(new Error(this.kickMsg || "Se cortó la conexión con el servidor.")); this.waiting = null; }
        this.events.push({ t: "disconnected", reason: this.kickMsg || "" });
      };
      this.pinger = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: "ping", c: performance.now(), p: this.ping })); }, 2000);
    });
  }
  request(msg, okType) {
    return new Promise((resolve, reject) => { this.waiting = { okType, resolve, reject }; this.ws.send(JSON.stringify(msg)); });
  }
  // usuario + contraseña: mode "login" o "register". Devuelve { name, hasChar, admin, version }
  async login(mode, name, pass) {
    await this.open();
    const r = await this.request({ t: "auth", mode, name, pass, proto: NET_PROTO }, "authok");
    this.admin = !!r.admin; this.account = r.name; this.serverVersion = r.version;
    return r;
  }
  // entra en el mundo (create: personaje nuevo si la cuenta aún no tiene)
  async join(name, create = null) {
    await this.open();
    const m = await this.request({ t: "join", create }, "welcome");
    this.pid = m.id;
    this.serverTime = this.world.time = m.time;
    this.recvAt = performance.now();
    this.status = "conectado";
    this.returning = m.returning;
    this.admin = !!m.admin;
    return m.id;
  }
  onMessage(m) {
    if (this.waiting && (m.t === this.waiting.okType || m.t === "error")) {
      const w = this.waiting; this.waiting = null;
      if (m.t === "error") { const e = new Error(m.msg); e.code = m.code; w.reject(e); } else w.resolve(m);
    } else if (m.t === "s") this.onState(m);
    else if (m.t === "pong") this.ping = Math.round(performance.now() - m.c);
    else if (m.t === "msg") this.events.push({ t: "chat", system: true, text: m.text, id: this.pid });
    else if (m.t === "kicked") this.kickMsg = m.msg;
  }

  onState(m) {
    const w = this.world;
    this.serverTime = m.time;
    this.recvAt = performance.now();
    this.ack = m.ack;
    if (m.map && m.map.id !== w.map.id) {
      w.grid = m.map.kind === "dungeon" ? generateLevel(m.map.seed, m.map.level).grid : (this.maps[m.map.id]?.grid || w.farmGrid);
      w.ents.clear(); w.items.clear();
      this.resync = true;
    }
    if (m.map) { w.map = m.map; w.meta = this.maps[m.map.id]?.meta || null; w.generators = m.map.kind === "farm" ? this.farmSpawns : []; }
    if (m.sk) { const was = w.dayOrNight; w.fixedDay = !!m.sk[0]; w.dayOrNight = m.sk[1]; w.weather = m.sk[2]; if (was !== m.sk[1] && this.pid && !w.fixedDay && this.sawSky) this.events.push({ t: "time", v: m.sk[1] }); this.sawSky = true; }
    if (m.fx) { w.dyn = m.fx[0]; w.bfx = m.fx[1]; }
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
      if (!isNew && !own && o.k !== "citizen") {
        const sm = smoothRemote(e, o, this.world.time);
        if (sm.keep) { e.dir = o.dir; return; }
        e.x = o.x; e.y = o.y; e.fx = o.fx; e.fy = o.fy; e.dir = o.dir; e.act = o.act; e.actStart = sm.start; e.actDur = o.d;
        return;
      }
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
    e.role = o.rl; e.comp = !!o.cp; e.master = o.mt;
    if (o.cp) { e.nick = o.nk; e.clvl = o.cl; e.evoK = (o.ek || 0) / 100; }
    if (o.ar) { e.arena = true; e.nick = o.nk; e.clvl = o.cl; }
    if (o.k === "npc" || o.k === "citizen") {
      e.type = o.type; e.special = o.sp; e.phase = o.ph; e.boss = o.bs || 0; { const bx = o.bx || 0; e.clone = !!(bx & 1); e.crystal = !!(bx & 2); e.shield = !!(bx & 4); e.hasClones = !!(bx & 8); e.ghost = !!(bx & 16); e.wrath = o.wr || 0; e.owner = o.ow || 0; }
      if (isNew) { e.cfg = w.npcDb[o.name] || {}; e.dur = mobDurations(o.type); }
    } else {
      e.lastCombat = Math.max(e.lastCombat || -1e9, o.lc);
      if (o.lk) { e.gender = o.lk[0]; e.look = { skin: o.lk[1], hair: o.lk[2], hairCol: o.lk[3], under: o.lk[4] }; }
      if (own) Object.assign(e, o.o);                    // estado completo del propio jugador (server/server.mjs: ownState)
      else e.ap = o.ap;                                  // equipo visible de los demás
      if (e.busyUntil === undefined) e.busyUntil = 0;
      if (e.lastAttack === undefined) e.lastAttack = -1e9;
      if (e.lastMove === undefined) e.lastMove = -1e9;
    }
  }

  // Predicción: mis pasos y golpes empiezan al instante; el servidor confirma después.
  send(cmd) {
    const w = this.world, me = w.ents.get(this.pid);
    if (!me || this.ws.readyState !== 1) return false;
    if (w.map?.kind === "arena" && (cmd.t === "attack" || cmd.t === "cast" || cmd.t === "prepare")) return false;       // en la arena solo se mira
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
    } else if (cmd.t === "turn" && !me.dead) {
      if (!w.busy(me) && cmd.dir >= 1 && cmd.dir <= 8) me.dir = cmd.dir;      // girar sin andar (clic derecho): se predice, el servidor no manda `dir` de mi personaje si no cambia nada más
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

