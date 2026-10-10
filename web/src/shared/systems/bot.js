// BOT: jugador simulado (INVENTO del port, herramienta de admin). Vive en el mundo como un jugador más (kind "player", mochila, equipo,
// nivel, grupo) y toma sus decisiones con las MISMAS órdenes que un cliente (`adv.command`: move, attack, pickup, equip, use, stat, say,
// respawn), así que no tiene ventajas ni atajos de reglas. Pensado para rellenar el servidor con jugadores que hagan grupo y cacen.
//  - Rol «follow»: acompaña a su dueño (mismo grupo) y ataca lo que lo amenaza; si el dueño cambia de mapa/cripta lo sigue.
//  - Rol «solo»: caza por su cuenta alrededor del punto donde nació.
//  - Cada pocos segundos hace «recados» (sin ir a la tienda: compra por catálogo con su oro, ver `errands`): reparte puntos, compra y
//    se equipa lo mejor que le llega, repone pociones y comida, vende lo que sobra y recoge botín.
//  - Sube de nivel matando (giveExp normal). Evita monstruos que lo matarían en 3 golpes y descansa con poca vida.
import { dist, dirTo, DX, DY, LIMITS, PLAYER } from "../const.js";
import { findPath, greedyStep } from "../path.js";
import { EQUIP, ITYPE, EFFECT, MAX_ITEMS } from "../items.js";
import * as Inv from "../inventory.js";
import * as R from "../rules.js";
import { reachOf, MAX_LEVEL } from "./combatsys.js";
import { groundTop } from "./ground.js";
import { newInst } from "./itemsys.js";
import * as Party from "./party.js";
import * as Tut from "./tutorial.js";
import { canFight } from "./combatsys.js";

const NAMES = ["Aldric", "Brenna", "Cael", "Dorna", "Edric", "Fenna", "Garrick", "Helga", "Ivo", "Jessa", "Korin", "Lyra", "Marek", "Nessa", "Orin", "Petra", "Quill", "Rhea", "Soren", "Talia", "Ulric", "Vesna", "Wynn", "Yara", "Zeke"];
const GOLD = 90;                                                       // Item.cfg: Gold
const THINK_MS = 100, ERRAND_MS = 3500, TARGET_MS = 300;
const SKIP_WEAPON = /Bow|Wand|Staff|Rod|Arrow|Hammer\(M\)|Pickaxe|Hoe/;

export const isBot = p => !!p?.bot;

// ---------------------------------------------------------------- creación
export function pickName(taken) {
  for (const n of NAMES) if (!taken.has(n.toLowerCase())) return n;
  for (let i = 2; ; i++) { const n = NAMES[i % NAMES.length] + i; if (!taken.has(n.toLowerCase())) return n; }
}
export const BOT_STATS = { str: 14, vit: 12, dex: 12, int: 10, mag: 10, chr: 10 };
// Prepara a un jugador recién creado: nivel, oro y cerebro
export function init(w, p, opts = {}) {
  const lvl = Math.max(1, Math.min(opts.level | 0 || 1, MAX_LEVEL));
  if (opts.keep) {}                                                      // habitante cargado de su partida: conserva nivel y oro
  else if (lvl > 1) { p.level = lvl; p.exp = R.expForLevel(lvl); p.pool += (lvl - 1) * R.LEVELUP_POINTS; }
  if (!opts.keep) p.gold += 400 + lvl * 250;
  Tut.init(p, false);                                                    // un bot no hace el tutorial (el observador no debe verlo)
  w.recalc(p);
  p.bot = { owner: opts.owner ?? null, next: 0, errand: 0, tgtAt: 0, target: null, path: null, goal: null, bad: new Set(), home: { x: p.x, y: p.y }, lvl: p.level, said: 0, fails: 0 };
  if (!opts.keep) errands(w, p, p.bot, true);
  p.hp = p.maxHp; p.mp = p.maxMp; p.sp = p.maxSp;
}

