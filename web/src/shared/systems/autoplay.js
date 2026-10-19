// MODO AUTOMÁTICO del jugador (INVENTO del port; el original no lo trae). Dos modos, ambos solo deciden ADÓNDE ir o A QUIÉN atacar:
// el cliente (controller.js) convierte la decisión en la misma intención que un clic (mover / atacar / recoger), así que el servidor valida
// cada paso igual que siempre y no hay nada que hacer en red. Se cancela con cualquier clic o con «/auto stop».
//   hunt {mob}: caza SOLO esa criatura (nombre de NPC.cfg, glosario en orders.js) donde esté el jugador, recoge el botín cercano y se detiene
//               si la vida baja del 35 %, si no queda ninguna en el mapa durante 20 s, o si mueres.
//   run {place}: anda hasta el habitante de ciudad (almacén, tienda, herrería, mago, granjero, arena, hospital) y le abre su diálogo.
//   decide(w, me, auto) -> { intent?, open?, stop?, msg? } (msg = [es, en])
import { dist } from "../const.js";
import { NPC } from "./shopsys.js";
import { groundTop } from "./ground.js";
import { mobOf } from "./orders.js";
import { findPath } from "../path.js";
import { rarityOf } from "../rarity.js";
import { EFFECT, ITYPE, isStack } from "../items.js";
import { isEquipped, totalWeight, maxLoad } from "../inventory.js";
import { MAX_BANK, MAX_SELL_LIST, sellValue, repairCost } from "./shopsys.js";
import { realStats } from "../attributes.js";

