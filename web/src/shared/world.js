// Simulación del juego: el papel del servidor (HGServer). No sabe nada de dibujo ni del
// navegador, así que el mismo archivo podrá correr en Node como servidor de verdad.
//
// El cliente le manda órdenes (`command`) y lee el estado y los eventos. Las órdenes son
// las mismas que el protocolo original: un paso, un golpe, recoger, usar objeto...
// y el mundo las valida igual que el servidor (tiempos mínimos, casilla libre, distancia).
import { ACT, DX, DY, LIMITS, PLAYER, CORPSE_MS, ITEM_LIFETIME_MS, CHASE_LIMIT, dirTo, dist, mobDurations } from "./const.js";
import * as R from "./rules.js";
import { greedyStep } from "./path.js";

const HP_REGEN_MS = 15000;      // DEF_HPUPTIME

export class World {
  constructor({ grid, npcDb, spawns = [], rng = Math.random, start }) {
    this.grid = grid;
    this.npcDb = npcDb;
    this.rng = rng;
    this.start = start;
    this.time = 0;
    this.ents = new Map();
    this.items = new Map();          // índice de casilla -> [{uid, kind, count, until}]
    this.events = [];
    this.timers = [];
    this.nextId = 1;
    this.nextItem = 1;
    this.generators = spawns.map(s => ({ ...s, alive: 0 }));
    for (const g of this.generators) for (let i = 0; i < g.max; i++) this.spawnFrom(g);
  }

