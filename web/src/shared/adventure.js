// Enruta jugadores entre Aresfarm e instancias privadas. Compartido por Node y navegador.
import { World } from "./world.js";
import { ACT, dist } from "./const.js";
import { FARM_PORTAL, generateDungeon, DUNGEON_VERSION } from "./dungeon.js";
import { respawn } from "./systems/player.js";

export class Adventure {
  constructor(options) {
    this.options = options;
    this.ids = { ent: 1, item: 1 };
    this.time = 0;
    this.serial = 0;
    this.locations = new Map();
    this.worlds = new Map();
    this.farm = new World({ ...options, ids: this.ids });
    this.farm.map = { id: "arefarm", kind: "farm", name: "Aresfarm", portals: [FARM_PORTAL] };
    this.worlds.set(this.farm.map.id, this.farm);
  }

  worldFor(id) { return this.locations.get(id) || this.farm; }
  addPlayer(name, save) {
    const id = this.farm.addPlayer(name, save);
    this.locations.set(id, this.farm);
    return id;
  }
  saveOf(id) { return this.worldFor(id).saveOf(id); }
  removePlayer(id) {
    const w = this.worldFor(id);
    w.removePlayer(id);
    this.locations.delete(id);
    if (w !== this.farm) this.worlds.delete(w.map.id);
  }

  command(id, cmd) {
    const w = this.worldFor(id), p = w.ents.get(id);
    if (!p) return false;
    if (cmd.t === "portal") {
      const gate = w.map.portals.find(g => g.id === cmd.portal);
      if (p.dead || w.busy(p)) return w.reject(p, cmd, "ocupado o muerto");
      if (!gate || dist(p, gate) > 1) return w.reject(p, cmd, "acércate al portal");
      if (w === this.farm) {
        const seed = Math.floor((this.options.rng || Math.random)() * 4294967296) >>> 0;
        const layout = generateDungeon(seed);
        const d = new World({ grid: layout.grid, npcDb: w.npcDb, data: w.data, spawns: layout.spawns, start: layout.start, ids: this.ids, rng: this.options.rng || Math.random });
        d.time = this.time;
        d.map = { id: "skeleton-" + (++this.serial), kind: "dungeon", name: "Cripta de esqueletos", seed, version: DUNGEON_VERSION, portals: layout.portals };
        // Los temporizadores del mundo recién creado usan el reloj de la sesión.
        for (const n of d.ents.values()) n.nextAct += this.time;
        this.worlds.set(d.map.id, d);
        if (!this.transfer(p, w, d, layout.start)) { this.worlds.delete(d.map.id); return w.reject(p, cmd, "entrada ocupada"); }
        return true;
      }
      const ok = this.transfer(p, w, this.farm, [FARM_PORTAL.x, FARM_PORTAL.y]);
      if (!ok) return w.reject(p, cmd, "salida ocupada");
      this.worlds.delete(w.map.id);
      return true;
    }
    if (cmd.t === "respawn" && w !== this.farm) {
      if (!p.dead || w.time - p.deadAt < 1500) return false;
      if (!this.transfer(p, w, this.farm, this.farm.start)) return false;
      this.worlds.delete(w.map.id);
      return respawn(this.farm, p);
    }
    return w.command(id, cmd);
  }

  transfer(p, from, to, near) {
    const spot = to.freeSpotNear(...near);
    if (!spot) return false;
    from.grid.release(p.x, p.y, p.id);
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
    return true;
  }

  tick(dt) {
    for (const w of this.worlds.values()) {
      w.tick(dt);
      if (w !== this.farm && !w.cleared && [...w.ents.values()].every(e => e.kind !== "npc" || e.dead)) {
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
