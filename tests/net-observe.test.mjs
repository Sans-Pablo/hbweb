// Modo observar: sin cuenta, se pide la lista de habitantes, se elige uno y se recibe el mundo desde su posición; las órdenes se ignoran.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const PORT = 18131;
const srv = spawn("node", ["server/server.mjs", String(PORT)], { env: { ...process.env, HB_RESIDENTS: "8", HB_LLM: "off", HB_DATA: mkdtempSync(path.join(tmpdir(), "hbobs-")) }, stdio: "ignore" });
for (let i = 0; i < 80; i++) { const ok = await new Promise(r => { const t = new WebSocket(`ws://localhost:${PORT}/ws`); t.onopen = () => { t.close(); r(true); }; t.onerror = () => r(false); }); if (ok) break; await new Promise(r => setTimeout(r, 250)); }
const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
let list = null, watching = null, own = null, ents = 0;
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.t === "botlist") list = m.list;
  if (m.t === "watching") watching = m;
  if (m.t === "s") for (const o of m.e || []) { ents++; if (watching && o.id === watching.id && o.o) own = o; }
};
await new Promise(r => { ws.onopen = r; });
ws.send(JSON.stringify({ t: "bots" }));
for (let i = 0; i < 50 && !list; i++) await new Promise(r => setTimeout(r, 100));
const fail = m => { console.log("FALLO net-observe:", m); srv.kill(); process.exit(1); };
if (!list || list.length !== 8) fail("lista " + JSON.stringify(list?.length));
const b = list[0];
if (!b.name || !b.st || b.lv < 1 || ![1, 2].includes(b.side) || !b.map) fail("campos " + JSON.stringify(b));
ws.send(JSON.stringify({ t: "watch", id: b.id }));
for (let i = 0; i < 50 && !own; i++) await new Promise(r => setTimeout(r, 100));
if (!watching || watching.id !== b.id) fail("watching");
if (!own || !own.o || !Array.isArray(own.o.bag)) fail("estado completo del habitante observado");
ws.send(JSON.stringify({ t: "cmd", seq: 1, cmd: { t: "say", text: "hola" } }));      // sin personaje propio: se ignora sin romper
await new Promise(r => setTimeout(r, 500));
ws.send(JSON.stringify({ t: "unwatch" })); await new Promise(r => setTimeout(r, 200));
console.log("OK net-observe", b.name, b.map);
ws.close(); srv.kill(); process.exit(0);
