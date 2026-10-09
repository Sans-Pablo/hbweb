// Mecánicas únicas de los 4 jefes de la cripta (shared/systems/bosses.js). node tests/bosses.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import * as B from "../web/src/shared/systems/bosses.js";
import { sget } from "../web/src/shared/systems/status.js";
import { dist } from "../web/src/shared/const.js";

const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const farm = new Uint8Array(readFileSync(new URL("arefarm.bin", dir)));

function setup(level) {
  const a = new Adventure({ grid: new Grid(meta.w, meta.h, farm), start: meta.start, npcDb, data, spawns: [], maps: {}, rng: seededRandom(7 + level) });
  const id = a.addPlayer("jefe" + level), p = a.farm.ents.get(id);
  assert.ok(a.command(id, { t: "dbg", op: "crypt", level }), "entra en el nivel " + level);
  const w = a.worldFor(id);
  const boss = [...w.ents.values()].find(e => e.boss && e.kind === "npc");
  assert.ok(boss && boss.boss === level / 5, "hay jefe " + level / 5);
  p.hp = p.maxHp = 1e6;
  for (const e of w.ents.values()) if (e.kind === "npc" && e !== boss) { e.hp = e.maxHp = 1; }
  const near = (d = 3) => { const s = w.freeSpotNear(boss.x + d, boss.y, 4); w.grid.release(p.x, p.y, p.id); p.x = p.fx = s[0]; p.y = p.fy = s[1]; w.grid.occupy(p.x, p.y, p.id); };
  near();
  return { a, id, p, w, boss, near, tick: ms => { for (let i = 0; i < ms / 50; i++) { a.tick(50); if (!p.dead) { p.hp = p.maxHp; } } } };
}
const zonesOf = (w, k) => (w.bfx || []).filter(z => z.kind === k);
const auxOf = (w, boss, f) => [...w.ents.values()].filter(e => e.owner === boss.id && !e.dead && (!f || e[f]));

// ---- 1 carmesí: furia, rugido, brasas, huesos
{
  const { w, boss, p, tick, near } = setup(5);
  assert.equal(B.speedFactor(boss), 1);
  boss.hp = Math.floor(boss.maxHp * 0.49); near(3);
  tick(200);
  assert.ok(sget(w, p, "hold"), "el rugido aturde al 50 %");
  assert.ok(B.speedFactor(boss) < 0.8, "con la mitad de vida ataca más rápido");
  const bones = auxOf(w, boss, "heals"); assert.equal(bones.length, 6, "3 huesos por cada 20 % perdido (80 % y 60 %)");
  assert.ok(bones.every(e => w.killNpc && e.maxHp < boss.maxHp / 10));
  const hp0 = boss.hp; w.killNpc(bones[0], null); assert.ok(boss.hp > hp0, "un hueso muerto cura al jefe");
  tick(15000);
  assert.ok(zonesOf(w, "ember").length > 0 || zonesOf(w, "warn").length > 0, "brasas bajo el jugador");
  boss.hp = boss.maxHp; boss.dead = false;
}
// ---- 2 umbrío: clones, salto, drenaje
{
  const { w, boss, p, tick, near } = setup(10);
  boss.hp = Math.floor(boss.maxHp * 0.74); tick(100);
  const cl = auxOf(w, boss, "clone"); assert.equal(cl.length, 2, "2 clones al 75 %");
  assert.ok(boss.hasClones);
  assert.equal(B.mitigate(w, boss, 100, p), 35, "el real recibe el 35 %");
  assert.equal(B.mitigate(w, cl[0], 100, p), 100, "el clon recibe todo");
  for (const c of cl) w.killNpc(c, null);
  tick(100);
  assert.equal(B.mitigate(w, boss, 100, p), 100, "sin clones, daño completo");
  // salto a la espalda
  let jumped = false; const start = [boss.x, boss.y];
  for (let i = 0; i < 400 && !jumped; i++) { tick(50); near(6); if (Math.abs(boss.x - start[0]) + Math.abs(boss.y - start[1]) > 6 || zonesOf(w, "blink").length) jumped = true; }
  assert.ok(jumped, "salta junto al jugador");
  // drenaje (sin compañero: al jugador)
  let drained = false;
  for (let i = 0; i < 600 && !drained; i++) { tick(50); near(2); if (zonesOf(w, "drain").length) drained = true; }
  assert.ok(drained, "marca y drena");
}
// ---- 3 glacial: escudo con cristales, suelo helado, congelación
{
  const { w, boss, p, tick, near } = setup(15);
  boss.hp = Math.floor(boss.maxHp * 0.79); tick(100);
  const cr = auxOf(w, boss, "crystal"); assert.equal(cr.length, 3, "3 cristales al 80 %");
  assert.ok(boss.shield && B.mitigate(w, boss, 500, p) === 0, "escudo: inmune");
  assert.ok(cr.every(c => c.maxHp < boss.maxHp / 20));
  for (const c of cr.slice(0, 2)) w.killNpc(c, null);
  assert.ok(boss.shield, "con un cristal vivo sigue el escudo");
  w.killNpc(cr[2], null);
  assert.ok(!boss.shield && B.mitigate(w, boss, 500, p) === 500, "sin cristales se rompe");
  let frosted = false, held = false;
  for (let i = 0; i < 700 && !(frosted && held); i++) { tick(50); near(2); if (zonesOf(w, "frost").length) { const z = zonesOf(w, "frost")[0]; if (Math.abs(p.x - z.x) <= z.r && Math.abs(p.y - z.y) <= z.r) frosted = p.chillUntil > w.time || frosted; } if (sget(w, p, "hold")) held = true; }
  assert.ok(frosted, "el suelo helado ralentiza");
  assert.ok(held, "congelación del jugador sin compañero");
}
// ---- 4 dorado: furia, reflejo, fases, oro
{
  const { w, boss, p, tick, near, a, id } = setup(20);
  const base = boss.dmgBase ?? (boss.dmgMul || 1);
  tick(100);
  const d0 = boss.dmgMul;
  for (let i = 0; i < 3; i++) B.onBossHit(w, boss);
  tick(100);
  assert.ok(boss.dmgMul > d0 && boss.wrath === 3, "cada golpe recibido sube su daño");
  p.hp = p.maxHp = 1000; const before = p.hp;
  assert.equal(B.mitigate(w, boss, 100, p, "spell"), 100);
  assert.ok(p.hp < before, "refleja hechizos");
  const h = p.hp; B.mitigate(w, boss, 100, p, "hit"); assert.equal(p.hp, h, "los golpes no se reflejan");
  boss.hp = Math.floor(boss.maxHp * 0.5); tick(100);
  assert.equal(boss.bm.ph, 2, "fase 2");
  boss.hp = Math.floor(boss.maxHp * 0.3); tick(100);
  assert.equal(boss.bm.ph, 3, "fase 3");
  boss.hp = Math.floor(boss.maxHp * 0.19); tick(100);
  assert.ok(boss.shield, "escudo de hielo al 20 %");
  for (const c of auxOf(w, boss, "crystal")) w.killNpc(c, null);
  boss.wrath = 10;
  boss.hp = 1; w.killNpc(boss, p); tick(2000);
  assert.ok(auxOf(w, boss).length === 0, "los auxiliares mueren con el jefe");
  const gold = [...w.items.values()].flat().find(i => data.item(i.id)?.name === "Gold");
  assert.ok(gold && gold.count >= 20 * 400 * 2, "oro extra por el contador: " + gold?.count);
}
console.log("OK");
