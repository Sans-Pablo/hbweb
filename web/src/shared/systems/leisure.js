// DESCANSOS DE LOS HABITANTES (INVENTO del port, no está en el original). Tras pelear un rato, el bot se toma un respiro y hace otra cosa:
//   fish  — pescar en la orilla de la granja (systems/fishing.js): vende el pescado (oro) y da el sobrante a su summon carnívoro;
//   farm  — cultivar (el mismo bucle de `bot.farm`, aunque no sea «granjero»);
//   trade — ir a la tienda: charla y puesto de venta (gather/stallAI de residents.js);
//   train — visitar el hospital de compañeros y cuidar/entrenar a sus summons (pets() de residents.js);
//   chat  — conversar con el guild;
//   backup — acudir a Promise Land cuando un compañero de guild pide refuerzos y le apetece (o está aburrido).
// Cada descanso anota cuánto rinde (`r.lz[kind] = {n, gold, ms}`), así el observador puede compararlos. Nada de azar propio: todo con `w.rng()`.
import { dist, DX, DY } from "../const.js";
import * as Inv from "../inventory.js";
import * as Fishing from "./fishing.js";
import * as Comp from "./companion.js";
import * as Guild from "./guild.js";
import { newInst } from "./itemsys.js";
import { gold as ledger } from "./ledger.js";

export const KINDS = {
  fish: ["Pescando", "Fishing"], farm: ["Cultivando", "Farming"], trade: ["Comerciando", "Trading"], train: ["Entrenando a su summon", "Training its summon"],
  chat: ["Charlando con el guild", "Chatting with the guild"], backup: ["Acudiendo a un refuerzo", "Answering a backup call"],
};
const WEIGHTS = {
  warrior: { fish: 1, farm: 1, trade: 1, train: 1, chat: 2 }, hunter: { fish: 3, farm: 1, trade: 1, train: 2, chat: 1 }, trader: { fish: 3, farm: 1, trade: 3, train: 1, chat: 1 },
  wanderer: { fish: 2, farm: 2, trade: 1, train: 1, chat: 1 }, scholar: { fish: 1, farm: 1, trade: 1, train: 3, chat: 2 },
};
const FIGHT_PAUSE = 150000;                                                   // un descanso cada 2,5-6 min de pelea
const LEN = { fish: [70000, 70000], farm: [60000, 50000], trade: [240000, 1], train: [240000, 1], chat: [1, 1] };

// Orillas: casillas transitables junto a agua (se calculan una vez por mapa)
const shores = new WeakMap();
export function shoreSpots(w) {
  let s = shores.get(w.grid); if (s) return s;
  s = [];
  const g = w.grid;
  for (let y = 2; y < g.h - 2; y++) for (let x = 2; x < g.w - 2; x++) {
    if (g.blocked(x, y) || Fishing.isWater(w, x, y)) continue;
    let sea = 0;
    for (let d = 1; d <= 8; d++) if (Fishing.isWater(w, x + DX[d], y + DY[d])) sea++;
    if (sea >= 2) s.push({ x, y });
  }
  shores.set(w.grid, s);
  return s;
}
const stat = (r, k) => ((r.lz ||= {})[k] ||= { n: 0, gold: 0, ms: 0 });

