import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateDungeon, FARM_PORTAL, seededRandom } from "../web/src/shared/dungeon.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { findPath } from "../web/src/shared/path.js";
import { damagePlayer } from "../web/src/shared/systems/combatsys.js";

const dir = new URL("../web/data/", import.meta.url);
const json = name => JSON.parse(readFileSync(new URL(name, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const farmBytes = new Uint8Array(readFileSync(new URL("arefarm.bin", dir)));
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
function session() { return new Adventure({ grid: new Grid(meta.w, meta.h, farmBytes), start: meta.start, npcDb, data, spawns: [], rng: seededRandom(54) }); }
function place(w, p, x, y) { w.grid.release(p.x, p.y, p.id); p.x = p.fx = x; p.y = p.fy = y; w.grid.occupy(x, y, p.id); }
function enter(a, id, restart) { place(a.farm, a.farm.ents.get(id), FARM_PORTAL.x - 1, FARM_PORTAL.y); assert.equal(a.command(id, { t: "portal", portal: FARM_PORTAL.id, ...(restart !== undefined ? { restart } : {}) }), true); return a.worldFor(id); }

test("1000 seeds: todas las casillas abiertas, salas, enemigos y salidas son alcanzables", () => {
  const signatures = new Set();
  for (let seed = 0; seed < 1000; seed++) {
    const d = generateDungeon(seed), g = d.grid;
    const queue = [d.start], seen = new Set([g.idx(...d.start)]);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, k = g.idx(nx, ny);
        if (!g.blocked(nx, ny) && !seen.has(k)) { seen.add(k); queue.push([nx, ny]); }
      }
    }
    let open = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (!g.blocked(x, y)) open++;
      if (x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1) assert.ok(g.blocked(x, y));
    }
    assert.equal(seen.size, open, `seed ${seed}`);
    for (const gate of d.portals) assert.ok(seen.has(g.idx(gate.x, gate.y)));
    for (const r of d.rooms) assert.ok(seen.has(g.idx(r.cx, r.cy)));
    for (const sp of d.spawns) assert.ok(sp.rect[0] > 0 && sp.rect[2] < g.w - 1);
    signatures.add(d.rooms.map(r => `${r.x},${r.y},${r.w},${r.h}`).join(";"));
  }
  assert.equal(signatures.size, 1000);
  assert.deepEqual(new Uint8Array(generateDungeon(0).grid.dv.buffer), new Uint8Array(generateDungeon(0).grid.dv.buffer));
});

test("entrada accesible sin alterar la geometría de Aresfarm y validada por la simulación", () => {
  const a = session(), id = a.addPlayer("uno"), p = a.farm.ents.get(id);
  assert.ok(findPath(a.farm.grid, p.x, p.y, FARM_PORTAL.x, FARM_PORTAL.y, id).length);
  assert.equal(a.command(id, { t: "portal", portal: FARM_PORTAL.id }), false);
  const before = new Uint8Array(a.farm.grid.dv.buffer).slice();
  enter(a, id);
  assert.deepEqual(new Uint8Array(a.farm.grid.dv.buffer), before);
});

test("salas variadas, curvas, ramales y ancho transitable de 3–7 casillas", () => {
  for (let seed = 0; seed < 100; seed++) {
    const d = generateDungeon(seed);
    assert.equal(d.grid.w, 112); assert.equal(d.grid.h, 112);
    assert.equal(d.corridors.length, 16);
    assert.equal(d.alcoves.length, 4);
    assert.ok(new Set(d.rooms.map(r => r.shape)).size >= 4);
    assert.ok(d.corridors.some(c => c.width === 3));
    assert.ok(d.corridors.some(c => c.width >= 6));
    assert.ok(d.rooms.every(r => r.w >= 18 && r.h >= 18));
    assert.ok(d.spawns.reduce((n, s) => n + s.max, 0) >= 29);
    assert.ok(d.spawns.reduce((n, s) => n + s.max, 0) <= 36);
    const a = session(), id = a.addPlayer("explorador");
    a.options.rng = seededRandom(seed);
    const w = enter(a, id), p = w.ents.get(id);
    const visible = [...w.ents.values()].filter(e => e.kind === "npc" && Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= 8);
    assert.ok(visible.length >= 2);
    assert.ok(visible.every(e => Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) > e.cfg.searchRange));
    for (const { cells, width } of d.corridors) {
      assert.ok(width >= 3 && width <= 7);
      const pad = Math.floor(width / 2);
      for (const [x, y] of cells) for (let dy = -pad; dy < width - pad; dy++) for (let dx = -pad; dx < width - pad; dx++) assert.ok(!d.grid.blocked(x + dx, y + dy), `galería obstruida seed ${seed}`);
    }
  }
});

