// Misiones del Acto I (v0.63.0). INVENTO del port: el original no tiene líneas de misiones.
// Una línea por clase (guerrero, mago, invocador) de 20 misiones seguidas que acaban en el summon final de la clase
// (guerrero → Demon, mago → Frost, invocador → Liche), todas a nivel 50. Siempre hay una misión activa: el rastreador del HUD muestra el próximo objetivo.
//
//  p.quests = { n, cls, c, b:[b1,b2,b3,b4], tr, u:{crypt,staff,trade}, t:[…] }
//    n    misiones terminadas (la activa es LINE[cls][n]; al acabar la línea sigue el epílogo)
//    c    contador de la misión activa (kill) · b  reyes derrotados por nivel de rey (1..4) · tr  ya se evolucionó un compañero
//    u    permisos: crypt = nivel máximo de cripta al que se puede bajar, staff = el Rey dorado suelta el báculo, trade = se puede evolucionar
//    t    segundos de partida (w.time) en que se terminó cada misión: sirve para medir cuánto cuesta cada una
//  Orden del cliente: { t:"quest", op:"get" } → evento { t:"quest", id, n, total, cur, prog, goal, done:[…] }. Al terminar una misión: { t:"questdone", id, q, rew }.
//
// Objetivos (goal.k): lvl{n} · kill{mon,n} (mon "*" = cualquiera) · kinds{n} (especies distintas) · depth{n} (cripta más honda) · boss{tier,n} ·
//  ek{n} (enemigos del otro reino) · pet{n} (nivel de la bola de la especie de la clase) · staff · trade · final{n} · king{n} (criptas completas) · gold{n}
import * as Inv from "../inventory.js";
import { MAX_LEVEL } from "../levelcap.js";
import { giveExp, expRate } from "./combatsys.js";
import { newInst } from "./itemsys.js";
import { groundPush } from "./ground.js";
import { gold as ledger } from "./ledger.js";

export const CLASS_LINE = { warrior: "warrior", mage: "mage", summoner: "summoner" };
// especie de compañero, báculo y summon final de cada clase
export const PATH = {
  warrior: { sp: "Orc", final: "Demon", staff: 746, family: "fire" },
  mage: { sp: "Tutelary-Angel", final: "Frost", staff: 861, family: "ice" },
  summoner: { sp: "Skeleton", final: "Liche", staff: 865, family: "dark" },
};
export const CRYPT_START = 5;                       // sin misiones solo se baja hasta el rey carmesí (nivel 5)

// ---- objetos de hito (ids 9101..9199, inventados). Reutilizan el aspecto de un objeto de Item.cfg con otro tinte. Sin uso: son llaves y trofeos.
export const ITEMS = {
  9101: { from: 350, name: "Marca de Aprendiz", es: "Prueba de que has sobrevivido al campo.", en: "Proof that you survived the fields.", color: 2 },
  9102: { from: 351, name: "Sello del Osario", es: "Abre las criptas hasta el rey carmesí.", en: "Opens the crypts down to the crimson king.", color: 3 },
  9103: { from: 351, name: "Corazón Carmesí", es: "Trofeo del Rey esqueleto carmesí.", en: "Trophy of the Crimson skeleton king.", color: 4 },
  9104: { from: 358, name: "Llave de Ceniza", es: "Abre las criptas hasta el nivel 10.", en: "Opens the crypts down to level 10.", color: 5 },
  9105: { from: 352, name: "Corazón Umbrío", es: "Trofeo del Rey esqueleto umbrío.", en: "Trophy of the Umbral skeleton king.", color: 6 },
  9106: { from: 358, name: "Llave de Escarcha", es: "Abre las criptas hasta el nivel 15.", en: "Opens the crypts down to level 15.", color: 7 },
  9107: { from: 358, name: "Corazón Glacial", es: "Trofeo del Rey esqueleto glacial.", en: "Trophy of the Glacial skeleton king.", color: 8 },
  9108: { from: 353, name: "Llave Dorada", es: "Abre la cámara del Rey esqueleto dorado.", en: "Opens the chamber of the Golden skeleton king.", color: 9 },
  9109: { from: 352, name: "Collar del Vínculo", es: "Tu compañero ha alcanzado la madurez.", en: "Your companion has come of age.", color: 10 },
  9110: { from: 705, name: "Esencia de Ascensión", es: "Permite a Gail evolucionar a tu compañero.", en: "Lets Gail evolve your companion.", color: 11 },
  9111: { from: 350, name: "Corona del Acto I", es: "Has terminado la primera historia.", en: "You finished the first story.", color: 12 },
  9121: { from: 508, name: "Emblema del Guerrero", es: "Tu camino es el acero.", en: "Your path is steel.", color: 13 },
  9122: { from: 508, name: "Emblema del Mago", es: "Tu camino es el arcano.", en: "Your path is the arcane.", color: 14 },
  9123: { from: 508, name: "Emblema del Invocador", es: "Tu camino es el vínculo.", en: "Your path is the bond.", color: 15 },
};
export const EMBLEM = { warrior: 9121, mage: 9122, summoner: 9123 };

