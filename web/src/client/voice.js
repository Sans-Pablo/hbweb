// "Personalidad" del jugador y de los habitantes: frases ocasionales en burbujas de chat.
// Invento propio del port (el original no habla): por eso nunca toca reglas, solo pinta burbujas.
// Sin DOM: se prueba desde Node (tests/voice.test.mjs). El azar es del cliente (no afecta a la simulación).
import { sizeStep } from "../shared/systems/companion.js";
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
    this.lastAny = -1e9; this.fearSeen = new Set(); this.pitSeen = new Map(); this.map = null; this.idleAt = 0; this.tone = "w";
    this.talk = 1;                // 0..2: charlatanería (un parámetro por personaje)
  }
  // la personalidad se elige al crear el personaje (create.js); sin ella (partidas antiguas) se deduce del nombre
  setPlayer(name, persona = null) {
    this.tone = persona && "wjd".includes(persona) ? persona : personaOf(name || "x");
    this.talk = { w: 1, j: 1.3, d: 0.8 }[this.tone];       // bromista habla más, decidido menos
  }

  // miedo en la cripta (data.fear, tools/mkvoice_fear.py): etapa 0..4 según el nivel de la cripta; -1 fuera de ella
  fearStage(world) {
    if (world.map?.kind !== "dungeon" || !this.d.fear) return -1;
    const lv = world.map.level || 1;
    return lv <= 3 ? 0 : lv <= 7 ? 1 : lv <= 12 ? 2 : lv <= 17 ? 3 : 4;
  }
  fearLines(world, key, fallback) { const s = this.fearStage(world); return s < 0 ? fallback : this.d.fear[key][s]; }
  // cada ~0,4 s dentro de la cripta: charla de fondo y reacción ante lo que aparece cerca (cada monstruo se comenta una sola vez)
  fear(world, me, fs, t) {
    if (t < (this.fearScan || 0)) return;
    this.fearScan = t + 400;
    const F = this.d.fear;
    if (!this.fearIdleAt) this.fearIdleAt = t + 12000;
    if (t > this.fearIdleAt) { this.fearIdleAt = t + 22000 - 2500 * fs + this.rng() * 20000; this.me(F.idle[fs], "fidle", 0.9, 8000); }
    let boss = null, mon = null, md = 1e9;
    for (const e of world.ents?.values() || []) {
      if (e.kind !== "npc" || e.dead || e.comp || e.arena || e.crystal || e.master || this.fearSeen.has(e.id)) continue;
      const d = Math.max(Math.abs(e.x - me.x), Math.abs(e.y - me.y));
      if (e.boss && !e.aux && d <= 10) boss = e; else if (d <= 6 && d < md) { mon = e; md = d; }
    }
    if (boss) { this.fearSeen.add(boss.id); this.me(F.boss[fs], "fboss", 1, 20000); }
    else if (mon) {
      this.fearSeen.add(mon.id);
      const nm = mon.ghost ? { es: "Fantasma skeleton", en: "Ghost skeleton" } : { es: String(mon.name).replace(/-/g, " "), en: String(mon.name).replace(/-/g, " ") };
      this.me(F.monster[fs], "fmon", 0.9, 14000 - 2000 * fs, nm);
    }
  }

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
  me(list, key, chance = 1, cool = 8000, fill = null) {
    const t = this.now();
    if (t < (this.cool.get(key) || 0) || t - this.lastAny < 1500) return false;
    if (this.rng() > Math.min(1, chance * this.talk)) return false;
    const l = this.pick(list, "me." + key);
    if (!this.say(this.pid, l && fill ? { ...l, es: l.es.replaceAll("{t}", fill.es), en: l.en.replaceAll("{t}", fill.en) } : l)) return false;
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
    this.onPetEvent(ev, world);
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
        else if (ev.by === this.pid) this.me(this.fearLines(world, "kill", this.d.me.kill), "kill", this.fearStage(world) >= 0 ? 0.3 : 0.12, 20000);
        break;
      case "damage":
        if (mine && ev.max && ev.hp / ev.max < 0.25 && ev.hp > 0) this.me(this.fearLines(world, "lowhp", this.d.me.lowhp), "lowhp", 0.8, 25000);
        break;
      case "ghost": {                                                                       // un esqueleto se levanta cerca
        const fs = this.fearStage(world);
        if (fs >= 0 && me && Math.max(Math.abs(ev.x - me.x), Math.abs(ev.y - me.y)) <= 9) this.me(this.d.fear.ghost[fs], "fghost", 0.9, 12000);
        break;
      }
      case "time": if (me) this.me(ev.v === 2 ? this.d.me.night : this.d.me.dawn, "time", 0.5, 60000); break;
      case "weather": if (me && ev.v >= 1) this.me(this.d.me.rain, "rain", 0.5, 90000); break;
    }
  }

  // ---- diálogos con la mascota (data.companion): el compañero habla con el sonido de su especie y el personaje le contesta
  // solo se habla con el compañero cuando está cerca del personaje (8 casillas)
  petOf(world) {
    const me = world.ents?.get(this.pid);
    for (const e of world.ents?.values() || []) if (e.comp && e.master === this.pid && !e.dead) return me && Math.max(Math.abs(e.x - me.x), Math.abs(e.y - me.y)) <= 8 ? e : null;
    return null;
  }
  // a veces el personaje llama al compañero por su nombre
  callName(pet, l) {
    if (!l || !pet.nick || this.rng() > 0.35) return l;
    const low = s => s && s[0] ? s[0].toLowerCase() + s.slice(1) : s;
    return { ...l, es: pet.nick + ", " + low(l.es), en: pet.nick + ", " + low(l.en) };
  }
  petLine(pet, l) { const n = this.d.companion?.noise?.[pet.name]; return l && n ? { ...l, es: n.es + " " + l.es, en: n.en + " " + l.en } : l; }
  // el personaje dice `me` y el compañero contesta (o al revés si first = "pet"), con probabilidad y pausa propias
  talkPet(world, set, key, { chance = 0.8, cool = 15000, first = "me", gap = 1100, list = null, fill = null } = {}) {
    const pet = this.petOf(world), t = this.now(), c = this.d.companion, src = list || c?.[set];
    if (pet?.dcls) return false;                                                  // el Dummy no habla
    if (!pet || !src || t < (this.cool.get("pet." + key) || 0) || this.rng() > Math.min(1, chance * this.talk)) return false;
    this.cool.set("pet." + key, t + cool);
    const ex = Array.isArray(src) ? src[Math.floor(this.rng() * src.length)] : src;
    const f = l => l && fill ? { ...l, es: l.es.replaceAll("{t}", fill.es), en: l.en.replaceAll("{t}", fill.en) } : l;
    const meL = f(this.callName(pet, Array.isArray(ex.me) ? this.pick(ex.me, "pme." + key) : ex.me)), petL = f(this.petLine(pet, Array.isArray(ex.pet) ? this.pick(ex.pet, "ppet." + key) : ex.pet));
    const a = first === "me" ? { id: this.pid, l: meL } : { id: pet.id, l: petL }, b = first === "me" ? { id: pet.id, l: petL } : { id: this.pid, l: meL };
    this.say(a.id, a.l); this.lastAny = t;
    this.queue.push({ at: t + gap, id: b.id, l: b.l });
    return true;
  }
  onPetEvent(ev, world) {
    const pet = this.petOf(world);
    switch (ev.t) {
      case "companion": if (ev.id !== this.pid) break;
        if (ev.on) this.talkPet(world, "summon", "summon", { chance: 0.85, cool: 4000 });
        else if (ev.fainted) this.me(this.d.companion.faint.me, "pfaint", 0.9, 4000);
        else this.me(this.d.companion.dismiss.me, "pdismiss", 0.6, 4000);
        break;
      case "companion-lvl": if (ev.id === this.pid) {
        const ms = this.d.companion.milestone?.[ev.lvl];                                  // niveles 10, 25, 40 y 50: frase propia
        if (ms) this.talkPet(world, "milestone", "pmile", { chance: 1, cool: 0, first: "pet", list: [ms] });
        else this.talkPet(world, "levelup", "plvl", { chance: 1, cool: 2000, first: "pet" });
      } break;
      case "companion-resummon": if (ev.id === this.pid) {                              // cambio de tamaño: al reaparecer, frase propia de la etapa
        const st = this.d.companion.evolve?.[sizeStep(ev.lvl)];
        if (st) setTimeout(() => this.talkPet(world, "evolve", "pevo", { chance: 1, cool: 0, first: "me", list: [st] }), 900);
      } break;
      case "pettarget": if (ev.id === this.pid) {                                        // Alt + clic: el personaje da la orden y el compañero responde
        const tn = ev.tn || "", nm = tn === "Fantasma skeleton" ? { es: "Fantasma skeleton", en: "Ghost skeleton" } : { es: tn.replace(/-/g, " "), en: tn.replace(/-/g, " ") };
        const fs = this.fearStage(world);
        this.talkPet(world, "attack", "patk", { chance: 1, cool: 1500, fill: nm, list: fs >= 0 ? this.d.fear.attack[fs] : null });
      } break;
      case "death": if (pet && ev.by === pet.id) this.talkPet(world, "kill", "pkill", { chance: 0.18, cool: 25000, first: "pet" }); break;
      case "dummy-agro": if (ev.id === this.pid && pet) this.say(pet.id, { es: "¡Me atacan!", en: "I'm targeted!" }, 2500); break;
      case "dummy-cast": if (ev.id === this.pid) this.say(ev.nid, { es: ev.txt, en: ev.txt }, 1800); break;
      case "damage": if (pet && ev.id === pet.id) {
        if (ev.max && ev.hp / ev.max < 0.3 && ev.hp > 0) this.talkPet(world, "lowhp", "plow", { chance: 0.8, cool: 20000, first: "pet" });
        else if (this.rng() < 0.08) this.talkPet(world, "hurt", "phurt", { chance: 1, cool: 30000, first: "me" });
      } break;
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
      this.map = mid; this.pitSeen.clear(); this.fearSeen.clear(); this.fearIdleAt = 0;
      if (dungeon) setTimeout?.(() => this.me(this.fearLines(world, "enter", this.d.me.crypt), "crypt", 0.9, 3000), 1200);
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
    const fs = this.fearStage(world);
    if (fs >= 0) this.fear(world, me, fs, t);
    // charla con la mascota cada 35–80 s si está cerca (en la cripta, cada 22–47 s y asustados)
    if (!this.petChatAt) this.petChatAt = t + 30000;
    if (t > this.petChatAt) {
      this.petChatAt = t + (fs >= 0 ? 22000 + this.rng() * 25000 : 35000 + this.rng() * 45000);
      if (fs >= 0 && this.rng() < 0.75) { this.talkPet(world, "fear", "pfear", { chance: 0.95, cool: 12000, list: this.d.fear.chat[fs] }); return; }
      // charla general, según la etapa (baby 1-9, young 10-24, veteran 25-39, elite 40+) o según la especie
      const pet = this.petOf(world), c = this.d.companion, r = this.rng();
      const lv = pet && pet.clvl || 1, st = lv >= 40 ? "elite" : lv >= 25 ? "veteran" : lv >= 10 ? "young" : "baby";
      const sp = pet && c.species?.[pet.name];
      if (r < 0.3 && c.stage?.[st]) this.talkPet(world, "stage", "pstage", { chance: 0.9, cool: 20000, list: c.stage[st] });
      else if (r < 0.5 && sp) this.talkPet(world, "species", "pspec", { chance: 0.9, cool: 20000, list: sp });
      else this.talkPet(world, "chat", "pchat", { chance: 0.8, cool: 20000 });
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