test("no permite entrar en una cripta vacía cuando faltan los datos NPC", () => {
  const a = session(), id = a.addPlayer("uno"), p = a.farm.ents.get(id);
  a.farm.npcDb = {};
  place(a.farm, p, FARM_PORTAL.x - 1, FARM_PORTAL.y);
  assert.equal(a.command(id, { t: "portal", portal: FARM_PORTAL.id }), false);
  assert.equal(a.worldFor(id), a.farm);
});

test("instancias separadas, IDs únicos y progreso/equipo/vida conservados al volver", () => {
  const a = session(), id = a.addPlayer("uno"), id2 = a.addPlayer("dos");
  const p = a.farm.ents.get(id); p.gold = 543; p.hp = 23; p.mp = 11; p.sp = 14;
  const before = a.saveOf(id), d = enter(a, id), d2 = enter(a, id2);
  assert.notEqual(d, d2); assert.notEqual(d.map.seed, d2.map.seed);
  assert.ok(!d.ents.has(id2) && !d2.ents.has(id));
  const all = [...a.worlds.values()].flatMap(w => [...w.ents.keys()]);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(a.saveOf(id), before);
  for (const n of d.ents.values()) if (n.kind === "npc") assert.ok(!d.grid.blocked(n.x, n.y));
  assert.equal(a.command(id, { t: "attack", target: [...d2.ents.values()].find(e => e.kind === "npc").id }), false);
  assert.equal(a.command(id, { t: "portal", portal: "return" }), true);
  assert.equal(a.worldFor(id), a.farm); assert.ok(a.worlds.has(d.map.id));
  assert.equal(a.instances.get(id), d);
  assert.deepEqual(a.saveOf(id), before);
  assert.equal(p.hp, 23); assert.equal(p.mp, 11); assert.equal(p.sp, 14);
  assert.equal(a.farm.grid.occupant(p.x, p.y), id);
});

test("combate, drops y finalización sin respawn de esqueletos", () => {
  const a = session(), id = a.addPlayer("uno"), d = enter(a, id), p = d.ents.get(id);
  const enemies = [...d.ents.values()].filter(e => e.kind === "npc");
  assert.equal(d.map.remainingEnemies, enemies.length);
  for (const n of enemies) d.killNpc(n, p);
  a.tick(2000);
  assert.equal(d.map.remainingEnemies, 0);
  assert.ok(d.items.size > 0); assert.ok(p.kills === enemies.length);
  assert.ok(d.drainEvents().some(ev => ev.t === "dungeon-cleared"));
  a.tick(15000);
  assert.equal([...d.ents.values()].filter(e => e.kind === "npc").length, 0);
  assert.equal(d.generators.reduce((sum, g) => sum + g.alive, 0), 0);
  assert.equal(a.command(id, { t: "portal", portal: "return" }), true);
  const same = enter(a, id, false); assert.equal(same, d); assert.equal(same.map.remainingEnemies, 0);
  assert.equal(a.command(id, { t: "portal", portal: "return" }), true);
  const next = enter(a, id, true); assert.notEqual(next.map.seed, d.map.seed);
  assert.ok(!a.worlds.has(d.map.id));
});

