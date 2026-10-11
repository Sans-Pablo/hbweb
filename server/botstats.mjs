// Estadísticas y análisis de comportamiento de los habitantes (bots) para el panel de administración.
//  - `openBotStats(adventure, log)`: guarda en memoria el registro de acciones y las propuestas de cada bot, y cada 10 s toma una muestra de su estado
//    (qué hace, dónde está, si se ha movido) para saber cómo reparte el tiempo y detectar atascos.
//  - `summaries()`: una ficha por bot (personalidad, guild, meta, estado, números, relaciones).
//  - `analyze()`: patrones, anomalías y afinidades entre bots (matriz, parejas, grupos) a partir de las fichas.
import * as Residents from "../web/src/shared/systems/residents.js";
import * as Council from "../web/src/shared/systems/council.js";

const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mad = a => { const m = median(a); return median(a.map(x => Math.abs(x - m))) || 1; };
const top = (o, n = 3) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).slice(0, n);

export function openBotStats(adv, log = () => {}) {
  const H = new Map();                                                    // nombre -> { log, ideas, states, pos, since, samples }
  const hist = name => { let h = H.get(name); if (!h) H.set(name, (h = { log: [], ideas: [], states: {}, pos: null, still: 0, samples: 0, born: Date.now() })); return h; };
  adv.logSink = (p, text, time) => { const h = hist(p.name), l = h.log; l.push({ t: Math.round(time / 1000), m: String(text).slice(0, 220) }); if (l.length > 400) l.splice(0, l.length - 400); };
  const stateOf = b => { const br = b.bot || {}, t = br.target; return b.dead ? "muerto" : b.trade ? "comercia" : br.travel ? "viaja" : t ? "lucha" : br.rest ? "descansa" : br.owner != null ? "sigue al líder" : b.res?._delve ? "cripta" : b.res?._gather ? "charla en la tienda" : "pasea"; };
  const sample = () => {
    for (const b of adv.residents()) {
      const h = hist(b.name), st = stateOf(b), w = adv.worldFor(b.id), key = (w.map.id || "") + ":" + b.x + ":" + b.y;
      h.exp0 ??= b.exp; h.states[st] = (h.states[st] || 0) + 1; h.samples++;
      h.still = h.pos === key && st !== "descansa" && st !== "comercia" && st !== "muerto" ? h.still + 1 : 0; h.pos = key; h.st = st;
    }
  };
  const timer = setInterval(() => { try { sample(); } catch (e) { log("[botstats] " + e.message); } }, 10000); timer.unref?.();
  const idea = r => { if (!r?.bot) return; const h = hist(r.bot); h.ideas.push({ kind: r.kind, topic: r.topic, es: r.es || r.text || "", en: r.en || "", lvl: r.lvl, map: r.map, t: Date.now() }); if (h.ideas.length > 40) h.ideas.shift(); };

  // progreso hacia las metas de vida (0-100 %): bajas enemigas, nivel máximo, cripta completa, summons al máximo, mejores objetos y vida social
  function life(b) {
    const w = adv.worldFor(b.id), bs = b.bag.filter(i => i.comp), maxed = new Set(bs.filter(i => i.comp.lvl >= 50).map(i => i.comp.sp)).size;
    const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
    return { ek: b.ek || 0, level: clamp(100 * b.level / 50), crypt: clamp(100 * ((b.delve?.deepest || 1) - 1) / 20), pets: clamp(100 * maxed / 6), petsN: bs.length, gear: clamp(100 * Residents.avgIlvl(w, b) / 40), social: clamp(100 * (Object.keys(b.res.rel || {}).length + (b.res.trades | 0) * 2) / 30) };
  }
  function summary(b) {
    const r = b.res, h = hist(b.name), w = adv.worldFor(b.id), guild = b.guild ? { name: b.guild.name, rank: b.guild.rank } : null;
    const mins = Math.max(1, (Date.now() - h.born) / 60000);
    const rel = Object.entries(r.rel || {}).sort((a, c) => c[1] - a[1]);
    const total = h.samples || 1;
    return {
      name: b.name, lv: b.level, side: b.side, arch: r.arch, lang: r.lang, origin: r.origin?.[0], motive: r.motive?.[0], fear: r.fear?.[0], quirk: r.quirk?.[0],
      life: life(b), story: Residents.storyOf(b, "es"), goal: Residents.goalText(r.goal, "es"), guild, party: b.party?.names?.filter(n => n !== b.name) || [],
      act: h.st || stateOf(b), map: w.map.name || w.map.id, x: b.x, y: b.y, hp: b.hp, mh: b.maxHp, gold: b.gold, bank: b.bank?.length || 0, bag: b.bag.length,
      kills: b.kills || 0, deaths: r.deaths | 0, ek: b.ek || 0, scare: r.scare | 0, trades: r.trades | 0, chats: r.chats | 0, exp: b.exp,
      expMin: (b.exp - (h.exp0 ?? b.exp)) / mins, mins: Math.round(mins), still: Math.round(h.still * 10 / 60 * 10) / 10,
      kinds: top(b.kills >= 0 ? b.kinds : {}, 5), killedBy: top(r.qa?.deaths, 3), dlv: r.dlv || {}, ethos: null,
      rel: rel.slice(0, 8), relN: rel.length, states: Object.fromEntries(Object.entries(h.states).map(([k, v]) => [k, Math.round(100 * v / total)])),
      logN: h.log.length, ideasN: h.ideas.length, summon: b.bag.filter(i => i.comp).map(i => `${i.comp.nm}(${i.comp.sp} nv${i.comp.lvl})`),
    };
  }
  const summaries = () => adv.residents().map(summary);
  const detail = name => {
    const b = adv.residents().find(x => x.name.toLowerCase() === String(name).toLowerCase()); if (!b) return null;
    const h = hist(b.name), r = b.res;
    return { ...summary(b), log: h.log.slice(-200).reverse(), ideas: h.ideas.slice().reverse(), mem: (r.mem || []).map(m => m.es), rel: Object.entries(r.rel || {}).sort((a, c) => c[1] - a[1]),
      dlv: r.dlv || {}, dd: r.dd || {}, insights: (r.insights || []).slice().reverse(), qa: { kills: top(r.qa?.kills, 8), deaths: top(r.qa?.deaths, 8), rej: top(r.qa?.rej, 6), pvp: r.qa?.pvp } };
  };

  // ---------------------------------------------------------------- análisis
  function analyze() {
    const S = summaries(), names = S.map(s => s.name), idx = new Map(names.map((n, i) => [n, i]));
    const rel = (a, b) => { const x = adv.residents().find(e => e.name === a)?.res?.rel?.[b] || 0; return x; };
    const bots = adv.residents(), byName = new Map(bots.map(b => [b.name, b]));
    const M = names.map(a => names.map(b => a === b ? 0 : ((byName.get(a).res.rel[b] || 0) + (byName.get(b).res.rel[a] || 0)) / 2));
    const pairs = [];
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) pairs.push({ a: names[i], b: names[j], v: M[i][j], ab: rel(names[i], names[j]), ba: rel(names[j], names[i]), sameGuild: !!S[i].guild && S[i].guild?.name === S[j].guild?.name, sameArch: S[i].arch === S[j].arch });
    const best = pairs.filter(p => p.v > 0).sort((x, y) => y.v - x.v).slice(0, 12), worst = pairs.filter(p => p.v < 0).sort((x, y) => x.v - y.v).slice(0, 6);
    // grupos de afinidad: componentes conexas con afinidad media >= 3
    const par = names.map((_, i) => i), find = i => (par[i] === i ? i : (par[i] = find(par[i])));
    for (const p of pairs) if (p.v >= 3) par[find(idx.get(p.a))] = find(idx.get(p.b));
    const groups = new Map(); names.forEach((n, i) => { const g = find(i); (groups.get(g) || groups.set(g, []).get(g)).push(n); });
    const clusters = [...groups.values()].filter(g => g.length > 1).sort((a, b) => b.length - a.length).map(g => ({ names: g, guilds: [...new Set(g.map(n => S[idx.get(n)].guild?.name || "—"))] }));
    const guildPairs = pairs.filter(p => p.sameGuild), otherPairs = pairs.filter(p => !p.sameGuild);
    const avg = a => (a.length ? a.reduce((x, p) => x + p.v, 0) / a.length : 0);
    const archAff = {};
    for (const p of pairs) { const k = [S[idx.get(p.a)].arch, S[idx.get(p.b)].arch].sort().join("+"); (archAff[k] ||= []).push(p.v); }
    // ---- anomalías
    const A = [], add = (sev, who, what) => A.push({ sev, who, what });
    const lvMed = median(S.map(s => s.lv)), lvMad = mad(S.map(s => s.lv));
    const xpMed = median(S.filter(s => s.mins >= 10).map(s => s.expMin)), dMed = median(S.map(s => s.deaths / Math.max(1, s.mins / 60))), dMad = mad(S.map(s => s.deaths / Math.max(1, s.mins / 60)));
    const goldMed = median(S.map(s => s.gold));
    for (const s of S) {
      const h = hist(s.name);
      if (s.still >= 4 && s.act !== "charla en la tienda") add(3, s.name, `Quieto ${s.still} min en ${s.map} (${s.x},${s.y}) con estado «${s.act}»: posible atasco.`);
      if (s.mins >= 15 && xpMed > 0 && s.expMin < xpMed * 0.25) add(2, s.name, `Experiencia/min muy baja (${s.expMin.toFixed(0)} frente a mediana ${xpMed.toFixed(0)}).`);
      const dr = s.deaths / Math.max(1, s.mins / 60); if (s.deaths >= 3 && dr > dMed + 3 * dMad) add(3, s.name, `Muere demasiado: ${s.deaths} muertes (${dr.toFixed(1)}/h), sobre todo por ${s.killedBy.map(k => k[0] + " ×" + k[1]).join(", ") || "?"}.`);
      if (s.killedBy[0] && s.killedBy[0][1] >= 3) add(2, s.name, `Repite muerte contra «${s.killedBy[0][0]}» (${s.killedBy[0][1]} veces): no está aprendiendo.`);
      if (Math.abs(s.lv - lvMed) > 4 * lvMad + 3) add(1, s.name, `Nivel ${s.lv} muy distinto a la mediana (${lvMed}).`);
      if (goldMed > 0 && s.gold > goldMed * 4 && s.gold > 20000) add(1, s.name, `Acumula oro (${s.gold}) sin gastarlo: ¿no encuentra qué comprar?`);
      if (s.mins >= 20 && s.relN === 0) add(1, s.name, `Sin ninguna relación social tras ${s.mins} min.`);
      const last = h.log.filter(l => !/^(Objetivo|💭|📝|Mi summon|Subí|Busco|Recojo|Vida \d+%: bebo)/.test(l.m)).slice(-40).map(l => l.m.replace(/\d+/g, "#")), freq = {}; for (const m of last) freq[m] = (freq[m] || 0) + 1;
      const [mm, nn] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0] || ["", 0];
      if (last.length >= 30 && nn / last.length > 0.6) add(2, s.name, `Bucle de acciones: «${mm.slice(0, 80)}» repetido ${nn} de las últimas ${last.length} veces.`);
      if (s.bag >= 45) add(2, s.name, `Mochila casi llena (${s.bag} objetos): no está vendiendo ni guardando.`);
      if (s.act === "cripta" && s.mins > 0 && (s.states["cripta"] || 0) > 70) add(1, s.name, `Pasa ${s.states["cripta"]}% del tiempo en la cripta.`);
    }
    // ---- patrones generales
    const P = [], acts = {}, kinds = {}, deathsBy = {};
    for (const s of S) { for (const [k, v] of Object.entries(s.states)) acts[k] = (acts[k] || 0) + v / S.length; for (const [k, v] of s.kinds) kinds[k] = (kinds[k] || 0) + v; for (const [k, v] of s.killedBy) deathsBy[k] = (deathsBy[k] || 0) + v; }
    const killTot = Object.values(kinds).reduce((a, b) => a + b, 0) || 1;
    const topKinds = top(kinds, 6).map(([k, v]) => ({ k, n: v, pct: Math.round(100 * v / killTot) }));
    if (topKinds[0] && topKinds[0].pct > 40) P.push(`Un solo monstruo concentra el ${topKinds[0].pct}% de las muertes causadas (${topKinds[0].k}): poca variedad de presas.`);
    const guilded = S.filter(s => s.guild).length;
    P.push(`${guilded} de ${S.length} bots están en un guild (${new Set(S.filter(s => s.guild).map(s => s.guild.name)).size} guilds).`);
    const traders = S.filter(s => s.trades > 0).length, totalTrades = S.reduce((a, s) => a + s.trades, 0) / 2;
    P.push(`Comercio: ${Math.round(totalTrades)} tratos cerrados entre ${traders} bots.`);
    if (guildPairs.length && otherPairs.length) P.push(`Afinidad media dentro de un mismo guild: ${avg(guildPairs).toFixed(1)}; entre bots de distinto guild: ${avg(otherPairs).toFixed(1)}.`);
    const dead = S.filter(s => s.act === "muerto").length; if (dead) P.push(`${dead} bots muertos ahora mismo.`);
    const sc = S.filter(s => s.scare > 0).length; if (sc) P.push(`${sc} bots con miedo tras morir (más prudentes).`);
    const arch = {}; for (const s of S) { const a = (arch[s.arch] ||= { n: 0, lv: 0, deaths: 0, xp: 0 }); a.n++; a.lv += s.lv; a.deaths += s.deaths; a.xp += s.expMin; }
    const archStats = Object.entries(arch).map(([k, a]) => ({ arch: k, n: a.n, lv: Math.round(a.lv / a.n), deaths: +(a.deaths / a.n).toFixed(1), expMin: Math.round(a.xp / a.n) }));
    // ---- propuestas de mejora (agregadas del informe de cada bot)
    const ideas = new Map();
    for (const [name, h] of H) for (const i of h.ideas) { const k = i.kind + ":" + i.topic; const o = ideas.get(k) || { kind: i.kind, topic: i.topic, es: i.es, en: i.en, bots: new Set(), n: 0 }; o.bots.add(name); o.n++; ideas.set(k, o); }
    const ideaList = [...ideas.values()].sort((a, b) => b.bots.size - a.bots.size || b.n - a.n).slice(0, 40).map(o => ({ kind: o.kind, topic: o.topic, es: o.es, en: o.en, bots: [...o.bots], n: o.n }));
    return { at: Date.now(), n: S.length, names, matrix: M, best, worst, clusters, affinity: { guild: avg(guildPairs), other: avg(otherPairs), byArch: Object.entries(archAff).map(([k, a]) => ({ k, v: a.reduce((x, y) => x + y, 0) / a.length, n: a.length })).sort((a, b) => b.v - a.v) },
      anomalies: A.sort((a, b) => b.sev - a.sev), patterns: P, acts: Object.entries(acts).map(([k, v]) => ({ k, pct: Math.round(v) })).sort((a, b) => b.pct - a.pct), topKinds, deathsBy: Object.entries(deathsBy).sort((a, b) => b[1] - a[1]).slice(0, 8), archStats, ideas: ideaList };
  }
  // PARTIES: grupos de habitantes (líder + seguidores), qué plan decidieron y cómo lo discutieron (council.js)
  function parties() {
    const out = [], seen = new Set(), cs = adv.councils || new Map();
    const card = (b) => { const w = adv.worldFor(b.id); return { name: b.name, lv: b.level, arch: b.res?.arch, hp: Math.round(100 * b.hp / Math.max(1, b.maxHp)), map: w.map.name || w.map.id, act: hist(b.name).st || "", goal: b.res?.goal ? Residents.goalText(b.res.goal, "es") : "" }; };
    for (const g of Council.groupsOf(adv)) {
      const c = cs.get(g.leader.name) || {}, pl = g.leader.res._plan;
      seen.add(g.leader.name);
      out.push({ live: true, leader: card(g.leader), members: g.members.map(card), plan: pl ? { kind: pl.kind, label: Council.labelOf(pl.kind), by: pl.by, secs: Math.max(0, Math.round((pl.until - adv.farm.time) / 1000)) } : null, history: (c.history || []).map(h => ({ ...h, winnerLabel: Council.labelOf(h.winner) })), since: Math.round(((adv.farm.time - (c.since ?? adv.farm.time)) / 1000)) });
    }
    for (const [k, c] of cs) if (!seen.has(k) && c.history.length) out.push({ live: false, leader: { name: k }, members: c.members.map(n => ({ name: n })), plan: null, history: c.history.map(h => ({ ...h, winnerLabel: Council.labelOf(h.winner) })), since: 0 });
    return out;
  }
  return { summaries, detail, analyze, idea, sample, hist, parties };
}