// Añade los objetos de hito al Item.cfg convertido (se llama una vez al construir GameData, junto a applyGear)
export function applyQuestItems(items) {
  for (const [id, m] of Object.entries(ITEMS)) {
    const src = items[m.from]; if (!src) continue;
    items[id] = { ...src, name: m.name.replace(/ /g, ""), display: m.name, type: 5, equipPos: 0, effectType: 0, price: 1, weight: 1, maxLife: 0, levelLimit: 0, category: 31, quest: true, tint: m.color, qdesc: { es: m.es, en: m.en } };
  }
  return items;
}

// ---- misiones. Ver docs/sistemas/quests.md. rew: { gold, exp (% de la experiencia del nivel actual), items:[…], potions }, up: permisos que concede
const T = (es, en) => ({ es, en });
function build(cls) {
  const P = PATH[cls], sp = P.sp, fin = P.final;
  const speciesName = { Orc: T("Orco", "Orc"), "Tutelary-Angel": T("Ángel tutelar", "Tutelary Angel"), Skeleton: T("Esqueleto", "Skeleton") }[sp] || T(sp, sp);
  const finalName = { Demon: T("Demon", "Demon"), Frost: T("Frost", "Frost"), Liche: T("Liche", "Lich") }[fin] || T(fin, fin);
  const warrior = cls === "warrior", mage = cls === "mage";
  const Q = (id, ch, title, text, goal, rew = {}, up = null) => ({ id: cls + "." + id, ch, title, text, goal, rew, up });
  return [
    // Capítulo 1 · Despertar (1-12)
    Q("slime", 1, T("Primera sangre", "First blood"), T("Gandlf quiere ver qué sabes hacer. Limpia el campo de limos antes de bajar a las criptas.", "Gandlf wants to see what you can do. Clear the fields of slimes before heading for the crypts."),
      { k: "kill", mon: "Slime", n: warrior ? 40 : 30 }, { gold: 300, items: [EMBLEM[cls]], potions: 3 }),
    Q("lv8", 1, T("Aprendiz del campo", "Field apprentice"), T("Los limos son sólo el principio. Sigue cazando hasta el nivel 8.", "Slimes are only the start. Keep hunting until level 8."),
      { k: "lvl", n: 8 }, { gold: 400, items: [101] }),
    Q("kinds", 1, T("Conoce a tu enemigo", "Know your enemy"), T("Hormigas, escorpiones, anfibios, golems… Derrota a cinco especies distintas.", "Ants, scorpions, amphibians, golems… Defeat five different species."),
      { k: "kinds", n: 5 }, { gold: 600, exp: 6, items: [9101] }),
    // Capítulo 2 · El osario (13-30)
    Q("depth3", 2, T("La puerta del osario", "The ossuary gate"), T("Bajo las ruinas duermen los muertos de una batalla antigua. Desciende hasta el nivel 3 de la cripta.", "The dead of an ancient battle sleep beneath the ruins. Descend to crypt level 3."),
      { k: "depth", n: 3 }, { gold: 800 }),
    Q("lv16", 2, T("Sangre fría", "Cold blood"), T("La cripta no perdona a los novatos. Alcanza el nivel 16.", "The crypt forgives no rookies. Reach level 16."),
      { k: "lvl", n: 16 }, { gold: 1200, exp: 5 }),
    Q("king1", 2, T("El Rey carmesí", "The Crimson King"), T("En el nivel 5 espera el primero de los cuatro reyes esqueleto. Derrótalo.", "On level 5 waits the first of the four skeleton kings. Defeat him."),
      { k: "boss", tier: 1, n: 1 }, { gold: 2000, exp: 8, items: [9103, 9102] }, { crypt: 10 }),
    Q("bones", 2, T("Hueste de huesos", "Host of bones"), T("Los esqueletos no dejan de levantarse. Destruye 150 de ellos.", "The skeletons keep rising. Destroy 150 of them."),
      { k: "kill", mon: "Skeleton", n: warrior ? 220 : 150 }, { gold: 2500, exp: 6 }),
    Q("lv24", 2, T("Veterano", "Veteran"), T("Alcanza el nivel 24.", "Reach level 24."), { k: "lvl", n: 24 }, { gold: 3000, exp: 5, potions: 5 }),
    // Capítulo 3 · Sombras (31-48)
    Q("king2", 3, T("El Rey umbrío", "The Umbral King"), T("Con la llave de ceniza, baja al nivel 10 y derrota al Rey esqueleto umbrío.", "With the ash key, go down to level 10 and defeat the Umbral skeleton king."),
      { k: "boss", tier: 2, n: 1 }, { gold: 4000, exp: 8, items: [9105, 9104] }, { crypt: 15 }),
    Q("war", 3, T("Sangre enemiga", "Enemy blood"), T("Aresden y Elvine llevan siglos en guerra. Derrota a enemigos del otro reino.", "Aresden and Elvine have fought for centuries. Defeat enemies of the other kingdom."),
      { k: "ek", n: warrior ? 15 : 8 }, { gold: 3500, exp: 6 }),
    Q("lv32", 3, T("Curtido en batalla", "Battle-hardened"), T("Alcanza el nivel 32.", "Reach level 32."), { k: "lvl", n: 32 }, { gold: 4500, exp: 5 }),
    // Capítulo 4 · El vínculo (49-70)
    Q("bond", 4, T("Un amigo fiel", "A faithful friend"), T("Gail guarda las bolas de los compañeros. Consigue un " + speciesName.es + " y llévalo al nivel 25.", "Gail keeps the companion balls. Get a " + speciesName.en + " and raise it to level 25."),
      { k: "pet", n: 25 }, { gold: 5000, exp: 6, items: [9109] }),
    Q("king3", 4, T("El Rey glacial", "The Glacial King"), T("Más allá del nivel 15 el frío mata. Derrota al Rey esqueleto glacial dos veces.", "Beyond level 15 the cold kills. Defeat the Glacial skeleton king twice."),
      { k: "boss", tier: 3, n: 2 }, { gold: 7000, exp: 8, items: [9107, 9106] }, { crypt: 20 }),
    Q("lv40", 4, T("Más allá de la leyenda", "Beyond legend"), T("Alcanza el nivel 40.", "Reach level 40."), { k: "lvl", n: 40 }, { gold: 8000, exp: 4 }),
    Q("lv50", 4, T("Maestría", "Mastery"), T("El nivel máximo del servidor. Llega al nivel " + MAX_LEVEL + ".", "The server level cap. Reach level " + MAX_LEVEL + "."), { k: "lvl", n: MAX_LEVEL }, { gold: 15000, potions: 10, items: [9108] }, { staff: 1 }),
    Q("bond50", 4, T("Vínculo supremo", "Supreme bond"), T("Tu " + speciesName.es + " debe llegar al nivel 50 para poder evolucionar.", "Your " + speciesName.en + " must reach level 50 to evolve."),
      { k: "pet", n: 50 }, { gold: 10000 }),
    // Capítulo 5 · Ascensión (71-100)
    Q("king4", 5, T("El Rey dorado", "The Golden King"), T("El último rey guarda " + ({ fire: "el Hero Staff", ice: "la Ice Wand", dark: "el Darkness Staff" }[P.family]) + ". Derrótalo y quédate con su báculo.", "The last king guards the " + ({ fire: "Hero Staff", ice: "Ice Wand", dark: "Darkness Staff" }[P.family]) + ". Defeat him and take his staff."),
      { k: "staff" }, { gold: 20000, exp: 4 }, { trade: 1 }),
    Q("evolve", 5, T("Ascensión", "Ascension"), T("Pídele a Gail que evolucione a tu " + speciesName.es + " en " + finalName.es + ". Se pierde el nivel, no el vínculo.", "Ask Gail to evolve your " + speciesName.en + " into a " + finalName.en + ". The level is lost, not the bond."),
      { k: "trade" }, { gold: 5000, items: [9110] }),
    Q("final", 5, T("La forma final", "The final form"), T("Invoca a tu " + finalName.es + " con el báculo en la mano y llévalo al nivel 50.", "Summon your " + finalName.en + " with the staff in hand and raise it to level 50."),
      { k: "final", n: 50 }, { gold: 50000, items: [9111] }),
    // Epílogo: siempre queda un objetivo (acto II aún por escribir)
    Q("e1", 6, T("Cazarreyes", "Kingslayer"), T("Completa la cripta entera cinco veces.", "Clear the whole crypt five times."), { k: "king", n: 5 }, { gold: 30000 }),
    Q("e2", 6, T("Plaga de huesos", "Bone plague"), T("Destruye 1.500 esqueletos.", "Destroy 1,500 skeletons."), { k: "kill", mon: "Skeleton", n: 1500 }, { gold: 40000 }),
    Q("e3", 6, T("Leyenda de dos reinos", "Legend of two kingdoms"), T("Derrota a 100 enemigos del otro reino. El Acto II llegará.", "Defeat 100 enemies of the other kingdom. Act II is coming."), { k: "ek", n: 100 }, { gold: 100000 }),
  ];
}
export const LINES = Object.fromEntries(Object.keys(PATH).map(c => [c, build(c)]));
export const TOTAL = cls => (LINES[cls] || LINES.warrior).length;
export const ACT1_END = 19;                              // las 19 primeras misiones son el Acto I; el resto es epílogo
export const lineOf = p => LINES[p.quests?.cls || p.cls] || LINES.warrior;

