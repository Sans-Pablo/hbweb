// Compañero en multijugador: el que invoca un jugador lo ven los demás (nombre, nivel, dueño) y el cliente los registra en la entidad.
import { NET_PROTO } from "../web/src/shared/const.js";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const PORT = 18141;
const srv = spawn("node", ["server/server.mjs", String(PORT)], { env: { ...process.env, HB_RESIDENTS: "0", HB_LLM: "off", HB_DEBUG: "1", HB_DATA: mkdtempSync(path.join(tmpdir(), "hbcomp-")) }, stdio: "ignore" });
for (let i = 0; i < 80; i++) { const ok = await new Promise(r => { const t = new WebSocket(`ws://localhost:${PORT}/ws`); t.onopen = () => { t.close(); r(true); }; t.onerror = () => r(false); }); if (ok) break; await new Promise(r => setTimeout(r, 250)); }
const fail = m => { console.log("FALLO net-companion:", m); srv.kill(); process.exit(1); };
function client(name) {
  const c = { me: undefined, seen: new Map(), bag: [], ws: new WebSocket(`ws://localhost:${PORT}/ws`), seq: 0 };
  c.ws.onopen = () => c.ws.send(JSON.stringify({ t: "auth", mode: "register", name: name + Date.now() % 10000, pass: "secret1", proto: NET_PROTO }));
  c.ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === "authok") c.ws.send(JSON.stringify({ t: "join", create: { name } }));
    if (m.t === "welcome") c.me = m.id;
    if (m.t === "s") for (const o of m.e || []) { c.seen.set(o.id, { ...(c.seen.get(o.id) || {}), ...o }); if (o.id === c.me && o.o?.bag) c.bag = o.o.bag; }
  };
  c.cmd = cmd => c.ws.send(JSON.stringify({ t: "cmd", seq: ++c.seq, cmd }));
  return c;
}
const A = client("Cazador"), B = client("Vecino");
for (let i = 0; i < 100 && (A.me === undefined || B.me === undefined); i++) await new Promise(r => setTimeout(r, 100));
if (A.me === undefined || B.me === undefined) fail("no entran");
A.cmd({ t: "dbg", op: "ball", sp: "Giant-Ant", lvl: 7 });
for (let i = 0; i < 30 && !A.bag.some(b => b.comp); i++) await new Promise(r => setTimeout(r, 100));
const ball = A.bag.find(b => b.comp);
if (!ball) fail("sin bola");
A.cmd({ t: "use", uid: ball.uid });
let pet = null;
for (let i = 0; i < 50 && !pet; i++) { await new Promise(r => setTimeout(r, 100)); pet = [...B.seen.values()].find(o => o.cp && o.mt === A.me); }
if (!pet) fail("el vecino no ve al compañero");
if (pet.cl !== 7 || !pet.nk || !(pet.hp > 0)) fail("datos públicos " + JSON.stringify(pet));
console.log("OK net-companion", pet.name, "nv", pet.cl);
A.ws.close(); B.ws.close(); srv.kill(); process.exit(0);
