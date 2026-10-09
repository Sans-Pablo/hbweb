// Modo móvil (invento del port): controles táctiles y menús para pantallas pequeñas.
//  - isMobile(): pantalla táctil (o ?mobile=1 / ?mobile=0). Con él, el cliente añade `body.mobile`, hace que el lienzo de interfaz ocupe
//    toda la pantalla (gui.mobile) y arranca con el ataque automático activado la primera vez (initMobileOpts).
//  - Mobile: capa DOM con barras de estado, joystick virtual, botones de acción (atacar, recoger, pociones, correr, auto-ataque),
//    menú ☰ con todos los cuadros, botón ✕ para cerrar el cuadro abierto, zoom con dos dedos y aviso para girar el móvil.
// Las funciones puras (isMobile, stickTarget, nearestHostile, nearestItem, initMobileOpts) se prueban en tests/mobile.test.mjs.
import { dist } from "../shared/const.js";

// ---------------------------------------------------------------- funciones puras
export function isMobile(env = {}) {
  const q = new URLSearchParams(env.search ?? (typeof location !== "undefined" ? location.search : "")).get("mobile");
  if (q === "1") return true;
  if (q === "0") return false;
  const coarse = env.coarse ?? (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches);
  const touch = env.touchPoints ?? (typeof navigator !== "undefined" ? navigator.maxTouchPoints || ("ontouchstart" in globalThis ? 1 : 0) : 0);
  return !!coarse && touch > 0;
}
// Primera vez en el móvil: ataque automático activado (después manda lo que el jugador elija). Devuelve true si cambió algo.
export function initMobileOpts(opts, store) {
  if (store.get("mobileInit", "") === "1") return false;
  store.set("mobileInit", "1");
  opts.autoAttack = true;
  return true;
}
// Joystick: vector (-1..1) -> casilla destino a 3 casillas, evitando bloqueos; run = palanca a fondo
export function stickTarget(me, vx, vy, grid, reach = 3) {
  const len = Math.hypot(vx, vy);
  if (len < 0.25) return null;
  const ux = vx / len, uy = vy / len;
  for (let r = reach; r >= 1; r--) {
    const x = Math.round(me.x + ux * r), y = Math.round(me.y + uy * r);
    if (x === me.x && y === me.y) continue;
    if (!grid.blocked(x, y)) return { x, y, run: len > 0.85 };
  }
  return null;
}
const hostile = e => e.kind === "npc" && !e.dead && !e.master && !e.comp && !e.arena && !e.crystal;
export function nearestHostile(world, me, maxD = 9) {
  let best = null, bd = maxD + 1;
  for (const e of world.ents.values()) { if (!hostile(e)) continue; const d = dist(me, e); if (d < bd) { bd = d; best = e; } }
  return best;
}
export function nearestItem(world, me, maxD = 6) {
  let best = null, bd = maxD + 1;
  for (const it of world.items?.values?.() || []) { const d = Math.max(Math.abs(it.x - me.x), Math.abs(it.y - me.y)); if (d < bd) { bd = d; best = it; } }
  return best;
}

// ---------------------------------------------------------------- textos (es/en)
const TX = {
  menu: { es: "Menú", en: "Menu" }, close: { es: "Cerrar", en: "Close" },
  char: { es: "Personaje", en: "Character" }, inv: { es: "Mochila", en: "Bag" }, pets: { es: "Compañeros", en: "Companions" },
  skill: { es: "Habilidades", en: "Skills" }, book: { es: "Magia", en: "Magic" }, chat: { es: "Chat", en: "Chat" },
  log: { es: "Historial", en: "History" }, sys: { es: "Opciones", en: "Options" }, news: { es: "Novedades", en: "News" },
  tutorial: { es: "Tutorial", en: "Tutorial" }, save: { es: "Guardar", en: "Save" }, recall: { es: "Retorno", en: "Recall" },
  full: { es: "Pantalla completa", en: "Fullscreen" }, zin: { es: "Acercar", en: "Zoom in" }, zout: { es: "Alejar", en: "Zoom out" },
  auto: { es: "AUTO", en: "AUTO" }, rotate: { es: "Gira el móvil para jugar mejor", en: "Rotate your phone for a better view" },
  saved: { es: "Partida guardada", en: "Game saved" }, lv: { es: "Nv", en: "Lv" },
};
const TILES = [
  ["char", "🧍"], ["inv", "🎒"], ["pets", "🐾"], ["skill", "📜"], ["book", "✨"], ["log", "💬"],
  ["sys", "⚙️"], ["news", "📰"], ["tutorial", "🎓"], ["recall", "🌀"], ["save", "💾"], ["full", "⛶"], ["zin", "➕"], ["zout", "➖"],
];

