// Compañeros (clase Cazador). INVENTO del port, sin equivalente en el original; se apoya en lo que sí existe:
// el hechizo Summon Creature (npcsys.summonFor) y los objetos GreenBall..PearlBall de Item.cfg (651..655) como "bola" contenedora.
//  - Las bolas SOLO se consiguen en la tienda (Gail, hospital de compañeros): matar monstruos no las da. Usarla la elige como compañero
//    (siempre esa especie) y lo invoca; volver a usarla lo guarda. La bola guarda especie, nivel y experiencia (inst.comp).
//  - Estadísticas COMPARTIDAS: el daño y la vida del compañero salen del daño medio y la vida del dueño, multiplicados por una
//    cuota que crece con el nivel del compañero; así sumar su daño al del jugador nunca desequilibra (cuota máxima 0,5).
//  - Experiencia: el compañero recibe el 40 % de lo que gana el dueño y el 50 % de la de sus propias muertes (el dueño no gana por ellas).
import { newInst } from "./itemsys.js";
import { groundPush } from "./ground.js";
import * as Inv from "../inventory.js";
import { MAX_ITEMS } from "../items.js";
import * as Tal from "./talents.js";
import * as Sch from "./schools.js";

export const MAX_COMP_LEVEL = 50;
// Tamaño por etapas: el compañero cambia de tamaño al llegar a estos niveles (10 joven, 25 veterano, 40 élite, 50 tamaño real).
// Al cruzar uno se emite `companion-evolve` y, pasado un momento, se vuelve a invocar con efecto (npcsys.evolveCompanion).
export const SIZE_STAGES = [10, 25, 40, 50];
export const sizeStep = lvl => SIZE_STAGES.filter(l => (lvl || 1) >= l).length;
// Nombres aleatorios (sílabas): cada compañero tiene el suyo, fijado al nacer la bola
const SYL_A = ["Bru", "Chi", "Dro", "Fen", "Gru", "Kor", "Lum", "Mok", "Nib", "Pip", "Rok", "Sil", "Tor", "Vex", "Zan", "Bol", "Cro", "Dun", "Fiz", "Gor"];
const SYL_B = ["bo", "ra", "ki", "mo", "tu", "lo", "na", "zi", "ko", "pa", "du", "ri", "so", "ga", "fi"];
const SYL_C = ["", "", "x", "n", "k", "s", "z", "to", "ly", "ko"];
export const randomName = rng => { const p = a => a[Math.floor(rng() * a.length)]; return p(SYL_A) + p(SYL_B) + p(SYL_C); };
// especie -> muertes para una bola, id de Item.cfg de la bola; el orden es el rango (poder de la especie)
export const SPECIES = {
  "Slime": [500, 651], "Giant-Ant": [500, 651], "Amphis": [500, 652], "Orc": [600, 652], "Skeleton": [600, 653], "Clay-Golem": [700, 653],
  "Stone-Golem": [700, 654], "Orc-Mage": [800, 654], "Hellbound": [900, 655], "Cyclops": [1000, 655], "Troll": [1000, 655], "Orge": [1000, 655],
  "Tentocle": [900, 654], "Cannibal-Plant": [900, 655], "Demon": [0, 652], "Frost": [0, 654], "Liche": [0, 655], "Dummy": [500, 652],     // escuelas (schools.js); Demon/Frost/Liche solo por cambio al nivel 50
};
const RANKS = Object.keys(SPECIES);
export const rankOf = sp => Math.max(0, RANKS.indexOf(sp));
export const need = lvl => Math.floor(30 * Math.pow(lvl, 1.7));              // experiencia para subir desde `lvl`
export const activeBall = p => p.bag.find(i => i.comp && i.comp.on);

