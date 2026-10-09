// Arranque del cliente web: carga datos, crea el mundo (el "servidor" local), conecta
// el jugador y mueve el bucle de juego.
import { MAGIC_MODE } from "../shared/magic.js";
import { Grid } from "../shared/grid.js";
import { Adventure } from "../shared/adventure.js";
import { chooseDungeon } from "./dungeon-choice.js";
import { loadAssets } from "./assets.js";
import { LocalConnection, NetConnection } from "./connection.js";
import { Renderer } from "./renderer.js";
import { Controller } from "./controller.js";
import { Fx } from "./fx.js";
import { Hud } from "./hud.js";
import { Sound } from "./audio.js";
import * as Accounts from "./accounts.js";
import { createCharacter } from "./create.js";
import { Gui } from "./gui.js";
import { apparelOf, equipKeys } from "./look.js";
import { itemDef, itemName } from "./names.js";
import { ITYPE } from "../shared/items.js";
import { registerDialogs } from "./dialogs.js";
import { registerNpcDialogs } from "./npcdialogs.js";
import { Sky, trackFor } from "./sky.js";
import { t as tr, getLang, setLang, onLang, startDomTranslation } from "./i18n.js";

const store = {
  get(k, d) { try { return localStorage.getItem("hbweb." + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("hbweb." + k, v); } catch {} },
};

function bindLanguage() {
  const mark = () => document.querySelectorAll("[data-lang]").forEach(b => b.classList.toggle("on", b.dataset.lang === getLang()));
  document.addEventListener("click", e => { const b = e.target.closest?.("[data-lang]"); if (b) { setLang(b.dataset.lang); mark(); } });
  onLang(mark); mark();
}

async function main() {
  startDomTranslation(); bindLanguage();
  const status = document.getElementById("loading");
  const assets = await loadAssets(k => { status.querySelector("span").textContent = "Cargando gráficos… " + Math.round(100 * k) + "%"; });
  status.querySelector("span").textContent = "Preparando el mapa…";
  await new Promise(r => setTimeout(r, 0));

  const { meta } = assets;
  const grid = new Grid(meta.w, meta.h, assets.mapBytes);
  // ¿estamos en el servidor multijugador (server/server.mjs) o en la prueba local?
  const info = await fetch("api/info").then(r => r.ok ? r.json() : null).catch(() => null);
  const online = !!(info && info.multiplayer);
  const conn = online ? new NetConnection(grid, assets.npcDb, assets.data, assets.maps)
    : new LocalConnection(new Adventure({ grid, npcDb: assets.npcDb, data: assets.data, spawns: assets.spawns, start: meta.start, maps: assets.maps, clock: () => new Date().getMinutes() }));
  status.remove();
  const pid = await askNameAndJoin(conn, online, info, assets.sprites);
  let world = conn.state;

  const canvas = document.getElementById("game");
  const renderer = new Renderer(canvas, assets, grid);
  const fx = new Fx(world, pid);
  const hud = new Hud(conn);
  const gui = new Gui(document.getElementById("gui"));
  await gui.load();
  gui.setGameSprites(assets.sprites);
  const logout = { n: null, t: 0 };
  const chatLog = [];
  const guiApi = {
    chatLog,
    log: m => hud.log(m),
    primary: uid => hud.primary(uid),
    disabled: uid => npcUi.bag.disabled(uid),
    magic: assets.data.magic,
    useMagic: id => ui.useMagic(id),
    sys: () => ({ detail: flags.detail, sound: opts.sound, music: opts.music, whisper: flags.whisper, shout: flags.shout, soundVol: opts.soundVol, musicVol: opts.musicVol, trans: document.body.classList.contains("dialogtrans"), logoutCount: logout.n }),
    mods: () => opts,
    setMod: (k, v) => { setOpt(k, v); hud.log(k + (v ? ' activado.' : ' desactivado.')); },
    setSys: o => {
      if ("detail" in o) { flags.detail = o.detail; hud.log(["Detail Level : Low", "Detail Level : Medium", "Detail Level : High"][o.detail]); }
      if ("sound" in o) setOpt("sound", o.sound);
      if ("music" in o) setOpt("music", o.music);
      if ("whisper" in o) flags.whisper = o.whisper;
      if ("shout" in o) flags.shout = o.shout;
      if ("soundVol" in o) setOpt("soundVol", o.soundVol);
      if ("musicVol" in o) setOpt("musicVol", o.musicVol);
      if ("trans" in o) document.body.classList.toggle("dialogtrans", o.trans);
    },
    logout: () => {
      if (logout.n !== null) { clearInterval(logout.t); logout.n = null; hud.log("Logout count stopped."); return; }
      logout.n = 10;
      hud.log("Logging out... " + logout.n);
      logout.t = setInterval(() => {
        logout.n--;
        if (logout.n <= 0) { clearInterval(logout.t); conn.save?.(); location.reload(); } else hud.log("Logging out... " + logout.n);
      }, 1000);
    },
    restart: () => conn.send({ t: "respawn" }),
    stat: k => conn.send({ t: "stat", stat: k }),
    learn: id => conn.send({ t: "learn", spell: id }),
  };
  registerDialogs(gui, guiApi);
  // tienda, herrería, almacén y mago: cuadros de los NPC de ciudad
  const npcUi = registerNpcDialogs(gui, {
    me: () => world.ents.get(pid), pid, send: c => conn.send(c), log: m => hud.log(m),
    shops: assets.shops, talk: assets.talk, itemByName: n => assets.data.named(n),
  });
  // objeto soltado sobre un NPC de ciudad del mundo (a menos de 8 casillas)
  const dropOnCitizen = (uid, mx, my, cx, cy) => {
    if (cx === undefined) return false;
    const [wx, wy] = renderer.toWorld(cx, cy), cit = ctl.pickCitizen(wx, wy), me = world.ents.get(pid);
    if (!cit || !me) return false;
    if (Math.max(Math.abs(cit.x - me.x), Math.abs(cit.y - me.y)) > 8) { hud.log("Too far to give the item."); return true; }
    return npcUi.dropOnNpc(cit, uid, mx, my);
  };
  // descarga los sprites del equipo puesto (todas las animaciones) para que no aparezcan a trozos
  const warmEquip = () => {
    const me = world.ents.get(pid); if (!me) return;
    const ks = equipKeys(me.gender || 1, apparelOf(me, itemDef));
    assets.sprites.preload(ks); assets.sprites.preloadHd(ks);
  };
  setTimeout(warmEquip, 0);
  gui.describe = uid => {
    const me = world.ents.get(pid), it = me && me.bag.find(i => i.uid === uid); if (!it) return null;
    const lines = hud.describe(it, me).map(l => /color:#9fe39a/.test(l) ? { t: l.replace(/<[^>]+>/g, ""), c: "#9fe39a" } : { t: l.replace(/<[^>]+>/g, "") });
    return { name: itemName(it.id, it.attr) + (it.count > 1 ? " x" + it.count : ""), lines };
  };
  gui.onSound = n => sound.playRaw("E" + n, 1, 0);
  fx.onSfx = (n, x, y) => sound.playAt(n, x, y);
  gui.onItemDrop = (it, x, y, dlg, cx, cy) => {
    const me = world.ents.get(pid), inst = me?.bag.find(i => i.uid === it.uid), d = inst && itemDef(inst.id);
    if (!me || me.dead || !inst) return;
    if (dlg && npcUi.dropOn(dlg, inst.uid, x, y)) return;           // lista de venta o almacén
    if (!dlg && y < 548 && dropOnCitizen(inst.uid, x, y, cx, cy)) return;
    if (dlg && dlg.id === 1) {                                   // sobre el personaje: equipar
      if (d.type === ITYPE.EQUIP && !Object.values(me.equip || {}).includes(inst.uid)) hud.act("equip", inst.uid);
    } else if (dlg && dlg.id === 2) {                            // en la mochila: soltar en esa posición (y quitar si estaba equipado)
      if (Object.values(me.equip || {}).includes(inst.uid)) hud.act("unequip", inst.uid);
      if (it.from === 2) {
        const nx = x - dlg.x - 32 - it.dx, ny = y - dlg.y - 44 - it.dy;
        inst.x = Math.max(0, Math.min(170, nx)); inst.y = Math.max(-10, Math.min(95, ny));
        conn.send({ t: "setpos", uid: inst.uid, x: nx, y: ny });
        if (ctl.keys.has("shift")) {                              // Mayús + arrastrar: agrupa en la misma casilla todos los objetos del mismo tipo
          let k = 0;
          for (const o of me.bag) {
            if (o === inst || o.id !== inst.id || Object.values(me.equip || {}).includes(o.uid)) continue;
            k++; o.x = Math.max(0, Math.min(170, nx + k * 2)); o.y = Math.max(-10, Math.min(95, ny + k * 2));
            conn.send({ t: "setpos", uid: o.uid, x: o.x, y: o.y });
            dlg.order = dlg.order.filter(u => u !== o.uid); dlg.order.splice(dlg.order.indexOf(inst.uid), 0, o.uid);
          }
        }
      }
    } else if (!dlg && y < 548 && it.from === 2) {               // fuera de la interfaz: tirar al suelo
      hud.act("drop", inst.uid);
    }
  };
  hud.magicData = assets.data.magic;
  hud.sprites = assets.sprites;
  const sound = new Sound(world, pid);
  sound.setTrack(trackFor(world));
  const sky = new Sky();
  let raining = false;
  const view = { showGrid: false, showMinimap: true };

  function setMode(m) {
    document.body.classList.toggle("classic", m === "classic");
    document.body.classList.toggle("remastered", m === "remastered");
    renderer.setMode(m);
    sound.setMode(m);
    
    document.getElementById("modename").textContent = m === "classic" ? "Clásico" : "Remastered";
    hud.place(renderer.viewRect); gui.place(renderer.viewRect, renderer.dpr);
  }
  // opciones del jugador (se recuerdan en el navegador)
  const defaults = { run: false, music: true, soundVol: 100, musicVol: 100, map: true, mapStyle: "corner", grid: false, sound: true, mode: "remastered", autoAttack: false, classicCursor: true, hdSprites: true, lighting: true, spellFx: true, freeMagic: true, hpBars: true };
  const opts = { ...defaults };
  try { Object.assign(opts, JSON.parse(store.get("opts", "{}"))); } catch {}
  const optionsEl = document.getElementById("options");
  function applyOpts() {
    view.showMinimap = opts.map; view.mapStyle = opts.mapStyle; view.showGrid = opts.grid;
    if (sound.on !== opts.sound) sound.toggle();
    sound.setVolume?.(opts.soundVol);
    MAGIC_MODE.free = !!opts.freeMagic;
    renderer.lighting = !!opts.lighting;
    renderer.hdOpt = !!opts.hdSprites; renderer.spr.hd = renderer.mode === "remastered" && renderer.hdOpt;
    if (fx.sp) fx.sp.off = !opts.spellFx;
    document.body.classList.toggle("classic-cursor", !!opts.classicCursor);
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
  // Teclas del cliente original (Game.cpp, OnKeyUp/OnKeyDown). Las acciones tienen nombre propio;
  // los botones de la interfaz usan los mismos nombres.
  const PANELS = { char: "charpanel", inv: "inv", book: "book", options: "options", help: "help" };
  const togglePanel = id => document.getElementById(id).classList.toggle("open");
  const flags = { safe: false, combat: false, force: false, detail: 2, lastChat: "", whisper: true, shout: true };
  const shortcuts = [null, null];                        // F2 / F3: { item: id } | { spell: id }
  try { Object.assign(shortcuts, JSON.parse(store.get("shortcuts", "[]"))); } catch {}
  let recent = null;
  const flag = (k, on, off) => { flags[k] = !flags[k]; hud.log(flags[k] ? on : off); };
  const ui = {
    minimapOpen: () => view.showMinimap && view.mapStyle !== "overlay",
    closeMinimap: () => { setOpt("map", false); hud.log("Minimapa oculto (se vuelve a activar en Opciones)."); },
    gui,
    get run() { return opts.run; },
    get autoAttack() { return opts.autoAttack; },
    unlockAudio: () => sound.unlock(),
    quick: k => hud.quickUse(k),
    get spell() { return hud.spell; },
    pointing: null,
    say: m => hud.log(m, "bad"),
    // UseMagic: prepara el hechizo; el siguiente clic izquierdo elige el objetivo, el derecho cancela
    useMagic(id) {
      const me = world.ents.get(pid), m = hud.magicData?.[id];
      if (!me || me.dead || !m || !me.magic || !me.magic[id]) return;
      if (ui.pointing != null) return;
      if (!MAGIC_MODE.free && m.mana > me.mp) { hud.log("No tienes MP suficiente.", "bad"); return; }
      ui.pointing = id; hud.spell = id; hud.bookKey = "";
      recent = { spell: id };
      conn.send({ t: "prepare", spell: id });          // empieza la animación de lanzar al elegirlo en el libro
      gui.close(3);
      document.body.classList.add("pointing");
      hud.toast(m.name);
    },
    cancelPointing(silent) {
      if (ui.pointing == null) return;
      ui.pointing = null; document.body.classList.remove("pointing");
      if (!silent) hud.log("Hechizo cancelado.");
    },
    // F2 / F3: usar el atajo; con Ctrl se asigna lo último usado
    useShortcut(n, ctrl) {
      const F = "F" + (n + 2);
      if (ctrl) {
        if (!recent) { hud.log("Para asignar un atajo usa primero un objeto o un hechizo, luego pulsa Ctrl+" + F + "."); return; }
        shortcuts[n] = recent; store.set("shortcuts", JSON.stringify(shortcuts));
        hud.log("Atajo asignado a [" + F + "].");
        return;
      }
      const sc = shortcuts[n];
      if (!sc) { hud.log("No hay nada asignado a [" + F + "]. Usa un objeto o hechizo y pulsa Ctrl+" + F + " para asignarlo."); return; }
      if (sc.spell != null) ui.useMagic(sc.spell);
      else hud.useItemId(sc.item);
    },
    noteItemUse(id) { recent = { item: id }; },
    // clic en un NPC de ciudad: abre su menú si está cerca
    npcClick(cit) {
      const me = world.ents.get(pid);
      if (!me || me.dead) return;
      if (Math.max(Math.abs(cit.x - me.x), Math.abs(cit.y - me.y)) > 8) { hud.log("Too far to talk to " + cit.name + "."); return; }
      npcUi.clickNpc(cit, gui.mouse.x, gui.mouse.y);
    },
    npcKey: e => npcUi.key(e),
    isHotkey(e) { return /^F([1-9]|1[0-2])$/.test(e.key) || e.ctrlKey && /^[adhmrstwx0-9]$/i.test(e.key) || ["Tab", "Insert", "Delete", "Home", "End", "PageUp"].includes(e.key); },
    // tecla pulsada fuera de los cuadros de texto
    hotkey(e) {
      const k = e.key, K = k.toLowerCase();
      const me = world.ents.get(pid);
      if (e.altKey) return;
      if (/^F([1-9]|1[0-2])$/.test(k)) {
        e.preventDefault();
        switch (k) {
          case "F1": ui.key("help"); break;
          case "F2": ui.useShortcut(0, e.ctrlKey); break;
          case "F3": ui.useShortcut(1, e.ctrlKey); break;
          case "F4": if (hud.spell != null) ui.useMagic(hud.spell); break;
          case "F5": ui.key("char"); break;
          case "F6": ui.key("inv"); break;
          case "F7": ui.key("book"); break;
          case "F8": ui.key("skill"); break;
          case "F9": gui.toggle(10); break;
          case "F11": document.body.classList.toggle("dialogtrans"); break;
          case "F12": ui.key("options"); break;
        }
        return;
      }
      if (e.ctrlKey) {
        if (/^[0-9]$/.test(k)) { e.preventDefault(); gui.dialogs.get(3).view = (+k + 9) % 10; gui.open(3); return; }   // Ctrl+0..9: página de magia
        switch (K) {
          case "a": e.preventDefault(); flag("force", "Modo de ataque automático activado.", "Modo de ataque automático desactivado."); return;
          case "d": e.preventDefault(); flags.detail = (flags.detail + 1) % 3; hud.log(["Nivel de detalle: bajo", "Nivel de detalle: medio", "Nivel de detalle: alto"][flags.detail]); return;
          case "h": e.preventDefault(); ui.key("help"); return;
          case "m": e.preventDefault(); setOpt("map", !opts.map); return;
          case "r": e.preventDefault(); setOpt("run", !opts.run); hud.log(opts.run ? "Cambiado a modo correr." : "Cambiado a modo andar."); return;
          case "s": e.preventDefault(); setOpt("sound", !opts.sound); hud.log(opts.sound ? "Sonido activado." : "Sonido desactivado."); return;
          case "t": e.preventDefault(); openChat("/to "); return;
          case "w": e.preventDefault(); document.body.classList.toggle("dialogtrans"); return;
          case "x": e.preventDefault(); ui.key("options"); return;
        }
        return;
      }
      switch (k) {
        case "Insert": e.preventDefault(); hud.quickUse("hp"); return;
        case "Delete": e.preventDefault(); hud.quickUse("mp"); return;
        case "Home": e.preventDefault(); flag("safe", "Modo de ataque seguro activado.", "Modo de ataque seguro desactivado."); return;
        case "Tab": e.preventDefault(); flag("combat", "Modo de combate.", "Modo de paz."); return;
        case "End": e.preventDefault(); if (flags.lastChat) openChat(flags.lastChat); return;
        case "PageUp": e.preventDefault(); hud.log("No tienes ninguna habilidad especial lista."); return;
        case "+": hud.toast("Mapa ampliado"); return;
        case "-": hud.toast("Mapa normal"); return;
        case "Escape": ui.cancelPointing(); ui.key("escape"); return;
        case "Enter": if (me && me.dead) conn.send({ t: "respawn" }); else openChat(); return;
        case "e": case "E": {
          const portal = world.map?.portals.find(g => me && Math.max(Math.abs(g.x - me.x), Math.abs(g.y - me.y)) <= 1);
          if (portal) { conn.send({ t: "portal", portal: portal.id }); return; }
          break;                                             // sin portal cerca, la E empieza a escribir
        }
      }
      // cualquier otra tecla imprimible empieza a escribir en el chat
      if (k.length === 1 && !e.metaKey) openChat();
    },
    key(a) {
      switch (a) {
        case "gfx": { const m = renderer.mode === "classic" ? "remastered" : "classic"; setOpt("mode", m); hud.toast(m === "classic" ? "Gráficos clásicos" : "Gráficos remastered"); break; }
        case "sound": setOpt("sound", !opts.sound); hud.log(opts.sound ? "Sonido activado." : "Sonido desactivado."); break;
        case "escape": {
          const open = document.querySelectorAll(".panel.open");
          for (const p of open) p.classList.remove("open");
          for (const id of [17, 23, 20, 31, 11, 14, 16]) if (gui.isOpen(id)) { gui.close(id); break; }   // Esc cierra el cuadro de NPC de más arriba
          break;
        }
        case "char": gui.toggle(1); break;
        case "inv": gui.toggle(2); break;
        case "options": gui.toggle(19); break;
        case "skill": gui.toggle(15); break;
        case "help": if (gui.isOpen(35)) { gui.close(35); gui.close(18); } else gui.open(35); break;
        case "book": gui.toggle(3); break;
        default: if (PANELS[a]) togglePanel(PANELS[a]);
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
  hud.onLog = (t, cls) => { chatLog.unshift({ t: tr(t), type: cls === "bad" ? 2 : cls === "gold" ? 4 : cls === "chat" ? 0 : 1 }); if (chatLog.length > 500) chatLog.pop(); };
  hud.onButton = k => ui.key(k);
  gui.onAction = a => ({ restart: () => conn.send({ t: "respawn" }), combat: () => ui.hotkey({ key: "Tab", preventDefault() {} }), char: () => ui.key("char"), inv: () => ui.key("inv"), book: () => ui.key("book"), skill: () => ui.key("skill"), chat: () => gui.toggle(10), sys: () => ui.key("options") })[a]?.();
  hud.onSpell = id => ui.useMagic(id);
  hud.onItem = id => ui.noteItemUse(id);
  const ctl = new Controller({ conn, grid, renderer, canvas, ui });

  setMode(opts.mode);
  applyOpts();
  addEventListener("resize", () => { renderer.resize(); hud.place(renderer.viewRect); gui.place(renderer.viewRect, renderer.dpr); });
  hud.log("Bienvenido a la granja de Aresden. Pulsa F1 para ver los controles.");
  hud.log("Cripta de esqueletos: entrada en (134, 94), cerca del inicio. Acércate y pulsa E.", "gold");
  if (online) hud.log(conn.returning ? "Partida en línea: se ha cargado tu progreso. Intro para hablar." : "Partida en línea. Pulsa Intro para hablar con los demás.", "gold");

  // chat
  const chatBox = document.getElementById("chat"), chatIn = chatBox.querySelector("input");
  const bubbles = new Map();
  function openChat(pre = "") { chatBox.classList.add("open"); chatIn.value = pre; chatIn.focus(); }
  chatIn.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Enter") {
      const t = chatIn.value.trim();
      if (t === "/options") document.getElementById("options").classList.add("open");   // provisional: copia de seguridad de la partida
      else if (t === "/auto") { setOpt("autoAttack", !opts.autoAttack); hud.log(opts.autoAttack ? "Ataque automático activado." : "Ataque automático desactivado."); }
      else if (/^\/gold \d+$/.test(t) && !online) { const me = world.ents.get(pid); me.gold += +t.slice(6); hud.log("Gold: " + me.gold); }   // solo para pruebas
      else if (/^\/time (day|night|auto)$/.test(t) && !online) {                      // solo para pruebas: fuerza la hora del cielo
        const mode = t.slice(6), A = conn.adventure;
        A.options.clock = mode === "auto" ? () => new Date().getMinutes() : () => (mode === "night" ? 45 : 5);
        for (const w of A.worlds.values()) { w.clock = A.options.clock; w.tSky = -1e9; }
        hud.log("Hora: " + mode);
      }
      else if (/^\/weather [0-3]$/.test(t) && !online) {                              // solo para pruebas: lluvia 0..3
        const w = conn.adventure.worldFor(pid); w.weather = +t.slice(9); w.weatherUntil = w.time + 5 * 60000; w.emit({ t: "weather", v: w.weather });
        hud.log("Clima: " + w.weather);
      }
      else if (t === "/magicshop") gui.open(16);          // provisional: abre la tienda de magia hasta que haya un mago en una ciudad
      else if (t) { flags.lastChat = t; conn.send({ t: "say", text: t }); }
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
      sound.setTrack(trackFor(world));
    }
    sky.sync(world); sky.update(dt);
    const rainNow = !world.fixedDay && world.weather >= 1 && world.weather <= 3;
    if (rainNow !== raining) { raining = rainNow; sound.rain(raining); }
    for (const ev of events) {
      if (ev.t === "dungeon-choice" && ev.id === pid) chooseDungeon(conn, ev);
      fx.onEvent(ev); sound.onEvent(ev); hud.onEvent(ev, world); npcUi.onEvent(ev, world);
      if ((ev.t === "equip" || ev.t === "unequip") && ev.id === pid) warmEquip();
      if (ev.t === "time") sound.playRaw(ev.v === 2 ? "E31" : "E32", 1, 0);          // NotifyMsg_TimeChange
      if (ev.t === "chat" && !ev.system) bubbles.set(ev.id, { text: ev.text, until: performance.now() + 5000 });
      if (ev.t === "disconnected") document.getElementById("lost").style.display = "grid";
    }
    const me = world.ents.get(pid);
    if (!me) { requestAnimationFrame(loop); return; }      // aún no ha llegado el primer estado
    ctl.update();
    renderer.render({
      world, me, dt, fx,
      sky, hover: ctl.hover, hoverEnt: ctl.hoverEnt, hoverCit: ctl.hoverCit, path: ctl.path, clickFx: ctl.clickFx,
      labels: ctl.keys.has("alt"), showGrid: view.showGrid, showMinimap: view.showMinimap, mapStyle: view.mapStyle, bubbles, pid,
    });
    hud.update(world, ctl.hoverEnt);
    gui.flags.combat = flags.combat; gui.flags.safe = flags.safe;
    npcUi.sweep();
    // cursor del original (interface.pak, sprite 0): 0 flecha · 3 enemigo · 6 otro jugador · 4/5 hechizo amigo/enemigo · 10 mano para recoger
    let cur;
    if (opts.classicCursor) {
      const ov = gui.dialogAt(gui.mouse.x, gui.mouse.y) || gui.mouse.y >= 548;
      const he = ctl.hoverEnt, foe = he && he.kind !== "player";
      cur = 0;
      if (!ov && ui.pointing != null) cur = foe ? 5 : 4;
      else if (!ov && he) cur = foe ? 3 : 6;
      if (gui.item) cur = 10;                                       // mano mientras se arrastra un objeto (m_iPointCommandType < 50); sobre un objeto del suelo el original no cambia el cursor
    }
    gui.draw(world.ents.get(pid), world, { ctrl: ctl.keys.has("control"), cursor: cur });
    canvas.style.cursor = opts.classicCursor ? "none" : ctl.hoverEnt ? "var(--cursor-attack)" : "var(--cursor)";
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // para pruebas automáticas
  window.hb = { get world() { return conn.state; }, fx, conn, renderer, ctl, setMode, pid, gui, npcUi };
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
          if (me) { const lk = spr.lookKeys(me.gender, me.look); await Promise.all([spr.preload(lk), spr.preloadHd(lk)]); }
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

