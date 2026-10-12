// Datos para el observador (INVENTO del port, 0.77.0): top de summons con su dueño y su ficha, estadísticas globales y las «peticiones»
// de los bots-testers (lo que les falla o echan en falta). Solo lectura sobre la aventura; el servidor lo publica en /api/stats.
import * as Comp from "./companion.js";
import * as Tal from "./talents.js";
import { skillOf } from "./petskill.js";
import * as Residents from "./residents.js";

// ---- peticiones de los bots (tester) ----
// ask(adv, p, key, es, en): anota que a `p` le falla/falta algo. Una entrada por clave, con quién la pidió y cuántas veces.
export function ask(adv, p, key, es, en) {
  const m = (adv.requests ??= new Map());
  let r = m.get(key); if (!r) m.set(key, r = { key, es, en, n: 0, who: [], at: 0 });
  r.n++; r.at = adv.time ?? 0; if (p?.name && !r.who.includes(p.name) && r.who.length < 12) r.who.push(p.name);
  return r;
}
export const requests = adv => [...(adv.requests?.values() || [])].sort((a, b) => b.n - a.n).slice(0, 40).map(r => ({ key: r.key, es: r.es, en: r.en, n: r.n, who: r.who }));

// ---- summons ----
const ownerOf = (adv, id) => { for (const w of adv.worlds.values()) { const e = w.ents.get(id); if (e && e.kind === "player") return e; } return adv.bots.get(id) || null; };
export function summons(adv) {
  const out = [];
  for (const w of adv.worlds.values()) for (const e of w.ents.values()) {
    if (!e.comp || e.master == null || e.dead) continue;
    const o = ownerOf(adv, e.master), inst = o && o.bag?.find(i => i.uid === e.ball), c = inst?.comp; if (!c) continue;
    const s = Comp.statsOf(o, c), f = Tal.factors(c), sk = skillOf(c);
    out.push({ id: e.id, oid: o.id, owner: o.name, side: o.side, sp: c.sp, nm: c.nm || c.sp, cls: c.cls || Tal.spec(c) || "", lvl: c.lvl | 0, exp: c.exp | 0, need: Comp.need(c.lvl | 0), hp: Math.round(e.hp), mhp: Math.round(e.maxHp || s.hp), mp: Math.round(e.mp || 0), mmp: s.mp | 0,
      dmg: s.dmg, share: Math.round(s.share * 100), map: w.map.name || w.map.id, mode: c.mode || "attack", bot: !!o.bot, spent: Tal.spentAll(c), tal: c.tal || {},
      f: { dmg: +f.dmg.toFixed(2), hp: +f.hp.toFixed(2), mp: +f.mp.toFixed(2), taken: +f.taken.toFixed(2), heal: +f.heal.toFixed(2), spell: +f.spell.toFixed(2) }, skill: sk ? sk.name : "", save: o.eff?.summonSave | 0 });
  }
  return out.sort((a, b) => b.lvl - a.lvl || b.exp - a.exp);
}

// ---- estadísticas globales ----
export function globals(adv) {
  const bots = adv.residents(), n = bots.length || 1, by = (f, k = x => x) => { const m = {}; for (const b of bots) { const v = k(f(b)); if (v) m[v] = (m[v] || 0) + 1; } return m; };
  const sum = f => bots.reduce((a, b) => a + (f(b) || 0), 0);
  return {
    bots: bots.length, avgLv: +(sum(b => b.level) / n).toFixed(1), maxLv: Math.max(0, ...bots.map(b => b.level)), gold: sum(b => b.gold), kills: sum(b => b.kills), ek: sum(b => b.ek),
    cls: by(b => b.quests?.cls || "?"), arch: by(b => b.res?.arch || "?"), side: by(b => b.side), maps: by(b => adv.worldFor(b.id)?.map?.name || "?"),
    parties: new Set(bots.filter(b => b.party?.id).map(b => b.party.id)).size, dead: bots.filter(b => b.dead).length, stuck: bots.filter(b => b.bot?.stuck).length,
    wish: by(b => b.bot?.wish), mode: by(b => Residents.modeOf(adv, b)), summons: summons(adv).length,
  };
}