// ---------------------------------------------------------------- recados (reparto de puntos, compras, equipo, comida)
const catalogs = new WeakMap();
function catalog(data) {
  let c = catalogs.get(data);
  if (c) return c;
  c = { gear: new Map(), potion: null, foods: [] };
  for (const d of data.items.values()) {
    if (!d || !(d.price > 0) || !d.name) continue;
    if (d.type === ITYPE.EQUIP && d.equipPos > 0 && d.equipPos <= EQUIP.FULLBODY && d.equipPos !== EQUIP.NECK && d.equipPos !== EQUIP.RFINGER && d.equipPos !== EQUIP.LFINGER && d.equipPos !== EQUIP.BACK && d.equipPos !== EQUIP.FULLBODY) {
      if ((d.equipPos === EQUIP.RHAND || d.equipPos === EQUIP.TWOHAND) && SKIP_WEAPON.test(d.name)) continue;
      if (d.effectType === EFFECT.ATTACK_SPECABLTY || d.effectType === EFFECT.DEFENSE_SPECABLTY) continue;
      const slot = d.equipPos === EQUIP.TWOHAND ? EQUIP.RHAND : d.equipPos;
      if (!c.gear.has(slot)) c.gear.set(slot, []);
      c.gear.get(slot).push(d);
    }
  }
  for (const l of c.gear.values()) l.sort((a, b) => b.price - a.price);
  c.potion = data.named("RedPotion");
  c.foods = ["Meat", "Baguette"].map(n => data.named(n)).filter(Boolean);
  catalogs.set(data, c);
  return c;
}
const slotOf = d => (d.equipPos === EQUIP.TWOHAND ? EQUIP.RHAND : d.equipPos);
const countOf = (p, id) => p.bag.reduce((a, i) => a + (i.id === id ? i.count || 1 : 0), 0);

function spendPoints(w, p) {
  if (p.pool <= 0) return;
  const total = p.pool, str = Math.ceil(total * 0.5), vit = Math.ceil(total * 0.3);
  for (const [stat, n] of [["str", str], ["vit", vit], ["dex", total - str - vit]]) if (n > 0) w.command(p.id, { t: "stat", stat, n });
  if (p.pool > 0) w.command(p.id, { t: "stat", stat: "str", n: p.pool });
}
function buy(w, p, d, n = 1) {
  const cost = d.price * n;
  if (p.gold < cost) return null;
  const inst = newInst(w, d.id, n);
  if (!Inv.canCarry(p, w.data, d, n, inst) || (p.bag.length >= MAX_ITEMS && !p.bag.some(i => i.id === d.id))) return null;
  p.gold -= cost;
  Inv.addToBag(p, w.data, inst);
  return inst;
}
function tryEquip(w, p, b, inst) {
  const before = { ...p.equip };
  w.command(p.id, { t: "equip", uid: inst.uid });
  if (p.equip[w.data.item(inst.id).equipPos] === inst.uid) return true;
  b.bad.add(inst.id); p.equip = before;                                // no le sirve (nivel, fuerza, atributo): se revende
  return false;
}
function sellExtra(w, p) {
  const worn = new Set(Object.values(p.equip));
  for (const i of [...p.bag]) {
    if (worn.has(i.uid) || i.comp) continue;
    const d = w.data.item(i.id);
    if (!d || i.id === GOLD || d.type === ITYPE.EAT || d.type === ITYPE.USE_DEPLETE || d.type === ITYPE.ARROW) continue;
    if (p.bag.length < MAX_ITEMS - 8 && d.type !== ITYPE.EQUIP) continue;
    if (p.bag.length < MAX_ITEMS - 8 && i.life !== 0) continue;
    p.gold += Math.max(0, Math.floor((d.price > 0 ? d.price : 0) / 2) * (i.count || 1));
    Inv.removeFromBag(p, i.uid);
  }
}
export function errands(w, p, b, first = false) {
  if (p.dead) return;
  spendPoints(w, p);
  const cat = catalog(w.data);
  // comida y pociones
  if (cat.potion && countOf(p, cat.potion.id) < 6) buy(w, p, cat.potion, 6 - countOf(p, cat.potion.id));
  if (cat.foods[0] && cat.foods.reduce((a, d) => a + countOf(p, d.id), 0) < 4) buy(w, p, cat.foods[0], 4);
  // equipo del suelo/mochila que ya lleve y sea mejor
  const value = slot => {
    const uid = slot === EQUIP.RHAND ? (p.equip[EQUIP.RHAND] ?? p.equip[EQUIP.TWOHAND]) : p.equip[slot];
    const i = uid !== undefined && Inv.instOf(p, uid);
    return i ? w.data.item(i.id).price || 0 : 0;
  };
  for (const i of p.bag) {
    const d = w.data.item(i.id);
    if (!d || d.type !== ITYPE.EQUIP || b.bad.has(i.id) || i.life === 0 || Object.values(p.equip).includes(i.uid) || !catalog(w.data).gear.get(slotOf(d))?.includes(d)) continue;
    if ((d.price || 0) > value(slotOf(d)) * 1.15) tryEquip(w, p, b, i);
  }
  // compras por catálogo: una pieza por recado (a la primera, un equipo completo)
  let bought = 0;
  for (const slot of [EQUIP.RHAND, EQUIP.BODY, EQUIP.LEGGINGS, EQUIP.LHAND, EQUIP.HEAD, EQUIP.ARMS, EQUIP.PANTS]) {
    const list = cat.gear.get(slot) || [], have = value(slot), budget = p.gold * (first ? 0.25 : 0.6);
    const d = list.find(x => x.price <= budget && x.price > have * 1.3 && !b.bad.has(x.id) && !(x.levelLimit > p.level) && !(x.gender === 1 && p.gender !== 1) && !(x.gender === 2 && p.gender !== 2) && x.price * 4 >= have);
    if (!d) continue;
    const inst = buy(w, p, d);
    if (!inst) continue;
    if (!tryEquip(w, p, b, inst)) { p.gold += d.price; Inv.removeFromBag(p, inst.uid); continue; }
    b.bought = 1;
    if (++bought >= (first ? 7 : 1)) break;
  }
  sellExtra(w, p);
  w.recalc(p);
}

