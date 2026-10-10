// Dummy: summon de apoyo ÚNICO del port (INVENTO: no existe en el original; usa el NPC "Dummy" de NPC.cfg y los hechizos de Magic.cfg).
//  - Débil a propósito (companion.statsOf): pocos puntos de vida que casi no suben con el nivel. No ataca; lanza magias útiles.
//  - 3 clases según la primera magia aprendida (talents.js): Healer (verde), Buffer (amarillo), Aura (azul). Una clase por Dummy.
//  - Todo es SOLO para el dueño, su grupo (p.party) y los compañeros de ellos.
//  - Área: radio (Chebyshev) 1 al nivel 1 hasta 6 al 50; hay que acercar al Dummy al grupo. MASS ignora el radio (todo el grupo en el mapa).
//  - Auras: porcentaje proporcional al nivel del Dummy (y al rango); no se lanzan, se aplican cada segundo a quien esté dentro del radio.
//  - Reflejo de agro (npcsys): los monstruos cercanos prefieren al Dummy; el evento "dummy-agro" le hace avisar al dueño.
import { dice } from "../rules.js";
import { sget, sset } from "./status.js";
import * as Tal from "./talents.js";

// Alcance: distancia en línea recta (círculo) a la casilla, como el anillo que se dibuja; el radio crece con el nivel (1 → 6)
export const radiusOf = (lvl, cls) => 1 + Math.round((Math.max(1, lvl) - 1) * 5 / 49) + (cls === "aura" ? 1 : 0);       // el Dummy de aura cubre una casilla más
const cheb = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);                  // (nombre histórico) distancia euclídea en casillas
const inRange = (a, b, r) => cheb(a, b) <= r + 0.5;
// Carisma del dueño: potencia máxima de las curaciones (CHR 10 → ×0,68, 50 → ×1, 100 → ×1,4, tope ×2)
export const chrFactor = chr => Math.min(2, 0.6 + 0.4 * (chr ?? 10) / 50);
const rank = (c, id) => Tal.rankOf(c, id);
// Vampiric Aura (invento): devuelve a quien la recibe ese % del daño que hace (hasta 8 % al nivel 50 con rango 5).
// Porcentajes de aura: crecen con el nivel del Dummy; el rango (1..5) los lleva del 60 % al 100 % del máximo del nivel
const AURA_PER_LEVEL = { dregen: 0.10, dexp: 0.8, ddef: 0.6, dmana: 0.08, dvamp: 0.16, dstam: 0.08 };            // al nivel 50 con rango 5: 5 %/s de vida, 40 % de exp, 30 % menos daño, 4 %/s de maná y de estamina
export const auraPct = (c, id) => { const r = rank(c, id); return r ? Math.round(AURA_PER_LEVEL[id] * c.lvl * (0.5 + 0.1 * r) * 100) / 100 : 0; };
const MASS_CD = 60000, MASS_AURA_MS = 20000;