const CSS = `
body.mobile #topleft, body.mobile #hudbar, body.mobile #target { display: none !important; }
#mobile { position: fixed; inset: 0; z-index: 8; pointer-events: none; display: none; font-family: "Segoe UI", system-ui, sans-serif; -webkit-tap-highlight-color: transparent; touch-action: none; }
body.mobile #mobile { display: block; }
#mobile button { pointer-events: auto; touch-action: manipulation; border: 2px solid #8a7a4a; background: rgba(28,22,12,.82); color: #f1e8d0; border-radius: 50%; font-size: 22px; line-height: 1; padding: 0; }
#mobile button:active, #mobile button.on { background: #5a4724; border-color: #f0d27a; }
#m-status { position: absolute; left: max(8px, env(safe-area-inset-left)); top: max(6px, env(safe-area-inset-top)); width: min(170px, 42vw); pointer-events: none; color: #f1e8d0; text-shadow: 0 1px 2px #000; font-size: 11px; }
#m-status .bar { position: relative; height: 13px; margin: 0 0 3px; background: rgba(0,0,0,.65); border: 1px solid #6b5a33; border-radius: 4px; overflow: hidden; }
#m-status .bar i { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; transform-origin: left; }
#m-status .hp i { background: linear-gradient(#e0493b, #8c1b12); } #m-status .mp i { background: linear-gradient(#4f86e6, #1c3f94); } #m-status .sp i { background: linear-gradient(#6fcf4f, #347a22); height: 5px; top: auto; bottom: 0; }
#m-status .bar span { position: absolute; inset: 0; text-align: center; font-size: 10px; line-height: 12px; }
#m-status .sp { height: 6px; } #m-status .xp { height: 4px; } #m-status .xp i { background: #d9b24a; }
#m-status .lv { margin-top: 1px; font-size: 11px; color: #f0d27a; }
#m-joy { position: absolute; left: max(18px, env(safe-area-inset-left)); bottom: max(18px, env(safe-area-inset-bottom)); width: 124px; height: 124px; border-radius: 50%; pointer-events: auto; touch-action: none;
  background: radial-gradient(rgba(60,50,30,.35), rgba(20,16,8,.55)); border: 2px solid rgba(138,122,74,.7); }
#m-joy .knob { position: absolute; left: 50%; top: 50%; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%; background: rgba(240,210,122,.55); border: 2px solid #f0d27a; }
#m-actions { position: absolute; right: max(14px, env(safe-area-inset-right)); bottom: max(14px, env(safe-area-inset-bottom)); width: 190px; height: 170px; }
#m-actions button { position: absolute; width: 54px; height: 54px; }
#m-atk { right: 0; bottom: 0; width: 84px !important; height: 84px !important; font-size: 36px !important; background: rgba(120,30,20,.85) !important; border-color: #e0786a !important; }
#m-atk.on { background: rgba(190,50,30,.95) !important; }
#m-pick { right: 92px; bottom: 6px; } #m-hp { right: 6px; bottom: 92px; } #m-mp { right: 66px; bottom: 100px; } #m-run { right: 124px; bottom: 66px; width: 46px !important; height: 46px !important; font-size: 19px !important; }
#m-auto { right: 130px; bottom: 120px; width: 50px !important; height: 30px !important; border-radius: 15px !important; font-size: 11px !important; font-weight: 700; }
#m-top { position: absolute; right: max(8px, env(safe-area-inset-right)); top: max(6px, env(safe-area-inset-top)); display: flex; gap: 8px; }
#m-top button { width: 44px; height: 44px; font-size: 20px; }
#m-close { position: absolute; right: max(8px, env(safe-area-inset-right)); top: max(6px, env(safe-area-inset-top)); width: 44px; height: 44px; font-size: 22px; display: none; background: rgba(120,30,20,.9) !important; border-color: #e0786a !important; z-index: 2; }
#m-sheet { position: absolute; inset: 0; background: rgba(0,0,0,.78); display: none; pointer-events: auto; overflow: auto; padding: max(12px, env(safe-area-inset-top)) 14px 14px; }
#m-sheet.open { display: block; }
#m-sheet h3 { margin: 4px 0 10px; text-align: center; color: #f0d27a; font: 600 18px Georgia, serif; }
#m-sheet .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 10px; max-width: 640px; margin: 0 auto; }
#m-sheet .grid button { position: static; width: auto; height: 76px; border-radius: 12px; font-size: 26px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
#m-sheet .grid button small { font-size: 12px; color: #e8dcc3; }
#m-sheet .x { display: block; margin: 12px auto 0; width: 150px; height: 44px; border-radius: 12px; font-size: 15px; }
#m-rotate { position: absolute; left: 50%; top: 40%; transform: translateX(-50%); background: rgba(0,0,0,.8); border: 1px solid #8a7a4a; border-radius: 10px; padding: 8px 14px; color: #f0d27a; font-size: 13px; display: none; pointer-events: auto; text-align: center; max-width: 80vw; }
@media (orientation: portrait) { body.mobile #m-rotate.show { display: block; } #m-joy { width: 110px; height: 110px; } }
body.mobile.m-talk #m-joy, body.mobile.m-talk #m-actions, body.mobile.m-talk #m-top { display: none; }
body.mobile.m-focus #m-joy, body.mobile.m-focus #m-actions, body.mobile.m-focus #m-top, body.mobile.m-focus #m-status { display: none; }
body.mobile.m-focus #m-close { display: block; }
/* paneles DOM (opciones, novedades...) a pantalla casi completa */
body.mobile .panel.open { position: fixed !important; left: 6px !important; right: 6px !important; top: 6px !important; bottom: 6px !important; width: auto !important; transform: none !important; overflow: auto; z-index: 9; }
body.mobile #news .scroll { max-height: none; }
body.mobile #options label { margin: 12px 0; font-size: 15px; } body.mobile #options input[type=checkbox] { width: 24px; height: 24px; }
body.mobile #options button, body.mobile #news button { min-height: 40px; } body.mobile .panel .close { width: 44px; height: 44px; font-size: 26px; z-index: 3; }
body.mobile #options kbd, body.mobile #news kbd { display: none; }
body.mobile #log { left: max(8px, env(safe-area-inset-left)); bottom: 150px; width: min(46vw, 360px); font-size: 12px; }
body.mobile #chat { left: 8px; right: 8px; width: auto; bottom: 8px; z-index: 12; } body.mobile #chat input { font-size: 16px; }
body.mobile #toast { font-size: 24px; }
`;