export const HP_STOP = 0.35, IDLE_STOP_MS = 20000, SIGHT = 40, LOOT_RANGE = 7, BAG_MAX = 50, ZONE_PAD = 8, BAG_NEAR = 47, LOAD_FULL = 0.9;
// Acción por rareza (0 normal, 1 mágico, 2 raro, 3 único): ignore = lo deja en el suelo; sell = lo recoge y, con la mochila llena, lo vende en la tienda;
// store = lo recoge y, con la mochila llena, lo guarda en el almacén (si el almacén se llena, termina el hunt).
export const DEFAULT_RULES = ["sell", "sell", "store", "store"];
export const ruleOf = (a, inst) => (a.rules || DEFAULT_RULES)[rarityOf(inst.id, inst.attr)] || "ignore";
// Objetos de la mochila que la caza ha recogido (no estaban al empezar ni están puestos) y que su regla manda vender / guardar
export function disposable(w, me, a, act) {
  a.bag0 ||= new Set((me.bag || []).map(i => i.uid));
  return (me.bag || []).filter(i => !a.bag0.has(i.uid) && !isEquipped(me, i.uid) && ruleOf(a, i) === act && (a.bad?.[i.uid] || 0) < 3);
}
// Equipo que lleva puesto el cazador (a.worn). Al romperse, el servidor lo quita del cuerpo (combatsys: Inv.unequip), así que hay que recordarlo para repararlo y volver a ponerlo.
export function trackWorn(me, a) { const w = (a.worn ||= new Set()); for (const u of Object.values(me.equip || {})) w.add(u); return w; }
const smithCat = (w, i) => { const c = w.data.item(i.id)?.category; return c >= 1 && c <= 10; };
const wornBag = (w, me, a) => (me.bag || []).filter(i => a.worn?.has(i.uid) && smithCat(w, i));
// roto (vida 0) y gastado (menos vida que el máximo) entre lo que llevaba puesto
export const brokenGear = (w, me, a) => wornBag(w, me, a).filter(i => i.life !== undefined && i.life <= 0);
export const damagedGear = (w, me, a) => wornBag(w, me, a).filter(i => { const d = w.data.item(i.id); return i.life !== undefined && repairCost(i, d) > 0 && i.life < realStats(d, i).maxLife; });
// ya arreglado pero sin ponerse otra vez
export const unworn = (w, me, a) => wornBag(w, me, a).filter(i => !isEquipped(me, i.uid) && !(i.life <= 0) && (a.eqTry?.[i.uid] || 0) < 3);
export const SEND_GAP_MS = 700, SENT_WAIT_MS = 3000;       // SENT_WAIT: lo enviado se da por «en camino» ese tiempo; solo se reenvía (y cuenta como intento) si la respuesta no llegó
const inflight = (a, w, uid) => a.sent?.[uid] !== undefined && w.time - a.sent[uid] < SENT_WAIT_MS;
const mark = (a, w, list) => { a.sent ||= {}; a.bad ||= {}; for (const i of list) { if (a.sent[i.uid] !== undefined) a.bad[i.uid] = (a.bad[i.uid] || 0) + 1; a.sent[i.uid] = w.time; } };
const gap = (a, w) => a.sentAt && w.time - a.sentAt < SEND_GAP_MS;                                   // espera entre dos órdenes de tienda: sin ella, la respuesta llegaba tarde y `a.bad` marcaba el objeto como rechazado
export const FARM = "arefarm", FARM_HOME = [65, 75];               // adventure.js FARM_HOME
export const BUILDINGS = { warehouse: "wrhus_1f", shop: "gshop_1f", smith: "bsmith_1f" };   // mapa interior de cada destino de ciudad (Aresden)
// v0.85.82 (obs. 43): cada bando tiene su granja, su punto de retorno y sus interiores (elvfarm.json: teleports a wrhus_2f, gshop_2f, bsmith_2f)
export const CITIES = {
  1: { farm: FARM, home: FARM_HOME, buildings: BUILDINGS },
  2: { farm: "elvfarm", home: [124, 151], buildings: { warehouse: "wrhus_2f", shop: "gshop_2f", smith: "bsmith_2f" } },
};
export const cityOf = me => CITIES[me?.side === 2 ? 2 : 1];
// destino -> filtro de habitante (los de rol propio llevan e.role; el resto, e.type de shopsys.js NPC)
export const PLACES = {
  farm: { re: /^(granja|farm|casa|home|aresfarm)$/, es: "la granja", en: "the farm" },
  warehouse: { re: /alm[ae]c[ae]n|warehouse|banco|bank|cofre|bodega/, type: NPC.WAREHOUSE, es: "el almacén", en: "the warehouse" },
  shop: { re: /tienda|shop|comprar|vender|sell|buy/, type: NPC.SHOP, es: "la tienda", en: "the shop" },
  smith: { re: /herrer|blacksmith|smith|forja/, type: NPC.BLACKSMITH, es: "la herrería", en: "the blacksmith" },
  mage: { re: /mago|magia|hechic|sorcer|mage|spell/, type: NPC.MAGE, es: "el mago", en: "the sorcerer" },
  farmer: { re: /granj|farmer|semilla|seed/, role: "farmer", es: "el granjero", en: "the farmer" },
  hospital: { re: /hospital|gail|mascota|pet ?heal/, role: "pethospital", es: "el hospital de mascotas", en: "the pet hospital" },
  petmage: { re: /hechicero de mascotas|pet ?sorcerer|pet ?mage|grimorio/, role: "petmage", es: "el hechicero de mascotas", en: "the pet sorcerer" },
};
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
export function placeOf(text) {
  const t = norm(text);
  for (const k of ["farm", "petmage", "hospital", "warehouse", "smith", "mage", "farmer", "shop"]) if (PLACES[k].re.test(t)) return k;
  return null;
}
// habitante más cercano de ese destino en el mapa actual (o null)
export function placeEnt(w, me, place) {
  const P = PLACES[place]; let best = null, bd = 1e9;
  if (!P || !(P.role || P.type)) return null;
  for (const e of w.ents.values()) {
    if (e.kind !== "citizen" || (P.role ? e.role !== P.role : e.role || e.type !== P.type)) continue;
    const d = dist(me, e); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
export function parseAuto(text, names = []) {                                  // «/auto hunt slime», «/auto run almacén», «/auto stop»
  const m = String(text || "").trim().match(/^(hunt|caza|cazar|run|ir|ruta|stop|para|parar|off)\b\s*(.*)$/i);
  if (!m) return null;
  const k = m[1].toLowerCase();
  if (/^(stop|para|parar|off)$/.test(k)) return { kind: "stop" };
  if (/^(hunt|caza|cazar)$/.test(k)) { const mob = mobOf(m[2], names); return mob ? { kind: "hunt", mob } : { kind: "bad", why: m[2] }; }
  const place = placeOf(m[2]); return place ? { kind: "run", place } : { kind: "bad", why: m[2] };
}
export const label = (a, lang = "es") => !a ? "" : a.kind === "hunt" ? a.mob : PLACES[a.place]?.[lang] || "";

// Paso hacia el mapa `to`: desde la granja se pisa el teletransportador de ese edificio; desde dentro, el que sale a la granja.
// null = ya estás; { stop } si no hay camino (otro mapa, la granja de Elvine, la cripta…).
export function viaTeleport(w, me, to) {
  const hub = cityOf(me).farm, cur = w.map?.id || hub;
  if (cur === to) return null;
  const next = cur === hub ? to : hub;
  let best = null, bd = 1e9;
  for (const t of w.teleports?.values?.() || []) {                       // varias entradas (el almacén tiene dos): la de camino más corto, no la más cercana en línea recta
    if (String(t.map).toLowerCase() !== next) continue;
    const l = w.grid && !(t.x === me.x && t.y === me.y) ? findPath(w.grid, me.x, me.y, t.x, t.y, me.id, 6000).length : 0;
    const d = w.grid && l ? l : t.x === me.x && t.y === me.y ? 0 : 1e6 + dist(me, t); if (d < bd) { bd = d; best = t; }
  }
  if (!best) return { stop: true, msg: ["No encuentro el camino a ese destino desde aquí.", "I can't find the way to that place from here."] };
  return { intent: { t: "move", x: best.x, y: best.y } };
}
export const inRect = (r, x, y, pad = 0) => x >= r[0] - pad && x <= r[2] + pad && y >= r[1] - pad && y <= r[3] + pad;

// Casilla alcanzable a ≤2 del habitante (el diálogo se abre a esa distancia; muchos están tras un mostrador): la de camino más corto.
export function approach(w, me, e) {
  let best = null, bl = 1e9;
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
    const x = e.x + dx, y = e.y + dy;
    if (!w.grid.inside(x, y) || w.grid.blocked(x, y) || w.teleports?.has?.(w.grid.idx(x, y)) || (w.grid.occupant?.(x, y) !== undefined && (x !== me.x || y !== me.y))) continue;
    const l = x === me.x && y === me.y ? 0 : findPath(w.grid, me.x, me.y, x, y, me.id, 6000).length;
    if (x !== me.x || y !== me.y) if (!l) continue;
    if (l < bl) { bl = l; best = [x, y]; }
  }
  return best;
}

export function decide(w, me, a) {
  if (!a) return {};
  if (me.dead && a.kind === "hunt") return {};                                    // la caza espera: controller.js reaparece y sigue
  if (me.dead) return { stop: true, msg: ["Has muerto: modo automático detenido.", "You died: auto mode stopped."] };
  if (a.kind === "run") {
    if (a.place === "farm") {
      const C = cityOf(me), HOME = C.home;
      const v = viaTeleport(w, me, C.farm); if (v) return v;
      if (dist(me, { x: HOME[0], y: HOME[1] }) <= 3) return { stop: true, msg: ["Estoy en la granja.", "I'm at the farm."] };
      const sp = w.freeSpotNear?.(...HOME) || HOME;
      return { intent: { t: "move", x: sp[0], y: sp[1] } };
    }
    const e = placeEnt(w, me, a.place);
    const C = cityOf(me);
    if (!e && C.buildings[a.place]) { const v = viaTeleport(w, me, C.buildings[a.place]); if (v) return v; }
    else if (!e && (w.map?.id || C.farm) !== C.farm) { const v = viaTeleport(w, me, C.farm); if (v && !v.stop) return v; }
    if (!e) return { stop: true, msg: ["No hay " + PLACES[a.place].es + " en este mapa.", "There is no " + PLACES[a.place].en + " on this map."] };
    if (dist(me, e) <= 2) return { stop: true, open: e, msg: ["Llegué a " + PLACES[a.place].es + ".", "Arrived at " + PLACES[a.place].en + "."] };
    const spot = approach(w, me, e);
    if (!spot) return { stop: true, msg: ["No encuentro cómo llegar a " + PLACES[a.place].es + ".", "I can't find a way to reach " + PLACES[a.place].en + "."] };
    return { intent: { t: "move", x: spot[0], y: spot[1] } };
  }
  if (me.hp < me.maxHp * HP_STOP) {
    if (a.potions !== false) {                                                       // «tomar pociones con poca vida» (por defecto activo)
      const pot = (me.bag || []).find(i => { const d = w.data.item(i.id); return d && d.type === ITYPE.EAT && d.effectType === EFFECT.HP; });
      if (pot) return { send: { t: "use", uid: pot.uid } };
    }
    return { stop: true, msg: ["Vida baja: caza automática detenida.", "Low health: auto hunt stopped."] };
  }
  a.bag0 ||= new Set((me.bag || []).map(i => i.uid));                                // foto de la mochila al empezar (antes se tomaba al llenarse y todo el botín contaba como tuyo)
  const z = a.zone;
  trackWorn(me, a);
  if (a.repair !== false && !a.noRepair && (a.fixing || brokenGear(w, me, a).length || (a.full && me.gold > 0 && damagedGear(w, me, a).length))) {   // arma o armadura rota: a la herrería a repararla, volver a ponérsela y seguir cazando
    a.fixing = true;
    const r = decide(w, me, { kind: "run", place: "smith" });
    if (r.open) {
      if (gap(a, w)) return {};
      const dmg = damagedGear(w, me, a);
      if (dmg.length && !(me.gold > 0)) { a.noRepair = true; a.fixing = false; return { msg: ["Sin oro para reparar: sigo sin reparar.", "No gold to repair: carrying on unrepaired."] }; }
      if (dmg.length) {
        a.sentAt = w.time;
        if (++a.fixTries > 3) { a.noRepair = true; a.fixing = false; return { msg: ["No puedo reparar (¿sin oro?): sigo sin reparar.", "Can't repair (no gold?): carrying on unrepaired."] }; }
        return { send: { t: "repairall", whom: NPC.BLACKSMITH, uids: dmg.map(i => i.uid) } };
      }
      const back = unworn(w, me, a);
      if (back.length) {
        a.sentAt = w.time; a.eqTry ||= {}; for (const i of back) a.eqTry[i.uid] = (a.eqTry[i.uid] || 0) + 1;
        return { sends: back.map(i => ({ t: "equip", uid: i.uid })) };
      }
      a.fixing = false; a.fixTries = 0;
      return { msg: ["Equipo reparado: sigo cazando.", "Gear repaired: back to hunting."] };
    }
    a.fixTries ||= 0;
    if (r.stop) { a.noRepair = true; a.fixing = false; return { msg: r.msg }; }
    if (!a.saidFix) { a.saidFix = true; return { ...r, msg: ["Equipo roto: voy a repararlo.", "Gear broken: going to repair it."] }; }
    return r;
  }
  if (!a.fixing) { a.saidFix = false; a.fixTries = 0; if (!a.full && !brokenGear(w, me, a).length) a.noRepair = false; }       // con el viaje a la ciudad en curso no se reintenta lo que ya falló
  if (z) {                                                                        // caza con zona: ir, cazar dentro y volver a la granja con la mochila llena
    if ((me.bag?.length || 0) >= BAG_NEAR || totalWeight(me, w.data) >= maxLoad(me) * LOAD_FULL) a.full = true;       // llena por casillas o por peso (con el peso al límite no se recoge nada aunque queden casillas)
    if (a.full) {                                                                      // mochila llena: vender y guardar lo recogido según su rareza y retomar la caza
      const sell = disposable(w, me, a, "sell"), store = disposable(w, me, a, "store");
      if (!sell.length && !store.length) {
        if (me.bag.length >= BAG_MAX || totalWeight(me, w.data) >= maxLoad(me)) return { stop: true, msg: ["Mochila llena sin nada que vender ni guardar: caza detenida.", "Bag full with nothing to sell or store: hunt stopped."] };
        a.full = false; a.said = false; a.skip = null; a.tries = null;           // con sitio otra vez, el botín descartado se reintenta
      } else {
        const place = sell.length ? "shop" : "warehouse";
        if (place === "warehouse" && (me.bank?.length || 0) >= MAX_BANK - 1 && !store.some(i => me.bank.some(b => b.id === i.id && isStack(w.data.item(i.id)))))
          return { stop: true, msg: ["Almacén lleno: caza detenida.", "Warehouse full: hunt stopped."] };
        const r = decide(w, me, { kind: "run", place });
        if (r.open) {
          if (gap(a, w)) return {};
          if (place === "shop") {
            let nope = 0;
            const items = sell.filter(i => { const v = sellValue(w, me, i, i.count || 1); if (v.cannot) { (a.bad ||= {})[i.uid] = 3; nope++; return false; } return !inflight(a, w, i.uid); }).slice(0, MAX_SELL_LIST);
            const warn = nope && !a.saidCant ? { msg: [nope + " objeto(s) no se pueden vender aquí: los dejo en la mochila.", nope + " item(s) can't be sold here: keeping them in the bag."] } : {};
            if (nope) a.saidCant = true;
            if (!items.length) return warn;
            a.sentAt = w.time; mark(a, w, items);
            return { ...warn, send: { t: "selllist", items: items.map(i => ({ uid: i.uid, count: i.count || 1 })) } };
          }
          const items = store.filter(i => !inflight(a, w, i.uid)).slice(0, MAX_SELL_LIST);
          if (!items.length) return {};
          a.sentAt = w.time; mark(a, w, items);
          return { sends: items.map(i => ({ t: "deposit", uid: i.uid, count: i.count || 1 })) };
        }
        if (r.stop) return r;
        if (!a.said) { a.said = true; return { ...r, msg: place === "shop" ? ["Mochila llena: voy a vender.", "Bag full: going to sell."] : ["Mochila llena: voy a guardar.", "Bag full: going to store."] }; }
        return r;
      }
    }
    if ((w.map?.id || cityOf(me).farm) !== z.map) { const v = viaTeleport(w, me, z.map); if (v) return v; }
  }
  let t = null, bd = 1e9;
  for (const e of w.ents.values()) {
    if (e.kind !== "npc" || e.dead || e.name !== a.mob) continue;
    if (z && !inRect(z.rect, e.x, e.y, ZONE_PAD)) continue;
    const d = dist(me, e); if (d <= SIGHT && d < bd) { bd = d; t = e; }
  }
  // a.nopick (opción «No recoger objetos»): no pisa el botín; a.kills lo cuenta main.js con el evento "death" y lo muestra la mini ventana (autowin.js)
  let lt = null, ld = 1e9;
  if (!a.nopick) for (let dx = -LOOT_RANGE; dx <= LOOT_RANGE; dx++) for (let dy = -LOOT_RANGE; dy <= LOOT_RANGE; dy++) {       // sin presas a la vista: botín cercano
    const x = me.x + dx, y = me.y + dy;
    if (!w.grid.inside(x, y) || !groundTop(w, x, y) || ruleOf(a, groundTop(w, x, y)) === "ignore" || a.skip?.has(x + "," + y) || (z && !inRect(z.rect, x, y, ZONE_PAD))) continue;
    const d = Math.max(Math.abs(dx), Math.abs(dy)); if (d < ld) { ld = d; lt = { x, y }; }
  }
  if (lt && (!t || bd > 1)) {                                    // el botín se recoge aunque haya presas a la vista (antes solo sin ninguna: nunca)
    t = lt;
    const k = t.x + "," + t.y; a.tries ||= {}; a.skip ||= new Set();
    a.tries[k] ||= 0;
    if (t.x === me.x && t.y === me.y && ++a.tries[k] > 2) { a.skip.add(k); a.full = true; }       // no cabe en la mochila: no insiste y va a vender (a.full se apaga solo si no hay nada que vender)
    return { intent: { t: "pickup", x: t.x, y: t.y } };
  }
  if (t) { a.idle = null; return { intent: { t: "attack", id: t.id } }; }
  if (z && !inRect(z.rect, me.x, me.y)) {                                         // sin presas a la vista: al centro de la zona
    const cx = (z.rect[0] + z.rect[2]) >> 1, cy = (z.rect[1] + z.rect[3]) >> 1, sp = w.freeSpotNear?.(cx, cy) || [cx, cy];
    return { intent: { t: "move", x: sp[0], y: sp[1] } };
  }
  a.idle ??= w.time;
  if (w.time - a.idle > IDLE_STOP_MS) return { stop: true, msg: ["No quedan " + a.mob + " a la vista: caza automática detenida.", "No " + a.mob + " left in sight: auto hunt stopped."] };
  return {};
}
