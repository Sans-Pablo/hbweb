// CONSEJO DE GRUPO (INVENTO del port). Cuando varios habitantes van juntos, qué hacen lo decide una discusión, como entre jugadores de verdad: cada miembro
// valora las opciones con lo que ve (qué monstruos rinden en la granja, si está listo para la cripta, si compensa Promise Land), según su personalidad y su meta,
// y defiende la suya con más o menos fuerza (nivel, carisma, afinidad, ser el líder). Gana la propuesta con más peso; los que pierden la acatan o, si
// discrepan mucho, dejan el grupo. El resultado (plan) lo ejecuta el líder y los demás lo siguen. Todo queda en `adv.councils` para el panel de admin.
import { dist } from "../const.js";
import { mobRatio, tooStrong, fightEstimate, bossPreview } from "./bot.js";

// "fiebre de guerra": ventanas de 5 min cada 20 en las que el bando se anima a pelear en Promise Land (todo el PvP es allí, nunca en las granjas)
export const warFever = w => (w.time % (20 * 60000)) < 5 * 60000;
export const KINDS = ["hunt", "crypt", "pl"];
const LABEL = { hunt: ["cazar en la granja", "hunt on the farm"], crypt: ["bajar a la cripta", "go down into the crypt"], pl: ["ir a Promise Land", "go to Promise Land"] };
export const labelOf = (k, lang = "es") => (LABEL[k] || ["nada", "nothing"])[lang === "en" ? 1 : 0];
// gustos por arquetipo (multiplican la valoración)
const LIKES = { warrior: { pl: 1.3, crypt: 1.1, hunt: 0.8 }, hunter: { hunt: 1.3, crypt: 1, pl: 0.8 }, trader: { hunt: 1.1, crypt: 0.8, pl: 0.5 }, wanderer: { crypt: 1.2, hunt: 0.9, pl: 1 }, scholar: { crypt: 1.1, hunt: 1, pl: 0.6 } };
const wild = e => e.kind === "npc" && !e.dead && !e.master && !e.aux && !e.cfg.actionLimit;

// Qué le conviene a `p` ahora: valoración (0..~3) y el motivo, para cada opción. `H.cryptNeed` viene de residents.js.
export function evaluate(adv, p, H, party = 1) {
  const r = p.res, home = adv.homeOf(p), out = {}, lvl = p.level;
  let best = null, br = 0;
  for (const e of home.ents.values()) if (wild(e) && !home.safeAt(e.x, e.y) && !tooStrong(home, p, e)) { const x = mobRatio(p, e); if (x > br) { br = x; best = e; } }
  out.hunt = { s: 0.3 + Math.min(1.2, br * 1.8), why: best ? `the best mob I can take on the farm is a ${best.name.replace(/-/g, " ")} and it gives ${(br * 100).toFixed(0)}% of a level per kill` : "there is nothing worth hunting on the farm right now", ratio: br, mob: best?.name || null };
  const dv = Math.max(1, Math.min(p.delve?.deepest || 1, 20)), need = H.cryptNeed(r, dv), ready = lvl >= need - 1;
  const nb = bossPreview(home, dv), bossOk = !nb || fightEstimate(home, p, nb).ratio * (1 + 0.5 * (party - 1)) >= 1.3;
  const sk = 1500 * (1 + 0.15 * (dv - 1)) / Math.max(100, 1);                                    // un esqueleto del piso `dv` (exp de NPC.cfg * escala de dungeon.js)
  out.crypt = { s: ready && bossOk ? 1.0 + Math.min(1.4, sk / Math.max(300, 80 * lvl + 600)) : ready ? 0.45 : 0.12, why: !ready ? `I am level ${lvl} and the crypt floor ${dv} wants about ${need}` : !bossOk ? `the boss of floor ${dv} would crush us` : `the crypt skeletons give good experience and loot (floor ${dv}, boss ok)` };
  out.pl = { s: lvl >= 3 ? Math.max(0.1, 0.95 + (party >= 3 ? 0.5 : party >= 2 ? 0.25 : 0) + (r.goal?.k === "pvp" || r.goal?.k === "pit" ? 0.9 : 0) + Math.min(0.5, lvl / 80) - 0.12 * (r.scare | 0) + (r.grudge > home.time ? 0.7 : 0) + (warFever(home) && lvl >= 5 ? 0.45 : 0)) : 0, why: lvl >= 3 ? `${r.grudge > home.time ? "an enemy killed me there and I want revenge, " : ""}Promise Land has the best loot and the pits give glory${party >= 3 ? ", and with this many of us we can take a pit" : ""}` : "I am too low level for Promise Land" };
  const likes = LIKES[r.arch] || {}, g = r.goal?.k;
  for (const k of KINDS) {
    out[k].s *= likes[k] || 1;
    if (g === "crypt" && k === "crypt") out[k].s *= 2;
    if (g === "kills" && k === "hunt") out[k].s *= 1.3;
    if ((g === "level" || g === "gear") && k !== "hunt") out[k].s *= 1.15;
    out[k].s = +out[k].s.toFixed(2);
  }
  return out;
}
export const bestOf = ev => KINDS.reduce((a, k) => (ev[k].s > ev[a].s ? k : a), "hunt");