// ---- estado
const fresh = cls => ({ n: 0, cls: LINES[cls] ? cls : "warrior", c: 0, d: 0, b: [0, 0, 0, 0], tr: 0, u: { crypt: CRYPT_START, staff: 0, trade: 0 }, t: [] });
export function init(p) { p.quests = fresh(p.cls); }
export function restore(p, s) {
  const q = s.quests;
  if (!q || typeof q !== "object") return;
  const cls = LINES[q.cls] ? q.cls : (LINES[p.cls] ? p.cls : "warrior"), z = fresh(cls);
  z.n = Math.max(0, Math.min(TOTAL(cls), q.n | 0)); z.c = Math.max(0, q.c | 0); z.d = Math.max(0, Math.min(20, q.d | 0)); z.tr = q.tr ? 1 : 0;
  if (Array.isArray(q.b)) z.b = [0, 1, 2, 3].map(i => Math.max(0, q.b[i] | 0));
  if (q.u) { z.u.crypt = Math.max(CRYPT_START, Math.min(20, q.u.crypt | 0)); z.u.staff = q.u.staff ? 1 : 0; z.u.trade = q.u.trade ? 1 : 0; }
  if (Array.isArray(q.t)) z.t = q.t.slice(0, 40).map(x => +x || 0);
  p.quests = z;
}
export const toSave = p => (p.quests ? { n: p.quests.n, cls: p.quests.cls, c: p.quests.c, d: p.quests.d, b: [...p.quests.b], tr: p.quests.tr, u: { ...p.quests.u }, t: [...p.quests.t] } : undefined);
const Qs = p => p.quests || (p.quests = fresh(p.cls));

