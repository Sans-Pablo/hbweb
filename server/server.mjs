// Servidor multijugador de Helbreath Web (Node.js, sin dependencias).
//
//   node server/server.mjs [puerto]
//
// - Sirve la web (carpeta web/) y una conexión WebSocket en /ws.
// - Ejecuta la misma simulación que el modo local (web/src/shared/world.js) a 20 Hz.
// - Cada jugador recibe solo lo que tiene cerca, y solo lo que ha cambiado.
// - Guarda el progreso de cada personaje (por nombre) en server/saves.json.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { damageRange } from "../web/src/shared/combat.js";
import { attackMs } from "../web/src/shared/world.js";
import { LIMITS, PLAYER } from "../web/src/shared/const.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..", "web");
const DATA = path.join(WEB, "data");
const SAVES = process.env.SAVE_FILE || path.join(HERE, "saves.json");
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TICK_MS = 50;
const VIEW = 26;                   // casillas alrededor del jugador que se le envían
const MAX_PLAYERS = 16;

// ------------------------------------------------------------------ mundo
const meta = JSON.parse(fs.readFileSync(path.join(DATA, "map.json")));
const bytes = new Uint8Array(fs.readFileSync(path.join(DATA, meta.map + ".bin")));
const npcDb = JSON.parse(fs.readFileSync(path.join(DATA, "npc.json")));
const spawns = JSON.parse(fs.readFileSync(path.join(DATA, meta.map + ".spawns.json")));
const grid = new Grid(meta.w, meta.h, bytes);
const data = new GameData({ items: JSON.parse(fs.readFileSync(path.join(DATA, "items.json"))), magic: JSON.parse(fs.readFileSync(path.join(DATA, "magic.json"))), npcs: npcDb });
const adventure = new Adventure({ grid, npcDb, data, spawns, start: meta.start });

let saves = {};
try { saves = JSON.parse(fs.readFileSync(SAVES, "utf8")); } catch {}
function persist() {
  for (const c of clients) if (c.pid) saves[c.key] = adventure.saveOf(c.pid) || saves[c.key];
  try { fs.writeFileSync(SAVES, JSON.stringify(saves, null, 1)); } catch (e) { console.error("No se pudo guardar:", e.message); }
}
setInterval(persist, 30000);

// ------------------------------------------------------------------ web estática
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".bin": "application/octet-stream", ".css": "text/css",
  ".svg": "image/svg+xml", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/info") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
    res.end(JSON.stringify({ multiplayer: true, players: [...clients].filter(c => c.pid).map(c => c.name) }));
    return;
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(WEB, "." + rel);
  if (!file.startsWith(WEB + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end("No encontrado"); return;
  }
  const size = fs.statSync(file).size;
  const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (range) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    if (start >= size || start < 0) { res.writeHead(416, { "Content-Range": "bytes */" + size }); res.end(); return; }
    end = Math.min(end, size - 1);
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1, "Accept-Ranges": "bytes" });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes",
    "Cache-Control": /\.(png|mp3|wav|bin)$/.test(file) ? "max-age=3600" : "no-cache" });
  fs.createReadStream(file).pipe(res);
});

// ------------------------------------------------------------------ WebSocket mínimo (RFC 6455)
const clients = new Set();

server.on("upgrade", (req, socket) => {
  if (new URL(req.url, "http://x").pathname !== "/ws" || !req.headers["sec-websocket-key"]) { socket.destroy(); return; }
  const accept = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
  socket.setNoDelay(true);
  const c = { socket, buf: Buffer.alloc(0), pid: null, name: "", key: "", queue: [], ack: 0, sent: new Map(), itemsVer: -1, alive: true, frag: null };
  clients.add(c);
  socket.on("data", d => { c.buf = Buffer.concat([c.buf, d]); readFrames(c); });
  socket.on("close", () => drop(c));
  socket.on("error", () => drop(c));
});

function readFrames(c) {
  while (c.buf.length >= 2) {
    const b0 = c.buf[0], b1 = c.buf[1], op = b0 & 15, fin = b0 & 128, masked = b1 & 128;
    let len = b1 & 127, off = 2;
    if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
    if (len > 1 << 20) { c.socket.destroy(); return; }
    const need = off + (masked ? 4 : 0) + len;
    if (c.buf.length < need) return;
    let payload = c.buf.subarray(off + (masked ? 4 : 0), need);
    if (masked) {
      const m = c.buf.subarray(off, off + 4);
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3];
    }
    c.buf = c.buf.subarray(need);
    if (op === 8) { c.socket.end(); return; }
    if (op === 9) { sendFrame(c, payload, 10); continue; }
    if (op === 1 || op === 0) {
      c.frag = c.frag ? Buffer.concat([c.frag, payload]) : payload;
      if (fin) {
        const text = c.frag.toString("utf8"); c.frag = null;
        if (LAG) setTimeout(() => onMessage(c, text), LAG); else onMessage(c, text);
      }
    }
  }
}