// daño medio de un golpe del jugador (playerStrike sin azar)
export function avgHit(p) {
  const fx = p.eff || {}, str = p.stats.str;
  if (!fx.wtype) return Math.max(1, (Math.floor(str / 12) + 1) / 2);
  const m = fx.sm || [1, 1, 0], base = m[0] * (m[1] + 1) / 2 + m[2];
  return Math.max(1, fx.wtype < 40 ? base * (1 + str / 500) : base + (Math.floor(str / 20) + 1) / 2);
}
// cuota del daño del dueño que aporta el compañero
// Los compañeros son la parte principal del juego (petición del diseñador): aportan mucho, pero caen y cuestan caro de revivir.
export const shareOf = (lvl, sp) => Math.min(0.9, (0.3 + 0.012 * lvl) * (0.85 + 0.03 * rankOf(sp)));
export function statsOf(p, c) {
  if (c.sp === "Dummy") return { share: 0, dmg: 0, hp: Math.round(6 + 1.2 * c.lvl), mp: Tal.maxMp(c) };      // frágil: unos pocos golpes lo matan; sube poco con el nivel
  const share = shareOf(c.lvl, c.sp), f = Tal.factors(c);
  const t2 = Sch.isTier2(c.sp);                                              // especie superior de escuela: más vida y daño
  return { share, dmg: Math.max(1, Math.round(avgHit(p) * share * f.dmg * (t2 ? Sch.TIER_MULT.dmg : 1))), hp: Math.max(5, Math.round(p.maxHp * Math.min(1.5, 0.5 + 0.02 * c.lvl) * f.hp * (t2 ? Sch.TIER_MULT.hp : 1))), mp: Tal.maxMp(c) };
}

export const OWNER_SHARE = 0.4;                                              // parte de la experiencia del dueño que recibe su compañero (0.25 hasta v0.44: los habitantes lo veían subir demasiado despacio)
// Muerte de un monstruo a manos del jugador: experiencia del compañero (las bolas ya no se consiguen cazando)
export function onKill(w, p, n, xp) {
  const act = activeBall(p);
  if (act) addExp(w, p, act, Math.floor(xp * OWNER_SHARE));
}

// Muerte del compañero: pierde el 25 % de la experiencia de su nivel y, si no le alcanza, un nivel
export function penalize(w, p, inst) {
  const c = inst.comp, loss = Math.floor(need(c.lvl) * 0.25);
  c.exp -= loss;
  while (c.exp < 0 && c.lvl > 1) { c.lvl--; c.exp += need(c.lvl); }
  c.exp = Math.max(0, c.exp);
  w.emit({ t: "companion-lost", id: p.id, sp: c.sp, lvl: c.lvl, loss, nm: c.nm });
}

// ---------------------------------------------------------------- hospital de compañeros (NPC "Gail" con role "pethospital")
// INVENTO del port. Un compañero que cae queda inconsciente (comp.down) y no se puede invocar hasta que se revive; revivirlo es caro.
export const HOSPITAL = { npc: "Gail", role: "pethospital", reach: 8, ballPrice: 1, healPerHp: 2 };
// Caramelos a la venta en el hospital (Item.cfg los marca como no vendibles: precios del port). Rojo = vida, azul = maná, verde = revivir.
export const CANDY_PRICE = { 780: 60, 781: 90, 782: 400 };
export const maxOf = (p, c) => statsOf(p, c).hp;
export const hpOf = (p, c) => (c.down ? 0 : Math.min(maxOf(p, c), c.hp ?? maxOf(p, c)));
export const reviveCost = c => Math.round((1500 + 400 * c.lvl) * (1 + 0.15 * rankOf(c.sp)));
export const healCost = (p, c) => Math.max(0, Math.ceil((maxOf(p, c) - hpOf(p, c)) * HOSPITAL.healPerHp));
export const treatCost = (p, c) => (c.down ? reviveCost(c) : healCost(p, c));

const nearHospital = (w, p, id) => { const e = w.ents.get(id); return !!e && e.role === HOSPITAL.role && Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= HOSPITAL.reach; };

export function treat(w, p, cmd) {
  const inst = Inv.instOf(p, cmd.uid);
  if (!inst?.comp) return false;
  if (!nearHospital(w, p, cmd.npc)) return w.reject(p, cmd, "acércate a la enfermera");
  const c = inst.comp, cost = treatCost(p, c);
  if (cost <= 0) return w.reject(p, cmd, "no necesita cuidados");
  if (p.gold < cost) { w.emit({ t: "nogold", id: p.id }); return false; }
  p.gold -= cost;
  const revived = !!c.down;
  c.down = false; c.hp = maxOf(p, c);
  for (const e of w.ents.values()) if (e.comp && e.ball === inst.uid) e.hp = e.maxHp;          // si estaba fuera, se cura en el acto
  w.recalc(p);
  w.emit({ t: "pettreated", id: p.id, nm: c.nm, sp: c.sp, cost, revived });
  return true;
}

