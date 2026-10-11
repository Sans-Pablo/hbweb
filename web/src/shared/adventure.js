import { spawnCompanion } from "./systems/npcsys.js";
import { activeBall } from "./systems/companion.js";
// Enruta jugadores entre Aresfarm e instancias privadas. Compartido por Node y navegador.
import { World } from "./world.js";
import { ACT, dist } from "./const.js";
import { DUNGEON_LEVELS, DUNGEON_VERSION, generateLevel, levelSeed, hasDungeonPalette } from "./dungeon.js";
import { respawn } from "./systems/player.js";
import { populate, spawnCitizen } from "./systems/citizens.js";
import { ARENA } from "./systems/arena.js";
import * as Comp from "./systems/companion.js";
import { DEBUG } from "./systems/debug.js";
import { makeReg } from "./systems/party.js";
import { makeReg as makeGuildReg } from "./systems/guild.js";
import * as Bot from "./systems/bot.js";
import * as Residents from "./systems/residents.js";

const MAP_NAMES = { aresden: "Aresden", arefarm: "Aresfarm", aresdend1: "Mina de Aresden", arebrk11: "Cuartel de Aresden", arebrk12: "Cuartel de Aresden", arebrk21: "Cuartel de Aresden", arebrk22: "Cuartel de Aresden", wrhus_1: "Almacén", wrhus_1f: "Almacén", arewrhus: "Almacén", cityhall_1: "Ayuntamiento", resurr1: "Templo de resurrección", gshop_1: "Tienda general", gshop_1f: "Tienda general", arejail: "Prisión", cath_1: "Catedral", wzdtwr_1: "Torre del mago", bsmith_1: "Herrería", bsmith_1f: "Herrería", gldhall_1: "Sala del gremio", cmdhall_1: "Sala de mando", huntzone1: "Arena de apuestas", elvfarm: "Elvine Farm", "2ndmiddle": "Promise Land" };

// Punto de retorno de Aresfarm (Recall, muerte, salidas de cripta/arena/tienda): lo pidió el diseño; el original usa el punto de reaparición de cada mapa (Map.cfg initial)
export const FARM_HOME = [65, 75];
export const ALLOWED_MAPS = new Set(["arefarm", "elvfarm", "2ndmiddle", "gshop_1f", "bsmith_1f", "wrhus_1f"]);        // Promise Land (2ndmiddle) une las dos granjas y es zona de lucha entre bandos

const gkey = p => p.party ? "g" + p.party.id : p.id;   // clave de la cripta: la party comparte una
export class Adventure {
  constructor(options) {
    this.options = options;
    this.ids = { ent: 1, item: 1 };
    this.time = 0;
    this.serial = 0;
    this.locations = new Map();
    this.watched = new Set();               // ids de bots que alguien observa (modo observar): sus decisiones se mandan al chat
    this.bots = new Map();                  // jugadores simulados (systems/bot.js): id -> entidad
    this.instances = new Map();             // una cripta por jugador durante la sesión
    this.worlds = new Map();
    this.guildReg = makeGuildReg(() => this.worlds.values());       // guilds: persisten y cruzan mapas (systems/guild.js)
    this.partyReg = makeReg(() => this.worlds.values());       // grupos: cruzan mapas (systems/party.js)
    this.maps = options.maps || {};          // mapas estáticos de la ciudad: id -> { grid, meta }
    this.farm = new World({ ...options, ids: this.ids, teleports: this.maps.arefarm?.meta.teleports || [] });
    this.farm.map = { id: "arefarm", kind: "farm", name: "Aresfarm", portals: [] };
    this.farm.meta = this.maps.arefarm?.meta;
    this.farm.home = FARM_HOME;              // Recall, resurrección, volver de la cripta/arena/tienda: siempre aquí
    this.farm.fixedDay = !!this.farm.meta?.fixedDay;
    this.farm.clock = options.clock || null;
    this.worlds.set(this.farm.map.id, this.farm);
    this.farm.hooks = this.hooks(this.farm);
    this.farm.evHook = (w, ev) => Residents.onEvent(this, w, ev);
    this.llm = null;                         // el servidor puede poner aquí un generador de texto (server/llm.mjs) para los habitantes
  }