function sendFrame(c, data, op = 1) {
  if (!c.alive || c.socket.destroyed) return;
  const len = data.length;
  const head = len < 126 ? Buffer.from([128 | op, len])
    : len < 65536 ? Buffer.from([128 | op, 126, len >> 8, len & 255])
      : (() => { const h = Buffer.alloc(10); h[0] = 128 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); return h; })();
  c.socket.write(Buffer.concat([head, data]));
}
// LAG_MS=120 simula la latencia de internet en pruebas (la mitad a la ida, la mitad a la vuelta)
const LAG = Number(process.env.LAG_MS || 0) / 2;
const send = (c, obj) => {
  const data = Buffer.from(JSON.stringify(obj));
  if (LAG) setTimeout(() => sendFrame(c, data), LAG); else sendFrame(c, data);
};

function drop(c) {
  if (!c.alive) return;
  c.alive = false;
  clients.delete(c);
  if (c.pid) {
    saves[c.key] = adventure.saveOf(c.pid) || saves[c.key];
    adventure.removePlayer(c.pid);
    console.log(`[-] ${c.name} se ha ido (${online()} conectados)`);
    persist();
  }
}
const online = () => [...clients].filter(c => c.pid).length;

// ------------------------------------------------------------------ protocolo
function onMessage(c, text) {
  let m;
  try { m = JSON.parse(text); } catch { return; }
  if (m.t === "join" && !c.pid) {
    const name = String(m.name || "").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 16) || "Aventurero";
    const key = name.toLowerCase();
    if ([...clients].some(o => o.pid && o.key === key)) { send(c, { t: "error", msg: "Ese nombre ya está jugando. Elige otro." }); return; }
    if (online() >= MAX_PLAYERS) { send(c, { t: "error", msg: "El servidor está lleno." }); return; }
    c.name = name; c.key = key;
    c.pid = adventure.addPlayer(name, saves[key]);
    send(c, { t: "welcome", id: c.pid, time: adventure.time, returning: !!saves[key] });
    console.log(`[+] ${name} ha entrado (${online()} conectados)`);
    adventure.farm.emit({ t: "chat", id: c.pid, name: "Servidor", text: name + " ha entrado en la granja.", system: true });
    return;
  }
  if (m.t === "cmd" && c.pid && m.cmd && typeof m.cmd.t === "string") {
    if (c.queue.length > 6) c.queue.shift();
    c.queue.push({ seq: m.seq | 0, cmd: m.cmd, at: Date.now() });
  }
  if (m.t === "ping") send(c, { t: "pong", c: m.c, time: adventure.time });
}

// El cliente predice sus pasos, así que a veces una orden llega un poco antes de que el
// servidor haya terminado el paso anterior. En vez de rechazarla, se espera (como el
// búfer del servidor original), hasta 700 ms.
const TIMED = new Set(["move", "attack", "pickup"]);
function processQueue(c) {
  while (c.queue.length) {
    const world = adventure.worldFor(c.pid);
    const p = world.ents.get(c.pid);
    const q = c.queue[0];
    let backdate = null;
    if (p && !p.dead && TIMED.has(q.cmd.t)) {
      // instante en que la orden ya es legal: fin de la acción actual y del límite de ritmo
      const readyAt = Math.max(p.busyUntil,
        q.cmd.t === "move" ? p.lastMove + LIMITS.moveMs : q.cmd.t === "attack" ? p.lastAttack + PLAYER.attackCooldownMs : 0);
      if (world.time < readyAt) {
        q.held = true;
        if (Date.now() - q.at < 700) return;
      } else if (q.held && world.time - readyAt < 100) backdate = readyAt;
    }
    q.held = false;
    c.queue.shift();
    // Una orden que esperaba empieza en el instante exacto en que quedó libre (no en el
    // siguiente tick): así el servidor no se va retrasando ~25 ms por paso y no hay "tirones".
    const now = world.time;
    if (backdate !== null) world.time = backdate;
    const changedMap = q.cmd.t === "portal" || q.cmd.t === "respawn";
    adventure.command(c.pid, q.cmd);
    world.time = now;
    c.ack = q.seq;
    if (changedMap && adventure.worldFor(c.pid) !== world) { c.queue = []; return; }
    if (TIMED.has(q.cmd.t)) return;          // como mucho una acción con tiempo por tick
  }
}

