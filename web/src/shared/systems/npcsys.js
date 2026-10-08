// Monstruos: aparición en sus generadores, IA, ataque, muerte y botín.
import { ACT, DX, DY, CORPSE_MS, CHASE_LIMIT, dirTo, dist, mobDurations } from "../const.js";
import * as R from "../rules.js";
import { greedyStep } from "../path.js";
import { rollKillDrop } from "../drops.js";
import { newInst } from "./itemsys.js";
import { groundPush } from "./ground.js";
import { giveExp, npcStrikes } from "./combatsys.js";

export function spawnFrom(w, g) {
  const cfg = w.npcDb[g.name];
  if (!cfg) return null;
  const [x1, y1, x2, y2] = g.rect;
  for (let tries = 0; tries < 60; tries++) {
    const x = x1 + Math.floor(w.rng() * (x2 - x1 + 1)), y = y1 + Math.floor(w.rng() * (y2 - y1 + 1));
    if (!w.grid.free(x, y)) continue;
    const n = w.makeEnt("npc", x, y);
    Object.assign(n, {
      name: g.name, type: cfg.type, cfg, gen: g, dur: mobDurations(cfg.type),
      dir: 1 + Math.floor(w.rng() * 8),
      hp: R.npcHP(w.rng, cfg.hitDice), exp: R.npcExp(w.rng, cfg), absDamage: cfg.absDamage,
      target: null, nextAct: w.time + w.rng() * cfg.actionTime, phase: w.rng() * 1000, special: 0,
    });
    if (g.specialProb && R.dice(w.rng, 1, 100) <= g.specialProb) {
      n.special = g.specialKind;
      R.applySpecial(w.rng, n, g.specialKind);
    }
    n.maxHp = n.hp;
    n.noDieRemainExp = n.exp - Math.floor(n.exp / 3);
    g.alive++;
    w.emit({ t: "spawn", id: n.id });
    return n;
  }
  return null;
}

export function killNpc(w, n, p) {
  n.hp = 0; n.dead = true;
  w.setAct(n, ACT.DYING, n.dur.dying);
  w.grid.release(n.x, n.y, n.id);
  p.kills++;
  w.emit({ t: "death", id: n.id, by: p.id });
  let xp = Math.floor(n.exp / 3) + n.noDieRemainExp;             // NpcKilledHandler
  if (p.eff && p.eff.addExp) xp += Math.floor((p.eff.addExp / 100) * xp);
  giveExp(w, p, xp);
  n.noDieRemainExp = 0;
  const drop = rollKillDrop(w.rng, n, { rating: p.rating || 0, data: w.data, addGold: p.eff?.addGold || 0 });
  if (drop && w.data.item(drop.id)) w.after(n.dur.dying * 0.6, () => groundPush(w, n.x, n.y, newInst(w, drop.id, drop.count, drop)));
  n.gen.alive--;
  w.after(n.cfg.regenTime, () => { if (n.gen.alive < n.gen.max) spawnFrom(w, n.gen); });
  w.after(n.dur.dying + CORPSE_MS, () => { w.ents.delete(n.id); w.emit({ t: "remove", id: n.id }); });
}

export function npcThink(w, n) {
  if (n.dead || w.time < n.nextAct || w.busy(n)) return;
  n.nextAct = w.time + n.cfg.actionTime;
  let t = n.target ? w.ents.get(n.target) : null;
  if (t && (t.dead || dist(n, t) > CHASE_LIMIT)) { n.target = null; t = null; }
  if (!t) {
    for (const e of w.ents.values())
      if (e.kind === "player" && !e.dead && dist(n, e) <= n.cfg.searchRange) { t = e; n.target = e.id; break; }
  }
  if (t) {
    if (dist(n, t) <= n.cfg.attackRange) return npcAttack(w, n, t);
    const d = greedyStep(w.grid, n, t.x, t.y, dirTo);
    if (d) w.tryStep(n, d, n.dur.move, ACT.MOVE);
    return;
  }
  if (w.rng() < 0.35) {                                          // sin objetivo: pasea dentro de su zona
    const d = 1 + Math.floor(w.rng() * 8), nx = n.x + DX[d], ny = n.y + DY[d];
    const [x1, y1, x2, y2] = n.gen.rect;
    if (nx >= x1 - 2 && nx <= x2 + 2 && ny >= y1 - 2 && ny <= y2 + 2) w.tryStep(n, d, n.dur.move, ACT.MOVE);
    else n.dir = d;
  }
}

function npcAttack(w, n, t) {
  n.dir = dirTo(n.x, n.y, t.x, t.y);
  w.setAct(n, ACT.ATTACK, n.dur.attack);
  n.busyUntil = w.time + n.dur.attack;
  w.emit({ t: "attack", id: n.id, target: t.id });
  w.after(n.dur.attack * 0.5, () => {
    if (n.dead || t.dead || dist(n, t) > n.cfg.attackRange) { w.emit({ t: "miss", id: t.id, from: n.id }); return; }
    npcStrikes(w, n, t);
  });
}
