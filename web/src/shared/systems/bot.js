// BOT: jugador simulado (INVENTO del port, herramienta de admin). Vive en el mundo como un jugador más (kind "player", mochila, equipo,
// nivel, grupo) y toma sus decisiones con las MISMAS órdenes que un cliente (`adv.command`: move, attack, pickup, equip, use, stat, say,
// respawn), así que no tiene ventajas ni atajos de reglas. Pensado para rellenar el servidor con jugadores que hagan grupo y cacen.
//  - Rol «follow»: acompaña a su dueño (mismo grupo) y ataca lo que lo amenaza; si el dueño cambia de mapa/cripta lo sigue.
//  - Rol «solo»: caza por su cuenta alrededor del punto donde nació.
//  - Cada pocos segundos hace «recados» (sin ir a la tienda: compra por catálogo con su oro, ver `errands`): reparte puntos, compra y
//    se equipa lo mejor que le llega, repone pociones y comida, vende lo que sobra y recoge botín.
//  - Sube de nivel matando (giveExp normal). Evita monstruos que lo matarían en 3 golpes y descansa con poca vida.
import { genesOf, learnFight, learnDeath } from "./botgenes.js";
import { resistRatio, meleeExpected } from "./botformulas.js";
import { hazardAt, safeSpot } from "./hazards.js";
import { sget } from "./status.js";
import * as Lore from "./botlore.js";
import { dist, dirTo, DX, DY, LIMITS, PLAYER } from "../const.js";
import { findPath, greedyStep } from "../path.js";
import { EQUIP, ITYPE, EFFECT, MAX_ITEMS } from "../items.js";
import * as Inv from "../inventory.js";
import * as R from "../rules.js";
import { reachOf, MAX_LEVEL, arrowOf } from "./combatsys.js";
import { damageRange } from "../combat.js";
import { groundTop } from "./ground.js";
import { newInst, useItem } from "./itemsys.js";
import * as Party from "./party.js";
import * as Tut from "./tutorial.js";
import { SKILL, SKILL_NAMES } from "../skills.js";
import { canFight } from "./combatsys.js";
import { itemLevel } from "../itemlevel.js";
import * as Shop from "./shopsys.js";
import { judge, manage, wish, canWear, isHelm, friendWish, soldRecently } from "./botitems.js";
import { warBuildOf, warStrOf, allocate, bonusScore, isCaster, isMage, mageBuildOf, swingStr, weaponStrNeed } from "./builds.js";
import * as BM from "./botmagic.js";
import * as Respec from "./respec.js";
import { isMelee, isWarPick, weaponScore, warTargetNeed, WAR_PRIO } from "./botweapon.js";
import * as Comp from "./companion.js";
import { feedSummons } from "./summonfood.js";
import * as Sch from "./schools.js";
import { hasStaff } from "./dummy.js";
import * as Tal from "./talents.js";
import { gold as ledger } from "./ledger.js";