// Compra de caramelos en el hospital (1 a 99 por pedido)
export function buyCandy(w, p, cmd) {
  const id = cmd.item | 0, price = CANDY_PRICE[id], n = Math.max(1, Math.min(99, cmd.count | 0 || 1)), d = price && w.data.item(id);
  if (!d || !nearHospital(w, p, cmd.npc)) return w.reject(p, cmd, "no disponible");
  if (p.gold < price * n) { w.emit({ t: "nogold", id: p.id }); return false; }
  const inst = newInst(w, id, n);
  if (!Inv.canCarry(p, w.data, d, n, inst)) { w.emit({ t: "cantcarry", id: p.id, why: "weight" }); return false; }
  if (!p.bag.some(i => i.id === id) && p.bag.length >= MAX_ITEMS) { w.emit({ t: "cantcarry", id: p.id, why: "slots" }); return false; }
  p.gold -= price * n;
  Inv.addToBag(p, w.data, inst);
  w.recalc(p);
  w.emit({ t: "candybought", id: p.id, item: id, count: n, price: price * n, name: d.display || d.name });
  return true;
}

// Bolas para probar: 1 de oro cada una, de cualquier especie
export function buyBall(w, p, cmd) {
  const sp = String(cmd.sp || "");
  if (!SPECIES[sp] || Sch.isTier2(sp) || !nearHospital(w, p, cmd.npc)) return w.reject(p, cmd, "no disponible");
  if (!w.npcDb[sp]) return w.reject(p, cmd, "esa especie no existe en los datos (Orc-Mage no está en NPC.cfg)");          // se vendía una bola de una especie que no se puede invocar
  if (p.gold < HOSPITAL.ballPrice) { w.emit({ t: "nogold", id: p.id }); return false; }
  const ball = newInst(w, SPECIES[sp][1]);
  ball.comp = { sp, lvl: 1, exp: 0, on: false, nm: randomName(w.rng), mode: "attack", ...(Sch.SCHOOL_OF[sp] ? { spells: [] } : {}) };          // un summon de escuela nace sin hechizos: se los enseñas tú
  const d = w.data.item(ball.id);
  if (!d || p.bag.length >= MAX_ITEMS || !Inv.canCarry(p, w.data, { ...d, weight: 100 }, 1, ball)) { w.emit({ t: "cantcarry", id: p.id, why: "bag" }); return false; }
  p.gold -= HOSPITAL.ballPrice;
  Inv.addToBag(p, w.data, ball);
  w.recalc(p);
  w.emit({ t: "petbought", id: p.id, sp, nm: ball.comp.nm, uid: ball.uid, price: HOSPITAL.ballPrice });
  return true;
}

// Cambio de escuela (hospital): un summon de escuela de nivel 50 se cambia por otro de nivel 1 de la especie superior (mismo nombre)
export function tradeUp(w, p, cmd) {
  const inst = Inv.instOf(p, cmd.uid);
  if (!inst?.comp) return w.reject(p, cmd, "no tienes compañero");
  if (!nearHospital(w, p, cmd.npc)) return w.reject(p, cmd, "acércate a la enfermera");
  const c = inst.comp, to = Sch.TIER2[c.sp];
  if (!to) return w.reject(p, cmd, "esta especie no tiene versión superior");
  if (c.lvl < Sch.TRADE_LEVEL) return w.reject(p, cmd, "necesita nivel " + Sch.TRADE_LEVEL);
  if (c.down) return w.reject(p, cmd, "primero hay que revivirlo");
  for (const e of w.ents.values()) if (e.comp && e.ball === inst.uid) return w.reject(p, cmd, "guárdalo antes");
  const from = c.sp, ball = newInst(w, SPECIES[to][1]);
  ball.comp = { sp: to, lvl: 1, exp: 0, on: false, nm: c.nm, mode: c.mode || "attack", spells: [...(c.spells || [])] };           // lo que le enseñaste se conserva
  Inv.removeFromBag(p, inst.uid);
  Inv.addToBag(p, w.data, ball);
  w.recalc(p);
  w.emit({ t: "petupgraded", id: p.id, from, to, nm: c.nm, uid: ball.uid });
  return true;
}

