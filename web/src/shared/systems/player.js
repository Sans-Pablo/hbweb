// Jugador: creación, guardado, recalculo de atributos, reaparición.
import * as R from "../rules.js";
import * as Inv from "../inventory.js";
import { EQUIP } from "../items.js";
import { ACT } from "../const.js";
import { initVitals } from "./vitals.js";
import { MAGIC_MODE } from "../magic.js";
import { newInst } from "./itemsys.js";

const LEGACY = { red: 91, bigred: 92, blue: 93, green: 95 };     // partidas guardadas con el formato antiguo

// Nombre de personaje válido (CMisc::bCheckValidName; el cuadro de texto del cliente admite 10 letras).
const NAME_BAD = ",= \n\t.\\/:*?<>|\"`;@[]^_'";
export const validCharName = n => typeof n === "string" && n.length >= 1 && n.length <= 10 &&
  [...n].every(c => c >= "0" && c <= "z" && !NAME_BAD.includes(c));

// Creación (Client/Game.cpp, UpdateScreen_OnCreateNewCharacter): atributos de 10 a 14 con 70 puntos en total
// como máximo; género 1/2, piel 1-3, peinado 0-7, color de pelo 0-15, color de ropa interior 0-7.
const clampInt = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
export const PRESETS = {
  warrior: { str: 14, vit: 12, dex: 14, int: 10, mag: 10, chr: 10 },
  mage: { str: 10, vit: 12, dex: 10, int: 14, mag: 14, chr: 10 },
  priest: { str: 14, vit: 10, dex: 10, int: 10, mag: 12, chr: 14 },
};
export function sanitizeCreate(c) {
  c = c || {};
  let stats = { ...PRESETS.warrior };
  if (c.stats) {
    const k = ["str", "vit", "dex", "int", "mag", "chr"], v = {};
    for (const n of k) v[n] = c.stats[n];
    if (k.every(n => Number.isInteger(v[n]) && v[n] >= 10 && v[n] <= 14) && k.reduce((a, n) => a + v[n], 0) <= 70) stats = v;
  }
  return {
    stats,
    gender: clampInt(c.gender, 1, 2, 1),
    look: { skin: clampInt(c.skin, 1, 3, 2), hair: clampInt(c.hair, 0, 7, 1), hairCol: clampInt(c.hairCol, 0, 15, 0), under: clampInt(c.under, 0, 7, 0) },
  };
}

// Personaje nuevo (WorldLServer.exe): habilidades iniciales y objetos.
// modo pruebas: todos los hechizos conocidos
function allSpells(w) {
  const m = {};
  if (MAGIC_MODE.free) for (const id in w.magic) if (w.magic[id]) m[id] = 1;
  return m;
}

function newCharacter(w, p, create) {
  const c = sanitizeCreate(create);
  Object.assign(p, {
    gender: c.gender, look: c.look,
    stats: c.stats,
    level: 1, exp: R.expForLevel(1), pool: 0, side: 0,
    bag: [], equip: {}, gold: 0, ssn: {}, magic: allSpells(w),
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
  give(p.gender === 1 ? "KneeTrousers(M)" : "Chemise(W)", true);
}

export function addPlayer(w, name, save = null, create = null) {
  const [x, y] = w.freeSpotNear(w.start[0], w.start[1]);
  const p = w.makeEnt("player", x, y);
  Object.assign(p, { name, lastMove: -1e9, lastAttack: -1e9, lastCombat: -1e9, lastVitals: w.time, kills: 0, deadAt: 0 });
  newCharacter(w, p, create);
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
  if (s.look) p.look = { ...p.look, ...s.look };
  if (typeof s.charName === "string" && validCharName(s.charName)) p.name = s.charName;
  if (s.skills) p.skills = { ...s.skills };
  if (s.ssn) p.ssn = { ...s.ssn };
  if (s.magic) p.magic = { ...s.magic, ...allSpells(w) };
  if (Array.isArray(s.bag)) {
    p.bag = s.bag.filter(i => w.data.item(i.id)).map(i => ({ uid: w.nextItem++, id: i.id, count: i.count || 1, life: i.life ?? w.data.item(i.id).maxLife, old: i.uid, ...(i.attr ? { attr: i.attr, color: i.color || 0 } : {}), ...(Number.isFinite(i.x) ? { x: i.x, y: i.y } : {}) }));
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
    level: p.level, exp: p.exp, pool: p.pool, gold: p.gold, kills: p.kills, gender: p.gender, side: p.side, look: { ...p.look }, charName: p.name,
    stats: { ...p.stats }, skills: { ...p.skills }, ssn: { ...p.ssn }, magic: { ...p.magic }, hunger: p.hunger,
    bag: p.bag.map(i => ({ uid: i.uid, id: i.id, count: i.count, life: i.life, ...(i.attr ? { attr: i.attr, color: i.color } : {}), ...(Number.isFinite(i.x) ? { x: i.x, y: i.y } : {}) })), equip: { ...p.equip },
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
  p.x = p.fx = x; p.y = p.fy = y;
  w.grid.occupy(x, y, p.id);
  p.dead = false;
  p.st = {};
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

