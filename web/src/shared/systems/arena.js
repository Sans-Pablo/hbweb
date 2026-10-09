// Arena de apuestas. INVENTO del port (sin equivalente en el original); usa lo que sí existe: el NPC de ciudad "McGaffin"
// (ficha y sprite de NPC.cfg sin función en el juego base), los compañeros (companion.js, talents.js) y los monstruos de NPC.cfg.
//
//  - El jugador (solo espectador) apuesta oro por su compañero ("a") o por un retador generado ("b").
//  - Al confirmar la apuesta el servidor SIMULA el combate completo con un generador propio (semilla sacada de w.rng); esa simulación
//    decide el resultado y el oro. Después dos gladiadores reales (monstruos de la especie de cada uno) pelean en directo en la arena
//    siguiendo la línea de tiempo de la simulación: golpes, fallos, curas y muerte con las animaciones normales.
//  - Las cuotas salen de repetir la simulación SIMS veces y descontar el margen de la casa (EDGE): esperando, se pierde un poco.
//  - El compañero del jugador no sufre nada (pelea una copia a vida completa): sin heridas, experiencia ni penalización.
//  - La apuesta pendiente viaja con la partida (p.bet): recargar a mitad de combate no sirve para esquivar una derrota.
import * as R from "../rules.js";
import * as Inv from "../inventory.js";
import * as Comp from "./companion.js";
import * as Tal from "./talents.js";
import { ACT, dirTo, dist, mobDurations } from "../const.js";
import { spawnFrom } from "./npcsys.js";
import { greedyStep } from "../path.js";

export const ARENA = {
  npc: "McGaffin", role: "arena", reach: 10,
  rect: [109, 83, 123, 93],           // suelo despejado de Aresfarm, a pocos pasos al oeste de la entrada
  npcAt: [125, 88],
  minBet: 100, edge: 0.10, fightMs: 28000, sims: 600, maxMs: 90000, minOdds: 1.05, maxOdds: 15, history: 8,
};
export const maxBet = p => 500 + 250 * (p.level || 1);

const ROLE_TALENT = { damage: "might", tank: "hide", support: "mind" };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const roleOf = c => Tal.spec(c) || "none";

// ---------------------------------------------------------------- luchadores
// Mismo cálculo que un compañero de verdad (companion.statsOf): el equipo del dueño y los talentos importan.
function fighterOf(w, p, c, key, extra = {}) {
  const st = Comp.statsOf(p, c), cfg = w.npcDb[c.sp], dur = mobDurations(cfg.type);
  const mul = extra.boost || 1;
  return {
    key, sp: c.sp, nm: extra.nm || c.nm || c.sp, lvl: c.lvl, role: roleOf(c), champion: !!extra.champion,
    hp: Math.max(5, Math.round(st.hp * mul)), dmg: Math.max(1, Math.round(st.dmg * mul)),
    period: Math.max(cfg.actionTime, dur.attack, 50), hit: cfg.hitRatio, def: cfg.defenseRatio,
  };
}

// Retador: especie al azar, nivel parecido (a veces un campeón mucho más fuerte) y una rama de talentos; sus estadísticas salen de la misma fórmula.
const FOE_NAMES = ["Garra", "Colmillo", "Sombra", "Trueno", "Ceniza", "Hierro", "Veneno", "Furia"];
function foeOf(w, p, mine) {
  const sps = Object.keys(Comp.SPECIES).filter(s => w.npcDb[s]), sp = sps[Math.floor(w.rng() * sps.length)];
  const champion = w.rng() < 0.08;
  const lvl = clamp(mine.lvl + Math.floor(w.rng() * 9) - 4 + (champion ? 5 : 0), 1, Comp.MAX_COMP_LEVEL);
  const roles = Object.keys(ROLE_TALENT), role = roles[Math.floor(w.rng() * roles.length)];
  const c = { sp, lvl, tal: lvl >= 4 ? { [ROLE_TALENT[role]]: clamp(Math.floor(lvl / 4), 1, 5) } : {} };
  const nm = champion ? "Campeón " + FOE_NAMES[Math.floor(w.rng() * FOE_NAMES.length)] : Comp.randomName(w.rng);
  return fighterOf(w, p, c, "b", { nm, champion, boost: champion ? 1.12 : 1 });
}

