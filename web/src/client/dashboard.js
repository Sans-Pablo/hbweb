// OBSERVADOR DIVIDIDO (INVENTO del port): pantalla de cuatro cuadrantes para controlar y analizar a los habitantes, no solo mirar.
//   Juego en vivo (iframe: al cambiar de habitante solo se recarga ese cuadrante) · Plantel (limpio, por party) · Ficha del observado · Estadísticas y tendencias.
// El marco manda su ficha ("brain") por postMessage; la lista sale de /api/bots cada 2 s y de ella se guarda un historial para las tendencias.
import { getLang } from "./i18n.js";
import { L, esc, SIDE, MODES } from "./observer.js";
import { groups, dot, modeName, brainHtml, TABS } from "./watchpanel.js";

const $ = id => document.getElementById(id);
const hashId = () => +(/(?:^#|[#&])(?:observar=)?([0-9]+)/.exec(location.hash)?.[1] || 0);
let roster = [], sel = hashId(), brain = null, tab = "res", q = "", sideF = 0;
const hist = new Map(), MAXH = 450, POLL = 2000;                                    // id → muestras cada 2 s (15 min)

// ---- cuadrante 1: juego (iframe) ----
function game() {
  const g = $("game");
  g.innerHTML = `<h3><b>🎮 ${L("En vivo", "Live")}</b><span class="who"></span><span class="sp"><button data-a="prev" title="[">◀</button> <button data-a="next" title="]">▶</button> <button data-a="full">⤢</button></span></h3><div class="empty">${L("Elige un habitante en la lista", "Pick a resident from the list")}</div>`;
  g.onclick = e => { const a = e.target.dataset?.a; if (a === "prev") step(-1); else if (a === "next") step(1); else if (a === "full") g.querySelector("iframe")?.requestFullscreen?.(); };
}
function show(id) {
  sel = id; brain = null; history.replaceState(null, "", "#" + id);
  const g = $("game"); let f = g.querySelector("iframe");
  if (!f) { g.querySelector(".empty")?.remove(); f = document.createElement("iframe"); f.allow = "autoplay"; g.appendChild(f); }
  f.src = "index.html?embed=1&o=" + id + "#observar=" + id;                         // la consulta distinta fuerza recargar solo el marco
  paintRoster(true); paintInfo(true); paintStats();
}
const order = () => { const { out, solo } = groups(roster, ""); return [...out.flatMap(x => x.m), ...solo]; };
function step(d) { const l = order(); if (!l.length) return; const i = l.findIndex(b => b.id === sel); show(l[(i + d + l.length) % l.length].id); }
// teclas: [ y ] cambian de habitante; el resto (F6 = bolsa, etc.) se reenvía al juego del marco como si estuviera enfocado
const frame = () => $("game").querySelector("iframe");
for (const t of ["keydown", "keyup"]) addEventListener(t, e => {
  if (e.target.closest?.("input,textarea,select")) return;
  if (t === "keydown" && (e.key === "[" || e.key === "]")) { step(e.key === "[" ? -1 : 1); return; }
  if (/^F([2-9]|1[01])$/.test(e.key)) e.preventDefault();      // F5 no refresca el observador por error, haya o no marco
  const f = frame(); if (!f?.contentWindow || e.ctrlKey && /^[rwtnl]$/i.test(e.key)) return;
  if (/^Fd+$/.test(e.key) || e.key === " " || e.key.startsWith("Arrow") || e.key === "Tab") e.preventDefault();      // el navegador no actúa sobre la página madre
  const { key, code, shiftKey, ctrlKey, altKey, repeat } = e;
  f.contentWindow.dispatchEvent(new f.contentWindow.KeyboardEvent(t, { key, code, shiftKey, ctrlKey, altKey, repeat, bubbles: true, cancelable: true }));
});

// ---- cuadrante 2: plantel ----
let rkey = ""; const open = new Set();                                          // grupos desplegados (por defecto todos colapsados)
function rosterInit() {
  const r = $("roster");
  r.innerHTML = `<h3><b>👥 ${L("Habitantes", "Residents")}</b><span class="cnt"></span></h3>
    <div style="padding:5px 7px;display:flex;gap:4px"><input class="q" placeholder="${L("buscar nombre, mapa, guild…", "search name, map, guild…")}" style="flex:1;min-width:0"><select class="s"><option value="0">∗</option><option value="1">A</option><option value="2">E</option></select></div>
    <div class="body" style="padding:0"></div>`;
  r.querySelector(".q").oninput = e => { q = e.target.value; paintRoster(true); };
  r.querySelector(".s").onchange = e => { sideF = +e.target.value; paintRoster(true); };
  r.onclick = e => { const gh = e.target.closest(".g[data-g]"); if (gh) { const k = gh.dataset.g; open.has(k) ? open.delete(k) : open.add(k); paintRoster(true); return; }
    const row = e.target.closest(".r"); if (row && +row.dataset.id !== sel) show(+row.dataset.id); };
}
function row(b) {
  const sc = (SIDE[b.side] || SIDE[0])[1];
  return `<div class="r${b.id === sel ? " me" : ""}" data-id="${b.id}"><span>${dot(b.mode)}</span><span class="n"><b style="color:${sc}">${esc(b.name)}</b> <span style="color:#998">${L("Nv", "Lv")}${b.lv}</span>${b.grp && b.lead === b.name ? " 👑" : ""}</span><span style="color:#998">${b.guild ? "⚑" + esc(b.guild.slice(0, 6)) : ""}</span>` +
    `<span class="hp"><i style="width:${Math.max(0, Math.round(100 * b.hp / Math.max(1, b.mh)))}%"></i></span><span class="d">${esc(modeName(b))} · ${esc(b.map)}${b.floor ? " " + b.floor : ""}</span></div>`;
}
function paintRoster(force) {
  const list = roster.filter(b => !sideF || b.side === sideF), { out, solo } = groups(list, q);
  const k = JSON.stringify([out, solo, sel, getLang(), [...open]]); if (!force && k === rkey) return; rkey = k;
  const r = $("roster"), body = r.querySelector(".body"), top = body.scrollTop;
  r.querySelector(".cnt").textContent = list.length;
  body.innerHTML = out.map(g => { const ld = g.m.find(x => x.name === g.lead) || g.m[0], on = open.has(g.lead);
      return `<div class="g" data-g="${esc(g.lead)}" style="cursor:pointer"><span>${on ? "▾" : "▸"} 👥 ${L("Grupo de", "Party of")} ${esc(g.lead)} <span style="text-transform:none;color:#998">· ${esc(modeName(ld))} · ${esc(ld.map)}</span></span><span>${g.m.length}</span></div>` + (on ? g.m.map(row).join("") : ""); }).join("")
    + (solo.length ? `<div class="g"><span>${L("En solitario", "Solo")}</span><span>${solo.length}</span></div>` + solo.map(row).join("") : "");
  body.scrollTop = top;
}

// ---- cuadrante 3: ficha ----
let ikey = "";
function infoInit() {
  const i = $("info");
  i.innerHTML = `<h3><b>🧠 ${L("Personaje", "Character")}</b><span class="who"></span></h3><div class="tabs"></div><div class="body"></div>`;
  i.querySelector(".tabs").innerHTML = TABS.map(([k, es, en]) => `<a data-t="${k}">${L(es, en)}</a>`).join("");
  i.onclick = e => {
    const t = e.target.dataset?.t, a = e.target.dataset?.a;
    if (t) { tab = t; paintInfo(true); } else if (a === "tab") { tab = e.target.dataset.t; paintInfo(true); } else if (a === "go" && +e.target.dataset.id !== sel) show(+e.target.dataset.id);
  };
}
function paintInfo(force) {
  const i = $("info"), b = brain;
  for (const a of i.querySelectorAll(".tabs a")) a.classList.toggle("on", a.dataset.t === tab);
  const body = i.querySelector(".body");
  if (!b) { if (force) body.innerHTML = `<span style="color:#998">${sel ? "…" : L("Sin selección", "Nothing selected")}</span>`; return; }
  const k = JSON.stringify(b) + tab + getLang(); if (!force && k === ikey) return; ikey = k;
  const top = body.scrollTop;
  body.innerHTML = brainHtml(b, tab, true).replace(/<div style="display:flex;gap:4px;margin:6px 0">[\s\S]*?<\/div>/, "");   // las pestañas van en la cabecera del cuadrante
  body.scrollTop = top;
  i.querySelector(".who").textContent = b.name;
}

// ---- cuadrante 4: estadísticas y tendencias ----
function sample() {
  const t = Date.now();
  for (const b of roster) { let h = hist.get(b.id); if (!h) hist.set(b.id, h = []); h.push({ t, hp: Math.round(100 * b.hp / Math.max(1, b.mh)), lv: b.lv, gold: b.gold, kills: b.kills, ek: b.ek, mode: b.mode, map: b.map }); if (h.length > MAXH) h.shift(); }
}
const spark = (h, k, col) => {
  if (h.length < 2) return `<svg></svg>`;
  const v = h.map(s => s[k]), lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
  const pts = v.map((y, i) => `${(100 * i / (v.length - 1)).toFixed(1)},${(24 - 22 * (y - lo) / r).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 100 26" preserveAspectRatio="none"><polyline fill="none" stroke="${col}" stroke-width="1.5" vector-effect="non-scaling-stroke" points="${pts}"/></svg>`;
};
const bars = (rows, col = "#6a9") => { const m = Math.max(1, ...rows.map(r => r[1])); return rows.map(([n, v, lab]) => `<div class="bar"><span class="lbl" title="${esc(n)}">${esc(n)}</span><span class="tr"><i style="width:${100 * v / m}%;background:${col}"></i></span><span class="v">${lab ?? v}</span></div>`).join("") || "—"; };
const rate = (h, k) => { if (h.length < 2) return 0; const a = h[0], z = h[h.length - 1], dt = (z.t - a.t) / 60000; return dt > 0.2 ? (z[k] - a[k]) / dt : 0; };
function statsInit() { $("stats").innerHTML = `<h3><b>📈 ${L("Estadísticas", "Statistics")}</b><span class="sp" style="color:#998" id="win"></span></h3><div class="body"></div>`; }
function paintStats() {
  const body = $("stats").querySelector(".body"), top = body.scrollTop, n = roster.length, h = hist.get(sel) || [];
  const b = roster.find(x => x.id === sel), mins = h.length > 1 ? ((h[h.length - 1].t - h[0].t) / 60000).toFixed(1) : "0";
  $("win").textContent = L("ventana ", "window ") + mins + " min";
  let s = "";
  if (b) {
    s += `<div class="sec">${L("Tendencia de", "Trend of")} ${esc(b.name)}</div>`;
    s += [["hp", "❤ HP %", "#c44", h.at(-1)?.hp + "%"], ["lv", L("Nivel", "Level"), "#cb3", "Nv " + b.lv], ["gold", L("Oro", "Gold"), "#da4", b.gold + " (" + rate(h, "gold").toFixed(1) + "/min)"], ["kills", L("Bajas", "Kills"), "#6a9", b.kills + " (" + rate(h, "kills").toFixed(1) + "/min)"], ["ek", "PvP", "#a6c", String(b.ek)]]
      .map(([k, lab, col, v]) => `<div class="spark"><span>${lab}</span>${spark(h, k, col)}<span style="text-align:right">${v}</span></div>`).join("");
    const tm = {}; for (let i = 1; i < h.length; i++) tm[h[i].mode] = (tm[h[i].mode] || 0) + (h[i].t - h[i - 1].t) / 1000;
    const tot = Object.values(tm).reduce((a, c) => a + c, 0) || 1;
    s += `<div class="sec">${L("En qué empleó el tiempo", "How its time was spent")}</div>` + bars(Object.entries(tm).sort((a, c) => c[1] - a[1]).map(([m, v]) => [MODES[m]?.[getLang() === "en" ? 1 : 0] || m, v, Math.round(100 * v / tot) + "%"]), "#c9a24a");
    const mp = {}; for (const x of h) mp[x.map] = (mp[x.map] || 0) + 1;
    s += `<div class="sec">${L("Mapas visitados", "Maps visited")}</div>` + bars(Object.entries(mp).sort((a, c) => c[1] - a[1]).slice(0, 5).map(([m, v]) => [m, v, Math.round(v * POLL / 1000) + "s"]), "#69c");
  }
  const md = {}; for (const x of roster) md[x.mode] = (md[x.mode] || 0) + 1;
  s += `<div class="sec">${L("Qué hacen todos", "What everyone does")} (${n})</div>` + bars(Object.entries(md).sort((a, c) => c[1] - a[1]).map(([m, v]) => [MODES[m]?.[getLang() === "en" ? 1 : 0] || m, v]), "#c9a24a");
  const sd = [1, 2].map(i => { const l = roster.filter(x => x.side === i); return [SIDE[i][0], l.length, l.length + " · " + L("Nv", "Lv") + " " + (l.reduce((a, c) => a + c.lv, 0) / Math.max(1, l.length)).toFixed(1) + " · " + l.reduce((a, c) => a + c.kills, 0) + " " + L("bajas", "kills")]; });
  s += `<div class="sec">${L("Por bando", "By side")}</div>` + sd.map(([nm, v, lab]) => `<div class="bar"><span class="lbl">${nm}</span><span class="tr"><i style="width:${100 * v / Math.max(1, n)}%;background:${nm === "Aresden" ? "#e07a5f" : "#6fa8dc"}"></i></span></div><div style="color:#998;margin:-2px 0 3px 102px">${lab}</div>`).join("");
  const rk = (k, u) => roster.map(x => [x.name, rate(hist.get(x.id) || [], k)]).filter(x => x[1] > 0).sort((a, c) => c[1] - a[1]).slice(0, 5).map(([nm, v]) => [nm, v, v.toFixed(1) + u]);
  s += `<div class="sec">${L("Más bajas por minuto", "Top kills per minute")}</div>` + bars(rk("kills", "/m"), "#6a9");
  s += `<div class="sec">${L("Más oro por minuto", "Top gold per minute")}</div>` + bars(rk("gold", "/m"), "#da4");
  const mpa = {}; for (const x of roster) mpa[x.map] = (mpa[x.map] || 0) + 1;
  s += `<div class="sec">${L("Mapas más poblados", "Busiest maps")}</div>` + bars(Object.entries(mpa).sort((a, c) => c[1] - a[1]).slice(0, 6), "#69c");
  const gd = {}; for (const x of roster) if (x.guild) gd[x.guild] = (gd[x.guild] || 0) + 1;
  s += `<div class="sec">Guilds</div>` + bars(Object.entries(gd).sort((a, c) => c[1] - a[1]).slice(0, 6), "#a6c");
  body.innerHTML = s; body.scrollTop = top;
}

// ---- divisores arrastrables (se recuerdan en este navegador) ----
function splitters() {
  const root = document.documentElement, K = "hb.obs.layout";
  let sv = {}; try { sv = JSON.parse(localStorage.getItem(K) || "{}"); } catch {}
  const set = (v, val) => { root.style.setProperty(v, val); sv[v] = val; };
  for (const [v, val] of Object.entries(sv)) root.style.setProperty(v, val);
  const drag = (el, axis, v, area, min, max) => el.addEventListener("pointerdown", e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add("drag"); document.body.classList.add("dragging");
    const r = area().getBoundingClientRect(), mv = ev => {
      const p = axis === "x" ? (ev.clientX - r.left) / r.width : (ev.clientY - r.top) / r.height;
      set(v, (Math.min(max, Math.max(min, p)) * 100).toFixed(1) + "%");
    };
    const up = () => { el.classList.remove("drag"); document.body.classList.remove("dragging"); el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); try { localStorage.setItem(K, JSON.stringify(sv)); } catch {} };
    el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up);
  });
  drag($("vs"), "x", "--c1", () => document.getElementById("app"), 0.25, 0.85);
  drag($("hs"), "y", "--r1", () => document.getElementById("app"), 0.2, 0.85);
  drag($("vs2"), "x", "--b1", () => $("bottom"), 0.15, 0.85);
  for (const el of [$("vs"), $("hs"), $("vs2")]) el.ondblclick = () => { const v = el.id === "vs" ? "--c1" : el.id === "hs" ? "--r1" : "--b1"; root.style.removeProperty(v); delete sv[v]; try { localStorage.setItem(K, JSON.stringify(sv)); } catch {} };
}

// ---- arranque ----
async function poll() {
  try { roster = (await (await fetch("/api/bots", { cache: "no-store" })).json()).list || []; sample(); paintRoster(); paintStats(); } catch { /* servidor un momento fuera: se reintenta */ }
}
addEventListener("message", e => {
  if (e.origin !== location.origin || !e.data || !("hbBrain" in e.data) || e.data.id !== sel) return;
  brain = e.data.hbBrain; if (brain) { paintInfo(); $("game").querySelector(".who").textContent = brain.name + " · " + (MODES[brain.mode]?.[getLang() === "en" ? 1 : 0] || brain.mode) + " · " + brain.map; }
});
splitters(); game(); rosterInit(); infoInit(); statsInit();
poll().then(() => { if (sel) show(sel); else if (roster.length) show(order()[0].id); });
setInterval(poll, POLL);
