// Cuenta y personaje nuevos sobreviven a matar el servidor de golpe (SIGKILL) nada más entrar.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const PORT = 18201, dir = mkdtempSync(path.join(tmpdir(), "hbpers-"));
const start = () => new Promise(r => { const s = spawn("node", ["server/server.mjs", String(PORT)], { env: { ...process.env, HB_DATA: dir }, stdio: ["ignore", "pipe", "ignore"] }); let o = ""; s.stdout.on("data", d => { o += d; if (o.includes("Monstruos")) r(s); }); });
const talk = (mode, create) => new Promise(res => {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`), log = [];
  ws.onopen = () => ws.send(JSON.stringify({ t: "auth", mode, name: "rerere", pass: "rerere", proto: 4 }));
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === "s") return; log.push(m.t + ":" + (m.msg || m.hasChar || ""));
    if (m.t === "authok") ws.send(JSON.stringify(create ? { t: "join", create: { name: "Rere", gender: 1, stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 } } } : { t: "join" }));
    if (m.t === "welcome" || m.t === "error") setTimeout(() => { ws.close(); res(log); }, 300); };
});
let s = await start();
assert.deepEqual(await talk("register", true), ["authok:", "welcome:"]);
s.kill("SIGKILL"); await new Promise(r => setTimeout(r, 400));
s = await start();
assert.deepEqual(await talk("login", false), ["authok:true", "welcome:"], "el personaje sigue ahí");
s.kill();
console.log("OK");