// Dueño + grupo (mismo mundo) + compañeros de todos ellos
function members(w, m) {
  const out = [m];
  const gid = m.party?.id;
  for (const e of w.ents.values()) {
    if (e.dead || e === m) continue;
    if (e.kind === "player" && gid && e.party?.id === gid) out.push(e);
  }
  const ids = new Set(out.map(e => e.id));
  for (const e of w.ents.values()) if (e.comp && !e.dead && ids.has(e.master) && !e.dummy) out.push(e);
  return out;
}
// Personalidad (invento): aprendiz de paja del Encantador. Nervioso, leal y muy dramático con su cuerpo de paja; presume de lo que hace,
// avisa del peligro y se queja con cariño. Cada frase lleva su versión en español e inglés y el nombre de la magia entre corchetes.
const L = {
  heal: [["¡Aguanta, que te remiendo!", "Hold on, I'll patch you up!"], ["Un poquito de paja y como nuevo.", "A little straw and you're good as new."], ["¡Ya voy, ya voy!", "Coming, coming!"], ["Tranquilo, para eso me hicieron.", "Easy, that's what I was made for."]],
  gheal: [["¡Esto va a doler... a mi paja!", "This is going to hurt... my straw!"], ["¡Toda la paja que tengo para ti!", "All the straw I have, for you!"], ["¡No te me mueras ahora!", "Don't you dare die on me!"]],
  ward: [["¡Escudo arriba, jefe!", "Shield up, boss!"], ["Que no te toquen ni un pelo.", "Not a hair on your head."], ["Te cubro las espaldas.", "I've got your back."]],
  pfm: [["¡Que la magia rebote!", "Let the magic bounce off!"], ["Protección mágica, por si acaso.", "Magic protection, just in case."]],
  berserk: [["¡A darles con todo!", "Hit them with everything!"], ["¡Rabia, rabia, rabia!", "Rage, rage, rage!"]],
  aura: [["Os cuido a todos desde aquí.", "I'll look after you all from here."], ["Mi aura, mi orgullo.", "My aura, my pride."], ["Pegaos a mí, que os protejo.", "Stay close, I'll protect you."]],
  mass: [["¡TODO LO QUE TENGO, AHORA!", "EVERYTHING I'VE GOT, NOW!"], ["¡Vamos todos juntos!", "All together now!"]],
  res: [["¡Levántate, aún no hemos terminado!", "Get up, we're not done yet!"], ["¡De pie, que yo estoy hecho de paja y sigo aquí!", "Up you get, I'm made of straw and I'm still here!"], ["¡Ni se te ocurra quedarte ahí tumbado!", "Don't even think of staying down there!"]],
  danger: [["¡Cuidado! ¡{mn} a la vista!", "Careful! {mn} in sight!"], ["¡Ahí viene un {mn}! ¡Yo no he visto nada!", "Here comes a {mn}! I didn't see anything!"], ["Eh... ¿ese {mn} viene hacia aquí?", "Uh... is that {mn} coming this way?"]],
  hurtAlly: [["¡{who} está fatal! ¡Aguanta!", "{who} is in bad shape! Hang in there!"], ["¡Cuidado con {who}, que no llega!", "Watch {who}, they won't last!"]],
  scared: [["¡Que soy de paja, no me peguen!", "I'm made of straw, don't hit me!"], ["¡Me falta relleno!", "I'm losing my stuffing!"], ["¡Auxilio, me deshilacho!", "Help, I'm unraveling!"]],
  agro: [["¡Me atacan! ¡Me atacan!", "I'm under attack! I'm under attack!"], ["¡Un {mn} me persigue! ¡Mamá!", "A {mn} is chasing me! Mommy!"]],
  idle: [["Qué tranquilo está esto... demasiado.", "So quiet here... too quiet."], ["¿Alguien tiene un cuervo? Me da cosa.", "Anyone seen a crow? They creep me out."], ["Me han dicho que los espantapájaros también tienen sueños.", "I hear scarecrows have dreams too."], ["Aquí me tienes, listo para lo que sea.", "Here I am, ready for anything."]],
  owner_down: [["¡NOOO! ¡Aguanta, voy!", "NOOO! Hold on, I'm coming!"], ["¡Jefe! ¡No te vayas!", "Boss! Don't go!"]],
};
const fmt = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
// Un Dummy dice una frase de su personalidad (y, entre corchetes, la magia o el aura que usa). `force` salta el límite de frecuencia
export function talk(w, n, key, skill, vars = {}, force = false) {
  if (!force && w.time - (n.sayAt || 0) < 1800) return;
  n.sayAt = w.time;
  const [es, en] = L[key][Math.floor(w.rng() * L[key].length)];
  const tag = skill ? " [" + skill + "]" : "";
  w.emit({ t: "dummy-cast", id: n.master, nid: n.id, es: fmt(es, vars) + tag, en: fmt(en, vars) + tag, txt: fmt(es, vars) + tag });
}
const SPELL_NAME = { 1: "Heal", 21: "Great Heal", 13: "Defense Shield", 44: "Great Defense Shield", 33: "Protection From Magic", 50: "Berserk" };
const frac = e => e.hp / Math.max(1, e.maxHp);

