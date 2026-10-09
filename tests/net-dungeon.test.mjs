// Dos clientes reales: transición, aislamiento y reconexión, con 80 ms de latencia.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Grid } from "../web/src/shared/grid.js";
import { readFileSync } from "node:fs";
import { GameData } from "../web/src/shared/data.js";
import { NetConnection } from "../web/src/client/connection.js";
import { generateLevel, setDungeonPalette } from "../web/src/shared/dungeon.js";
import { findPath } from "../web/src/shared/path.js";

const D = new URL("../web/data/", import.meta.url);
const json = name => JSON.parse(readFileSync(new URL(name, D)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
const bytes = new Uint8Array(readFileSync(new URL("arefarm.bin", D)));
setDungeonPalette(json("dungeon_palette.json"));
async function until(fn, why) {
  const end = Date.now() + 8000;
  while (Date.now() < end) { if (fn()) return; await delay(20); }
  assert.fail("Tiempo agotado: " + why);
}

test("servidor real: dos jugadores entran en instancias aisladas y vuelven a Aresfarm", { timeout: 30000 }, async () => {
  const folder = mkdtempSync(path.resolve("tests/.dungeon-"));
  const srv = spawn(process.execPath, ["server/server.mjs", "8125"], { env: { ...process.env, LAG_MS: "80", SAVE_FILE: path.join(folder, "saves.json") }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "", exited = false;
  srv.stdout.on("data", b => output += b); srv.stderr.on("data", b => output += b);
  srv.on("exit", () => exited = true);
  const sockets = [];
  try {
    await until(() => output.includes("Monstruos:") || exited, "arranque");
    assert.ok(!exited, output);
    async function connect(name) {
      const conn = new NetConnection(new Grid(meta.w, meta.h, bytes), npcDb, data);
      const ws = new WebSocket("ws://localhost:8125/ws"); conn.ws = ws; sockets.push(ws);
      const packets = [];
      ws.onopen = () => ws.send(JSON.stringify({ t: "join", name }));
      ws.onmessage = e => {
        const m = JSON.parse(e.data); packets.push(m);
        if (m.t === "welcome") conn.pid = m.id;
        if (m.t === "s") { conn.onState(m); conn.world.time = m.time; }
      };
      await until(() => conn.pid && conn.state.ents.has(conn.pid), "primer estado " + name);
      return { conn, packets };
    }
    async function walk(conn, x, y) {
      const w = conn.state;
      while (true) {
        const me = w.ents.get(conn.pid);
        if (!me || conn.state.map.kind !== "farm") break;                  // ya teletransportado a la cripta
        if (Math.max(Math.abs(me.x - x), Math.abs(me.y - y)) <= 1) break;
        await until(() => w.time >= Math.max(me.busyUntil, me.lastMove + 200) + 60, "fin de paso");
        const route = findPath(w.grid, me.x, me.y, x, y, me.id);
        assert.ok(route.length, "ruta al portal " + JSON.stringify([me.x, me.y, x, y, conn.state.map.kind]));
        assert.ok(conn.send({ t: "move", dir: route[0], run: true }));
        const seq = conn.seq; await until(() => conn.ack >= seq, "ack paso");
      }
      await until(() => w.time >= w.ents.get(conn.pid).busyUntil + 60, "llegada");
    }
    const a = await connect("cripta-a"), b = await connect("cripta-b");
    await walk(a.conn, 79, 70);                               // el teletransportador de la granja a middled1n entra directo
    await until(() => a.conn.state.map.kind === "dungeon", "entrada A");
    const mapA = a.conn.state.map;
    assert.equal(mapA.level, 1);
    assert.equal(a.conn.state.grid.w, 60);
    assert.ok(mapA.totalEnemies >= 9 && mapA.remainingEnemies === mapA.totalEnemies);
    assert.deepEqual(new Uint8Array(a.conn.state.grid.dv.buffer), new Uint8Array(generateLevel(mapA.seed, mapA.level).grid.dv.buffer));
    a.conn.send({ t: "portal", portal: "down" });             // con enemigos vivos el portal de bajada rechaza
    await until(() => a.packets.some(m => m.ev?.some(e => e.t === "reject" && e.cmd === "portal")), "bajada cerrada");
    assert.equal(a.conn.state.map.level, 1);
    await until(() => !b.conn.state.ents.has(a.conn.pid), "A sale de vista de B");
    assert.equal(b.conn.state.map.kind, "farm");
    assert.ok(!a.conn.state.ents.has(b.conn.pid));
    assert.ok([...a.conn.state.ents.values()].some(e => e.kind === "npc" && e.name === "Skeleton"));
    assert.ok([...b.conn.state.ents.values()].every(e => e.kind !== "npc" || e.name !== "Skeleton"));
    await walk(b.conn, 79, 70);
    await until(() => b.conn.state.map.kind === "dungeon", "entrada B");
    assert.notEqual(b.conn.state.map.id, mapA.id);
    assert.ok(!b.conn.state.ents.has(a.conn.pid));
    a.conn.send({ t: "portal", portal: "return" });
    await until(() => a.conn.state.map.kind === "farm", "salida A");
    assert.equal(a.conn.state.grid.w, 250);
    assert.ok(!a.conn.state.ents.has(b.conn.pid));
    b.conn.send({ t: "portal", portal: "return" });
    await until(() => b.conn.state.map.kind === "farm" && a.conn.state.ents.has(b.conn.pid), "salida B");
    try { await walk(a.conn, 76, 66); await walk(a.conn, 79, 70); } catch (e) { if (a.conn.state.map.kind !== "dungeon") throw e; }   // sin progreso (nivel 1) no pregunta: entra directo
    await until(() => a.conn.state.map.kind === "dungeon", "reentrada A");
    assert.notEqual(a.conn.state.map.id, mapA.id);
    assert.ok(!exited, output);
    assert.ok(![...b.packets].some(m => (m.ev || []).some(e => e.t === "reject" && e.cmd === "portal")));
  } finally {
    for (const ws of sockets) ws.close();
    await delay(100); srv.kill(); await delay(100);
    rmSync(folder, { recursive: true, force: true });
  }
});
