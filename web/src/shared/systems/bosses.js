// Mecánicas únicas de los jefes de la cripta. INVENTO del port (el original no tiene jefes de mazmorra); los números van aquí.
//  1 Rey carmesí  (nivel 5)  : furia (ataca más rápido al perder vida, rugido que aturde al 50 % y 25 %), charcos de brasa, huesos que curan.
//  2 Rey umbrío   (nivel 10) : salto a la espalda, drenaje al compañero, clones de sombra (el real recibe poco daño mientras haya clones).
//  3 Rey glacial  (nivel 15) : suelo helado, congelación del compañero (se descongela acercándose), escudo de hielo con cristales.
//  4 Rey dorado   (nivel 20) : 3 fases (brasa → sombra → hielo), contador de furia (más daño y más oro) y aura que refleja hechizos.
// Todo lo visual vive en `w.bfx` (zonas de aviso, brasas, suelo helado, vínculos) y en banderas de las entidades (`shield`, `clone`, `crystal`,
// `hasClones`); el cliente solo lo pinta. Las entidades auxiliares (`aux`, con `owner`) mueren con su jefe y no cuentan como enemigos.
import { DX, DY, dirTo, dist } from "../const.js";
import { sget, sset, sclear } from "./status.js";
import { damagePlayer } from "./combatsys.js";
import { spawnFrom, companionHurt } from "./npcsys.js";
import { newInst } from "./itemsys.js";
import { groundPush } from "./ground.js";
import * as Inv from "../inventory.js";
import * as Tal from "./talents.js";

export const SHIELD_STAGES = { 3: [0.8, 0.55, 0.3], 4: [0.2] };       // % de vida a los que se levanta el escudo de hielo
export const CLONE_STAGES = { 2: [0.75, 0.4] };
export const CLONE_TAKEN = 0.35;                                       // el jefe real recibe el 35 % del daño con clones vivos
export const REFLECT = 0.3, WRATH_MAX = 10, WRATH_DMG = 0.05, WRATH_GOLD = 0.15;
export const BOSS_TEXT = {
  roar: "¡El rey carmesí ruge y os aturde!", ember: "¡Brasas bajo tus pies!", bones: "¡Los huesos se levantan!",
  clones: "¡Clones de sombra! Solo uno es real.", drain: "¡El rey umbrío drena a tu compañero! Aléjalo o rompe el vínculo.", drainEnd: "El vínculo se rompe.",
  shield: "¡Escudo de hielo! Rompe los cristales.", shieldEnd: "¡El escudo se rompe!", freeze: "¡Tu compañero se congela! Acércate para liberarlo.",
  phase2: "¡El rey dorado se oscurece! Fase 2.", phase3: "¡El rey dorado se congela! Fase 3.", wrath: "El rey dorado se enfurece.",
};

const zones = w => w.bfx || (w.bfx = []);
export function zone(w, o) { const z = { id: w.nextId++, born: w.time, ...o }; zones(w).push(z); return z; }
const say = (w, key) => { for (const e of w.ents.values()) if (e.kind === "player") w.emit({ t: "bossmsg", id: e.id, text: BOSS_TEXT[key] }); };
const foes = (w, n, r = 14) => [...w.ents.values()].filter(e => !e.dead && (e.kind === "player" ? !sget(w, e, "invis") : e.comp) && dist(n, e) <= r);
const pick = (w, l) => l[Math.floor(w.rng() * l.length)];
const baseDmg = n => Math.max(5, Math.round(5 * (n.dmgMul || 1)));
const auxOf = (w, n, flag) => [...w.ents.values()].filter(e => e.owner === n.id && !e.dead && (!flag || e[flag]));
const hpr = n => n.hp / n.maxHp;
const due = (b, k, w, every, first = 3000) => {                          // temporizador por mecánica
  if (b.t[k] === undefined) b.t[k] = w.time + first;
  if (w.time < b.t[k]) return false;
  b.t[k] = w.time + every;
  return true;
};

// daño a un aliado del jugador (jugador o compañero)
export function hurtFoe(w, n, e, dmg, elem) {
  if (e.dead || dmg <= 0) return;
  if (e.kind === "player") damagePlayer(w, e, dmg, n, elem);
  else if (e.comp) companionHurt(w, n, e, dmg);
}
const cellsAround = (w, x, y, r) => { const out = []; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (w.grid.inside(x + i, y + j) && !w.grid.blocked(x + i, y + j)) out.push([x + i, y + j]); return out; };

