// El admin invoca un bot en el servidor real: el bot aparece como jugador, entra en el grupo y se mueve con él.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const PORT = 18124;
const srv = spawn("node", ["server/server.mjs", String(PORT)], { env: { ...process.env, HB_DEBUG: "1", HB_NO_LIMITS: "1", HB_DATA: mkdtempSync(path.join(tmpdir(), "hbbot-")) }, stdio: "ignore" });
for (let i = 0; i < 80; i++) { const ok = await new Promise(r => { const t = new WebSocket(`ws://localhost:${PORT}/ws`); t.onopen = () => { t.close(); r(true); }; t.onerror = () => r(false); }); if (ok) break; await new Promise(r => setTimeout(r, 250)); }
const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
let me, seq = 0; const seen = new Map();
ws.onopen = () => ws.send(JSON.stringify({ t: "auth", mode: "register", name: "adm" + Date.now() % 1000, pass: "secret1", proto: 4 }));
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.t === "authok") ws.send(JSON.stringify({ t: "join", create: { name: "admin" + Date.now() % 100 } }));
  if (m.t === "welcome") me = m.id;
  if (m.t === "s") for (const o of m.e || []) if (o.k === "player") seen.set(o.id, o);
};
for (let i = 0; i < 100 && me === undefined; i++) await new Promise(r => setTimeout(r, 100));
await new Promise(r => setTimeout(r, 300));
ws.send(JSON.stringify({ t: "cmd", seq: ++seq, cmd: { t: "dbg", op: "bot", n: 1, level: 15 } }));
let bot, ok = false;
for (let i = 0; i < 80 && !ok; i++) {                                  // hasta 16 s: en un runner lento el servidor tarda en crear al bot
  await new Promise(r => setTimeout(r, 200));
  bot = [...seen.values()].find(o => o.id !== me); const mine = seen.get(me);
  ok = !!bot && !!mine && !!bot.ap && Math.max(Math.abs(bot.x - mine.x), Math.abs(bot.y - mine.y)) <= 16;
}
console.log(ok ? "OK net-bot" : "FALLO net-bot", bot && { name: bot.name, x: bot.x, y: bot.y });
ws.close(); srv.kill();
process.exit(ok ? 0 : 1);
