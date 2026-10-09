import { spawnCompanion } from "./systems/npcsys.js";
import { activeBall } from "./systems/companion.js";
// Enruta jugadores entre Aresfarm e instancias privadas. Compartido por Node y navegador.
import { World } from "./world.js";
import { ACT, dist } from "./const.js";
import { DUNGEON_ENTRANCES, FARM_PORTAL, DUNGEON_LEVELS, DUNGEON_VERSION, generateLevel, levelSeed, hasDungeonPalette } from "./dungeon.js";
import { respawn } from "./systems/player.js";
import { populate } from "./systems/citizens.js";

const MAP_NAMES = { aresden: "Aresden", arefarm: "Aresfarm", aresdend1: "Mina de Aresden", arebrk11: "Cuartel de Aresden", arebrk12: "Cuartel de Aresden", arebrk21: "Cuartel de Aresden", arebrk22: "Cuartel de Aresden", wrhus_1: "Almacén", wrhus_1f: "Almacén", arewrhus: "Almacén", cityhall_1: "Ayuntamiento", resurr1: "Templo de resurrección", gshop_1: "Tienda general", gshop_1f: "Tienda general", arejail: "Prisión", cath_1: "Catedral", wzdtwr_1: "Torre del mago", bsmith_1: "Herrería", bsmith_1f: "Herrería", gldhall_1: "Sala del gremio", cmdhall_1: "Sala de mando" };

export class Adventure {
  constructor(options) {
    this.options = options;
    this.ids = { ent: 1, item: 1 };
    this.time = 0;
    this.serial = 0;
    this.locations = new Map();
    this.instances = new Map();             // una cripta por jugador durante la sesión
    this.worlds = new Map();
    this.maps = options.maps || {};          // mapas estáticos de la ciudad: id -> { grid, meta }
    this.farm = new World({ ...options, ids: this.ids, teleports: this.maps.arefarm?.meta.teleports || [] });
    this.farm.map = { id: "arefarm", kind: "farm", name: "Aresfarm", portals: [FARM_PORTAL] };
    this.farm.meta = this.maps.arefarm?.meta;
    this.farm.fixedDay = !!this.farm.meta?.fixedDay;
    this.farm.clock = options.clock || null;
    this.worlds.set(this.farm.map.id, this.farm);
    this.farm.hooks = this.hooks(this.farm);
  }

  // ganchos que el mundo usa para cosas que cruzan mapas (Recall)
  hooks(w) { return { recall: p => this.recall(p, w), teleport: (p, tp) => this.teleport(p, w, tp) }; }

  // Mundo compartido de un mapa estático (ciudad, tiendas...); se crea al entrar el primer jugador.
  staticWorld(id) {
    if (id === "arefarm") return this.farm;
    if (this.worlds.has(id)) return this.worlds.get(id);
    const m = this.maps[id];
    if (!m) return null;
    if (!m.grid) { m.ensure?.().catch(() => {}); return null; }          // rejilla aún sin descargar (carga bajo demanda del cliente)
    m.start = m.start || Object.values(m.meta.initial || {})[0] || [Math.floor(m.grid.w / 2), Math.floor(m.grid.h / 2)];
    const { meta } = m, o = this.options;
    const spawns = (meta.spawns || []).filter(s => s.kind === 1 && o.npcDb[s.name]).map(s => ({ ...s }));
    const w = new World({ grid: m.grid, npcDb: o.npcDb, data: o.data, spawns, start: m.start, ids: this.ids, rng: o.rng || Math.random, teleports: meta.teleports });
    w.time = this.time;
    w.hooks = this.hooks(w);
    w.map = { id, kind: id === "aresden" ? "town" : "indoor", name: MAP_NAMES[id] || id, portals: DUNGEON_ENTRANCES[id] ? [DUNGEON_ENTRANCES[id]] : [] };
    w.meta = meta;
    w.fixedDay = !!meta.fixedDay;
    w.clock = o.clock || null;
    for (const n of w.ents.values()) n.nextAct += this.time;
    populate(w, meta, id);
    this.worlds.set(id, w);
    return w;
  }

  // teleport-loc: destino en otro mapa (o en el mismo); -1,-1 = punto de inicio del mapa destino
  teleport(p, w, tp) {
    const id = tp.map.toLowerCase();
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
    if (w !== this.farm) { this.transfer(p, w, this.farm, this.farm.start); return; }
    const spot = w.freeSpotNear(...w.start);
    if (!spot) return;
    w.grid.release(p.x, p.y, p.id);
    p.x = p.fx = spot[0]; p.y = p.fy = spot[1];
    w.grid.occupy(p.x, p.y, p.id);
    p.act = ACT.STOP; p.actStart = w.time; p.actDur = 0; p.busyUntil = w.time;
    for (const n of w.ents.values()) if (n.target === p.id) n.target = null;
    w.emit({ t: "teleport", id: p.id, x: p.x, y: p.y });
  }

  worldFor(id) { return this.locations.get(id) || this.farm; }
  addPlayer(name, save, create = null) {
    const id = this.farm.addPlayer(name, save, create);
    this.locations.set(id, this.farm);
    return id;
  }
  saveOf(id) { return this.worldFor(id).saveOf(id); }
  removePlayer(id) {
    const w = this.worldFor(id);
    w.removePlayer(id);
    this.locations.delete(id);
    this.dropInstance(id);
  }

