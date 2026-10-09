// Descarga bajo demanda con cola de prioridad (como hacen los juegos actuales con sus "bundles"):
//  - urgente: lo que hace falta ahora (mapa en el que se entra)         prioridad 2
//  - cercano: destinos de teleport del mapa actual                      prioridad 1
//  - reposo: el resto (sonidos, criptas), solo cuando la cola está vacía  prioridad 0
// Sin duplicados, con máximo de peticiones simultáneas y contadores para la pantalla de carga.
const NEAR = 40;
import { bundleOfWorld, destinations, coreKeys } from "./bundles.js";

export class Streamer {
  constructor(sprites, { audio = null, max = 6 } = {}) {
    this.spr = sprites; this.audio = audio; this.max = max;
    this.queue = [];                    // { key, prio, res }
    this.pending = new Map();           // key -> promesa
    this.active = 0;
    this.done = 0; this.total = 0;
    this.index = new Map();
    this.bundles = new Map();           // id de mapa -> { tiles, mobs, sounds }
    this.warm = new Set();              // mapas ya pedidos
    this.onChange = null;
  }

  // promesa que se cumple cuando la hoja está en memoria (o falló: nunca se rechaza)
  want(key, prio = 1) {
    if (!this.spr.has(key)) return Promise.resolve();
    if (this.spr.ready(key)) return Promise.resolve();
    let p = this.pending.get(key);
    if (p) { const q = this.queue.find(x => x.key === key); if (q && prio > q.prio) q.prio = prio; return p; }
    p = new Promise(res => this.queue.push({ key, prio, res }));
    this.pending.set(key, p); this.total++;
    this.pump();
    return p;
  }
  wantAll(keys, prio = 1) { return Promise.all(keys.map(k => this.want(k, prio))); }

  pump() {
    while (this.active < this.max && this.queue.length) {
      let bi = 0;
      for (let i = 1; i < this.queue.length; i++) if (this.queue[i].prio > this.queue[bi].prio) bi = i;
      const job = this.queue.splice(bi, 1)[0];
      this.active++;
      const fin = () => { this.active--; this.done++; this.pending.delete(job.key); job.res(); this.onChange?.(this); this.pump(); };
      const img = this.spr.img[job.key];                       // el Proxy crea la imagen y empieza a descargar
      if (img.complete) fin();
      else { img.addEventListener("load", fin, { once: true }); img.addEventListener("error", fin, { once: true }); }
    }
  }

  get busy() { return this.queue.length + this.active; }

  // lo que necesita un mundo; se calcula una vez por mapa
  bundle(world, npcDb) {
    const id = world.map?.kind === "dungeon" ? "dungeon" : world.map?.id;
    let b = this.bundles.get(id);
    if (!b) { b = bundleOfWorld(world, this.spr.m, npcDb, this.index); this.bundles.set(id, b); }
    return b;
  }

  // Entrar en un mundo: lo imprescindible primero; devuelve la promesa de losetas + monstruos
  enter(world, npcDb, prio = 2) {
    const b = this.bundle(world, npcDb);
    this.audio?.prefetch?.(b.sounds);
    return this.wantAll([...b.tiles, ...b.mobs], prio);
  }
  // ¿ya está todo el mapa descargado?
  ready(world, npcDb) {
    const b = this.bundle(world, npcDb);
    return b.tiles.every(k => this.spr.ready(k)) && b.mobs.every(k => this.spr.ready(k));
  }
  progress(world, npcDb) {
    const b = this.bundle(world, npcDb), all = b.tiles.length + b.mobs.length;
    if (!all) return 1;
    let n = 0;
    for (const k of b.tiles) if (this.spr.ready(k)) n++;
    for (const k of b.mobs) if (this.spr.ready(k)) n++;
    return n / all;
  }

  // Precarga de los mapas a los que se llega desde aquí (solo los que el nivel permite pisar)
  // Solo cuando el jugador se acerca (NEAR casillas) a un teleport: la granja no baja Aresden hasta que vas hacia el portal.
  prefetchNeighbours(world, adventure, npcDb, level, me = null) {
    for (const id of destinations(world.meta, me, NEAR)) {
      if (this.warm.has(id)) continue;
      const m = adventure.maps?.[id];
      if (!m) continue;
      if (m.meta.levelLimit && level < m.meta.levelLimit) continue;                              // mapa vetado a este nivel (level-limit): no se baja
      if (m.meta.upperLevelLimit && level > m.meta.upperLevelLimit) continue;
      this.warm.add(id);
      Promise.resolve(m.ensure ? m.ensure() : null).then(() => {
        if (!m.grid) return;
        this.enter({ grid: m.grid, generators: [], ents: new Map(), meta: m.meta, map: { id, kind: "static" } }, npcDb, 1);   // mundo ficticio: solo para calcular qué se necesita
      });
    }
  }
}

export { coreKeys };
