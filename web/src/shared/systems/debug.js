// Herramientas de prueba (F1 → «Herramientas»). INVENTO del port: no existen en el original. Solo funcionan con DEBUG.enabled
// (activado en la build de pruebas; el servidor real las apaga salvo con HB_DEBUG=1). Cada orden es `{t:"dbg", op, ...}`.
import { giveExp, MAX_LEVEL } from "./combatsys.js";
import { newInst } from "./itemsys.js";
import { spawnFrom, killNpc } from "./npcsys.js";
import * as Inv from "../inventory.js";
import * as R from "../rules.js";
import { SKILL_NAMES } from "../skills.js";
import * as Comp from "./companion.js";
import * as Tal from "./talents.js";

export const DEBUG = { enabled: true };

const num = (v, lo, hi, d = lo) => { v = Math.floor(Number(v)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const say = (w, p, msg) => w.emit({ t: "dbg", id: p.id, msg });
const ball = p => Comp.activeBall(p) || p.bag.find(i => i.comp);

const OPS = {
  // ---- personaje
  level(w, p, c) {
    const n = num(c.n, 1, MAX_LEVEL), old = p.level;
    p.level = n; p.exp = R.expForLevel(n);
    if (n > old) p.pool += (n - old) * R.LEVELUP_POINTS;
    w.recalc(p); p.hp = p.maxHp; p.mp = p.maxMp; p.sp = p.maxSp;
    w.emit({ t: "levelup", id: p.id, level: n });
    say(w, p, "Level " + n);
  },
  exp(w, p, c) { giveExp(w, p, num(c.n, 1, 1e9)); say(w, p, "+" + num(c.n, 1, 1e9) + " experience"); },
  gold(w, p, c) { p.gold = Math.max(0, p.gold + num(c.n, -1e9, 1e9, 0)); say(w, p, "Gold: " + p.gold); },
  points(w, p, c) { p.pool += num(c.n, 0, 1000, 0); say(w, p, "Points to assign: " + p.pool); },
  stat(w, p, c) { if (!(c.key in p.stats)) return; p.stats[c.key] = num(c.n, 1, 500, 10); w.recalc(p); say(w, p, c.key + " = " + p.stats[c.key]); },
  heal(w, p) { p.hp = p.maxHp; p.mp = p.maxMp; p.sp = p.maxSp; p.hunger = 100; say(w, p, "HP, MP, SP and hunger full"); },
  god(w, p) { p.god = !p.god; say(w, p, p.god ? "Invulnerable: on" : "Invulnerable: off"); },
  skills(w, p, c) { const n = num(c.n, 0, 100, 50); for (const k of Object.keys(SKILL_NAMES)) p.skills[k] = n; w.recalc(p); say(w, p, "All skills set to " + n); },
  // ---- objetos
  give(w, p, c) {
    const d = c.name ? w.data.named(String(c.name)) : w.data.item(num(c.id, 0, 99999)), n = num(c.count, 1, 10000, 1);
    if (!d) return say(w, p, "No such item");
    const inst = newInst(w, d.id, n, c.color ? { color: num(c.color, 0, 15, 0) } : null);
    Inv.addToBag(p, w.data, inst); w.recalc(p);
    w.emit({ t: "pickup", id: p.id, item: d.id, count: n });
    say(w, p, "You receive " + n + " × " + d.name);
  },
  // ---- bots (jugadores simulados, systems/bot.js)
  bot(w, p, c) { const r = w.hooks?.bot?.(p, { op: "bot", n: c.n, level: num(c.level, 1, 150, 1), solo: !!c.solo }); say(w, p, r ? (Array.isArray(r) ? r.length + " bot(s): " + r.map(b => b.name).join(", ") : "ok") : "Bots not available here"); },
  botclear(w, p) { const n = w.hooks?.bot?.(p, { op: "botclear" }); say(w, p, (n || 0) + " bot(s) removed"); },
  // ---- enemigos
  spawn(w, p, c) {
    const name = String(c.name || ""), n = num(c.count, 1, 30, 1);
    if (!w.npcDb[name]) return say(w, p, "No such monster: " + name);
    const gen = { name, rect: [p.x - 4, p.y - 4, p.x + 4, p.y + 4], alive: 0, max: 0, respawn: false };
    const m = Math.max(0.1, Math.min(50, Number(c.mult) || 1));
    if (m !== 1) gen.scale = { hp: m, dmg: Math.max(1, m / 3), exp: m };
    if (c.boss) gen.boss = num(c.boss, 1, 4);
    let made = 0;
    for (let i = 0; i < n; i++) {
      const g = { ...gen, rect: [p.x - 4 + (i % 3), p.y - 4 + ((i / 3) | 0) % 3, p.x + 4, p.y + 4] };
      if (spawnFrom(w, g)) made++;
    }
    say(w, p, made + " × " + name + (c.boss ? " (boss " + c.boss + ")" : ""));
  },
  // pone la vida del jefe más cercano a un % para provocar sus fases (escudos, clones, rugido, fases del dorado...)
  bosshp(w, p, c) {
    let best = null, bd = 1e9;
    for (const e of w.ents.values()) if (e.boss && e.kind === "npc" && !e.aux && !e.dead) { const d = Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)); if (d < bd) { best = e; bd = d; } }
    if (!best) return say(w, p, "No boss in this map");
    best.hp = Math.max(1, Math.floor(best.maxHp * num(c.n, 1, 100, 50) / 100));
    say(w, p, "Boss " + best.boss + " at " + num(c.n, 1, 100, 50) + " % life");
  },
  killall(w, p) { let k = 0; for (const e of [...w.ents.values()]) if (e.kind === "npc" && !e.dead && !e.master) { killNpc(w, e, p); k++; } say(w, p, k + " monsters killed"); },
  freeze(w, p) { w.dbgFreeze = !w.dbgFreeze; say(w, p, w.dbgFreeze ? "Monsters frozen" : "Monsters active"); },
  // ---- summons
  ball(w, p, c) {
    const sp = String(c.sp || ""); if (!Comp.SPECIES[sp]) return say(w, p, "Unknown species");
    const b = newInst(w, Comp.SPECIES[sp][1]);
    b.comp = { sp, lvl: num(c.lvl, 1, Comp.MAX_COMP_LEVEL, 1), exp: 0, on: false, nm: Comp.randomName(w.rng), mode: "attack" };
    Inv.addToBag(p, w.data, b); w.recalc(p);
    w.emit({ t: "petbought", id: p.id, sp, nm: b.comp.nm, uid: b.uid, price: 0 });
  },
  petlvl(w, p, c) {
    const b = ball(p); if (!b) return say(w, p, "You have no ball");
    b.comp.lvl = num(c.n, 1, Comp.MAX_COMP_LEVEL, 1); b.comp.exp = 0;
    w.recalc(p); say(w, p, b.comp.nm + " nivel " + b.comp.lvl + " (" + Tal.pointsFree(b.comp) + " talent points)");
  },
  petheal(w, p) {
    const b = ball(p); if (!b) return say(w, p, "You have no ball");
    b.comp.down = false; b.comp.hp = Comp.maxOf(p, b.comp);
    for (const e of w.ents.values()) if (e.comp && e.ball === b.uid) { e.hp = e.maxHp; e.mp = Tal.maxMp(b.comp); }
    say(w, p, b.comp.nm + " healed, mana full");
  },
  petspec(w, p, c) {
    const b = ball(p); if (!b) return say(w, p, "You have no ball");
    const br = ["support", "damage", "tank"].includes(c.br) ? c.br : "damage";
    Tal.reset(b.comp);
    for (let guard = 0; guard < 200 && Tal.pointsFree(b.comp) > 0; guard++) {
      const t = Tal.TALENTS.filter(x => x.br === br && !Tal.canLearn(b.comp, x.id))[0];      // solo esa rama: la especialidad queda clara
      if (!t) break;
      Tal.learn(b.comp, t.id);
    }
    w.recalc(p); say(w, p, b.comp.nm + ": " + br + " talents (" + Tal.spentAll(b.comp) + " points)");
  },
  petreset(w, p) { const b = ball(p); if (!b) return say(w, p, "You have no ball"); Tal.reset(b.comp); w.recalc(p); say(w, p, "Talents reset (free)"); },
  // ---- mundo
  sky(w, p, c) {
    if (c.day === 0) { w.dbgSky = null; return say(w, p, "Sky automatic"); }
    w.dbgSky = { day: c.day === 2 ? 2 : 1, weather: num(c.weather, 0, 3, 0) };
    say(w, p, (w.dbgSky.day === 2 ? "Night" : "Day") + ", weather " + w.dbgSky.weather);
  },
  clear(w, p) { w.cleared = true; w.emit({ t: "cleared", id: p.id }); say(w, p, "Level cleared: portals open"); },
  teleportxy(w, p, c) {
    const x = num(c.x, 0, w.grid.w - 1), y = num(c.y, 0, w.grid.h - 1), s = w.freeSpotNear(x, y);
    if (!s) return say(w, p, "Tile occupied");
    w.grid.release(p.x, p.y, p.id); p.x = p.fx = s[0]; p.y = p.fy = s[1]; w.grid.occupy(p.x, p.y, p.id);
    w.emit({ t: "teleport", id: p.id, x: p.x, y: p.y });
  },
};

export function run(w, p, cmd) {
  if (!DEBUG.enabled) return w.reject(p, cmd, "debug tools disabled");
  const f = OPS[cmd.op];
  if (!f) return w.reject(p, cmd, "unknown op");
  f(w, p, cmd);
  return true;
}
export const OP_NAMES = Object.keys(OPS);
