// Dummy: summon de apoyo ÚNICO del port (INVENTO: no existe en el original; usa el NPC "Dummy" de NPC.cfg y los hechizos de Magic.cfg).
//  - Débil a propósito (companion.statsOf): pocos puntos de vida que casi no suben con el nivel. No ataca; lanza magias útiles.
//  - 3 clases según la primera magia aprendida (talents.js): Healer (verde), Buffer (amarillo), Aura (azul). Una clase por Dummy.
//  - Todo es SOLO para el dueño, su grupo (p.party) y los compañeros de ellos.
//  - Área: radio (Chebyshev) 1 al nivel 1 hasta 6 al 50; hay que acercar al Dummy al grupo. MASS ignora el radio (todo el grupo en el mapa).
//  - Auras: porcentaje proporcional al nivel del Dummy (y al rango); no se lanzan, se aplican cada segundo a quien esté dentro del radio.
//  - Reflejo de agro (npcsys): los monstruos cercanos prefieren al Dummy; el evento "dummy-agro" le hace avisar al dueño.
import { dice } from "../rules.js";
import { sget, sset } from "./status.js";
import * as Tal from "./talents.js";

export const radiusOf = (lvl, cls) => 1 + Math.round((Math.max(1, lvl) - 1) * 5 / 49) + (cls === "aura" ? 1 : 0);       // el Dummy de aura cubre una casilla más
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const rank = (c, id) => Tal.rankOf(c, id);
// Vampiric Aura (invento): devuelve a quien la recibe ese % del daño que hace (hasta 8 % al nivel 50 con rango 5).
// Porcentajes de aura: crecen con el nivel del Dummy; el rango (1..5) los lleva del 60 % al 100 % del máximo del nivel
const AURA_PER_LEVEL = { dregen: 0.10, dexp: 0.8, ddef: 0.6, dmana: 0.08, dvamp: 0.16 };            // al nivel 50 con rango 5: 5 %/s de vida, 40 % de exp, 30 % menos daño, 4 %/s de maná
export const auraPct = (c, id) => { const r = rank(c, id); return r ? Math.round(AURA_PER_LEVEL[id] * c.lvl * (0.5 + 0.1 * r) * 100) / 100 : 0; };
const MASS_CD = 60000, MASS_AURA_MS = 20000;

// Dueño + grupo (mismo mundo) + compañeros de todos ellos
function members(w, m) {
  const out = [m];
  const gid = m.party?.id;
  for (const e of w.ents.values()) {
    if (e.dead || e === m) continue;
    if (e.kind === "player" && gid && e.party?.id === gid) out.push(e);
  }
  const ids = new Set(out.map(e => e.id));
  for (const e of w.ents.values()) if (e.comp && !e.dead && ids.has(e.master) && !e.dummy) out.push(e);
  return out;
}
// El Dummy no habla: solo muestra el nombre de la magia o aura que usa (bocadillo sobre él, lo ve su dueño)
const say = (w, n, txt) => { if (w.time - (n.sayAt || 0) < 900) return; n.sayAt = w.time; w.emit({ t: "dummy-cast", id: n.master, nid: n.id, txt }); };
const SPELL_NAME = { 1: "Heal", 21: "Great Heal", 13: "Defense Shield", 44: "Great Defense Shield", 33: "Protection From Magic", 50: "Berserk" };
const frac = e => e.hp / Math.max(1, e.maxHp);

function healAmount(w, c, id, rk) {
  const sp = w.magic[id];
  return Math.round((dice(w.rng, sp.v4, sp.v5) + sp.v6 + c.lvl) * (1 + 0.25 * (rk - 1)));
}
function doHeal(w, n, c, id, who, rk, mult = 1) {
  const amount = Math.round(healAmount(w, c, id, rk) * mult);
  who.hp = Math.min(who.maxHp, who.hp + amount);
  w.emit({ t: "heal", id: who.id, amount, by: n.id });
}