// ---------------------------------------------------------------- percepción y movimiento
export const tooStrong = (w, p, e) => {
  if (e.kind === "player") return e.level > p.level + 6 || e.hp > p.hp * 2.2;                        // contra un jugador enemigo: solo si no es mucho más fuerte
  if (e.boss && p.level < 40) return true;
  const hit = (e.cfg.attackDiceThrow || 1) * (e.cfg.attackDiceRange || 1);
  return hit * 3 > p.maxHp;
};
const hostile = e => e.kind === "npc" && !e.dead && !e.master && !e.aux && !e.cfg.actionLimit;
function pickTarget(w, p, owner) {
  let best = null, bs = 1e9;
  const rv = p.bot.revenge && p.bot.revenge.until > w.time && w.ents.get(p.bot.revenge.id);            // quien me ha golpeado, primero
  if (rv && !rv.dead && dist(p, rv) <= 12 && canFight(w, p, rv)) return rv;
  for (const e of w.ents.values()) {
    if (e.kind === "player") {                                                                            // enemigos de otro bando en Promise Land
      if (!w.pvp || !canFight(w, p, e) || tooStrong(w, p, e)) continue;
      const d = dist(p, e);
      if (d <= 12 && (!owner || dist(owner, e) <= 14) && d - 2 < bs) { best = e; bs = d - 2; }
      continue;
    }
    if (!hostile(e)) continue;
    const d = dist(p, e);
    if (d > 12 || (owner && dist(owner, e) > 14) || w.safeAt(e.x, e.y) || tooStrong(w, p, e)) continue;
    const s = d - (e.target === p.id || (owner && e.target === owner.id) ? 6 : 0);
    if (s < bs) { best = e; bs = s; }
  }
  return best;
}
function step(adv, w, p, b, tx, ty, run) {
  if (w.time - p.lastMove < LIMITS.moveMs || w.busy(p)) return true;
  b.runOn = b.runOn ? p.sp > 10 : p.sp > p.maxSp * 0.6;                       // auto-run como un jugador (Ctrl+R): corre mientras le quede aliento y descansa al agotarse
  run = run || b.runOn;
  const moved = !b.goal || b.goal.w !== w || Math.max(Math.abs(b.goal.x - tx), Math.abs(b.goal.y - ty)) > 1;
  if (!b.path?.length || moved) {
    // Rutas A*: no más de una cada 600 ms por bot (el objetivo se mueve sin parar) y, si no hay camino, se anda "a ojo" 2 s antes de reintentar
    if (w.time >= (b.pathAt || 0) && dist(p, { x: tx, y: ty }) > 1) {
      b.path = dist(p, { x: tx, y: ty }) <= 3 ? [] : findPath(w.grid, p.x, p.y, tx, ty, p.id, b.travel ? 40000 : 2500, w.teleports);
      b.pathAt = w.time + (b.path.length ? 600 : 2000);
      b.goal = { x: tx, y: ty, w };
    } else if (!b.path?.length) b.path = [];
  }
  let d = b.path.shift();
  if (!d) d = greedyStep(w.grid, p, tx, ty, dirTo);
  if (d) { const k = w.grid.idx(p.x + DX[d], p.y + DY[d]); if (w.teleports.has(k) && !(b.travel && p.x + DX[d] === b.travel.x && p.y + DY[d] === b.travel.y)) { b.path = null; b.fails++; return false; } }       // un bot no pisa un teletransportador por descuido
  if (!d) { b.fails++; return false; }
  if (!adv.command(p.id, { t: "move", dir: d, run: !!run && p.sp > 6 })) { b.path = null; b.fails++; return false; }
  b.fails = 0;
  return true;
}
// Pensamientos en voz alta (burbuja pública `botsay`): el bot cuenta qué ve y qué va a hacer. Personalidad inventada del port.
const THOUGHTS = {
  target: [["¡Un {m}! Voy a por él.", "A {m}! I'm going in."], ["Veo un {m}… me lo quedo.", "I see a {m}… that one's mine."], ["Ahí hay un {m}, ¡al ataque!", "There's a {m}, attack!"]],
  hurt: [["Me duele, me curo un poco.", "Ouch, let me heal up."], ["Cuidado, voy flojo de vida.", "Careful, my health is low."]],
  rest: [["Sin pociones: descanso un rato.", "No potions left: resting a bit."], ["Voy a recuperar el aliento.", "I'll catch my breath."]],
  rested: [["Ya estoy mejor, seguimos.", "Feeling better, let's go on."]],
  loot: [["Algo brilla por ahí, voy a cogerlo.", "Something's shining over there, grabbing it."], ["Botín a la vista.", "Loot in sight."]],
  shop: [["Toca ir de compras: equipo nuevo.", "Shopping time: new gear."], ["Gasto oro en equiparme mejor.", "Spending gold on better gear."]],
  follow: [["Te sigo, jefe.", "Right behind you, boss."], ["Esperadme, que voy.", "Wait up, I'm coming."]],
  wander: [["Voy a ver qué hay por aquí.", "Let's see what's around here."], ["Todo tranquilo… busco monstruos.", "All quiet… looking for monsters."]],
  danger: [["Eso es demasiado fuerte para mí.", "That one's too strong for me."]],
  dead: [["¡Ay! Me han matado… vuelvo enseguida.", "Argh! I died… be right back."]],
  level: [["¡He subido al nivel {l}!", "I reached level {l}!"]],
  party: [["Gracias por la invitación al grupo.", "Thanks for the party invite."]],
};
// Registro de lo que hace y piensa el bot: anillo de 80 líneas (`admin: vida`) y, si alguien lo observa, evento privado `botlog` que el servidor
// le manda al chat del observador (modo observar). `w.hooks.watched` = ids de bots observados ahora mismo.
export function blog(w, p, text) {
  const b = p.bot; if (!b) return;
  const l = (b.log ||= []); l.push(text); if (l.length > 80) l.shift();
  if (w.hooks?.watched?.has(p.id)) w.emit({ t: "botlog", id: p.id, text });
}
function think_(w, p, b, key, vars = {}, gap = 9000) {
  const now = w.time;
  if (now - (b.thAt || -1e9) < gap || now - ((b.thKey ||= {})[key] || -1e9) < 25000) return false;
  const l = THOUGHTS[key]; if (!l) return false;
  const [es, en] = l[Math.floor(w.rng() * l.length)], fill = t => t.replace("{m}", (vars.m || "").replace(/-/g, " ")).replace("{l}", vars.l ?? "");
  b.thAt = now; b.thKey[key] = now;
  w.emit({ t: "botsay", id: p.id, es: fill(es), en: fill(en) });
  blog(w, p, "💭 " + fill(es));
  return true;
}
function say(adv, p, b, text) { if (adv.time - b.said > 20000) { b.said = adv.time; adv.command(p.id, { t: "say", text }); } }