  // ganchos que el mundo usa para cosas que cruzan mapas (Recall)
  hooks(w) {
    return {
      recall: p => this.recall(p, w), teleport: (p, tp) => this.teleport(p, w, tp),
      // arena de apuestas: mapa de arena compartido (sin monstruos); sin ese mapa (tests sueltos) se pelea donde está el jugador
      arenaWorld: () => (this.maps[ARENA.map] ? this.staticWorld(ARENA.map) : w),
      arenaGo: (p, from, to) => { p.arenaBack = { map: from.map.id, x: p.x, y: p.y }; return this.transfer(p, from, to, ARENA.watch); },
      arenaBack: (p, from) => { const b = p.arenaBack || { map: ARENA.shop }, to = b.map === "arefarm" ? this.farm : this.staticWorld(b.map) || this.staticWorld(ARENA.shop) || this.farm; p.arenaBack = null; return this.transfer(p, from, to, b.x ? [b.x, b.y] : to.start); },
      player: id => this.worldFor(id).ents.get(id),
      bot: (p, c) => this.botOp(p, c),
      watched: this.watched,
      party: this.partyReg,
      guild: this.guildReg,
      friends: p => this.friendsOf(p),                                       // amigos conectados (afinidad ≥ 2, mismo bando) para ayudarles con el equipo
      thought: (p, sit) => Residents.thought(this, p, sit),               // burbuja de pensamiento: la genera el modelo de lenguaje
      logSink: (p, t) => this.logSink?.(p, t, w.time),                 // registro de acciones de los habitantes (server: panel de administración)
    };
  }

  // Mundo compartido de un mapa estático (ciudad, tiendas...); se crea al entrar el primer jugador.
  staticWorld(id) {
    if (id === "arefarm") return this.farm;
    if (this.worlds.has(id)) return this.worlds.get(id);
    const m = this.maps[id];
    if (!m) return null;
    if (!m.grid) { m.ensure?.().catch(() => {}); return null; }          // rejilla aún sin descargar (carga bajo demanda del cliente)
    m.start = m.start || Object.values(m.meta.initial || {})[0] || [Math.floor(m.grid.w / 2), Math.floor(m.grid.h / 2)];
    const { meta } = m, o = this.options;
    const isArena = id === ARENA.map;                              // el mapa de arena no tiene monstruos, teletransportes ni combate
    const spawns = isArena ? [] : (meta.spawns || []).filter(s => s.kind === 1 && o.npcDb[s.name]).map(s => ({ ...s }));
    const w = new World({ grid: m.grid, npcDb: o.npcDb, data: o.data, spawns, start: m.start, ids: this.ids, rng: o.rng || Math.random, teleports: isArena ? [] : meta.teleports });
    w.time = this.time;
    w.hooks = this.hooks(w);
    w.evHook = this.farm.evHook;
    w.map = { id, kind: isArena ? "arena" : id === "aresden" ? "town" : "indoor", name: MAP_NAMES[id] || id, portals: [] };
    if (id === "elvfarm") w.home = Object.values(meta.initial || {})[0] || m.start;          // granja de Elvine: su propio punto de retorno
    if (id === "2ndmiddle") w.pvp = true;                                                      // aquí Aresden y Elvine se atacan (systems/pvp.js)
    w.meta = isArena ? { ...meta, noAttack: [[0, -10, 0, 0]], npcs: [] } : meta;
    w.fixedDay = !!meta.fixedDay;
    w.clock = o.clock || null;
    for (const n of w.ents.values()) n.nextAct += this.time;
    if (!isArena) populate(w, meta, id);
    this.worlds.set(id, w);
    return w;
  }