// ---------------------------------------------------------------- auxiliares
function spawnAux(w, n, name, x, y, o = {}) {
  const spot = w.freeSpotNear(x, y, 3); if (!spot) return null;
  const e = spawnFrom(w, { name, rect: [spot[0], spot[1], spot[0], spot[1]], alive: 0, max: 0, respawn: false });
  if (!e) return null;
  Object.assign(e, { aux: true, owner: n.id, exp: 0, noDieRemainExp: 0, noDrop: true, special: 0 }, o);
  e.nextAct = w.time + 500;
  return e;
}

// ---------------------------------------------------------------- carmesí
function crimson(w, n, b, fs) {
  const r = hpr(n);
  for (const [k, lim] of [["roar50", 0.5], ["roar25", 0.25]]) if (!b[k] && r <= lim) { b[k] = true; roar(w, n); }
  for (const lim of [0.8, 0.6, 0.4, 0.2]) if (!b["bn" + lim] && r <= lim) { b["bn" + lim] = true; bones(w, n); }
  if (fs.length && due(b, "ember", w, r < 0.5 ? 3500 : 6000)) ember(w, n, pick(w, fs));
}
function roar(w, n) {
  say(w, "roar");
  zone(w, { kind: "roar", x: n.x, y: n.y, r: 5, until: w.time + 900, owner: n.id });
  for (const e of foes(w, n, 5)) { if (e.kind === "player") sset(w, e, "hold", 1, 1000); else e.stunUntil = w.time + 1000; }
}
function bones(w, n) {
  say(w, "bones");
  const hp = Math.max(30, Math.round(n.maxHp * 0.02));
  for (let i = 0; i < 3; i++) {
    const e = spawnAux(w, n, "Skeleton", n.x + (i - 1) * 2, n.y + 2, { hp, maxHp: hp, dmgMul: (n.dmgMul || 1) * 0.35, heals: true });
    if (e && n.target) e.target = n.target;
  }
}
function ember(w, n, t) {
  say(w, "ember");
  const cells = cellsAround(w, t.x, t.y, 1);
  zone(w, { kind: "warn", x: t.x, y: t.y, r: 1, until: w.time + 1200, owner: n.id, col: "#ff5a1a" });
  w.after(1200, () => {
    if (n.dead) return;
    for (const [x, y] of cells) zone(w, { kind: "ember", x, y, until: w.time + 6000, owner: n.id, next: w.time + 400, dmg: baseDmg(n) * 2 });
  });
}

// ---------------------------------------------------------------- umbrío
function blink(w, n, t) {
  const d = t.dir || 5, dx = t.x - DX[d], dy = t.y - DY[d];
  const spot = w.freeSpotNear(dx, dy, 2); if (!spot) return;
  zone(w, { kind: "warn", x: spot[0], y: spot[1], r: 0, until: w.time + 600, owner: n.id, col: "#a050ff" });
  w.after(600, () => {
    if (n.dead) return;
    const to = w.grid.free(spot[0], spot[1]) ? spot : w.freeSpotNear(spot[0], spot[1], 2); if (!to) return;
    zone(w, { kind: "blink", x: n.x, y: n.y, until: w.time + 500, owner: n.id });
    w.grid.release(n.x, n.y, n.id);
    n.x = n.fx = to[0]; n.y = n.fy = to[1];
    w.grid.occupy(n.x, n.y, n.id);
    n.dir = dirTo(n.x, n.y, t.x, t.y); n.target = t.id; n.nextAct = w.time + 150; n.busyUntil = w.time;
    zone(w, { kind: "blink", x: n.x, y: n.y, until: w.time + 500, owner: n.id });
    w.emit({ t: "bossfx", kind: "blink", id: n.id, x: n.x, y: n.y });
  });
}
function startDrain(w, n, b, fs) {
  const t = pick(w, fs.filter(e => e.comp && dist(n, e) <= 10)) || pick(w, fs.filter(e => dist(n, e) <= 10));
  if (!t) return;
  say(w, "drain");
  b.drain = { to: t.id, until: w.time + 6000, next: w.time + 1000, z: zone(w, { kind: "drain", from: n.id, to: t.id, until: w.time + 6000, owner: n.id }) };
}
function tickDrain(w, n, b) {
  const d = b.drain; if (!d) return;
  const t = w.ents.get(d.to);
  if (!t || t.dead || w.time >= d.until || dist(n, t) > 10) {
    if (t && !t.dead && w.time < d.until) say(w, "drainEnd");
    d.z.until = 0; b.drain = null; return;
  }
  if (w.time < d.next) return;
  d.next += 1000;
  hurtFoe(w, n, t, Math.max(1, Math.round((t.maxHp || 100) * (t.comp ? 0.04 : 0.03))));
  n.hp = Math.min(n.maxHp, n.hp + Math.round(n.maxHp * 0.015));
}
function clones(w, n, b) {
  say(w, "clones");
  const hp = Math.max(40, Math.round(n.maxHp * 0.05));
  for (let i = 0; i < 2; i++) spawnAux(w, n, "Skeleton", n.x + (i ? 3 : -3), n.y + 1, { hp, maxHp: hp, boss: n.boss, clone: true, dmgMul: (n.dmgMul || 1) * 0.4, target: n.target });
}

