// BOT: jugador simulado (INVENTO del port, herramienta de admin). Vive en el mundo como un jugador más (kind "player", mochila, equipo,
// nivel, grupo) y toma sus decisiones con las MISMAS órdenes que un cliente (`adv.command`: move, attack, pickup, equip, use, stat, say,
// respawn), así que no tiene ventajas ni atajos de reglas. Pensado para rellenar el servidor con jugadores que hagan grupo y cacen.
//  - Rol «follow»: acompaña a su dueño (mismo grupo) y ataca lo que lo amenaza; si el dueño cambia de mapa/cripta lo sigue.
//  - Rol «solo»: caza por su cuenta alrededor del punto donde nació.
//  - Cada pocos segundos hace «recados» (sin ir a la tienda: compra por catálogo con su oro, ver `errands`): reparte puntos, compra y
//    se equipa lo mejor que le llega, repone pociones y comida, vende lo que sobra y recoge botín.
//  - Sube de nivel matando (giveExp normal). Evita monstruos que lo matarían en 3 golpes y descansa con poca vida.
import { hazardAt, safeSpot } from "./hazards.js";
import { dist, dirTo, DX, DY, LIMITS, PLAYER } from "../const.js";
import { findPath, greedyStep } from "../path.js";
import { EQUIP, ITYPE, EFFECT, MAX_ITEMS } from "../items.js";
import * as Inv from "../inventory.js";
import * as R from "../rules.js";
import { reachOf, MAX_LEVEL } from "./combatsys.js";
import { damageRange } from "../combat.js";
import { groundTop } from "./ground.js";
import { newInst } from "./itemsys.js";
import * as Party from "./party.js";
import * as Tut from "./tutorial.js";
import { canFight } from "./combatsys.js";
import { itemLevel } from "../itemlevel.js";
import * as Shop from "./shopsys.js";
import { judge, manage, wish, canWear } from "./botitems.js";
import { allocate } from "./builds.js";

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
  if (p.res && p.level >= 15 && p.stats.chr < 20) w.command(p.id, { t: "stat", stat: "chr", n: Math.min(p.pool, 20 - p.stats.chr) });        // carisma 20: requisito para fundar un guild (systems/guild.js)
  if (p.pool <= 0) return;
  if (p.res) { for (const [stat, n] of Object.entries(allocate(p, p.pool))) if (n > 0) w.command(p.id, { t: "stat", stat, n }); }                  // reparto según su build (builds.js)
  else { const total = p.pool, str = Math.ceil(total * 0.4), vit = Math.ceil(total * 0.4);      // más vida (QA: a nivel 50 los Troll y Cíclopes mataban con ~375 de vida)
    for (const [stat, n] of [["str", str], ["vit", vit], ["dex", total - str - vit]]) if (n > 0) w.command(p.id, { t: "stat", stat, n }); }
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
// MOCHILA: la gestiona botitems.js (valor de cada objeto → equipar / guardar / vender, orden de la mochila y lista de deseos).
export const bagClass = (w, p, i) => { const v = judge(w, p, i, friendsOf(w, p)); return v.act === "equip" ? "keep" : v.act; };
const friendsOf = (w, p) => w.hooks?.friends?.(p) || [];
const sellExtra = (w, p, force = false) => manage(w, p, { force, friends: friendsOf(w, p), log: t => blog(w, p, t) });
export function errands(w, p, b, first = false) {
  if (p.dead) return;
  spendPoints(w, p);
  const cat = catalog(w.data);
  // comida y pociones
  if (cat.potion && countOf(p, cat.potion.id) < 6) buy(w, p, cat.potion, 6 - countOf(p, cat.potion.id));
  if (cat.foods[0] && cat.foods.reduce((a, d) => a + countOf(p, d.id), 0) < 4) buy(w, p, cat.foods[0], 4);
  // Equipo: se compara por ITEM LEVEL (itemlevel.js) casilla a casilla, con lo que lleve puesto, lo que tenga en la mochila (botín incluido)
  // y lo que venda la tienda. Un objeto de dos manos compite con espada + escudo.
  const ilv = i => (i ? itemLevel(w.data.item(i.id), i.attr, i.id) : 0);
  const worn = slot => { const uid = p.equip[slot]; return uid !== undefined ? Inv.instOf(p, uid) : null; };
  const value = slot => slot === EQUIP.RHAND ? Math.max(ilv(worn(EQUIP.TWOHAND)), ilv(worn(EQUIP.RHAND))) : ilv(worn(slot));
  const usable = d => d && d.type === ITYPE.EQUIP && !(d.levelLimit > p.level) && !(d.gender === 1 && p.gender !== 1) && !(d.gender === 2 && p.gender !== 2) &&
    d.equipPos > 0 && d.equipPos < EQUIP.FULLBODY && d.effectType !== EFFECT.ATTACK_SPECABLTY && d.effectType !== EFFECT.DEFENSE_SPECABLTY && !(d.equipPos >= EQUIP.RHAND && d.equipPos <= EQUIP.TWOHAND && SKIP_WEAPON.test(d.name));
  let best = null;
  for (const i of p.bag) {
    const d = w.data.item(i.id);
    if (!usable(d) || (b.badUid ||= new Set()).has(i.uid) || i.life === 0 || Object.values(p.equip).includes(i.uid)) continue;
    const slot = slotOf(d), mine = ilv(i), cur = d.equipPos === EQUIP.TWOHAND ? ilv(worn(EQUIP.RHAND)) + ilv(worn(EQUIP.LHAND)) : value(slot);
    if (mine > cur * 1.08 + 0.5 && (!best || mine - cur > best.gain)) best = { i, gain: mine - cur };
  }
  if (best) {
    if (tryEquip(w, p, b, best.i)) blog(w, p, `Me equipo ${w.data.item(best.i.id).name} (item level ${ilv(best.i)}).`);
    else b.badUid.add(best.i.uid);
  }
  // LISTA DE DESEOS: la pieza que más le mejoraría. Si le llega el oro, la compra; si no, ahorra para ella (no gasta en mejoras menores) hasta tenerla
  const want = wish(w, p, cat.gear, b.bad, usable);
  b.wish = want ? { name: want.d.name, price: want.price, gain: want.gain, slot: want.slot } : null;
  b.saving = false;
  if (want) {
    const spare = want.price + 60;
    if (p.gold >= spare) {
      const inst = buy(w, p, want.d);
      if (inst) { if (tryEquip(w, p, b, inst)) { b.bought = 1; blog(w, p, `Compro ${want.d.name} (${want.price} de oro): era la mejora que más deseaba (+${want.gain} de item level).`); } else { p.gold += want.d.price; Inv.removeFromBag(p, inst.uid); } }
    } else if (want.gain >= 8) { b.saving = true; if (w.time - (b.saveLog || -1e9) > 300000) { b.saveLog = w.time; blog(w, p, `Ahorro para ${want.d.name} (${want.price} de oro, +${want.gain} de item level): me faltan ${spare - p.gold}.`); } }
  }
  // compras por catálogo: una pieza por recado (a la primera, un equipo completo)
  let bought = 0;
  for (const slot of [EQUIP.RHAND, EQUIP.BODY, EQUIP.LEGGINGS, EQUIP.LHAND, EQUIP.HEAD, EQUIP.ARMS, EQUIP.PANTS]) {
    const list = cat.gear.get(slot) || [], have = value(slot), budget = p.gold * (first ? 0.25 : 0.6);
    if (b.saving && have > 0) continue;                                               // ahorrando para algo mejor: no se gasta en mejoras menores
    let got = false;
    for (const d of list.filter(x => x.price <= budget && itemLevel(x) > have * 1.15 + 1 && !b.bad.has(x.id) && usable(x)).slice(0, 6)) {      // prueba el siguiente si no puede cargarlo o no se lo puede poner (antes se atascaba para siempre con el más caro y peleaba sin arma)
      const inst = buy(w, p, d);
      if (!inst) { if (p.gold >= d.price) b.bad.add(d.id); continue; }
      if (!tryEquip(w, p, b, inst)) { p.gold += d.price; Inv.removeFromBag(p, inst.uid); continue; }
      got = true; break;
    }
    if (!got) continue;
    b.bought = 1;
    if (++bought >= (first ? 7 : 1)) break;
  }
  sellExtra(w, p);
  w.recalc(p);
}