  // teleport-loc: destino en otro mapa (o en el mismo); -1,-1 = punto de inicio del mapa destino
  teleport(p, w, tp) {
    let id = tp.map.toLowerCase();
    if (id === "middled1n") {                                       // la entrada a middled1n (teletransportador de la granja) lleva directo a la cripta
      if (w.map.kind === "dungeon") return false;
      return this.enterCrypt(p, w, { id: "mid-entry", x: p.x, y: p.y }, {});
    }
    if (!ALLOWED_MAPS.has(id)) {                                    // en esta versión solo existen la granja y las criptas: el resto lleva de vuelta a la granja
      w.emit({ t: "reject", id: p.id, cmd: "teleport", why: "solo existen Aresfarm, sus tiendas y la cripta" });
      const home = this.homeOf(p);
      if (w === home) return false;
      return this.transfer(p, w, home, home.home);
    }
    const to = id === w.map.id ? w : this.staticWorld(id);
    if (!to) { w.emit({ t: "reject", id: p.id, cmd: "teleport", why: this.maps[id] && !this.maps[id].grid ? "cargando el mapa, vuelve a intentarlo" : "mapa no disponible" }); return false; }
    const init = this.maps[id]?.meta.initial;
    const spot = tp.dx >= 0 ? [tp.dx, tp.dy] : (init && Object.values(init)[0]) || to.start;
    if (to === w) return this.relocate(p, w, spot, tp.dir);
    if (!this.transfer(p, w, to, spot)) return false;
    if (tp.dir >= 1 && tp.dir <= 8) p.dir = tp.dir;
    return true;
  }
  relocate(p, w, spot, dir) {
    const s = w.freeSpotNear(...spot);
    if (!s) return false;
    w.grid.release(p.x, p.y, p.id);
    p.x = p.fx = s[0]; p.y = p.fy = s[1];
    if (dir >= 1 && dir <= 8) p.dir = dir;
    w.grid.occupy(p.x, p.y, p.id);
    p.act = ACT.STOP; p.actStart = w.time; p.actDur = 0; p.busyUntil = w.time;
    for (const n of w.ents.values()) if (n.target === p.id) n.target = null;
    w.emit({ t: "teleport", id: p.id, x: p.x, y: p.y });
    return true;
  }
  recall(p, w) {
    if (p.dead) return;
    const home = this.homeOf(p);
    if (w !== home) { this.transfer(p, w, home, home.home); return; }
    const spot = w.freeSpotNear(...(w.home || w.start));
    if (!spot) return;
    w.grid.release(p.x, p.y, p.id);
    p.x = p.fx = spot[0]; p.y = p.fy = spot[1];
    w.grid.occupy(p.x, p.y, p.id);
    p.act = ACT.STOP; p.actStart = w.time; p.actDur = 0; p.busyUntil = w.time;
    for (const n of w.ents.values()) if (n.target === p.id) n.target = null;
    w.emit({ t: "teleport", id: p.id, x: p.x, y: p.y });
  }

  // Granja de cada bando: Aresden (bando 1 y viajeros) en Aresfarm, Elvine (bando 2) en Elvine Farm si el mapa está disponible
  homeOf(p) { return p.side === 2 ? this.staticWorld("elvfarm") || this.farm : this.farm; }
  friendsOf(p) {
    const out = [], rel = p.res?.rel; if (!rel) return out;
    for (const [id, w] of this.locations) { if (id === p.id) continue; const q = w.ents.get(id); if (q && q.kind === "player" && !q.dead && rel[q.name] >= 2 && (q.side === p.side || !q.side)) out.push({ q, rel: rel[q.name] }); }
    return out;
  }
  worldFor(id) { return this.locations.get(id) || this.farm; }
  addPlayer(name, save, create = null) {
    const id = this.farm.addPlayer(name, save, create);
    const pl = this.farm.ents.get(id); if (pl && !pl.side) pl.side = 1;       // nadie empieza de «viajero»: Aresfarm es de Aresden, como los habitantes (así pueden invitarte a party y guild)
    this.locations.set(id, this.farm);
    return id;
  }
  saveOf(id) {
    const w = this.worldFor(id), s = w.saveOf(id), r = s && w.ents.get(id)?.res;
    if (r) { const { next, reply, seen, idleAt, lvl, deadSeen, followUntil, ...keep } = r; s.res = JSON.parse(JSON.stringify(keep, (k, v) => (k[0] === "_" ? undefined : v))); }     // el habitante guarda su ficha, memoria y metas
    return s;
  }

