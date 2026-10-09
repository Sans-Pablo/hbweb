// Servidor online real (server/server.mjs): cuentas, sesiones, mundo compartido, privacidad, chat, administración y persistencia. node tests/online.test.mjs
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NET_PROTO } from "../web/src/shared/const.js";

const PORT = 18200 + Math.floor(Math.random() * 500), BASE = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(path.join(tmpdir(), "hbonline-"));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, why, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(15); } assert.fail("Tiempo agotado: " + why); }

let srv, out = "";
async function start() {
  out = "";
  srv = spawn(process.execPath, ["server/server.mjs", String(PORT)], { env: { ...process.env, HB_DATA: dir, HB_ADMINS: "boss", HB_ORIGINS: "https://juego.example", HB_ADMIN_TOKEN: "tok123" }, stdio: ["ignore", "pipe", "pipe"] });
  srv.stdout.on("data", b => out += b); srv.stderr.on("data", b => out += b);
  await until(() => out.includes("Monstruos:"), "arranque del servidor\n" + out);
}
async function stop() { const done = new Promise(r => srv.once("exit", r)); srv.kill("SIGINT"); await done; }

const sockets = [];
class Client {
  constructor() { this.msgs = []; this.states = []; this.events = []; this.closed = false; this.me = null; this.ents = new Map(); }
  async open() {
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`); sockets.push(this.ws);
    this.ws.onmessage = e => {
      const m = JSON.parse(e.data); this.msgs.push(m);
      if (m.t === "s") { this.states.push(m); for (const o of m.e || []) this.ents.set(o.id, o); for (const id of m.g || []) this.ents.delete(id); for (const v of m.ev || []) this.events.push(v); }
    };
    this.ws.onclose = () => { this.closed = true; };
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error("no conecta")); });
    return this;
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  async wait(t, from = 0) { return until(() => this.msgs.slice(from).find(m => m.t === t), "mensaje " + t + " de " + JSON.stringify(this.msgs.slice(-3))); }
  async ask(o, t) { const n = this.msgs.length; this.send(o); return until(() => this.msgs.slice(n).find(m => m.t === t || m.t === "error"), "respuesta a " + o.t); }
  auth(mode, name, pass, proto = NET_PROTO) { return this.ask({ t: "auth", mode, name, pass, proto }, "authok"); }
  async enter(name, create = { name: name.slice(0, 10) }, mode = "register") {
    await this.auth(mode, name, "secret1");
    const w = await this.ask({ t: "join", create }, "welcome"); assert.equal(w.t, "welcome", JSON.stringify(w)); this.me = w.id; this.welcome = w;
    await until(() => this.ents.has(this.me), "primer estado");
    return this;
  }
  cmd(cmd) { this.send({ t: "cmd", seq: 1, cmd }); }
  close() { this.ws.close(); }
}
const mk = () => new Client().open();
const get = (p, headers = {}) => new Promise((res, rej) => http.get(BASE + p, { headers }, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => res({ status: r.statusCode, headers: r.headers, body: b })); }).on("error", rej));
const upgrade = origin => new Promise(res => { const s = net.connect(PORT, "127.0.0.1", () => s.write(`GET /ws HTTP/1.1\r\nHost: 127.0.0.1:${PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nOrigin: ${origin}\r\n\r\n`)); s.once("data", d => { res(String(d).split("\r\n")[0]); s.destroy(); }); });

try {
  await start();

  // ---- información pública y orígenes (CORS) para el cliente de GitHub Pages
  { const r = await get("/api/info", { Origin: "https://juego.example" }); const j = JSON.parse(r.body);
    assert.equal(r.status, 200); assert.equal(j.multiplayer, true); assert.equal(j.proto, NET_PROTO); assert.ok(Array.isArray(j.players));
    assert.equal(r.headers["access-control-allow-origin"], "https://juego.example");
    assert.equal((await get("/api/info", { Origin: "https://malo.example" })).headers["access-control-allow-origin"], undefined, "origen ajeno sin CORS");
    assert.match(await upgrade("https://juego.example"), /101/); assert.match(await upgrade("https://malo.example"), /403/, "WebSocket de un origen ajeno"); }

  // ---- cuentas
  { const c = await mk();
    assert.equal((await c.auth("register", "ab", "secret1")).t, "error", "usuario corto");
    assert.equal((await c.auth("register", "maria", "123")).t, "error", "clave corta");
    assert.equal((await c.auth("register", "maria", "secret1", 1)).code, "proto", "protocolo distinto");
    const ok = await c.auth("register", "maria", "secret1"); assert.deepEqual([ok.t, ok.hasChar, ok.admin], ["authok", false, false]);
    const d = await mk(); assert.match((await d.auth("register", "MARIA", "otra123")).msg, /ya existe/, "usuario repetido sin distinguir mayúsculas");
    assert.match((await d.auth("login", "maria", "equivocada")).msg, /incorrectos/); assert.match((await d.auth("login", "nadie", "secret1")).msg, /incorrectos/, "no revela si existe");
    assert.equal((await d.ask({ t: "join", create: { name: "x" } }, "welcome")).t === "welcome", false, "sin autenticar no se entra");
    const accs = readFileSync(path.join(dir, "accounts.json"), "utf8"); assert.ok(!accs.includes("secret1"), "la clave no se guarda en claro"); assert.match(accs, /"hash"/);
    c.close(); d.close(); }
  // fuerza bruta: tras 8 fallos el origen queda bloqueado
  { const c = await mk(); let last; for (let i = 0; i < 10; i++) last = await c.auth("login", "maria", "mala" + i); assert.match(last.msg, /Demasiados intentos/); c.close(); }
  await stop(); await start();                       // reinicio: el bloqueo de intentos es de memoria, las cuentas persisten

  // ---- entrar, mundo compartido y privacidad
  const A = await (await mk()).enter("alicia", { name: "Alicia" }, "login").catch(async () => null);
  assert.equal(A, null, "alicia aún no existe");
  const a = await (await mk()).enter("alicia", { name: "Alicia", gender: 2 });
  assert.equal((await mk().then(c => c.auth("login", "alicia", "secret1"))).hasChar, true, "ya tiene personaje");
  const first = a.states[0].e.find(o => o.id === a.me);
  assert.ok(first.o && first.o.bag?.length && first.o.magic && first.o.tut && first.o.stats, "el propio jugador recibe su estado completo");
  assert.ok(first.ap !== undefined && first.lk, "apariencia");
  const b = await (await mk()).enter("bruno", { name: "Bruno" });
  await until(() => a.ents.has(b.me) && b.ents.has(a.me), "se ven entre sí");
  const seenB = a.ents.get(b.me); assert.equal(seenB.name, "Bruno"); assert.equal(seenB.o, undefined, "los demás NO reciben el estado privado");
  b.cmd({ t: "equip", uid: first.o.bag.find(i => i.id === 1)?.uid || 0 });          // no importa si falla: no debe filtrarse
  a.cmd({ t: "tut", op: "get" });
  await until(() => a.events.some(e => e.t === "tutorial"), "A recibe su tutorial");
  await sleep(300); assert.ok(!b.events.some(e => e.t === "tutorial"), "B no ve eventos privados de A");
  // chat visible para ambos
  a.cmd({ t: "say", text: "hola a todos" });
  await until(() => b.events.some(e => e.t === "chat" && e.text === "hola a todos" && e.name === "Alicia"), "chat llega a B");
  assert.match(out, /alicia.*ha entrado/);

  // ---- una sola sesión por cuenta: la nueva expulsa a la vieja
  { const a2 = await (await mk()).enter("alicia", undefined, "login");
    await until(() => a.closed || a.msgs.some(m => m.t === "kicked"), "la sesión vieja cae"); assert.match(a.msgs.find(m => m.t === "kicked").msg, /otro sitio/);
    assert.equal(a2.welcome.returning, true);
    a2.close(); }
  await until(() => !b.ents.has(a.me) || true, "x"); await sleep(200);

  // ---- nombre de personaje único
  { const c = await mk(); await c.auth("register", "carla", "secret1");
    const r = await c.ask({ t: "join", create: { name: "bruno" } }, "welcome"); assert.equal(r.t, "error"); assert.match(r.msg, /en uso/);
    const r2 = await c.ask({ t: "join", create: { name: "Carla" } }, "welcome"); assert.equal(r2.t, "welcome"); c.close(); }

  // ---- administración: comandos de chat, silencio, expulsión, bloqueo y panel
  const boss = await (await mk()).enter("boss", { name: "Boss" });
  boss.cmd({ t: "say", text: "/who" });
  await until(() => boss.msgs.some(m => m.t === "msg" && /conectados/.test(m.text)), "/who responde");
  b.cmd({ t: "say", text: "/who" }); await sleep(200); assert.ok(!b.msgs.some(m => m.t === "msg" && /conectados/.test(m.text)), "los no admins no ejecutan comandos");
  boss.cmd({ t: "say", text: "/mute bruno 5" }); await until(() => b.msgs.some(m => m.t === "msg" && /silenciado/.test(m.text)), "B avisado del silencio");
  const before = boss.events.filter(e => e.t === "chat").length;
  await sleep(700); b.cmd({ t: "say", text: "no deberías leerme" }); await sleep(400);
  assert.ok(!boss.events.some(e => e.t === "chat" && e.text === "no deberías leerme"), "silenciado no habla");
  boss.cmd({ t: "say", text: "/say Aviso general" }); await until(() => b.events.some(e => e.t === "chat" && e.text === "Aviso general" && e.system), "anuncio a todos");
  boss.cmd({ t: "say", text: "/kick bruno por pruebas" }); await until(() => b.msgs.some(m => m.t === "kicked" && /administrador/.test(m.msg)), "expulsado");
  boss.cmd({ t: "say", text: "/ban bruno" }); await sleep(300);
  { const c = await mk(); assert.match((await c.auth("login", "bruno", "secret1")).msg, /bloqueada/); c.close(); }
  boss.cmd({ t: "say", text: "/unban bruno" }); await sleep(300);
  { const c = await mk(); assert.equal((await c.auth("login", "bruno", "secret1")).t, "authok", "desbloqueado"); c.close(); }
  // panel solo desde este PC y con token
  assert.equal((await get("/admin?token=mal")).status, 403);
  assert.equal((await get("/admin?token=tok123", { "x-forwarded-for": "8.8.8.8" })).status, 403, "por el túnel nunca");
  const page = await get("/admin?token=tok123"); assert.equal(page.status, 200); assert.match(page.body, /Administración/);
  const st = JSON.parse((await get("/api/admin/state?token=tok123")).body); assert.ok(st.players.some(p => p.account === "boss"));
  assert.equal((await get("/api/admin/state?token=tok123", { "x-forwarded-for": "8.8.8.8" })).status, 403);

  // ---- inundación: demasiados mensajes por segundo cortan la conexión
  { const c = await (await mk()).enter("flood", { name: "Flood" }); for (let i = 0; i < 400; i++) c.send({ t: "ping", c: i });
    await until(() => c.closed, "inundación cortada"); }

  // ---- persistencia: tras un reinicio, la cuenta y el personaje siguen ahí
  boss.cmd({ t: "say", text: "/save" }); await sleep(300);
  await stop(); await start();
  { const c = await mk(); const r = await c.auth("login", "alicia", "secret1"); assert.deepEqual([r.t, r.hasChar], ["authok", true]);
    const w = await c.ask({ t: "join" }, "welcome"); assert.equal(w.returning, true);
    await until(() => c.ents.size > 0, "estado tras reiniciar"); const me = c.ents.get(w.id); assert.equal(me.name, "Alicia"); c.close(); }
  console.log("OK online");
} catch (e) { console.error(e); console.error("--- salida del servidor ---\n" + out.slice(-1500)); process.exitCode = 1; }
finally { for (const s of sockets) try { s.close(); } catch {} try { srv.kill(); } catch {} setTimeout(() => { rmSync(dir, { recursive: true, force: true }); process.exit(process.exitCode || 0); }, 200); }