// ---- permisos
export const cryptCap = p => Qs(p).u.crypt;
export const canTrade = p => !!Qs(p).u.trade;
export const dropsStaff = p => !!Qs(p).u.staff && Qs(p).n <= 16;               // el báculo solo cae mientras no se haya cumplido «El Rey dorado»

// ---- progreso
const ballLevel = (p, sp) => Math.max(0, ...p.bag.filter(i => i.comp && i.comp.sp === sp).map(i => i.comp.lvl | 0));
const hasStaff = p => { const s = PATH[Qs(p).cls]; return p.bag.some(i => i.id === s.staff); };
export function progress(p, g) {
  const q = Qs(p), P = PATH[q.cls];
  switch (g.k) {
    case "lvl": return [p.level | 0, g.n];
    case "kill": return [q.c | 0, g.n];
    case "kinds": return [Object.keys(p.kinds || {}).length, g.n];
    case "depth": return [Math.max(q.d | 0, p.delve?.deepest | 0), g.n];       // q.d: «reiniciar la cripta» baja delve.deepest a 1 pero el logro se conserva
    case "boss": return [q.b.slice(g.tier - 1).reduce((a, b) => a + b, 0), g.n];
    case "ek": return [p.ek | 0, g.n];
    case "pet": return [ballLevel(p, P.sp), g.n];
    case "staff": return [hasStaff(p) ? 1 : 0, 1];
    case "trade": return [q.tr ? 1 : 0, 1];
    case "final": return [ballLevel(p, P.final), g.n];
    case "king": return [p.delve?.king | 0, g.n];
    case "gold": return [p.gold | 0, g.n];
  }
  return [0, 1];
}
const current = p => lineOf(p)[Qs(p).n] || null;
export const isDone = (p, g) => { const [a, b] = progress(p, g); return a >= b; };

