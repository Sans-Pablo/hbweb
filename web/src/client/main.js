// Arranque del cliente web: carga datos, crea el mundo (el "servidor" local), conecta
// el jugador y mueve el bucle de juego.
import { Grid } from "../shared/grid.js";
import { Adventure } from "../shared/adventure.js";
import { loadAssets } from "./assets.js";
import { LocalConnection, NetConnection } from "./connection.js";
import { Renderer } from "./renderer.js";
import { Controller } from "./controller.js";
import { Fx } from "./fx.js";
import { Hud } from "./hud.js";
import { Sound } from "./audio.js";
import * as Accounts from "./accounts.js";
import { createCharacter } from "./create.js";

const store = {
  get(k, d) { try { return localStorage.getItem("hbweb." + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("hbweb." + k, v); } catch {} },
};

async function main() {
  const status = document.getElementById("loading");
  const assets = await loadAssets(k => { status.querySelector("span").textContent = "Cargando gráficos… " + Math.round(100 * k) + "%"; });
  status.querySelector("span").textContent = "Preparando el mapa…";
  await new Promise(r => setTimeout(r, 0));

  const { meta } = assets;
  const grid = new Grid(meta.w, meta.h, assets.mapBytes);
  // ¿estamos en el servidor multijugador (server/server.mjs) o en la prueba local?
  const info = await fetch("api/info").then(r => r.ok ? r.json() : null).catch(() => null);
  const online = !!(info && info.multiplayer);
  const conn = online ? new NetConnection(grid, assets.npcDb, assets.data)
    : new LocalConnection(new Adventure({ grid, npcDb: assets.npcDb, data: assets.data, spawns: assets.spawns, start: meta.start }));
  status.remove();
  const pid = await askNameAndJoin(conn, online, info, assets.sprites);
  let world = conn.state;

  const canvas = document.getElementById("game");
  const renderer = new Renderer(canvas, assets, grid);
  const fx = new Fx(world, pid);
  const hud = new Hud(conn);
  hud.magicData = assets.data.magic;
  hud.sprites = assets.sprites;
  const sound = new Sound(world, pid);
  sound.setTrack(meta.music || "maintm");
  const view = { showGrid: false, showMinimap: true };

  function setMode(m) {
    document.body.classList.toggle("classic", m === "classic");
    document.body.classList.toggle("remastered", m === "remastered");
    renderer.setMode(m);
    sound.setMode(m);
    
    document.getElementById("modename").textContent = m === "classic" ? "Clásico" : "Remastered";
    hud.place(renderer.viewRect);
  }
  // opciones del jugador (se recuerdan en el navegador)
  const defaults = { run: false, map: true, mapStyle: "corner", grid: false, sound: true, mode: "remastered" };
  const opts = { ...defaults };
  try { Object.assign(opts, JSON.parse(store.get("opts", "{}"))); } catch {}
  const optionsEl = document.getElementById("options");
  function applyOpts() {
    view.showMinimap = opts.map; view.mapStyle = opts.mapStyle; view.showGrid = opts.grid;
    if (sound.on !== opts.sound) sound.toggle();
    if (renderer.mode !== opts.mode) setMode(opts.mode);
    for (const el of optionsEl.querySelectorAll("[data-opt]")) {
      const v = opts[el.dataset.opt];
      if (el.type === "checkbox") el.checked = !!v; else el.value = v;
    }
    store.set("opts", JSON.stringify(opts));
  }
  function setOpt(k, v) { opts[k] = v; applyOpts(); }
  optionsEl.addEventListener("change", e => {
    const el = e.target.closest("[data-opt]"); if (!el) return;
    setOpt(el.dataset.opt, el.type === "checkbox" ? el.checked : el.value);
  });
  const ui = {
    get run() { return opts.run; },
    unlockAudio: () => sound.unlock(),
    quick: k => hud.quickUse(k),
    get spell() { return hud.spell; },
    say: m => hud.log(m, "bad"),
    key(k) {
      switch (k) {
        case "g": {
          const m = renderer.mode === "classic" ? "remastered" : "classic";
          setOpt("mode", m);
          hud.toast(m === "classic" ? "Gráficos clásicos" : "Gráficos remastered");
          break;
        }
        case "e": {
          const me = world.ents.get(pid);
          const portal = world.map?.portals.find(g => me && Math.max(Math.abs(g.x - me.x), Math.abs(g.y - me.y)) <= 1);
          if (portal) conn.send({ t: "portal", portal: portal.id });
          else hud.toast("Acércate a un portal para usarlo (E)");
          break;
        }
        case "r": setOpt("run", !opts.run); hud.toast(opts.run ? "Correr: activado" : "Correr: desactivado"); break;
        case "m": case "tab": setOpt("map", !opts.map); break;
        case "b": setOpt("grid", !opts.grid); break;
        case "o": optionsEl.classList.toggle("open"); break;
        case "c": document.getElementById("charpanel").classList.toggle("open"); break;
        case "k": document.getElementById("book").classList.toggle("open"); break;
        case "i": document.getElementById("inv").classList.toggle("open"); break;
        case "h": case "?": case "f1": document.getElementById("help").classList.toggle("open"); break;
        case "escape": {
          const open = document.querySelectorAll(".panel.open");
          if (open.length) for (const p of open) p.classList.remove("open"); else optionsEl.classList.add("open");
          break;
        }
        case "n": setOpt("sound", !opts.sound); hud.log(opts.sound ? "Sonido activado." : "Sonido desactivado."); break;
        case "enter": {
          const me = world.ents.get(pid);
          if (me && me.dead) conn.send({ t: "respawn" });
          else openChat();
          break;
        }
      }
    },
  };
  // cuenta: guardar, copia de seguridad, cerrar sesión
  const $id = i => document.getElementById(i);
  if (online) $id("btn-export").parentElement.style.display = "none";
  $id("btn-save").onclick = () => { conn.save?.(); hud.toast("Partida guardada"); };
  $id("btn-export").onclick = () => {
    conn.save?.();
    const txt = Accounts.exportSave(store.get("name", ""));
    if (!txt) return hud.toast("Aún no hay nada guardado");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" }));
    a.download = "helbreath-" + store.get("name", "personaje") + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $id("btn-import").onclick = () => $id("file-import").click();
  $id("file-import").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (!confirm("Esto reemplaza el progreso de " + store.get("name", "") + " con el del archivo. ¿Seguir?")) return;
      Accounts.importSave(store.get("name", ""), await f.text());
      conn.save = () => {};                                  // que no pise la copia importada al recargar
      location.reload();
    } catch (err) { hud.toast(err.message); }
  };
  $id("btn-logout").onclick = () => { conn.save?.(); location.reload(); };
  addEventListener("visibilitychange", () => { if (document.hidden) conn.save?.(); });
  hud.onButton = k => ui.key(k);
  const ctl = new Controller({ conn, grid, renderer, canvas, ui });

  setMode(opts.mode);
  applyOpts();
  addEventListener("resize", () => { renderer.resize(); hud.place(renderer.viewRect); });
  hud.log("Bienvenido a la granja de Aresden. Pulsa H para ver los controles.");
  hud.log("Cripta de esqueletos: entrada en (134, 94), cerca del inicio. Acércate y pulsa E.", "gold");
  hud.log("G cambia entre gráficos clásicos y remastered.", "gold");
  if (online) hud.log(conn.returning ? "Partida en línea: se ha cargado tu progreso. Intro para hablar." : "Partida en línea. Pulsa Intro para hablar con los demás.", "gold");

  // chat
  const chatBox = document.getElementById("chat"), chatIn = chatBox.querySelector("input");
  const bubbles = new Map();
  function openChat() { chatBox.classList.add("open"); chatIn.value = ""; chatIn.focus(); }
  chatIn.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Enter") {
      const t = chatIn.value.trim();
      if (t) conn.send({ t: "say", text: t });
      chatBox.classList.remove("open"); chatIn.blur();
    } else if (e.key === "Escape") { chatBox.classList.remove("open"); chatIn.blur(); }
  });

  let last = performance.now(), fps = 0, frames = 0, fpsT = 0;
  const fpsEl = document.getElementById("fps");
  function loop(t) {
    const dt = Math.min(100, t - last);             // si la pestaña estuvo oculta, no saltar
    last = t;
    frames++; fpsT += dt;
    if (fpsT > 500) {
      fps = Math.round(frames * 1000 / fpsT); frames = 0; fpsT = 0;
      let txt = fps + " fps";
      if (online) {
        const n = [...world.ents.values()].filter(e => e.kind === "player").length;
        txt += " · " + n + (n === 1 ? " jugador" : " jugadores") + " · " + conn.ping + " ms";
      }
      fpsEl.textContent = txt;
    }

    const events = conn.update(dt);
    world = conn.state;
    fx.world = sound.world = world;
    if (renderer.grid !== world.grid) {
      renderer.setMap(world.grid, world.map.name);
      ctl.grid = world.grid; ctl.intent = null; ctl.path = []; ctl.down = false;
      ctl.hover = ctl.hoverEnt = ctl.clickFx = null;
      fx.texts = []; fx.parts = []; fx.rings = []; fx.bolts = []; fx.flash.clear(); bubbles.clear();
    }
    for (const ev of events) {
      fx.onEvent(ev); sound.onEvent(ev); hud.onEvent(ev, world);
      if (ev.t === "chat" && !ev.system) bubbles.set(ev.id, { text: ev.text, until: performance.now() + 5000 });
      if (ev.t === "disconnected") document.getElementById("lost").style.display = "grid";
    }
    const me = world.ents.get(pid);
    if (!me) { requestAnimationFrame(loop); return; }      // aún no ha llegado el primer estado
    ctl.update();
    renderer.render({
      world, me, dt, fx,
      hover: ctl.hover, hoverEnt: ctl.hoverEnt, path: ctl.path, clickFx: ctl.clickFx,
      labels: ctl.keys.has("alt"), showGrid: view.showGrid, showMinimap: view.showMinimap, mapStyle: view.mapStyle, bubbles, pid,
    });
    hud.update(world, ctl.hoverEnt);
    canvas.style.cursor = ctl.hoverEnt ? "var(--cursor-attack)" : "var(--cursor)";
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // para pruebas automáticas
  window.hb = { get world() { return conn.state; }, conn, renderer, ctl, setMode, pid };
  window.hbSound = sound;
}