// ---------------------------------------------------------------- percepción y movimiento
// ESTIMACIÓN DE UNA PELEA (daño por segundo de cada lado): un jefe tiene muchísima vida y pega fuerte, así que se decide con números (arma, vida, pociones y
// compañeros cercanos) y no con el nivel a secas: un nivel 50 sin arma no le hace cosquillas. Es el «cálculo» que haría un jugador mirando su equipo.
const avgOf = r => (r[0] + r[1]) / 2;
export const dpsOf = q => avgOf(damageRange(q)) * 0.6;
export function fightEstimate(w, p, e) {
  let ally = 0, n = 0;
  for (const q of w.ents.values()) if (q !== p && q.kind === "player" && !q.dead && q.side === p.side && dist(p, q) <= 14) { ally += dpsOf(q); n++; }
  const foeHit = (e.cfg.attackDiceThrow || 1) * ((e.cfg.attackDiceRange || 1) + 1) / 2 * (e.dmgMul || 1) * 0.65, foeDps = foeHit * 0.8 / Math.max(0.9, (e.cfg.actionTime || 1500) / 1000);
  const ttk = e.hp / Math.max(0.5, dpsOf(p) + ally), taken = foeDps * ttk / (1 + n * 0.7);
  const red = w.data.named("RedPotion"), pots = red ? p.bag.reduce((a, i) => a + (i.id === red.id ? i.count || 1 : 0), 0) : 0;
  const budget = p.hp + pots * Math.min(80, p.maxHp * 0.4);
  return { ttk, taken, budget, ratio: budget / Math.max(1, taken), allies: n };
}
// el jefe que habrá en el piso `level` de la cripta (misma escala que dungeon.js), para decidir ANTES de bajar
export function bossPreview(w, level) {
  const cfg = w.npcDb.Skeleton; if (!cfg || level % 5) return null;
  const tier = Math.min(4, level / 5), sc = { hp: 1 + .22 * (level - 1), dmg: 1 + .1 * (level - 1) };
  return { cfg, hp: Math.round(cfg.hitDice * 5.75 * sc.hp * (6 + 2 * tier)), dmgMul: sc.dmg * (1.6 + .2 * tier) };
}
export const fightOk = (w, p, e) => fightEstimate(w, p, e).ratio >= 1.3;
export const tooStrong = (w, p, e) => {
  if (e.kind === "player") return e.level > p.level + 6 || e.hp > p.hp * 2.2;                        // contra un jugador enemigo: solo si no es mucho más fuerte
  if (e.boss && !e.aux) return !fightOk(w, p, e);                                                       // jefe de cripta: solo si el cálculo de la pelea sale a favor (con los compañeros que lo ayuden)
  const dl = p.res?.dlv?.[e.boss ? e.name + "*" + e.boss : e.name];                                                                    // APRENDIZAJE: el bot recuerda el nivel al que lo mató esta especie y no vuelve a pelearla hasta llevar 3 niveles más
  if (dl !== undefined && p.level < dl + 3) return true;
  const hit = (e.cfg.attackDiceThrow || 1) * (e.cfg.attackDiceRange || 1);
  return hit * 4 > p.maxHp;
};
// los auxiliares de un jefe también se pelean: cristales de hielo (rompen su escudo), clones de sombra y huesos que lo curan
// VALOR DE UN MONSTRUO para quien lo caza: lo que cuesta subir de nivel frente a lo que da cada baja. Un nivel 25 que sigue con slimes pierde el tiempo;
// los bots prefieren lo mejor que aguantan (hasta 9 casillas de ventaja) y lo trivial solo lo matan si les estorba (INVENTO del port, objetivo «superarse»).
export const mobRatio = (p, e) => (e.exp || e.cfg.expMin || 0) / Math.max(100, R.expForLevel(p.level + 1) - R.expForLevel(p.level));
export const mobBonus = (p, e) => { const r = mobRatio(p, e); return r < 0.04 ? -6 : Math.min(9, 3 * Math.log2(1 + r * 4)); };
const hostile = e => e.kind === "npc" && !e.dead && !e.master && (e.crystal || (!e.aux || (e.owner && !e.comp)) && !e.cfg.actionLimit);
// ¿hay camino hasta el enemigo? (otro nivel de terreno: acantilado, agua, muro entre medias). Se cachea 4 s por enemigo; los inalcanzables no se eligen.
function reachable(w, p, e) {
  const b = p.bot, c = (b.reach ||= new Map()), hit = c.get(e.id);
  if (dist(p, e) <= 1) return true;
  if (hit && w.time < hit.until && dist(p, { x: hit.x, y: hit.y }) <= 3) return hit.ok;
  const ok = findPath(w.grid, p.x, p.y, e.x, e.y, p.id, 2500, w.teleports).length > 0;
  c.set(e.id, { ok, until: w.time + (ok ? 4000 : 8000), x: p.x, y: p.y });
  if (c.size > 60) for (const [k, v] of c) if (w.time > v.until) c.delete(k);
  return ok;
}
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
    if (p.bot.ignore?.has(e.id) && e.target !== p.id) continue;                                         // inalcanzable hace un momento
    const d = dist(p, e);
    if (d > 12 || (owner && dist(owner, e) > 14) || w.safeAt(e.x, e.y) || tooStrong(w, p, e)) continue;
    const shielded = e.crystal && [...w.ents.values()].some(o => o.boss && o.shield && !o.dead && dist(o, e) <= 20);
    const s = (shielded ? -20 : 0) - (e.target === p.id || e.kind !== "npc" ? 0 : mobBonus(p, e)) + d - (e.target === p.id || (owner && e.target === owner.id) ? 6 : 0) + Math.min(9, (p.kinds?.[e.name] || 0) / 5) - (p.res?.focus?.[e.name] > w.time ? 5 : 0);     // VARIEDAD: prefiere especies que ha cazado poco (hasta 5 casillas de ventaja)
    if (s < bs && reachable(w, p, e)) { best = e; bs = s; }
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
  if (!hazardAt(w, p.x, p.y) && hazardAt(w, p.x + DX[d], p.y + DY[d], 200)) {                   // no entra en el fuego: prueba las direcciones vecinas o espera
    const alt = [(d % 8) + 1, ((d + 6) % 8) + 1].find(a => !hazardAt(w, p.x + DX[a], p.y + DY[a], 200) && !w.grid.blocked(p.x + DX[a], p.y + DY[a]) && !w.teleports.has(w.grid.idx(p.x + DX[a], p.y + DY[a])));
    b.path = null;
    if (!alt) return true;
    d = alt;
  }
  if (!adv.command(p.id, { t: "move", dir: d, run: !!run && p.sp > 6 })) { b.path = null; b.fails++; return false; }
  b.fails = 0;
  return true;
}
// Pensamientos en voz alta (burbuja pública `botsay`): el bot cuenta qué ve y qué va a hacer. Personalidad inventada del port.
// Situaciones de los pensamientos en voz alta (burbuja pública `botsay`). No hay frases escritas: las dice el modelo de lenguaje (residents.thought); sin modelo no hay burbuja.
const THOUGHTS = {
  target: "you spot a {m} and decide to attack it", hurt: "you are hurt and drink a potion", rest: "you have no potions and are resting to recover",
  rested: "you feel better and go on", loot: "you see loot on the ground and go grab it", shop: "you are going shopping for better gear", follow: "you are following your party leader",
  wander: "all is quiet and you look for monsters", danger: "you see a {m} that is too strong for you and avoid it", dead: "you just died", level: "you just reached level {l}", party: "you thank someone for the party invite",
};
// Registro de lo que hace y piensa el bot: anillo de 80 líneas (`admin: vida`) y, si alguien lo observa, evento privado `botlog` que el servidor
// le manda al chat del observador (modo observar). `w.hooks.watched` = ids de bots observados ahora mismo.
export function blog(w, p, text) {
  const b = p.bot; if (!b) return;
  const l = (b.log ||= []); l.push(text); if (l.length > 80) l.shift();
  w.hooks?.logSink?.(p, text);
  if (w.hooks?.watched?.has(p.id)) w.emit({ t: "botlog", id: p.id, text });
}
function think_(w, p, b, key, vars = {}, gap = 9000) {
  const now = w.time;
  if (now - (b.thAt || -1e9) < gap || now - ((b.thKey ||= {})[key] || -1e9) < 25000) return false;
  const l = THOUGHTS[key]; if (!l) return false;
  const sit = l.replace("{m}", (vars.m || "").replace(/-/g, " ")).replace("{l}", vars.l ?? "");
  b.thAt = now; b.thKey[key] = now;
  w.hooks?.thought?.(p, sit);
  blog(w, p, "💭 " + sit);
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
  if (p.level > b.lvl) { say(adv, p, b, "Level " + p.level + "!"); think_(w, p, b, "level", { l: p.level }, 0); b.lvl = p.level; b.errand = 0; b.bad.clear(); b.badUid?.clear(); }
  if (w.busy(p) || p.trade) return;                                       // en pleno trato se queda quieto
  // PELIGRO EN EL SUELO: fuego, brasas, hielo o veneno bajo los pies (o un aviso de brasa a punto de caer): sale de ahí antes que cualquier otra cosa
  if (hazardAt(w, p.x, p.y, 300)) {
    const spot = safeSpot(w, p);
    if (spot) { if (w.time - (b.dodgeLog || 0) > 8000) { b.dodgeLog = w.time; blog(w, p, `Estoy sobre fuego/hielo: me aparto a (${spot[0]},${spot[1]}).`); } b.path = null; b.goal = null; b.dodge = w.time; if (step(adv, w, p, b, spot[0], spot[1], true)) return; }
  }
  // dueño: debe seguir conectado
  let owner = null;
  if (b.owner != null) {
    const ow = adv.locations.get(b.owner);
    owner = ow?.ents.get(b.owner) || null;
    if (!owner) b.owner = null;
    else if (ow !== w) {                                                 // el dueño está en otro mapa: NO se teletransporta (los miembros de un grupo van a pie, como un jugador)
      b.lost = b.lost || w.time;
      if (ow.pvp && !w.pvp && !p.dead && !w.busy(p)) {                                                // el líder está en Promise Land: va al teletransportador de esa zona y entra tras él
        const tp = (adv.maps[w.map.id]?.meta.teleports || []).find(t => t.map === ow.map.id), spot = tp && w.freeSpotNear(tp.x, tp.y + 1);
        if (tp && dist(p, tp) > 1) { if (!b.travel) { b.travel = { x: tp.x, y: tp.y, w, until: w.time + 90000 }; b.path = null; b.goal = null; } }
      }
      if (ow.map.kind === "dungeon" && w.map.kind !== "dungeon" && !p.dead && !w.busy(p)) {        // va a la entrada de la cripta y baja con su grupo (enterCrypt lo mete en la cripta del grupo)
        const tp = (adv.maps[w.map.id]?.meta.teleports || []).find(t => t.map === "middled1n"), spot = tp && w.freeSpotNear(tp.x, tp.y + 2);
        if (spot && dist(p, { x: spot[0], y: spot[1] }) > 2) { if (!b.travel) { b.travel = { x: spot[0], y: spot[1], w, until: w.time + 60000 }; b.path = null; } }
        else if (spot && w.time - (b.gateAt || 0) > 3000) { b.gateAt = w.time; adv.command(p.id, { t: "portal", portal: "mid-entry", restart: false }); }
      }
      if (w.time - b.lost > 120000) { b.owner = null; b.lost = 0; Party.leave(w, p, true); blog(w, p, "No consigo alcanzar a mi líder: dejo el grupo."); }
      owner = null;                                                    // mientras tanto: viaje/caza normales, sin seguir a nadie
    } else b.lost = 0;
    if (owner && !p.party && w.time > (b.partyAt || 0)) { b.partyAt = w.time + 5000; Party.request(w, p, owner.name, true); think_(w, p, b, "party", {}, 0); }
  }
  // recados
  if (w.time >= b.errand && w.time - p.lastCombat > 3500) { b.errand = w.time + ERRAND_MS; errands(w, p, b); if (b.bought) { b.bought = 0; blog(w, p, `Compro equipo (oro ${p.gold}).`); think_(w, p, b, "shop"); } }
  // comer y curarse
  if (p.hunger < 35) { const f = p.bag.find(i => w.data.item(i.id)?.type === ITYPE.EAT && !w.data.item(i.id).name.includes("Candy")); if (f) adv.command(p.id, { t: "use", uid: f.uid }); }
  const hpf = p.hp / p.maxHp, fear = Math.min(0.2, (p.res?.scare || 0) * 0.04);                 // MORIR DUELE: cada muerte reciente los vuelve más prudentes (beben antes, huyen antes)
  if (hpf < 0.5 + fear && w.time - (b.potionAt || 0) > 1500) {
    const red = catalog(w.data).potion, pot = red && p.bag.find(i => i.id === red.id);
    if (pot) { b.potionAt = w.time; blog(w, p, `Vida ${Math.round(hpf * 100)}%: bebo una poción roja.`); think_(w, p, b, "hurt"); adv.command(p.id, { t: "use", uid: pot.uid }); return; }
    if (!b.rest) { think_(w, p, b, "rest", {}, 0); blog(w, p, `Vida ${Math.round(hpf * 100)}% y sin pociones: descanso.`); }
    b.rest = true;
  }
  if (w.pvp && hpf < 0.35 && w.time - (b.recallAt || 0) > 6000) {                           // en Promise Land con poca vida y un enemigo cerca: huye con Recall
    const foe = [...w.ents.values()].find(e => e.kind === "player" && canFight(w, p, e) && dist(p, e) <= 9);
    if (foe) { b.recallAt = w.time; blog(w, p, `Poca vida y ${foe.name} (bando enemigo) cerca: intento Recall para huir.`); adv.command(p.id, { t: "recall" }); }
  }
  // INSTINTO DE SUPERVIVENCIA: con poca vida y un enemigo encima no se queda quieto: sale con Recall (cripta/Promise Land) o corre alejándose de él
  if (hpf < 0.32 + fear && w.time - (b.fleeAt || 0) > 700) {
    let foe = null, fd = 1e9;
    for (const e of w.ents.values()) { if (e.dead || e.master === p.id || e.aux || w.safeAt(e.x, e.y) || e.comp) continue; if (!(e.kind === "npc" || (e.kind === "player" && canFight(w, p, e)))) continue; const d = dist(p, e); if (d <= 7 && d < fd && (e.target === p.id || d <= 3)) { fd = d; foe = e; } }
    if (foe) {
      b.fleeAt = w.time; b.target = null; b.path = null;
      if ((w.map.kind === "dungeon" || w.pvp) && w.time - (b.recallAt || 0) > 6000) { b.recallAt = w.time; blog(w, p, `Vida ${Math.round(hpf * 100)}% con ${foe.name} encima: huyo con Recall.`); adv.command(p.id, { t: "recall" }); }
      else {
        let best = null, bs = dist(p, foe);
        for (let d = 0; d < 8; d++) { const x = p.x + DX[d] * 2, y = p.y + DY[d] * 2, sx = p.x + DX[d], sy = p.y + DY[d]; if (w.grid.blocked(sx, sy) || !w.grid.inside?.(sx, sy) && false) continue; const sc = Math.max(Math.abs(x - foe.x), Math.abs(y - foe.y)); if (sc > bs && !w.teleports.has(w.grid.idx(sx, sy))) { bs = sc; best = [x, y]; } }
        if (best) { if (!b.fled || w.time - b.fled > 8000) blog(w, p, `Vida ${Math.round(hpf * 100)}%: huyo de ${foe.name}.`); b.fled = w.time; step(adv, w, p, b, best[0], best[1], true); return; }
      }
    }
  }
  if (b.rest && hpf > 0.75) { b.rest = false; blog(w, p, "Recuperado, sigo."); think_(w, p, b, "rested"); }
  // objetivo
  if (b.travel && w.time > b.travel.until) { if (!b.travel.seek) blog(w, p, "Viaje cancelado (no llego)."); b.travel = null; b.path = null; }       // caduca aunque esté peleando por el camino
  if (b.ignore) for (const [id, until] of b.ignore) if (w.time > until) b.ignore.delete(id);
  if (b.target && (b.target.dead || !w.ents.has(b.target.id) || dist(p, b.target) > 16)) b.target = null;
  if (!b.rest && w.time >= b.tgtAt && (hpf > 0.55 + fear || b.target?.target === p.id)) { b.tgtAt = w.time + TARGET_MS; if (!b.target || dist(p, b.target) > 3) b.target = pickTarget(w, p, owner) || b.target; }
  const t = b.rest || (b.travel && !(b.target && ((b.target.target === p.id && (!b.travel.seek || dist(p, b.target) <= 2)) || b.target.kind === "player"))) ? null : b.target;      // de viaje solo se pelea con lo que ataca
  if (t) {
    if (b.seen !== t.id) { b.seen = t.id; blog(w, p, `Objetivo: ${t.name}${t.kind === "player" ? " (jugador enemigo, nv " + t.level + ")" : ""} a ${dist(p, t)} casillas.`); if (t.kind !== "player") think_(w, p, b, tooStrong(w, p, t) ? "danger" : "target", { m: t.name }); }
    if (dist(p, t) <= reachOf(w, p, t)) {
      if (w.time - p.lastAttack >= PLAYER.attackCooldownMs) { const d = dirTo(p.x, p.y, t.x, t.y); if (d) p.dir = d; adv.command(p.id, { t: "attack", target: t.id }); }
    } else if (!step(adv, w, p, b, t.x, t.y, dist(p, t) > 5) && b.fails > 8) {          // no hay camino hasta él (vallado, otra zona): lo descarta un rato
      (b.ignore ||= new Map()).set(t.id, w.time + 20000); b.target = null; b.fails = 0; b.path = null;
    }
    return;
  }
  // botín cercano (solo si no hay peligro a la vista)
  if (!b.rest && !b.noLoot && !b.travel) {
    const here = groundTop(w, p.x, p.y);
    if (here && wanted(w, p, here)) { if (w.time - (b.lootLog || 0) > 5000) { b.lootLog = w.time; blog(w, p, `Recojo ${w.data.item(here.id)?.name || here.id}.`); } adv.command(p.id, { t: "pickup" }); return; }
    let best = null, bd = 1e9;
    const LR = (b.lootBoost || 0) > w.time ? 9 : 5;                                       // actividad de guild «loot»: rastrea más lejos
    for (let y = p.y - LR; y <= p.y + LR; y++) for (let x = p.x - LR; x <= p.x + LR; x++) {
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
  if (!b.travel && w.teleports.has(w.grid.idx(p.x, p.y))) {                                // de pie sobre un teletransportador (acaba de llegar): se aparta para no taparlo ni quedarse esperando
    const o = w.freeSpotNear(p.x + 2, p.y + 2); if (o && !w.teleports.has(w.grid.idx(o[0], o[1]))) { step(adv, w, p, b, o[0], o[1], false); return; }
  }
  if (owner) { if (dist(p, owner) > 8) think_(w, p, b, "follow"); if (dist(p, owner) > 3) step(adv, w, p, b, owner.x, owner.y, dist(p, owner) > 7); return; }
  if (b.rest || b.hold > w.time) return;
  if (!b.travel && w.time >= (b.huntAt || 0) && w.map.kind !== "dungeon") {                // sin nada a la vista: va a cazar donde hay monstruos (antes vagaba para siempre por el pueblo, junto a la herrería y la tienda)
    b.huntAt = w.time + 8000;
    let best = null, bd = 1e9;
    for (const e of w.ents.values()) { if (!hostile(e) || w.safeAt(e.x, e.y) || tooStrong(w, p, e) || b.ignore?.has(e.id)) continue; const d = dist(p, e) + Math.min(10, (p.kinds?.[e.name] || 0) / 6) - 3 * mobBonus(p, e); if (d < bd && (dist(p, e) > 40 || reachable(w, p, e))) { bd = d; best = e; } }
    if (best && dist(p, best) > 14) {
      const spot = w.freeSpotNear(best.x, best.y);
      if (spot && !w.teleports.has(w.grid.idx(spot[0], spot[1]))) {
        b.travel = { x: spot[0], y: spot[1], w, until: w.time + 120000 }; b.home = { x: spot[0], y: spot[1] }; b.path = null; b.goal = null; b.wander = null; b.fails = 0;
        blog(w, p, `No hay monstruos cerca: voy a cazar ${best.name} (rinde ${mobRatio(p, best).toFixed(2)} niveles por baja) a (${spot[0]},${spot[1]}), a ${dist(p, best)} casillas.`);
        return;
      }
    }
  }
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
  if (d.type === ITYPE.EQUIP && d.price <= 0 && !it.attr && !(d.equipPos > 0 && d.equipPos < EQUIP.FULLBODY && !(d.levelLimit > p.level))) return false;
  return (d.price > 0 || d.type === ITYPE.EAT || d.type === ITYPE.EQUIP) && p.bag.length < MAX_ITEMS - 3 && Inv.canCarry(p, w.data, d, it.count || 1, it);
}