// ---------------------------------------------------------------- bucle
export function think(adv, p) {
  const b = p.bot, w = adv.worldFor(p.id);
  if (!b || b.broken || w.time < b.next) return;
  b.next = w.time + THINK_MS;
  try { run(adv, w, p, b); } catch (e) { b.broken = true; console.error("bot " + p.name + " desactivado:", e); }
}
function run(adv, w, p, b) {
  if (p.dead) {
    if (!b.deadSaid) { b.deadSaid = true; think_(w, p, b, "dead", {}, 0); }
    if (w.time - p.deadAt > 3000) { adv.command(p.id, { t: "respawn" }); b.target = null; b.path = null; b.deadSaid = false; }
    return;
  }
  if (p.level > b.lvl) { say(adv, p, b, "Level " + p.level + "!"); think_(w, p, b, "level", { l: p.level }, 0); b.lvl = p.level; b.errand = 0; }
  if (w.busy(p)) return;
  // dueño: debe seguir conectado
  let owner = null;
  if (b.owner != null) {
    const ow = adv.locations.get(b.owner);
    owner = ow?.ents.get(b.owner) || null;
    if (!owner) b.owner = null;
    else if (ow !== w) {                                                 // el dueño cambió de mapa: lo seguimos al cabo de un momento
      b.lost = b.lost || w.time;
      if (w.time - b.lost > 1500 && !owner.dead) { adv.transfer(p, w, ow, [owner.x, owner.y]); b.lost = 0; b.path = null; b.target = null; }
      return;
    } else b.lost = 0;
    if (owner && !p.party && w.time > (b.partyAt || 0)) { b.partyAt = w.time + 5000; Party.request(w, p, owner.name, true); think_(w, p, b, "party", {}, 0); }
  }
  // recados
  if (w.time >= b.errand && w.time - p.lastCombat > 3500) { b.errand = w.time + ERRAND_MS; errands(w, p, b); if (b.bought) { b.bought = 0; blog(w, p, `Compro equipo (oro ${p.gold}).`); think_(w, p, b, "shop"); } }
  // comer y curarse
  if (p.hunger < 35) { const f = p.bag.find(i => w.data.item(i.id)?.type === ITYPE.EAT && !w.data.item(i.id).name.includes("Candy")); if (f) adv.command(p.id, { t: "use", uid: f.uid }); }
  const hpf = p.hp / p.maxHp;
  if (hpf < 0.45 && w.time - (b.potionAt || 0) > 1500) {
    const red = catalog(w.data).potion, pot = red && p.bag.find(i => i.id === red.id);
    if (pot) { b.potionAt = w.time; blog(w, p, `Vida ${Math.round(hpf * 100)}%: bebo una poción roja.`); think_(w, p, b, "hurt"); adv.command(p.id, { t: "use", uid: pot.uid }); return; }
    if (!b.rest) { think_(w, p, b, "rest", {}, 0); blog(w, p, `Vida ${Math.round(hpf * 100)}% y sin pociones: descanso.`); }
    b.rest = true;
  }
  if (w.pvp && hpf < 0.35 && w.time - (b.recallAt || 0) > 6000) {                           // en Promise Land con poca vida y un enemigo cerca: huye con Recall
    const foe = [...w.ents.values()].find(e => e.kind === "player" && canFight(w, p, e) && dist(p, e) <= 9);
    if (foe) { b.recallAt = w.time; blog(w, p, `Poca vida y ${foe.name} (bando enemigo) cerca: intento Recall para huir.`); adv.command(p.id, { t: "recall" }); }
  }
  if (b.rest && hpf > 0.75) { b.rest = false; blog(w, p, "Recuperado, sigo."); think_(w, p, b, "rested"); }
  // objetivo
  if (b.target && (b.target.dead || !w.ents.has(b.target.id) || dist(p, b.target) > 16)) b.target = null;
  if (!b.rest && w.time >= b.tgtAt) { b.tgtAt = w.time + TARGET_MS; if (!b.target || dist(p, b.target) > 3) b.target = pickTarget(w, p, owner) || b.target; }
  const t = b.rest || (b.travel && !(b.target && ((b.target.target === p.id && (!b.travel.seek || dist(p, b.target) <= 2)) || b.target.kind === "player"))) ? null : b.target;      // de viaje solo se pelea con lo que ataca
  if (t) {
    if (b.seen !== t.id) { b.seen = t.id; blog(w, p, `Objetivo: ${t.name}${t.kind === "player" ? " (jugador enemigo, nv " + t.level + ")" : ""} a ${dist(p, t)} casillas.`); if (t.kind !== "player") think_(w, p, b, tooStrong(w, p, t) ? "danger" : "target", { m: t.name }); }
    if (dist(p, t) <= reachOf(w, p, t)) {
      if (w.time - p.lastAttack >= PLAYER.attackCooldownMs) { const d = dirTo(p.x, p.y, t.x, t.y); if (d) p.dir = d; adv.command(p.id, { t: "attack", target: t.id }); }
    } else step(adv, w, p, b, t.x, t.y, dist(p, t) > 5);
    return;
  }
  // botín cercano (solo si no hay peligro a la vista)
  if (!b.rest && !b.noLoot && !b.travel) {
    const here = groundTop(w, p.x, p.y);
    if (here && wanted(w, p, here)) { if (w.time - (b.lootLog || 0) > 5000) { b.lootLog = w.time; blog(w, p, `Recojo ${w.data.item(here.id)?.name || here.id}.`); } adv.command(p.id, { t: "pickup" }); return; }
    let best = null, bd = 1e9;
    for (let y = p.y - 5; y <= p.y + 5; y++) for (let x = p.x - 5; x <= p.x + 5; x++) {
      const it = w.grid.inside(x, y) && !w.teleports.has(w.grid.idx(x, y)) && groundTop(w, x, y);          // el botín sobre un teletransportador se deja
      if (it && wanted(w, p, it)) { const d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y)); if (d < bd && (!owner || dist(owner, { x, y }) < 12)) { best = { x, y }; bd = d; } }
    }
    if (best) { think_(w, p, b, "loot"); if (!step(adv, w, p, b, best.x, best.y, false) && b.fails > 6) { b.noLoot = true; w.after(15000, () => { b.noLoot = false; }); b.fails = 0; } return; }
  }
  // viaje planeado (p. ej. a Promise Land): anda hasta la casilla del teletransportador
  if (b.travel && b.travel.w !== w) b.travel = null;
  if (b.travel && !owner && !b.rest) {
    const tr = b.travel;
    if (!tr.seek && dist(p, tr) <= 1 && !w.teleports.has(w.grid.idx(tr.x, tr.y))) { b.travel = null; b.path = null; b.hold = w.time + 4000; blog(w, p, `Llegué a (${tr.x},${tr.y}).`); return; }       // llegó a un destino que no es un teletransportador: espera ahí (quien lo mandó decide el siguiente paso)
    if (b.fails > 10 || w.time > tr.until) { if (!tr.seek) blog(w, p, "Viaje cancelado (no llego)."); b.travel = null; }
    else { step(adv, w, p, b, tr.x, tr.y, true); return; }
  }
  // seguir al dueño o vagar por la zona
  if (owner) { if (dist(p, owner) > 8) think_(w, p, b, "follow"); if (dist(p, owner) > 3) step(adv, w, p, b, owner.x, owner.y, dist(p, owner) > 7); return; }
  if (b.rest || b.hold > w.time) return;
  if (!b.wander || (p.x === b.wander.x && p.y === b.wander.y) || w.time > b.wander.until || b.fails > 4) {
    const r = () => Math.floor(w.rng() * 21) - 10; let s = w.freeSpotNear(b.home.x + r(), b.home.y + r());
    if (s && w.teleports.has(w.grid.idx(s[0], s[1]))) s = null;                          // nunca se pasea hasta un teletransportador
    b.wander = s ? { x: s[0], y: s[1], until: w.time + 12000 } : null; b.fails = 0;
  }
  if (b.wander && b.wander.until - w.time > 11000) think_(w, p, b, "wander", {}, 20000);
  if (b.wander) step(adv, w, p, b, b.wander.x, b.wander.y, false);
}
function wanted(w, p, it) {
  const d = w.data.item(it.id);
  if (!d) return false;
  if (it.id === GOLD) return true;
  if (it.comp) return false;
  return (d.price > 0 || d.type === ITYPE.EAT) && p.bag.length < MAX_ITEMS - 3 && Inv.canCarry(p, w.data, d, it.count || 1, it);
}