// ---------------------------------------------------------------- capa DOM
export class Mobile {
  // d: { ctl, gui, send(cmd), lang(), world(), pid, opts(), setOpt(k,v), menu(id), chat(), quick(k), zoom(f), toast(m), save() }
  constructor(d) {
    this.d = d; this.stick = null; this.vx = 0; this.vy = 0; this.holdAtk = false; this.atkAt = 0; this.cache = {};
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    const root = this.root = document.createElement("div"); root.id = "mobile";
    root.innerHTML = `
      <div id="m-status"><div class="bar hp"><i></i><span></span></div><div class="bar mp"><i></i><span></span></div><div class="bar sp"><i></i></div><div class="bar xp"><i></i></div><div class="lv"></div></div>
      <div id="m-top"><button id="m-chatb" aria-label="chat">💬</button><button id="m-menu" aria-label="menu">☰</button></div>
      <button id="m-close" aria-label="close">✕</button>
      <div id="m-joy"><div class="knob"></div></div>
      <div id="m-actions"><button id="m-atk">⚔️</button><button id="m-pick">✋</button><button id="m-hp">❤️</button><button id="m-mp">🔷</button><button id="m-run">🏃</button><button id="m-auto"></button></div>
      <div id="m-sheet"><h3></h3><div class="grid"></div><button class="x"></button></div>
      <div id="m-rotate"></div>`;
    document.body.appendChild(root);
    this.$ = s => root.querySelector(s);
    this.build(); this.bind();
    this.relabel();
  }
  tx(k) { const o = TX[k]; return o ? o[this.d.lang()] ?? o.es : k; }
  build() {
    this.$("#m-sheet .grid").innerHTML = TILES.map(([k, ico]) => `<button data-t="${k}"><span>${ico}</span><small data-k="${k}"></small></button>`).join("");
    this.$("#m-rotate").onclick = () => this.$("#m-rotate").classList.remove("show");
  }
  relabel() {
    this.$("#m-sheet h3").textContent = this.tx("menu"); this.$("#m-sheet .x").textContent = "✕ " + this.tx("close");
    for (const el of this.root.querySelectorAll("#m-sheet small")) el.textContent = this.tx(el.dataset.k);
    this.$("#m-auto").textContent = this.tx("auto"); this.$("#m-rotate").textContent = "↻ " + this.tx("rotate");
  }
  bind() {
    const $ = this.$, d = this.d, press = (el, fn) => el.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); d.unlock?.(); fn(e); });
    // joystick
    const joy = $("#m-joy"), knob = $("#m-joy .knob"), R = 48;
    const move = e => {
      const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      this.vx = dx / R; this.vy = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
    };
    joy.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); d.unlock?.(); this.stick = e.pointerId; joy.setPointerCapture(e.pointerId); move(e); });
    joy.addEventListener("pointermove", e => { if (this.stick === e.pointerId) move(e); });
    const end = e => { if (this.stick !== e.pointerId) return; this.stick = null; this.vx = this.vy = 0; knob.style.transform = ""; };
    joy.addEventListener("pointerup", end); joy.addEventListener("pointercancel", end);
    // acciones
    const atk = $("#m-atk");
    atk.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); d.unlock?.(); this.holdAtk = true; atk.classList.add("on"); this.attack(true); atk.setPointerCapture(e.pointerId); });
    const atkEnd = () => { this.holdAtk = false; atk.classList.remove("on"); };
    atk.addEventListener("pointerup", atkEnd); atk.addEventListener("pointercancel", atkEnd);
    press($("#m-pick"), () => this.pick());
    press($("#m-hp"), () => d.quick("hp")); press($("#m-mp"), () => d.quick("mp"));
    press($("#m-run"), () => d.setOpt("run", !d.opts().run));
    press($("#m-auto"), () => d.setOpt("autoAttack", !d.opts().autoAttack));
    press($("#m-menu"), () => this.sheet(true)); press($("#m-chatb"), () => d.chat());
    press($("#m-close"), () => this.closeTop());
    $("#m-sheet .x").addEventListener("click", () => this.sheet(false));
    $("#m-sheet").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (b) { this.sheet(false); d.menu(b.dataset.t); } });
    // dos dedos sobre el mundo: zoom
    const cv = d.canvas, pts = new Map(); let base = 0;
    cv.addEventListener("pointerdown", e => {
      if (e.pointerType !== "touch") return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; base = Math.hypot(a[0] - b[0], a[1] - b[1]); d.ctl.down = false; d.ctl.noHold = true; d.ctl.intent = null; d.ctl.path = []; }
      if (pts.size >= 2) e.stopImmediatePropagation();
    }, true);
    cv.addEventListener("pointermove", e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()], n = Math.hypot(a[0] - b[0], a[1] - b[1]); if (base > 0 && Math.abs(n - base) > 6) { d.zoom(n / base); base = n; } e.stopImmediatePropagation(); }
    }, true);
    const up = e => { pts.delete(e.pointerId); }; cv.addEventListener("pointerup", up, true); cv.addEventListener("pointercancel", up, true);
    addEventListener("resize", () => this.orient()); this.orient();
  }
  orient() { this.$("#m-rotate").classList.toggle("show", innerHeight > innerWidth && !this.rotatedHint); if (innerHeight > innerWidth && !this.rotatedHint) setTimeout(() => { this.rotatedHint = true; this.$("#m-rotate").classList.remove("show"); }, 6000); }
  sheet(on) { this.$("#m-sheet").classList.toggle("open", on); }
  // acciones
  attack(first) {
    const w = this.d.world(), me = w.ents.get(this.d.pid); if (!me || me.dead) return;
    const cur = this.d.ctl.intent;
    if (cur && cur.t === "attack") { const t = w.ents.get(cur.id); if (t && !t.dead) return; }
    const t = nearestHostile(w, me); if (t) this.d.ctl.intent = { t: "attack", id: t.id }; else if (first) this.d.toast?.("—");
  }
  pick() {
    const w = this.d.world(), me = w.ents.get(this.d.pid); if (!me || me.dead) return;
    const it = nearestItem(w, me);
    if (!it || (it.x === me.x && it.y === me.y)) { this.d.send({ t: "pickup" }); return; }
    this.d.ctl.intent = { t: "pickup", x: it.x, y: it.y };
  }
  closeTop() {
    const g = this.d.gui, ids = g.order.filter(i => !g.dialogs.get(i).mobileFixed);
    if (ids.length) g.close(ids.at(-1));
    for (const p of document.querySelectorAll("#ui .panel.open")) p.classList.remove("open");
  }
  // cada fotograma
  update(me, world) {
    const d = this.d, g = d.gui, o = d.opts();
    const open = g.order.some(i => !g.dialogs.get(i).mobileFixed) || !!document.querySelector("#ui .panel.open");
    document.body.classList.toggle("m-focus", open);
    document.body.classList.toggle("m-talk", g.isOpen(46));
    if (!me) return;
    // joystick -> intención de andar
    if (this.stick !== null) {
      const t = stickTarget(me, this.vx, this.vy, d.ctl.grid);
      d.ctl.stickActive = true; d.ctl.forceRun = !!t?.run;
      d.ctl.intent = t ? { t: "move", x: t.x, y: t.y } : null; if (!t) d.ctl.path = [];
    } else if (d.ctl.stickActive) { d.ctl.stickActive = false; d.ctl.forceRun = false; d.ctl.intent = null; d.ctl.path = []; }
    if (this.holdAtk && performance.now() - this.atkAt > 250) { this.atkAt = performance.now(); this.attack(false); }
    // estado
    const set = (k, v, fn) => { if (this.cache[k] !== v) { this.cache[k] = v; fn(v); } };
    const k = (a, b) => Math.max(0, Math.min(1, a / Math.max(1, b)));
    set("hp", Math.ceil(me.hp) + "/" + me.maxHp, v => { const b = this.$("#m-status .hp"); b.querySelector("span").textContent = v; b.querySelector("i").style.transform = `scaleX(${k(me.hp, me.maxHp)})`; });
    set("mp", Math.ceil(me.mp) + "/" + me.maxMp, v => { const b = this.$("#m-status .mp"); b.querySelector("span").textContent = v; b.querySelector("i").style.transform = `scaleX(${k(me.mp, me.maxMp)})`; });
    set("sp", Math.round(me.sp), () => { this.$("#m-status .sp i").style.transform = `scaleX(${k(me.sp, me.maxSp)})`; });
    set("xp", Math.round(100 * k(me.exp - me.prevExp, me.nextExp - me.prevExp)), v => { this.$("#m-status .xp i").style.transform = `scaleX(${v / 100})`; });
    set("lv", this.tx("lv") + " " + me.level + " · " + me.gold + " 🪙" + (me.pool > 0 ? " · ⬆" + me.pool : ""), v => { this.$("#m-status .lv").textContent = v; });
    set("run", !!o.run, v => this.$("#m-run").classList.toggle("on", v));
    set("auto", !!o.autoAttack, v => this.$("#m-auto").classList.toggle("on", v));
  }
}