const NAMES = ["Aldric", "Brenna", "Cael", "Dorna", "Edric", "Fenna", "Garrick", "Helga", "Ivo", "Jessa", "Korin", "Lyra", "Marek", "Nessa", "Orin", "Petra", "Quill", "Rhea", "Soren", "Talia", "Ulric", "Vesna", "Wynn", "Yara", "Zeke"];
const GOLD = 90;                                                       // Item.cfg: Gold
const THINK_MS = 100, ERRAND_MS = 3500, TARGET_MS = 300;
const isBow = d => /Bow/.test(d.name) && d.skill === 6;
export const isArcher = p => !!p.res && p.res.arch === "hunter";      // el cazador usa arco: dispara a cualquier distancia gastando flechas (combatsys.js)
const isStaff = d => d.appr >= 34 && d.appr < 40 && d.equipPos === EQUIP.RHAND;          // báculo/varita mágica: el summon de apoyo (Healer/Buffer/Aura) exige uno en la mano (dummy.js hasStaff)
// Mago de apoyo (INVENTO): la mitad de los estudiosos (según el nombre) sigue la rama del invocador de apoyo: con el nivel que exige el báculo (30, Item.cfg) lo compra y adopta Healer, Buffer y Aura
export const isSupport = p => { if (!p.res || p.res.arch !== "scholar") return false; if (p.res.job === "support") return true; let h = 0; for (const c of p.name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 2 === 0; };
// Bloqueo registrado (v0.77.0): `b.stuck = {why, since}`; residents.js lo vuelca al informe si dura
function stuck(w, p, b, why) { if (!b.stuck || b.stuck.why !== why) b.stuck = { why, since: w.time }; b.stuck.last = w.time; }       // `last`: la última vez que seguía bloqueado (si ya se resolvió no se informa)
const ARROW = 77, ARROWS_MAX = 150;
const SKIP_WEAPON = /Wand|Staff|Rod|Arrow|Hammer\(M\)|Pickaxe|Hoe/;

export const isBot = p => !!p?.bot;

// ---------------------------------------------------------------- creación
export function pickName(taken) {
  for (const n of NAMES) if (!taken.has(n.toLowerCase())) return n;
  for (let i = 2; ; i++) { const n = NAMES[i % NAMES.length] + i; if (!taken.has(n.toLowerCase())) return n; }
}
// v0.85.76 (obs. 34): solo los futuros Guildmasters (1 de cada 5 residentes, por nombre) suben a carisma 20; el resto se queda en 10
export const futureMaster = name => { let h = 7; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 5 === 0; };
export const BOT_STATS = { str: 14, vit: 12, dex: 12, int: 10, mag: 10, chr: 10 };
// Mago (INVENTO): mismos 68 puntos que BOT_STATS pero con Int y Mag (Magic.cfg: Magic Missile pide Int 18, Heal Int 20)
export const BOT_MAGE_STATS = { str: 8, vit: 12, dex: 10, int: 18, mag: 12, chr: 8 };
// Prepara a un jugador recién creado: nivel, oro y cerebro
export function init(w, p, opts = {}) {
  const lvl = Math.max(1, Math.min(opts.level | 0 || 1, MAX_LEVEL));
  if (opts.keep) {}                                                      // habitante cargado de su partida: conserva nivel y oro
  else if (lvl > 1) { p.level = lvl; p.exp = R.expForLevel(lvl); p.pool += (lvl - 1) * R.LEVELUP_POINTS; }
  if (!opts.keep) ledger(w, p, 400 + lvl * 250, "bot_grant", { artificial: "bot" });
  Tut.init(p, false);                                                    // un bot no hace el tutorial (el observador no debe verlo)
  w.recalc(p);
  p.bot = { farmer: !opts.keep && !opts.owner && w.rng() < 0.3, owner: opts.owner ?? null, next: 0, errand: 0, tgtAt: 0, target: null, path: null, goal: null, bad: new Set(), home: { x: p.x, y: p.y }, lvl: p.level, said: 0, fails: 0, mage: !!opts.mage };
  if (!opts.keep) errands(w, p, p.bot, true);
  p.hp = p.maxHp; p.mp = p.maxMp; p.sp = p.maxSp;
}

// NIVEL MÁXIMO (v0.85.80, petición del propietario, INVENTO): stats a base (lo hace quien llama con resetCharacter + init nivel 1), nivel MAX_LEVEL, los puntos de
// nivel repartidos según su build (el mago sube Int hasta lo que pide la magia más cara de Magic.cfg), 100000 de oro y compra de TODAS las magias que su Int permita
// (botmagic.study respeta reqInt y coste de Magic.cfg: no compra lo que no puede aprender).
// v0.85.86: Str a repartir = la del arma que lleva o, en el guerrero, la de su arma objetivo (botweapon.warTargetNeed)
export const strNeedOf = (w, p) => Math.max(weaponStrNeed(p, w.data), !isCaster(p) && !isArcher(p) && !isSupport(p) && p.bot ? warTargetNeed(w, p, p.bot) : 0);
export const MAXOUT_GOLD = 100000;
export const BOT_GOLD = 1000000, BOT_GOLD_MIN = 500000; // #114: los bots siempre tienen oro para herrero, pociones y equipo; se repone al bajar de la mitad
// v0.85.96 (Pablo): kit del guerrero: el arma objetivo de su build (la primera de botweapon.WAR_PRIO a cuya Str llega) se crea y se equipa si la que lleva es peor. Devuelve el nombre o null.
export function giveWarKit(w, p) {
  const b = p.bot; if (!b || isCaster(p) || isArcher(p) || isSupport(p)) return null;
  const build = warBuildOf({ ...p, bot: b }), base = d => d.name.replace(/\+\d$/, ""), str = p.stats.str;
  const ok = d => d && isWarPick(d) && (d.levelLimit || 0) <= p.level && warStrOf(d.name, build) <= str;
  const all = [...w.data.items.values()].filter(ok), rank = d => WAR_PRIO[base(d)] || 1;
  let cand = all.filter(d => (build.weapons || []).includes(base(d))).sort((x, y) => rank(y) - rank(x))[0];
  if (!cand) cand = all.filter(d => base(d) === "Flameberge")[0];          // sin arma pesada a su alcance: Flameberge (Str 130)
  if (!cand) return null;
  const worn = [EQUIP.TWOHAND, EQUIP.RHAND].map(sl => p.equip[sl]).filter(u => u !== undefined).map(u => p.bag.find(i => i.uid === u)).filter(Boolean);
  if (worn.some(i => base(w.data.item(i.id)) === base(cand))) return cand.name;
  const inst = newInst(w, cand.id, 1);
  Inv.addToBag(p, w.data, inst);
  if (!tryEquip(w, p, b, inst)) { Inv.removeFromBag?.(p, inst.uid); return null; }
  w.recalc(p); return cand.name;
}
// RESET SUAVE (v0.85.91, obs. 49; F1 → Herramientas → Bots): sin objetos ni puestos, estadísticas devueltas y repartidas con su build, todas las habilidades al 100 % y 1.000.000 de oro:
// los bots compran lo que necesiten y se ve qué builds arman. Conserva nivel, nombre y rol.
export function softReset(w, p) {
  const b = p.bot; if (!b || p.dead) return false;
  p.bag.length = 0; p.equip = {}; p.gold = 0; b.bad = new Set(); b.badUid = new Set(); b.bought = 0; b.wish = null;
  Respec.freeReset(w, p);
  for (const k of Object.keys(p.skills)) p.skills[k] = 100;
  w.recalc(p);
  for (const [stat, n] of Object.entries(allocate(p, p.pool, strNeedOf(w, p), isCaster(p) ? Math.min(R.STAT_LIMIT, Math.max(0, ...Object.values(w.magic || {}).filter(m => m && m.cost >= 0).map(m => m.reqInt | 0))) : 0))) if (n > 0) w.command(p.id, { t: "stat", stat, n });
  if (p.pool > 0) w.command(p.id, { t: "stat", stat: "str", n: p.pool });
  ledger(w, p, 1000000, "debug", { debug: true });
  if (isMage(p) && mageBuildOf(p).id === "support") errands(w, p, b, true);
  for (let i = 0; i < 80 && isCaster(p) && BM.study(w, p, b, t => blog(w, p, t)); i++);
  errands(w, p, b, true);
  w.recalc(p); p.hp = p.maxHp; p.mp = p.maxMp; p.sp = p.maxSp;
  blog(w, p, "Reset suave: sin objetos, estadísticas repartidas según mi build, habilidades al 100 % y 1.000.000 de oro para equiparme.");
  return true;
}
export function maxOut(w, p) {
  const b = p.bot; if (!b || p.dead) return false;
  p.level = MAX_LEVEL; p.exp = R.expForLevel(MAX_LEVEL); p.pool += (MAX_LEVEL - 1) * R.LEVELUP_POINTS;
  const needInt = Math.max(0, ...Object.values(w.magic || {}).filter(m => m && m.cost >= 0).map(m => m.reqInt | 0));
  w.recalc(p);
  for (const [stat, n] of Object.entries(allocate(p, p.pool, strNeedOf(w, p), isCaster(p) ? Math.min(R.STAT_LIMIT, needInt) : 0))) if (n > 0) w.command(p.id, { t: "stat", stat, n });
  if (p.pool > 0) w.command(p.id, { t: "stat", stat: "str", n: p.pool });
  ledger(w, p, MAXOUT_GOLD, "debug", { debug: true });
  if (isMage(p) && mageBuildOf(p).id === "support") errands(w, p, b, true);      // v0.85.90: la cota y la torre del soporte se compran antes que los hechizos (se comen todo el oro)
  for (let i = 0; i < 80 && BM.study(w, p, b, t => blog(w, p, t)); i++);      // una magia por llamada: hasta agotar Int u oro
  errands(w, p, b, true);
  w.recalc(p); p.hp = p.maxHp; p.mp = p.maxMp; p.sp = p.maxSp;
  return true;
}

// ---------------------------------------------------------------- recados (reparto de puntos, compras, equipo, comida)
// v0.85.86: piensan cuándo beber (nunca con el depósito lleno). Poción HP/MP = v1d(v2)+v3 (UseItemHandler, HG.cpp:17560): solo se bebe si falta al menos su media.
export const potionUseful = (w, it, deficit) => { const d = it && w.data.item(it.id); return !!d && deficit >= Math.floor(1.3 * (d.v1 * (d.v2 + 1) / 2 + d.v3)); };      // v0.85.99 (obs. 100): ni con el depósito casi lleno (hace falta 1,3 veces la media)
const catalogs = new WeakMap();
function catalog(data) {
  let c = catalogs.get(data);
  if (c) return c;
  c = { gear: new Map(), potion: null, mana: null, foods: [] };
  for (const d of data.items.values()) {
    if (!d || !(d.price > 0) || !d.name || d.family === "psychic" || Shop.IS_MASTER_ITEM.test(d.name)) continue;      // v0.85.97 (obs. 78): sin objetos Master                       // el Psychic Controller no es un arma de combate para los bots
    if (d.type === ITYPE.EQUIP && d.equipPos > 0 && d.equipPos <= EQUIP.FULLBODY && d.equipPos !== EQUIP.NECK && d.equipPos !== EQUIP.RFINGER && d.equipPos !== EQUIP.LFINGER && d.equipPos !== EQUIP.BACK && d.equipPos !== EQUIP.FULLBODY) {
      if ((d.equipPos === EQUIP.RHAND || d.equipPos === EQUIP.TWOHAND) && SKIP_WEAPON.test(d.name)) continue;
      if (d.effectType === EFFECT.ATTACK_SPECABLTY || d.effectType === EFFECT.DEFENSE_SPECABLTY) continue;
      const slot = d.equipPos === EQUIP.TWOHAND ? EQUIP.RHAND : d.equipPos;
      if (!c.gear.has(slot)) c.gear.set(slot, []);
      c.gear.get(slot).push(d);
    }
  }
  for (const l of c.gear.values()) l.sort((a, b) => b.price - a.price);
  c.potion = data.named("RedPotion"); c.mana = data.named("BluePotion");
  c.foods = ["Meat", "Baguette"].map(n => data.named(n)).filter(Boolean);
  catalogs.set(data, c);
  return c;
}
const slotOf = d => (d.equipPos === EQUIP.TWOHAND ? EQUIP.RHAND : d.equipPos);
const countOf = (p, id) => p.bag.reduce((a, i) => a + (i.id === id ? i.count || 1 : 0), 0);

function spendPoints(w, p) {
  if (p.pool <= 0) return;
  if (p.res && futureMaster(p.name) && p.level >= 15 && p.stats.chr < 20) w.command(p.id, { t: "stat", stat: "chr", n: Math.min(p.pool, 20 - p.stats.chr) });        // carisma 20: requisito para fundar un guild (systems/guild.js)
  if (p.pool <= 0) return;
  if (p.res || p.bot) { for (const [stat, n] of Object.entries(allocate(p, p.pool, strNeedOf(w, p)))) if (n > 0) w.command(p.id, { t: "stat", stat, n }); }                  // reparto según su build (builds.js)
  else { const total = p.pool, str = Math.ceil(total * 0.4), vit = Math.ceil(total * 0.4);      // más vida (QA: a nivel 50 los Troll y Cíclopes mataban con ~375 de vida)
    for (const [stat, n] of [["str", str], ["vit", vit], ["dex", total - str - vit]]) if (n > 0) w.command(p.id, { t: "stat", stat, n }); }
  if (p.pool > 0) w.command(p.id, { t: "stat", stat: "str", n: p.pool });
}
function buy(w, p, d, n = 1) {
  const cost = d.price * n;
  if (p.gold < cost) return null;
  const inst = newInst(w, d.id, n);
  if (!Inv.canCarry(p, w.data, d, n, inst) || (p.bag.length >= MAX_ITEMS && !p.bag.some(i => i.id === d.id))) return null;
  ledger(w, p, -cost, "bot_buy", { artificial: "bot" });
  Inv.addToBag(p, w.data, inst);
  return inst;
}
// ESCUDO CONTRA VARIOS (v0.85.55): con 3 o más enemigos pegándole, un guerrero con skill de Shield que lleva un escudo en la mochila se lo pone (reduce el daño).
// Si lleva arma a dos manos no cambia (perdería el arma). INVENTO: el original no tiene bots.
function swarmShield(w, p, b) {
  if (p.equip[EQUIP.LHAND] !== undefined || p.equip[EQUIP.TWOHAND] !== undefined || !((p.skills[SKILL.SHIELD] || 0) > 0) || w.time - (b.shAt || -1e9) < 8000) return false;
  let n = 0; for (const e of w.ents.values()) if (e !== p && !e.dead && e.target === p.id && dist(e, p) <= 3) n++;
  if (n < 3) return false;
  const sh = p.bag.find(i => { const d = w.data.item(i.id); return d && d.equipPos === EQUIP.LHAND && i.life !== 0 && !(d.levelLimit > p.level) && !b.bad.has(i.id); });
  if (!sh) return false;
  b.shAt = w.time;
  if (!tryEquip(w, p, b, sh)) return false;
  blog(w, p, `Me rodean ${n} enemigos: me pongo ${w.data.item(sh.id).name} para recibir menos daño.`); return true;
}
function tryEquip(w, p, b, inst) {
  const before = { ...p.equip }, pos = w.data.item(inst.id).equipPos;
  w.command(p.id, { t: "equip", uid: inst.uid });
  if (p.equip[pos] === inst.uid) { if (before[pos] !== undefined) (b.eqAt ||= {})[pos] = w.time; return true; }          // #118: guarda cuándo cambió esa casilla (histéresis de 5 min)
  b.bad.add(inst.id); p.equip = before;                                // no le sirve (nivel, fuerza, atributo): se revende
  return false;
}
// MOCHILA: la gestiona botitems.js (valor de cada objeto → equipar / guardar / vender, orden de la mochila y lista de deseos).
export const bagClass = (w, p, i) => { const v = judge(w, p, i, friendsOf(w, p)); return v.act === "equip" ? "keep" : v.act; };
const friendsOf = (w, p) => w.hooks?.friends?.(p) || [];
// v0.85.99 (obs. 106): vender y guardar en el almacén exige estar en una ciudad (tienda / herrero / almacén); en campo, granja o cripta solo se marca el viaje si la mochila pesa mucho
const inTown = w => w.map?.kind === "town" || w.map?.kind === "indoor";
const sellExtra = (w, p, force = false) => {
  if (!force && w.map && !inTown(w)) {
    const b = p.bot, load = Inv.totalWeight(p, w.data) / Math.max(1, Inv.maxLoad(p));
    if (b && !b.rest && !b.owner && (load >= 0.75 || p.bag.length >= 30) && w.time - (b.junkAt || -1e9) > 120000) { b.junkAt = w.time; think_(w, p, b, "rest", {}, 0); blog(w, p, "Voy a la ciudad a vender lo que me sobra y guardar en el almacén lo que sirve a otros (obs. 106)."); }
    return 0;
  }
  return manageNow(w, p, force);
};
const manageNow = (w, p, force = false) => manage(w, p, { force, friends: friendsOf(w, p), log: t => blog(w, p, t), stallKeep: p.res ? 8 : 0 });
// Manuales de habilidad: sin maestría (0 %) el arma que lleva puesta nunca acierta y la habilidad no sube (gainSSN). Compra y estudia el de su arma y el de su escudo.
// #118 (obs. revisión de bots): una casilla ya cubierta no se recambia hasta pasados 5 min del último cambio (Brenna, Rhea, Cora, Leif: bucles de casco/armadura)
export const EQ_SETTLE_MS = 300000;
export const eqFresh = (w, b, ...slots) => slots.some(sl => b.eqAt?.[sl] !== undefined && w.time - b.eqAt[sl] < EQ_SETTLE_MS && w.time > EQ_SETTLE_MS);
// #116: sumidero de oro. Con más de 150k de oro (los residentes llegan a 900k) el bot compra más reservas y el manual de Resistencia mágica; con más de 300k reparte a un amigo pobre
export const GOLD_RICH = 150000, GOLD_GIFT = 300000;
export function studyManuals(w, p, b) {
  const need = [];
  if ((p.res || (p.bot && !b.owner)) && p.gold > GOLD_RICH && !((p.skills[SKILL.MAGIC_RES] || 0) > 0)) need.push(SKILL.MAGIC_RES);
  if (p.eff?.wtype > 0 && !((p.skills[p.eff.skill] || 0) > 0)) need.push(p.eff.skill);
  if (p.equip[EQUIP.LHAND] !== undefined && !((p.skills[SKILL.SHIELD] || 0) > 0)) need.push(SKILL.SHIELD);
  const tried = b.manualAt || (b.manualAt = {});
  for (const sk of need) {
    if (w.time - (tried[sk] || -1e9) < 300000) continue;                    // v0.85.97 (obs. 55): un intento cada 5 min por habilidad (antes repetía la compra y el mensaje 67 veces)
    tried[sk] = w.time;
    const d = [...w.data.items.values()].find(x => x && x.effectType === EFFECT.STUDYSKILL && x.v1 === sk && x.price > 0);
    if (!d) continue;
    let inst = p.bag.find(i => i.id === d.id);
    if (!inst) { if (p.gold < d.price + 40) continue; inst = buy(w, p, d); if (inst) blog(w, p, `Compro ${d.name} (${d.price} de oro): sin esa habilidad fallo todos los golpes.`); }
    if (inst && useItem(w, p, inst.uid)) blog(w, p, `Estudio ${d.name}: ahora domino ${SKILL_NAMES[sk] || "la habilidad"}.`);
  }
}

// v0.85.98 (obs. 89/91): nunca pelea con una pieza de armadura vacía ni casi rota. Casillas vacías: compra la mejor pieza que use y pague (sin esperar a la lista de deseos);
// armadura/armas gastadas (menos del 50 % de vida): las repara con el herrero (shopsys.repairCost). Devuelve cuántas piezas siguen mal (la puerta de preparación espera).
const ARMOR_SLOTS = [EQUIP.BODY, EQUIP.LEGGINGS, EQUIP.HEAD, EQUIP.ARMS];
export function armorCare(w, p, b, cat, usable, worn) {
  if (p.dead) return 0;
  let gaps = 0;
  for (const sl of ARMOR_SLOTS) {
    if (worn(sl)) continue;
    const owned = p.bag.find(i => { const d = w.data.item(i.id); return d && slotOf(d) === sl && usable(d) && i.life !== 0 && !(b.badUid ||= new Set()).has(i.uid); });
    if (owned) { if (tryEquip(w, p, b, owned)) blog(w, p, `Me pongo ${w.data.item(owned.id).name}: no peleo con una pieza de armadura vacía.`); else b.badUid.add(owned.uid); continue; }
    const d = (cat.gear.get(sl) || []).find(x => usable(x) && !b.bad.has(x.id) && p.gold >= x.price + 40 && !soldRecently(w, p, x.id));
    if (!d) { if ((cat.gear.get(sl) || []).some(x => usable(x) && !b.bad.has(x.id))) gaps++; continue; }
    const inst = buy(w, p, d); if (!inst) { b.bad.add(d.id); continue; }
    if (tryEquip(w, p, b, inst)) { b.bought = 1; blog(w, p, `Compro ${d.name} (${d.price} de oro): me faltaba esa pieza de armadura.`); }
    else { b.badUid.add(inst.uid); ledger(w, p, d.price, "bot_refund", { artificial: "bot" }); Inv.removeFromBag(p, inst.uid); }
  }
  let fixed = 0, spent = 0;
  for (const i of p.bag) {
    const d = w.data.item(i.id);
    if (!d || !(d.category >= 1 && d.category <= 10) || i.life === undefined || i.life < 0 || !(d.maxLife > 0) || i.life >= d.maxLife * 0.5) continue;
    const price = Shop.repairCost(i, d);
    if (!(price > 0) || p.gold < price + 30) { if (Object.values(p.equip).includes(i.uid)) gaps++; continue; }
    i.life = d.maxLife; ledger(w, p, -price, "shop_repair"); fixed++; spent += price;
  }
  if (fixed) { w.recalc(p); blog(w, p, `Reparo ${fixed} pieza(s) de equipo con el herrero (${spent} de oro): no voy a la batalla con la armadura casi rota.`); }
  b.armorGap = gaps;
  return gaps;
}
export function errands(w, p, b, first = false) {
  if (p.dead) return;
  spendPoints(w, p);
  if (p.gold < BOT_GOLD_MIN && !b.noGrant) ledger(w, p, BOT_GOLD - p.gold, "bot_grant", { artificial: "bot" });
  Lore.sample(w, p, b);
  const cat = catalog(w.data);
  { const ar = w.data.item(ARROW), have = countOf(p, ARROW);          // arquero con arco puesto: lleva flechas de sobra (1 de oro cada una); sin ellas el arco no hace daño
    if (ar && p.eff?.bow && have < ARROWS_MAX / 2) { const n = Math.min(ARROWS_MAX - have, Math.floor(p.gold / 4)); if ((n > 10 || (have === 0 && n > 0)) && buy(w, p, ar, n)) blog(w, p, `Compro ${n} flechas: con el arco disparo desde lejos.`); } }
  // comida y pociones
  const rich = (p.res || (p.bot && !b.owner)) && p.gold > GOLD_RICH;
  const potCap = rich ? 40 : p.res && p.level >= 15 ? Math.max(6, Math.min(40, Math.floor(p.gold / 60))) : 6;               // con oro de sobra lleva más pociones (aguantan más los jefes)
  if (cat.potion && countOf(p, cat.potion.id) < potCap) buy(w, p, cat.potion, potCap - countOf(p, cat.potion.id));
  const manaCap = isCaster(p) ? (rich ? 100 : Math.max(potCap, Math.min(50, Math.floor(p.gold / 45)))) : 0;          // v0.85.81: el mago gasta más maná que vida (replay zzzz_620: 43 BluePotion en una sola salida de caza)
  if (isCaster(p) && cat.mana && countOf(p, cat.mana.id) < manaCap) buy(w, p, cat.mana, manaCap - countOf(p, cat.mana.id));      // v0.85.48: el lanzador lleva pociones de maná para seguir tirando magias
  if (cat.foods[0] && cat.foods.reduce((a, d) => a + countOf(p, d.id), 0) < 4) buy(w, p, cat.foods[0], 4);
  feedSummons(w, p, t => blog(w, p, t), !p.res);                              // comida preferida del summon (principal primero): sube sus estadísticas
  // Equipo: se compara por ITEM LEVEL (itemlevel.js) casilla a casilla, con lo que lleve puesto, lo que tenga en la mochila (botín incluido)
  // y lo que venda la tienda. Un objeto de dos manos compite con espada + escudo.
  const swing = i => { const d = w.data.item(i.id); return d && d.equipPos >= EQUIP.RHAND && d.equipPos <= EQUIP.TWOHAND && !isStaff(d) ? Math.min(1, (p.stats.str + p.pool) / Math.max(1, swingStr(d, i))) : 1; };      // v0.85.48: sin la Str del arma (peso y velocidad, builds.js swingStr) el golpe es lento: vale proporcionalmente menos
  const ilv = i => (i ? Lore.factor(w, i.id) * (itemLevel(w.data.item(i.id), i.attr, i.id) + bonusScore(p, w.data.item(i.id), i.attr, b.foeKind) + (isCaster(p) ? BM.casterBonus(w.data.item(i.id)) : 0)) * (isArcher(p) && isBow(w.data.item(i.id)) ? 2 : 1) * swing(i) : 0);      // el cazador prefiere el arco (INVENTO: el item level no mide el alcance)
  if (((isSupport(p) && p.level >= 30) || isMage(p)) && !hasStaff(p) && !p.bag.some(i => isStaff(w.data.item(i.id)))) {          // sin báculo: compra el más barato que exige su nivel
    const st = [...w.data.items.values()].filter(d => d && isStaff(d) && d.family !== "psychic" && d.price > 0 && d.price * 1.5 <= p.gold && !(d.levelLimit > p.level) && !b.bad.has(d.id)).sort((x, y) => y.price - x.price)[0];
    if (st && buy(w, p, st)) blog(w, p, `Compro ${st.name} (${st.price} de oro): una varita en la mano mantiene a un summon de apoyo y deja lanzar hechizos.`);
  }
  if (isArcher(p) && !p.bag.some(i => isBow(w.data.item(i.id))) && !p.eff?.bow) {          // sin arco: compra el mejor que pueda usar y pagar
    const bow = [...w.data.items.values()].filter(d => d && isBow(d) && d.price > 0 && d.price * 1.5 <= p.gold && !(d.levelLimit > p.level) && !b.bad.has(d.id)).sort((x, y) => y.price - x.price)[0];
    if (bow && buy(w, p, bow)) blog(w, p, `Compro un ${bow.name} (${bow.price} de oro): quiero pelear a distancia.`);
  }
  // v0.85.97 (obs. 81, Pablo: todos los warriors deberían tener un arco): el guerrero lleva en la mochila un arco barato y 30 flechas (para rematar al que huye o ayudar de lejos)
  if (p.bot && !isCaster(p) && !isArcher(p) && !isSupport(p) && p.level >= 10 && !p.eff?.bow) {
    let bow = p.bag.find(i => isBow(w.data.item(i.id)));
    if (!bow) { const d = [...w.data.items.values()].filter(x => x && isBow(x) && x.price > 0 && x.price * 4 <= p.gold && !(x.levelLimit > p.level) && !b.bad.has(x.id) && !soldRecently(w, p, x.id)).sort((x, y) => y.price - x.price)[0]; if (d && (bow = buy(w, p, d))) blog(w, p, `Compro un ${d.name} (${d.price} de oro): un arco para el que huye o para ayudar desde lejos.`); }
    const ar = w.data.item(ARROW); if (bow && ar && countOf(p, ARROW) < 15 && p.gold > 200) { const n = Math.min(30, Math.floor(p.gold / 8)); if (n > 0 && buy(w, p, ar, n)) blog(w, p, `Compro ${n} flechas para el arco de reserva.`); }
  }
  // #108: ningún bot/residente usa yelmos (Horned-Helm, FullHelm, Wing Helm…: piden Str alta). Migración: quita lo puesto y vende lo de la mochila. El Wizard-Hat/Cap del mago no es yelmo.
  for (const sl of [EQUIP.HEAD]) { const u = p.equip[sl], wi = u !== undefined ? Inv.instOf(p, u) : null; if (wi && isHelm(w.data.item(wi.id))) { w.command(p.id, { t: "unequip", uid: wi.uid }); blog(w, p, `Me quito ${w.data.item(wi.id).name}: los bots ya no llevan yelmo (#108).`); } }
  for (const i of [...p.bag]) if (isHelm(w.data.item(i.id)) && !Object.values(p.equip).includes(i.uid)) { ledger(w, p, Math.floor((w.data.item(i.id).price || 0) / 2), "bot_refund", { artificial: "bot" }); Inv.removeFromBag(p, i.uid); }
  const worn = slot => { const uid = p.equip[slot]; return uid !== undefined ? Inv.instOf(p, uid) : null; };
  const staffOk = isSupport(p) || isMage(p), wv = slot => { const i = worn(slot); return i && isStaff(w.data.item(i.id)) && !staffOk ? 0 : ilv(i); };      // v0.85.57: el guerrero nunca pega con báculo: si lo lleva, vale 0 y se cambia por el mejor arma
  const value = slot => slot === EQUIP.RHAND ? Math.max(wv(EQUIP.TWOHAND), wv(EQUIP.RHAND)) : ilv(worn(slot));
  const poolStr = isCaster(p) ? 0 : p.pool;          // v0.85.91 (obs. 47): el mago reparte su pool en Int/Mag, no en Str: no cuenta como Str para vestir (el Wing Helm pide 130)
  const reqOk = d => { const st = { 10: "str", 11: "dex", 12: "vit", 13: "int", 14: "mag", 15: "chr" }[d.v4]; return ![EQUIP.HEAD, EQUIP.BODY, EQUIP.ARMS, EQUIP.LEGGINGS].includes(d.equipPos) || !st || p.stats[st] + (st === "str" ? poolStr : 0) >= d.v5; };      // v0.85.48: no compra ni se pone armadura cuya Str/Dex/Int exigida no cumple (inventory.js equip): evita comprar y quedarse desnudo
  for (const sl of [EQUIP.HEAD, EQUIP.BODY, EQUIP.ARMS, EQUIP.LEGGINGS]) { const wi = worn(sl); if (wi && !reqOk(w.data.item(wi.id))) { w.command(p.id, { t: "unequip", uid: wi.uid }); b.bad.add(wi.id); blog(w, p, `Me quito ${w.data.item(wi.id).name}: no cumplo su requisito de atributo.`); } }
  const usable = d => d && d.type === ITYPE.EQUIP && !isHelm(d) && reqOk(d) && !(d.levelLimit > p.level) && !(d.weight > (p.stats.str + poolStr) * 100) && !(d.gender === 1 && p.gender !== 1) && !(d.gender === 2 && p.gender !== 2) &&
    d.equipPos > 0 && d.equipPos < EQUIP.FULLBODY && d.effectType !== EFFECT.ATTACK_SPECABLTY && d.effectType !== EFFECT.DEFENSE_SPECABLTY && !(d.equipPos >= EQUIP.RHAND && d.equipPos <= EQUIP.TWOHAND && (SKIP_WEAPON.test(d.name) && !(isStaff(d) && (isSupport(p) || isMage(p))))) && (!isBow(d) || isArcher(p)) && (!isStaff(d) || isSupport(p) || isMage(p)) && !(isArcher(p) && d.equipPos === EQUIP.LHAND) && !(isMage(p) && (d.equipPos === EQUIP.LHAND || d.equipPos === EQUIP.TWOHAND || (d.equipPos === EQUIP.RHAND && !isStaff(d)))) && !(isSupport(p) && hasStaff(p) && !isStaff(d) && (d.equipPos === EQUIP.RHAND || d.equipPos === EQUIP.TWOHAND));          // con la varita en la mano no vuelve al sable
  // v0.85.90 (Pablo): el mago de soporte (Str 40) lleva Chain Mail y Tower Shield. Se compran ANTES de estudiar (los hechizos se comen todo el oro). La cota se viste (la armadura de
  // cuerpo no impide lanzar); la torre se lleva en la mochila: un escudo en LHAND impide lanzar (_bIsItemOnHand, Game.cpp; magicsys.js usable), así que solo se la pone sin maná (BM.ensureHands).
  if (isMage(p) && mageBuildOf(p).id === "support") {
    for (const [pos, re] of [[EQUIP.BODY, /^ChainMail/], [EQUIP.LHAND, /^TowerShield/]]) {
      const d = (cat.gear.get(pos) || []).find(x => re.test(x.name) && (pos === EQUIP.LHAND ? x.type === ITYPE.EQUIP && !(x.levelLimit > p.level) && !(x.weight > (p.stats.str + p.pool) * 100) : usable(x))); if (!d) continue;
      const has = p.bag.find(i => re.test(w.data.item(i.id)?.name || ""));
      if (has) { if (pos === EQUIP.BODY && p.equip[pos] !== has.uid && tryEquip(w, p, b, has)) blog(w, p, `Me visto ${d.name}: armadura pesada para el mago de soporte.`); continue; }
      if (p.gold < d.price + 60 || b.bad.has(d.id)) continue;
      const inst = buy(w, p, d); if (!inst) { b.bad.add(d.id); continue; }
      b.bought = 1; blog(w, p, `Compro ${d.name} (${d.price} de oro): equipo del mago de soporte.`);
      if (pos === EQUIP.BODY && !tryEquip(w, p, b, inst)) b.badUid = (b.badUid || new Set()).add(inst.uid);
    }
  }
  // v0.85.91 (obs. 48): el guerrero lleva siempre armadura de placa (PlateMail, PlateLeggings, FullHelm): la compra en cuanto la usa (Str/peso) y la paga, antes que otras mejoras menores
  if (!isCaster(p) && !isArcher(p) && !isSupport(p)) {
    for (const [pos, re] of [[EQUIP.BODY, /^PlateMail/], [EQUIP.LEGGINGS, /^PlateLeggings/]]) {          // #108: ya no hay yelmos (ni Horned-Helm ni FullHelm)          // v0.85.99 (obs. 101): con Str de sobra el yelmo de cuernos (17/24) va antes que el FullHelm (10/20)
      const d = (cat.gear.get(pos) || []).find(x => re.test(x.name) && usable(x)); if (!d) continue;
      const cw = worn(pos), has = p.bag.find(i => re.test(w.data.item(i.id)?.name || "") && !(b.badUid ||= new Set()).has(i.uid));
      if (cw && re.test(w.data.item(cw.id)?.name || "")) continue;
      if (cw && (eqFresh(w, b, pos) || !(ilv(cw) * 1.08 + 0.5 < ilv({ id: d.id, attr: has?.attr ?? 0 })))) continue;          // #110: histéresis; si lo que lleva ya vale tanto como la placa no se cambia (se vestía y desvestía la placa en bucle contra la mejora genérica)
      if (has) { if (tryEquip(w, p, b, has)) blog(w, p, `Me visto ${d.name}: el guerrero lleva placa.`); else b.badUid.add(has.uid); continue; }
      if (p.gold < d.price + 60 || b.bad.has(d.id)) continue;
      const inst = buy(w, p, d); if (!inst) { b.bad.add(d.id); continue; }
      b.bought = 1; blog(w, p, `Compro ${d.name} (${d.price} de oro): armadura de placa del guerrero.`);
      if (!tryEquip(w, p, b, inst)) b.badUid.add(inst.uid);
    }
  }
  // v0.85.99 (obs. 70): el mago lleva el Wizard-Hat (Mag 130, nivel 120) o, si aún no llega, el Wizard-Cap (Mag 110, nivel 90); la propia usable() comprueba nivel y requisito (Item.cfg)
  if (isCaster(p)) {
    for (const re of [/^Wizard-Hat/, /^Wizard-Cap/]) {
      const d = (cat.gear.get(EQUIP.HEAD) || []).find(x => re.test(x.name) && usable(x)); if (!d) continue;
      const cw = worn(EQUIP.HEAD); if (cw && /^Wizard-Hat/.test(w.data.item(cw.id)?.name || "")) break;
      if (cw && re.test(w.data.item(cw.id)?.name || "")) continue;
      const has = p.bag.find(i => re.test(w.data.item(i.id)?.name || "") && !(b.badUid ||= new Set()).has(i.uid));
      if (has) { if (tryEquip(w, p, b, has)) blog(w, p, `Me pongo ${d.name}: sombrero de mago.`); else b.badUid.add(has.uid); break; }
      if (p.gold < d.price + 60 || b.bad.has(d.id)) continue;
      const inst = buy(w, p, d); if (!inst) { b.bad.add(d.id); continue; }
      b.bought = 1; blog(w, p, `Compro ${d.name} (${d.price} de oro): sombrero de mago.`);
      if (!tryEquip(w, p, b, inst)) b.badUid.add(inst.uid); break;
    }
  }
  armorCare(w, p, b, cat, usable, worn);
  // #121: la camisa (Shirt) no es armadura de brazos: la cambia por un Hauberk (el mejor que use y pague) y no se queda sin botas (LongBoots, casilla de pies)
  for (const [sl, re, why] of [[EQUIP.ARMS, /Hauberk/, "hauberk"], [EQUIP.LEGGINGS, /^LongBoots/, "botas"]]) {
    const cw = worn(sl), cn = cw && w.data.item(cw.id)?.name || "";
    if (cw && !/^Shirt/.test(cn) && cn) continue;
    if (cw && eqFresh(w, b, sl)) continue;
    const d = (cat.gear.get(sl) || []).find(x => re.test(x.name) && usable(x) && !b.bad.has(x.id) && p.gold >= x.price + 60);
    if (!d) continue;
    const has = p.bag.find(i => i.id === d.id && !(b.badUid ||= new Set()).has(i.uid)), inst = has || buy(w, p, d);
    if (!inst) continue;
    if (tryEquip(w, p, b, inst)) { b.bought = 1; blog(w, p, `Me pongo ${d.name} (${why}): hueco de equipo cubierto (#121).`); } else { b.badUid.add(inst.uid); if (!has) { ledger(w, p, d.price, "bot_refund", { artificial: "bot" }); Inv.removeFromBag(p, inst.uid); } }
  }
  studyManuals(w, p, b);
  if (isCaster(p) || p.stats.int >= 20) { BM.study(w, p, b, t => blog(w, p, t)); }      // v0.85.97 (obs. 65/76/86): el guerrero con Int también aprende todo lo que su Int permite (antes solo el mago llegaba aquí)
  // ARMA DEL GUERRERO (v0.85.82): la de mayor daño esperado (botweapon.js) entre la que lleva, la de la mochila y la que vende la tienda a su alcance
  const warW = !isCaster(p) && !isArcher(p) && !isSupport(p);
  if (warW) {
    const wornW = [EQUIP.TWOHAND, EQUIP.RHAND].map(worn).filter(Boolean).filter(i => isMelee(w.data.item(i.id)));
    const cur = Math.max(0, ...wornW.map(i => weaponScore(w, p, b, w.data.item(i.id), i)));
    let pick = null;
    const wFresh = cur > 0 && eqFresh(w, b, EQUIP.RHAND, EQUIP.TWOHAND);          // #118
    for (const i of wFresh ? [] : p.bag) {
      const d = w.data.item(i.id);
      if (!isWarPick(d) || !usable(d) || (b.badUid ||= new Set()).has(i.uid) || i.life === 0 || Object.values(p.equip).includes(i.uid)) continue;
      const sc = weaponScore(w, p, b, d, i);
      if (sc > cur * 1.05 + 0.5 && (!pick || sc > pick.sc)) pick = { i, d, sc };
    }
    for (const d of wFresh ? [] : cat.gear.get(EQUIP.RHAND) || []) {
      if (!isWarPick(d) || b.bad.has(d.id) || !usable(d) || p.gold < d.price + 60) continue;
      const sc = weaponScore(w, p, b, d, null);
      if (sc > cur * 1.05 + 0.5 && (!pick || sc > pick.sc * 1.05)) pick = { i: null, d, sc };
    }
    if (pick) {
      const inst = pick.i || buy(w, p, pick.d);
      if (inst) {
        if (tryEquip(w, p, b, inst)) { if (!pick.i) b.bought = 1; blog(w, p, `${pick.i ? "Me equipo" : `Compro (${pick.d.price} de oro) y me equipo`} ${pick.d.name}: daño esperado ${Math.round(pick.sc)} frente a ${Math.round(cur)}${pick.d.equipPos === EQUIP.TWOHAND ? "; a dos manos, sin escudo" : ""}.`); }
        else { (b.badUid ||= new Set()).add(inst.uid); if (!pick.i) { ledger(w, p, pick.d.price, "bot_refund", { artificial: "bot" }); Inv.removeFromBag(p, inst.uid); } }
      } else if (!pick.i) b.bad.add(pick.d.id);
    }
  }
  const hasWar = warW && [EQUIP.TWOHAND, EQUIP.RHAND].some(sl => { const i = worn(sl); return i && isWarPick(w.data.item(i.id)); });          // con su arma de guerrero puesta no la cambia por item level; sin ella (nivel/Str bajos) vale el equipo genérico
  const noWpn = d => !(hasWar && isMelee(d));
  let best = null;
  for (const i of p.bag) {
    const d = w.data.item(i.id);
    if (!usable(d) || !noWpn(d) || (b.badUid ||= new Set()).has(i.uid) || i.life === 0 || Object.values(p.equip).includes(i.uid)) continue;
    if (d.equipPos === EQUIP.LHAND && (p.equip[EQUIP.TWOHAND] !== undefined || isMage(p))) continue;     // v0.85.90: ni escudo de mochila para el mago (la torre del soporte la saca ensureHands sin maná); un escudo expulsaría el arma a dos manos (y la vendería para recomprarla: bucle)
    const slot = slotOf(d), mine = ilv(i);
    if (worn(slot) && eqFresh(w, b, d.equipPos, slot)) continue;          // #118: menos de 5 min desde el último cambio de esa casilla
    const cur = d.equipPos === EQUIP.TWOHAND ? Math.max(ilv(worn(EQUIP.TWOHAND)), ilv(worn(EQUIP.RHAND)) + ilv(worn(EQUIP.LHAND))) : value(slot);
    if ((mine > cur * 1.08 + 0.5 || (isArcher(p) && isBow(d) && !p.eff?.bow && (p.gold >= 4 || countOf(p, ARROW) > 0)) || (isSupport(p) && isStaff(d) && !hasStaff(p))) && (!best || mine - cur > best.gain)) best = { i, gain: mine - cur };
  }
  if (best) {
    if (tryEquip(w, p, b, best.i)) blog(w, p, `Me equipo ${w.data.item(best.i.id).name} (item level ${ilv(best.i)}).`);
    else b.badUid.add(best.i.uid);
  }
  // LISTA DE DESEOS: la pieza que más le mejoraría. Si le llega el oro, la compra; si no, ahorra para ella (no gasta en mejoras menores) hasta tenerla
  let want = wish(w, p, cat.gear, b.bad, (pp, d) => noWpn(d) && !isHelm(d) && usable(pp, d) && !soldRecently(w, p, d.id));
  if (want && worn(want.slot) && eqFresh(w, b, want.slot)) want = null;          // #118
  b.wish = want ? { name: want.d.name, price: want.price, gain: want.gain, slot: want.slot } : null;
  b.saving = false;
  if (want) {
    const spare = want.price + 60;
    if (p.gold >= spare) {
      const inst = buy(w, p, want.d);
      if (inst) { if (tryEquip(w, p, b, inst)) { b.bought = 1; blog(w, p, `Compro ${want.d.name} (${want.price} de oro): era la mejora que más deseaba (+${want.gain} de item level).`); } else { ledger(w, p, want.d.price, "bot_refund", { artificial: "bot" }); Inv.removeFromBag(p, inst.uid); } }
    } else if (want.gain >= 8) { b.saving = true; if (w.time - (b.saveLog || -1e9) > 300000) { b.saveLog = w.time; blog(w, p, `Ahorro para ${want.d.name} (${want.price} de oro, +${want.gain} de item level): me faltan ${spare - p.gold}.`); } }
  }
  // AMIGOS: si le sobra mucho oro y un amigo conectado anda mal de equipo, le compra la pieza (la entrega el bucle de ayuda de residents.js)
  if (!first && !b.saving && w.time - (b.giftAt || -1e9) > 240000) {
    b.giftAt = w.time;
    const fw = friendWish(w, p, cat.gear, friendsOf(w, p));
    if (fw && p.gold >= fw.price * 2 + 150 && !p.bag.some(i => i.id === fw.d.id)) {
      const inst = buy(w, p, fw.d);
      if (inst) blog(w, p, `Compro ${fw.d.name} (${fw.price} de oro) para regalárselo a ${fw.q.name}, que anda corto de equipo.`);
    }
  }
  // #116: tienda entre residentes: con más de 300k reparte 25k a un amigo con menos de 20k (el oro se queda en la comunidad en vez de dormir en la cuenta)
  if (!first && rich && p.gold > GOLD_GIFT && w.time - (b.giftGoldAt || -1e9) > 600000) {
    b.giftGoldAt = w.time;
    const q = friendsOf(w, p).find(f => f && !f.dead && f.id !== p.id && f.gold < 20000);
    if (q) { ledger(w, p, -25000, "bot_gift", { artificial: "bot" }); ledger(w, q, 25000, "bot_gift", { artificial: "bot" }); blog(w, p, `Le doy 25000 de oro a ${q.name}, que anda justo: me sobra mucho (#116).`); }
  }
  // compras por catálogo: una pieza por recado (a la primera, un equipo completo)
  let bought = 0;
  const slots = [EQUIP.RHAND, EQUIP.BODY, EQUIP.LEGGINGS, EQUIP.LHAND, EQUIP.HEAD, EQUIP.ARMS, EQUIP.PANTS].sort((x, y) => value(x) - value(y));      // primero las casillas más flojas o vacías: las armaduras no quedan siempre detrás del arma
  for (const slot of slots) {
    if (slot === EQUIP.LHAND && (p.equip[EQUIP.TWOHAND] !== undefined || isMage(p))) continue;                  // v0.85.90: el mago no se pone escudos por item level (impiden lanzar)
    if (slot === EQUIP.RHAND && ((isArcher(p) && p.eff?.bow) || hasWar)) continue;      // el arco ya es su arma: otra arma de la tienda lo desequiparía
    if (worn(slot) && eqFresh(w, b, slot)) continue;          // #118
    const list = cat.gear.get(slot) || [], have = value(slot), budget = b.saving && want ? Math.min(p.gold * 0.6, p.gold - want.price - 60) : p.gold * (first ? 0.25 : 0.6);      // ahorrando: solo gasta lo que sobre del precio de la pieza deseada
    if (b.saving && budget <= 0) continue;
    let got = false;
    for (const d of list.filter(x => x.price <= budget && itemLevel(x) > have * 1.15 + 1 && !b.bad.has(x.id) && !soldRecently(w, p, x.id) && usable(x)).slice(0, 6)) {      // prueba el siguiente si no puede cargarlo o no se lo puede poner (antes se atascaba para siempre con el más caro y peleaba sin arma)
      const inst = buy(w, p, d);
      if (!inst) { if (p.gold >= d.price) b.bad.add(d.id); continue; }
      if (!tryEquip(w, p, b, inst)) { ledger(w, p, d.price, "bot_refund", { artificial: "bot" }); Inv.removeFromBag(p, inst.uid); continue; }
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
// daño por segundo de un summon vivo: golpe de su nivel (Comp.statsOf) por ritmo de ataque; los de escuela suman sus hechizos (≈ +60 %)
export function petDps(p, q) {
  const st = Comp.statsOf(p, q.comp), hit = st.dmg || 0, rate = Math.max(0.9, (q.cfg?.actionTime || 1500) / 1000);
  return hit / rate * 0.6 * (Sch.SCHOOL_OF[q.comp.sp] ? 1.6 : 1);
}
export function fightEstimate(w, p, e, solo = false, full = false) {                       // solo: sin contar a los jugadores de al lado (antes de bajar a la cripta se va sin ellos)
  let ally = 0, n = 0, pet = false;
  for (const q of w.ents.values()) {
    if (!solo && q !== p && q.kind === "player" && !q.dead && q.side === p.side && dist(p, q) <= 14) { ally += dpsOf(q); n++; }
    else if (q.comp && q.master === p.id && !q.dead && q.cfg) { ally += petDps(p, q); pet = true; }   // el compañero también pega (con el daño de SU nivel, no el de su ficha de monstruo)
  }
  const foeHit = (e.cfg.attackDiceThrow || 1) * ((e.cfg.attackDiceRange || 1) + 1) / 2 * (e.dmgMul || 1) * 0.65, foeDps = foeHit * 0.8 / Math.max(0.9, (e.cfg.actionTime || 1500) / 1000);
  const ttk = e.hp / Math.max(0.5, dpsOf(p) + ally), taken = foeDps * ttk * (w.learn ? genesOf(w, p).cal : 1) / (1 + n * 0.7 + (pet ? 0.3 : 0));       // el summon también reparte los golpes del rival
  const red = w.data.named("RedPotion"), pots = red ? p.bag.reduce((a, i) => a + (i.id === red.id ? i.count || 1 : 0), 0) : 0;
  const budget = (full ? p.maxHp : p.hp) + pots * Math.min(80, p.maxHp * 0.4);
  return { ttk, taken, budget, ratio: budget / Math.max(1, taken), allies: n };
}
// el jefe que habrá en el piso `level` de la cripta (misma escala que dungeon.js), para decidir ANTES de bajar
export function bossPreview(w, level) {
  const cfg = w.npcDb.Skeleton; if (!cfg || level % 5) return null;
  const tier = Math.min(4, level / 5), sc = { hp: 1 + .18 * (level - 1), dmg: 1 + .06 * (level - 1) };
  return { cfg, hp: Math.round(cfg.hitDice * 5.75 * sc.hp * (2 + tier)), dmgMul: sc.dmg * (1 + .15 * tier) };
}
export const fightOk = (w, p, e) => fightEstimate(w, p, e).ratio >= genesOf(w, p).ratio;
export const tooStrong = (w, p, e) => {
  if (e.kind === "player") return e.level > p.level + 12 || e.hp > p.hp * 3.5;                        // contra un jugador enemigo: solo si no es mucho más fuerte
  if (e.boss && !e.aux) return !fightOk(w, p, e);                                                       // jefe de cripta: solo si el cálculo de la pelea sale a favor (con los compañeros que lo ayuden)
  const dl = p.res?.dlv?.[(e.boss ? e.name + "*" + e.boss : e.name) + (w.map.kind === "dungeon" ? "@" + w.map.level : "")];       // en la cripta la lección es por piso (los esqueletos escalan con el piso: un piso que lo mató no veta toda la especie)                                                                    // APRENDIZAJE: el bot recuerda el nivel al que lo mató esta especie y no vuelve a pelearla hasta llevar 3 niveles más
  if (dl !== undefined && p.level < dl + 3 && w.time - (p.res.dlt?.[(e.boss ? e.name + "*" + e.boss : e.name) + (w.map.kind === "dungeon" ? "@" + w.map.level : "")] || 0) < 20 * 60000) return true;       // la lección caduca a los 20 min: sin presa no hay experiencia y el bot quedaba atascado
  const hit = (e.cfg.attackDiceThrow || 1) * (e.cfg.attackDiceRange || 1);
  return hit * 4 > p.maxHp;
};
// los auxiliares de un jefe también se pelean: cristales de hielo (rompen su escudo), clones de sombra y huesos que lo curan
// VALOR DE UN MONSTRUO para quien lo caza: lo que cuesta subir de nivel frente a lo que da cada baja. Un nivel 25 que sigue con slimes pierde el tiempo;
// los bots prefieren lo mejor que aguantan (hasta 9 casillas de ventaja) y lo trivial solo lo matan si les estorba (INVENTO del port, objetivo «superarse»).
export const mobRatio = (p, e) => (e.exp || e.cfg.expMin || 0) / Math.max(100, R.expForLevel(p.level + 1) - R.expForLevel(p.level));
// v0.85.97 (obs. 53): también cuenta como trivial un monstruo de menos de la cuarta parte de su nivel (nv140 cazando slimes); vale para todo bot, no solo residentes
export const trivialPrey = (p, e, owner) => !!(p.res || p.bot) && !owner && !p.bot?.owner && e.kind === "npc" && e.target !== p.id && p.level >= 10 && (mobRatio(p, e) < 0.04 || ((e.level || e.cfg?.level || 99) < p.level * 0.25));
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
// DEFENDER ALIADOS (v0.77.0): un monstruo que pelea contra un aliado cercano (otro jugador que no puedo atacar) vale más; si está casi muerto, más aún (quedarse el último golpe)
export function allyBonus(w, p, e) {
  const a = e.kind === "npc" && e.target != null && e.target !== p.id ? w.ents.get(e.target) : null;
  if (!a || a.kind !== "player" || a.dead || dist(p, a) > 10 || canFight(w, p, a)) return 0;
  return 5 + (e.hp < e.maxHp * 0.35 ? 4 : 0);
}
// v0.85.56: «box» = rodeado por todos lados sin poder correr. Con <= 1 casilla libre y 2+ enemigos pegados, el bot no se deja encerrar: mata al más débil de los de al lado para abrir una salida.
function boxBreak(w, p) {
  let free = 0, foes = [];
  for (let d = 0; d < 8; d++) { const x = p.x + DX[d], y = p.y + DY[d]; if (!w.grid.blocked(x, y)) free++; }
  for (const e of w.ents.values()) { if (e.dead || e === p || e.master === p.id || e.aux || e.comp) continue; if (dist(p, e) > 1) continue; if (e.kind === "npc" ? hostile(e) : (e.kind === "player" && canFight(w, p, e))) { foes.push(e); if (!w.grid.blocked(e.x, e.y)) free--; } }
  if (foes.length < 2 || free > 1) return null;
  return foes.sort((a, b) => (a.hp || 0) - (b.hp || 0))[0];
}
// v0.85.56: PvP, rodear al enemigo para que no pueda correr: de las casillas libres junto a él, va a la más alejada de sus compañeros ya pegados.
// v0.85.65 anti-kite: contra un jugador que huye/retrocede, el guerrero apunta a donde estará (último movimiento ×2), no a donde está
function lead(w, p, t) {
  const b = p.bot, pv = b.foePrev; b.foePrev = { id: t.id, x: t.x, y: t.y };
  if (!pv || pv.id !== t.id || isCaster(p) || dist(p, t) < 2) return [t.x, t.y];
  const x = t.x + Math.sign(t.x - pv.x) * 2, y = t.y + Math.sign(t.y - pv.y) * 2;
  return w.grid.inside(x, y) && !w.grid.blocked(x, y) ? [x, y] : [t.x, t.y];
}
function encircle(w, p, t) {
  if (t.kind !== "player") return [t.x, t.y];
  if (dist(p, t) > 4) return lead(w, p, t);
  const mates = [...w.ents.values()].filter(a => a !== p && a.kind === "player" && !a.dead && dist(a, t) <= 2 && !canFight(w, p, a));
  if (!mates.length) return lead(w, p, t);
  let best = null, bs = -1;
  for (let d = 0; d < 8; d++) { const x = t.x + DX[d], y = t.y + DY[d]; if (w.grid.blocked(x, y) || [...w.ents.values()].some(e => !e.dead && e.x === x && e.y === y && e !== p)) continue; const sc = Math.min(...mates.map(a => Math.max(Math.abs(a.x - x), Math.abs(a.y - y)))) * 3 - dist(p, { x, y }); if (sc > bs) { bs = sc; best = [x, y]; } }
  return best || [t.x, t.y];
}
function pickTarget(w, p, owner) {
  let best = null, bs = 1e9;
  const lk = w.pvp && p.bot.lock, cur = lk && w.ents.get(lk.id);                                          // v0.85.92 (obs. 58): soft-lock: no cambia de rival cada golpe; sigue con el que ya pelea hasta rematarlo, 6 s o fuera de rango
  if (cur && lk.hp0 === undefined) { lk.hp0 = cur.hp; lk.t0 = w.time; }                                  // v0.85.98 (notas 52/60): duelo sin progreso: en 20 s no le quita ni el 5 % de su vida -> lo suelta 12 s y busca otro rival (el más débil)
  if (cur && w.time - lk.t0 >= 20000) { if (lk.hp0 - cur.hp < 0.05 * cur.maxHp) { p.bot.stall = { id: cur.id, until: w.time + 12000 }; p.bot.lock = null; plog(w, p, "Duelo atascado con " + cur.name + ": cambio de rival"); } else { lk.hp0 = cur.hp; lk.t0 = w.time; } }
  if (p.bot.lock && cur && !cur.dead && cur.kind === "player" && dist(p, cur) <= 10 && canFight(w, p, cur) && (w.time - lk.at < 6000 || cur.hp / Math.max(1, cur.maxHp) < 0.5)) return cur;
  const rv = p.bot.revenge && p.bot.revenge.until > w.time && w.ents.get(p.bot.revenge.id);            // quien me ha golpeado, primero
  if (rv && !rv.dead && dist(p, rv) <= 12 && canFight(w, p, rv)) { if (w.pvp && rv.kind === "player" && p.bot.lock?.id !== rv.id) p.bot.lock = { id: rv.id, at: w.time }; return rv; }
  for (const e of w.ents.values()) {
    if (e.kind === "player") { if (p.bot.stall && p.bot.stall.id === e.id && p.bot.stall.until > w.time) continue;                                                                            // enemigos de otro bando en Promise Land
      if (!w.pvp || !canFight(w, p, e) || tooStrong(w, p, e) || owner && p.bot.only && p.bot.only !== "@ek") continue;
      const d = dist(p, e);
      if (p.res?._dom && d > 5 && e.target !== p.id) continue;                  // v0.85.76 (obs. 35): con la zona dominada solo se defiende; el resto del tiempo, PvE
      const fo = d - 2 - (sget(w, e, "hold") ? 8 : 0) - ([...w.ents.values()].some(a => a !== p && a.kind === "player" && (a.id === p.bot.owner || (p.party?.id && a.party?.id === p.party.id)) && a.bot?.target?.id === e.id) ? 3 : 0);       // FOCUS FIRE (v0.85.53): primero al paralizado y al que ya golpean los míos
      const fm = isCaster(p) ? Math.min(4, resistRatio(e) / 50) : -Math.min(4, meleeExpected(p, e) / 8);   // fórmulas (botformulas.js)
      if (d <= 12 && (!owner || dist(owner, e) <= 14) && fo + fm < bs) { best = e; bs = fo + fm; }
      if (best === e && p.bot.lock?.id !== e.id) p.bot.lock = { id: e.id, at: w.time };
      continue;
    }
    if (w.pvp && e.kind === "npc" && e.comp && e.master && !e.dead) {                                     // summon enemigo: se ataca si me ataca a mí o a los míos, o si está encima
      const m = w.ents.get(e.master), d = dist(p, e), th = e.cTarget === p.id || e.target === p.id || (owner && e.cTarget === owner.id);
      if (m && canFight(w, p, m) && d <= 10 && (th || d <= 2) && reachable(w, p, e) && d - (th ? 6 : 0) < bs) { best = e; bs = d - (th ? 6 : 0); }
      continue;
    }
    if (!hostile(e)) continue;
    if (owner && p.bot.only && e.name !== p.bot.only) continue;                                          // orden «vamos a matar X» (orders.js): solo esa criatura; «@ek» = solo jugadores
    if (p.bot.ignore?.has(e.id) && e.target !== p.id) continue;                                         // inalcanzable hace un momento
    const d = dist(p, e);
    if (d > 12 || (owner && dist(owner, e) > 14) || w.safeAt(e.x, e.y) || tooStrong(w, p, e)) continue;
    if (trivialPrey(p, e, owner)) continue;                                                              // v0.85.91 (obs. 46): sin dueño no pierde el tiempo con presas triviales (slimes a nivel alto): equipo, EKs o cripta
    if (w.pvp && !owner && p.res && !p.res._dom && d > 3 && e.target !== p.id && best?.kind === "player") continue;       // v0.85.76 (obs. 35): sin dominar la zona, el PvP va primero
    const shielded = e.crystal && [...w.ents.values()].some(o => o.boss && o.shield && !o.dead && dist(o, e) <= 20);
    const s = (shielded ? -20 : 0) - allyBonus(w, p, e) - (e.target === p.id || e.kind !== "npc" ? 0 : mobBonus(p, e)) + d - (e.target === p.id || (owner && e.target === owner.id) ? 6 : 0) + Math.min(9, (p.kinds?.[e.name] || 0) / 5) + (owner ? 0 : Math.min(8, (e.hp || 0) / 40)) - (p.res?.focus?.[e.name] > w.time ? 5 : 0);     // VARIEDAD: prefiere especies que ha cazado poco (hasta 5 casillas de ventaja)
    if (s < bs && reachable(w, p, e)) { best = e; bs = s; }
  }
  return best;
}
// Mago de rango (0.78.0, INVENTO: el código original no está en esta máquina y no se pudo comprobar cómo juega un mago/invocador del juego original): con un summon de escuela vivo
// y maná en él (>= 20 % y para el hechizo más barato) mantiene 6-8 casillas con el monstruo y deja que el summon lance los hechizos (residents.js los lanza); con el monstruo a <= 3 retrocede;
// sin maná en el summon, pelea cuerpo a cuerpo (con báculo si lo lleva en la mochila).
export const MAGE_RANGE = { min: 6, max: 8, flee: 3, manaPct: 0.2 };
export function rangedMage(w, p) {
  if (!p.res || p.res.arch !== "scholar" || isSupport(p)) return null;
  const c = Comp.activeBall(p)?.comp; if (!c || !c.on || !Sch.SCHOOL_OF[c.sp]) return null;
  let n = null; for (const e of w.ents.values()) if (e.comp && e.master === p.id && !e.dead) { n = e; break; }
  if (!n) return null;
  const top = Tal.maxMp(c), mp = n.mp ?? top;
  return mp >= Math.max(10, top * MAGE_RANGE.manaPct) ? n : null;
}
function wieldStaff(adv, w, p, b) {              // sin maná en el summon: pelea con un báculo/varita si lo tiene en la mochila
  if (hasStaff(p) || w.time - (b.staffAt || 0) < 15000) return;
  const it = p.bag.find(i => { const d = w.data.item(i.id); return d && isStaff(d) && itemLevel(d) <= p.level; });
  if (it) { b.staffAt = w.time; adv.command(p.id, { t: "use", uid: it.uid }); blog(w, p, "Sin maná en mi summon: peleo con el báculo."); }
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
    if (!alt) { b.hazWait ||= w.time; if (w.time - b.hazWait < 2500) return true; }          // v0.85.57: esperar ante el fuego solo 2,5 s (antes eternamente: en un PvP el guerrero se quedaba mirando); luego lo cruza
    else d = alt;
  } else b.hazWait = 0;
  if (!adv.command(p.id, { t: "move", dir: d, run: !!run && p.sp > 6 })) { b.path = null; b.fails++; return false; }
  b.fails = 0;
  vaiven(adv, w, p, b, tx, ty);
  return true;
}
// Vaivén (INVENTO): si en sus últimos 18 pasos solo pisó 4 casillas o menos y no ha llegado, no puede alcanzar la meta (terreno, un monstruo en medio, otro camino…).
// Como una persona, se para un momento, descarta esa meta (objetivo, viaje o paseo) y prueba otra cosa; si pasa otra vez en seguida, vuelve a la ciudad con Recall.
export const OSC = { steps: 18, tiles: 4 };
export function vaiven(adv, w, p, b, tx, ty) {
  const tr = b.trail ||= [];
  tr.push(p.x + "," + p.y); if (tr.length > OSC.steps) tr.shift();
  if (tr.length < OSC.steps || w.time - p.lastCombat < 4000 || dist(p, { x: tx, y: ty }) <= 2 || new Set(tr).size > OSC.tiles) return;
  tr.length = 0;
  const again = w.time - (b.oscAt || -1e9) < 90000; b.oscAt = w.time; b.oscN = again ? (b.oscN | 0) + 1 : 1;
  const t = b.target; if (t) (b.ignore ||= new Map()).set(t.id, w.time + 45000);
  (b.avoid ||= []).push({ x: tx, y: ty, until: w.time + 60000 }); if (b.avoid.length > 6) b.avoid.shift();
  blog(w, p, b.oscN >= 3 && !p.recallTok && w.map.kind !== "dungeon" ? "Sigo sin poder llegar: vuelvo a la ciudad." : `Voy y vengo por las mismas casillas sin llegar a (${tx},${ty}): lo dejo y pruebo otra cosa.`);
  b.target = null; b.path = null; b.goal = null; b.fails = 0; b.travel = null; b.hold = w.time + 1200 + Math.floor(w.rng() * 2500);
  const r = () => Math.floor(w.rng() * 25) - 12, s = w.freeSpotNear(p.x + r(), p.y + r());                // se aleja un poco para ver el obstáculo desde otro lado
  b.wander = s && !w.teleports.has(w.grid.idx(s[0], s[1])) ? { x: s[0], y: s[1], until: w.time + 12000 } : null;
  if (b.oscN >= 3 && !p.recallTok && w.map.kind !== "dungeon") { b.oscN = 0; BM.recallSelf(adv, w, p, b); }
}
// Pensamientos en voz alta (burbuja pública `botsay`): el bot cuenta qué ve y qué va a hacer. Personalidad inventada del port.
// Situaciones de los pensamientos en voz alta (burbuja pública `botsay`). No hay frases escritas: las dice el modelo de lenguaje (residents.thought); sin modelo no hay burbuja.
const THOUGHTS = {
  target: "you spot a {m} and decide to attack it", hurt: "you are hurt and drink a potion", rest: "you are out of potions: time to recall and buy more",
  rested: "you feel better and go on", farm: "you are tending your crops: sowing seeds and working the hoe to harvest for trade", loot: "you see loot on the ground and go grab it", shop: "you are going shopping for better gear", follow: "you are following your party leader",
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
// Pensamiento de PvP (v0.85.51, INVENTO): líneas con '⚔' que el admin recoge en la pestaña PvP del bot (botstats.mjs)
export const plog = (w, p, text) => blog(w, p, "⚔ " + text);
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
function say(adv, p, b, text) { if (p.res || adv.worldFor?.(p.id)?.pvp) return; if (adv.time - b.said > 60000) {          // v0.85.98 (obs. 88): menos charla; los residentes y Promise Land, en silencio
 b.said = adv.time; adv.command(p.id, { t: "say", text }); } }

// ---------------------------------------------------------------- bucle
export function think(adv, p) {
  const b = p.bot, w = adv.worldFor(p.id);
  if (!b || b.broken || w.time < b.next) return;
  b.next = w.time + THINK_MS;
  try { run(adv, w, p, b); } catch (e) { b.broken = true; console.error("bot " + p.name + " desactivado:", e); }
}
// Sitio donde un bot puede descansar: ciudad o granja (zona sin ataque), nunca Promise Land, cripta o arena
export function restSafe(w, p) { return !w.pvp && w.map.kind !== "dungeon" && w.map.kind !== "arena" && w.safeAt(p.x, p.y); }
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
  const unarmed = p.equip[EQUIP.RHAND] === undefined && p.equip[EQUIP.TWOHAND] === undefined;         // el arma se rompió: no espera a la calma, se rearma ya (sin ella pegaba con 0 de daño)
  if (w.time >= b.errand && (unarmed || w.time - p.lastCombat > 3500 || (p.eff?.bow && !arrowOf(w, p)))) { b.errand = w.time + ERRAND_MS; errands(w, p, b); if (b.bought) { b.bought = 0; blog(w, p, `Compro equipo (oro ${p.gold}).`); think_(w, p, b, "shop"); } }
  // comer y curarse
  if (p.hunger < 35) { const f = p.bag.find(i => w.data.item(i.id)?.type === ITYPE.EAT && !w.data.item(i.id).name.includes("Candy")); if (f) adv.command(p.id, { t: "use", uid: f.uid }); }
  const G = genesOf(w, p), hpf = p.hp / p.maxHp, fear = w.pvp ? 0 : Math.min(0.2, (p.res?.scare || 0) * 0.04);                 // MORIR DUELE: cada muerte reciente los vuelve más prudentes (beben antes, huyen antes)
  { const f = b.fight; if (f) { if (p.hp < f.last) f.taken += f.last - p.hp; f.last = p.hp; } }                // APRENDIZAJE: suma el daño recibido durante la pelea actual
  if (BM.ensureHands(adv, w, p, b, t => blog(w, p, t))) return;
  if (!isCaster(p) && swarmShield(w, p, b)) return;
  // v0.85.81: umbral y ritmo del replay zzzz_620 (el dueño bebió con 27 % de maná de media, mín. 13/780, una poción cada ~0,2-3 s): bebe por debajo del 35 % o si no llega a dos lanzamientos del hechizo caro (Blizzard 170), sin esperar 1,5 s
  if (isCaster(p) && p.mp < Math.max(15, p.maxMp * 0.35, BM.manaFloor(w, p)) && potionUseful(w, catalog(w.data).mana, p.maxMp - p.mp) && w.time - (b.manaAt || 0) > 600 && (w.time - (p.lastCombat || -1e9) < 10000 || b.target && !b.target.dead)) {       // v0.85.83 (obs. 39): también con objetivo a la vista aunque aún no le hayan pegado (el mago se quedaba sin maná parado)          // sin maná en pelea: bebe una poción de maná y sigue lanzando
    const bl = catalog(w.data).mana, mp = bl && p.bag.find(i => i.id === bl.id);
    if (mp) { b.manaAt = w.time; blog(w, p, `Maná ${p.mp}/${p.maxMp}: bebo una poción de maná.`); adv.command(p.id, { t: "use", uid: mp.uid }); return; }
    if (!mp && !b.rest && !b.owner && p.gold >= (bl?.price || 0) + 40) { think_(w, p, b, "rest", {}, 0); blog(w, p, "Sin maná ni pociones de maná: vuelvo a la ciudad a comprar (obs. 95)."); b.errand = 0; }      // v0.85.99
  }
  if (isCaster(p) && BM.support(adv, w, p, b, t => blog(w, p, t))) return;
  if (!isCaster(p) && BM.utility(adv, w, p, b, t => blog(w, p, t))) return;
  const horde = BM.hordeAround(w, p, 3) >= 3 ? 0.15 : 0;                       // v0.85.81: con 3 o más monstruos encima bebe antes (margen contra la horda; zzzz_620: mín. 339/980 HP rodeado, 0 muertes)
  if (hpf < G.potion + fear + horde && potionUseful(w, catalog(w.data).potion, p.maxHp - p.hp) && w.time - (b.potionAt || 0) > 1500) {
    const red = catalog(w.data).potion, pot = red && p.bag.find(i => i.id === red.id);
    if (pot) { b.potionAt = w.time; blog(w, p, `Vida ${Math.round(hpf * 100)}%: bebo una poción roja.`); think_(w, p, b, "hurt"); adv.command(p.id, { t: "use", uid: pot.uid }); return; }
    if (!b.rest) { think_(w, p, b, "rest", {}, 0); blog(w, p, `Vida ${Math.round(hpf * 100)}% y sin pociones: vuelvo con Recall a comprar más.`); b.errand = 0; }
    b.rest = true;
  }
  if (w.pvp && hpf < 0.4 && w.time - (b.recallAt || 0) > 6000 && !p.recallTok) {                           // en Promise Land con poca vida y un enemigo cerca: huye con Recall
    const foe = [...w.ents.values()].find(e => e.kind === "player" && canFight(w, p, e) && dist(p, e) <= 9);
    if (foe) { b.recallAt = w.time; plog(w, p, `Huir: vida ${Math.round(hpf * 100)}% y ${foe.name} (nv ${foe.level}, ${Math.round(foe.hp / foe.maxHp * 100)}% vida) a ${dist(p, foe)} casillas: Recall.`); BM.recallSelf(adv, w, p, b); }
  }
  // INSTINTO DE SUPERVIVENCIA: con poca vida y un enemigo encima no se queda quieto: sale con Recall (cripta/Promise Land) o corre alejándose de él
  if (hpf < G.flee + fear + (w.pvp ? 0.13 : 0) && w.time - (b.fleeAt || 0) > 700) {          // v0.85.92 (obs. 57): en PvP huye con ~45 % (con 3-24 % ya no se escapa)
    let foe = null, fd = 1e9;
    for (const e of w.ents.values()) { if (e.dead || e.master === p.id || e.aux || w.safeAt(e.x, e.y) || e.comp) continue; if (!(e.kind === "npc" || (e.kind === "player" && canFight(w, p, e)))) continue; const d = dist(p, e); if (d <= 7 && d < fd && (e.target === p.id || d <= 3)) { fd = d; foe = e; } }
    if (foe) {
      b.fleeAt = w.time; b.target = null; b.path = null;
      if (BM.escapeInvis(adv, w, p, b)) { blog(w, p, `Vida ${Math.round(hpf * 100)}% con ${foe.name} encima: me hago Invisible para escapar.`); return; }       // v0.85.76 (obs. 37)
      if ((w.map.kind === "dungeon" || w.pvp || (b.rest && !owner && !restSafe(w, p))) && w.time - (b.recallAt || 0) > 6000 && !p.recallTok) { b.recallAt = w.time; (foe.kind === "player" ? plog : blog)(w, p, `${foe.kind === "player" ? "Huir: " : ""}vida ${Math.round(hpf * 100)}% con ${foe.name} encima: Recall.`); BM.recallSelf(adv, w, p, b); }       // el canal de Recall se rompe si algo te golpea: con el enemigo encima corre primero
      else if (p.recallTok && fd >= 3 && w.time - (p.lastCombat || -1e9) > 1200) { b.hold = w.time + 800; return; }          // el Recall canaliza y el enemigo aún no le alcanza: quieto (correr lo cancelaría)
      else {
        let best = null, bs = dist(p, foe);
        for (let d = 0; d < 8; d++) { const x = p.x + DX[d] * 2, y = p.y + DY[d] * 2, sx = p.x + DX[d], sy = p.y + DY[d]; if (w.grid.blocked(sx, sy) || !w.grid.inside?.(sx, sy) && false) continue; const sc = Math.max(Math.abs(x - foe.x), Math.abs(y - foe.y)); if (sc > bs && !w.teleports.has(w.grid.idx(sx, sy))) { bs = sc; best = [x, y]; } }
        if (best) { if (!b.fled || w.time - b.fled > 8000) (foe.kind === "player" ? plog : blog)(w, p, `${foe.kind === "player" ? "Huir: " : ""}vida ${Math.round(hpf * 100)}%: huyo de ${foe.name}.`); b.fled = w.time; step(adv, w, p, b, best[0], best[1], true); return; }
      }
    }
  }
  if (b.rest && hpf > G.rested) { b.rest = false; blog(w, p, "Recuperado, sigo."); think_(w, p, b, "rested"); }
  // DESCANSO SOLO EN ZONA SEGURA (ciudad o granja): lejos de ella (Promise Land, cripta, campo abierto) vuelve con Recall antes de descansar;
  // si algo le pega o hay un monstruo encima mientras tanto, deja de descansar y se defiende (el canal de Recall se rompe con cada golpe)
  let defend = false;
  if (b.rest && !owner && !restSafe(w, p)) {
    const hit = w.time - (p.lastCombat || -1e9) < 2500;
    if (hit) { defend = true; if (!b.restHurt || w.time - b.restHurt > 8000) blog(w, p, "Me atacan mientras descanso fuera de zona segura: me defiendo."); b.restHurt = w.time; }
    else if (p.recallTok) { b.hold = w.time + 1500; return; }
    else if (w.time - (b.recallAt || 0) > 6000) { b.recallAt = w.time; b.target = null; b.path = null; b.travel = null; blog(w, p, "Sin pociones: lanzo Recall para volver a la ciudad y comprar."); BM.recallSelf(adv, w, p, b); return; }
  }
  // objetivo
  if (b.travel && w.time > b.travel.until) { if (!b.travel.seek) blog(w, p, "Viaje cancelado (no llego)."); b.travel = null; b.path = null; }       // caduca aunque esté peleando por el camino
  if (b.ignore) for (const [id, until] of b.ignore) if (w.time > until) b.ignore.delete(id);
  if (b.target && (b.target.dead || !w.ents.has(b.target.id) || dist(p, b.target) > 16)) b.target = null;
  { const bx = !w.safeAt(p.x, p.y) && boxBreak(w, p); if (bx && b.target !== bx) { b.target = bx; b.path = null; if (w.time - (b.boxLog || 0) > 8000) { b.boxLog = w.time; blog(w, p, `Rodeado: abro salida contra ${bx.name}, el más débil.`); } } }
  if ((!b.rest || defend) && w.time >= b.tgtAt && (hpf > G.engage + fear || b.target?.target === p.id)) { b.tgtAt = w.time + TARGET_MS; if (!b.target || dist(p, b.target) > 3) b.target = pickTarget(w, p, owner) || b.target; }
  const t = (b.rest && !defend) || b.noFight > w.time || (b.travel && !(b.target && ((b.target.target === p.id && (!b.travel.seek || dist(p, b.target) <= 2)) || b.target.kind === "player"))) ? null : b.target;      // de viaje solo se pelea con lo que ataca
  if (t) {
    if (t.kind === "player" && w.time - (b.pvpAt || 0) > 3000) { b.pvpAt = w.time; plog(w, p, `Combate vs ${t.name}: yo ${p.hp}/${p.maxHp} PV ${p.mp}/${p.maxMp} PM, él ${t.hp}/${t.maxHp} PV ${t.mp ?? "?"} PM, dist ${dist(p, t)}, modo ${isCaster(p) ? "lanzador" : "cuerpo a cuerpo"}${p.recallTok ? ", Recall en curso" : ""}.`); }
    if (b.seen !== t.id) { if (b.fight && w.time - b.fight.at > 2500) learnFight(w, p, b.fight.name, b.fight.pred, b.fight.taken); b.fight = t.kind === "npc" && !t.boss ? { name: t.name, at: w.time, pred: fightEstimate(w, p, t).taken / Math.max(0.2, genesOf(w, p).cal), taken: 0, last: p.hp } : null; b.seen = t.id; b.foeKind = t.kind === "player" ? ((t.eff?.wtype >= 34 && t.eff?.wtype <= 39) || t.mp > t.hp ? "magic" : "phys") : (t.magic ? "magic" : "phys"); blog(w, p, `Objetivo: ${t.name}${t.kind === "player" ? " (jugador enemigo, nv " + t.level + ")" : ""} a ${dist(p, t)} casillas.`); if (t.kind === "player") plog(w, p, `Elijo pelear con ${t.name}: nv ${t.level} (yo ${p.level}), ${b.foeKind === "magic" ? "mago" : "físico"}, vida ${t.hp}/${t.maxHp} (yo ${p.hp}/${p.maxHp}), a ${dist(p, t)} casillas${p.bot.revenge?.id === t.id ? ", venganza" : ""}.`); if (t.kind !== "player") think_(w, p, b, tooStrong(w, p, t) ? "danger" : "target", { m: t.name }); }
    if (p.eff?.bow && !arrowOf(w, p)) {                                                              // sin flechas: no sigue disparando al aire (eso cancela el Recall); compra o sale
      stuck(w, p, b, "sin flechas"); b.target = null; b.path = null;
      if (p.gold < 4) { const bw = p.bag.find(i => isBow(w.data.item(i.id)) && Object.values(p.equip).includes(i.uid)); if (bw) { blog(w, p, "Sin flechas ni oro: me quito el arco."); adv.command(p.id, { t: "unequip", uid: bw.uid }); return; } }          // quien no es arquero y no puede pagar flechas no se queda bloqueado con un arco que no dispara
      if (!p.recallTok && w.time - (b.recallAt || 0) > 6000 && (w.map.kind === "dungeon" || w.pvp)) { b.recallAt = w.time; blog(w, p, "Me quedé sin flechas: salgo con Recall a comprar más."); BM.recallSelf(adv, w, p, b); }
      else if (!w.pvp && w.map.kind !== "dungeon") { b.errand = 0; if (w.time - p.lastCombat > 3000) b.noFight = w.time + 5000; }       // va a comprar sin apuntar al aire
      return;
    }
    if (p.recallTok && b.recallAt && w.time - b.recallAt < 12000) { b.hold = w.time + 800; stuck(w, p, b, "Recall en curso"); return; }   // el Recall se rompe si sigue pegando
    if (t.kind === "npc" && !p.eff?.bow && !b.travel) {
      if (rangedMage(w, p)) {
        const d = dist(p, t);
        if (d <= MAGE_RANGE.flee || d < MAGE_RANGE.min) {                       // se acerca: retrocede en línea contraria
          const sx = Math.sign(p.x - t.x), sy = Math.sign(p.y - t.y), o = w.freeSpotNear(p.x + (sx || 1) * 3, p.y + (sy || 1) * 3);
          if (o && step(adv, w, p, b, o[0], o[1], d <= MAGE_RANGE.flee)) { if (w.time - (b.kiteLog || 0) > 15000) { b.kiteLog = w.time; blog(w, p, `Retrocedo: ${t.name} se acerca y mi summon lanza los hechizos.`); } return; }
        } else if (d <= MAGE_RANGE.max) {
          b.stuck = null; b.waitSum = w.time;
          if (!b.mWait || b.mWait.id !== t.id || w.time - b.mWait.last > 3000) b.mWait = { id: t.id, since: w.time };       // v0.85.100: 25 s esperando sin lanzar (inmune o el summon no pega) = deja el objetivo 30 s
          b.mWait.last = w.time;
          if (w.time - b.mWait.since > 25000 && w.time - (b.castAt || -1e9) > 25000) { (b.ignore ||= new Map()).set(t.id, w.time + 30000); b.target = null; b.path = null; b.mWait = null; return; }
          const dr = dirTo(p.x, p.y, t.x, t.y); if (dr) p.dir = dr; return; }       // a distancia: espera a que el summon lance
      } else if (p.res?.arch === "scholar" && !isSupport(p) && Comp.activeBall(p)) wieldStaff(adv, w, p, b);
    }
    // v0.85.69 (v0.85.100: umbral 3→5, el rival re-cerraba y rompía casts): el mago puro no lanza pegado a un rival cuerpo a cuerpo (cada golpe rompe el hechizo: castbreak); se aparta hasta tener distancia y entonces lanza
    if (isMage(p) && t.kind === "player" && !w.safeAt(p.x, p.y) && p.hp / p.maxHp > 0.4 && dist(p, t) <= 5 && !((t.eff?.wtype >= 34 && t.eff?.wtype <= 39) || t.mp > t.hp) && !sget(w, t, "hold") && w.time - (b.kiteFail || 0) > 2500) {
      let best = null, bs = dist(p, t);
      for (let d = 0; d < 8; d++) { const x = p.x + DX[d] * 7, y = p.y + DY[d] * 7; if (w.grid.blocked(p.x + DX[d], p.y + DY[d]) || w.grid.blocked(p.x + DX[d] * 3, p.y + DY[d] * 3) || w.grid.blocked(x, y)) continue; const sc = Math.max(Math.abs(x - t.x), Math.abs(y - t.y)); if (sc > bs) { bs = sc; best = [x, y]; } }   // v0.85.83 (obs. 39): 7 casillas (antes 3)
      if (best && step(adv, w, p, b, best[0], best[1], true)) { if (w.time - (b.kiteLog || 0) > 8000) { b.kiteLog = w.time; plog(w, p, `Me aparto de ${t.name}: cada golpe suyo rompe mis hechizos.`); } return; }
      b.kiteFail = w.time;
    }
    if (isCaster(p) && (t.kind === "npc" || t.kind === "player") && !b.travel && BM.fight(adv, w, p, b, t, x => blog(w, p, x))) { b.stuck = null; const dr = dirTo(p.x, p.y, t.x, t.y); if (dr) p.dir = dr; return; }
    // v0.85.48: el mago puro no pega con la vara (es muy débil): sin maná espera y se aparta; solo la usa contra otro mago o si el objetivo tiene Absolute Magic Protection (magia inútil)
    if (isMage(p) && w.magic && !w.safeAt(p.x, p.y)) {
      const foeMage = t.kind === "player" && ((t.eff?.wtype >= 34 && t.eff?.wtype <= 39) || t.mp > t.hp), amp = sget(w, t, "protect") === 5;
      if (!foeMage && !amp && p.hp / p.maxHp > 0.4 && dist(p, t) <= 3 && w.time - (b.kiteAt || 0) > 900) {       // v0.85.83 (obs. 39): huye 6 casillas (antes 2) y luego lanza
        b.kiteAt = w.time; let best = null, bs = dist(p, t);
        for (let d = 0; d < 8; d++) { const x = p.x + DX[d] * 6, y = p.y + DY[d] * 6; if (w.grid.blocked(p.x + DX[d], p.y + DY[d]) || w.grid.blocked(p.x + DX[d] * 3, p.y + DY[d] * 3)) continue; const sc = Math.max(Math.abs(x - t.x), Math.abs(y - t.y)); if (sc > bs) { bs = sc; best = [x, y]; } }
        if (best) { step(adv, w, p, b, best[0], best[1], true); return; }
      }
      // v0.85.83 (obs. 39): solo espera quieto si el objetivo está al alcance del hechizo (enfriamiento o poco maná); más lejos se acerca (antes se quedaba parado)
      // v0.85.97 (obs. 80): pegado al bicho con maná lleno NO pega con la vara (muy débil): espera el enfriamiento del hechizo (máx. 4 s por si no puede lanzar nada)
      if (dist(p, t) <= 1 && p.mp >= 12 && BM.hasAttack(p) && !foeMage && !amp) { if (!b.adjWait) b.adjWait = w.time; if (w.time - b.adjWait < 4000) { b.hold = w.time + 400; return; } } else b.adjWait = 0;
      if (!foeMage && !amp && dist(p, t) > 1 && dist(p, t) <= BM.CAST_RANGE && (p.mp < 12 || BM.hasAttack(p))) {
        // v0.85.100 (atasco Aresfarm): si lleva 25 s esperando sin lanzar nada (el bicho es inmune o el summon no pega) deja el objetivo 30 s y sigue con otra cosa
        if (!b.mWait || b.mWait.id !== t.id || w.time - b.mWait.last > 3000) b.mWait = { id: t.id, since: w.time };
        b.mWait.last = w.time;
        if (w.time - b.mWait.since > 25000) { (b.ignore ||= new Map()).set(t.id, w.time + 30000); b.target = null; b.path = null; b.mWait = null; return; }
        b.hold = w.time + 600; return;
      }
    }
    // Crítico (Alt + clic) y dash, como un jugador con maestría 100 en el arma (Game.cpp, _iGetAttackType / OBJECTATTACKMOVE)
    const master = ((p.skills[p.eff.wtype === 0 ? 5 : p.eff.skill] || 0) >= 100), crit = master && (p.superAttack | 0) > 0;
    const gap = dist(p, t), reach = reachOf(w, p, t, crit);
    const ddx = Math.abs(p.x - t.x), ddy = Math.abs(p.y - t.y);
    const canDash = master && !p.eff.bow && gap === 2 && reachOf(w, p, t) === 1 && (ddx === 0 || ddy === 0 || ddx === ddy) && p.sp >= 2;
    if (gap <= reach || canDash) {
      b.stuck = null;
      if (w.time - p.lastAttack >= PLAYER.attackGapMs && !w.busy(p)) {
        const d = dirTo(p.x, p.y, t.x, t.y); if (d) p.dir = d;
        adv.command(p.id, gap <= reachOf(w, p, t) ? { t: "attack", target: t.id, ...(crit ? { crit: true } : {}) } : gap <= reach ? { t: "attack", target: t.id, crit: true } : { t: "attack", target: t.id, dash: true });
      }
    } else if (!step(adv, w, p, b, ...encircle(w, p, t), dist(p, t) > 5 || t.kind === "player") && b.fails > 8) {          // no hay camino hasta él (vallado, otra zona): lo descarta un rato
      (b.ignore ||= new Map()).set(t.id, w.time + 20000); b.target = null; b.fails = 0; b.path = null;
    }
    return;
  }
  // botín cercano (solo si no hay peligro a la vista)
  if (!b.rest && !b.noLoot && !b.travel) {
    const here = groundTop(w, p.x, p.y), mine = it => it && it.dropBy === b.pickFrom && w.time < (b.pickUntil || 0);   // orden «recoge esto» (orders.js): lo tirado por su jugador sí
    if (here && (!here.dropBy || mine(here)) && wanted(w, p, here)) { if (w.time - (b.lootLog || 0) > 5000) { b.lootLog = w.time; blog(w, p, `Recojo ${w.data.item(here.id)?.name || here.id}.`); } adv.command(p.id, { t: "pickup" }); return; }
    let best = null, bd = 0;
    const LR = (b.lootBoost || 0) > w.time ? 9 : 5;                                       // actividad de guild «loot»: rastrea más lejos
    for (let y = p.y - LR; y <= p.y + LR; y++) for (let x = p.x - LR; x <= p.x + LR; x++) {
      const it = w.grid.inside(x, y) && !w.teleports.has(w.grid.idx(x, y)) && !claimedByOther(w, p, x, y) && groundTop(w, x, y);          // el botín sobre un teletransportador se deja
      const lv = it && (!it.dropBy || mine(it)) ? lootValue(w, p, it) : 0; if (lv > 0) { const d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y)), sc = lv / (d + 2); if (sc > bd && (!owner || dist(owner, { x, y }) < 12)) { best = { x, y }; bd = sc; } }
    }
    if (best) { claim(w, p, best.x, best.y); think_(w, p, b, "loot"); if (!step(adv, w, p, b, best.x, best.y, false) && b.fails > 6) { b.noLoot = true; w.after(15000, () => { b.noLoot = false; }); b.fails = 0; } return; }
  }
  if (b.farmer && !b.rest && !b.travel && !owner && farm(adv, w, p, b)) return;
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
  if ((b.rest && !defend) || b.hold > w.time) return;
  if (w.map.kind === "indoor" && !owner && !b.travel && !b.rest) {                         // v0.85.100: dentro de un edificio (almacén…) sin recado pendiente: tras unos segundos va a la puerta y sale (antes vagaba dentro: no pisaba el teletransportador)
    if (b.inW !== w) { b.inW = w; b.inAt = w.time + 8000; }
    if (w.time >= b.inAt) {
      let best = null, bl = 1e9;
      for (const t of w.teleports.values()) { const l = t.x === p.x && t.y === p.y ? 0 : findPath(w.grid, p.x, p.y, t.x, t.y, p.id, 6000).length || 1e8; if (l < bl) { bl = l; best = t; } }
      if (best) { b.travel = { x: best.x, y: best.y, w, until: w.time + 60000 }; b.path = null; b.goal = null; b.fails = 0; b.hold = 0; blog(w, p, "Salgo del edificio."); return; }
    }
  }
  if (!b.travel && w.time >= (b.huntAt || 0) && w.map.kind !== "dungeon") {                // sin nada a la vista: va a cazar donde hay monstruos (antes vagaba para siempre por el pueblo, junto a la herrería y la tienda)
    b.huntAt = w.time + 8000;
    if (!p.res && !readyToHunt(w, p, b)) { b.huntAt = w.time + 2500; b.errand = 0; return; }              // v0.85.61 (obs. 1): primero equiparse/comprar, luego a entrenar
    let best = null, bd = 1e9;
    const weak = !!b.gearGap;                                                                 // poco equipo: solo presas fáciles, nunca una de nivel superior
    for (const e of w.ents.values()) { if (!hostile(e) || w.safeAt(e.x, e.y) || tooStrong(w, p, e) || trivialPrey(p, e, owner) || b.ignore?.has(e.id) || (weak && fightEstimate(w, p, e, true).ratio < 3)) continue; const d = dist(p, e) + Math.min(10, (p.kinds?.[e.name] || 0) / 6) - 3 * mobBonus(p, e); if (d < bd && (dist(p, e) > 40 || reachable(w, p, e))) { bd = d; best = e; } }
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
// PUERTA DE PREPARACIÓN (v0.85.61, obs. 1): antes de elegir zona de caza revisa el equipo. Sin arma, o con una pieza mejor en la mochila sin ponerse,
// no sale: manda un recado de equipo (errands equipa y recalcula, o compra). Si tras 3 intentos sigue igual (sin oro) sale, pero solo a presas fáciles (ratio >= 3).
export function readyToHunt(w, p, b) {
  const unarmed = p.equip[EQUIP.RHAND] === undefined && p.equip[EQUIP.TWOHAND] === undefined;
  const spare = p.bag.some(i => { const d = w.data.item(i.id); return d && d.equipPos > 0 && d.equipPos < EQUIP.FULLBODY && !Object.values(p.equip).includes(i.uid) && !b.bad.has(i.id) && !(d.levelLimit > p.level) && judge(w, p, i, friendsOf(w, p)).act === "equip"; });
  b.gearGap = unarmed || spare || !!b.armorGap;          // v0.85.98 (obs. 89/91): armadura incompleta o casi rota
  if (!b.gearGap) { b.prep = 0; return true; }
  return (b.prep = (b.prep || 0) + 1) > 3;
}
// Granjero (30% de los bots): compra azada y semillas, siembra en casillas de cultivo, cuida con la azada y recoge los productos
// para comerciar luego con ellos. Reglas de la agricultura: systems/farming.js (HG.cpp ITEMEFFECTTYPE_ITEMFARM, combat.cpp).
function farmTiles(w) {
  if (!w._farmTiles) { const a = []; for (let y = 0; y < w.grid.h; y++) for (let x = 0; x < w.grid.w; x++) if (w.grid.farm(x, y)) a.push({ x, y }); w._farmTiles = a; }
  return w._farmTiles;
}
function farm(adv, w, p, b) {
  const tiles = farmTiles(w);
  if (!tiles.length) return false;
  if (b.fixed === "farmer" && b.farmReady && w.time > (b.seedAt || 0) && !p.bag.some(i => w.data.item(i.id)?.effectType === 30)) { b.seedAt = w.time + 30000; b.farmReady = false; }      // el granjero fijo repone semillas
  if (!b.farmReady) {                                                       // equipo de labranza: azada y semillas con el oro propio
    b.farmReady = true;
    p.skills[SKILL.FARMING] = Math.max(p.skills[SKILL.FARMING] || 0, 40);
    const hoe = w.data.item(232), seed = w.data.item(801);
    if (hoe && !p.bag.some(i => i.id === 232) && p.gold > hoe.price) buy(w, p, hoe, 1);
    if (seed && p.gold > seed.price * 2) buy(w, p, seed, b.fixed === "farmer" ? Math.min(6, Math.floor(p.gold / seed.price / 2)) : 2);
  }
  const hoe = p.bag.find(i => i.id === 232), seeds = p.bag.find(i => w.data.item(i.id)?.effectType === 30);
  if (!hoe && !seeds) return false;
  const near = (x, y) => Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) <= 1;
  let crop = null, bd = 1e9;
  for (const e of w.ents.values()) if (e.crop && !e.dead) { const d = dist(p, e); if (d < bd && d < 30) { crop = e; bd = d; } }
  if (crop && hoe) {
    if (!near(crop.x, crop.y)) { think_(w, p, b, "farm"); return step(adv, w, p, b, crop.x, crop.y, false) || true; }
    if (p.eff.wtype !== 27) { tryEquip(w, p, b, hoe); return true; }
    if (w.time - p.lastAttack >= PLAYER.attackGapMs) { const d = dirTo(p.x, p.y, crop.x, crop.y); if (d) p.dir = d; adv.command(p.id, { t: "attack", target: crop.id }); }
    return true;
  }
  if (seeds) {
    if (w.time < (b.sowAt || 0)) return true;
    for (let d = 1; d <= 8; d++) {                                         // casilla de cultivo libre al lado
      const x = p.x + DX[d], y = p.y + DY[d];
      if (w.grid.farm(x, y) && w.grid.free(x, y)) { p.dir = d; b.sowAt = w.time + 1500; adv.command(p.id, { t: "use", uid: seeds.uid }); return true; }
    }
    let best = null, bd2 = 1e9;
    for (const t of tiles) { const d = dist(p, t); if (d < bd2 && d < 40 && w.grid.free(t.x, t.y)) { best = t; bd2 = d; } }
    if (best) { think_(w, p, b, "farm"); step(adv, w, p, b, best.x, best.y, false); return true; }
  }
  return false;
}
// Valor del objeto del suelo para el bot (0 = no lo recoge). INVENTO: antes recogía todo el equipo, el más cercano primero, y la basura le llenaba
// la mochila y el peso: luego no podía cargar las piezas buenas. Ahora lo juzga como si ya lo llevara (botitems.js judge): equipar/guardar/comerciar o
// vender por un precio que merezca el viaje; con la mochila cargada solo se lleva lo que de verdad le sirve.
export function lootValue(w, p, it) {
  const d = w.data.item(it.id);
  if (!d) return 0;
  if (it.id === GOLD) return 1e4;
  if (it.comp) return 0;
  if (d.type === ITYPE.EQUIP && d.price <= 0 && !it.attr && !(d.equipPos > 0 && d.equipPos < EQUIP.FULLBODY && !(d.levelLimit > p.level))) return 0;
  if (!((d.price > 0 || Shop.STONES.has(d.id) || d.type === ITYPE.EAT || d.type === ITYPE.EQUIP) && p.bag.length < MAX_ITEMS - 3 && Inv.canCarry(p, w.data, d, it.count || 1, it))) return 0;
  if (d.type !== ITYPE.EQUIP) return 1 + Math.abs(d.price || 0) * (it.count || 1) * 0.1;           // obs. 84: Xelima/Merien/Zemstone (precio negativo) valen su valor absoluto
  const v = judge(w, p, { ...it, life: it.life ?? d.maxLife }, friendsOf(w, p)), load = Inv.totalWeight(p, w.data) / Math.max(1, Inv.maxLoad(p));
  if (v.act === "equip") return 500 + v.value;
  if (v.act === "keep" || v.act === "store") return 50 + v.value;
  const poor = p.gold < 400 && load < 0.8;                                         // v0.85.98 (nota 67): sin oro para reparar/revivir, recoge y vende hasta lo modesto
  return v.value >= (poor ? 15 : load > 0.6 ? 400 : 120) ? v.value * (poor ? 0.5 : 0.2) : 0;                  // basura: solo si se vende bien y hay sitio
}
const wanted = (w, p, it) => lootValue(w, p, it) > 0;
// Arbitraje del botín: un bot reclama una casilla (8 s, renovable) y los demás la ignoran; lo tirado por jugadores no se toca.
const CLAIM_MS = 8000;
const claimedByOther = (w, p, x, y) => { const c = w.lootClaims?.get(w.grid.idx(x, y)); return !!c && c.id !== p.id && c.until > w.time; };
const claim = (w, p, x, y) => { (w.lootClaims ||= new Map()).set(w.grid.idx(x, y), { id: p.id, until: w.time + CLAIM_MS }); };
