// Ritmo de pasos con servidor real y latencia: mide cuántas veces el servidor corrige la posición.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const PORT = 18123;   // no el 8123: es el del servidor estático de pruebas (tools/e2e.py)
const srv = spawn("node", ["server/server.mjs", String(PORT)], { env: { ...process.env, LAG_MS: "80", HB_RESIDENTS: "0", HB_LLM: "off", HB_DATA: mkdtempSync(path.join(tmpdir(), "hbwalk-")) }, stdio: "ignore" });
// espera a que el servidor escuche (con otros tests en paralelo puede tardar)
for (let i = 0; i < 80; i++) { const ok = await new Promise(r => { const t = new WebSocket(`ws://localhost:${PORT}/ws`); t.onopen = () => { t.close(); r(true); }; t.onerror = () => r(false); }); if (ok) break; await new Promise(r => setTimeout(r, 250)); }
const { default: WS } = await import("node:module").then(() => ({ default: globalThis.WebSocket }));
const ws = new WS(`ws://localhost:${PORT}/ws`);
let me, seq = 0, rejects = 0, steps = 0, pos = null;
ws.onopen = () => ws.send(JSON.stringify({ t: "auth", mode: "register", name: "tester" + Date.now() % 1000, pass: "secret1", proto: 6 }));
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.t === "authok") ws.send(JSON.stringify({ t: "join", create: { name: "walker" } }));
  if (m.t === "welcome") me = m.id;
  if (m.t === "s") {
    for (const o of m.e || []) if (o.id === me) pos = [o.x, o.y];
    for (const ev of m.ev || []) if (ev.t === "reject" && ev.id === me) { console.log("reject", ev.why); if (ev.why !== "bloqueado") rejects++; }
  }
};
for (let i = 0; i < 100 && me === undefined; i++) await new Promise(r => setTimeout(r, 100));
await new Promise(r => setTimeout(r, 300));
const dirs = [5, 5, 5, 5, 3, 3, 3, 3];     // sur / este
const start = Date.now(); let i = 0, next = 0;
while (Date.now() - start < 12000) {
  if (Date.now() >= next) { ws.send(JSON.stringify({ t: "cmd", seq: ++seq, cmd: { t: "move", dir: dirs[i++ % dirs.length], run: false } })); steps++; next = Date.now() + 372; }
  await new Promise(r => setTimeout(r, 5));
}
await new Promise(r => setTimeout(r, 1200));
console.log({ steps, rejects, pos });
ws.close(); srv.kill();
process.exit(!me || !pos || rejects > 1 ? 1 : 0);