// ------------------------------------------------------------------ estado que se envía
const r1 = v => Math.round(v * 10) / 10;
function pub(e, own) {
  const o = { id: e.id, k: e.kind, name: e.name, x: e.x, y: e.y, fx: e.fx, fy: e.fy, dir: e.dir, act: e.act,
    s: r1(e.actStart), d: e.actDur, dead: e.dead ? 1 : 0, hp: e.hp, mh: e.maxHp };
  if (e.kind === "npc") { o.type = e.type; o.sp = e.special; o.ph = r1(e.phase); }
  else {
    o.lc = r1(e.lastCombat); o.lk = [e.gender, e.look.skin, e.look.hair, e.look.hairCol, e.look.under];
    if (own) Object.assign(o, {
      bu: r1(e.busyUntil), la: r1(e.lastAttack), lm: r1(e.lastMove), mp: e.mp, mm: e.maxMp, lv: e.level, xp: e.exp,
      px: e.prevExp, nx: e.nextExp, pool: e.pool, gold: e.gold, stats: e.stats, def: e.defense,
      sp: e.sp, ms: e.maxSp, hu: e.hunger, wt: e.weight, ml: e.maxLoad, am: attackMs(e), dmg: damageRange(e),
      bag: e.bag.map(i => [i.uid, i.id, i.count, i.life, i.attr || 0, i.color || 0, i.x ?? 40, i.y ?? 30]), eq: e.equip, mg: e.magic,
      kills: e.kills, skills: e.skills, deadAt: e.deadAt,
    });
  }
  return o;
}

function itemsList(world) {
  const out = [];
  for (const list of world.items.values()) { const it = list[list.length - 1]; out.push([it.uid, it.id, it.count, it.x, it.y, it.attr || 0]); }   // solo se ve el de encima
  return out;
}

let last = Date.now();
setInterval(() => {
  const now = Date.now(), dt = Math.min(250, now - last);
  last = now;
  for (const c of clients) if (c.pid) processQueue(c);
  adventure.tick(dt);
  const eventsByMap = adventure.drainEvents();
  for (const c of clients) {
    if (!c.pid) continue;
    const world = adventure.worldFor(c.pid);
    const me = world.ents.get(c.pid);
    const events = eventsByMap.get(world.map.id) || [];
    const items = itemsList(world);
    if (!me) continue;
    if (c.socket.writableLength > 1 << 20) continue;     // conexión atascada: saltar este envío
    const mapChanged = c.mapId !== world.map.id;
    if (mapChanged) { c.sent.clear(); c.itemsKey = null; c.mapId = world.map.id; }
    const changed = [], seen = new Set();
    for (const e of world.ents.values()) {
      if (e !== me && e.kind === "npc" && (Math.abs(e.x - me.x) > VIEW || Math.abs(e.y - me.y) > VIEW)) continue;
      seen.add(e.id);
      const o = pub(e, e === me), js = JSON.stringify(o);
      if (c.sent.get(e.id) !== js) { c.sent.set(e.id, js); changed.push(o); }
    }
    const gone = [];
    for (const id of c.sent.keys()) if (!seen.has(id)) { gone.push(id); c.sent.delete(id); }
    const ev = events.filter(v => v.t === "chat" || seen.has(v.id) || v.t === "drop" || v.id === c.pid);
    const msg = { t: "s", time: r1(world.time), ack: c.ack };
    if (mapChanged || c.remainingEnemies !== world.map.remainingEnemies) {
      msg.map = world.map;
      c.remainingEnemies = world.map.remainingEnemies;
    }
    if (changed.length) msg.e = changed;
    if (gone.length) msg.g = gone;
    if (ev.length) msg.ev = ev;
    const itemsKey = JSON.stringify(items);
    if (c.itemsKey !== itemsKey) { msg.it = items; c.itemsKey = itemsKey; }
    send(c, msg);
  }
}, TICK_MS);

// ------------------------------------------------------------------ arranque
server.listen(PORT, "0.0.0.0", () => {
  console.log("Helbreath Web - servidor multijugador");
  console.log("  En este PC:        http://localhost:" + PORT + "/");
  let interfaces = {};
  try { interfaces = os.networkInterfaces(); } catch {} // Algunos entornos aíslan esta consulta.
  for (const list of Object.values(interfaces))
    for (const a of list || []) if (a.family === "IPv4" && !a.internal) console.log("  En tu red local:   http://" + a.address + ":" + PORT + "/");
  console.log("  Monstruos: " + [...adventure.farm.ents.values()].filter(e => e.kind === "npc").length + ".  Progreso guardado en server/saves.json");
});
process.on("SIGINT", () => { persist(); process.exit(0); });