// ---------------------------------------------------------------- simulación (sin estado del mundo)
// Devuelve { winner: "a"|"b", ms, events } con events = [{ t, who, hit, dmg }] (golpes) y [{ t, who, heal }] (curas).
export function simulate(a, b, rng) {
  const f = { a: { ...a, cur: a.hp, next: Math.floor(rng() * a.period) }, b: { ...b, cur: b.hp, next: Math.floor(rng() * b.period) } };
  const events = [];
  let nextHeal = 1000;
  for (let t = 0; t <= ARENA.maxMs; t += 50) {
    for (const k of ["a", "b"]) {
      const me = f[k], foe = f[k === "a" ? "b" : "a"];
      if (t < me.next) continue;
      me.next += me.period;
      const hit = R.dice(rng, 1, 100) <= R.hitChance(me.hit, foe.def, false);
      const dmg = hit ? Math.max(1, me.dmg + R.dice(rng, 1, 3) - 2) : 0;
      events.push({ t, who: k, hit, dmg });
      foe.cur -= dmg;
      if (foe.cur <= 0) return { winner: k, ms: t, events };
    }
    if (t >= nextHeal) {                                            // la rama Support se cura un 2 % por segundo
      nextHeal += 1000;
      for (const k of ["a", "b"]) {
        const me = f[k];
        if (me.role !== "support" || me.cur >= me.hp) continue;
        const amt = Math.min(me.hp - me.cur, Math.ceil(me.hp * 0.02));
        me.cur += amt; events.push({ t, who: k, heal: amt });
      }
    }
  }
  const ra = f.a.cur / f.a.hp, rb = f.b.cur / f.b.hp;               // tablas por tiempo: gana quien conserva más vida
  return { winner: ra === rb ? (rng() < 0.5 ? "a" : "b") : ra > rb ? "a" : "b", ms: ARENA.maxMs, events };
}