function healAmount(w, c, id, rk, m) {
  const sp = w.magic[id];
  return Math.round((dice(w.rng, sp.v4, sp.v5) + sp.v6 + c.lvl) * (1 + 0.25 * (rk - 1)) * chrFactor(m?.stats?.chr));
}
function doHeal(w, n, c, id, who, rk, mult = 1, m = null) {
  const amount = Math.round(healAmount(w, c, id, rk, m) * mult);
  who.hp = Math.min(who.maxHp, who.hp + amount);
  w.emit({ t: "heal", id: who.id, amount, by: n.id });
}

// Estado de un buff en `who`: devuelve true si ya lo tiene (no se repite)
const BUFFS = [
  { tal: "dgward", key: "protect", v: 4, spell: 44, ms: rk => 40000 + 5000 * (rk - 1) },
  { tal: "dward", key: "protect", v: 3, spell: 13, ms: rk => 30000 + 5000 * (rk - 1) },
  { tal: "dpfm", key: "pfm", v: (rk, c) => Math.min(70, Math.round(20 + 6 * rk + c.lvl * 0.3)), spell: 33, ms: rk => 30000 + 4000 * (rk - 1) },
  { tal: "dberserk", key: "berserk", v: 1, spell: 50, ms: rk => 20000 + 3000 * (rk - 1), fight: true },
];
const has = (w, who, b, c) => { const cur = sget(w, who, b.key); return cur >= (typeof b.v === "function" ? b.v(rank(c, b.tal), c) : b.v) - (b.key === "pfm" ? 5 : 0); };
function applyBuff(w, n, c, b, who) {
  const rk = rank(c, b.tal), v = typeof b.v === "function" ? b.v(rk, c) : b.v;
  sset(w, who, b.key, v, b.ms(rk));
  talk(w, n, b.key === "pfm" ? "pfm" : b.key === "berserk" ? "berserk" : "ward", SPELL_NAME[b.spell]);
  Tal.emitCast(w, n, b.spell, who.x, who.y);
}

export const RES_CD = rk => 180000 - 40000 * (rk - 1);
export function raise(w, n, c, who) {
  const rk = rank(c, "dres"), spot = w.grid.free(who.x, who.y, who.id) ? [who.x, who.y] : w.freeSpotNear(who.x, who.y);
  if (!spot) return;
  Tal.pay(w, n, 94, RES_CD(rk));
  n.cd.res = w.time + RES_CD(rk);
  talk(w, n, "res", "Resurrection", {}, true);
  Tal.emitCast(w, n, 94, who.x, who.y);
  who.x = who.fx = spot[0]; who.y = who.fy = spot[1];
  w.grid.occupy(who.x, who.y, who.id);
  who.dead = false; who.st = {};
  who.hp = Math.max(1, Math.round(who.maxHp * (0.4 + 0.1 * rk)));
  w.setAct(who, 0, 0); who.busyUntil = 0;
  w.emit({ t: "respawn", id: who.id, by: n.id });
  w.emit({ t: "resurrected", id: who.id, by: n.id });
}