// Estado de un buff en `who`: devuelve true si ya lo tiene (no se repite)
const BUFFS = [
  { tal: "dgward", key: "protect", v: 4, spell: 44, ms: rk => 40000 + 5000 * (rk - 1) },
  { tal: "dward", key: "protect", v: 3, spell: 13, ms: rk => 30000 + 5000 * (rk - 1) },
  { tal: "dpfm", key: "pfm", v: (rk, c) => Math.min(70, Math.round(20 + 6 * rk + c.lvl * 0.3)), spell: 33, ms: rk => 30000 + 4000 * (rk - 1) },
  { tal: "dberserk", key: "berserk", v: 1, spell: 50, ms: rk => 20000 + 3000 * (rk - 1), fight: true },
];
const has = (w, who, b, c) => { const cur = sget(w, who, b.key); return cur >= (typeof b.v === "function" ? b.v(rank(c, b.tal), c) : b.v) - (b.key === "pfm" ? 5 : 0); };
function applyBuff(w, n, c, b, who) {
  const rk = rank(c, b.tal), v = typeof b.v === "function" ? b.v(rk, c) : b.v;
  sset(w, who, b.key, v, b.ms(rk));
  say(w, n, SPELL_NAME[b.spell]);
  Tal.emitCast(w, n, b.spell, who.x, who.y);
}

export const RES_CD = rk => 180000 - 40000 * (rk - 1);
function raise(w, n, c, who) {
  const rk = rank(c, "dres"), spot = w.grid.free(who.x, who.y, who.id) ? [who.x, who.y] : w.freeSpotNear(who.x, who.y);
  if (!spot) return;
  Tal.pay(w, n, 94, RES_CD(rk));
  n.cd.res = w.time + RES_CD(rk);
  say(w, n, "Resurrection");
  Tal.emitCast(w, n, 94, who.x, who.y);
  who.x = who.fx = spot[0]; who.y = who.fy = spot[1];
  w.grid.occupy(who.x, who.y, who.id);
  who.dead = false; who.st = {};
  who.hp = Math.max(1, Math.round(who.maxHp * (0.4 + 0.1 * rk)));
  w.setAct(who, 0, 0); who.busyUntil = 0;
  w.emit({ t: "respawn", id: who.id, by: n.id });
  w.emit({ t: "resurrected", id: who.id, by: n.id });
}