function busy(adv, w, p, r, home) {
  const b = p.bot;
  return w !== home || p.dead || b.owner != null || r._pend || r._trip || r._delve || r._pet || r._gather || r._stall || r._reb || b.rest || b.travel || w.pvp || p.hp < p.maxHp * 0.75 || w.time - (p.lastCombat || -1e9) < 4000;
}
function pick(w, p, r, G, H) {
  const wt = { ...(WEIGHTS[r.arch] || WEIGHTS.wanderer) };
  const rod = p.bag.some(i => i.id === Fishing.ROD) || p.gold >= (w.data.item(Fishing.ROD)?.price || 0) + 50;
  if (!rod || !shoreSpots(w).length) delete wt.fish;
  if (!Comp.activeBall(p) && !p.bag.some(i => i.comp)) delete wt.train;
  if (!G || Guild.onlineMembers(H.reg(), G).length < 2) delete wt.chat;
  const tot = Object.values(wt).reduce((a, n) => a + n, 0); let x = w.rng() * tot;
  for (const [k, n] of Object.entries(wt)) if ((x -= n) < 0) return k;
  return "fish";
}
function ensureRod(w, p) {
  let rod = p.bag.find(i => i.id === Fishing.ROD); if (rod) return rod;
  const d = w.data.item(Fishing.ROD); if (!d) return null;
  const price = Math.max(0, d.price | 0); if (p.gold < price) return null;
  rod = newInst(w, Fishing.ROD, 1);
  if (!Inv.canCarry(p, w.data, d, 1, rod)) return null;
  ledger(w, p, -price, "fishing_rod"); Inv.addToBag(p, w.data, rod);
  return rod;
}
// Vende el pescado (se queda con uno si su summon carnívoro tiene hambre)
const FISH_KEEP = 24, fishLeft = p => p.bag.reduce((n, i) => n + (Fishing.isFish(i.id) ? i.count || 1 : 0), 0);
function cashIn(adv, w, p, r, H) {
  const ball = Comp.activeBall(p);
  let gold = 0, n = 0, fed = 0;
  for (const i of [...p.bag]) {
    if (!Fishing.isFish(i.id)) continue;
    if (ball && !ball.comp.down && Comp.hpOf(p, ball.comp) < Comp.maxOf(p, ball.comp) && Comp.tasteOf?.(ball.comp.sp, i.id) === "love" && fed < 3) {
      const before = Comp.hpOf(p, ball.comp);
      if (adv.command(p.id, { t: "use", uid: i.uid, dest: ball.uid }) !== false && Comp.hpOf(p, ball.comp) > before) { fed++; continue; }
    }
    if (r.job === "fisher" && fishLeft(p) <= FISH_KEEP) continue;                       // 0.78.0: el pescador fijo guarda la pesca para su puesto (vende solo lo que pasa de FISH_KEEP piezas)
    const c = i.count || 1; gold += (Fishing.FISH_PRICE[i.id] ?? 1) * c; n += c; Inv.removeFromBag(p, i.uid);
  }
  ledger(w, p, gold, "fish_sale");
  return { gold, n, fed };
}

function begin(adv, w, p, r, home, kind, H) {
  const b = p.bot, now = w.time, G = Guild.guildOf(w, p);
  const L = { kind, at: now, until: now + (LEN[kind]?.[0] || 1) + Math.floor(w.rng() * (LEN[kind]?.[1] || 1)), gold0: p.gold };
  switch (kind) {
    case "fish": {
      const rod = ensureRod(w, p); if (!rod) return false;
      const sp = shoreSpots(w).filter(s => dist(s, p) < 90).sort((a, c) => dist(a, p) - dist(c, p)).slice(0, 25);
      const s = sp[Math.floor(w.rng() * sp.length)] || shoreSpots(w)[0]; if (!s) return false;
      L.spot = s; L.goUntil = now + 90000; L.until = now + 90000 + (LEN.fish[0] + Math.floor(w.rng() * LEN.fish[1]));
      b.travel = { x: s.x, y: s.y, w, until: now + 90000 }; b.path = null; b.goal = null; b.fails = 0;
      H.blog(w, p, `Descanso: me voy a pescar a la orilla (${s.x},${s.y}).`); break;
    }
    case "farm": L.wasFarmer = !!b.farmer; b.farmer = true; H.blog(w, p, "Descanso: me pongo a cultivar un rato."); break;
    case "trade": r._gatherAt = now; r._stallAt = now; H.blog(w, p, "Descanso: me paso por la tienda a comerciar."); break;
    case "train": r._petAt = now; r._petThink = 0; H.blog(w, p, "Descanso: voy a cuidar y entrenar a mi summon."); break;
    case "chat": H.gsay(adv, p, H.gchat(adv, w, p, G)); break;
  }
  r._leis = L; r._lzCount = (r._lzCount | 0) + 1;
  return true;
}
function end(adv, w, p, r, why, H) {
  const L = r._leis; if (!L) return; r._leis = null;
  const b = p.bot, st = stat(r, L.kind);
  if (L.kind === "farm") b.farmer = L.wasFarmer;
  let gain = 0, txt = null;
  if (L.kind === "fish") {
    const c = cashIn(adv, w, p, r, H); gain = c.gold; st.n += c.n;
    if (c.n || c.fed) txt = [`Pesqué ${c.n + c.fed} peces: vendí ${c.n} por ${c.gold} de oro` + (c.fed ? ` y di ${c.fed} a mi summon.` : "."), `I caught ${c.n + c.fed} fish: sold ${c.n} for ${c.gold} gold` + (c.fed ? ` and fed ${c.fed} to my summon.` : ".")];
    b.hold = 0;
  } else if (L.kind === "farm") { gain = Math.max(0, p.gold - L.gold0); st.n++; }
  else st.n++;
  st.gold += gain; st.ms += w.time - L.at;
  if (txt) H.remember(p, txt[0], txt[1]);
  H.blog(w, p, `Termino el descanso (${KINDS[L.kind][0].toLowerCase()}${why ? ", " + why : ""}).`);
}