export function think(w, n, m, c) {
  n.dummy = true;
  n.dcls = c.cls || null;
  if (!c.cls || !w.magic) return;
  const r = radiusOf(c.lvl, c.cls), mem = members(w, m), near = mem.filter(e => inRange(n, e, r));
  const foe = [...w.ents.values()].filter(e => e.kind === "npc" && !e.dead && !e.master && !e.cfg.actionLimit && cheb(n, e) <= 12).sort((a, b) => cheb(n, a) - cheb(n, b))[0], hostiles = !!foe;
  n.cd = n.cd || {};

  // auras: cada segundo, a todos los que estén dentro del radio (mass: doble durante 20 s)
  if (c.cls === "aura" && w.time >= (n.auraAt || 0)) {
    n.auraAt = w.time + 1000;
    const k = w.time < (n.massUntil || 0) ? 2 : 1;
    const sta = auraPct(c, "dstam") * k, vp = auraPct(c, "dvamp") * k, hp = auraPct(c, "dregen") * k, mp = auraPct(c, "dmana") * k, ex = auraPct(c, "dexp") * k, df = Math.min(60, auraPct(c, "ddef") * k);
    if (w.time >= (n.auraSayAt || 0)) {
      n.auraSayAt = w.time + 8000;
      const names = [sta > 0 && "Stamina", vp > 0 && "Vampiric", hp > 0 && "Regeneration", ex > 0 && "Wisdom", df > 0 && "Defense", mp > 0 && "Mana"].filter(Boolean);
      if (names.length) talk(w, n, "aura", names.join(" + ") + " Aura" + (k > 1 ? " x2" : ""), {}, true);
    }
    for (const e of near) {
      if (hp > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + Math.max(1, Math.round(e.maxHp * hp / 100)));
      if (sta > 0 && e.kind === "player" && e.sp < e.maxSp) e.sp = Math.min(e.maxSp, e.sp + Math.max(1, Math.round(e.maxSp * sta / 100)));
      if (mp > 0 && e.kind === "player" && e.mp < e.maxMp) e.mp = Math.min(e.maxMp, e.mp + Math.max(1, Math.round(e.maxMp * mp / 100)));
      if (ex > 0 || df > 0 || vp > 0) e.aura = { exp: ex, def: df, vamp: vp, until: w.time + 2500 };
    }
  }
  // charla (frecuencia limitada): peligro, aliado herido, miedo propio y comentarios en calma
  if (foe && w.time >= (n.dangerAt || 0) && cheb(n, foe) <= 10) { n.dangerAt = w.time + 20000; talk(w, n, "danger", null, { mn: foe.name.replace(/-/g, " ") }); }
  else if (w.time >= (n.hurtSayAt || 0)) { const low = mem.find(e => e !== n && frac(e) < 0.3 && !e.dead); if (low) { n.hurtSayAt = w.time + 12000; talk(w, n, "hurtAlly", null, { who: low.name || "tu aliado" }); } }
  if (n.hp < n.maxHp * 0.35 && w.time >= (n.scaredAt || 0)) { n.scaredAt = w.time + 15000; talk(w, n, "scared"); }
  if (!foe && w.time >= (n.idleAt ??= w.time + 30000 + w.rng() * 30000)) { n.idleAt = w.time + 50000 + w.rng() * 60000; talk(w, n, "idle"); }
  if (w.time - (n.castAt || 0) < Tal.GCD) return;

  // Resurrection (solo el Dummy de aura): levanta a un jugador caído del grupo dentro del radio; la recarga baja con el rango
  if (c.cls === "aura" && rank(c, "dres") && w.time >= (n.cd.res || 0) && n.mp >= Tal.manaOf(w, 94)) {
    const gid = m.party?.id, down = [...w.ents.values()].find(e => e.kind === "player" && e.dead && inRange(n, e, r) && (e === m || (gid && e.party?.id === gid)));
    if (down) { raise(w, n, c, down); return; }
  }

  // MASS (60 s de recarga, a todo el grupo del mapa; cuesta el triple del hechizo base)
  if (w.time >= (n.cd.mass || 0)) {
    if (c.cls === "healer" && rank(c, "dmassh") && mem.filter(e => frac(e) < 0.6).length >= 2 && n.mp >= Tal.manaOf(w, 21) * 3) {
      n.mp -= Tal.manaOf(w, 21) * 2; n.cd.mass = w.time + MASS_CD; n.castAt = w.time;
      talk(w, n, "mass", "MASS Great Heal", {}, true);
      for (const e of mem) { doHeal(w, n, c, 21, e, Math.max(1, rank(c, "dgheal")), 1.2, m); Tal.emitCast(w, n, 21, e.x, e.y); }
      w.emit({ t: "dummy-mass", id: m.id, cls: c.cls });
      return;
    }
    if (c.cls === "buffer" && rank(c, "dmassb") && hostiles && n.mp >= 60) {
      const bs = BUFFS.filter(b => rank(c, b.tal) && (!b.fight || hostiles));
      if (bs.length && mem.filter(e => bs.some(b => !has(w, e, b, c))).length >= 2) {
        n.mp -= 40; n.cd.mass = w.time + MASS_CD; n.castAt = w.time;
        talk(w, n, "mass", "MASS Buff", {}, true);
        for (const e of mem) for (const b of bs) if (!(b.key === "protect" && b.v === 3 && sget(w, e, "protect") >= 4)) applyBuff(w, n, c, b, e);
        w.emit({ t: "dummy-mass", id: m.id, cls: c.cls });
        return;
      }
    }
    if (c.cls === "aura" && rank(c, "dmassa") && hostiles && n.mp >= 40) {
      n.mp -= 30; n.cd.mass = w.time + MASS_CD; n.massUntil = w.time + MASS_AURA_MS; n.castAt = w.time;
      talk(w, n, "mass", "MASS Aura", {}, true);
      Tal.emitCast(w, n, 33, n.x, n.y);
      w.emit({ t: "dummy-mass", id: m.id, cls: c.cls });
      return;
    }
  }

  if (c.cls === "healer") {
    const hurt = near.filter(e => frac(e) < 0.8).sort((a, b) => frac(a) - frac(b))[0];
    if (!hurt) return;
    if (rank(c, "dgheal") && frac(hurt) < 0.45 && Tal.ready(w, n, 21)) { talk(w, n, "gheal", "Great Heal", {}, true); doHeal(w, n, c, 21, hurt, rank(c, "dgheal"), 1, m); Tal.emitCast(w, n, 21, hurt.x, hurt.y); Tal.pay(w, n, 21, 2500); return; }
    if (rank(c, "dheal") && frac(hurt) < 0.75 && Tal.ready(w, n, 1)) { talk(w, n, "heal", "Heal", {}, true); doHeal(w, n, c, 1, hurt, rank(c, "dheal"), 1, m); Tal.emitCast(w, n, 1, hurt.x, hurt.y); Tal.pay(w, n, 1, 2000); }
    return;
  }
  if (c.cls === "buffer" && hostiles) {
    for (const b of BUFFS) {
      if (!rank(c, b.tal) || !Tal.ready(w, n, b.spell)) continue;
      const who = near.find(e => !has(w, e, b, c) && !(b.key === "protect" && b.v === 3 && sget(w, e, "protect") >= 4));
      if (!who) continue;
      applyBuff(w, n, c, b, who); Tal.pay(w, n, b.spell, 2500);
      return;
    }
  }
}

