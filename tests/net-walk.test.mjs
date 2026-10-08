// Ritmo de pasos con servidor real y latencia: mide cuántas veces el servidor corrige la posición.
import { spawn } from "node:child_process";
const PORT = 8123;
const srv = spawn("node", ["server/server.mjs", String(PORT)], { env: { ...process.env, LAG_MS: "80" }, stdio: "ignore" });
await new Promise(r => setTimeout(r, 1500));
const { default: WS } = await import("node:module").then(() => ({ default: globalThis.WebSocket }));
const ws = new WS(`ws://localhost:${PORT}/ws`);
let me, seq = 0, rejects = 0, steps = 0, pos = null;
ws.onopen = () => ws.send(JSON.stringify({ t: "join", name: "tester" + Date.now() % 1000 }));
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.t === "welcome") me = m.id;
  if (m.t === "s") {
    for (const o of m.e || []) if (o.id === me) pos = [o.x, o.y];
    for (const ev of m.ev || []) if (ev.t === "reject" && ev.id === me) { console.log("reject", ev.why); if (ev.why !== "bloqueado") rejects++; }
  }
};
await new Promise(r => setTimeout(r, 500));
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

