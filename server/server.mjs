// Servidor online de Helbreath Web (Node.js, sin dependencias).
//
//   node server/server.mjs [puerto]      (configuración opcional en server/config.json; ver config.example.json)
//
// - Cuentas con usuario + contraseña (accounts.mjs); un personaje por cuenta, progreso en server/data/saves.json.
// - Una conexión WebSocket en /ws por jugador. La simulación es la misma que en local (web/src/shared) a 20 Hz y todo el mundo
//   (granja, ciudad, tiendas, arena) es compartido; las criptas son privadas por jugador, como en la versión local.
// - Cada jugador recibe solo lo que tiene cerca y solo lo que ha cambiado. El estado completo se manda únicamente al propio jugador.
// - También sirve la web (carpeta web/), para jugar sin GitHub: http://localhost:PUERTO/. El cliente de GitHub Pages se conecta a /ws
//   de este servidor (data/server.json) a través de un túnel (docs/ONLINE.md).
// - Administración: comandos de chat para cuentas admin, consola del servidor y panel /admin (solo desde este PC).
import { exportReg as exportGuilds, importReg as importGuilds } from "../web/src/shared/systems/guild.js";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { setDungeonPalette } from "../web/src/shared/dungeon.js";
import { DEBUG } from "../web/src/shared/systems/debug.js";
DEBUG.enabled = process.env.HB_DEBUG !== "0";            // las herramientas de prueba (F1) abiertas a todos; HB_DEBUG=0 las apaga
import { GameData } from "../web/src/shared/data.js";
import { damageRange } from "../web/src/shared/combat.js";
import { attackMs } from "../web/src/shared/world.js";
import { LIMITS, PLAYER, NET_PROTO } from "../web/src/shared/const.js";
import { apparelOf } from "../web/src/shared/appearance.js";
import { validCharName } from "../web/src/shared/systems/player.js";
import { openStore } from "./store.mjs";
import { openLlm } from "./llm.mjs";
import { openReport } from "./report.mjs";
import * as Residents from "../web/src/shared/systems/residents.js";
import { RESIDENT_NAMES } from "../web/src/shared/systems/residents.js";
import { Accounts, Limiter, cleanName, validName, readJson, writeJson } from "./accounts.mjs";
import { ADMIN_PAGE, helpText } from "./admin.mjs";

const PROTO = NET_PROTO;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..", "web");
const DATA = path.join(WEB, "data");
const CFG = { port: 8088, maxPlayers: 40, origins: ["https://sans-pablo.github.io"], admins: [], publicUrl: "", ...readJson(path.join(HERE, "config.json"), {}) };
const env = process.env;
const PORT = Number(process.argv[2] || env.PORT || CFG.port);
const MAX_PLAYERS = Number(env.HB_MAX || CFG.maxPlayers);
const ORIGINS = (env.HB_ORIGINS ? env.HB_ORIGINS.split(",") : CFG.origins).map(o => o.trim().replace(/\/$/, "")).filter(Boolean);
const ADMINS = new Set((env.HB_ADMINS ? env.HB_ADMINS.split(",") : CFG.admins).map(n => n.trim().toLowerCase()).filter(Boolean));
const STORE = env.HB_DATA || path.join(HERE, "data");                  // cuentas, partidas, bloqueos (no se versionan)
const store = await openStore(STORE, { accountsFile: env.ACCOUNTS_FILE, savesFile: env.SAVE_FILE, log: (...a) => console.log(...a) });    // SQLite (store.mjs)
const accounts = new Accounts("", store);
const BANS = path.join(STORE, "bans.json");
const bans = readJson(BANS, { accounts: {}, ips: {} });
const TOKEN_FILE = path.join(STORE, "admin-token.txt");
let ADMIN_TOKEN = env.HB_ADMIN_TOKEN || CFG.adminToken || "";
if (!ADMIN_TOKEN) { try { ADMIN_TOKEN = fs.readFileSync(TOKEN_FILE, "utf8").trim(); } catch {} }
if (!ADMIN_TOKEN) { ADMIN_TOKEN = crypto.randomBytes(12).toString("hex"); try { fs.mkdirSync(STORE, { recursive: true }); fs.writeFileSync(TOKEN_FILE, ADMIN_TOKEN); } catch {} }
const VERSION = readJson(path.join(DATA, "version.json"), { version: "?", name: "" });
const TICK_MS = 50;
const VIEW = 26;                   // casillas alrededor del jugador que se le envían
const MAX_MSG_PER_SEC = 60;        // por conexión: más es un cliente roto o un ataque
const IDLE_MS = 45000;             // sin mensajes (el cliente manda un ping cada 2 s) => conexión muerta
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ------------------------------------------------------------------ mundo
const meta = JSON.parse(fs.readFileSync(path.join(DATA, "map.json")));
const bytes = new Uint8Array(fs.readFileSync(path.join(DATA, meta.map + ".bin")));
const npcDb = JSON.parse(fs.readFileSync(path.join(DATA, "npc.json")));
const spawns = JSON.parse(fs.readFileSync(path.join(DATA, meta.map + ".spawns.json")));
const grid = new Grid(meta.w, meta.h, bytes);
const data = new GameData({ items: JSON.parse(fs.readFileSync(path.join(DATA, "items.json"))), magic: JSON.parse(fs.readFileSync(path.join(DATA, "magic.json"))), npcs: npcDb });
setDungeonPalette(JSON.parse(fs.readFileSync(path.join(DATA, "dungeon_palette.json"))));
const maps = {};
try {
  for (const id of Object.keys(JSON.parse(fs.readFileSync(path.join(DATA, "maps", "index.json"))))) {
    const mm = JSON.parse(fs.readFileSync(path.join(DATA, "maps", id + ".json")));
    maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(fs.readFileSync(path.join(DATA, "maps", id + ".bin")))) };
  }
} catch {}
const adventure = new Adventure({ grid, npcDb, data, spawns, start: meta.start, maps, clock: () => new Date().getMinutes() });   // día y noche como el cliente local