// El Dummy avisa (a su dueño) de que un monstruo lo está atacando; como mucho una vez cada 12 s
export function agroWarn(w, n, monster) {
  if (w.time < (n.agroAt || 0)) return;
  n.agroAt = w.time + 12000;
  talk(w, n, "agro", null, { mn: monster.name.replace(/-/g, " ") }, true);
}

// El dueño ha caído: un Dummy con Resurrection (y listo) se queda a su lado unos segundos para levantarlo. Devuelve true si sigue en pie.
export const RESCUE_MS = 12000;
export function rescue(w, n, m, c) {
  if (c.cls !== "aura" || !rank(c, "dres")) return false;
  n.cd = n.cd || {};
  if (!n.rescueUntil) { n.rescueUntil = w.time + RESCUE_MS; talk(w, n, "owner_down", null, {}, true); }
  if (w.time > n.rescueUntil || w.time < (n.cd.res || 0)) return false;
  if (inRange(n, m, radiusOf(c.lvl, c.cls)) && n.mp >= Tal.manaOf(w, 94)) { raise(w, n, c, m); n.rescueUntil = 0; }
  return true;
}

// ¿Cuánto atrae el Dummy a los monstruos? (npcsys: la distancia se reduce a la mitad)
export const AGRO_FACTOR = 0.5;
// Daño que recibe quien está bajo el aura de defensa (damagePlayer / companionHurt)
export const auraDefense = (w, e) => (e.aura && e.aura.until > w.time ? e.aura.def : 0);
export const auraVamp = (w, e) => (e.aura && e.aura.until > w.time ? e.aura.vamp || 0 : 0);
export const auraExp = (w, e) => (e.aura && e.aura.until > w.time ? e.aura.exp : 0);

// Invocar y mantener a un Dummy exige un báculo (Dummy Enchanter): arma de mano con apariencia 34..39 en Item.cfg (varitas y báculos mágicos).
export const STAFF_MSG = "para invocar a un Dummy necesitas un báculo en la mano";
export const hasStaff = p => { const t = p.eff?.wtype || 0; return t >= 34 && t < 40; };