// ---------------------------------------------------------------- glacial
const frostRadius = n => (hpr(n) > 0.66 ? 2 : hpr(n) > 0.33 ? 3 : 4);
function frost(w, n, t, r = frostRadius(n)) {
  zone(w, { kind: "warn", x: t.x, y: t.y, r, until: w.time + 1000, owner: n.id, col: "#6ac8ff" });
  w.after(1000, () => { if (!n.dead) zone(w, { kind: "frost", x: t.x, y: t.y, r, until: w.time + 14000, owner: n.id }); });
}
function freeze(w, n, t) {
  zone(w, { kind: "warn", x: t.x, y: t.y, r: 0, until: w.time + 700, owner: n.id, col: "#9fe0ff" });
  w.after(700, () => {
    if (n.dead || t.dead) return;
    if (t.comp) { say(w, "freeze"); t.frozenUntil = w.time + 3000; t.thaw = false; sset(w, t, "ice", 1, 3000); }
    else { sset(w, t, "hold", 1, 1500); sset(w, t, "ice", 1, 1500); }
  });
}
function raiseShield(w, n) {
  const crystals = [];
  for (let tries = 0; tries < 80 && crystals.length < 3; tries++) {
    const x = n.x + Math.floor(w.rng() * 17) - 8, y = n.y + Math.floor(w.rng() * 17) - 8;
    if (!w.grid.free(x, y) || dist(n, { x, y }) < 4 || crystals.some(c => dist(c, { x, y }) < 4)) continue;
    const hp = Math.max(40, Math.round(n.maxHp * 0.025));
    const c = spawnAux(w, n, "Dummy", x, y, { hp, maxHp: hp, crystal: true, boss: 0 });
    if (c) crystals.push(c);
  }
  if (!crystals.length) return;
  n.shield = true;
  say(w, "shield");
}
function tickFrost(w, n) {
  for (const z of zones(w)) {
    if (z.kind !== "frost" || z.owner !== n.id) continue;
    for (const e of w.ents.values()) {
      if (e.dead || !(e.kind === "player" || e.comp) || Math.abs(e.x - z.x) > z.r || Math.abs(e.y - z.y) > z.r) continue;
      if (e.kind === "player" && (e.eff?.prot?.ice || 0) >= 50) continue;     // protección al hielo >= 50: inmune a la ralentización
      e.chillUntil = w.time + 700;                                       // ralentizado (sin evento de estado: no llena el registro)
    }
  }
}
function tickThaw(w, n) {                                              // un jugador a 2 casillas acorta la congelación a 1 s
  for (const e of w.ents.values()) {
    if (!e.comp || !e.frozenUntil || e.dead) continue;
    if (w.time >= e.frozenUntil) { e.frozenUntil = 0; continue; }
    if (!e.thaw && [...w.ents.values()].some(p => p.kind === "player" && !p.dead && dist(p, e) <= 2)) { e.thaw = true; e.frozenUntil = Math.min(e.frozenUntil, w.time + 1000); w.after(1000, () => sclear(w, e, "ice")); }
  }
}

// ---------------------------------------------------------------- dorado
function phase(n) { const r = hpr(n); return r > 0.66 ? 1 : r > 0.33 ? 2 : 3; }

