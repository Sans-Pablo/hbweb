import { NET_PROTO } from "../web/src/shared/const.js";
// Corte de red: al reconectar con la misma cuenta el servidor devuelve el MISMO personaje (misma id), sin pérdida.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const PORT = 18131;
const srv = spawn("node", ["server/server.mjs", String(PORT)], { env: { ...process.env, HB_NO_LIMITS: "1", HB_RESIDENTS: "0", HB_LLM: "off", HB_DATA: mkdtempSync(path.join(tmpdir(), "hbrec-")) }, stdio: "ignore" });
for (let i = 0; i < 80; i++) { const ok = await new Promise(r => { const t = new WebSocket(`ws://localhost:${PORT}/ws`); t.onopen = () => { t.close(); r(true); }; t.onerror = () => r(false); }); if (ok) break; await new Promise(r => setTimeout(r, 250)); }
const name = "rec" + Date.now() % 100000;
async function session(create) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`); const r = { ws };
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === "authok") ws.send(JSON.stringify({ t: "join", create: m.hasChar ? null : create })); if (m.t === "welcome") r.w = m; };
  ws.onopen = () => ws.send(JSON.stringify({ t: "auth", mode: create ? "register" : "login", name, pass: "secret1", proto: NET_PROTO }));
  for (let i = 0; i < 100 && !r.w; i++) await new Promise(r => setTimeout(r, 100));
  return r;
}
const a = await session({ name });
a.ws.close();                                                  // corte
await new Promise(r => setTimeout(r, 500));
const b = await session(null);
const ok = !!a.w && !!b.w && b.w.id === a.w.id && b.w.resumed === true;
console.log(ok ? "OK net-reconnect" : "FALLO net-reconnect", a.w?.id, b.w?.id);
b.ws.close(); srv.kill();
process.exit(ok ? 0 : 1);