  command(id, cmd) {
    const w = this.worldFor(id), p = w.ents.get(id);
    if (!p) return false;
    if (cmd.t === "portal") {
      const gate = w.map.portals.find(g => g.id === cmd.portal);
      if (p.dead || w.busy(p)) return w.reject(p, cmd, "ocupado o muerto");
      if (!gate || dist(p, gate) > 1) return w.reject(p, cmd, "acércate al portal");
      if (w.map.kind !== "dungeon") return this.enterCrypt(p, w, gate, cmd);
      // dentro de la cripta: bajar (solo con el nivel despejado) o salir al mapa de origen
      if (gate.locked && !w.cleared) return w.reject(p, cmd, "mata a todos los esqueletos para continuar");
      if (gate.target === "down") return this.descend(p, w, w.map.level + 1);
      const o = w.map.origin, to = this.staticWorld(o.map);
      if (!to || !this.transfer(p, w, to, [o.x, o.y])) return w.reject(p, cmd, "salida ocupada");
      return true;
    }
    if (cmd.t === "respawn" && w !== this.farm) {
      if (!p.dead || w.time - p.deadAt < 1500) return false;
      if (!this.transfer(p, w, this.farm, this.farm.start)) return false;
      return respawn(this.farm, p);
    }
    return w.command(id, cmd);
  }

  // Entrada a la cripta desde Aresfarm o middled1n. Con progreso guardado se pregunta: reiniciar (nivel 1) o continuar.
  enterCrypt(p, w, gate, cmd) {
    if (!w.npcDb.Skeleton || !hasDungeonPalette()) return w.reject(p, cmd, "faltan los datos de la cripta; recarga la página");
    const dv = p.delve || (p.delve = { deepest: 1 });
    if (dv.deepest > 1 && typeof cmd.restart !== "boolean") {
      w.emit({ t: "dungeon-choice", id: p.id, deepest: dv.deepest, total: DUNGEON_LEVELS, portal: gate.id });
      return false;
    }
    if (cmd.restart === true) dv.deepest = 1;
    this.runs = this.runs || new Map();
    this.runs.set(p.id, { seed: Math.floor((this.options.rng || Math.random)() * 4294967296) >>> 0, origin: { map: w.map.id, x: gate.x, y: gate.y } });
    return this.descend(p, w, Math.min(dv.deepest, DUNGEON_LEVELS), true);
  }

  // Crea el nivel `level` de la partida del jugador y lo traslada allí. El nivel anterior se descarta.
  descend(p, from, level, entering = false) {
    const run = this.runs?.get(p.id);
    if (!run || level > DUNGEON_LEVELS) { if (run && level > DUNGEON_LEVELS) return this.reject(p, from, "no hay más niveles"); return false; }
    const seed = levelSeed(run.seed, level), layout = generateLevel(seed, level);
    const d = new World({ grid: layout.grid, npcDb: from.npcDb, data: from.data, spawns: layout.spawns, start: layout.start, ids: this.ids, rng: this.options.rng || Math.random });
    d.time = this.time;
    d.hooks = this.hooks(d);
    d.map = { id: "skeleton-" + (++this.serial), kind: "dungeon", name: "Cripta · nivel " + level + " · " + layout.name, level, total: DUNGEON_LEVELS, boss: layout.boss, theme: layout.theme, seed, version: DUNGEON_VERSION, origin: run.origin, portals: layout.portals };
    d.map.totalEnemies = d.map.remainingEnemies = [...d.ents.values()].filter(e => e.kind === "npc" && !e.comp).length;
    for (const n of d.ents.values()) n.nextAct += this.time;            // los temporizadores usan el reloj de la sesión
    this.worlds.set(d.map.id, d);
    if (!this.transfer(p, from, d, layout.start)) { this.worlds.delete(d.map.id); return from.reject(p, { t: "portal" }, "entrada ocupada"); }
    const previous = this.instances.get(p.id);
    if (previous) this.worlds.delete(previous.map.id);
    this.instances.set(p.id, d);
    p.delve.deepest = Math.max(p.delve.deepest, level);
    return true;
  }
  dropInstance(id) {
    const d = this.instances.get(id);
    if (d) this.worlds.delete(d.map.id);
    this.instances.delete(id);
    this.runs?.delete(id);
  }
  reject(p, w, why) { return w.reject(p, { t: "portal" }, why); }

  transfer(p, from, to, near) {
    const spot = to.freeSpotNear(...near);
    if (!spot) return false;
    from.grid.release(p.x, p.y, p.id);
    if (from.map.kind === "dungeon" && to.map.kind !== "dungeon") this.dropInstance(p.id);        // fuera de la cripta: se descarta el nivel
    for (const n of from.ents.values()) if (n.target === p.id) n.target = null;
    from.ents.delete(p.id);
    from.emit({ t: "remove", id: p.id });
    p.x = p.fx = spot[0]; p.y = p.fy = spot[1];
    p.act = ACT.STOP; p.actStart = to.time; p.actDur = 0; p.busyUntil = to.time;
    // Mantener el tiempo de acciones/vitales: todos los mundos comparten reloj.
    to.ents.set(p.id, p);
    if (!p.dead) to.grid.occupy(p.x, p.y, p.id);
    this.locations.set(p.id, to);
    to.emit({ t: "mapchange", id: p.id, name: to.map.name, seed: to.map.seed });
    if (activeBall(p)) spawnCompanion(to, p);                      // el compañero elegido te sigue al nuevo mapa
    return true;
  }

  tick(dt) {
    for (const w of this.worlds.values()) {
      w.tick(dt);
      const dungeon = w.map.kind === "dungeon";
      if (dungeon) w.map.remainingEnemies = [...w.ents.values()].filter(e => e.kind === "npc" && !e.comp && !e.dead).length;
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