function grantItem(w, p, id) {
  if (!w.data.item(id)) return;
  const inst = newInst(w, id, 1);
  if (p.bag.length < 50) Inv.addToBag(p, w.data, inst); else groundPush(w, p.x, p.y, inst);
}
function reward(w, p, r) {
  if (r.gold) ledger(w, p, r.gold, "quest_reward");
  for (const id of r.items || []) grantItem(w, p, id);
  const red = w.data.named("RedPotion"), blue = w.data.named("BluePotion");
  for (let k = 0; red && k < (r.potions | 0); k++) { grantItem(w, p, red.id); if (blue) grantItem(w, p, blue.id); }
  if (r.exp) giveExp(w, p, Math.ceil(p.nextExp * r.exp / 100 / Math.max(0.02, expRate(p.level))));
}

// Avanza todas las misiones cuyo objetivo ya se cumple (también encadena las que ya estaban hechas, p. ej. partidas antiguas)
export function check(w, p) {
  const q = Qs(p); let moved = false;
  if (p._qbusy) return false;                                      // la recompensa (objeto, experiencia) vuelve a llamar a check: sin esto la misma misión se cobraría varias veces
  p._qbusy = true;
  try {
    for (let guard = 0; guard < 30; guard++) {
      const cur = current(p); if (!cur || !isDone(p, cur.goal)) break;
      q.t[q.n] = Math.round(w.time / 1000); q.n++; q.c = 0; moved = true;          // primero se avanza, luego se paga
      if (cur.up) for (const k in cur.up) q.u[k] = Math.max(q.u[k] | 0, cur.up[k]);
      reward(w, p, cur.rew);
      w.emit({ t: "questdone", id: p.id, q: cur.id, n: q.n, rew: cur.rew });
    }
  } finally { p._qbusy = false; }
  if (moved) { w.recalc(p); announce(w, p); }
  return moved;
}
export function announce(w, p) {
  const q = Qs(p), cur = current(p), pr = cur ? progress(p, cur.goal) : [0, 0];
  w.emit({ t: "quest", id: p.id, n: q.n, total: TOTAL(q.cls), cur: cur?.id || null, prog: pr, goal: cur?.goal || null, u: { ...q.u } });
}

// ---- ganchos de la simulación
export function onKill(w, p, n) {
  if (!p || p.kind !== "player" || n.comp || n.master) return;
  const q = Qs(p), cur = current(p);
  if (n.boss && !n.aux && !n.clone) q.b[Math.min(4, n.boss) - 1]++;
  if (cur?.goal.k === "kill" && (cur.goal.mon === "*" || cur.goal.mon === n.name) && !n.noDrop) q.c++;
  w.after?.(300, () => check(w, p));
}
export function onLevel(w, p) { check(w, p); }
export function onDepth(w, p, level) { const q = Qs(p); if (level > (q.d | 0)) { q.d = level; check(w, p); } }
export function onPet(w, p) { check(w, p); }
export function onTrade(w, p) { const q = Qs(p); q.tr = 1; check(w, p); }
export function onPickup(w, p) { check(w, p); }

// El Rey esqueleto dorado suelta el báculo maestro de la clase del que lo derrota (solo mientras toque). Se llama desde npcsys.killNpc.
export function bossStaff(w, p, n) {
  if (!p || p.kind !== "player" || n.boss !== 4 || n.aux || n.clone || !dropsStaff(p)) return 0;
  const id = PATH[Qs(p).cls].staff;
  return w.data.item(id) && !hasStaff(p) ? id : 0;
}

export function command(w, p, cmd) {
  switch (cmd.op) {
    case "get": check(w, p); announce(w, p); return true;
  }
  return w.reject(p, cmd, "orden de misión desconocida");
}