// Un tick de ocio (cada 500 ms, desde think() de residents.js)
export function tick(adv, w, p, r, home, H) {
  const b = p.bot, now = w.time;
  const L = r._leis;
  if (L) {
    if (p.dead || b.owner != null || r._pend || r._trip || r._delve || r._stall || p.hp < p.maxHp * 0.6 || w.pvp || w !== home) return end(adv, w, p, r, p.dead ? "muerto" : "interrumpido", H);
    if (now > L.until) return end(adv, w, p, r, "", H);
    if (L.kind === "fish") {
      if (!p.bag.some(i => i.id === Fishing.ROD)) return end(adv, w, p, r, "sin caña", H);
      if (dist(p, L.spot) > 1) {
        if (now > L.goUntil) return end(adv, w, p, r, "no llego a la orilla", H);
        if (!b.travel && !b.target) { b.travel = { x: L.spot.x, y: L.spot.y, w, until: now + 40000 }; b.path = null; b.goal = null; b.fails = 0; }
        return;
      }
      b.travel = null; b.hold = Math.max(b.hold || 0, now + 2500);
      if (!Fishing.faceWater(w, p)) return end(adv, w, p, r, "sin agua", H);
      if (now >= (L.castAt || 0)) {
        L.castAt = now + Fishing.COOLDOWN + 300;
        const rod = p.bag.find(i => i.id === Fishing.ROD);
        const n0 = p.bag.reduce((a, i) => a + (Fishing.isFish(i.id) ? i.count || 1 : 0), 0);
        adv.command(p.id, { t: "use", uid: rod.uid });
        if (p.bag.reduce((a, i) => a + (Fishing.isFish(i.id) ? i.count || 1 : 0), 0) > n0) L.n = (L.n | 0) + 1;
        if (L.n >= 25 || p.bag.length >= 55) return end(adv, w, p, r, "mochila llena de pescado", H);
      }
    } else if (L.kind === "farm") { if (!b.farmer) b.farmer = true; }
    else if (L.kind === "trade") { if (r._gather || r._stall) L.seen = true; else if (L.seen || now > L.at + 20000) end(adv, w, p, r, "", H); }
    else if (L.kind === "train") { if (r._pet) L.seen = true; else if (L.seen || now > L.at + 20000) end(adv, w, p, r, "", H); }
    else if (now > L.at + 2000) end(adv, w, p, r, "", H);
    return;
  }
  // ¿toca descansar? Solo cuando lleva un rato peleando
  if (r.job === "farmer") return;                                                    // el granjero fijo no descansa: el campo es su oficio
  const fisher = r.job === "fisher";                                                 // el pescador fijo pesca casi sin parar (vende al terminar cada tanda)
  if (now < (r._lzAt ||= now + (fisher ? 3000 : 60000 + Math.floor(w.rng() * 120000)))) return;
  if (busy(adv, w, p, r, home)) { r._lzAt = now + (fisher ? 4000 : 15000); return; }
  r._lzAt = now + (fisher ? 6000 : FIGHT_PAUSE + Math.floor(w.rng() * 210000));
  if (!fisher && w.rng() < 0.15) return;                                             // hoy no le apetece
  const G = Guild.guildOf(w, p), kind = fisher ? "fish" : pick(w, p, r, G, H);
  begin(adv, w, p, r, home, kind, H);
}

