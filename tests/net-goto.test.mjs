import { NET_PROTO } from "../web/src/shared/const.js";
// «Ir a» por el servidor real: solo Promise Land, Aresfarm, Elvine Farm y la cripta; el resto de mapas se rechaza.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const PORT = 18127;
const srv = spawn("node", ["server/server.mjs", String(PORT)], { env: { ...process.env, HB_DEBUG: "1", HB_NO_LIMITS: "1", HB_RESIDENTS: "0", HB_LLM: "off", HB_DATA: mkdtempSync(path.join(tmpdir(), "hbgoto-")) }, stdio: "ignore" });
for (let i = 0; i < 80; i++) { const ok = await new Promise(r => { const t = new WebSocket(`ws://localhost:${PORT}/ws`); t.onopen = () => { t.close(); r(true); }; t.onerror = () => r(false); }); if (ok) break; await new Promise(r => setTimeout(r, 250)); }
const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
let me, seq = 0, mapId = null; const types = new Set();
ws.onopen = () => ws.send(JSON.stringify({ t: "auth", mode: "register", name: "go" + Date.now() % 1000, pass: "secret1", proto: NET_PROTO }));
ws.onmessage = e => {
  const m = JSON.parse(e.data); types.add(m.t);
  if (m.t === "authok") ws.send(JSON.stringify({ t: "join", create: { name: "goer" + Date.now() % 100 } }));
  if (m.t === "welcome") { me = m.id; mapId = m.map?.id ?? m.mapId ?? mapId; }
  if (m.t === "map") mapId = m.map?.id ?? m.id ?? mapId;
  if (m.t === "s" && m.map) mapId = m.map.id ?? m.map;
};
for (let i = 0; i < 100 && me === undefined; i++) await new Promise(r => setTimeout(r, 100));
const go = async map => { ws.send(JSON.stringify({ t: "cmd", seq: ++seq, cmd: { t: "dbg", op: "goto", map } })); await new Promise(r => setTimeout(r, 1200)); return mapId; };
await new Promise(r => setTimeout(r, 500));
const start = mapId, results = { start };
results.elvfarm = await go("elvfarm");
for (const m of ["aresden", "elvine", "middleland", "arejail"]) results[m] = await go(m);
console.log(JSON.stringify(results), [...types].join(","));
ws.close(); srv.kill();
// el jugador de prueba es de Aresden: la farm enemiga (elvfarm) también se rechaza; ningún otro mapa es alcanzable
const ok = ["elvfarm", "aresden", "elvine", "middleland", "arejail"].every(m => results[m] === start);
console.log(ok ? "OK net-goto" : "FALLO net-goto");
process.exit(ok ? 0 : 1);
