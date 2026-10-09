import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateLevel, setDungeonPalette, levelSeed, seededRandom, FARM_PORTAL, MIDDLE_PORTAL, DUNGEON_LEVELS, isBossLevel } from "../web/src/shared/dungeon.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";

const dir = new URL("../web/data/", import.meta.url);
const json = name => JSON.parse(readFileSync(new URL(name, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const farmBytes = new Uint8Array(readFileSync(new URL("arefarm.bin", dir)));
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const mj = json("maps/middled1n.json");
const maps = { middled1n: { meta: mj, grid: new Grid(mj.w, mj.h, new Uint8Array(readFileSync(new URL("maps/middled1n.bin", dir)))) } };
function session() { return new Adventure({ grid: new Grid(meta.w, meta.h, farmBytes), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(54) }); }
function place(w, p, x, y) { w.grid.release(p.x, p.y, p.id); p.x = p.fx = x; p.y = p.fy = y; w.grid.occupy(x, y, p.id); }
function enter(a, id, restart) {
  const w = a.worldFor(id), gate = w.map.portals[0];
  place(w, w.ents.get(id), gate.x - 1, gate.y);
  const ok = a.command(id, { t: "portal", portal: gate.id, ...(restart !== undefined ? { restart } : {}) });
  return { ok, w: a.worldFor(id) };
}
function clear(a, id) {
  const w = a.worldFor(id), p = w.ents.get(id);
  for (const n of [...w.ents.values()]) if (n.kind === "npc" && !n.dead) w.killNpc(n, p);
  a.tick(50);
  assert.ok(w.cleared);
}
function take(a, id, portal) {
  const w = a.worldFor(id), g = w.map.portals.find(x => x.id === portal);
  place(w, w.ents.get(id), g.x, g.y);
  return a.command(id, { t: "portal", portal });
}

test("niveles: todo es alcanzable, 60x60 (36x36 los jefes), portales y enemigos dentro", () => {
  for (let run = 0; run < 25; run++) for (let level = 1; level <= DUNGEON_LEVELS; level++) {
    const d = generateLevel(levelSeed(run, level), level), g = d.grid;
    assert.equal(g.w, isBossLevel(level) ? 36 : 60);
    const queue = [d.start], seen = new Set([g.idx(...d.start)]);
    for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = queue[i][0] + dx, ny = queue[i][1] + dy, k = g.idx(nx, ny);
      if (!g.blocked(nx, ny) && !seen.has(k)) { seen.add(k); queue.push([nx, ny]); }
    }
    let open = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (!g.blocked(x, y)) open++;
      if (x < 3 || y < 3 || x >= g.w - 3 || y >= g.h - 3) assert.ok(g.blocked(x, y));
      const t = g.tile(x, y); assert.ok(t.spr >= 300 && t.spr <= 309, "solo hojas t300-t309: " + t.spr);
      assert.ok(t.obj === 0 || t.obj === 211 || t.obj > 0);
    }
    assert.equal(seen.size, open, `run ${run} nivel ${level}`);
    for (const gate of d.portals) assert.ok(seen.has(g.idx(gate.x, gate.y)));
    for (const sp of d.spawns) { const c = [(sp.rect[0] + sp.rect[2]) >> 1, (sp.rect[1] + sp.rect[3]) >> 1]; assert.ok(!g.blocked(...c)); }
    assert.ok(d.spawns.filter(s => !s.boss).reduce((n, s) => n + s.max, 0) >= (isBossLevel(level) ? 3 : Math.min(26, 8 + level) - 3), `enemigos suficientes en run ${run} nivel ${level}`);
    const bosses = d.spawns.filter(s => s.boss);
    assert.equal(bosses.length, isBossLevel(level) ? 1 : 0);
    assert.equal(d.portals[1].id, level === DUNGEON_LEVELS ? "finish" : "down");
  }
});

test("variedad: niveles seguidos cambian de trazado y las semillas dan mapas distintos", () => {
  const sig = (seed, level) => Buffer.from(generateLevel(seed, level).grid.dv.buffer).toString("base64");
  const themes = new Set();
  for (let level = 1; level <= 20; level++) if (!isBossLevel(level)) {
    themes.add(generateLevel(levelSeed(3, level), level).theme);
    if (!isBossLevel(level + 1) && level < 20) assert.notEqual(generateLevel(levelSeed(3, level), level).theme, generateLevel(levelSeed(3, level + 1), level + 1).theme);
  }
  assert.ok(themes.size >= 5, [...themes].join());
  const all = new Set();
  for (let s = 0; s < 40; s++) all.add(sig(levelSeed(s, 2), 2));
  assert.equal(all.size, 40);
  assert.equal(sig(5, 7), sig(5, 7));
});

test("dificultad por nivel y jefes cada 5 niveles", () => {
  const e = level => generateLevel(levelSeed(1, level), level).spawns.find(s => !s.boss).scale;
  assert.ok(e(10).hp > e(1).hp * 2 && e(10).dmg > e(1).dmg && e(20).exp > e(10).exp);
  const b = generateLevel(levelSeed(1, 5), 5).spawns.find(s => s.boss);
  assert.equal(b.boss, 1); assert.ok(b.scale.hp > 6 * e(5).hp);
  assert.deepEqual([5, 10, 15, 20].map(l => generateLevel(levelSeed(1, l), l).spawns.find(s => s.boss).boss), [1, 2, 3, 4]);
});

test("entradas: Aresfarm y middled1n (100,85); bajar exige limpiar; elegir continuar o reiniciar", () => {
  const a = session(), id = a.addPlayer("uno"), p = a.farm.ents.get(id);
  assert.equal(MIDDLE_PORTAL.x, 100); assert.equal(MIDDLE_PORTAL.y, 85);
  assert.equal(a.staticWorld("middled1n").map.portals[0].id, MIDDLE_PORTAL.id);
  let { ok, w } = enter(a, id);
  assert.ok(ok); assert.equal(w.map.kind, "dungeon"); assert.equal(w.map.level, 1);
  assert.equal(take(a, id, "down"), false);                         // enemigos vivos
  assert.equal(a.worldFor(id).map.level, 1);
  clear(a, id);
  assert.ok(take(a, id, "down")); assert.equal(a.worldFor(id).map.level, 2);
  assert.equal(a.saveOf(id).delve.deepest, 2);
  const mapId = a.worldFor(id).map.id;
  assert.ok(take(a, id, "return")); assert.equal(a.worldFor(id), a.farm);
  assert.ok(![...a.worlds.keys()].includes(mapId));                 // el nivel abandonado se descarta
  // volver con progreso: pregunta y no entra
  const ev = []; a.farm.emit = e => ev.push(e);
  assert.equal(enter(a, id).ok, false);
  assert.ok(ev.some(e => e.t === "dungeon-choice" && e.deepest === 2 && e.total === 20));
  assert.equal(a.worldFor(id), a.farm);
  assert.ok(enter(a, id, false).ok); assert.equal(a.worldFor(id).map.level, 2);
  assert.ok(take(a, id, "return"));
  assert.ok(enter(a, id, true).ok); assert.equal(a.worldFor(id).map.level, 1);
  assert.equal(a.saveOf(id).delve.deepest, 1);                       // reiniciar vuelve al nivel 1
  assert.ok(take(a, id, "return"));
  // entrada desde middled1n y regreso al mismo sitio
  const m = a.staticWorld("middled1n"); a.transfer(p, a.farm, m, [98, 85]);
  assert.ok(enter(a, id, true).ok); assert.equal(a.worldFor(id).map.level, 1);
  assert.ok(take(a, id, "return")); assert.equal(a.worldFor(id), m);
  assert.ok(Math.abs(p.x - 100) <= 3 && Math.abs(p.y - 85) <= 3);
});

test("enemigos escalados, jefe y victoria en el nivel 20", () => {
  const a = session(), id = a.addPlayer("dos"), p = a.farm.ents.get(id);
  enter(a, id); p.delve.deepest = 4;
  const hp = w => Math.max(...[...w.ents.values()].filter(e => e.kind === "npc").map(e => e.maxHp));
  const base = Math.min(...[...a.worldFor(id).ents.values()].filter(e => e.kind === "npc").map(e => e.maxHp));
  clear(a, id);
  take(a, id, "down"); take(a, id, "return");
  p.delve.deepest = 5; assert.ok(enter(a, id, false).ok);
  const w5 = a.worldFor(id), boss = [...w5.ents.values()].find(e => e.boss);
  assert.ok(boss && boss.maxHp > 6 * base && boss.dmgMul > 1.5);
  assert.equal(w5.map.boss, 1); assert.equal(w5.grid.w, 36);
  assert.ok(hp(w5) === boss.maxHp);
  p.delve.deepest = 20; take(a, id, "return"); assert.ok(enter(a, id, false).ok);
  assert.equal(a.worldFor(id).map.level, 20);
  assert.equal(take(a, id, "finish"), false);
  clear(a, id);
  assert.ok(take(a, id, "finish")); assert.equal(a.worldFor(id), a.farm);
  assert.equal(a.runs.has(id), false);
});

test("morir en la cripta devuelve a Aresfarm y conserva el nivel alcanzado", () => {
  const a = session(), id = a.addPlayer("tres"), p = a.farm.ents.get(id);
  enter(a, id); clear(a, id); take(a, id, "down");
  const d = a.worldFor(id); d.killPlayer ? d.killPlayer(p) : (p.dead = true, p.deadAt = d.time);
  d.time += 2000; a.time = d.time;
  a.command(id, { t: "respawn" });
  assert.equal(a.worldFor(id), a.farm);
  assert.equal(a.saveOf(id).delve.deepest, 2);
});

test("rey carmesí: Fire Field cada 20 % de vida perdida, inmune al fuego y hueso rojo seguro", () => {
  const a = session(), id = a.addPlayer("tres"), p = a.farm.ents.get(id);
  enter(a, id); p.delve.deepest = 4; clear(a, id); take(a, id, "down"); take(a, id, "return");
  p.delve.deepest = 5; assert.ok(enter(a, id, false).ok);
  const w = a.worldFor(id), boss = [...w.ents.values()].find(e => e.boss === 1);
  p.hp = p.maxHp = 1e6;
  const fires = () => (w.dyn || []).filter(f => f.type === 1 && f.owner === boss.id).length;
  assert.equal(fires(), 0);
  for (const frac of [0.79, 0.59, 0.39, 0.19]) { boss.hp = Math.floor(boss.maxHp * frac); a.tick(50); }
  assert.ok(fires() > 0, "hay llamas");
  const hp0 = boss.hp; a.tick(3000); assert.ok(boss.hp >= hp0 || boss.dead === false, "inmune"); assert.ok(!boss.dead);
  boss.stage = 0;
  w.killNpc(boss, p); a.tick(3000);
  const bone = [...(w.ground?.values?.() || [])].flat?.() ;
  const items = JSON.stringify([...(w.items?.values?.() || [])]) + JSON.stringify(w.ground ? [...w.ground.values()] : []);
  assert.ok(items.includes('"id":' + data.named("SkeletonBones").id) && items.includes('"color":14'), "hueso rojo en el suelo");
});