// El jugador pone el nombre que quiera a su compañero elegido (1–12 letras, cifras, espacios, guion o apóstrofo)
export function rename(w, p, name) {
  const inst = activeBall(p) || p.bag.find(i => i.comp);
  const nm = String(name || "").trim().replace(/\s+/g, " ");
  if (!inst) return w.reject(p, { t: "petname" }, "no tienes compañero");
  if (!/^[\p{L}0-9][\p{L}0-9 '\-]{0,11}$/u.test(nm)) return w.reject(p, { t: "petname" }, "nombre no válido (1 a 12 letras o cifras)");
  inst.comp.nm = nm;
  for (const e of w.ents.values()) if (e.comp && e.ball === inst.uid) e.nick = nm;
  w.emit({ t: "petname", id: p.id, nm, sp: inst.comp.sp });
  return true;
}

// Modo del compañero: "attack" ataca todo lo que ve; "peace" solo sigue (salvo el objetivo marcado con Alt + clic)
export function setMode(w, p, mode) {
  const inst = activeBall(p);
  if (!inst) return w.reject(p, { t: "petmode" }, "no tienes compañero");
  inst.comp.mode = mode === "peace" ? "peace" : "attack";
  if (inst.comp.mode === "peace") for (const e of w.ents.values()) if (e.comp && e.master === p.id) e.cTarget = null;
  w.emit({ t: "petmode", id: p.id, mode: inst.comp.mode, nm: inst.comp.nm });
  return true;
}
export function setTarget(w, p, targetId) {
  const t = w.ents.get(targetId);
  const pet = [...w.ents.values()].find(e => e.comp && e.master === p.id && !e.dead);
  if (!pet) return w.reject(p, { t: "pettarget" }, "no tienes compañero fuera");
  if (!t || t.dead || t.kind !== "npc" || t.master || Math.max(Math.abs(t.x - p.x), Math.abs(t.y - p.y)) > 16) return w.reject(p, { t: "pettarget" }, "objetivo no válido");
  pet.cTarget = t.id;
  w.emit({ t: "pettarget", id: p.id, target: t.id, nm: pet.nick, tn: t.ghost ? "Fantasma skeleton" : t.name });
  return true;
}

// Talentos (talents.js): gastar un punto / reiniciar (cuesta oro, en el hospital)
export function learnTalent(w, p, cmd) {
  const inst = Inv.instOf(p, cmd.uid) || activeBall(p) || p.bag.find(i => i.comp);
  if (!inst?.comp) return w.reject(p, cmd, "no tienes compañero");
  const why = Tal.learn(inst.comp, String(cmd.talent));
  if (why) return w.reject(p, cmd, why);
  w.recalc(p);
  w.emit({ t: "talent", id: p.id, uid: inst.uid, talent: cmd.talent, rank: Tal.rankOf(inst.comp, cmd.talent), nm: inst.comp.nm });
  return true;
}
export function resetTalents(w, p, cmd) {
  const inst = Inv.instOf(p, cmd.uid) || activeBall(p) || p.bag.find(i => i.comp);
  if (!inst?.comp) return w.reject(p, cmd, "no tienes compañero");
  if (!nearHospital(w, p, cmd.npc)) return w.reject(p, cmd, "acércate a la enfermera");
  const cost = Tal.resetCost(inst.comp);
  if (!Tal.spentAll(inst.comp)) return w.reject(p, cmd, "no hay talentos que reiniciar");
  if (p.gold < cost) { w.emit({ t: "nogold", id: p.id }); return false; }
  p.gold -= cost; Tal.reset(inst.comp); w.recalc(p);
  w.emit({ t: "talentreset", id: p.id, uid: inst.uid, cost, nm: inst.comp.nm });
  return true;
}

export function addExp(w, p, inst, xp) {
  const c = inst.comp, cap = Math.min(MAX_COMP_LEVEL, p.level);
  if (xp <= 0 || c.lvl >= cap) return;
  c.exp += xp;
  while (c.lvl < cap && c.exp >= need(c.lvl)) {
    c.exp -= need(c.lvl); c.lvl++;
    w.emit({ t: "companion-lvl", id: p.id, sp: c.sp, lvl: c.lvl, nm: c.nm });
    if (c.sp !== "Dummy" && SIZE_STAGES.includes(c.lvl)) { c.evolve = true; w.emit({ t: "companion-evolve", id: p.id, sp: c.sp, lvl: c.lvl, nm: c.nm, step: sizeStep(c.lvl) }); }
  }
  if (c.lvl >= cap) c.exp = Math.min(c.exp, need(c.lvl) - 1);
}

// Caramelos (Item.cfg 780 rojo = vida, 781 azul = maná, 782 verde = revivir): alimento de compañeros, ya no curan al jugador.
// Se usan sobre una bola concreta (arrastrar) o, si no, sobre el compañero elegido. Devuelve la cantidad curada o false (rechazado).
export const isCandy = d => d.id >= 780 && d.id <= 782 || /Candy$/.test(d.name || "");
export function candy(w, p, d, destUid, roll) {
  const inst = (destUid && Inv.instOf(p, destUid)?.comp ? Inv.instOf(p, destUid) : null) || activeBall(p) || p.bag.find(i => i.comp);
  if (!inst) return w.reject(p, { t: "use" }, "no tienes compañero");
  const c = inst.comp, live = [...w.ents.values()].find(e => e.comp && e.ball === inst.uid && !e.dead);
  const mx = maxOf(p, c), kind = d.effectType === 4 ? "hp" : d.effectType === 5 ? "mp" : "revive";
  let amount = 0;
  if (kind === "revive") {
    if (!c.down) return w.reject(p, { t: "use" }, "tu compañero no está inconsciente");
    c.down = false; c.hp = Math.max(1, Math.round(mx * 0.5)); amount = c.hp;
  } else if (c.down) return w.reject(p, { t: "use" }, "tu compañero está inconsciente: necesita el caramelo verde");
  else if (kind === "hp") {
    const cur = live ? live.hp : hpOf(p, c);
    if (cur >= mx) return w.reject(p, { t: "use" }, "tu compañero ya tiene la vida completa");
    amount = Math.min(mx - cur, roll()); c.hp = cur + amount; if (live) live.hp = c.hp;
  } else {
    const school = Tal.isSchool(c);
    if (!live && !school) return w.reject(p, { t: "use" }, "invoca al compañero para darle maná");
    const top = Tal.maxMp(c), cur = live ? live.mp ?? top : c.mp ?? top;           // el de escuela guarda el maná en la bola: se le puede dar guardado
    if (cur >= top) return w.reject(p, { t: "use" }, "tu compañero ya tiene el maná completo");
    amount = Math.min(top - cur, roll()); c.mp = Math.floor(cur + amount); if (live) live.mp = cur + amount;
  }
  w.emit({ t: "candy", id: p.id, kind, amount, nm: c.nm, sp: c.sp, item: d.id });
  return amount;
}

// Alt + clic derecho: el compañero va a esa casilla y se queda allí (hasta 15 s para llegar; si el dueño se aleja más de 14 casillas vuelve a seguirlo)
export function setGo(w, p, x, y) {
  const pet = [...w.ents.values()].find(e => e.comp && e.master === p.id && !e.dead);
  if (!pet) return w.reject(p, { t: "petgo" }, "no tienes compañero fuera");
  x = Math.floor(Number(x)); y = Math.floor(Number(y));
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= w.grid.w || y >= w.grid.h || Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) > 24) return w.reject(p, { t: "petgo" }, "casilla no válida");
  pet.goTo = { x, y, until: w.time + 15000 }; pet.holdAt = null; pet.cTarget = null;
  w.emit({ t: "petgo", id: p.id, x, y, nm: pet.nick });
  return true;
}