  // ------------------------------------------------------------------ utilidades
  emit(ev) { ev.time = this.time; this.events.push(ev); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  after(ms, fn) { this.timers.push({ at: this.time + ms, fn }); }
  setAct(e, act, dur) { e.act = act; e.actStart = this.time; e.actDur = dur; }
  busy(e) { return this.time < e.busyUntil; }

  makeEnt(kind, x, y) {
    const e = {
      id: this.nextId++, kind, x, y, fx: x, fy: y, dir: 5,
      act: ACT.STOP, actStart: this.time, actDur: 0, busyUntil: 0, dead: false,
    };
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

  // ------------------------------------------------------------------ jugadores
  // save: datos guardados de una sesión anterior (saveOf), para conservar el progreso
  addPlayer(name, save = null) {
    const [x, y] = this.freeSpotNear(this.start[0], this.start[1]);
    const e = this.makeEnt("player", x, y);
    Object.assign(e, {
      name,
      // personaje nuevo: 70 puntos repartidos (mínimo 10 en cada atributo)
      stats: { str: 14, vit: 12, dex: 14, int: 10, mag: 10, chr: 10 },
      level: 1, exp: R.expForLevel(1), pool: 0,
      skills: { 5: 20, 7: 20 },               // ataque sin armas y espada corta
      weapon: R.DAGGER,
      gold: 0, inv: { red: 3, bigred: 0, blue: 1, green: 0 },
      lastMove: -1e9, lastAttack: -1e9, lastCombat: -1e9, lastRegen: 0, kills: 0, deadAt: 0,
    });
    if (save) {
      for (const k of ["level", "exp", "pool", "gold", "kills"]) if (Number.isFinite(save[k])) e[k] = save[k];
      if (save.stats) for (const k in e.stats) if (Number.isFinite(save.stats[k])) e.stats[k] = save.stats[k];
      if (save.inv) for (const k in e.inv) if (Number.isFinite(save.inv[k])) e.inv[k] = save.inv[k];
    }
    this.recalc(e);
    e.hp = e.maxHp; e.mp = e.maxMp;
    this.emit({ t: "spawn", id: e.id });
    return e.id;
  }

  // lo que se guarda de un personaje entre sesiones
  saveOf(id) {
    const p = this.ents.get(id);
    if (!p || p.kind !== "player") return null;
    return { level: p.level, exp: p.exp, pool: p.pool, gold: p.gold, kills: p.kills, stats: { ...p.stats }, inv: { ...p.inv } };
  }

  removePlayer(id) {
    const p = this.ents.get(id);
    if (!p || p.kind !== "player") return;
    if (!p.dead) this.grid.release(p.x, p.y, p.id);
    for (const n of this.ents.values()) if (n.target === id) n.target = null;
    this.ents.delete(id);
    this.emit({ t: "remove", id });
  }

  charOf(p) { return { ...p.stats, level: p.level, skills: p.skills }; }

  recalc(p) {
    const c = this.charOf(p);
    p.maxHp = R.maxHP(c); p.maxMp = R.maxMP(c); p.maxSp = R.maxSP(c);
    p.defense = R.defenseRatio(c);
    p.nextExp = R.expForLevel(p.level + 1);
    p.prevExp = R.expForLevel(p.level);
    if (p.hp > p.maxHp) p.hp = p.maxHp;
  }

  reject(p, cmd, why) { this.emit({ t: "reject", id: p.id, cmd: cmd.t, why }); return false; }

  // Órdenes del cliente (en red serán los mensajes MOTION/COMMAND del protocolo)
  command(id, cmd) {
    const p = this.ents.get(id);
    if (!p || p.kind !== "player") return false;
    if (cmd.t === "respawn") return this.respawn(p);
    if (cmd.t === "say") {
      const text = String(cmd.text || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120);
      if (text) this.emit({ t: "chat", id: p.id, name: p.name, text });
      return !!text;
    }
    if (p.dead) return this.reject(p, cmd, "muerto");

    switch (cmd.t) {
      case "move": {
        if (this.busy(p)) return this.reject(p, cmd, "ocupado");
        if (this.time - p.lastMove < LIMITS.moveMs) return this.reject(p, cmd, "demasiado rápido");
        const run = !!cmd.run;
        if (!this.tryStep(p, cmd.dir, run ? PLAYER.runMs : PLAYER.walkMs, run ? ACT.RUN : ACT.MOVE))
          return this.reject(p, cmd, "bloqueado");
        p.lastMove = this.time;
        return true;
      }
      case "turn": {
        if (!this.busy(p) && cmd.dir >= 1 && cmd.dir <= 8) p.dir = cmd.dir;
        return true;
      }
      case "attack": {
        const t = this.ents.get(cmd.target);
        if (!t || t.dead || t.kind !== "npc") return this.reject(p, cmd, "sin objetivo");
        if (this.busy(p)) return this.reject(p, cmd, "ocupado");
        if (this.time - p.lastAttack < PLAYER.attackCooldownMs) return this.reject(p, cmd, "demasiado rápido");
        if (dist(p, t) > 1) return this.reject(p, cmd, "lejos");
        p.dir = dirTo(p.x, p.y, t.x, t.y);
        this.setAct(p, ACT.ATTACK, PLAYER.attackMs);
        p.busyUntil = this.time + PLAYER.attackMs;
        p.lastAttack = p.lastCombat = this.time;
        this.emit({ t: "attack", id: p.id, target: t.id });
        this.after(PLAYER.attackMs * PLAYER.attackHitAt, () => this.playerHit(p, t));
        return true;
      }
      case "pickup": {
        if (this.busy(p)) return this.reject(p, cmd, "ocupado");
        const list = this.items.get(this.grid.idx(p.x, p.y));
        if (!list || !list.length) return this.reject(p, cmd, "nada que recoger");
        this.setAct(p, ACT.GETITEM, PLAYER.getItemMs);
        p.busyUntil = this.time + PLAYER.getItemMs;
        this.after(PLAYER.getItemMs, () => this.takeItem(p));
        return true;
      }
      case "use": {
        const kind = cmd.item;
        if (!R.ITEMS[kind] || !R.ITEMS[kind].effect || !(p.inv[kind] > 0)) return this.reject(p, cmd, "no tienes");
        p.inv[kind]--;
        const amount = R.potionAmount(this.rng, kind), eff = R.ITEMS[kind].effect;
        if (eff === "hp") p.hp = Math.min(p.maxHp, p.hp + amount);
        if (eff === "mp") p.mp = Math.min(p.maxMp, p.mp + amount);
        this.emit({ t: "use", id: p.id, item: kind, amount, stat: eff });
        return true;
      }
      case "stat": {
        if (p.pool <= 0 || !(cmd.stat in p.stats) || p.stats[cmd.stat] >= R.STAT_LIMIT) return this.reject(p, cmd, "sin puntos");
        p.stats[cmd.stat]++;
        p.pool--;
        this.recalc(p);
        this.emit({ t: "stats", id: p.id });
        return true;
      }
    }
    return false;
  }

  playerHit(p, t) {
    if (p.dead || t.dead || dist(p, t) > 1) { this.emit({ t: "miss", id: t.id, from: p.id }); return; }
    const { damage, hitRatio } = R.playerMelee(this.rng, this.charOf(p), p.weapon);
    const chance = R.hitChance(hitRatio, t.cfg.defenseRatio, p.dir === t.dir);
    if (R.dice(this.rng, 1, 100) > chance) { this.emit({ t: "miss", id: t.id, from: p.id }); return; }
    let dmg = damage;
    if (t.absDamage < 0) dmg = Math.max(1, dmg - Math.floor(dmg * -t.absDamage / 100));
    this.damageNpc(t, dmg, p);
  }

  takeItem(p) {
    const k = this.grid.idx(p.x, p.y), list = this.items.get(k);
    if (!list || !list.length) return;
    const it = list.pop();
    if (!list.length) this.items.delete(k);
    if (it.kind === "gold") p.gold += it.count;
    else p.inv[it.kind] = (p.inv[it.kind] || 0) + it.count;
    this.emit({ t: "pickup", id: p.id, item: it.kind, count: it.count, x: p.x, y: p.y });
  }

  giveExp(p, amount) {
    if (amount <= 0) return;
    p.exp += amount;
    this.emit({ t: "exp", id: p.id, amount });
    while (p.exp >= p.nextExp && p.level < 180) {          // bCheckLevelUp
      p.level++;
      p.pool += R.LEVELUP_POINTS;
      this.recalc(p);
      this.emit({ t: "levelup", id: p.id, level: p.level });
    }
  }

  damagePlayer(p, dmg, from) {
    p.hp -= dmg;
    p.lastCombat = this.time;
    this.emit({ t: "damage", id: p.id, from: from.id, amount: dmg, hp: Math.max(0, p.hp), max: p.maxHp });
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      p.deadAt = this.time;
      this.setAct(p, ACT.DYING, PLAYER.dyingMs);
      this.grid.release(p.x, p.y, p.id);
      this.emit({ t: "death", id: p.id, by: from.id });
      return;
    }
    if (!this.busy(p) || p.act === ACT.DAMAGE) {
      this.setAct(p, ACT.DAMAGE, PLAYER.damageMs);
      p.busyUntil = this.time + PLAYER.damageMs;
    }
  }

  respawn(p) {
    if (!p.dead || this.time - p.deadAt < 1500) return false;
    const [x, y] = this.freeSpotNear(this.start[0], this.start[1]);
    p.x = p.fx = x; p.y = p.fy = y;
    this.grid.occupy(x, y, p.id);
    p.dead = false;
    p.hp = p.maxHp; p.mp = p.maxMp;
    this.setAct(p, ACT.STOP, 0);
    p.busyUntil = 0;
    this.emit({ t: "respawn", id: p.id });
    return true;
  }

  // ------------------------------------------------------------------ monstruos
  spawnFrom(g) {
    const cfg = this.npcDb[g.name];
    if (!cfg) return null;
    const [x1, y1, x2, y2] = g.rect;
    for (let tries = 0; tries < 60; tries++) {
      const x = x1 + Math.floor(this.rng() * (x2 - x1 + 1)), y = y1 + Math.floor(this.rng() * (y2 - y1 + 1));
      if (!this.grid.free(x, y)) continue;
      const n = this.makeEnt("npc", x, y);
      Object.assign(n, {
        name: g.name, type: cfg.type, cfg, gen: g, dur: mobDurations(cfg.type),
        dir: 1 + Math.floor(this.rng() * 8),
        hp: R.npcHP(this.rng, cfg.hitDice), exp: R.npcExp(this.rng, cfg), absDamage: cfg.absDamage,
        target: null, nextAct: this.time + this.rng() * cfg.actionTime, phase: this.rng() * 1000,
        special: 0,
      });
      if (g.specialProb && R.dice(this.rng, 1, 100) <= g.specialProb) {
        n.special = g.specialKind;
        R.applySpecial(this.rng, n, g.specialKind);
      }
      n.maxHp = n.hp;
      n.noDieRemainExp = n.exp - Math.floor(n.exp / 3);
      g.alive++;
      this.emit({ t: "spawn", id: n.id });
      return n;
    }
    return null;
  }

  damageNpc(n, dmg, p) {
    n.hp -= dmg;
    p.lastCombat = this.time;
    this.emit({ t: "damage", id: n.id, from: p.id, amount: dmg, hp: Math.max(0, n.hp), max: n.maxHp });
    // experiencia por golpe: el daño hecho, hasta agotar los 2/3 de la experiencia del monstruo
    if (n.noDieRemainExp > 0) {
      const gain = Math.min(dmg, n.noDieRemainExp);
      n.noDieRemainExp -= gain;
      this.giveExp(p, gain);
    }
    if (n.hp <= 0) return this.killNpc(n, p);
    // reacción: se gira hacia el atacante; 1 de cada 3 golpes le hace perder su turno
    if (!n.target || R.dice(this.rng, 1, 3) === 2) n.target = p.id;
    if (R.dice(this.rng, 1, 3) === 2 && !n.cfg.actionLimit) n.nextAct = this.time + n.cfg.actionTime;
    if (!this.busy(n) || n.act === ACT.DAMAGE) {
      this.setAct(n, ACT.DAMAGE, n.dur.damage);
      n.busyUntil = this.time + n.dur.damage;
    }
  }

  killNpc(n, p) {
    n.hp = 0;
    n.dead = true;
    this.setAct(n, ACT.DYING, n.dur.dying);
    this.grid.release(n.x, n.y, n.id);
    p.kills++;
    this.emit({ t: "death", id: n.id, by: p.id });
    this.giveExp(p, Math.floor(n.exp / 3) + n.noDieRemainExp);    // NpcKilledHandler
    n.noDieRemainExp = 0;
    const drop = R.rollDrop(this.rng, n.cfg);
    if (drop) this.after(n.dur.dying * 0.6, () => this.dropItem(n.x, n.y, drop));
    n.gen.alive--;
    this.after(n.cfg.regenTime, () => { if (n.gen.alive < n.gen.max) this.spawnFrom(n.gen); });
    this.after(n.dur.dying + CORPSE_MS, () => { this.ents.delete(n.id); this.emit({ t: "remove", id: n.id }); });
  }

  dropItem(x, y, drop) {
    const k = this.grid.idx(x, y);
    if (!this.items.has(k)) this.items.set(k, []);
    const it = { uid: this.nextItem++, kind: drop.kind, count: drop.count, until: this.time + ITEM_LIFETIME_MS, x, y };
    this.items.get(k).push(it);
    this.emit({ t: "drop", x, y, item: it.kind, count: it.count });
  }

  npcThink(n) {
    if (n.dead || this.time < n.nextAct || this.busy(n)) return;
    n.nextAct = this.time + n.cfg.actionTime;
    let t = n.target ? this.ents.get(n.target) : null;
    if (t && (t.dead || dist(n, t) > CHASE_LIMIT)) { n.target = null; t = null; }
    if (!t) {
      for (const e of this.ents.values())
        if (e.kind === "player" && !e.dead && dist(n, e) <= n.cfg.searchRange) { t = e; n.target = e.id; break; }
    }
    if (t) {
      if (dist(n, t) <= n.cfg.attackRange) return this.npcAttack(n, t);
      const d = greedyStep(this.grid, n, t.x, t.y, dirTo);
      if (d) this.tryStep(n, d, n.dur.move, ACT.MOVE);
      return;
    }
    // sin objetivo: pasea dentro de su zona
    if (this.rng() < 0.35) {
      const d = 1 + Math.floor(this.rng() * 8), nx = n.x + DX[d], ny = n.y + DY[d];
      const [x1, y1, x2, y2] = n.gen.rect;
      if (nx >= x1 - 2 && nx <= x2 + 2 && ny >= y1 - 2 && ny <= y2 + 2) this.tryStep(n, d, n.dur.move, ACT.MOVE);
      else n.dir = d;
    }
  }

  npcAttack(n, t) {
    n.dir = dirTo(n.x, n.y, t.x, t.y);
    this.setAct(n, ACT.ATTACK, n.dur.attack);
    n.busyUntil = this.time + n.dur.attack;
    this.emit({ t: "attack", id: n.id, target: t.id });
    this.after(n.dur.attack * 0.5, () => {
      if (n.dead || t.dead || dist(n, t) > n.cfg.attackRange) { this.emit({ t: "miss", id: t.id, from: n.id }); return; }
      const { damage, hitRatio } = R.npcMelee(this.rng, n);
      const chance = R.hitChance(hitRatio, t.defense, n.dir === t.dir);
      if (R.dice(this.rng, 1, 100) > chance) { this.emit({ t: "miss", id: t.id, from: n.id }); return; }
      const dmg = R.absorbOnPlayer(this.rng, damage, t.stats);
      if (dmg <= 0) { this.emit({ t: "miss", id: t.id, from: n.id }); return; }
      this.damagePlayer(t, dmg, n);
    });
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
        if (e.kind === "npc") this.npcThink(e);
        else if (!e.dead && this.time - e.lastRegen >= HP_REGEN_MS) {     // TimeHitPointsUp
          e.lastRegen = this.time;
          if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + Math.max(R.dice(this.rng, 1, e.stats.vit), e.stats.vit >> 1));
          if (e.mp < e.maxMp) e.mp = Math.min(e.maxMp, e.mp + Math.max(R.dice(this.rng, 1, e.stats.mag), e.stats.mag >> 1));
        }
      }
    }
    // objetos caducados
    for (const [k, list] of this.items) {
      const keep = list.filter(it => it.until > this.time);
      if (keep.length !== list.length) { if (keep.length) this.items.set(k, keep); else this.items.delete(k); }
    }
  }
}
