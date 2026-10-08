// Jugador: creación, guardado, recalculo de atributos, reaparición.
import * as R from "../rules.js";
import * as Inv from "../inventory.js";
import { EQUIP } from "../items.js";
import { ACT } from "../const.js";
import { initVitals } from "./vitals.js";
import { newInst } from "./itemsys.js";

const LEGACY = { red: 91, bigred: 92, blue: 93, green: 95 };     // partidas guardadas con el formato antiguo

// Personaje nuevo (WorldLServer.exe): 70 puntos entre los seis atributos; habilidades iniciales y objetos.
function newCharacter(w, p) {
  Object.assign(p, {
    gender: 1,
    stats: { str: 14, vit: 12, dex: 14, int: 10, mag: 10, chr: 10 },
    level: 1, exp: R.expForLevel(1), pool: 0, side: 0,
    bag: [], equip: {}, gold: 0, ssn: {}, magic: {},
  });
  const s = p.stats;
  p.skills = { 3: Math.floor(s.mag / 3), 4: s.mag + 10, 5: s.str + 10, 7: s.dex + 10 };
  const give = (name, equip = false) => {
    const d = w.data.named(name);
    if (!d) return;
    const inst = newInst(w, d.id);
    p.bag.push(inst);
    if (equip) p.equip[d.equipPos] = inst.uid;
  };
  give("Dagger"); give("Map"); give("RedPotion"); give("BluePotion"); give("GreenPotion");
  give("WoodShield", true);
  give(p.gender === 1 ? "KneeTrousers(M)" : "Chemise(W)", p.gender === 1);
}

export function addPlayer(w, name, save = null) {
  const [x, y] = w.freeSpotNear(w.start[0], w.start[1]);
  const p = w.makeEnt("player", x, y);
  Object.assign(p, { name, lastMove: -1e9, lastAttack: -1e9, lastCombat: -1e9, lastVitals: w.time, kills: 0, deadAt: 0 });
  newCharacter(w, p);
  if (save) loadSave(w, p, save);
  recalc(w, p);
  p.hp = p.maxHp; p.mp = p.maxMp;
  initVitals(w, p);
  if (save && Number.isFinite(save.hunger)) p.hunger = save.hunger;
  w.emit({ t: "spawn", id: p.id });
  return p.id;
}

function loadSave(w, p, s) {
  for (const k of ["level", "exp", "pool", "gold", "kills", "gender", "side"]) if (Number.isFinite(s[k])) p[k] = s[k];
  if (s.stats) for (const k in p.stats) if (Number.isFinite(s.stats[k])) p.stats[k] = s.stats[k];
  if (s.skills) p.skills = { ...s.skills };
  if (s.ssn) p.ssn = { ...s.ssn };
  if (s.magic) p.magic = { ...s.magic };
  if (Array.isArray(s.bag)) {
    p.bag = s.bag.filter(i => w.data.item(i.id)).map(i => ({ uid: w.nextItem++, id: i.id, count: i.count || 1, life: i.life ?? w.data.item(i.id).maxLife, old: i.uid, ...(i.attr ? { attr: i.attr, color: i.color || 0 } : {}) }));
    p.equip = {};
    for (const [pos, old] of Object.entries(s.equip || {})) { const m = p.bag.find(i => i.old === old); if (m) p.equip[pos] = m.uid; }
    for (const i of p.bag) delete i.old;
  } else if (s.inv) {                                        // formato antiguo: contadores de pociones
    p.bag = p.bag.filter(i => w.data.item(i.id).type !== 7);
    for (const [k, n] of Object.entries(s.inv)) for (let i = 0; i < n; i++) if (LEGACY[k]) p.bag.push(newInst(w, LEGACY[k]));
  }
}

export function saveOf(w, id) {
  const p = w.ents.get(id);
  if (!p || p.kind !== "player") return null;
  return {
    level: p.level, exp: p.exp, pool: p.pool, gold: p.gold, kills: p.kills, gender: p.gender, side: p.side,
    stats: { ...p.stats }, skills: { ...p.skills }, ssn: { ...p.ssn }, magic: { ...p.magic }, hunger: p.hunger,
    bag: p.bag.map(i => ({ uid: i.uid, id: i.id, count: i.count, life: i.life, ...(i.attr ? { attr: i.attr, color: i.color } : {}) })), equip: { ...p.equip },
  };
}

export function recalc(w, p) {
  Inv.recalc(p, w.data);
  const c = { ...p.stats, level: p.level };
  p.maxHp = R.maxHP(c); p.maxMp = R.maxMP(c); p.maxSp = R.maxSP(c);
  p.nextExp = R.expForLevel(p.level + 1);
  p.prevExp = R.expForLevel(p.level);
  p.weight = Inv.totalWeight(p, w.data);
  p.maxLoad = Inv.maxLoad(p);
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  if (p.sp > p.maxSp) p.sp = p.maxSp;
  if (p.mp > p.maxMp) p.mp = p.maxMp;
}

export function respawn(w, p) {
  if (!p.dead || w.time - p.deadAt < 1500) return false;
  const [x, y] = w.freeSpotNear(w.start[0], w.start[1]);
  p.x = p.eff = x; p.y = p.fy = y;
  w.grid.occupy(x, y, p.id);
  p.dead = false;
  p.hp = p.maxHp; p.mp = p.maxMp; p.sp = p.maxSp; p.hunger = 100;
  w.setAct(p, ACT.STOP, 0);
  p.busyUntil = 0;
  w.emit({ t: "respawn", id: p.id });
  return true;
}

export function removePlayer(w, id) {
  const p = w.ents.get(id);
  if (!p || p.kind !== "player") return;
  if (!p.dead) w.grid.release(p.x, p.y, p.id);
  for (const n of w.ents.values()) if (n.target === id) n.target = null;
  w.ents.delete(id);
  w.emit({ t: "remove", id });
}
