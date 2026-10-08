// Arranque del cliente web: carga datos, crea el mundo (el "servidor" local), conecta
// el jugador y mueve el bucle de juego.
import { Grid } from "../shared/grid.js";
import { World } from "../shared/world.js";
import { loadAssets } from "./assets.js";
import { LocalConnection, NetConnection } from "./connection.js";
import { Renderer } from "./renderer.js";
import { Controller } from "./controller.js";
import { Fx } from "./fx.js";
import { Hud } from "./hud.js";
import { Sound } from "./audio.js";

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
  const conn = online ? new NetConnection(grid, assets.npcDb)
    : new LocalConnection(new World({ grid, npcDb: assets.npcDb, spawns: assets.spawns, start: meta.start }));
  status.remove();
  const pid = await askNameAndJoin(conn, online, info);
  const world = conn.state;

  const canvas = document.getElementById("game");
  const renderer = new Renderer(canvas, assets, grid);
  const fx = new Fx(world, pid);
  const hud = new Hud(conn);
  const sound = new Sound(world, pid);
  sound.setTrack(meta.music || "maintm");
  const view = { showGrid: false, showMinimap: true };

  function setMode(m) {
    document.body.classList.toggle("classic", m === "classic");
    document.body.classList.toggle("remastered", m === "remastered");
    renderer.setMode(m);
    sound.setMode(m);
    store.set("mode", m);
    document.getElementById("modename").textContent = m === "classic" ? "Clásico" : "Remastered";
    hud.place(renderer.viewRect);
  }
  let runMode = store.get("run", "0") === "1";      // por defecto: andar
  const ui = {
    get run() { return runMode; },
    unlockAudio: () => sound.unlock(),
    key(k) {
      switch (k) {
        case "g": {
          const m = renderer.mode === "classic" ? "remastered" : "classic";
          setMode(m);
          hud.toast(m === "classic" ? "Gráficos clásicos" : "Gráficos remastered");
          break;
        }
        case "r": runMode = !runMode; store.set("run", runMode ? "1" : "0"); hud.toast(runMode ? "Correr: activado" : "Correr: desactivado"); break;
        case "m": view.showMinimap = !view.showMinimap; break;
        case "b": view.showGrid = !view.showGrid; break;
        case "c": document.getElementById("charpanel").classList.toggle("open"); break;
        case "h": case "?": case "f1": document.getElementById("help").classList.toggle("open"); break;
        case "escape": for (const p of document.querySelectorAll(".panel.open")) p.classList.remove("open"); break;
        case "n": hud.log(sound.toggle() ? "Sonido activado." : "Sonido desactivado."); break;
        case "enter": {
          const me = world.ents.get(pid);
          if (me && me.dead) conn.send({ t: "respawn" });
          else openChat();
          break;
        }
      }
    },
  };
  hud.onButton = k => ui.key(k);
  const ctl = new Controller({ conn, grid, renderer, canvas, ui });

  setMode(store.get("mode", "remastered"));
  addEventListener("resize", () => { renderer.resize(); hud.place(renderer.viewRect); });
  hud.log("Bienvenido a la granja de Aresden. Pulsa H para ver los controles.");
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

    for (const ev of conn.update(dt)) {
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
      labels: ctl.keys.has("alt"), showGrid: view.showGrid, showMinimap: view.showMinimap, bubbles, pid,
    });
    hud.update(world, ctl.hoverEnt);
    canvas.style.cursor = ctl.hoverEnt ? "var(--cursor-attack)" : "var(--cursor)";
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // para pruebas automáticas
  window.hb = { world, conn, renderer, ctl, setMode, pid };
  window.hbSound = sound;
}

// pantalla de entrada: nombre del personaje
function askNameAndJoin(conn, online, info) {
  const box = document.getElementById("join"), input = box.querySelector("input"), msg = box.querySelector(".msg");
  box.querySelector(".where").textContent = online
    ? "Partida en línea" + (info.players.length ? " · conectados: " + info.players.join(", ") : " · aún no hay nadie")
    : "Prueba local (un jugador)";
  input.value = store.get("name", "");
  box.style.display = "grid";
  input.focus();
  return new Promise(resolve => {
    const go = async () => {
      const name = input.value.trim().slice(0, 16) || "Aventurero";
      store.set("name", name);
      msg.textContent = "Entrando…";
      try {
        const id = await conn.join(name);
        box.remove();
        resolve(id);
      } catch (e) { msg.textContent = e.message; }
    };
    box.querySelector("button").onclick = go;
    input.onkeydown = e => { e.stopPropagation(); if (e.key === "Enter") go(); };
  });
}

main().catch(err => {
  console.error(err);
  document.querySelector("#loading span").textContent =
    "No se pudieron cargar los datos (" + err.message + "). Abre la prueba con «Abrir prueba web.bat», no con doble clic en el HTML.";
});