const clients = new Set();
const saves = store.saves;
// Habitantes: bots permanentes del servidor (systems/residents.js). Su partida vive en saves["bot:<nombre>"] y se guarda con la de los jugadores.
const OBSERVE = env.HB_OBSERVE !== "0" && CFG.observe !== false;           // modo observar: ver jugar a un habitante en vivo desde la pantalla de entrada
const RESIDENTS = Math.max(0, Math.min(40, Number(env.HB_RESIDENTS ?? CFG.residents ?? 40) | 0));
const bkey = n => "bot:" + n.toLowerCase();
function spawnResidents(n) {
  const have = new Set(adventure.residents().map(b => b.name));
  let made = 0;
  for (const name of RESIDENT_NAMES) {
    if (adventure.residents().length >= n) break;
    if (have.has(name)) continue;
    try { adventure.spawnResident(name, saves[bkey(name)] || null); made++; } catch (e) { console.error("habitante " + name + ":", e.message); }
  }
  return made;
}
function persist(force = false) {
  for (const c of clients) if (c.pid) saves[c.key] = adventure.saveOf(c.pid) || saves[c.key];
  for (const b of adventure.residents()) { const s = adventure.saveOf(b.id); if (s) saves[bkey(b.name)] = s; }
  saves["sys:guilds"] = { list: exportGuilds(adventure.guildReg) };               // los guilds (systems/guild.js) viven en la misma base que los personajes
  try { store.flush(force); } catch (e) { console.error("No se pudo guardar:", e.message); }
}
// Segunda ronda de análisis: al subir BOT_EPOCH todos los habitantes vuelven a nivel 1 y el informe se archiva y empieza vacío (una sola vez por época).
const BOT_EPOCH = "2";
function resetResidents() {
  for (const k of Object.keys(saves)) if (k.startsWith("bot:") || k === "sys:guilds") delete saves[k];
  try { const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"); for (const f of ["informe-bots.jsonl", "Informe de bots.md"]) { const p = path.join(STORE, f); if (fs.existsSync(p)) fs.renameSync(p, path.join(STORE, "ronda-" + stamp + " " + f)); } } catch (e) { console.error("archivo del informe:", e.message); }
}
{ const ef = path.join(STORE, "bots-epoch.txt"); let cur = ""; try { cur = fs.readFileSync(ef, "utf8").trim(); } catch {}
  if (cur !== BOT_EPOCH) { resetResidents(); try { fs.writeFileSync(ef, BOT_EPOCH); } catch {} log("[habitantes] época " + BOT_EPOCH + ": los habitantes empiezan de nuevo en nivel 1 y el informe anterior queda archivado."); } }
const informe = openReport(STORE, { version: VERSION.version, log });
adventure.report = r => informe.add(r);               // los habitantes avisan de fallos, incomodidades, balance e ideas (server/report.mjs)
importGuilds(adventure.guildReg, saves["sys:guilds"]?.list);
spawnResidents(RESIDENTS);
setInterval(() => { try { if (adventure.residents().length < RESIDENTS && spawnResidents(RESIDENTS)) log("[habitantes] repuestos hasta " + adventure.residents().length); } catch {} }, 60000).unref();      // siempre hay habitantes: si alguno falta, se repone
persist(true);                                          // sus nombres quedan reservados desde el primer momento
const saveTimer = setInterval(persist, 5000);          // solo se escriben los personajes que cambiaron; WAL: sobrevive a cerrar la ventana

// ------------------------------------------------------------------ web estática
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".bin": "application/octet-stream", ".css": "text/css",
  ".svg": "image/svg+xml", ".ico": "image/x-icon",
};
// IP del cliente: detrás de un túnel (ngrok, Tailscale, Cloudflare) llega la del túnel y la real va en x-forwarded-for
const isLoopback = a => a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
const viaTunnel = req => !!(req.headers["x-forwarded-for"] || req.headers["cf-connecting-ip"] || req.headers["x-forwarded-host"]);
const ipOf = req => String(req.headers["cf-connecting-ip"] || (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "").replace("::ffff:", "");
// origen permitido: el de GitHub Pages configurado, el propio servidor y localhost (pruebas); sin cabecera Origin (no es un navegador) también
function originOk(req) {
  const o = req.headers.origin;
  if (!o) return true;
  const org = o.replace(/\/$/, "");
  if (ORIGINS.includes(org) || ORIGINS.includes("*")) return true;
  try { const u = new URL(org); return u.host === req.headers.host || u.hostname === "localhost" || u.hostname === "127.0.0.1"; } catch { return false; }
}
const cors = req => originOk(req) && req.headers.origin ? { "Access-Control-Allow-Origin": req.headers.origin, "Vary": "Origin", "Access-Control-Allow-Headers": "content-type, ngrok-skip-browser-warning" } : {};
const json = (req, res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-cache", ...cors(req) }); res.end(JSON.stringify(obj)); };
const adminAllowed = (req, url) => isLoopback(req.socket.remoteAddress) && !viaTunnel(req) && url.searchParams.get("token") === ADMIN_TOKEN;   // el panel solo desde este PC

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204, { ...cors(req), "Access-Control-Max-Age": "600" }); res.end(); return; }
  if (url.pathname === "/api/info") {
    json(req, res, 200, { multiplayer: true, proto: PROTO, version: VERSION.version, name: VERSION.name, max: MAX_PLAYERS, players: [...clients].filter(c => c.pid).map(c => c.name) });
    return;
  }
  if (url.pathname === "/admin") {
    if (!adminAllowed(req, url)) { res.writeHead(403); res.end("Solo desde el PC del servidor y con el token correcto."); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); res.end(ADMIN_PAGE); return;
  }
  if (url.pathname === "/api/admin/state") {
    if (!adminAllowed(req, url)) { res.writeHead(403); res.end(); return; }
    json(req, res, 200, adminState()); return;
  }
  if (url.pathname === "/api/admin/cmd" && req.method === "POST") {
    if (!adminAllowed(req, url)) { res.writeHead(403); res.end(); return; }
    let body = ""; req.on("data", d => { body += d; if (body.length > 2000) req.destroy(); });
    req.on("end", () => { let line = ""; try { line = JSON.parse(body).line; } catch {} json(req, res, 200, { out: adminCmd(String(line || ""), "panel") }); });
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
const connsOf = ip => [...clients].filter(c => c.ip === ip).length;
const MAX_CONN_IP = 6;

server.on("upgrade", (req, socket) => {
  const ip = ipOf(req);
  if (new URL(req.url, "http://x").pathname !== "/ws" || !req.headers["sec-websocket-key"]) { socket.destroy(); return; }
  if (!originOk(req)) { socket.write("HTTP/1.1 403 Forbidden\r\n\r\n"); socket.destroy(); return; }
  if (bans.ips[ip] || connsOf(ip) >= MAX_CONN_IP) { socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n"); socket.destroy(); return; }
  const accept = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
  socket.setNoDelay(true);
  const c = { socket, ip, buf: Buffer.alloc(0), pid: null, name: "", key: "", acc: null, queue: [], ack: 0, sent: new Map(), itemsVer: -1, alive: true, frag: null,
    lastMsg: Date.now(), rate: { t: 0, n: 0 }, lastSay: 0, busy: false, since: Date.now(), ping: 0 };
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
    if (len > 1 << 16) { c.socket.destroy(); return; }
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
      if (c.frag.length > 1 << 16) { c.socket.destroy(); return; }
      if (fin) {
        const text = c.frag.toString("utf8"); c.frag = null;
        const now = Date.now(), r = c.rate;
        if (now - r.t > 1000) { r.t = now; r.n = 0; }
        if (++r.n > MAX_MSG_PER_SEC) { if (r.n > MAX_MSG_PER_SEC * 4) c.socket.destroy(); continue; }       // inundación: se ignora y, si sigue, se corta
        c.lastMsg = now;
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
const sysMsg = (c, text) => send(c, { t: "msg", text });
const online = () => [...clients].filter(c => c.pid).length;

function drop(c, why) {
  if (!c.alive) return;
  if (why) { send(c, { t: "kicked", msg: why }); setTimeout(() => c.socket.destroy(), 100); }
  c.alive = false;
  clients.delete(c);
  if (c.watch) { const still = [...clients].some(o => o.watch === c.watch); if (!still) adventure.watched.delete(c.watch); c.watch = 0; }
  if (c.pid) {
    saves[c.key] = adventure.saveOf(c.pid) || saves[c.key];
    adventure.worldFor(c.pid).emit({ t: "chat", id: c.pid, name: "Servidor", text: c.name + " ha salido.", system: true });
    adventure.removePlayer(c.pid);
    log(`[-] ${c.name} se ha ido (${online()} conectados)`);
    persist(true);                                   // al salir: copia al historial
    c.pid = null;
  }
}

// ------------------------------------------------------------------ protocolo
//  cliente -> servidor:  auth {mode: login|register, name, pass, proto} · join {create?} · cmd {seq, cmd} · ping {c}
//  servidor -> cliente:  authok {name, hasChar, admin, proto, version} · welcome {id, time, returning, version, admin} · s {estado} · msg {text} · error {msg} · kicked {msg}
const NO_LIMITS = env.HB_NO_LIMITS === "1";                 // solo para pruebas locales (muchas cuentas desde la misma IP)
const loginFails = new Limiter(NO_LIMITS ? 1e9 : 8, 10 * 60000), registers = new Limiter(1e9, 60 * 60000);   // sin límite de cuentas por IP (decisión del propietario; el limitador queda inerte)
setInterval(() => { loginFails.sweep(); registers.sweep(); }, 60000).unref();

async function handleAuth(c, m) {
  if (c.busy) return;
  c.busy = true;
  try {
    if (m.proto !== PROTO) { send(c, { t: "error", code: "proto", msg: `Versión del juego distinta de la del servidor (servidor ${VERSION.version}). Recarga la página (Ctrl+F5).` }); return; }
    const name = cleanName(m.name), pass = m.pass;
    if (!validName(name)) { send(c, { t: "error", msg: "El usuario debe tener de 3 a 16 letras, números, _ o -." }); return; }
    if (loginFails.blocked(c.ip)) { send(c, { t: "error", msg: "Demasiados intentos. Espera unos minutos." }); return; }
    let acc;
    if (m.mode === "register") {
      if (!registers.hit(c.ip)) { send(c, { t: "error", msg: "Demasiadas cuentas creadas desde tu conexión. Inténtalo más tarde." }); return; }
      const r = await accounts.register(name, pass, c.ip);
      if (r.err) { send(c, { t: "error", msg: r.err }); return; }
      acc = accounts.get(name);
      log(`[cuenta] ${name} creada (${c.ip})`);
    } else {
      acc = await accounts.verify(name, pass);
      if (!acc) { loginFails.hit(c.ip); send(c, { t: "error", msg: "Usuario o contraseña incorrectos." }); return; }
      loginFails.clear(c.ip);
    }
    const key = acc.name.toLowerCase();
    if (bans.accounts[key]) { send(c, { t: "error", msg: "Cuenta bloqueada" + (bans.accounts[key].why ? ": " + bans.accounts[key].why : ".") }); return; }
    c.acc = acc.name; c.key = key; c.name = acc.name;
    send(c, { t: "authok", name: acc.name, hasChar: !!saves[key], admin: ADMINS.has(key), proto: PROTO, version: VERSION.version });
  } finally { c.busy = false; }
}

function handleJoin(c, m) {
  if (c.pid) return;
  if (!c.acc) { send(c, { t: "error", code: "auth", msg: "Inicia sesión primero." }); return; }
  const key = c.key;
  for (const o of [...clients]) if (o !== c && o.pid && o.key === key) drop(o, "Has entrado desde otro sitio.");      // la sesión nueva sustituye a la vieja (p. ej. tras un corte de red)
  if (online() >= MAX_PLAYERS) { send(c, { t: "error", msg: "El servidor está lleno." }); return; }
  if (!saves[key] && !(m.create && typeof m.create === "object")) { send(c, { t: "error", code: "create", msg: "Crea tu personaje." }); return; }
  const had = !!saves[key];
  let charName = c.acc;
  if (!had) {                                                                         // personaje nuevo: nombre propio, único en el servidor
    const wanted = String(m.create.name ?? "").normalize("NFC").trim();
    if (wanted) {
      if (!validCharName(wanted)) { send(c, { t: "error", code: "create", msg: "Nombre de personaje no válido." }); return; }
      if (Object.entries(saves).some(([k, v]) => k !== key && String(v.charName || k).toLowerCase() === wanted.toLowerCase())) { send(c, { t: "error", code: "create", msg: "Ese nombre de personaje ya está en uso." }); return; }
      charName = wanted;
    }
  }
  c.pid = adventure.addPlayer(charName, saves[key], had ? null : m.create);
  const p = adventure.worldFor(c.pid).ents.get(c.pid);
  c.name = p?.name || c.acc;
  if (!saves[key]) { saves[key] = adventure.saveOf(c.pid); persist(true); }       // personaje nuevo: a disco ya, no a los 5 s
  send(c, { t: "welcome", id: c.pid, time: adventure.time, returning: had, version: VERSION.version, admin: ADMINS.has(key) });
  log(`[+] ${c.name} (${c.acc}) ha entrado (${online()} conectados)`);
  adventure.farm.emit({ t: "chat", id: c.pid, name: "Servidor", text: c.name + " ha entrado en la granja.", system: true });
}

function onMessage(c, text) {
  let m;
  try { m = JSON.parse(text); } catch { return; }
  if (!m || typeof m !== "object") return;
  if (m.t === "auth" && !c.acc) { handleAuth(c, m).catch(e => { console.error("auth:", e); send(c, { t: "error", msg: "Error del servidor." }); }); return; }
  if (m.t === "join") { handleJoin(c, m); return; }
  if (m.t === "bots") { if (OBSERVE) send(c, { t: "botlist", list: botList() }); else send(c, { t: "error", msg: "El modo observar está desactivado en este servidor." }); return; }
  if (m.t === "watch" && OBSERVE) {                                              // observar a un habitante en vivo (no hace falta cuenta)
    const b = adventure.bots.get(m.id | 0);
    if (!b) { send(c, { t: "error", msg: "Ese habitante ya no existe." }); return; }
    if (c.watch) adventure.watched.delete(c.watch);
    c.watch = b.id; adventure.watched.add(b.id); c.sent.clear(); c.ownJs = null; c.itemsKey = null; c.mapId = null; c.queue.length = 0;
    send(c, { t: "watching", id: b.id, name: b.name, time: adventure.time });
    log(`[observar] ${c.name || c.ip} mira a ${b.name}`);
    return;
  }
  if (m.t === "unwatch") { if (c.watch) { adventure.watched.delete(c.watch); c.watch = 0; send(c, { t: "unwatched" }); } return; }
  if (m.t === "cmd" && c.pid && !c.watch && m.cmd && typeof m.cmd.t === "string") {
    const cmd = m.cmd;
    if (cmd.t === "say") {                                                            // chat: límites, silencio y comandos de administrador
      const txt = String(cmd.text ?? "").slice(0, 120).trim(), now = Date.now();
      if (!txt) return;
      if (ADMINS.has(c.key) && txt.startsWith("/")) { for (const l of String(adminCmd(txt.slice(1), c.name) || "").split("\n")) if (l) sysMsg(c, l); return; }
      if (muted.get(c.key) > now) { sysMsg(c, "Estás silenciado."); return; }
      if (now - c.lastSay < 600) return;
      c.lastSay = now; cmd.text = txt;
    }
    if (c.queue.length > 6) c.queue.shift();
    c.queue.push({ seq: m.seq | 0, cmd, at: Date.now() });
  }
  if (m.t === "ping") { c.ping = Math.max(0, Math.min(9999, m.p | 0)); send(c, { t: "pong", c: m.c, time: adventure.time }); }
}

// ------------------------------------------------------------------ administración
const muted = new Map();                                   // cuenta -> instante en que acaba el silencio
const byName = n => [...clients].find(c => c.pid && (c.name.toLowerCase() === n.toLowerCase() || c.key === n.toLowerCase()));
const saveBans = () => { try { writeJson(BANS, bans); } catch {} };
let onExit = code => { persist(true); store.close(); process.exit(code); };

function adminState() {
  return {
    version: VERSION.version, name: VERSION.name, port: PORT, publicUrl: CFG.publicUrl, uptime: Math.round(process.uptime()), max: MAX_PLAYERS, accounts: Object.keys(accounts.db).length,
    players: [...clients].filter(c => c.pid).map(c => { const w = adventure.worldFor(c.pid), p = w.ents.get(c.pid); return { name: c.name, account: c.acc, level: p?.level, map: w.map.name || w.map.id, ip: c.ip, ping: c.ping, secs: Math.round((Date.now() - c.since) / 1000), muted: (muted.get(c.key) || 0) > Date.now() }; }),
    bans: { accounts: Object.keys(bans.accounts), ips: Object.keys(bans.ips) },
  };
}

// Un comando por línea (sin la barra): chat de un admin, consola del servidor o panel web. Devuelve el texto de respuesta.
function adminCmd(line, by) {
  const [cmd, ...rest] = line.trim().replace(/^\//, "").split(/\s+/), arg = rest.join(" ");
  const who = rest[0] ? byName(rest[0]) : null;
  switch ((cmd || "").toLowerCase()) {
    case "": case "help": case "ayuda": return helpText();
    case "who": case "quien": { const st = adminState(); return `${st.players.length}/${MAX_PLAYERS} conectados\n` + st.players.map(p => `${p.name} (nv ${p.level}, ${p.map}${p.muted ? ", silenciado" : ""})`).join("\n"); }
    case "kick": case "expulsar": if (!who) return "No está conectado: " + (rest[0] || "?"); log(`[admin] ${by} expulsa a ${who.name}`); drop(who, "Expulsado por un administrador" + (rest[1] ? ": " + rest.slice(1).join(" ") : ".")); return who.name + " expulsado.";
    case "mute": case "silenciar": { if (!who) return "No está conectado: " + (rest[0] || "?"); const min = Math.max(1, Math.min(1440, +rest[1] || 10)); muted.set(who.key, Date.now() + min * 60000); sysMsg(who, `Te han silenciado ${min} min.`); return `${who.name} silenciado ${min} min.`; }
    case "unmute": case "desilenciar": { const k = (rest[0] || "").toLowerCase(); const had = muted.delete(k) || (who && muted.delete(who.key)); return had ? "Silencio quitado." : "No estaba silenciado."; }
    case "ban": case "bloquear": {
      const key = (rest[0] || "").toLowerCase(); if (!accounts.get(key)) return "No existe esa cuenta: " + (rest[0] || "?");
      bans.accounts[key] = { why: rest.slice(1).join(" "), at: Date.now(), by }; saveBans(); const c = byName(key); if (c) drop(c, "Cuenta bloqueada."); log(`[admin] ${by} bloquea ${key}`); return "Cuenta bloqueada: " + key; }
    case "unban": case "desbloquear": { const key = (rest[0] || "").toLowerCase(); const had = delete bans.accounts[key] | delete bans.ips[key]; saveBans(); return had ? "Desbloqueado: " + key : "No estaba bloqueado."; }
    case "banip": { const ip = rest[0]; if (!ip) return "Uso: banip <ip>"; bans.ips[ip] = { at: Date.now(), by }; saveBans(); for (const c of [...clients]) if (c.ip === ip) drop(c, "Bloqueado."); return "IP bloqueada: " + ip; }
    case "say": case "decir": case "anuncio": { if (!arg) return "Uso: say <texto>"; for (const w of adventure.worlds.values()) w.emit({ t: "chat", id: 0, name: "Servidor", text: arg, system: true }); return "Enviado."; }
    case "resetpass": case "clave": {
      const a = accounts.get(rest[0] || ""); if (!a || !rest[1] || rest[1].length < 6) return "Uso: resetpass <usuario> <nueva clave de 6+ caracteres>";
      const salt = crypto.randomBytes(16); a.salt = salt.toString("hex"); a.hash = crypto.scryptSync(rest[1], salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex"); accounts.save(); return "Clave cambiada para " + a.name; }
    case "save": case "guardar": persist(true); return "Guardado (" + store.kind + ").";
    case "versions": case "versiones": { const k = (rest[0] || "").toLowerCase(); const v = store.versions(k); return v.length ? v.map((t, i) => i + ": " + new Date(t).toLocaleString("es")).join("\n") : "Sin copias para " + k; }
    case "restore": case "restaurar": {            // restaurar <usuario> <n>: devuelve una versión anterior del personaje (el jugador debe estar desconectado)
      const k = (rest[0] || "").toLowerCase(), v = store.versions(k), at = v[Number(rest[1] || 0)];
      if (byName(k)) return "Desconecta primero a " + k;
      return at && store.restore(k, at) ? "Personaje " + k + " restaurado a " + new Date(at).toLocaleString("es") : "No hay esa copia (usa: versions " + k + ")"; }
    case "habitantes": case "residents": {
      const R = adventure.residents();
      if (rest[0] && /^\d+$/.test(rest[0])) { const n = Math.min(40, +rest[0]); while (adventure.residents().length > n) { const b = adventure.residents().pop(); saves[bkey(b.name)] = adventure.saveOf(b.id); adventure.removePlayer(b.id); } spawnResidents(n); persist(true); return "Habitantes: " + adventure.residents().length; }
      return `${R.length} habitantes · IA: ${adventure.llm ? "sí" : "no (frases propias)"}\n` + R.map(b => `${b.name} nv ${b.level} (${b.res.arch}) meta: ${b.res.goal ? b.res.goal.k : "-"}`).join("\n"); }
    case "informe": case "report": { if (rest[0] === "borrar") { informe.clear(); return "Informe vaciado."; } informe.flush(); return informe.file + "\n" + JSON.stringify(informe.size()) + "\n\n" + informe.text().slice(0, 3500); }
    case "vida": case "life": {
      const b = adventure.residents().find(x => x.name.toLowerCase() === (rest[0] || "").toLowerCase()); if (!b) return "Uso: vida <nombre de habitante>";
      return Residents.storyOf(b, "es") + "\nMeta: " + Residents.goalText(b.res.goal, "es") + "\nAmigos: " + (Object.keys(b.res.rel).join(", ") || "ninguno") + "\nRecuerdos:\n- " + b.res.mem.map(m => m.es).join("\n- ") + "\nÚltimas acciones:\n" + (b.bot.log || []).slice(-25).join("\n"); }
    case "restart": case "reiniciar": case "stop": case "parar": {
      const restart = /^(restart|reiniciar)$/i.test(cmd);
      for (const c of [...clients]) drop(c, restart ? "El servidor se reinicia. Vuelve a entrar en un minuto." : "El servidor se apaga.");
      setTimeout(() => onExit(restart ? 42 : 0), 300); return restart ? "Reiniciando…" : "Apagando…"; }
    default: return "Comando desconocido. " + helpText();
  }
}
setInterval(() => { const now = Date.now(); for (const c of [...clients]) if (now - c.lastMsg > IDLE_MS) { log(`[idle] ${c.name || c.ip}`); drop(c, "Sin respuesta."); c.socket.destroy(); } }, 5000).unref();

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
// Estado completo del propio jugador (lo que usa toda la interfaz: mochila, magia, talentos, tutorial, compañeros...). Lo que predice el cliente
// (posición, acción, vida) va aparte en los campos cortos para no pisar la predicción. JSON puro: sin funciones ni referencias.
const OWN_SKIP = new Set(["id", "kind", "name", "x", "y", "fx", "fy", "dir", "act", "actStart", "actDur", "busyUntil", "lastMove", "lastAttack", "lastCombat", "dead", "hp"]);
const ownReplacer = (k, v) => typeof v === "function" || v instanceof Map || v instanceof Set || (k[0] === "_") ? undefined : v;
function ownState(e) {
  const o = {};
  for (const k in e) if (!OWN_SKIP.has(k)) o[k] = e[k];
  o.atkMs = attackMs(e); o.dmg = damageRange(e);
  return JSON.parse(JSON.stringify(o, ownReplacer));
}
function pub(e, own) {
  const o = { id: e.id, k: e.kind, name: e.name, x: e.x, y: e.y, fx: e.fx, fy: e.fy, dir: e.dir, act: e.act,
    s: r1(e.actStart), d: e.actDur, dead: e.dead ? 1 : 0, hp: e.hp, mh: e.maxHp };
  if (e.role) o.rl = e.role;
  if (e.comp) { o.cp = 1; o.nk = e.nick; o.cl = e.clvl; o.mt = e.master; if (e.evoK) o.ek = Math.round(e.evoK * 100); if (e.dcls) o.dc = e.dcls; if (e.maxMpC) { o.mp = Math.floor(e.mp ?? 0); o.mm = e.maxMpC; } }
  if (e.arena) { o.ar = 1; o.nk = e.nick; o.cl = e.clvl; }
  if (e.kind === "npc" || e.kind === "citizen") { o.type = e.type; o.sp = e.special; o.ph = r1(e.phase); if (e.boss) o.bs = e.boss; const bx = (e.clone ? 1 : 0) | (e.crystal ? 2 : 0) | (e.shield ? 4 : 0) | (e.hasClones ? 8 : 0) | (e.ghost ? 16 : 0); if (bx) o.bx = bx; if (e.wrath) o.wr = e.wrath; if (e.owner) o.ow = e.owner; }
  else {
    if (e.side) o.sd = e.side;                                                   // bando (1 Aresden, 2 Elvine): el cartel de nombre lo muestra y marca enemigos
    o.mp = e.mp; o.mm = e.maxMp;                                                // maná visible para el grupo (marcos de grupo)
    o.lc = r1(e.lastCombat); o.lk = [e.gender, e.look.skin, e.look.hair, e.look.hairCol, e.look.under];
    if (e.guild) o.gd = [e.guild.name, e.guild.rank, e.guild.cape, e.guild.boots];                 // guild visible: nombre bajo el personaje y colores
    o.ap = apparelOf(e, id => data.item(id));                                  // equipo visible para los demás jugadores
    if (own) { Object.assign(o, { bu: r1(e.busyUntil), la: r1(e.lastAttack), lm: r1(e.lastMove) }); o.o = ownState(e); }
  }
  return o;
}

function botList() {
  return [...adventure.bots.values()].map(b => {
    const w = adventure.worldFor(b.id), br = b.bot || {}, t = br.target;
    const st = b.dead ? "muerto" : br.travel ? "viaja" : t ? "lucha: " + String(t.name).replace(/-/g, " ") : br.rest ? "descansa" : br.owner != null ? "sigue al líder" : "pasea";
    return { id: b.id, name: b.name, side: b.side, lv: b.level, map: w.map.name || w.map.id, x: b.x, y: b.y, hp: b.hp, mh: b.maxHp, mp: b.mp, mm: b.maxMp, st: b.stats, gold: b.gold, kills: b.kills || 0, ek: b.ek || 0,
      lang: b.res?.lang || "", arch: b.res?.arch || "", goal: b.res ? Residents.goalText(b.res.goal, "es") : "", party: b.party?.names?.length || 0, act: st, exp: Math.round(100 * (b.exp - b.prevExp) / Math.max(1, b.nextExp - b.prevExp)) };
  }).sort((a, b) => (a.side - b.side) || (b.lv - a.lv) || a.name.localeCompare(b.name));
}
function itemsList(world) {
  const out = [];
  for (const list of world.items.values()) { const it = list[list.length - 1]; out.push([it.uid, it.id, it.count, it.x, it.y, it.attr || 0, it.comp ? { sp: it.comp.sp, lvl: it.comp.lvl, nm: it.comp.nm, cls: it.comp.cls, down: it.comp.down } : 0]); }   // solo se ve el de encima (las bolas llevan su especie para el nombre)
  return out;
}

// Eventos visibles para quien está cerca (efectos, sonidos, números de daño). Todo lo demás con `id` es privado de su dueño: tienda, tutorial,
// talentos, arena, avisos, depuración... (un evento nuevo es privado por defecto: no se filtra nada por olvido, y no se gasta ancho de banda).
const PUBLIC = new Set(["botsay", "attack", "companion-resummon", "damage", "miss", "spell", "cast", "prepare", "heal", "death", "spawn", "remove", "step", "status", "knock", "explode", "field", "fieldend", "ghost",
  "bossfx", "bossmsg", "pickup", "teleport", "respawn", "recalled", "immune", "resist", "levelup", "weather", "time"]);

let last = Date.now();
setInterval(() => {
  const now = Date.now(), dt = Math.min(250, now - last);
  last = now;
  for (const c of clients) if (c.pid) processQueue(c);
  adventure.tick(dt);
  const eventsByMap = adventure.drainEvents();
  const perWorld = new Map();                              // por mundo y tick: lo que es igual para todos los clientes se calcula una sola vez
  const shared = world => {
    let s = perWorld.get(world);
    if (!s) {
      const items = itemsList(world);
      s = { pubs: new Map(), items, itemsKey: JSON.stringify(items), fxj: JSON.stringify([world.dyn || [], world.bfx || []]), sk: (world.fixedDay ? 1 : 0) + "," + (world.dayOrNight || 1) + "," + (world.weather || 0) };
      perWorld.set(world, s);
    }
    return s;
  };
  for (const c of clients) {
    const vid = c.watch || c.pid;                           // modo observar: el cliente ve el mundo desde un habitante en vez de desde su personaje
    if (!vid) continue;
    const world = adventure.worldFor(vid);
    const me = world.ents.get(vid);
    const events = eventsByMap.get(world.map.id) || [];
    if (!me) { if (c.watch) { c.watch = 0; adventure.watched.delete(vid); send(c, { t: "unwatched", why: "El habitante ya no está." }); } continue; }
    const sh = shared(world);
    if (c.socket.writableLength > 1 << 20) continue;     // conexión atascada: saltar este envío
    const mapChanged = c.mapId !== world.map.id;
    if (mapChanged) { c.sent.clear(); c.ownJs = null; c.itemsKey = null; c.mapId = world.map.id; }
    const changed = [], seen = new Set();
    for (const e of world.ents.values()) {
      if (e !== me && e.kind === "npc" && (Math.abs(e.x - me.x) > VIEW || Math.abs(e.y - me.y) > VIEW)) continue;
      seen.add(e.id);
      let o, js;
      if (e === me) {                                       // el estado completo del propio jugador (~1 KB) solo viaja cuando cambia; el resto, cada tick
        o = pub(e, true); const oo = o.o; delete o.o; js = JSON.stringify(o);
        const oj = JSON.stringify(oo);
        if (c.ownJs !== oj) { c.ownJs = oj; o = { ...o, o: oo }; if (c.sent.get(e.id) === js) c.sent.delete(e.id); }
      }
      else { let pj = sh.pubs.get(e); if (!pj) { o = pub(e, false); pj = [o, JSON.stringify(o)]; sh.pubs.set(e, pj); } [o, js] = pj; }
      if (c.sent.get(e.id) !== js) { c.sent.set(e.id, js); changed.push(o); }
    }
    const gone = [];
    for (const id of c.sent.keys()) if (!seen.has(id)) { gone.push(id); c.sent.delete(id); }
    const logs = [];
    const ev = events.filter(v => {
      if (v.t === "botlog") { if (v.id === vid && c.watch) logs.push(v.text); return false; }
      if (v.id === vid) return true;
      if (v.t === "chat") return v.system || v.ch !== "local" && v.ch !== "side" || (v.ch === "local" ? Math.abs(v.x - me.x) <= 24 && Math.abs(v.y - me.y) <= 24 : v.side === me.side);       // canales del original: local por cercanía, bando por bando, grito a todo el mapa
      return v.t === "drop" || (PUBLIC.has(v.t) && seen.has(v.id));       // lo demás es privado de su dueño
    });
    const msg = { t: "s", time: r1(world.time), ack: c.ack };
    if (mapChanged || c.remainingEnemies !== world.map.remainingEnemies) {
      msg.map = world.map;
      c.remainingEnemies = world.map.remainingEnemies;
    }
    const sk = sh.sk;
    if (c.sky !== sk) { c.sky = sk; msg.sk = sk.split(",").map(Number); }
    const fxj = sh.fxj;
    if (c.fxj !== fxj) { c.fxj = fxj; msg.fx = JSON.parse(fxj); }
    if (changed.length) msg.e = changed;
    if (gone.length) msg.g = gone;
    if (ev.length) msg.ev = ev;
    if (c.itemsKey !== sh.itemsKey) { msg.it = sh.items; c.itemsKey = sh.itemsKey; }
    const quiet = !(msg.map || msg.sk || msg.fx || msg.e || msg.g || msg.ev || msg.it) && msg.ack === c.lastAck;
    if (quiet && now - (c.lastSentAt || 0) < 400) { for (const l of logs.slice(-8)) sysMsg(c, "[" + me.name + "] " + l); continue; }     // tick sin novedades: se manda el reloj solo cada 0,4 s (ahorra ancho de banda del túnel)
    c.lastAck = msg.ack; c.lastSentAt = now;
    send(c, msg);
    for (const l of logs.slice(-8)) sysMsg(c, "[" + me.name + "] " + l);              // lo que piensa y hace el habitante observado, en el chat
  }
}, TICK_MS);

// ------------------------------------------------------------------ arranque
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Helbreath Web ${VERSION.version} «${VERSION.name}» - servidor online (protocolo ${PROTO})`);
  console.log("  En este PC:        http://localhost:" + PORT + "/");
  let interfaces = {};
  try { interfaces = os.networkInterfaces(); } catch {} // Algunos entornos aíslan esta consulta.
  for (const list of Object.values(interfaces))
    for (const a of list || []) if (a.family === "IPv4" && !a.internal) console.log("  En tu red local:   http://" + a.address + ":" + PORT + "/");
  if (CFG.publicUrl) console.log("  Dirección pública: " + CFG.publicUrl);
  console.log("  Panel de administración (solo en este PC): http://localhost:" + PORT + "/admin?token=" + ADMIN_TOKEN);
  console.log("  Cuentas: " + Object.keys(accounts.db).length + " · admins: " + ([...ADMINS].join(", ") || "ninguno (config.json → admins)") + " · orígenes: " + ORIGINS.join(", "));
  console.log("  Monstruos: " + [...adventure.farm.ents.values()].filter(e => e.kind === "npc").length + ".  Datos en " + STORE + "  ·  escribe «help» para los comandos de administración");
});
adventure.llm = openLlm(CFG.llm, env, console.log);          // siempre presente: reintenta conectar con el modelo local cada minuto
// consola del servidor: los mismos comandos que el chat de un admin
if (process.stdin.isTTY) readline.createInterface({ input: process.stdin }).on("line", l => console.log(adminCmd(l, "consola")));
// Cierre brusco (ventana cerrada, error inesperado): guardar todo antes de salir; el lanzador vuelve a arrancar el servidor
process.on("uncaughtException", e => { console.error("Error inesperado:", e); try { persist(true); store.close(); } catch {} process.exit(1); });
process.on("unhandledRejection", e => console.error("Promesa rechazada:", e));
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(sig, () => { for (const c of [...clients]) send(c, { t: "kicked", msg: "El servidor se apaga." }); clearInterval(saveTimer); persist(true); informe.flush(); store.close(); setTimeout(() => process.exit(0), 150); });