  // ---- bots (herramienta de admin: dbg bot / botclear)
  spawnBot(owner, opts = {}) {
    const taken = new Set([...this.locations.keys()].map(id => this.worldFor(id).ents.get(id)?.name?.toLowerCase()).filter(Boolean));
    const id = this.addPlayer(opts.name || Bot.pickName(taken), null, { gender: opts.gender || (this.farm.rng() < 0.5 ? 1 : 2), stats: { ...Bot.BOT_STATS } });
    const p = this.farm.ents.get(id);
    Bot.init(this.farm, p, { level: opts.level, owner: owner ? owner.id : null });
    this.bots.set(id, p);
    if (owner) {
      const ow = this.worldFor(owner.id);
      if (ow !== this.farm) this.transfer(p, this.farm, ow, [owner.x, owner.y]); else this.relocate(p, ow, [owner.x + 1, owner.y]);
      p.bot.home = { x: p.x, y: p.y };
    }
    return p;
  }
  // Habitante: bot permanente con ficha, memoria y objetivos (systems/residents.js). `save` = su partida guardada (o null si es nuevo).
  spawnResident(name, save = null) {
    const h = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const idx = Residents.RESIDENT_NAMES.indexOf(name), side = idx >= 20 ? 2 : 1;           // 20 de Aresden y 20 de Elvine
    const id = this.addPlayer(name, save, save ? null : { gender: h % 2 ? 1 : 2, stats: { ...Bot.BOT_STATS } });
    const p = this.farm.ents.get(id);
    p.side = side;
    Bot.init(this.farm, p, { level: save ? p.level : 1 + (h % 4), keep: !!save });
    const home = this.homeOf(p), c = home.home || FARM_HOME;
    const spot = home.freeSpotNear(c[0] + ((h >> 3) % 41) - 20, c[1] + ((h >> 9) % 41) - 20);
    if (spot) { if (home !== this.farm) this.transfer(p, this.farm, home, spot); else this.relocate(p, this.farm, spot); }
    p.bot.home = { x: p.x, y: p.y };
    Residents.attach(home, p, save?.res);
    this.bots.set(id, p);
    return p;
  }
  residents() { return [...this.bots.values()].filter(b => b.res); }
  botOp(p, c) {
    if (c.op === "botclear") { let n = 0; for (const [id, b] of [...this.bots]) if (!b.res) { this.removePlayer(id); n++; } return n; }
    const n = Math.max(1, Math.min(10, c.n | 0 || 1)), solo = !!c.solo, out = [];
    for (let i = 0; i < n && this.bots.size < 40; i++) out.push(this.spawnBot(solo ? null : p, { level: c.level }));
    return out;
  }
  removePlayer(id) {
    for (const [bid, b] of [...this.bots]) if (b.bot.owner === id) this.removePlayer(bid);          // los bots de un jugador se van con él
    this.bots.delete(id);
    const w = this.worldFor(id);
    w.removePlayer(id);
    this.locations.delete(id);
    if (w.map.kind === "dungeon") this.dropIfEmpty(w);
  }

  command(id, cmd) {
    const w = this.worldFor(id), p = w.ents.get(id);
    if (!p) return false;
    if (cmd.t === "portal") {
      const gate = cmd.portal === "mid-entry" && w.map.kind !== "dungeon" ? { id: "mid-entry", x: p.x, y: p.y } : w.map.portals.find(g => g.id === cmd.portal);
      if (p.dead || w.busy(p)) return w.reject(p, cmd, "ocupado o muerto");
      if (!gate || dist(p, gate) > 1) return w.reject(p, cmd, "acércate al portal");
      if (w.map.kind !== "dungeon") return this.enterCrypt(p, w, gate, cmd);
      // dentro de la cripta: bajar (solo con el nivel despejado) o salir al mapa de origen
      if (gate.locked && (!w.cleared || [...w.ents.values()].some(e => e.kind === "npc" && !e.comp && !e.aux && !e.dead) || w.ghostsPending > 0)) return w.reject(p, cmd, "mata a todos los esqueletos para continuar");
      if (gate.target === "down") return this.descend(p, w, w.map.level + 1);
      const o = w.map.origin, to = this.staticWorld(o.map);
      if (!to || !this.transfer(p, w, to, [o.x, o.y])) return w.reject(p, cmd, "salida ocupada");
      return true;
    }
    if (cmd.t === "dbg" && DEBUG.enabled && (cmd.op === "goto" || cmd.op === "crypt")) return this.debugTravel(p, w, cmd);
    if (cmd.t === "respawn" && w !== this.homeOf(p)) {
      if (!p.dead || w.time - p.deadAt < 1500) return false;
      const home = this.homeOf(p);
      if (!this.transfer(p, w, home, home.home)) return false;
      const ok = respawn(home, p);
      if (ok && activeBall(p) && !activeBall(p).comp.down) spawnCompanion(home, p);
      return ok;
    }
    return w.command(id, cmd);
  }

