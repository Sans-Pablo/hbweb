// Arranque del cliente web: carga datos, crea el mundo (el "servidor" local), conecta
// el jugador y mueve el bucle de juego.
import { MAGIC_MODE, freeFor } from "../shared/magic.js";
import { rarityOf, RARITY_COLOR } from "../shared/rarity.js";
import { Grid } from "../shared/grid.js";
import { Adventure } from "../shared/adventure.js";
import { chooseDungeon } from "./dungeon-choice.js";
import { createQuestUi } from "./questui.js";
import { initDomDrag } from "./domdrag.js";
import { loadAssets } from "./assets.js";
import { LocalConnection, NetConnection } from "./connection.js";
import { NET_PROTO, dirTo } from "../shared/const.js";
import { Renderer } from "./renderer.js";
import { Controller } from "./controller.js";
import { Fx } from "./fx.js";
import { Hud } from "./hud.js";
import { Sound } from "./audio.js";
import * as Accounts from "./accounts.js";
import { createCharacter } from "./create.js";

import { Gui } from "./gui.js";
import { apparelOf, equipKeys } from "./look.js";
import { itemDef, itemName, packKey } from "./names.js";
import { ITYPE, EFFECT, EQUIP } from "../shared/items.js";
import { realStats } from "../shared/attributes.js";
import { registerDialogs } from "./dialogs.js";
import { registerNpcDialogs } from "./npcdialogs.js";
import { registerPetMage } from "./petmage.js";
import { registerParty } from "./party.js";
import { registerTrade } from "./trade.js";
import { registerStall } from "./stall.js";
import { registerGuild } from "./guild.js";
import { registerPetDialog } from "./petdialog.js";
import { registerSummonPreview } from "./summonpreview.js";
import { DUNGEON_ASSETS } from "../shared/dungeon.js";
import { registerNews, NEWS_ID } from "./newswin.js";
import { registerQuests, QUEST_ID } from "./questwin.js";
import { registerChat } from "./chatwin.js";
import { registerBug, BUG_ID } from "./bugwin.js";
import { registerStatSim, STATSIM_ID } from "./statsim.js";
import { registerAutoWin } from "./autowin.js";
import { registerPrompts } from "./window.js";
import { Streamer } from "./streaming.js";
import { Voice } from "./voice.js";
import { setNpcDb } from "./compicon.js";
import { Sky, trackFor } from "./sky.js";
import { Tutorial } from "./tutorial.js";
import { pickBot } from "./observer.js";
import { observerBar, rosterPanel, brainPanel } from "./watchpanel.js";
import { FEED } from "../shared/systems/companion.js";
import { isMobile, initMobileOpts, Mobile } from "./mobile.js";
import { t as tr, getLang, setLang, onLang, startDomTranslation } from "./i18n.js";
import { parseAuto, label as autoLabel } from "../shared/systems/autoplay.js";
import { PerfLog } from "./perflog.js";
import { Profiler } from "./profiler.js";
const EMBED = new URLSearchParams(location.search).has("embed");                  // marco del panel dividido (observador.html): solo el juego

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
  const mobile = isMobile();                         // pantalla táctil: controles y menús para móvil (mobile.js)
  if (mobile) document.body.classList.add("mobile");
  startDomTranslation(); bindLanguage();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});   // caché persistente: la segunda visita no vuelve a bajar nada
  const status = document.getElementById("loading");
  const assets = await loadAssets(k => { status.querySelector("span").textContent = "Cargando gráficos… " + Math.round(100 * k) + "%"; });
  status.querySelector("span").textContent = "Preparando el mapa…";
  await new Promise(r => setTimeout(r, 0));

  const { meta } = assets;
  const grid = new Grid(meta.w, meta.h, assets.mapBytes);
  // ¿estamos en el servidor multijugador (server/server.mjs) o en la prueba local?
  const { base, info, lost } = await findServer();
  const online = !!(info && info.multiplayer && info.proto === NET_PROTO);
  const protoClash = !!(info && info.multiplayer && info.proto !== NET_PROTO);      // el servidor es de otra versión del protocolo
  const conn = online ? new NetConnection(grid, assets.npcDb, assets.data, assets.maps, base, assets.spawns)
    : new LocalConnection(new Adventure({ grid, npcDb: assets.npcDb, data: assets.data, spawns: assets.spawns, start: meta.start, maps: assets.maps, clock: () => new Date().getMinutes() }));
  // Las rejillas (~33 MB) se bajan en segundo plano (el login ya no las espera); NetConnection.gateState retiene el estado que
  // cambia a un mapa cuya rejilla no ha llegado, y así la vuelta de la cripta no se bloquea esperando una descarga fría.
  if (online) for (const m of Object.values(assets.maps)) m.ensure?.().catch(() => {});
  status.style.display = "none";
  { const sendLang = () => { try { conn.send({ t: "lang", lang: getLang() }); } catch {} }; onLang(sendLang); setTimeout(sendLang, 1500); setInterval(sendLang, 30000); }   // los bots hablan el idioma del cliente
  const pid = await askNameAndJoin(conn, online, info, assets.sprites, { lost, protoClash });
  const perf = new PerfLog(); let perfStarted = false;
  const prof = new URLSearchParams(location.search).get("prof") === "1" ? new Profiler() : null;      // ?prof=1: perfilador A/B (profiler.js)      // registro de rendimiento del jugador (login -> logout), ver perflog.js
  fetch("data/version.json", { cache: "no-cache" }).then(r => r.json()).then(v => { perf.version = v.version; }).catch(() => {});
  let world = conn.state;
  if (conn.observing && EMBED) setInterval(() => parent.postMessage({ hbBrain: conn.brain, id: conn.pid, name: conn.watchName }, location.origin), 500);   // panel dividido: el marco solo muestra el juego; el resto lo pinta la página madre
  else if (conn.observing) { observerBar(conn); rosterPanel(conn); setInterval(() => brainPanel(conn), 500); }
  // Carga bajo demanda (streaming.js): solo lo del mapa donde se entra; el resto llega al cambiar de mapa
  const stream = new Streamer(assets.sprites);
  status.style.display = "";
  const bar = () => { status.querySelector("span").textContent = tr("Cargando el mapa…") + " " + Math.round(100 * stream.progress(world, assets.npcDb)) + "%"; };
  stream.onChange = bar; bar();
  // antes de pedir las hojas: así el streaming baja también las HD/IA del suelo (antes se pedían tarde, al dibujar: cuadrados negros)
  const o0 = (() => { try { return JSON.parse(store.get("opts", "{}")); } catch { return {}; } })();
  assets.sprites.hd = (o0.mode || "remastered") === "remastered" && o0.hdSprites !== false;
  await stream.enter(world, assets.npcDb);
  // el personaje con su equipo y los jugadores ya a la vista, antes de quitar el diálogo de carga (si no, salían fotogramas negros/a trozos al entrar)
  {
    status.querySelector("span").textContent = tr("Cargando personajes…");
    const ks = new Set();
    for (const e of world.ents.values()) if (e.kind === "player") {
      const ap = e.id === pid ? apparelOf(e, itemDef) : e.ap;
      if (ap) for (const k of equipKeys(e.gender || 1, ap)) ks.add(k);
    }
    await Promise.race([stream.wantAll([...ks], 3), new Promise(r => setTimeout(r, 8000))]);
    await Promise.race([assets.sprites.preload(["ip0", "ig0", "ip1", "ig1"]), new Promise(r => setTimeout(r, 3000))]);
  }
  stream.onChange = null;

  const canvas = document.getElementById("game");
  const renderer = new Renderer(canvas, assets, grid);
  // Precalienta el suelo de alrededor del personaje tras la pantalla de carga: el primer fotograma ya sale completo.
  {
    status.querySelector("span").textContent = tr("Preparando el terreno…");
    await new Promise(r => setTimeout(r, 30));
    const m0 = world.ents.get(pid);
    if (m0) {
      const cx0 = Math.floor(m0.x / 16), cy0 = Math.floor(m0.y / 16);
      for (let cy = Math.max(0, cy0 - 2); cy <= cy0 + 2; cy++) for (let cx = Math.max(0, cx0 - 2); cx <= cx0 + 2; cx++) {
        try { renderer.groundChunk(cx, cy); } catch {}
        if ((cx + cy) % 3 === 0) await new Promise(r => setTimeout(r, 0));
      }
    }
  }
  const fx = new Fx(world, pid);
  const hud = new Hud(conn);
  const gui = new Gui(document.getElementById("gui"));
  gui.mobile = mobile;
  
  registerAutoWin(gui, { npcDb: assets.npcDb, spawns: () => assets.spawns, want: k => stream.want(k, 2), itemName: id => assets.data.item?.(id)?.name || id, ctl: () => ctl, log: m => hud.log(m[getLang() === "en" ? 1 : 0]), start: a => { ctl.setAuto(a); hud.log(getLang() === "en" ? "Auto mode started (click to cancel)." : "Modo automático iniciado (un clic lo cancela)."); } });
  registerNews(gui); registerQuests(gui); registerPrompts(gui); registerStatSim(gui);
  registerBug(gui, () => { const m = world.ents.get(pid); return { user: m?.name, map: world.map?.id, x: m?.x, y: m?.y }; });
  if (mobile) { renderer.miniSize = 100; renderer.miniTop = 84; }
  await gui.load();
  gui.setGameSprites(assets.sprites);
  status.querySelector("span").textContent = tr("Entrando al mundo…");
  await new Promise(r => { requestAnimationFrame(() => requestAnimationFrame(r)); setTimeout(r, 500); });      // dos fotogramas de relleno: el primero que ve el jugador ya está completo
  status.remove();
  const logout = { n: null, t: 0 };
  const chatLog = [];
  initDomDrag();                                                                       // chat y registro arrastrables
  const questUi = createQuestUi(() => world.ents.get(pid), () => gui.toggle(QUEST_ID));
  const guiApi = {
    quests: () => gui.toggle(QUEST_ID),
    stall: () => stallUi.setup(),
    chatLog,
    log: m => hud.log(m),
    party: () => partyUi.open(),
    primary: uid => hud.primary(uid),
    disabled: uid => npcUi.bag.disabled(uid),
    magic: assets.data.magic,
    useMagic: id => ui.useMagic(id),
    sys: () => ({ detail: flags.detail, sound: opts.sound, music: opts.music, whisper: flags.whisper, shout: flags.shout, soundVol: opts.soundVol, musicVol: opts.musicVol, trans: document.body.classList.contains("dialogtrans"), logoutCount: logout.n }),
    mods: () => opts,
    setOpt: (k, v) => setOpt(k, v),
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
        if (logout.n <= 0) { clearInterval(logout.t); perf.end("logout"); conn.save?.(); location.reload(); } else hud.log("Logging out... " + logout.n);
      }, 1000);
    },
    restart: () => conn.send({ t: "respawn" }),
    useSkill: k => conn.send({ t: "useskill", skill: k }),
    stat: (k, n = 1) => conn.send({ t: "stat", stat: k, n }),
    learn: id => conn.send({ t: "learn", spell: id }),
    statReset: () => conn.send({ t: "statreset" }),
  };
  registerDialogs(gui, guiApi); registerChat(gui, guiApi);
  // tienda, herrería, almacén y mago: cuadros de los NPC de ciudad
  const summonPreview = registerSummonPreview(gui, { npc: sp => assets.npcDb[sp], want: k => stream.want(k, 2), magic: assets.data.magic, item: id => assets.data.item?.(id), me: () => world.ents.get(pid), send: c => conn.send(c) });
  const npcUi = registerNpcDialogs(gui, {
    preview: (sp, npc, cls) => summonPreview.show(sp, npc, cls), hasNpc: sp => !!assets.npcDb[sp],
    me: () => world.ents.get(pid), pid, send: c => conn.send(c), log: m => hud.log(m),
    nurse: () => [...world.ents.values()].find(e => e.role === "pethospital"),
    shops: assets.shops, talk: assets.talk, itemByName: n => assets.data.named(n),
  });
  const petMageUi = registerPetMage(gui, { send: c => conn.send(c), magic: () => hud.magicData, petCast: id => ui.usePetSpell(id) });
  npcUi.hooks.petMage = petMageUi;
  // grupo (party): cuadro 32 del original; el clic sobre un personaje del mundo elige a quién invitar (ui.partyPick)
  const partyUi = registerParty(gui, {
    me: () => world.ents.get(pid), send: c => conn.send(c), log: (m, c) => hud.log(m, c),
    pick: cb => ui.partyPick(cb), cancelPick: () => ui.cancelPick(),
  });
  const tradeUi = registerTrade(gui, { me: () => world.ents.get(pid), send: c => conn.send(c), log: (m, c) => hud.log(m, c) });
  const stallUi = registerStall(gui, { mapId: () => world.map?.id, send: c => conn.send(c), log: (m, c) => hud.log(m, c) });
  const guildUi = registerGuild(gui, { me: () => world.ents.get(pid), send: c => conn.send(c), log: (m, c) => hud.log(m, c), autoInvite: () => ui.autoInvite() });
  registerPetDialog(gui, { npc: sp => assets.npcDb[sp], want: k => stream.want(k, 2), me: () => world.ents.get(pid), send: c => conn.send(c), nurse: () => [...world.ents.values()].find(e => e.role === "pethospital"), action: a => gui.onAction?.(a) });
  // tutorial para jugadores nuevos (shared/systems/tutorial.js): conversaciones con cara + objetivos, se puede saltar
  const tutorial = new Tutorial({
    gui, pid, spr: assets.sprites, itemDef, send: c => conn.send(c), lang: getLang, now: () => performance.now(), world: () => world,
    runOn: () => opts.run, panelOpen: id => gui.isOpen(id), toast: m => hud.toast(m), want: ks => assets.sprites.preload(ks),
  });
  addEventListener("keydown", e => { if (document.activeElement?.tagName === "INPUT") return; if (tutorial.key(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
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
  // iconos de la mochila y objetos del suelo: se bajan al empezar (antes aparecian a trozos al abrir la bolsa)
  setTimeout(() => { for (let i = 0; i < 20; i++) { assets.sprites.preload(["ip" + i, "ig" + i]); assets.sprites.preloadHd(["ip" + i, "ig" + i]); } }, 50);
  gui.describe = uid => {
    const me = world.ents.get(pid), it = me && me.bag.find(i => i.uid === uid); if (!it) return null;
    const lines = hud.describe(it, me).map(l => /color:#9fe39a/.test(l) ? { t: l.replace(/<[^>]+>/g, ""), c: "#9fe39a" } : { t: l.replace(/<[^>]+>/g, "") });
    const rar = rarityOf(it.id, it.attr);      // color del nombre por rango (normal/mágico/raro/único), como en el suelo
    return { name: itemName(it.id, it.attr, it.comp) + (it.count > 1 ? " x" + it.count : ""), lines, ...(rar ? { color: RARITY_COLOR[rar] } : {}) };
  };
  // BUG-009: ficha de un objeto de tienda (sin instancia): sprite, estadísticas y comparación con lo que llevas puesto en esa ranura
  gui.describeDef = (id, inst) => {
    const me = world.ents.get(pid), d = itemDef(id); if (!me || !d) return null;
    const it = { uid: -1, id, count: inst?.count || 1, life: inst?.life ?? realStats(d, null).maxLife, attr: inst?.attr || null };
    const strip = l => l.replace(/<[^>]+>/g, "");
    const lines = hud.describe(it, me).map(l => ({ t: strip(l), c: /color:#9fe39a/.test(l) ? "#9fe39a" : undefined }));
    if (d.type === ITYPE.EQUIP) {
      const cur = me.bag.find(i => Object.values(me.equip || {}).includes(i.uid) && itemDef(i.id).equipPos === d.equipPos);
      const atk = x => x.effectType === EFFECT.ATTACK || x.effectType === EFFECT.ATTACK_MANASAVE || x.effectType === EFFECT.ATTACK_ARROW;
      const val = x => atk(x) ? x.v1 * (x.v2 + 1) / 2 + x.v3 : x.v1;
      if (cur) {
        const cd = itemDef(cur.id), diff = Math.round((val(d) - val(cd)) * 10) / 10;
        lines.push({ t: "Puesto: " + itemName(cur.id, cur.attr) + " (" + (diff > 0 ? "+" : "") + diff + (atk(d) ? " daño medio" : " defensa") + ")", c: diff > 0 ? "#9fe39a" : diff < 0 ? "#e39a9a" : "#e8e8d0" });
        lines.push({ t: diff > 0 ? "▲ Mejor que lo que llevas" : diff < 0 ? "▼ Peor que lo que llevas" : "= Igual que lo que llevas", c: diff > 0 ? "#9fe39a" : diff < 0 ? "#e39a9a" : "#e8e8d0" });
      } else lines.push({ t: "Ranura libre: nada puesto", c: "#9fe39a" });
    }
    return { name: itemName(id), lines, sprite: [packKey(d), d.spriteFrame] };
  };
  gui.onSound = n => sound.playRaw("E" + n, 1, 0);
  fx.onSfx = (n, x, y) => sound.playAt(n, x, y);
  gui.onItemDrop = (it, x, y, dlg, cx, cy) => {
    const me = world.ents.get(pid), inst = me?.bag.find(i => i.uid === it.uid), d = inst && itemDef(inst.id);
    if (!me || me.dead || !inst) return;
    if (dlg && npcUi.dropOn(dlg, inst.uid, x, y)) return;           // lista de venta o almacén
    if (!dlg && y < 548 && cx !== undefined && d && FEED[d.id]) {                 // BUG-007: comida soltada sobre el compañero
      const [wx, wy] = renderer.toWorld(cx, cy), pet = ctl.pickPet(wx, wy);
      if (pet) { conn.send({ t: "use", uid: inst.uid, dest: pet.ball }); return; }
    }
    if (!dlg && y < 548 && dropOnCitizen(inst.uid, x, y, cx, cy)) return;
    if (!dlg && y < 548 && cx !== undefined) {                    // objeto soltado sobre otro jugador (estilo Olympia): abre el intercambio con eso ya ofrecido
      const [wx, wy] = renderer.toWorld(cx, cy), o = ctl.playerAt(wx, wy);
      if (o && o.id !== pid && !o.dead) { if (Math.max(Math.abs(o.x - me.x), Math.abs(o.y - me.y)) > 10) hud.log("Too far to trade."); else tradeUi.start(o.name, inst.uid); return; }
    }
    if (dlg && dlg.id === 33) { tradeUi.drop(inst.uid); return; }           // sobre la ventana de intercambio: ofrecerlo
    if (dlg && dlg.id === 1) {                                   // sobre el personaje: equipar
      if (d.type === ITYPE.EQUIP && !Object.values(me.equip || {}).includes(inst.uid)) hud.act("equip", inst.uid);
    } else if (dlg && dlg.id === 2) {                            // en la mochila: soltar en esa posición (y quitar si estaba equipado)
      if (d && (/Candy$/.test(d.name) || FEED[d.id])) {          // caramelo o comida soltados sobre una bola: se lo come ese compañero
        const nx = x - dlg.x - 32 - it.dx, ny = y - dlg.y - 44 - it.dy;
        let best = null, bd = 1e9;
        for (const o of me.bag) { if (!o.comp || !Number.isFinite(o.x)) continue; const dd = Math.hypot(o.x - nx, o.y - ny); if (dd < bd) { bd = dd; best = o; } }
        if (best && bd <= 30) { conn.send({ t: "use", uid: inst.uid, dest: best.uid }); return; }
      }
      if (d && [17, 32, 34].includes(d.effectType)) {             // tinte soltado sobre otro objeto de la mochila: lo tiñe
        const nx = x - dlg.x - 32 - it.dx, ny = y - dlg.y - 44 - it.dy;
        let best = null, bd = 1e9;
        for (const o of me.bag) { if (o === inst || !Number.isFinite(o.x)) continue; const dd = Math.hypot(o.x - nx, o.y - ny); if (dd < bd) { bd = dd; best = o; } }
        if (best && bd <= 26) conn.send({ t: "use", uid: inst.uid, dest: best.uid });
        else hud.log("Suelta el tinte encima del objeto que quieres teñir.");
        return;
      }
      if (Object.values(me.equip || {}).includes(inst.uid)) hud.act("unequip", inst.uid);
      if (it.from === 2) {
        const nx = x - dlg.x - 32 - it.dx, ny = y - dlg.y - 44 - it.dy;
        inst.x = Math.max(0, Math.min(170, nx)); inst.y = Math.max(-10, Math.min(95, ny));
        conn.send({ t: "setpos", uid: inst.uid, x: inst.x, y: inst.y });
        if (ctl.keys.has("shift")) {                              // Mayús + arrastrar: agrupa en la misma casilla todos los objetos del mismo tipo
          let k = 0;
          for (const o of me.bag) {
            if (o === inst || o.id !== inst.id || Object.values(me.equip || {}).includes(o.uid)) continue;
            k++; o.x = inst.x; o.y = inst.y;
            conn.send({ t: "setpos", uid: o.uid, x: o.x, y: o.y });
            dlg.order = dlg.order.filter(u => u !== o.uid); dlg.order.splice(dlg.order.indexOf(inst.uid), 0, o.uid);
          }
        }
      }
    } else if (!dlg && y < 548 && d?.effectType === 30 && cx !== undefined) {   // bolsa de semillas soltada sobre una casilla vecina del mundo: se vuelve hacia ella y siembra
      const [wx, wy] = renderer.toWorld(cx, cy), tx = Math.floor(wx / 32), ty = Math.floor(wy / 32);
      if (Math.max(Math.abs(tx - me.x), Math.abs(ty - me.y)) === 1) conn.send({ t: "turn", dir: dirTo(me.x, me.y, tx, ty) });
      conn.send({ t: "use", uid: inst.uid });
    } else if (!dlg && y < 548 && (it.from === 2 || it.from === 1)) {   // fuera de la interfaz: tirar al suelo (también lo que llevas puesto, p. ej. set Hero/Knight; el servidor lo desequipa)
      hud.act("drop", inst.uid);
    }
  };
  hud.magicData = assets.data.magic;
  hud.sprites = assets.sprites;
  // al cambiar de mapa: pedir lo que falte (urgente) y precalentar los destinos cercanos; mientras llega, se dibujan marcadores
  const mapStream = w => {
    stream.enter(w, assets.npcDb);
    stream.audio?.prefetch?.(stream.bundle(w, assets.npcDb).sounds);
    const me = w.ents.get(pid);
    stream.prefetchNeighbours(w, { maps: assets.maps }, assets.npcDb, me?.level || 1, me);
  };
  setInterval(() => { const w = conn.state; if (stream.busy < 3) mapStream(w); }, 2000);     // junto a un teleport se calientan sus destinos
  setTimeout(() => { mapStream(world); fx.sp.warmAll?.(); }, 1500);
  setTimeout(() => stream.wantAll([...stream.spr.m ? DUNGEON_ASSETS.filter(k => stream.spr.has(k)) : []], 0), 20000);   // la cripta de esqueletos, cuando la cola lleva un rato vacía
  const sound = new Sound(world, pid);
  stream.audio = sound; sound.prefetch(stream.bundle(world, assets.npcDb).sounds);
  sound.setTrack(trackFor(world));
  const sky = new Sky();
  let raining = false;
  const view = { showGrid: false, showMinimap: true };
  const INDOOR = new Set(["gshop_1f", "bsmith_1f", "wrhus_1f"]);       // tienda, herrería y almacén: sin minimapa
  const miniOn = () => view.showMinimap && !INDOOR.has(world.map?.id);

  function setMode(m) {
    document.body.classList.toggle("classic", m === "classic");
    document.body.classList.toggle("remastered", m === "remastered");
    renderer.setMode(m);
    sound.setMode(m);
    
    document.getElementById("modename").textContent = m === "classic" ? "Legacy" : "Remastered";
    hud.place(renderer.viewRect); gui.place(renderer.viewRect, renderer.dpr);
  }
  // opciones del jugador (se recuerdan en el navegador)
  const defaults = { run: true, music: true, soundVol: 100, musicVol: 100, map: true, mapStyle: "corner", grid: false, sound: true, mode: "remastered", autoAttack: false, classicCursor: true, hdSprites: true, lighting: true, lightFx: true, groundInfo: true, groundCost: true, spellFx: true, hpBars: true, questTrack: true, dirArrows: false };
  const opts = { ...defaults };
  try { Object.assign(opts, JSON.parse(store.get("opts", "{}"))); } catch {}
  opts.run = true;                                   // correr siempre activo al entrar (Ctrl+R alterna)
  opts.autoAttack = true;                            // al entrar siempre con el ataque automático activado
  if (mobile) initMobileOpts(opts, store);          // en el móvil se empieza con el ataque automático activado
  function applyOpts() {
    view.showMinimap = opts.map; view.mapStyle = "corner"; view.showGrid = opts.grid;
    if (sound.on !== opts.sound) sound.toggle();
    sound.setVolume?.(opts.soundVol);
    sound.setMusic?.(opts.music); sound.setMusicVolume?.(opts.musicVol);
    MAGIC_MODE.free = false;                                   // magia con las reglas del servidor (la opción «magia libre» ya no existe)
    const q = opts.autoQuality !== true ? 0 : renderer.q || 0;       // calidad automática (el HD lo decide el jugador): 1 sin sombras largas y menos sombras, 2 sin luz/viñeta (el HD no se toca)
    renderer.lighting = false; renderer.lightFx = false;  /* sin luz inventada (ticket 12) */ renderer.crowdMax = q >= 1 ? 25 : 70;
    renderer.hdOpt = !!opts.hdSprites; renderer.spr.hd = renderer.mode === "remastered" && renderer.hdOpt;
    if (fx.sp) fx.sp.off = !opts.spellFx;
    questUi.setEnabled(opts.questTrack !== false);
    document.body.classList.toggle("classic-cursor", !!opts.classicCursor);
    if (renderer.mode !== opts.mode) setMode(opts.mode);
    store.set("opts", JSON.stringify(opts));
  }
  function setOpt(k, v) { opts[k] = v; applyOpts(); }
  // Teclas del cliente original (Game.cpp, OnKeyUp/OnKeyDown). Las acciones tienen nombre propio;
  // los botones de la interfaz usan los mismos nombres.
  // BUG-018: el clic derecho nunca abre el menú de Windows (ni en los paneles DOM como F1); solo se respeta en campos de texto
  document.addEventListener("contextmenu", e => { if (!e.target.closest?.("input[type=text],input:not([type]),textarea")) e.preventDefault(); });
  const flags = { safe: false, combat: false, force: false, detail: 2, lastChat: "", whisper: true, shout: true };
  const shortcuts = [null, null];                        // F2 / F3: { item: id } | { spell: id }
  try { Object.assign(shortcuts, JSON.parse(store.get("shortcuts", "[]"))); } catch {}
  let recent = null;
  const flag = (k, on, off) => { flags[k] = !flags[k]; hud.log(flags[k] ? on : off); };
  const ui = {
    minimapOpen: () => miniOn() && view.mapStyle !== "overlay",
    closeMinimap: () => { setOpt("map", false); hud.log("Minimapa oculto (se vuelve a activar en Opciones)."); },
    gui,
    get run() { return opts.run; },
    get autoAttack() { return opts.autoAttack; },
    unlockAudio: () => sound.unlock(),
    quick: k => hud.quickUse(k),
    get spell() { return hud.spell; },
    pointing: null,
    petPointing: null,                                // hechizo del grimorio del summon (pgcast): el siguiente clic elige el objetivo
    partyCb: null,
    // mientras se elige a quién invitar, Personaje y Grupo se ocultan para no tapar a nadie
    partyPick(cb) { ui.partyCb = cb; document.body.classList.add("pointing"); for (const id of [1, 32]) { const d = gui.dialogs.get(id); if (d) d.hidden = true; } },
    cancelPick() { if (!ui.partyCb) return; ui.partyCb = null; document.body.classList.remove("pointing"); for (const id of [1, 32]) { const d = gui.dialogs.get(id); if (d) d.hidden = false; } },
    // Ctrl+P: invita al jugador bajo el cursor (o al más cercano); el invitado acepta solo
    autoParty() {
      const me = world.ents.get(pid); if (!me || me.dead) return;
      const e = ctl.pickPlayer() || [...world.ents.values()].filter(o => o.kind === "player" && !o.dead && o.id !== pid).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (!e || Math.hypot(e.x - me.x, e.y - me.y) > 20) { hud.log("No hay ningún jugador cerca."); return; }
      conn.send({ t: "partyreq", name: e.name, auto: true });
    },
    // Invitar al guild al jugador bajo el cursor (o el más cercano)
    autoInvite() {
      const me = world.ents.get(pid); if (!me || me.dead) return;
      const e = ctl.hoverPlayer || [...world.ents.values()].filter(o => o.kind === "player" && !o.dead && o.id !== pid).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (!e || Math.max(Math.abs(e.x - me.x), Math.abs(e.y - me.y)) > 10) { hud.log("No hay nadie cerca a quien invitar."); return; }
      conn.send({ t: "guildinvite", name: e.name }); hud.log("Invitación enviada a " + e.name + ".");
    },
    // Ctrl+E (o «/trade nombre»): comerciar con el jugador bajo el cursor (o el más cercano a ≤ 10 casillas)
    autoLog: m => hud.log(m[getLang() === "en" ? 1 : 0]),
    autoTrade(name) {
      const me = world.ents.get(pid); if (!me || me.dead) return;
      const e = name ? [...world.ents.values()].find(o => o.kind === "player" && o.name.toLowerCase() === name.toLowerCase()) : ctl.hoverPlayer || [...world.ents.values()].filter(o => o.kind === "player" && !o.dead && o.id !== pid).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (!e || Math.max(Math.abs(e.x - me.x), Math.abs(e.y - me.y)) > 10) { hud.log("No hay nadie con quien comerciar cerca."); return; }
      tradeUi.start(e.name);
    },
    say: m => hud.log(m, "bad"),
    // UseMagic: prepara el hechizo; el siguiente clic izquierdo elige el objetivo, el derecho cancela
    useMagic(id) {
      const me = world.ents.get(pid), m = hud.magicData?.[id];
      if (!MAGIC_MODE.player) { hud.log("Los hechizos están cerrados.", "bad"); return; }
      if (!me || me.dead || !m) return;
      if (!freeFor(me) && (!me.magic || !me.magic[id])) return;
      if (ui.pointing != null) return;
      if (!freeFor(me) && m.mana > me.mp) { hud.log("No tienes MP suficiente.", "bad"); return; }
      ctl.intent = null; ctl.path = []; ctl.auto = null; ctl.noHold = true;      // lanzar frena al personaje: ni sigue el camino ni corre
      ui.pointing = id; hud.spell = id; hud.bookKey = "";
      recent = { spell: id };
      conn.send({ t: "prepare", spell: id });          // empieza la animación de lanzar al elegirlo en el libro
      gui.close(3);
      document.body.classList.add("pointing");
    },
    usePetSpell(id) {
      const me = world.ents.get(pid);
      if (!me || me.dead || ui.pointing != null) return;
      ui.petPointing = id; document.body.classList.add("pointing");
    },
    cancelPointing(silent) {
      if (ui.petPointing != null) { ui.petPointing = null; document.body.classList.remove("pointing"); if (!silent) hud.log("Hechizo cancelado."); return; }
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
      if (cit.stall) { stallUi.setCtrl(!!ctl.keys.has("control")); if (Math.max(Math.abs(cit.x - me.x), Math.abs(cit.y - me.y)) > 4) hud.log("Acércate al puesto."); else stallUi.view(cit); return; }
      npcUi.clickNpc(cit, gui.mouse.x, gui.mouse.y);
      tutorial.noteTalk(cit);
      voice?.noteNpc(cit);
    },
    npcKey: e => npcUi.key(e),
    isHotkey(e) { return /^F([1-9]|1[0-2])$/.test(e.key) || e.ctrlKey && /^[adefghmprstwx0-9]$/i.test(e.key) || ["Tab", "Insert", "Delete", "Home", "End", "PageUp"].includes(e.key); },
    // tecla pulsada fuera de los cuadros de texto
    hotkey(e) {
      const k = e.key, K = k.toLowerCase();
      const me = world.ents.get(pid);
      if (e.altKey) return;
      if (/^F([1-9]|1[0-2])$/.test(k)) {
        e.preventDefault();
        switch (k) {
          case "F1": ui.key("news"); break;
          case "F2": ui.useShortcut(0, e.ctrlKey); break;
          case "F3": ui.useShortcut(1, e.ctrlKey); break;
          case "F4": if (hud.spell != null) ui.useMagic(hud.spell); break;
          case "F5": ui.key("char"); break;
          case "F6": ui.key("inv"); break;
          case "F7": ui.key("book"); break;
          case "F8": ui.key("skill"); break;
          case "F9": gui.toggle(10); break;
          case "F10": gui.toggle(43); break;
          case "F11": if (e.shiftKey) document.body.classList.toggle("dialogtrans"); else gui.toggle(BUG_ID); break;
          case "F12": ui.key("options"); break;
        }
        return;
      }
      if (e.ctrlKey) {
        if (/^[0-9]$/.test(e.key)) {                                  // Ctrl+1..9,0: abre el libro de magia en ese círculo
          e.preventDefault();
          const mg = gui.dialogs.get(3); mg.view = (+e.key + 9) % 10; mg.keepView = true;
          if (!gui.isOpen(3)) gui.open(3); else gui.bringFront?.(3);
          return;
        }
        switch (K) {
          case "a": e.preventDefault(); flag("force", "Auto Attack Mode has been enabled.", "Auto Attack Mode has been disabled."); return;
          case "d": e.preventDefault(); flags.detail = (flags.detail + 1) % 3; hud.log(["Detail Level : Low", "Detail Level : Medium", "Detail Level : High"][flags.detail]); return;      // Game.cpp OnKeyUp 'D': m_cDetailLevel 0→1→2→0 con NOTIFY_MSG_DETAIL_LEVEL_*
          case "f": e.preventDefault(); gui.toggle(43); return;                                  // Game.cpp OnKeyUp 'F': lista de amigos (cuadro 43)
          case "h": e.preventDefault(); ui.key("news"); return;
          case "p": e.preventDefault(); ui.autoParty(); return;
          case "e": e.preventDefault(); ui.autoTrade(); return;
          case "g": e.preventDefault(); guildUi.open(); return;
          case "m": e.preventDefault(); setOpt("map", !opts.map); return;
          case "r": e.preventDefault(); setOpt("run", !opts.run); hud.log(opts.run ? "Converted to running mode." : "Converted to walking mode."); return;   // NOTIFY_MSG_CONVERT_*
          case "s": e.preventDefault(); {      // Game.cpp OnKeyUp 'S': música encendida→apaga la música; si no, sonido encendido→apaga el sonido; si no, enciende ambos
            if (opts.music) { setOpt("music", false); hud.log("Music Off"); }
            else if (opts.sound) { setOpt("sound", false); hud.log("Sound Off"); }
            else { setOpt("music", true); hud.log("Music On"); setOpt("sound", true); hud.log("Sound On"); }
          } return;
          case "t": e.preventDefault(); openChat("/to "); return;
          case "w": e.preventDefault(); document.body.classList.toggle("dialogtrans"); return;
          case "x": e.preventDefault(); ui.key("options"); return;
        }
        return;
      }
      switch (k) {
        case "Insert": e.preventDefault(); hud.quickUse("hp"); return;
        case "Delete": e.preventDefault(); hud.quickUse("mp"); return;
        case "Home": e.preventDefault(); flag("safe", "Safe attack mode activated.", "Safe attack mode inactivated."); return;
        case "Tab": e.preventDefault(); flag("combat", "Converted to attack mode.", "Converted to peace mode."); conn.send({ t: "combatmode", on: flags.combat }); return;
        case "End": e.preventDefault(); if (flags.lastChat) openChat(flags.lastChat); return;
        case "ArrowUp": case "ArrowDown": e.preventDefault(); whisperCycle(k === "ArrowUp" ? 1 : -1); return;      // Game.cpp VK_UP/VK_DOWN: recorre los últimos susurros
        case "PageUp": e.preventDefault(); hud.log("No item with special ability is equipped."); return;     // Game.cpp OnKeyUp 33 + ON_KEY_UP26 (el port no tiene habilidades especiales de objeto)
        case "+": hud.toast("Mapa ampliado"); return;
        case "-": hud.toast("Mapa normal"); return;
        case "Escape": ui.cancelPointing(); if (ui.partyCb) { ui.cancelPick(); partyUi.reset(); } ui.key("escape"); return;
        case "Enter": if (me && me.dead) conn.send({ t: "respawn" }); else openChat(); return;
        case "e": case "E": {
          const portal = world.map?.portals.find(g => me && Math.max(Math.abs(g.x - me.x), Math.abs(g.y - me.y)) <= 1);
          if (portal) { conn.send({ t: "portal", portal: portal.id }); return; }
          break;                                             // sin portal cerca, la E empieza a escribir
        }
      }
      // cualquier otra tecla imprimible empieza a escribir en el chat
      if (k.length === 1 && !e.metaKey) { e.preventDefault(); openChat(); chatIn.value += k; chTag?.(); }         // se escribe a mano: así el navegador no interpreta la tecla («/» abre la búsqueda rápida, espacio desplaza la página…)
    },
    key(a) {
      switch (a) {
        case "gfx": { const m = renderer.mode === "classic" ? "remastered" : "classic"; setOpt("mode", m); hud.toast(m === "classic" ? "Gráficos clásicos" : "Gráficos remastered"); break; }
        case "sound": setOpt("sound", !opts.sound); hud.log(opts.sound ? "Sonido activado." : "Sonido desactivado."); break;
        case "escape": {
          const open = document.querySelectorAll(".panel.open");
          for (const p of open) p.classList.remove("open");
          for (const id of [91, 90, NEWS_ID, 60, 17, 23, 20, 31, 11, 14, 16]) if (gui.isOpen(id)) { gui.close(id); break; }   // Esc cierra el cuadro de NPC de más arriba
          break;
        }
        case "char": gui.toggle(1); break;
        case "inv": gui.toggle(2); break;
        case "options": gui.toggle(60); break;
        case "news": gui.toggle(NEWS_ID); break;
        case "skill": gui.toggle(15); break;
        case "book": gui.toggle(3); break;
      }
    },
  };
  // cuenta: guardar, copia de seguridad, cerrar sesión
  const $id = i => document.getElementById(i);
  gui.actions = {};
  gui.actions.canExport = !online;
  gui.actions.save = () => { conn.save?.(); hud.toast("Partida guardada"); };
  gui.actions.exportSave = () => {
    conn.save?.();
    const txt = Accounts.exportSave(store.get("name", ""));
    if (!txt) return hud.toast("Aún no hay nada guardado");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" }));
    a.download = "helbreath-" + store.get("name", "personaje") + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  gui.actions.importSave = () => $id("file-import").click();
  $id("file-import").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (!await gui.confirm("Esto reemplaza el progreso de " + store.get("name", "") + " con el del archivo. ¿Seguir?")) return;
      Accounts.importSave(store.get("name", ""), await f.text());
      conn.save = () => {};                                  // que no pise la copia importada al recargar
      location.reload();
    } catch (err) { hud.toast(err.message); }
  };
  gui.actions.tutorial = () => { gui.close(60); tutorial.restart(); };
  addEventListener("visibilitychange", () => { if (document.hidden) conn.save?.(); });
  hud.canWhisper = () => flags.whisper;
  hud.stamp = () => flags.timestamp; hud.muted = n => !!n && !!flags.mutes?.has(n);     // /timestamp y /tooff (bCheckLocalChatCommand)
  hud.onLog = (t, cls) => { chatLog.unshift({ t: tr(t), type: cls === "bad" ? 2 : cls === "gold" ? 4 : cls === "chat" ? 0 : cls === "party" ? 5 : cls === "shout" ? 6 : cls === "side" ? 7 : cls === "guild" ? 8 : 1 }); if (chatLog.length > 500) chatLog.pop(); };
  hud.onButton = k => ui.key(k);
  gui.onAction = a => ({ restart: () => conn.send({ t: "respawn" }), combat: () => ui.hotkey({ key: "Tab", preventDefault() {} }), petname: () => openChat("/petname "), petmode: () => { const b = world.ents.get(pid)?.bag?.find(i => i.comp && i.comp.on); if (b) conn.send({ t: "petmode", mode: b.comp.mode === "peace" ? "attack" : "peace" }); }, char: () => ui.key("char"), pets: () => gui.toggle(43), recall: () => conn.send({ t: "recall" }), inv: () => ui.key("inv"), book: () => ui.key("book"), skill: () => ui.key("skill"), quests: () => gui.toggle(QUEST_ID), chat: () => gui.toggle(10), sys: () => ui.key("options") })[a]?.();
  hud.onSpell = id => ui.useMagic(id);
  hud.onItem = id => ui.noteItemUse(id);
  const ctl = new Controller({ conn, grid, renderer, canvas, ui });
  const mobileMenu = id => ({
    char: () => gui.onAction("char"), inv: () => gui.onAction("inv"), pets: () => gui.onAction("pets"), skill: () => gui.onAction("skill"), log: () => gui.onAction("chat"),
    book: () => ui.key("book"), sys: () => ui.key("options"), news: () => ui.key("news"), tutorial: () => tutorial.restart(), recall: () => conn.send({ t: "recall" }),
    save: () => { conn.save?.(); hud.toast(tr("Partida guardada")); }, full: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()),
    zin: () => renderer.setZoom(renderer.zoom * 1.15), zout: () => renderer.setZoom(renderer.zoom / 1.15),
  })[id]?.();
  const mob = mobile ? new Mobile({
    ctl, gui, canvas, send: c => conn.send(c), lang: getLang, world: () => world, pid, opts: () => opts, setOpt, quick: k => hud.quickUse(k), chat: () => openChat(),
    zoom: f => renderer.setZoom(renderer.zoom * f), toast: m => hud.toast(m), unlock: () => sound.unlock(), menu: mobileMenu,
  }) : null;
  onLang(() => mob?.relabel());

  setMode(opts.mode);
  applyOpts();
  addEventListener("resize", () => { renderer.resize(); hud.place(renderer.viewRect); gui.place(renderer.viewRect, renderer.dpr); });
  hud.log("Bienvenido a la granja de Aresden. Pulsa F1 para ver las novedades y qué probar.");
  hud.log("Cripta de esqueletos: pisa el teletransportador de middled1n (78–80, 69–71) de Aresfarm.", "gold");
  if (online) hud.log(conn.returning ? "Partida en línea: se ha cargado tu progreso. Intro para hablar." : "Partida en línea. Pulsa Intro para hablar con los demás.", "gold");

  // chat
  const chatBox = document.getElementById("chat"), chatIn = chatBox.querySelector("input");
  const bubbles = new Map();
  setNpcDb(assets.npcDb);
  let voice = null;                                 // personalidad: frases (voice.js, data/voice.json)
  fetch("data/voice.json").then(r => r.json()).then(d => { voice = new Voice({ data: d, bubbles, pid, lang: getLang }); voice.setPlayer(world.ents.get(pid)?.name, world.ents.get(pid)?.persona); }).catch(() => {});
  const CH_HINT = { "$": ["party", "Chat de grupo ($): solo tu grupo"], "!": ["shout", "Grito (!): todo el mapa, nivel > 10"], "~": ["side", "Chat de bando (~): tu nación"], "@": ["guild", "Chat de guild (@): tu guild"] };
  const chTag = () => { const h = CH_HINT[chatIn.value[0]]; chatIn.className = h ? "ch-" + h[0] : ""; chatIn.placeholder = tr(h ? h[1] : "Escribe y pulsa Intro (Esc para cancelar)"); };
  chatIn.addEventListener("input", chTag);
  // como en el original (Game.cpp): tras un mensaje con «!» o «$» la siguiente línea ya empieza con ese prefijo
  // Game.cpp OnKeyDown VK_UP/VK_DOWN + NotifyMsg_WhisperMode: lista de los últimos MAXWHISPERMSG (5) destinatarios; la flecha pone «/to nombre » en la línea de chat
  const WHISPER_MAX = 5;
  function whisperCycle(d) {
    const l = flags.whispers || []; if (!l.length) return;
    flags.wIdx = ((flags.wIdx ?? 0) + d + l.length) % l.length;
    openChat("/to " + l[flags.wIdx] + " ");
  }
  function whisperNote(name) {
    const l = (flags.whispers || []).filter(n => n.toLowerCase() !== name.toLowerCase());
    l.unshift(name); l.length = Math.min(l.length, WHISPER_MAX); flags.whispers = l; flags.wIdx = 0;
  }
  function openChat(pre = "") { chatBox.classList.add("open"); chatIn.value = pre || flags.chPrefix || ""; chTag(); chatIn.focus(); }
  // Órdenes locales del chat: Game.cpp bCheckLocalChatCommand (textos de lan_eng.h BCHECK_LOCAL_CHAT_COMMAND1..21)
  const mutes = new Set();
  const localToggle = (k, on, off) => { flags[k] = !flags[k]; hud.log(flags[k] ? on : off); return true; };
  function localCmd(t) {
    const m = /^\/(\w+)(?:\s+(\S+))?/.exec(t); if (!m) return false;
    const c = m[1].toLowerCase(), a = m[2];
    if (c === "showframe" || c === "fps") { flags.showFps = !flags.showFps; fpsEl.style.display = flags.showFps === false ? "none" : ""; return true; }
    if (c === "timestamp") return localToggle("timestamp", "Time stamping on messages is now turned on.", "Time stamping on messages is now turned off.");
    if (c === "showgrid" || c === "grid") { flags.grid = !flags.grid; return true; }
    if (c === "showalldmg") return localToggle("allDmg", "Damage is now shown by groups of hits.", "Damage is now shown one after another.");
    if (c === "bigitems") return localToggle("bigItems", "Items on ground are now shown as large.", "Items on ground are now shown as small.");
    if (c === "ekscreenshot") return localToggle("ekShot", "Auto screenshot upon Enemy kill is now turned on.", "Auto screenshot upon Enemy kill is now turned off.");
    if (c === "notifyme") return localToggle("notifyMe", "You will now be notified outside game if your name is mentioned.", "Notification of your name outside game is now disabled.");
    if (c === "manufill") return localToggle("manuFill", "Items will now be automatically chosen while manufacturing.", "Items will now be manually chosen while manufacturing.");
    if (c === "whon") { flags.whisper = true; hud.log("Enable to listen to whispers."); return true; }
    if (c === "whoff") { flags.whisper = false; hud.log("Unable to listen to whispers."); return true; }
    if (c === "shon") { flags.shout = true; hud.log("Enable to chat in public."); return true; }
    if (c === "shoff") { flags.shout = false; hud.log("Unable to chat in public."); return true; }
    if (c === "tooff" || c === "toon") {
      if (!a) return true;
      if (a.length > 10) { hud.log("The character's name you want to refuse is too long."); return true; }
      if (c === "tooff") {
        if (a === (world.ents.get(pid)?.name)) hud.log("You can't refuse your own messages.");
        else if (!mutes.has(a)) { mutes.add(a); hud.log("Character " + a + " has been listed on the message refusing list."); }
      } else if (mutes.delete(a)) hud.log("Character " + a + " has been released from the message refusing list.");
      flags.mutes = mutes; return true;
    }
    return false;
  }
  chatIn.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Enter") {
      const t = chatIn.value.trim();
      if (t === "/options") document.getElementById("options").classList.add("open");   // provisional: copia de seguridad de la partida
      else if (/^\/petname\s+\S/.test(t)) conn.send({ t: "petname", name: t.replace(/^\/petname\s+/, "") });
      else if (/^\/guild(\s|$)/.test(t)) guildUi.command(t);
      else if (/^\/trade(\s|$)/.test(t)) ui.autoTrade(t.slice(7).trim());
      else if (t === "/puesto" || t === "/stall") stallUi.setup();
      else if (t === "/stats" || t === "/simula" || t === "/sim") gui.toggle(STATSIM_ID);                // simulador de estadísticas (statsim.js)
      else if (t === "/tutorial") tutorial.restart();
      else if (t === "/tutorial off") tutorial.skipAll();
      else if (/^\/auto\s+\S/.test(t)) {                                           // /auto hunt slime · /auto run almacén · /auto stop (autoplay.js)
        const a = parseAuto(t.slice(6), Object.keys(assets.npcDb)), L = n => (getLang() === "en" ? n[1] : n[0]);
        if (!a) hud.log(L(["Uso: /auto hunt <criatura> · /auto run <almacén|tienda|herrería|mago|granjero|hospital> · /auto stop", "Usage: /auto hunt <creature> · /auto run <warehouse|shop|blacksmith|sorcerer|farmer|hospital> · /auto stop"]));
        else if (a.kind === "bad") hud.log(L(["No sé qué es «" + a.why + "».", "I don't know what \"" + a.why + "\" is."]));
        else if (a.kind === "stop") { ctl.setAuto(null); hud.log(L(["Modo automático detenido.", "Auto mode stopped."])); }
        else { ctl.setAuto(a); hud.log(L([a.kind === "hunt" ? "Caza automática: " + a.mob + " (un clic la cancela)." : "Voy a " + autoLabel(a, "es") + " (un clic lo cancela).", a.kind === "hunt" ? "Auto hunt: " + a.mob + " (click to cancel)." : "Heading to " + autoLabel(a, "en") + " (click to cancel)."])); }
      }
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
      else if (localCmd(t)) { /* orden local del original (bCheckLocalChatCommand) */ }
      else if (/^\/(to|w)\s+\S+\s*$/i.test(t)) hud.log("Uso: /to nombre texto");
      else if (t) { const wm = /^\/(?:to|w)\s+(\S+)\s+\S/i.exec(t); if (wm) whisperNote(wm[1]); flags.lastChat = t; flags.chPrefix = /^[!$@]/.test(t) ? t[0] : ""; conn.send({ t: "say", text: t }); }
      chatBox.classList.remove("open"); chatIn.blur();
    } else if (e.key === "Escape") { chatBox.classList.remove("open"); chatIn.blur(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); whisperCycle(e.key === "ArrowUp" ? 1 : -1); }
  });

  let qSum = 0, qN = 0, qGood = 0;
  let last = performance.now(), fps = 0, frames = 0, fpsT = 0, drawSum = 0, drawMax = 0;
  const fpsEl = document.getElementById("fps");
  let buildTag = "";                                // versión y nombre de la compilación (data/version.json), junto a los fps
  fetch("data/version.json", { cache: "no-cache" }).then(r => r.json()).then(v => { buildTag = " · v" + v.version + " " + v.name; }).catch(() => {});
  // Un error en un fotograma no debe parar el juego (la pantalla se quedaba congelada): se anota una vez y el bucle sigue.
  let loopErr = "";
  function loop(t) {
    try { frame(t); } catch (e) {
      const m = String(e && e.stack || e); if (m !== loopErr) { loopErr = m; console.error("[frame]", e); window.hbLoopError = m; }
    }
    requestAnimationFrame(loop);
  }
  function frame(t) {
    const dt = Math.min(100, t - last);             // si la pestaña estuvo oculta, no saltar
    last = t;
    const f0 = performance.now();
    frames++; fpsT += dt;
    // Calidad automática: para mantener 60 fps estables baja un nivel si el fotograma medio supera 22 ms (≈2 s) y sube uno tras ~6 s por debajo de 13 ms
    if (opts.autoQuality === true && !document.hidden && t > 20000) {      // los primeros 20 s (carga de hojas) no cuentan
      qSum += dt; qN++;
      if (qN >= 90) {
        const avg = qSum / qN; qSum = qN = 0;
        if (avg > 22 && (renderer.q || 0) < 2) { renderer.q = (renderer.q || 0) + 1; qGood = 0; applyOpts(); hud.log("Calidad gráfica reducida automáticamente (nivel " + renderer.q + ") para mantener los fps."); }
        else if (avg < 13 && (renderer.q || 0) > 0) { if (++qGood >= 4) { renderer.q--; qGood = 0; applyOpts(); } }
        else qGood = 0;
      }
    }
    if (fpsT > 500) {
      const frames0 = frames; fps = Math.round(frames * 1000 / fpsT); frames = 0; fpsT = 0;
      let txt = fps + " fps · dibujo " + (drawSum / Math.max(1, frames0)).toFixed(1) + "/" + drawMax.toFixed(0) + " ms" + buildTag;
      { const p = renderer.pt, c = renderer.pcache.st; txt += " · suelo " + p.ground.toFixed(1) + " ent " + p.ents.toFixed(1) + " luz " + p.light.toFixed(1) + " fx " + p.fx.toFixed(1) + " · caché " + c.hit + "/" + c.comp + "/" + c.direct; } drawSum = 0; drawMax = 0;
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
      ctl.hover = ctl.hoverEnt = ctl.hoverPlayer = ctl.clickFx = null;
      fx.texts = []; fx.parts = []; fx.rings = []; fx.bolts = []; fx.flash.clear(); bubbles.clear();
      sound.setTrack(trackFor(world));
      mapStream(world);
    }
    sky.sync(world); sky.update(dt);
    const rainNow = !world.fixedDay && world.weather >= 1 && world.weather <= 3;
    if (rainNow !== raining) { raining = rainNow; sound.rain(raining); }
    for (const ev of events) {
      if (ev.t === "death" && ev.by === pid && !ev.pet && ctl.auto?.kind === "hunt") ctl.auto.kills = (ctl.auto.kills || 0) + 1;      // contador de la mini ventana del auto hunt (autowin.js)
      if (ev.t === "dungeon-choice" && ev.id === pid) chooseDungeon(conn, ev);
      if (ev.id === pid) gui.recallEvent(ev);
      tutorial.onEvent(ev); questUi.onEvent(ev, world.ents.get(pid), hud);
      fx.onEvent(ev); sound.onEvent(ev); hud.onEvent(ev, world); npcUi.onEvent(ev, world); partyUi.onEvent(ev, world.ents.get(pid)); tradeUi.onEvent(ev, world.ents.get(pid)); stallUi.onEvent(ev, world.ents.get(pid)); guildUi.onEvent(ev, world.ents.get(pid));
      voice?.onEvent(ev, world, world.ents.get(npcUi.trade?.npc?.id));
      if ((ev.t === "equip" || ev.t === "unequip") && ev.id === pid) warmEquip();
      if (ev.t === "tutdummy" && ev.id === pid) { const sp = assets.npcDb.Slime?.sprite; if (sp) for (let k = 0; k < 40; k++) stream.want(sp + k, 3); }     // el limo de práctica: sus hojas con urgencia
      if (ev.t === "companion" && ev.on && ev.cls === "aura" && ev.id === pid && opts.statusPanel !== true) { setOpt("statusPanel", true); hud.log("Panel de estados activado (aura del summon)."); }       // BUG-021
      if ((ev.t === "companion" && ev.on || ev.t === "ball") && ev.id === pid) {         // baja las hojas de la especie para el icono y el compañero
        const sp = assets.npcDb[ev.sp]?.sprite;
        if (sp) for (let k = 0; k < 40; k++) stream.want(sp + k, 2);
      }
      if (ev.t === "time") sound.playRaw(ev.v === 2 ? "E31" : "E32", 1, 0);          // NotifyMsg_TimeChange
      if (ev.t === "chat" && !ev.system && ev.ch !== "side") !flags.mutes?.has(ev.name) && bubbles.set(ev.id, { text: ev.text, until: performance.now() + 5000 });
      if (ev.t === "disconnected") { const l = document.getElementById("lost"); if (ev.reason) l.querySelector("p").textContent = ev.reason; l.style.display = "grid"; }
    }
    const me = world.ents.get(pid);
    if (!me) return;                                       // aún no ha llegado el primer estado
    ctl.update();
    voice?.update(world, me, assets.npcDb);
    tutorial.update(me, world);
    mob?.update(me, world);
    const d0 = performance.now();
    perf.mark("pre", d0 - f0);
    if (prof && perfStarted && !document.hidden) { const r = prof.step(d0, dt); renderer.pf = prof.pf; document.title = "prof: " + prof.name; if (r) perf.push({ ev: "prof", ...r }); }
    renderer.render({
      world, me, dt, fx,
      sky, hover: ctl.hover, hoverEnt: ctl.hoverEnt, hoverCit: ctl.hoverCit, hoverPlayer: ctl.hoverPlayer, hoverSelf: ctl.hoverSelf, path: ctl.path, clickFx: ctl.clickFx,
      labels: ctl.keys.has("alt"), groundInfo: opts.groundInfo !== false, groundCost: opts.groundCost !== false, dirArrows: !!opts.dirArrows, showGrid: view.showGrid || !!flags.grid, bigItems: !!flags.bigItems, showMinimap: miniOn(), mapStyle: view.mapStyle, bubbles, pid,
    });
    { const d = performance.now() - d0; drawSum += d; if (d > drawMax) drawMax = d; }      // coste del dibujado del mundo (media/pico por medio segundo)
    { const now = performance.now(); if (!perfStarted) { perfStarted = true; perf.start(me.name, { map: world.map?.name, online, mode: renderer.mode, hd: !!renderer.spr.hd, auto: opts.autoQuality === true }); }
      perf.frame(dt, now - d0, renderer, { ents: world.ents.size, pl: online ? [...world.ents.values()].filter(e => e.kind === "player").length : 1, ping: online ? conn.ping : 0, map: world.map?.name, x: me.x, y: me.y, act: me.act }); }
    const h0 = performance.now();
    hud.update(world, ctl.hoverEnt); questUi.render();
    questUi.avoid(miniOn() && view.mapStyle !== "overlay" ? (() => { const r = renderer.miniRect(), b = renderer.canvas.getBoundingClientRect(); return { right: (r.x0 + r.size) * renderer.scale / renderer.dpr + renderer.ox / renderer.dpr + b.left, bottom: (r.y0 + r.size + 6) * renderer.scale / renderer.dpr + renderer.oy / renderer.dpr + b.top }; })() : null);      // el rastreador baja bajo el minimapa si lo tapa (criptas: minimapa grande)
    gui.flags.combat = flags.combat; gui.flags.safe = flags.safe;
    npcUi.sweep();
    { const m = world.ents.get(pid); if (m?.dead && !ui.wasDead) gui.open(19); ui.wasDead = !!m?.dead; }      // GAME.cpp: al morir aparece el cuadro con Restart
    // cursor del original (interface.pak, sprite 0): 0 flecha · 3 enemigo · 6 otro jugador · 4/5 hechizo amigo/enemigo · 10 mano para recoger
    let cur;
    if (opts.classicCursor) {
      const ov = gui.dialogAt(gui.mouse.x, gui.mouse.y) || gui.mouse.y >= 548;
      const he = ctl.hoverEnt, foe = he && he.kind !== "player";
      cur = 0;
      if (!ov && (ui.pointing != null || ui.petPointing != null)) cur = foe ? 5 : 4;
      else if (!ov && he) cur = foe ? 3 : 6;
      if (gui.item) cur = 10;                                       // mano mientras se arrastra un objeto (m_iPointCommandType < 50); sobre un objeto del suelo el original no cambia el cursor
    }
    gui.draw(world.ents.get(pid), world, { ctrl: ctl.keys.has("control"), cursor: cur, statusPanel: opts.statusPanel === true });
    canvas.style.cursor = opts.classicCursor ? "none" : ctl.hoverEnt ? "var(--cursor-attack)" : "var(--cursor)";
    { const e = performance.now(); perf.mark("post", e - h0); perf.mark("tot", e - f0); }      // fuera del mundo: HUD + gui; tot = todo el JS del fotograma
  }
  requestAnimationFrame(loop);

  // para pruebas automáticas
  window.hbDev = { send: c => conn.send(c), data: assets.data, npcDb: assets.npcDb, mapIds: Object.keys(assets.maps || {}) };
  window.hbFrame = frame;                           // pruebas automáticas: un fotograma a mano (la pestaña oculta no recibe requestAnimationFrame)
  window.hb = { get world() { return conn.state; }, fx, conn, renderer, ctl, setMode, pid, gui, npcUi, summonPreview, tutorial, mob };
  window.hbSound = sound;
}

// pantalla de entrada: cuenta (nombre + contraseña) en la prueba local; solo nombre en línea
// ¿Hay un servidor online? Dirección: ?server=URL (pruebas) > data/server.json {"url"} (el de GitHub Pages apunta al PC que aloja) > el mismo origen
// (la web servida por server/server.mjs). ?offline=1 fuerza la prueba local. Si el servidor configurado no responde, se juega en local.
async function findServer() {
  const q = new URLSearchParams(location.search);
  if (q.get("offline") === "1") return { base: "", info: null, lost: false };
  let base = (q.get("server") || "").replace(/\/$/, ""), configured = !!base;
  if (!base) { try { const j = await fetch("data/server.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null); base = String(j?.url || "").replace(/\/$/, ""); configured = !!base; } catch {} }
  const get = async url => { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000); try { const r = await fetch(url, { cache: "no-store", signal: ctl.signal, headers: { "ngrok-skip-browser-warning": "1" } }); /* ngrok gratis intercala una pagina de aviso sin CORS: esta cabecera la omite */ return r.ok ? await r.json() : null; } catch { return null; } finally { clearTimeout(t); } };
  let info = await get(base ? base + "/api/info" : "api/info"), via = base;
  if (!info && base) { info = await get("api/info"); via = ""; }       // el servidor configurado (túnel) no responde, pero esta página la sirve el propio servidor (localhost / red local): se usa ese
  return { base: info ? via : "", info, lost: configured && !info };
}

function askNameAndJoin(conn, online, info, spr, flags = {}) {
  const box = document.getElementById("join"), msg = box.querySelector(".msg");
  const user = box.querySelector(".user"), pass = box.querySelector(".pass"), pass2 = box.querySelector(".pass2"), go = box.querySelector(".go");
  const where = box.querySelector(".where");
  where.textContent = online
    ? tr("Partida en línea") + " · v" + info.version + (info.players.length ? tr(" · conectados: ") + info.players.join(", ") : tr(" · aún no hay nadie"))
    : flags.protoClash ? tr("El servidor es de otra versión del juego. Recarga la página (Ctrl+F5) o espera a que se actualice.") + " (v" + info.version + ")"
    : flags.lost ? tr("El servidor no está disponible ahora mismo: prueba local (un jugador, se guarda en este navegador).") : tr("Prueba local (un jugador)");
  let creating = false;
  const setTab = c => {
    creating = c;
    box.classList.toggle("creating", c);
    for (const t of box.querySelectorAll(".tabs button")) t.classList.toggle("on", (t.dataset.tab === "new") === c);
    go.textContent = c ? "Crear cuenta y entrar" : "Entrar";
    msg.textContent = "";
    pass.autocomplete = "off";   // campo de texto enmascarado: Chrome no lo trata como login (sin avisos del gestor de contraseñas)
  };
  if (online) fetch("data/version.json", { cache: "no-cache" }).then(r => r.json()).then(v => {
    if (v.version === info.version) return;
    where.textContent += " · " + tr("tu cliente es la v") + v.version;
    const w = document.createElement("div"); w.style.cssText = "color:#e05a4a;font-weight:bold;font-size:12px;margin-top:6px";
    w.textContent = tr("¡Aviso! El servidor está en otra versión que tu cliente: puede que lo nuevo no funcione (por ejemplo, comprar bolas nuevas). Reinicia el servidor o recarga la página (Ctrl+F5).");
    where.append(w);
  }).catch(() => {});
  const hint = box.querySelector(".hint");
  if (online && hint) hint.textContent = tr("Tu cuenta y tu personaje se guardan en el servidor: puedes entrar desde cualquier dispositivo.");
  for (const t of box.querySelectorAll(".tabs button")) t.onclick = () => setTab(t.dataset.tab === "new");
  user.value = store.get("name", "");
  // modo observar (solo con servidor online): ver jugar a los habitantes sin cuenta
  let watchBtn = box.querySelector(".watch");
  if (online && !watchBtn) {
    watchBtn = document.createElement("button"); watchBtn.type = "button"; watchBtn.className = "watch"; watchBtn.textContent = "👁 Observar habitantes";
    watchBtn.style.cssText = "margin-top:8px;width:100%;padding:7px;background:#1b1810;color:#ffd76a;border:1px solid #6b5a33;border-radius:6px;cursor:pointer";
    box.querySelector(".go").insertAdjacentElement("afterend", watchBtn);
  }
  const known = Accounts.listAccounts();
  if (!online && !known.length && !user.value) setTab(true);
  if (online && !user.value) setTab(true);
  box.style.display = "grid";
  (user.value ? pass : user).focus();
  return new Promise(resolve => {
    const observe = async () => {
      box.style.display = "none";
      const id = await pickBot(conn, { onCancel: () => { box.style.display = "grid"; history.replaceState(null, "", location.pathname + location.search); } });
      box.remove(); resolve(id);
    };
    if (watchBtn) watchBtn.onclick = observe;
    const submit = async () => {
      let name = user.value.trim().slice(0, 16);
      msg.textContent = "…";
      try {
        if (!name) throw new Error("Escribe un nombre.");
        if (creating && pass.value !== pass2.value) throw new Error("Las contraseñas no coinciden.");
        let hasChar = false, chars = [];
        if (online) {
          const r = await conn.login(creating ? "register" : "login", name, pass.value);
          name = r.name; hasChar = r.hasChar; chars = r.chars || [];
        } else if (creating) await Accounts.createAccount(name, pass.value);   // una partida guardada antes con ese nombre se conserva
        else await Accounts.login(name, pass.value);
        store.set("name", name);
        msg.textContent = "Entrando…";
        let create = null, slot = 0;
        if (online && chars.length) {                                  // sin ventana de seleccion: se entra directamente con el primer personaje de la cuenta
          slot = chars[0].slot;
        } else if (online ? !hasChar : !LocalConnection.hasSave(name)) {      // cuenta sin personaje: pantalla de creación
          box.style.display = "none";
          create = await createCharacter(spr, name);
        }
        let id;
        try { id = await conn.join(name, create, slot); } catch (e) { box.style.display = "grid"; throw e; }
        {                                                      // descargar el aspecto antes de empezar (también online; tope 5 s)
          const me = conn.state?.ents?.get(id);
          if (me) { const lk = spr.lookKeys(me.gender, me.look); await Promise.race([Promise.all([spr.preload(lk), spr.preloadHd(lk)]), new Promise(r => setTimeout(r, 5000))]); }
        }
        box.remove();
        resolve(id);
      } catch (e) { msg.textContent = e.message; }
    };
    if (go) go.onclick = submit;
    box.onkeydown = e => { e.stopPropagation(); if (e.key === "Enter") submit(); };
    const hashId = online && /^#observar=([0-9]+)/.exec(location.hash);
    if (hashId) { box.style.display = "none"; conn.watch(+hashId[1]).then(id => { box.remove(); resolve(id); }, () => observe()); }
    else if (online && location.hash === "#observar") observe();
    else if (online) {                                                // reentrada automática tras un reinicio del servidor (connection.js resumeAfterRestart)
      let r = null;
      try { r = JSON.parse(sessionStorage.getItem("hb.resume") || "null"); sessionStorage.removeItem("hb.resume"); } catch {}
      if (r && r.n && Date.now() - r.t < 90000) { user.value = r.n; pass.value = r.p || ""; creating = false; submit(); }
    }
  });
}

main().catch(err => {
  console.error(err);
  document.querySelector("#loading span").textContent =
    "No se pudieron cargar los datos (" + err.message + "). Abre la prueba con «Abrir prueba web.bat», no con doble clic en el HTML.";
});