// grupos de habitantes: líder (sin dueño) con al menos un seguidor residente
export function groupsOf(adv) {
  const by = new Map();
  for (const q of adv.bots.values()) {
    if (!q.res || q.dead) continue;
    const o = q.bot.owner; if (o == null) continue;
    let lead = adv.bots.get(o), guard = 0;
    while (lead?.bot?.owner != null && guard++ < 4) lead = adv.bots.get(lead.bot.owner);
    if (!lead?.res) continue;
    (by.get(lead.id) || by.set(lead.id, { leader: lead, members: [] }).get(lead.id)).members.push(q);
  }
  return [...by.values()];
}

// Una discusión. `H` = { speak, blog, remember, relOf, befriend, leave }
export function debate(adv, g, H) {
  const w = adv.worldFor(g.leader.id), all = [g.leader, ...g.members], n = all.length;
  const props = all.map(m => {
    const ev = evaluate(adv, m, H, n), ks = KINDS.slice().sort((a, b) => ev[b].s - ev[a].s), top = ks[0], conv = ev[top].s - ev[ks[1]].s;
    const aff = all.reduce((a, o) => a + (o === m ? 0 : H.relOf(o, m.name)), 0) / Math.max(1, n - 1);
    const weight = (0.6 + conv) * (1 + m.level / 60) * (1 + (m.stats.chr || 10) / 50) * (m === g.leader ? 1.15 : 1) * (1 + Math.min(0.3, aff * 0.04)) + w.rng() * 0.3;
    return { m, kind: top, why: ev[top].why, score: ev[top].s, conv: +conv.toFixed(2), weight: +weight.toFixed(2), ev };
  });
  const tally = { hunt: 0, crypt: 0, pl: 0 };
  for (const x of props) tally[x.kind] += x.weight;
  const winner = KINDS.reduce((a, k) => (tally[k] > tally[a] ? k : a), g.leader && props[0].kind);
  const rec = { at: w.time, winner, tally: Object.fromEntries(KINDS.map(k => [k, +tally[k].toFixed(2)])), lines: props.map(x => ({ who: x.m.name, kind: x.kind, why: x.why, weight: x.weight })), leader: g.leader.name };
  // la discusión se oye: el líder propone, el contrincante más fuerte contesta y el líder cierra
  const lang = g.leader.res.lang, lead = props[0], foe = props.slice(1).filter(x => x.kind !== lead.kind).sort((a, b) => b.weight - a.weight)[0];
  H.speak(adv, g.leader, `$§you suggest to your party that you all ${labelOf(lead.kind, "en")}, because ${lead.why}`);
  if (foe) H.speak(adv, foe.m, `$§you disagree with the plan to ${labelOf(lead.kind, "en")} and argue for ${labelOf(foe.kind, "en")} instead, because ${foe.why}`);
  const won = props.find(x => x.kind === winner && x.weight === Math.max(...props.filter(y => y.kind === winner).map(y => y.weight))) || lead;
  H.speak(adv, won.m === g.leader ? g.leader : won.m, `$§the party has decided by argument to ${labelOf(winner, "en")} (your side ${won.m === g.leader ? "won" : "was convinced"}); say it briefly`);
  // los que perdieron: acatan o dejan el grupo
  for (const x of props) if (x.kind !== winner && x.m !== g.leader && x.conv > 0.5 && w.rng() < 0.12 + x.conv * 0.15) { rec.left = (rec.left || []).concat(x.m.name); H.leave(adv, x.m, g.leader, `no estoy de acuerdo con el plan del grupo (${labelOf(winner)}) y prefiero ${labelOf(x.kind)}`); }
  g.leader.res._plan = { kind: winner, at: w.time, until: w.time + 6 * 60000 + Math.floor(w.rng() * 6 * 60000), by: won.m.name };
  g.leader.res._tripAt = winner === "hunt" ? g.leader.res._plan.until : w.time;
  H.blog(w, g.leader, `El grupo (${all.map(x => x.name).join(", ")}) lo debate: gana «${labelOf(winner)}» (${KINDS.map(k => k + " " + tally[k].toFixed(1)).join(", ")}).`);
  return rec;
}

// Cada pocos segundos: cada grupo sin plan vigente (o con miembros nuevos) debate qué hacer
export function tick(adv, H) {
  const w = adv.farm; if (w.time - (adv._councilAt ?? -1e9) < 5000) return;
  adv._councilAt = w.time;
  const cs = (adv.councils ||= new Map()), live = groupsOf(adv), seen = new Set();
  for (const g of live) {
    seen.add(g.leader.name);
    const r = g.leader.res, key = [g.leader, ...g.members].map(x => x.name).sort().join("|");
    let c = cs.get(g.leader.name); if (!c) { c = { leader: g.leader.name, since: w.time, history: [], members: [], key: "" }; cs.set(g.leader.name, c); }
    c.members = g.members.map(x => x.name);
    const lw = adv.worldFor(g.leader.id);
    if (g.leader.dead || lw.pvp || lw.map.kind === "dungeon" || r._trip || r._delve) { c.plan = r._plan; continue; }         // el plan en marcha no se discute: se ejecuta
    if (r._plan && w.time < r._plan.until && c.key === key) { c.plan = r._plan; continue; }
    if (g.members.some(m => adv.worldFor(m.id) !== lw || dist(m, g.leader) > 15)) continue;                          // se debate cuando están juntos
    const rec = debate(adv, g, H); c.key = key; c.plan = r._plan; c.history.unshift(rec); if (c.history.length > 14) c.history.pop();
  }
  for (const k of [...cs.keys()]) if (!seen.has(k)) { const c = cs.get(k); if (!c.ended) { c.ended = w.time; c.plan = null; } if (w.time - c.ended > 20 * 60000) cs.delete(k); }
}