  // Herramientas de prueba: ir a cualquier mapa exportado o saltar a un nivel de la cripta (sin pasar por las restricciones de viaje)
  debugTravel(p, w, cmd) {
    if (p.dead) return w.reject(p, cmd, "muerto");
    if (cmd.op === "crypt") {
      const level = Math.max(1, Math.min(DUNGEON_LEVELS, Math.floor(Number(cmd.level)) || 1));
      if (!w.npcDb.Skeleton || !hasDungeonPalette()) return w.reject(p, cmd, "faltan los datos de la cripta");
      p.delve = p.delve || { deepest: 1 };
      this.runs = this.runs || new Map();
      if (!this.runs.get(gkey(p))) this.runs.set(gkey(p), { seed: Math.floor((this.options.rng || Math.random)() * 4294967296) >>> 0, origin: { map: w.map.kind === "dungeon" ? "arefarm" : w.map.id, x: w.map.kind === "dungeon" ? 134 : p.x, y: w.map.kind === "dungeon" ? 94 : p.y } });
      else this.runs.get(gkey(p)).seed = Math.floor((this.options.rng || Math.random)() * 4294967296) >>> 0;
      return this.descend(p, w, level, true);
    }
    const to = cmd.map === "arefarm" ? this.farm : this.staticWorld(String(cmd.map || "").toLowerCase());
    if (!to) return w.reject(p, cmd, "mapa no disponible (puede estar cargándose)");
    if (to === w) return true;
    const init = this.maps[to.map.id]?.meta.initial;
    return this.transfer(p, w, to, (init && Object.values(init)[0]) || to.start);
  }

  // Entrada a la cripta desde Aresfarm o middled1n. Con progreso guardado se pregunta: reiniciar (nivel 1) o continuar.
  enterCrypt(p, w, gate, cmd) {
    if (!w.npcDb.Skeleton || !hasDungeonPalette()) return w.reject(p, cmd, "faltan los datos de la cripta; recarga la página");
    const dv = p.delve || (p.delve = { deepest: 1 });
    if (dv.deepest > 1 && typeof cmd.restart !== "boolean") {
      w.emit({ t: "dungeon-choice", id: p.id, deepest: dv.deepest, total: DUNGEON_LEVELS, portal: gate.id });
      return false;
    }
    this.runs = this.runs || new Map();
    const key = gkey(p), live = this.instances.get(key), occupied = !!live && [...live.ents.values()].some(e => e.kind === "player" && e !== p);
    if (cmd.restart === true && !(occupied && p.party)) dv.deepest = 1;     // «reiniciar» no vale si la party ya está dentro: se entra a su cripta (antes se creaba otra y se descartaba la de los compañeros)
    if (live && p.party && (cmd.restart !== true || occupied)) {                  // la party entra siempre a la misma cripta
      const near = live.start || live.map.portals?.[0] || [p.x, p.y];
      if (!this.transfer(p, w, live, Array.isArray(near) ? near : [near.x, near.y])) return w.reject(p, cmd, "entrada ocupada");
      return true;
    }
    this.runs.set(key, { seed: Math.floor((this.options.rng || Math.random)() * 4294967296) >>> 0, origin: { map: w.map.id, x: gate.x, y: gate.y } });
    return this.descend(p, w, Math.min(dv.deepest, DUNGEON_LEVELS), true);
  }

