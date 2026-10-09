// "Personalidad" del jugador y de los habitantes: frases ocasionales en burbujas de chat.
// Invento propio del port (el original no habla): por eso nunca toca reglas, solo pinta burbujas.
// Sin DOM: se prueba desde Node (tests/voice.test.mjs). El azar es del cliente (no afecta a la simulación).
const ROLE = { 15: "shop", 19: "mage", 20: "warehouse", 24: "blacksmith" };   // shopsys.js NPC
const BUBBLE_MS = 4500;

export function hashStr(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// tono por nombre: w = prudente, j = bromista, d = decidido
export function personaOf(name) { return "wjd"[hashStr(name) % 3]; }

export class Voice {
  constructor({ data, bubbles, pid, lang = () => "es", rng = Math.random, now = () => performance.now() }) {
    this.d = data; this.bubbles = bubbles; this.pid = pid; this.lang = lang; this.rng = rng; this.now = now;
    this.recent = new Map();      // clave -> últimas frases dichas
    this.cool = new Map();        // clave -> instante libre
    this.queue = [];              // respuestas diferidas { at, id, text }
    this.lastAny = -1e9; this.pitSeen = new Map(); this.map = null; this.idleAt = 0; this.tone = "w";
    this.talk = 1;                // 0..2: charlatanería (un parámetro por personaje)
  }
  setPlayer(name) { this.tone = personaOf(name || "x"); this.talk = 0.7 + (hashStr(name || "x") >>> 3) % 7 / 10; }

  text(l) { return this.lang() === "en" ? l.en : l.es; }

  // elige una frase evitando las últimas y prefiriendo el tono del personaje
  pick(list, key) {
    if (!list?.length) return null;
    const rec = this.recent.get(key) || [];
    let pool = list.filter(l => !rec.includes(l.es));
    if (!pool.length) pool = list;
    const mine = pool.filter(l => !l.tone || l.tone.includes(this.tone));
    if (mine.length) pool = mine;
    const l = pool[Math.floor(this.rng() * pool.length)];
    rec.push(l.es); if (rec.length > 3) rec.shift(); this.recent.set(key, rec);
    return l;
  }

  say(id, l, ms = BUBBLE_MS) {
    if (!l) return false;
    this.bubbles.set(id, { text: this.text(l), until: this.now() + ms, voice: id !== this.pid });
    return true;
  }
  // frase del jugador con probabilidad y enfriamiento
  me(list, key, chance = 1, cool = 8000) {
    const t = this.now();
    if (t < (this.cool.get(key) || 0) || t - this.lastAny < 1500) return false;
    if (this.rng() > Math.min(1, chance * this.talk)) return false;
    if (!this.say(this.pid, this.pick(list, "me." + key))) return false;
    this.cool.set(key, t + cool); this.lastAny = t;
    return true;
  }
  reply(npc, list, key, delay = 900) {
    if (!npc || !list?.length) return;
    this.queue.push({ at: this.now() + delay, id: npc.id, l: this.pick(list, "npc." + key + npc.id) });
  }
  roleOf(npc) { return ROLE[npc?.type] || "town"; }
  npcLines(kind, npc) { const g = this.d.npc[kind]; return g && (g[this.roleOf(npc)] || g.town); }

  // al abrir el menú de un habitante: saludo del jugador y respuesta
  noteNpc(npc) {
    const r = this.roleOf(npc), t = this.now();
    if (t < (this.cool.get("greet" + npc.id) || 0)) return;
    this.cool.set("greet" + npc.id, t + 60000);
    if (this.rng() < 0.75) {
      this.say(this.pid, this.pick(this.d.me.greet[r] || this.d.me.greet.town, "me.greet." + r));
      this.reply(npc, this.npcLines("greet", npc), "greet");
    }
  }

  // eventos del servidor; `trader` = último habitante con el que se comerció
  onEvent(ev, world, trader = null) {
    const mine = ev.id === this.pid, me = world.ents?.get(this.pid);
    switch (ev.t) {
      case "purchased": if (mine && this.me(this.d.me.thanks, "thanks", 0.7)) this.reply(trader, this.npcLines("thanks", trader), "thanks"); break;
      case "nogold": if (mine && this.me(this.d.me.nogold, "nogold", 0.9, 5000)) this.reply(trader, this.npcLines("nogold", trader), "nogold"); break;
      case "sold": if (mine && this.me(this.d.me.sold, "sold", 0.6)) this.reply(trader, this.npcLines("sold", trader), "sold"); break;
      case "repaired": if (mine && this.me(this.d.me.repaired, "repaired", 0.7)) this.reply(trader, this.npcLines("repaired", trader), "repaired"); break;
      case "bankfull": case "cantcarry": if (mine) this.me(ev.t === "bankfull" ? this.d.me.bank : this.d.me.bagfull, ev.t, 0.8, 6000); break;
      case "broken": if (mine) this.me(this.d.me.broken, "broken", 0.9, 10000); break;
      case "levelup": if (mine) this.me(this.d.me.levelup, "levelup", 1, 1000); break;
      case "death":
        if (mine) this.me(this.d.me.death, "death", 1, 1000);
        else if (ev.by === this.pid) this.me(this.d.me.kill, "kill", 0.12, 20000);
        break;
      case "damage":
        if (mine && ev.max && ev.hp / ev.max < 0.25 && ev.hp > 0) this.me(this.d.me.lowhp, "lowhp", 0.8, 25000);
        break;
      case "time": if (me) this.me(ev.v === 2 ? this.d.me.night : this.d.me.dawn, "time", 0.5, 60000); break;
      case "weather": if (me && ev.v >= 1) this.me(this.d.me.rain, "rain", 0.5, 90000); break;
    }
  }

  // peligro de un monstruo para el jugador (golpes de dado de vida / vida del jugador)
  danger(cfg, me) { return (cfg?.hitDice || 1) / Math.max(20, (me?.maxHp || 40) / 2.5); }

  // línea sobre los monstruos de un generador cercano
  pitLine(g, cfg, me) {
    const pit = this.d.pit, k = this.danger(cfg, me);
    const by = pit.by_name[g.name];
    const lvl = k < 0.6 ? pit.easy : k < 1.3 ? pit.even : pit.deadly;
    return this.pick(by && this.rng() < 0.6 ? by : lvl, "pit." + g.name);
  }

  // cada fotograma: cola de respuestas, cercanía a pits, mapa nuevo, charla de fondo
  update(world, me, npcDb = {}, adv = {}) {
    const t = this.now();
    if (this.queue.length) {
      const rest = [];
      for (const q of this.queue) if (q.at <= t) this.say(q.id, q.l, 3800); else rest.push(q);
      this.queue = rest;
    }
    if (!me || me.dead) return;
    const mid = world.map?.id || world.map?.name || "?";
    if (mid !== this.map) {
      const dungeon = world.map?.kind === "dungeon";
      this.map = mid; this.pitSeen.clear();
      if (dungeon) setTimeout?.(() => this.me(this.d.me.crypt, "crypt", 0.6, 30000), 1200);
    }
    // pit: entrar en el radio de un generador (rect ampliado) con cierta probabilidad, una vez por visita
    for (const g of world.generators || []) {
      if (!g.rect) continue;
      const [x1, y1, x2, y2] = g.rect, R = 9;
      const inside = me.x >= x1 - R && me.x <= x2 + R && me.y >= y1 - R && me.y <= y2 + R;
      const key = g.name + "@" + x1 + "," + y1;
      if (!inside) { this.pitSeen.delete(key); continue; }
      if (this.pitSeen.has(key)) continue;
      this.pitSeen.set(key, t);
      if (t < (this.cool.get("pit") || 0) || this.rng() > 0.35 * this.talk) continue;
      const l = this.pitLine(g, npcDb[g.name], me);
      if (this.say(this.pid, l)) { this.cool.set("pit", t + 25000); this.lastAny = t; }
      break;
    }
    // charla de fondo
    if (!this.idleAt) this.idleAt = t + 40000;
    if (t > this.idleAt) {
      this.idleAt = t + 50000 + this.rng() * 70000;
      const town = !world.generators?.length;
      const night = world.dayOrNight === 2;
      if (!world.ents) return;
      if (world.map?.kind !== "dungeon") this.me(town ? this.d.me.idle.town : night ? this.d.me.idle.night : this.d.me.idle.day, "idle", 0.7, 30000);
      this.ambient(world, me);
    }
  }

  // un habitante cercano murmura algo
  ambient(world, me) {
    const near = [...world.ents.values()].filter(e => e.kind === "citizen" && Math.abs(e.x - me.x) <= 6 && Math.abs(e.y - me.y) <= 6);
    if (!near.length || this.rng() > 0.5) return;
    const c = near[Math.floor(this.rng() * near.length)];
    this.say(c.id, this.pick(this.npcLines("ambient", c), "amb" + c.id), 4000);
  }
}
