// Habilidad activa propia de cada especie de compañero (invento del port, 0.76.0). La lanza solo la IA, en combate, cuando hay maná y
// pasó el enfriamiento; gasta el maná del compañero (n.mp, el mismo de los talentos). Sin estado nuevo: n.skillAt (enfriamiento) y n.mp.
//   hit: golpe único (mult × daño)        aoe: daño en área (r casillas alrededor del objetivo)   drain: golpe + cura al compañero
//   dot: veneno (3 golpes seguidos)       guard: escudo propio (cprot)   rage: furia propia (berserk, el golpe vale el doble)
//   mend: cura al propio compañero        leech: golpe + cura al dueño
import { dist } from "../const.js";
import { sset } from "./status.js";

export const SKILLS = {
  "Slime":           { name: "Acid Splash",   kind: "aoe",   mult: 0.8, r: 1, mp: 12, cd: 9000 },
  "Giant-Ant":       { name: "Bite Frenzy",   kind: "hit",   mult: 2.2, mp: 12, cd: 8000 },
  "Amphis":          { name: "Venom Spit",    kind: "dot",   mult: 0.6, mp: 14, cd: 11000 },
  "Orc":             { name: "War Cry",       kind: "rage",  ms: 6000, mp: 16, cd: 20000 },
  "Skeleton":        { name: "Bone Drain",    kind: "drain", mult: 1.3, mp: 14, cd: 10000 },
  "Clay-Golem":      { name: "Harden",        kind: "guard", lvl: 2, ms: 8000, mp: 18, cd: 24000 },
  "Stone-Golem":     { name: "Quake",         kind: "aoe",   mult: 1.0, r: 2, mp: 20, cd: 12000 },
  "Orc-Mage":        { name: "Arcane Bolt",   kind: "hit",   mult: 2.6, mp: 18, cd: 9000 },
  "Hellbound":       { name: "Hellfire",      kind: "aoe",   mult: 1.2, r: 2, mp: 22, cd: 13000 },
  "Cyclops":         { name: "Stomp",         kind: "hit",   mult: 2.5, mp: 20, cd: 10000 },
  "Troll":           { name: "Regenerate",    kind: "mend",  pct: 0.35, mp: 20, cd: 22000 },
  "Orge":            { name: "Smash",         kind: "hit",   mult: 3.2, mp: 24, cd: 12000 },
  "Tentocle":        { name: "Lash",          kind: "aoe",   mult: 0.9, r: 2, mp: 18, cd: 10000 },
  "Cannibal-Plant":  { name: "Devour",        kind: "leech", mult: 1.5, pct: 0.08, mp: 18, cd: 14000 },
  "Demon":           { name: "Inferno",       kind: "aoe",   mult: 1.6, r: 2, mp: 30, cd: 12000 },
  "Frost":           { name: "Ice Storm",     kind: "aoe",   mult: 1.4, r: 3, mp: 30, cd: 12000 },
  "Liche":           { name: "Death Touch",   kind: "drain", mult: 2.0, mp: 28, cd: 11000 },
};

export const skillOf = c => SKILLS[c?.sp] || null;
export const ready = (w, n, s) => !!s && (n.mp || 0) >= s.mp && w.time >= (n.skillAt || 0);

// hurt(w, n, t, dmg): daño a un monstruo con experiencia y botín del compañero (npcsys.petHurt); foes: monstruos hostiles
export function tryUse(w, n, owner, t, c, hurt) {
  const s = skillOf(c);
  if (!s || t.kind !== "npc" || !ready(w, n, s) || dist(n, t) > Math.max(2, n.cfg.attackRange)) return false;
  n.mp -= s.mp; n.skillAt = w.time + s.cd; n.castAt = w.time;
  const base = Math.max(1, Math.round(n.dmgNow || 1)), dmg = Math.max(1, Math.round(base * (s.mult || 1)));
  w.emit({ t: "petskill", id: owner ? owner.id : n.id, nid: n.id, nm: c.nm || c.sp, skill: s.name, kind: s.kind, x: t.x, y: t.y });
  if (s.kind === "hit" || s.kind === "drain" || s.kind === "leech") {
    hurt(w, n, t, dmg, "skill");
    if (s.kind === "drain") heal(w, n, n, dmg);
    if (s.kind === "leech" && owner) heal(w, n, owner, Math.round(owner.maxHp * s.pct));
  } else if (s.kind === "aoe") {
    for (const e of [...w.ents.values()]) if (e.kind === "npc" && !e.dead && !e.master && !(e.cfg.actionLimit && !e.crystal) && dist(e, t) <= s.r) hurt(w, n, e, dmg, "skill");
  } else if (s.kind === "dot") {
    for (let i = 0; i < 3; i++) w.after(900 * (i + 1), () => { if (!n.dead && !t.dead) hurt(w, n, t, dmg, "skill"); });
  } else if (s.kind === "guard") sset(w, n, "cprot", s.lvl, s.ms);
  else if (s.kind === "rage") sset(w, n, "berserk", 1, s.ms);
  else if (s.kind === "mend") heal(w, n, n, Math.round(n.maxHp * s.pct));
  return true;
}

function heal(w, by, who, amount) {
  const g = Math.min(who.maxHp - who.hp, Math.max(0, amount));
  if (g <= 0) return;
  who.hp += g;
  w.emit({ t: "heal", id: who.id, amount: g, by: by.id });
}