test("un esqueleto recibe ataques validados y concede experiencia y botín", () => {
  const a = session(), id = a.addPlayer("guerrero"), d = enter(a, id), p = d.ents.get(id);
  Object.assign(p.stats, { str: 50, dex: 80, vit: 80 });
  d.recalc(p); p.hp = p.maxHp;
  const dagger = p.bag.find(i => data.item(i.id).name === "Dagger");
  assert.ok(d.command(id, { t: "equip", uid: dagger.uid }));
  const n = [...d.ents.values()].find(e => e.kind === "npc");
  const exp = p.exp;
  let attempts = 0;
  for (let i = 0; i < 200 && !n.dead && !p.dead; i++) {
    const spot = d.freeSpotNear(n.x, n.y, 1);
    if (spot) place(d, p, ...spot);
    if (!d.busy(p) && d.time - p.lastAttack >= 500 && d.command(id, { t: "attack", target: n.id })) attempts++;
    a.tick(500);
  }
  assert.ok(attempts > 0 && n.dead && !p.dead);
  assert.ok(p.exp > exp && p.kills === 1);
  a.tick(1500);
  assert.ok(d.items.size > 0);
});

test("morir dentro vuelve a la granja, y desconectar destruye la instancia", () => {
  const a = session(), id = a.addPlayer("uno"), d = enter(a, id), p = d.ents.get(id);
  damagePlayer(d, p, p.maxHp + 10, [...d.ents.values()].find(e => e.kind === "npc"));
  assert.equal(a.command(id, { t: "respawn" }), false);
  a.tick(1600);
  assert.equal(a.command(id, { t: "respawn" }), true);
  assert.equal(a.worldFor(id), a.farm); assert.equal(p.hp, p.maxHp);
  assert.ok(p.eff && typeof p.eff === "object");
  const d2 = enter(a, id, false); const save = a.saveOf(id); a.removePlayer(id);
  assert.ok(!a.worlds.has(d2.map.id)); assert.equal(a.worlds.size, 1);
  const restored = a.addPlayer("uno", save); assert.equal(a.worldFor(restored), a.farm);
  assert.deepEqual(a.saveOf(restored).stats, save.stats);
});

test("salir y continuar mantiene seed, bajas, HP y botín; reiniciar requiere una elección explícita", () => {
  const a = session(), id = a.addPlayer("uno"), d = enter(a, id), p = d.ents.get(id);
  const [first, second] = [...d.ents.values()].filter(e => e.kind === "npc");
  d.killNpc(first, p); second.hp -= 2; a.tick(2000);
  const remaining = d.map.remainingEnemies, hp = second.hp, loot = JSON.stringify([...d.items]);
  assert.equal(a.command(id, { t: "portal", portal: "return" }), true);
  place(a.farm, p, FARM_PORTAL.x - 1, FARM_PORTAL.y);
  assert.equal(a.command(id, { t: "portal", portal: FARM_PORTAL.id }), false);
  assert.equal(a.worldFor(id), a.farm);
  assert.ok(a.farm.drainEvents().some(e => e.t === "dungeon-choice" && e.id === id && e.remaining === remaining));
  assert.equal(a.instances.get(id), d); // cancelar no altera nada
  const same = enter(a, id, false);
  assert.equal(same, d); assert.ok(first.dead); assert.equal(second.hp, hp);
  assert.equal(same.map.remainingEnemies, remaining); assert.equal(JSON.stringify([...same.items]), loot);
  assert.equal(a.command(id, { t: "portal", portal: "return" }), true);
  const fresh = enter(a, id, true);
  assert.notEqual(fresh.map.id, d.map.id); assert.notEqual(fresh.map.seed, d.map.seed);
  assert.equal(fresh.map.remainingEnemies, fresh.map.totalEnemies);
  assert.ok(!a.worlds.has(d.map.id));
  a.command(id, { t: "portal", portal: "return" }); a.removePlayer(id);
  assert.equal(a.instances.size, 0); assert.equal(a.worlds.size, 1);
});
