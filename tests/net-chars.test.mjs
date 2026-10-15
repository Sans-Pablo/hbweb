import { NET_PROTO } from "../web/src/shared/const.js";
// Hasta 4 personajes por cuenta: crear en ranuras distintas, listarlos al entrar, nombres unicos, maximo 4.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const PORT = 18211, dir = mkdtempSync(path.join(tmpdir(), "hbchars-"));
const s = await new Promise(r => { const p = spawn("node", ["server/server.mjs", String(PORT)], { env: { ...process.env, HB_RESIDENTS: "0", HB_LLM: "off", HB_DATA: dir }, stdio: ["ignore", "pipe", "ignore"] }); let o = ""; p.stdout.on("data", d => { o += d; if (o.includes("Monstruos")) r(p); }); });
const st = { str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 };
const session = (mode, slot, name) => new Promise(res => {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`); let chars, out = {};
  ws.onopen = () => ws.send(JSON.stringify({ t: "auth", mode, name: "multi", pass: "multi123", proto: NET_PROTO }));
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === "s") return;
    if (m.t === "authok") { chars = m.chars; if (slot === undefined) { ws.close(); return res({ chars }); } ws.send(JSON.stringify({ t: "join", slot, create: name ? { name, gender: 1, stats: st } : null })); }
    if (m.t === "welcome") setTimeout(() => { ws.close(); res({ chars, slot: m.slot, ok: true }); }, 200);
    if (m.t === "error") setTimeout(() => { ws.close(); res({ chars, err: m.msg }); }, 100); };
});
try {
  const r0 = await session("register", 0, "Aaa"); assert.equal(r0.ok, true, JSON.stringify(r0));
  await new Promise(r => setTimeout(r, 300));
  assert.equal((await session("login", 1, "Bbb")).slot, 1);
  await new Promise(r => setTimeout(r, 300));
  assert.ok((await session("login", 2, "Aaa")).err, "nombre repetido rechazado");
  assert.equal((await session("login", 3, "Ccc")).slot, 3);
  await new Promise(r => setTimeout(r, 300));
  const l = (await session("login")).chars;
  assert.deepEqual(l.map(c => [c.slot, c.name]), [[0, "Aaa"], [1, "Bbb"], [3, "Ccc"]]);
  console.log("OK");
} finally { s.kill(); }