// pantalla de entrada: cuenta (nombre + contraseña) en la prueba local; solo nombre en línea
function askNameAndJoin(conn, online, info, spr) {
  const box = document.getElementById("join"), msg = box.querySelector(".msg");
  const user = box.querySelector(".user"), pass = box.querySelector(".pass"), pass2 = box.querySelector(".pass2"), go = box.querySelector(".go");
  box.querySelector(".where").textContent = online
    ? "Partida en línea" + (info.players.length ? " · conectados: " + info.players.join(", ") : " · aún no hay nadie")
    : "Prueba local (un jugador)";
  let creating = false;
  const setTab = c => {
    creating = c;
    box.classList.toggle("creating", c);
    for (const t of box.querySelectorAll(".tabs button")) t.classList.toggle("on", (t.dataset.tab === "new") === c);
    go.textContent = c ? "Crear cuenta y entrar" : "Entrar";
    msg.textContent = "";
    pass.autocomplete = c ? "new-password" : "current-password";
  };
  if (online) { box.querySelector(".tabs").style.display = "none"; box.querySelector(".pw").style.display = "none"; }
  for (const t of box.querySelectorAll(".tabs button")) t.onclick = () => setTab(t.dataset.tab === "new");
  user.value = store.get("name", "");
  const known = Accounts.listAccounts();
  if (!online && !known.length && !user.value) setTab(true);
  box.style.display = "grid";
  (user.value && !online ? pass : user).focus();
  return new Promise(resolve => {
    const submit = async () => {
      const name = user.value.trim().slice(0, 16) || (online ? "Aventurero" : "");
      msg.textContent = "…";
      try {
        if (!online) {
          if (!name) throw new Error("Escribe un nombre.");
          if (creating) {
            if (pass.value !== pass2.value) throw new Error("Las contraseñas no coinciden.");
            await Accounts.createAccount(name, pass.value);   // una partida guardada antes con ese nombre se conserva
          } else await Accounts.login(name, pass.value);
        }
        store.set("name", name);
        msg.textContent = "Entrando…";
        let create = null;
        if (!online && !LocalConnection.hasSave(name)) {      // cuenta sin personaje: pantalla de creación
          box.style.display = "none";
          create = await createCharacter(spr, name);
        }
        const id = await conn.join(name, create);
        if (!online) {                                         // descargar el aspecto antes de empezar
          const me = conn.state.ents.get(id);
          if (me) await spr.preload(spr.lookKeys(me.gender, me.look));
        }
        box.remove();
        resolve(id);
      } catch (e) { msg.textContent = e.message; }
    };
    go.onclick = submit;
    box.onkeydown = e => { e.stopPropagation(); if (e.key === "Enter") submit(); };
  });
}

main().catch(err => {
  console.error(err);
  document.querySelector("#loading span").textContent =
    "No se pudieron cargar los datos (" + err.message + "). Abre la prueba con «Abrir prueba web.bat», no con doble clic en el HTML.";
});