// ---------------------------------------------------------------- bucle
export function bossTick(w, n) {
  if (n.dead || n.aux || !n.boss) return;
  const b = n.bm || (n.bm = { t: {}, shield: 0, clones: 0, ph: 1 });
  if (n.dmgBase === undefined) n.dmgBase = n.dmgMul || 1;
  // limpiar zonas caducadas y procesar las propias
  w.bfx = zones(w).filter(z => z.until > w.time);
  for (const z of w.bfx) {
    if (z.kind === "ember" && z.owner === n.id && w.time >= z.next) {
      z.next += 1000;
      const oid = w.grid.occupant(z.x, z.y), e = oid === undefined ? null : w.ents.get(oid);
      if (e && !e.dead && (e.kind === "player" || e.comp)) hurtFoe(w, n, e, z.dmg, "fire");
    }
  }
  tickDrain(w, n, b); tickFrost(w, n); tickThaw(w, n);
  n.hasClones = auxOf(w, n, "clone").length > 0;
  const fs = foes(w, n);
  if (n.boss === 1) crimson(w, n, b, fs);
  if (n.boss === 2) {
    for (const lim of CLONE_STAGES[2]) if (!b["cl" + lim] && hpr(n) <= lim) { b["cl" + lim] = true; clones(w, n, b); }
    if (fs.length && due(b, "blink", w, hpr(n) < 0.5 ? 5000 : 7000)) blink(w, n, pick(w, fs));
    if (fs.length && !b.drain && due(b, "drain", w, 12000, 6000)) startDrain(w, n, b, fs);
  }
  if (n.boss === 3) {
    if (fs.length && due(b, "frost", w, hpr(n) < 0.5 ? 6000 : 8000)) frost(w, n, pick(w, fs));
    if (fs.length && due(b, "freeze", w, hpr(n) < 0.5 ? 11000 : 15000, 7000)) { const t = pick(w, fs.filter(e => e.comp)) || pick(w, fs); freeze(w, n, t); }
  }
  if (n.boss === 3 || n.boss === 4) {
    const st = SHIELD_STAGES[n.boss];
    while (b.shield < st.length && hpr(n) <= st[b.shield]) { b.shield++; if (!n.shield) raiseShield(w, n); }
  }
  if (n.boss === 4) golden(w, n, b, fs);
}
function golden(w, n, b, fs) {
  const ph = phase(n);
  if (ph > b.ph) { b.ph = ph; say(w, ph === 2 ? "phase2" : "phase3"); }
  n.dmgMul = n.dmgBase * (1 + WRATH_DMG * (n.wrath || 0));
  if (!fs.length) return;
  if (ph === 1 && due(b, "ember", w, 7000)) ember(w, n, pick(w, fs));
  if (ph === 2) {
    if (due(b, "blink", w, 8000)) blink(w, n, pick(w, fs));
    if (!b.drain && due(b, "drain", w, 14000, 6000)) startDrain(w, n, b, fs);
  }
  if (ph === 3 && due(b, "frost", w, 9000)) frost(w, n, pick(w, fs), 3);
}

// ---------------------------------------------------------------- ganchos del resto del sistema
// Reduce o anula el daño que recibe un jefe (o refleja parte). kind: "hit" cuerpo a cuerpo, "spell" hechizo. Devuelve el daño final.
export function mitigate(w, n, dmg, src, kind = "hit") {
  if (!n.boss || n.aux) return dmg;
  if (n.shield) { if (w.time - (n.immuneAt ?? -1e9) > 600) { n.immuneAt = w.time; w.emit({ t: "immune", id: n.id }); } return 0; }
  if (n.boss === 2 && n.hasClones) dmg = Math.max(1, Math.round(dmg * CLONE_TAKEN));
  if (n.boss === 4 && kind === "spell" && src && dmg > 0) reflect(w, n, src, dmg);
  return dmg;
}
function reflect(w, n, src, dmg) {
  const back = Math.max(1, Math.round(dmg * REFLECT));
  if (src.comp) {                                                       // los compañeros de la rama Warrior no sufren el reflejo
    const tc = Inv.instOf(w.ents.get(src.master), src.ball)?.comp;
    if (tc && Tal.spec(tc) === "tank") return;
  }
  w.emit({ t: "bossfx", kind: "reflect", id: src.id });
  hurtFoe(w, n, src, back);
}
// Un golpe del jefe dorado acierta: sube el contador de furia
export function onBossHit(w, n) {
  if (n.boss !== 4 || n.aux) return;
  n.wrath = Math.min(WRATH_MAX, (n.wrath || 0) + 1);
}
// La furia del rey carmesí: hasta el doble de rápido con poca vida
export const speedFactor = n => (n.boss === 1 && !n.aux ? 1 - 0.5 * (1 - hpr(n)) : 1);
export const wrathGold = n => 1 + WRATH_GOLD * (n.wrath || 0);

export function onDeath(w, n) {
  if (n.aux) {
    const o = w.ents.get(n.owner); if (!o || o.dead) return;
    if (n.heals) o.hp = Math.min(o.maxHp, o.hp + Math.round(o.maxHp * 0.03));
    if (n.crystal && o.shield && !auxOf(w, o, "crystal").length) { o.shield = false; o.nextAct = w.time + 2500; say(w, "shieldEnd"); }
    return;
  }
  if (!n.boss) return;
  for (const e of auxOf(w, n)) { e.noDrop = true; e.noDieRemainExp = 0; w.killNpc(e, null); }
  n.shield = false;
  w.bfx = zones(w).filter(z => z.owner !== n.id);
  if (n.boss === 4) {
    const gold = w.data.named("Gold");
    const count = Math.round(((w.map?.level || 20) * 400) * wrathGold(n));
    if (gold) w.after(n.dur.dying * 0.6, () => groundPush(w, n.x, n.y, newInst(w, gold.id, count)));
  }
}
