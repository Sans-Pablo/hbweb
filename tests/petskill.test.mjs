// Habilidad activa de cada especie de compañero (petskill.js): maná, enfriamiento y efecto en combate.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { killNpc, followersOf, dismissCompanion } from "../web/src/shared/systems/npcsys.js";
import * as C from "../web/src/shared/systems/companion.js";
import { damagePlayer } from "../web/src/shared/systems/combatsys.js";
import { saveOf } from "../web/src/shared/systems/player.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Cazador", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } });
const p = w.ents.get(id); p.level = 30; w.recalc(p);
import { spawnCitizen } from "../web/src/shared/systems/citizens.js";
import { spawnFrom } from "../web/src/shared/systems/npcsys.js";
import { SKILLS } from "../web/src/shared/systems/petskill.js";
for (const sp of Object.keys(C.SPECIES)) if (!["Healer", "Buffer", "Aura"].includes(sp)) assert.ok(SKILLS[sp], "habilidad para " + sp);
const nurse = spawnCitizen(w, C.HOSPITAL.npc, p.x + 2, p.y, C.HOSPITAL.role);
const tick = ms => { for (let i = 0; i < ms / 50; i++) w.tick(50); };
const seen = [];
w.emit = (orig => ev => { if (ev.t === "petskill") seen.push(ev); return orig.call(w, ev); })(w.emit);
for (const sp of ["Giant-Ant", "Stone-Golem", "Skeleton"]) {
  p.gold = 100; w.command(id, { t: "petbuy", npc: nurse.id, sp });
  const ball = p.bag.find(i => i.comp && i.comp.sp === sp && !i.comp.on); ball.comp.lvl = 20;
  p.mp = p.maxMp = 500; w.command(id, { t: "use", uid: ball.uid });
  const pet = followersOf(w, p).find(e => e.comp && e.name === sp); assert.ok(pet, sp + " invocado");
  tick(500); pet.mp = 500; pet.skillAt = 0; pet.maxHp = pet.hp = 5000;
  const foes = [0, 1, 2].map(k => { const n = spawnFrom(w, { name: "Slime", rect: [pet.x + 1, pet.y - 3, pet.x + 4, pet.y + 3], alive: 0, max: 0, respawn: false }); n.hp = n.maxHp = 9999; n.noDrop = true; return n; });
  const before = seen.length;
  for (let i = 0; i < 100 && seen.length === before; i++) { for (const n of foes) if (!n.dead) n.target = pet.id; tick(100); }
  assert.ok(seen.length > before, sp + " usa su habilidad; mp " + pet.mp);
  const ev = seen[seen.length - 1]; assert.equal(ev.skill, SKILLS[sp].name); assert.equal(ev.id, p.id, "lo ve el dueño");
  assert.ok(pet.mp <= 500 - SKILLS[sp].mp + 20, "gasta maná");
  assert.ok(pet.skillAt > w.time, "queda en enfriamiento");
  assert.ok(foes.some(n => n.hp < 9999), "el golpe hiere");
  for (const n of foes) { n.dead = true; w.remove?.(n); }
  dismissCompanion(w, p); p.bag = p.bag.filter(i => !i.comp); p.recalcWeight?.(); w.recalc(p);
}
console.log("OK petskill");