export function oddsFor(a, b, seed, sims = ARENA.sims) {
  const rng = lcg(seed);
  let wins = 0;
  for (let i = 0; i < sims; i++) if (simulate(a, b, rng).winner === "a") wins++;
  const pa = clamp(wins / sims, 0.04, 0.96), pb = 1 - pa;
  const o = pr => Math.round(clamp((1 - ARENA.edge) / pr, ARENA.minOdds, ARENA.maxOdds) * 100) / 100;
  return { pa, pb, oa: o(pa), ob: o(pb) };
}
function lcg(seed) {                                                // mulberry32 (mismo generador que dungeon.seededRandom, sin importarlo)
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- ofertas y apuestas
const near = (w, p, id) => { const e = w.ents.get(id); return !!e && e.role === ARENA.role && Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= ARENA.reach; };
const pickBall = (w, p, uid) => {
  const ok = i => i.comp && !i.comp.down && w.npcDb[i.comp.sp];
  const b = uid && Inv.instOf(p, uid);
  return b && ok(b) ? b : p.bag.find(i => ok(i) && i.comp.on) || p.bag.find(ok) || null;
};
const view = f => ({ key: f.key, sp: f.sp, nm: f.nm, lvl: f.lvl, role: f.role, hp: f.hp, dmg: f.dmg, champion: f.champion });

// Duración media de ~fightMs: se escala la vida de ambos por igual (el reparto de fuerzas no cambia)
function normalize(a, b, seed) {
  const rng = lcg(seed); let tot = 0; const n = 30;
  for (let i = 0; i < n; i++) tot += simulate(a, b, rng).ms;
  const k = clamp(ARENA.fightMs / Math.max(1000, tot / n), 0.1, 8);
  a.hp = Math.max(5, Math.round(a.hp * k)); b.hp = Math.max(5, Math.round(b.hp * k));
}
// Ajusta la vida del retador (bisección) hasta que la probabilidad de ganar de nuestro compañero se acerque a `target`
function balance(a, b, seed, target) {
  const base = b.hp; let lo = 0.08, hi = 12;
  for (let i = 0; i < 11; i++) {
    const k = Math.sqrt(lo * hi), pa = oddsFor(a, { ...b, hp: Math.max(5, Math.round(base * k)) }, seed, 100).pa;
    if (pa > target) lo = k; else hi = k;                         // retador demasiado flojo: más vida
  }
  b.hp = Math.max(5, Math.round(base * Math.sqrt(lo * hi)));
}

// El cliente pide el combate del día (al abrir el cuadro o al pedir otro retador)
export function info(w, p, cmd) {
  if (!near(w, p, cmd.npc)) return w.reject(p, cmd, "acércate al corredor de apuestas");
  const base = { t: "arenaoffer", id: p.id, min: ARENA.minBet, max: maxBet(p), hist: (p.arenaHist || []).slice(-ARENA.history), busy: !!p.bet };
  const ball = pickBall(w, p, cmd.uid);
  if (!ball) { w.emit({ ...base, none: true, balls: 0 }); return true; }
  const mine = fighterOf(w, p, ball.comp, "a");
  // «vida de arena»: la misma escala para los dos para que el combate dure unos 28 s, y un retador ajustado para que el combate sea parejo
  let foe = null, seed = 0;
  for (let i = 0; i < 4; i++) {                                    // casi nunca hace falta repetir: evita favoritos aplastantes (la casa debe ganar siempre)
    foe = foeOf(w, p, mine); seed = Math.floor(w.rng() * 2 ** 31);
    normalize(mine, foe, seed);
    balance(mine, foe, seed, foe.champion ? 0.25 + w.rng() * 0.15 : 0.35 + w.rng() * 0.3);
    const q = oddsFor(mine, foe, seed, 150).pa;
    if (q > 0.12 && q < 0.88) break;
  }
  const od = oddsFor(mine, foe, Math.floor(w.rng() * 2 ** 31));
  w.arenaSerial = (w.arenaSerial || 0) + 1;
  p.offer = { n: w.arenaSerial, uid: ball.uid, mine, foe, ...od };
  w.emit({ ...base, offer: p.offer.n, uid: ball.uid, a: view(mine), b: view(foe), pa: od.pa, pb: od.pb, oa: od.oa, ob: od.ob,
    balls: p.bag.filter(i => i.comp && !i.comp.down).map(i => ({ uid: i.uid, nm: i.comp.nm || i.comp.sp, sp: i.comp.sp, lvl: i.comp.lvl })) });
  return true;
}

export function bet(w, p, cmd) {
  if (!near(w, p, cmd.npc)) return w.reject(p, cmd, "acércate al corredor de apuestas");
  const o = p.offer;
  if (p.bet || w.bouts?.has(p.id)) return w.reject(p, cmd, "hay un combate en curso");
  if (!o || o.n !== cmd.offer) return w.reject(p, cmd, "esa oferta ya no existe");
  const side = cmd.side === "b" ? "b" : "a", amount = Math.floor(cmd.amount);
  if (!(amount >= ARENA.minBet) || amount > maxBet(p)) return w.reject(p, cmd, "apuesta fuera de límites");
  if (p.gold < amount) { w.emit({ t: "nogold", id: p.id }); return false; }
  const seed = Math.floor(w.rng() * 2 ** 31);
  const sim = simulate(o.mine, o.foe, lcg(seed));                   // el resultado queda fijado aquí
  const win = sim.winner === side, odds = side === "a" ? o.oa : o.ob;
  p.gold -= amount;
  p.bet = { amount, side, win, payout: win ? Math.round(amount * odds) : 0, odds, mine: o.mine.nm, foe: o.foe.nm, ms: sim.ms };
  p.offer = null;
  w.recalc(p);
  startBout(w, p, o, sim);
  w.emit({ t: "arenastart", id: p.id, side, amount, odds, a: view(o.mine), b: view(o.foe) });
  return true;
}

// Cobro: sale de la apuesta fijada (también tras recargar la partida, ver loadSave)
export function settle(w, p, quiet = false) {
  const b = p.bet; if (!b) return;
  p.bet = null;
  p.gold += b.payout;
  (p.arenaHist = p.arenaHist || []).push({ win: b.win, side: b.side, amount: b.amount, net: b.payout - b.amount, a: b.mine, b: b.foe });
  if (p.arenaHist.length > 20) p.arenaHist.shift();
  w.recalc(p);
  w.emit({ t: "arenaend", id: p.id, win: b.win, amount: b.amount, payout: b.payout, net: b.payout - b.amount, a: b.mine, b: b.foe, quiet });
}

// ---------------------------------------------------------------- combate en directo
function spawnGladiator(w, f, x, y, dir) {
  const gen = { name: f.sp, rect: [x - 1, y - 1, x + 1, y + 1], alive: 0, max: 0, respawn: false };
  const n = spawnFrom(w, gen);
  if (!n) return null;
  Object.assign(n, { arena: true, nick: f.nm, clvl: f.lvl, hp: f.hp, maxHp: f.hp, noDrop: true, exp: 0, noDieRemainExp: 0, dir, cfg: { ...n.cfg, actionLimit: 5 }, special: 0 });
  return n;
}
const remove = (w, n) => { if (!n || !w.ents.has(n.id)) return; n.dead = true; w.grid.release(n.x, n.y, n.id); w.ents.delete(n.id); w.emit({ t: "remove", id: n.id }); };

function startBout(w, p, o, sim) {
  (w.bouts || (w.bouts = new Map())).set(p.id, null);
  const [x0, y0, x1, y1] = ARENA.rect, my = Math.floor((y0 + y1) / 2);
  const a = spawnGladiator(w, o.mine, x0 + 4, my, 3), b = spawnGladiator(w, o.foe, x1 - 4, my, 7);
  if (!a || !b) { remove(w, a); remove(w, b); w.bouts.delete(p.id); settle(w, p); return; }       // sin sitio: cobro directo
  w.bouts.set(p.id, { pid: p.id, a, b, f: { a: o.mine, b: o.foe }, sim, ei: 0, phase: "walk", since: w.time, hp: { a: o.mine.hp, b: o.foe.hp } });
}

function strike(w, bout, ev) {
  const att = ev.who === "a" ? bout.a : bout.b, def = ev.who === "a" ? bout.b : bout.a;
  if (!att || !def || att.dead || def.dead) return;
  att.dir = dirTo(att.x, att.y, def.x, def.y);
  w.setAct(att, ACT.ATTACK, att.dur.attack); att.busyUntil = w.time + att.dur.attack;
  w.emit({ t: "attack", id: att.id, target: def.id });
  w.after(att.dur.attack * 0.5, () => {
    if (def.dead || att.dead) return;
    if (!ev.hit) return void w.emit({ t: "miss", id: def.id, from: att.id });
    bout.hp[ev.who === "a" ? "b" : "a"] -= ev.dmg;
    def.hp = Math.max(0, bout.hp[ev.who === "a" ? "b" : "a"]);
    w.emit({ t: "damage", id: def.id, from: att.id, amount: ev.dmg, hp: def.hp, max: def.maxHp });
    if (def.hp > 0 && (!w.busy(def) || def.act === ACT.DAMAGE)) { w.setAct(def, ACT.DAMAGE, def.dur.damage); def.busyUntil = w.time + def.dur.damage; }
  });
}

function finish(w, bout) {
  bout.phase = "end"; bout.endAt = w.time;
  const lose = bout.sim.winner === "a" ? bout.b : bout.a;
  if (lose) { lose.hp = 0; w.setAct(lose, ACT.DYING, lose.dur.dying); w.emit({ t: "death", id: lose.id, by: 0 }); }
  const p = w.ents.get(bout.pid);
  if (p) settle(w, p); else { /* el jugador salió del mapa: se cobra al volver a cargar (p.bet) */ }
  w.after(Math.max(lose?.dur.dying || 0, 1200) + 2500, () => { remove(w, bout.a); remove(w, bout.b); w.bouts?.delete(bout.pid); });
}

export function tickArena(w) {
  if (!w.bouts || !w.bouts.size) return;
  for (const bout of w.bouts.values()) {
    if (!bout || bout.phase === "end") continue;
    const { a, b } = bout;
    if (bout.phase === "walk") {                                      // se acercan hasta quedar a tiro
      const gap = dist(a, b), reach = Math.max(1, Math.min(a.cfg.attackRange, b.cfg.attackRange));
      if (gap <= reach || w.time - bout.since > 9000) {
        if (gap > reach) for (const n of [b]) { const s = w.freeSpotNear(a.x + 1, a.y, 2); if (s) { w.grid.release(n.x, n.y, n.id); n.x = n.fx = s[0]; n.y = n.fy = s[1]; w.grid.occupy(n.x, n.y, n.id); } }
        bout.phase = "fight"; bout.t0 = w.time; continue;
      }
      for (const [n, o] of [[a, b], [b, a]]) {
        if (w.busy(n) || w.time < (n.nextAct || 0)) continue;
        n.nextAct = w.time + n.cfg.actionTime * 0.3;
        const d = greedyStep(w.grid, n, o.x, o.y, dirTo);
        if (d) w.tryStep(n, d, n.dur.move, ACT.MOVE);
      }
      continue;
    }
    const el = w.time - bout.t0, ev = bout.sim.events;
    while (bout.ei < ev.length && ev[bout.ei].t - 0 <= el) {
      const e = ev[bout.ei++];
      if (e.heal) {
        const k = e.who; bout.hp[k] = Math.min(bout.f[k].hp, bout.hp[k] + e.heal);
        const n = k === "a" ? a : b; n.hp = bout.hp[k];
        w.emit({ t: "heal", id: n.id, amount: e.heal, hp: n.hp, max: n.maxHp });
      } else strike(w, bout, e);
    }
    if (bout.ei >= ev.length && el > (ev[ev.length - 1]?.t || 0) + 900) finish(w, bout);
  }
}

// Al cargar la partida con una apuesta pendiente (se cerró el navegador a mitad de combate): se cobra el resultado ya fijado
export function restore(w, p, s) {
  if (Array.isArray(s.arenaHist)) p.arenaHist = s.arenaHist.slice(-20).map(h => ({ win: !!h.win, side: h.side === "b" ? "b" : "a", amount: h.amount | 0, net: h.net | 0, a: String(h.a || "").slice(0, 16), b: String(h.b || "").slice(0, 16) }));
  const b = s.bet;
  if (b && Number.isFinite(b.amount) && Number.isFinite(b.payout)) {
    p.bet = { amount: b.amount | 0, side: b.side === "b" ? "b" : "a", win: !!b.win, payout: Math.max(0, b.payout | 0), odds: +b.odds || 1, mine: String(b.mine || "").slice(0, 16), foe: String(b.foe || "").slice(0, 16), ms: 0 };
    settle(w, p, true);
  }
}