  // Crea el nivel `level` de la partida del jugador y lo traslada allí. El nivel anterior se descarta.
  descend(p, from, level, entering = false) {
    const key = from.map.kind === "dungeon" && from.runKey ? from.runKey : gkey(p);
    const run = this.runs?.get(key);
    if (!run || level > DUNGEON_LEVELS) { if (run && level > DUNGEON_LEVELS) return this.reject(p, from, "no hay más niveles"); return false; }
    const seed = levelSeed(run.seed, level), layout = generateLevel(seed, level);
    const d = new World({ grid: layout.grid, npcDb: from.npcDb, data: from.data, spawns: layout.spawns, start: layout.start, ids: this.ids, rng: this.options.rng || Math.random });
    d.time = this.time;
    d.hooks = this.hooks(d);
    d.evHook = this.farm.evHook;
    d.map = { id: "skeleton-" + (++this.serial), kind: "dungeon", name: "Cripta · nivel " + level + " · " + layout.name, level, total: DUNGEON_LEVELS, boss: layout.boss, theme: layout.theme, seed, version: DUNGEON_VERSION, origin: run.origin, portals: layout.portals };
    d.map.totalEnemies = d.map.remainingEnemies = [...d.ents.values()].filter(e => e.kind === "npc" && !e.comp).length;
    for (const n of d.ents.values()) n.nextAct += this.time;            // los temporizadores usan el reloj de la sesión
    this.worlds.set(d.map.id, d);
    d.runKey = key;
    const group = from.map.kind === "dungeon" ? [...from.ents.values()].filter(e => e.kind === "player") : [p];
    if (!group.includes(p)) group.unshift(p);
    if (!this.transfer(p, from, d, layout.start)) { this.worlds.delete(d.map.id); return from.reject(p, { t: "portal" }, "entrada ocupada"); }
    for (const q of group) if (q !== p) this.transfer(q, from, d, layout.start);
    const previous = this.instances.get(key);
    if (previous && previous !== d) this.worlds.delete(previous.map.id);
    this.instances.set(key, d);
    p.delve.deepest = Math.max(p.delve.deepest, level);
    return true;
  }
  // Una cripta se descarta cuando no queda ningún jugador dentro (la comparte toda la party).
  dropIfEmpty(d) {
    if (!d.runKey || [...d.ents.values()].some(e => e.kind === "player")) return;
    this.worlds.delete(d.map.id);
    if (this.instances.get(d.runKey) === d) { this.instances.delete(d.runKey); this.runs?.delete(d.runKey); }
  }
  reject(p, w, why) { return w.reject(p, { t: "portal" }, why); }

  transfer(p, from, to, near) {
    const spot = to.freeSpotNear(...near);
    if (!spot) return false;
    from.grid.release(p.x, p.y, p.id);
    for (const n of from.ents.values()) if (n.target === p.id) n.target = null;
    from.ents.delete(p.id);
    from.emit({ t: "remove", id: p.id });
    if (from.map.kind === "dungeon" && to.map.kind !== "dungeon") this.dropIfEmpty(from);         // fuera de la cripta: se descarta el nivel si nadie más queda
    p.x = p.fx = spot[0]; p.y = p.fy = spot[1];
    p.act = ACT.STOP; p.actStart = to.time; p.actDur = 0; p.busyUntil = to.time;
    // Mantener el tiempo de acciones/vitales: todos los mundos comparten reloj.
    to.ents.set(p.id, p);
    if (!p.dead) to.grid.occupy(p.x, p.y, p.id);
    this.locations.set(p.id, to);
    to.emit({ t: "mapchange", id: p.id, name: to.map.name, seed: to.map.seed });
    if (activeBall(p) && to.map.kind !== "arena") spawnCompanion(to, p);                      // el compañero elegido te sigue al nuevo mapa
    return true;
  }

  tick(dt) {
    for (const b of this.bots.values()) { Bot.think(this, b); if (b.res) Residents.think(this, b); }
    for (const w of this.worlds.values()) {
      w.tick(dt);
      const dungeon = w.map.kind === "dungeon";
      if (dungeon) w.map.remainingEnemies = [...w.ents.values()].filter(e => e.kind === "npc" && !e.comp && !e.aux && !e.dead).length + (w.ghostsPending || 0);
      if (dungeon && !w.cleared && w.map.remainingEnemies === 0) {
        w.cleared = true;
        for (const p of w.ents.values()) if (p.kind === "player") w.emit({ t: "dungeon-cleared", id: p.id });
      }
    }
    this.time = this.farm.time;
  }

  drainEvents() {
    const out = new Map();
    for (const w of this.worlds.values()) out.set(w.map.id, w.drainEvents());
    return out;
  }
}