export function think(w, n, m, c) {
  n.dummy = true;
  n.dcls = c.cls || null;
  if (!c.cls || !w.magic) return;
  const r = radiusOf(c.lvl, c.cls), mem = members(w, m), near = mem.filter(e => cheb(n, e) <= r);
  const hostiles = [...w.ents.values()].some(e => e.kind === "npc" && !e.dead && !e.master && !e.cfg.actionLimit && cheb(n, e) <= 12);
  n.cd = n.cd || {};

  // auras: cada segundo, a todos los que estén dentro del radio (mass: doble durante 20 s)
  if (c.cls === "aura" && w.time >= (n.auraAt || 0)) {
    n.auraAt = w.time + 1000;
    const k = w.time < (n.massUntil || 0) ? 2 : 1;
    const vp = auraPct(c, "dvamp") * k, hp = auraPct(c, "dregen") * k, mp = auraPct(c, "dmana") * k, ex = auraPct(c, "dexp") * k, df = Math.min(60, auraPct(c, "ddef") * k);
    if (w.time >= (n.auraSayAt || 0)) {
      n.auraSayAt = w.time + 8000;
      const names = [vp > 0 && "Vampiric", hp > 0 && "Regeneration", ex > 0 && "Wisdom", df > 0 && "Defense", mp > 0 && "Mana"].filter(Boolean);
      if (names.length) say(w, n, names.join(" + ") + " Aura" + (k > 1 ? " x2" : ""));
    }
    for (const e of near) {
      if (hp > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + Math.max(1, Math.round(e.maxHp * hp / 100)));
      if (mp > 0 && e.kind === "player" && e.mp < e.maxMp) e.mp = Math.min(e.maxMp, e.mp + Math.max(1, Math.round(e.maxMp * mp / 100)));
      if (ex > 0 || df > 0 || vp > 0) e.aura = { exp: ex, def: df, vamp: vp, until: w.time + 2500 };
    }
  }
  if (w.time - (n.castAt || 0) < Tal.GCD) return;

  // Resurrection (solo el Dummy de aura): levanta a un jugador caído del grupo dentro del radio; la recarga baja con el rango
  if (c.cls === "aura" && rank(c, "dres") && w.time >= (n.cd.res || 0) && n.mp >= Tal.manaOf(w, 94)) {
    const gid = m.party?.id, down = [...w.ents.values()].find(e => e.kind === "player" && e.dead && cheb(n, e) <= r + 2 && (e === m || (gid && e.party?.id === gid)));
    if (down) { raise(w, n, c, down); return; }
  }

  // MASS (60 s de recarga, a todo el grupo del mapa; cuesta el triple del hechizo base)
  if (w.time >= (n.cd.mass || 0)) {
    if (c.cls === "healer" && rank(c, "dmassh") && mem.filter(e => frac(e) < 0.6).length >= 2 && n.mp >= Tal.manaOf(w, 21) * 3) {
      n.mp -= Tal.manaOf(w, 21) * 2; n.cd.mass = w.time + MASS_CD; n.castAt = w.time;
      say(w, n, "MASS Great Heal");
      for (const e of mem) { doHeal(w, n, c, 21, e, Math.max(1, rank(c, "dgheal")), 1.2); Tal.emitCast(w, n, 21, e.x, e.y); }
      w.emit({ t: "dummy-mass", id: m.id, cls: c.cls });
      return;
    }
    if (c.cls === "buffer" && rank(c, "dmassb") && hostiles && n.mp >= 60) {
      const bs = BUFFS.filter(b => rank(c, b.tal) && (!b.fight || hostiles));
      if (bs.length && mem.filter(e => bs.some(b => !has(w, e, b, c))).length >= 2) {
        n.mp -= 40; n.cd.mass = w.time + MASS_CD; n.castAt = w.time;
        say(w, n, "MASS Buff");
        for (const e of mem) for (const b of bs) if (!(b.key === "protect" && b.v === 3 && sget(w, e, "protect") >= 4)) applyBuff(w, n, c, b, e);
        w.emit({ t: "dummy-mass", id: m.id, cls: c.cls });
        return;
      }
    }
    if (c.cls === "aura" && rank(c, "dmassa") && hostiles && n.mp >= 40) {
      n.mp -= 30; n.cd.mass = w.time + MASS_CD; n.massUntil = w.time + MASS_AURA_MS; n.castAt = w.time;
      say(w, n, "MASS Aura");
      Tal.emitCast(w, n, 33, n.x, n.y);
      w.emit({ t: "dummy-mass", id: m.id, cls: c.cls });
      return;
    }
  }

  if (c.cls === "healer") {
    const hurt = near.filter(e => frac(e) < 0.8).sort((a, b) => frac(a) - frac(b))[0];
    if (!hurt) return;
    if (rank(c, "dgheal") && frac(hurt) < 0.45 && Tal.ready(w, n, 21)) { say(w, n, "Great Heal"); doHeal(w, n, c, 21, hurt, rank(c, "dgheal")); Tal.emitCast(w, n, 21, hurt.x, hurt.y); Tal.pay(w, n, 21, 2500); return; }
    if (rank(c, "dheal") && frac(hurt) < 0.75 && Tal.ready(w, n, 1)) { say(w, n, "Heal"); doHeal(w, n, c, 1, hurt, rank(c, "dheal")); Tal.emitCast(w, n, 1, hurt.x, hurt.y); Tal.pay(w, n, 1, 2000); }
    return;
  }
  if (c.cls === "buffer" && hostiles) {
    for (const b of BUFFS) {
      if (!rank(c, b.tal) || !Tal.ready(w, n, b.spell)) continue;
      const who = near.find(e => !has(w, e, b, c) && !(b.key === "protect" && b.v === 3 && sget(w, e, "protect") >= 4));
      if (!who) continue;
      applyBuff(w, n, c, b, who); Tal.pay(w, n, b.spell, 2500);
      return;
    }
  }
}

// El Dummy avisa (a su dueño) de que un monstruo lo está atacando; como mucho una vez cada 12 s
export function agroWarn(w, n, monster) {
  if (w.time < (n.agroAt || 0)) return;
  n.agroAt = w.time + 12000;
  w.emit({ t: "dummy-agro", id: n.master, nid: n.id, mn: monster.name });
}

// ¿Cuánto atrae el Dummy a los monstruos? (npcsys: la distancia se reduce a la mitad)
export const AGRO_FACTOR = 0.5;
// Daño que recibe quien está bajo el aura de defensa (damagePlayer / companionHurt)
export const auraDefense = (w, e) => (e.aura && e.aura.until > w.time ? e.aura.def : 0);
export const auraVamp = (w, e) => (e.aura && e.aura.until > w.time ? e.aura.vamp || 0 : 0);
export const auraExp = (w, e) => (e.aura && e.aura.until > w.time ? e.aura.exp : 0);