// ---------------------------------------------------------------- refuerzos de guild
// Un miembro de guild que lucha en Promise Land y se ve en apuros pide backup por el chat del guild; los demás acuden si les apetece
// (más si están de descanso, aburridos, o aprecian a quien lo pide). Una petición de un humano («backup», «ayuda», «help») cuenta igual.
export const BACKUP_WORDS = /\b(backup|refuerzos?|ayuda|socorro|help|sos)\b/i;
export function backupCall(adv, w, p, r, G, H, text) {
  if (!G || w.time < (G._bkAt || 0)) return false;
  G._bkAt = w.time + 240000;
  const pit = H.pitNear(adv, p);
  G._bk = { by: p.name, at: w.time, until: w.time + 150000, pit: pit ? { id: pit.id, name: pit.name, rect: pit.rect } : null, side: p.side };
  H.gsay(adv, p, text || H.line(p, "gbackup", w, { m: pit ? pit.id : "Promise Land" }));
  H.blog(w, p, "Pido refuerzos al guild en Promise Land.");
  return true;
}
export function backupTick(adv, w, p, r, home, G, H) {
  const now = w.time, b = p.bot;
  // quien pelea en Promise Land y va perdiendo, pide ayuda
  if (w.pvp && !p.dead && p.hp < p.maxHp * 0.55 && G && [...w.ents.values()].some(e => e.kind === "player" && e.side !== p.side && !e.dead && dist(e, p) < 12)) backupCall(adv, w, p, r, G, H);
  const bk = G?._bk;
  if (!bk || bk.by === p.name || now > bk.until || r._bkSeen === bk.at) return;
  if (p.side !== bk.side && bk.side) return;
  r._bkSeen = bk.at;
  if (busy(adv, w, p, r, home) && !(r._leis && w === home)) return;
  const bored = !!r._leis || now - (p.lastCombat || -1e9) > 120000;
  const friend = (r.rel?.[bk.by] | 0) >= 2;
  const p_go = 0.25 + (bored ? 0.3 : 0) + (friend ? 0.25 : 0) + (p.level >= 20 ? 0.1 : 0) - (r.scare ? 0.1 * r.scare : 0);
  if (w.rng() > p_go) { if (w.rng() < 0.4) H.gsay(adv, p, H.line(p, "gnobackup", w, {}, bk.by)); return; }
  const tps = (adv.maps[home.map.id]?.meta.teleports || []).filter(t => t.map === "2ndmiddle"); if (!tps.length || w !== home) return;
  if (r._leis) end(adv, w, p, r, "me llaman", H);
  const tp = tps[tps.length >> 1];
  r._trip = { go: true, goUntil: now + 120000, until: now + 360000, pit: bk.pit, guild: G.name, backup: bk.by };
  b.travel = { x: tp.x, y: tp.y, w, until: now + 120000 }; b.path = null; b.goal = null; b.fails = 0;
  r._leisBk = now; (r.lz ||= {}).backup = stat(r, "backup"); stat(r, "backup").n++;
  H.gsay(adv, p, H.line(p, "gbackupgo", w, {}, bk.by));
  H.blog(w, p, `${bk.by} pide refuerzos en Promise Land: ${bored ? "estoy aburrido, " : ""}voy.`);
  H.remember(p, `Acudí a ayudar a ${bk.by} en Promise Land.`, `I went to back up ${bk.by} in Promise Land.`);
  H.befriend(p, bk.by, 1);
}
// Un humano pide refuerzos en el chat del guild («backup», «ayuda»…) desde Promise Land
export function humanCall(adv, w, G, ev) {
  if (!G || !BACKUP_WORDS.test(String(ev.text)) || w.time < (G._bkAt || 0)) return;
  const e = [...w.ents.values()].find(q => q.kind === "player" && q.name === ev.name && !adv.bots.has(q.id)); if (!e || !w.pvp) return;
  G._bkAt = w.time + 240000; G._bk = { by: ev.name, at: w.time, until: w.time + 150000, pit: null, side: e.side };
}
