// OBSERVADOR DIVIDIDO (INVENTO del port): pantalla de cuatro cuadrantes para controlar y analizar a los habitantes, no solo mirar.
//   Juego en vivo (iframe: al cambiar de habitante solo se recarga ese cuadrante) · Plantel (limpio, por party) · Ficha del observado · Estadísticas y tendencias.
// El marco manda su ficha ("brain") por postMessage; la lista sale de /api/bots cada 2 s y de ella se guarda un historial para las tendencias.
import { getLang } from "./i18n.js";
import { L, esc, SIDE, MODES } from "./observer.js";
import { groups, dot, modeName, brainHtml, TABS, ordered } from "./watchpanel.js";

const $ = id => document.getElementById(id);
const hashId = () => +(/(?:^#|[#&])(?:observar=)?([0-9]+)/.exec(location.hash)?.[1] || 0);
let roster = [], sel = hashId(), brain = null, tab = "res", q = "", sideF = 0;
const hist = new Map(), MAXH = 450, POLL = 2000;                                    // id → muestras cada 2 s (15 min)

// ---- cuadrante 1: juego (iframe) ----
function game() {
  const g = $("game");
  g.innerHTML = `<h3><b>🎮 ${L("En vivo", "Live")}</b><span class="who"></span><span class="sp"><label title="${L('◀ ▶ solo saltan entre los que hacen PvP', '◀ ▶ only jump between PvP fighters')}"><input type="checkbox" data-a="pvp"> PvP</label> <button data-a="prev" title="[">◀</button> <button data-a="next" title="]">▶</button> <button data-a="rec" title="${L('Grabar vídeo del cuadrante', 'Record this view')}">⏺</button> <button data-a="log" title="${L('Guardar el log de lo que veo (JSON)', 'Save the log of what I see (JSON)')}">💾</button> <button data-a="full">⤢</button></span></h3><div class="empty">${L("Elige un habitante en la lista", "Pick a resident from the list")}</div>`;
  g.onchange = e => { if (e.target.dataset?.a === "pvp") pvpOnly = e.target.checked; };
  g.onclick = e => { const a = e.target.dataset?.a; if (a === "prev") step(-1); else if (a === "next") step(1); else if (a === "full") g.querySelector("iframe")?.requestFullscreen?.(); else if (a === "rec") record(e.target); else if (a === "log") saveLog(); };
}
// v0.85.97 (obs. 83): grabar el cuadrante en vivo (webm del lienzo del marco); (obs. 61): guardar el log de lo observado
let rec = null;
function download(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
function record(btn) {
  if (rec) { rec.stop(); return; }
  const cv = $("game").querySelector("iframe")?.contentDocument?.querySelector("canvas"); if (!cv || !cv.captureStream || typeof MediaRecorder === "undefined") return;
  const chunks = [], r = new MediaRecorder(cv.captureStream(30), { mimeType: "video/webm" }), who = roster.find(b => b.id === sel)?.name || "live";
  r.ondataavailable = e => e.data.size && chunks.push(e.data);
  r.onstop = () => { rec = null; btn.textContent = "⏺"; btn.style.color = ""; download("hb-" + who + "-" + new Date().toISOString().replace(/[:.]/g, "-") + ".webm", new Blob(chunks, { type: "video/webm" })); };
  r.start(1000); rec = r; btn.textContent = "⏹"; btn.style.color = "#f55";
}
function saveLog() {
  const b = roster.find(x => x.id === sel), out = { at: new Date().toISOString(), name: b?.name, bot: b || null, brain, hist: (hist.get(sel) || []).slice(-60), pvp: pvpName === b?.name ? pvpData : null };
  download("hb-log-" + (b?.name || sel) + ".json", new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
}
function show(id) {
  sel = id; brain = null; history.replaceState(null, "", "#" + id);
  const g = $("game"); let f = g.querySelector("iframe");
  if (f && f.dataset.ready) { f.contentWindow.postMessage({ hbWatch: id }, location.origin); paintRoster(true); paintInfo(true); paintStats(); return; }   // marco ya cargado: cambia de habitante sin recargar
  if (!f) { g.querySelector(".empty")?.remove(); f = document.createElement("iframe"); f.allow = "autoplay"; g.appendChild(f); f.addEventListener("load", () => { f.dataset.ready = "1"; }); }
  else delete f.dataset.ready;
  f.src = "index.html?embed=1&o=" + id + (new URLSearchParams(location.search).get("server") ? "&server=" + encodeURIComponent(new URLSearchParams(location.search).get("server")) : "") + "#observar=" + id;                         // la consulta distinta fuerza recargar solo el marco
  paintRoster(true); paintInfo(true); paintStats();
}
let pvpOnly = false; const isPvp = b => !!b.pv || b.mode === "pit" || /promise/i.test(b.map || "");
const order = () => { const l = ordered(roster); return pvpOnly ? l.filter(isPvp) : l; };
function step(d) { const l = order(); if (!l.length) return; const i = l.findIndex(b => b.id === sel); show(l[(i < 0 ? (d > 0 ? 0 : l.length - 1) : (i + d + l.length) % l.length)].id); }
// teclas: [ y ] cambian de habitante; el resto (F6 = bolsa, etc.) se reenvía al juego del marco como si estuviera enfocado
const frame = () => $("game").querySelector("iframe");
for (const t of ["keydown", "keyup"]) addEventListener(t, e => {
  if (e.key === "F5" && !e.ctrlKey) e.preventDefault();
  if (e.target.closest?.("input,textarea,select")) return;
  if (t === "keydown" && (e.key === "[" || e.key === "]")) { step(e.key === "[" ? -1 : 1); return; }
  if (/^F([2-9]|1[01])$/.test(e.key)) e.preventDefault();      // F5 no refresca el observador por error, haya o no marco
  const f = frame(); if (!f?.contentWindow || e.ctrlKey && /^[rwtnl]$/i.test(e.key)) return;
  if (e.ctrlKey && /^[a-z]$/i.test(e.key)) e.preventDefault();      // v0.85.62 (obs. 8): Ctrl+S etc. van al juego y el navegador no guarda la página madre
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
  return `<div class="r${b.id === sel ? " me" : ""}" data-id="${b.id}"><span>${dot(b.mode)}</span><span class="n"><span title="${b.mage ? L("Mago", "Mage") : L("Guerrero", "Warrior")}">${b.mage ? "🔮" : "⚔️"}</span> <b style="color:${sc}">${esc(b.name)}</b> <span style="color:#998">${L("Nv", "Lv")}${b.lv}</span>${b.grp && b.lead === b.name ? " 👑" : ""}</span><span style="color:#998">${b.guild ? "⚑" + esc(b.guild.slice(0, 6)) : ""}</span>` +
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
const bars = (rows, col = "#9a8") => { const m = Math.max(1, ...rows.map(r => r[1])); return rows.map(([n, v, lab]) => `<div class="bar"><span class="lbl" title="${esc(n)}">${esc(n)}</span><span class="tr"><i style="width:${100 * v / m}%;background:${col}"></i></span><span class="v">${lab ?? v}</span></div>`).join("") || "—"; };
const rate = (h, k) => { if (h.length < 2) return 0; const a = h[0], z = h[h.length - 1], dt = (z.t - a.t) / 60000; return dt > 0.2 ? (z[k] - a[k]) / dt : 0; };
function statsInit() { $("stats").innerHTML = `<h3><b>📈 ${L("Estadísticas", "Statistics")}</b><span class="sp" style="color:#998" id="win"></span></h3><div class="body"></div>`; }
function paintStats() {
  const body = $("stats").querySelector(".body"), top = body.scrollTop, n = roster.length, h = hist.get(sel) || [];
  const b = roster.find(x => x.id === sel), mins = h.length > 1 ? ((h[h.length - 1].t - h[0].t) / 60000).toFixed(1) : "0";
  $("win").textContent = L("ventana ", "window ") + mins + " min";
  let s = "";
  if (b) {
    s += `<div class="sec">${L("Tendencia de", "Trend of")} ${esc(b.name)}</div>`;
    s += [["hp", "❤ HP %", "#c44", h.at(-1)?.hp + "%"], ["lv", L("Nivel", "Level"), "#cb3", "Nv " + b.lv], ["gold", L("Oro", "Gold"), "#da4", b.gold + " (" + rate(h, "gold").toFixed(1) + "/min)"], ["kills", L("Bajas", "Kills"), "#9a8", b.kills + " (" + rate(h, "kills").toFixed(1) + "/min)"], ["ek", "PvP", "#a6c", String(b.ek)]]
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
  s += `<div class="sec">${L("Más bajas por minuto", "Top kills per minute")}</div>` + bars(rk("kills", "/m"), "#9a8");
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
  const set = (v, val) => { root.style.setProperty(v, val); sv[v] = val; layout(); };
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
  for (const el of [$("vs"), $("hs"), $("vs2")]) el.ondblclick = () => { const v = el.id === "vs" ? "--c1" : el.id === "hs" ? "--r1" : "--b1"; root.style.removeProperty(v); delete sv[v]; layout(); try { localStorage.setItem(K, JSON.stringify(sv)); } catch {} };
}

// ---- cuadrante 5: estadísticas globales y peticiones de los bots (testers) ----
let st = { global: {}, requests: [], summons: [] }, selSum = 0;
const kv = o => Object.entries(o || {}).sort((a, c) => c[1] - a[1]);
function globInit() { $("glob").innerHTML = `<h3><b>🌐 ${L("Global y peticiones", "Global & requests")}</b></h3><div class="body"></div>`; }
function paintGlob() {
  const body = $("glob").querySelector(".body"), g = st.global || {}, top = body.scrollTop, mn = m => (MODES[m]?.[getLang() === "en" ? 1 : 0] || m);
  let s = `<div class="fx"><span>${L("Habitantes", "Residents")}</span><span>${g.bots ?? 0} (${L("muertos", "dead")} ${g.dead ?? 0})</span><span>${L("Nivel medio / máx.", "Avg / max level")}</span><span>${g.avgLv ?? 0} / ${g.maxLv ?? 0}</span><span>${L("Oro total", "Total gold")}</span><span>${g.gold ?? 0}</span><span>${L("Bajas / enemy kills", "Kills / enemy kills")}</span><span>${g.kills ?? 0} / ${g.ek ?? 0}</span><span>${L("Parties", "Parties")}</span><span>${g.parties ?? 0}</span><span>Summons</span><span>${g.summons ?? 0}</span><span>${L("Atascados", "Stuck")}</span><span>${g.stuck ?? 0}</span></div>`;
  s += `<div class="sec">${L("Clases (misiones)", "Classes (quests)")}</div>` + bars(kv(g.cls), "#c9a24a");
  s += `<div class="sec">${L("Arquetipos", "Archetypes")}</div>` + bars(kv(g.arch), "#a6c");
  s += `<div class="sec">${L("Qué prefieren hacer (deseos)", "What they prefer (wishes)")}</div>` + bars(kv(g.wish).slice(0, 8), "#9a8");
  s += `<div class="sec">${L("Peticiones de los testers (bots)", "Tester requests (bots)")}</div>`;
  s += st.requests.length ? st.requests.map(r => `<div style="margin:3px 0"><b style="color:#ffd76a">×${r.n}</b> ${esc(getLang() === "en" ? r.en : r.es)} <span style="color:#998">— ${esc(r.who.slice(0, 5).join(", "))}${r.who.length > 5 ? "…" : ""}</span></div>`).join("") : `<span style="color:#998">${L("Sin peticiones todavía", "No requests yet")}</span>`;
  body.innerHTML = s; body.scrollTop = top;
}

// ---- cuadrante 6: top de summons y ficha ----
function summInit() {
  const e = $("summ"); e.innerHTML = `<h3><b>🐾 Top summons</b><span class="cnt"></span></h3><div class="body"></div>`;
  e.onclick = ev => { const r = ev.target.closest("[data-sid]"); if (r) { selSum = +r.dataset.sid; paintSumm(); } const o = ev.target.closest("[data-oid]"); if (o) show(+o.dataset.oid); };
}
const talLine = t => Object.entries(t || {}).filter(([, v]) => v).map(([k, v]) => k + " " + v).join(", ") || "—";
function paintSumm() {
  const body = $("summ").querySelector(".body"), top = body.scrollTop, l = st.summons || [], x = l.find(m => m.id === selSum) || l[0];
  $("summ").querySelector(".cnt").textContent = l.length;
  let s = l.slice(0, 15).map(m => `<div class="row2${x && m.id === x.id ? " me" : ""}" data-sid="${m.id}"><span><b style="color:${(SIDE[m.side] || SIDE[0])[1]}">${esc(m.nm)}</b> <span style="color:#998">${esc(m.sp)}</span></span><span>${L("Nv", "Lv")}${m.lvl}</span><span style="color:#998">${esc(m.owner)}</span></div>`).join("") || `<span style="color:#998">${L("Sin summons fuera", "No summons out")}</span>`;
  if (x) {
    const p = (v, mx) => `${v}/${mx}`;
    s += `<div class="sec">${L("Ficha de", "Sheet of")} ${esc(x.nm)}</div><div class="fx">` + [
      [L("Especie", "Species"), x.sp], [L("Dueño", "Owner"), `<a data-oid="${x.oid}" style="cursor:pointer;color:#9cf">${esc(x.owner)}</a>${x.bot ? " 🤖" : ""}`], [L("Clase", "Class"), x.cls || "—"], [L("Nivel", "Level"), `${x.lvl} (${x.exp}/${x.need} exp)`],
      ["HP", p(x.hp, x.mhp)], ["MP", p(x.mp, x.mmp)], [L("Daño", "Damage"), `${x.dmg} (${L("cuota", "share")} ${x.share}%)`], [L("Modo", "Mode"), x.mode], [L("Mapa", "Map"), x.map],
      [L("Habilidad", "Skill"), x.skill || "—"], [L("Talentos", "Talents"), `${x.spent} · ${talLine(x.tal)}`], [L("Factores", "Factors"), `dmg ×${x.f.dmg} hp ×${x.f.hp} mp ×${x.f.mp} ${L("recibido", "taken")} ×${x.f.taken}`], [L("Ahorro de MP", "MP saving"), x.save + "%"],
    ].map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join("") + `</div>`;
  }
  body.innerHTML = s; body.scrollTop = top;
}

// ---- disposición de paneles: cada hueco elige su panel (se puede dejar vacío); se guarda en este navegador ----
const PANELS = { game: ["🎮 En vivo", "🎮 Live"], roster: ["👥 Habitantes", "👥 Residents"], info: ["🧠 Personaje", "🧠 Character"], stats: ["📈 Estadísticas", "📈 Statistics"], glob: ["🌐 Global y peticiones", "🌐 Global & requests"], summ: ["🐾 Top summons", "🐾 Top summons"], chars: ["🧑‍🌾 Personajes", "🧑‍🌾 Characters"], pvp: ["⚔ PvP", "⚔ PvP"], obs: ["📝 Observaciones", "📝 Notes"], qa: ["💬 Preguntas", "💬 Questions"] };
const DEF = ["game", "roster", "info", "stats"], KP = "hb.obs.panels";
let slots = DEF.slice(); try { const v = JSON.parse(localStorage.getItem(KP) || "null"); if (Array.isArray(v) && v.length === 4 && v.every(x => PANELS[x]) && new Set(v).size === 4) slots = v; } catch {}   // siempre 4 paneles distintos
// Los paneles nunca cambian de padre (mover un iframe en el DOM lo recarga): viven en #stage y se colocan encima de su hueco con coordenadas.
function place() {
  for (const id of Object.keys(PANELS)) { const h = $(id).querySelector("h3"); if (!h) continue; let sl = h.querySelector(".pick");
    if (!sl) { sl = document.createElement("select"); sl.className = "pick"; sl.title = L("Cambiar este panel", "Change this panel"); h.appendChild(sl);
      sl.innerHTML = Object.entries(PANELS).map(([k, n]) => `<option value="${k}">${n[getLang() === "en" ? 1 : 0]}</option>`).join(""); sl.onchange = () => pick(slots.indexOf(id), sl.value); }
    sl.value = id; }
  layout();
}
function layout() {
  const sx = scrollX, sy = scrollY;
  for (const id of Object.keys(PANELS)) { const el = $(id), i = slots.indexOf(id); if (i < 0) { el.style.display = "none"; continue; }
    const r = $("s" + (i + 1)).getBoundingClientRect(); Object.assign(el.style, { display: "flex", left: r.left + sx + "px", top: r.top + sy + "px", width: r.width + "px", height: r.height + "px" }); }
}
function pick(i, id) {
  if (i < 0 || slots[i] === id) return;
  const j = slots.indexOf(id); if (j >= 0) slots[j] = slots[i]; slots[i] = id;                       // si ya estaba en otro hueco, se intercambian
  try { localStorage.setItem(KP, JSON.stringify(slots)); } catch {}
  place(); paintAll();                                                                              // el marco no se toca: no se recarga
}
// ---- panel de personajes: por clase y oficio, con filtros y contadores (para seguir a granjeros y pescadores) ----
const ROLES = [["warrior", "Guerrero", "Warrior"], ["mage", "Mago", "Mage"], ["summoner", "Summoner", "Summoner"], ["support", "Apoyo", "Support"], ["farmer", "Granjero", "Farmer"], ["fisher", "Pescador", "Fisher"]];
const roleOf = b => b.job === "farmer" || b.job === "fisher" ? b.job : b.job === "support" ? "support" : ({ warrior: "warrior", mage: "mage", summoner: "summoner", support: "support" })[b.cls] || "warrior";
let roleF = "";
function charsInit() {
  const c = $("chars"); c.innerHTML = `<h3><b>🧑‍🌾 ${L("Personajes", "Characters")}</b><span class="cnt"></span></h3><div class="chips"></div><div class="body" style="padding:0"></div>`;
  c.onclick = e => { const f = e.target.closest("[data-f]"); if (f) { roleF = f.dataset.f === roleF ? "" : f.dataset.f; paintChars(); return; } const r = e.target.closest(".r"); if (r && +r.dataset.id !== sel) show(+r.dataset.id); };
}
function paintChars() {
  const c = $("chars"), body = c.querySelector(".body"), top = body.scrollTop, cnt = {};
  for (const b of roster) { const k = roleOf(b); cnt[k] = (cnt[k] || 0) + 1; }
  c.querySelector(".chips").innerHTML = ROLES.map(([k, es, en]) => `<a data-f="${k}" class="${roleF === k ? "on" : ""}">${L(es, en)} ${cnt[k] || 0}</a>`).join("");
  c.querySelector(".cnt").textContent = roster.length;
  body.innerHTML = ROLES.filter(([k]) => !roleF || roleF === k).map(([k, es, en]) => { const l = roster.filter(b => roleOf(b) === k); return l.length ? `<div class="g"><span>${L(es, en)}</span><span>${l.length}</span></div>` + l.map(row).join("") : ""; }).join("") || `<span style="color:#998;padding:6px 8px;display:block">${L("Nadie con este oficio", "Nobody with this job")}</span>`;
  body.scrollTop = top;
}
// ---- PvP del personaje (v0.85.52): ficha + pensamiento de combate contra jugadores, de /api/admin/botdetail (server/botstats.mjs detail) ----
let pvpAt = 0, pvpName = "", pvpData = null;
function pvpInit() { $("pvp").innerHTML = `<h3><b>⚔ PvP</b><span class="who"></span></h3><div class="body"></div>`; }
async function paintPvp() {
  const el = $("pvp"); if (!el || el.style.display === "none") return;
  const r = roster.find(x => x.id === sel), body = el.querySelector(".body"); el.querySelector(".who").textContent = r ? r.name : "";
  if (!r) { body.textContent = L("Elige un habitante", "Pick a resident"); return; }
  if (r.name !== pvpName || Date.now() - pvpAt > 3000) {
    const nm = r.name; pvpName = nm; pvpAt = Date.now();
    try { pvpData = await (await api("/api/admin/botdetail?name=" + encodeURIComponent(nm))).json(); } catch { return; }
    if (pvpName !== nm) return;
  }
  const d = pvpData, s = d?.sheet; if (!d || d.error || !s) { body.textContent = L("Sin datos de este personaje", "No data for this character"); return; }
  const st = s.stats || {}, ul = a => (a && a.length ? a.map(esc).join(", ") : "—");
  body.innerHTML = `<div class="sec">${L("Ficha", "Sheet")}</div>
    <div>${esc(String(s.build))} · Lv ${s.level} · Str ${st.str} Vit ${st.vit} Dex ${st.dex} Int ${st.int} Mag ${st.mag} (${L("libres", "free")} ${s.pool})</div>
    <div>HP ${s.hp}/${s.maxHp} · MP ${s.mp}/${s.maxMp} · ${L("Defensa", "Defense")} ${s.defense} · ${L("Impacto", "Hit")} ${s.hit}</div>
    <div>DR ${s.addDR} · HP+ ${s.addHP} · MP+ ${s.addMP} · MR ${s.addMR} · PA ${s.addPR} · MA ${s.addAbsMD} · ${L("Res. magia", "Magic res.")} ${s.resistMagic}</div>
    <div>${L("Equipo", "Gear")}: ${ul(s.equip)}</div><div>${L("Magias", "Spells")}: ${ul(s.spells)}</div>
    <div class="sec">${L("Pensamiento PvP", "PvP thinking")} (${(d.pvp || []).length})</div>
    ${(d.pvp || []).slice(0, 80).map(x => `<div>${esc(typeof x === "string" ? x : x.text || JSON.stringify(x))}</div>`).join("") || `<div style="color:#998">${L("Aún no ha peleado contra jugadores", "No player fights yet")}</div>`}`;
}

// ---- Preguntas (v0.85.63, obs. 20): chat que responde con la ficha y el razonamiento del bot (/api/admin/botdetail) ----
const QA_STAT = { int: ["Int", "intelecto", "inteligencia"], str: ["Str", "fuerza"], vit: ["Vit", "vitalidad"], dex: ["Dex", "destreza"], mag: ["Mag", "magia"] };
const QA_WHY = { int: { mage: "es un mago: la Int sube el daño y el maná, y manda sobre el resto", vanguard: "solo la mínima para llevar el equipo; el resto va a Str/Vit", archer: "lo justo para el equipo; prioriza Dex" }, str: { vanguard: "su arma y armadura piden Str", mage: "poca: no la necesita" }, vit: { vanguard: "el resto de puntos libres va a Vit para aguantar", mage: "lo mínimo para sobrevivir" }, dex: { archer: "el arco escala con Dex", vanguard: "múltiplos de 10 para el esquive" }, mag: { mage: "múltiplos de 10: cada 10 da maná y tamaño de hechizo", vanguard: "casi nada" } };
function qaInit() {
  $("qa").innerHTML = `<h3><b>💬 ${L("Preguntas", "Questions")}</b></h3><div class="body" style="display:flex;flex-direction:column;gap:6px"></div><div style="display:flex;gap:4px;padding:5px"><input placeholder="${L("¿Por qué Kira tiene tanta Int?", "Why does Kira have so much Int?")}" style="flex:1"><button>▶</button></div>`;
  const body = $("qa").querySelector(".body"), inp = $("qa").querySelector("input");
  const say = (who, html) => { const d = document.createElement("div"); d.style.cssText = who ? "align-self:flex-end;background:#4a3a14;padding:3px 8px;border-radius:8px" : "background:#2c2417;padding:3px 8px;border-radius:8px;max-width:92%"; d.innerHTML = html; body.appendChild(d); body.scrollTop = 1e9; };
  say(0, L("Pregunta por un habitante: «¿por qué Nombre tiene tanta Int / Str / HP…?». Respondo con su ficha.", "Ask about a resident: “why does Name have so much Int / Str / HP…?”. I answer from their sheet."));
  const ask = async () => {
    const q = inp.value.trim(); if (!q) return; inp.value = ""; say(1, esc(q));
    const r = roster.find(x => q.toLowerCase().includes(x.name.toLowerCase())) || roster.find(x => x.id === sel);
    if (!r) { say(0, L("No sé de quién hablas: nombra a un habitante o elígelo en la lista.", "I don't know who you mean: name a resident or pick one.")); return; }
    let d; try { d = await (await api("/api/admin/botdetail?name=" + encodeURIComponent(r.name))).json(); } catch { say(0, "…"); return; }
    const s = d?.sheet; if (!s) { say(0, L("Sin datos de ", "No data for ") + esc(r.name)); return; }
    const st = s.stats || {}, b = String(s.build), lq = q.toLowerCase(); let a = "";
    const k = Object.keys(QA_STAT).find(k => QA_STAT[k].some(w => lq.includes(w.toLowerCase())));
    if (k) a = `<b>${esc(r.name)}</b> (${esc(b)}, Lv ${s.level}): ${QA_STAT[k][0]} ${st[k]}. ${esc(QA_WHY[k]?.[b] || L("sale del reparto de su build", "comes from its build allocation"))}. ${L("Libres", "Free")}: ${s.pool}.`;
    else if (/hp|vida|life/.test(lq)) a = `HP ${s.hp}/${s.maxHp}: Vit ${st.vit}, Lv ${s.level}, HP+ ${s.addHP}.`;
    else if (/mana|mp|maná/.test(lq)) a = `MP ${s.mp}/${s.maxMp}: Int ${st.int}, Mag ${st.mag}, MP+ ${s.addMP}.`;
    else if (/hace|doing|pensando|why|por qu/.test(lq) && (d.log || [])[0]) a = esc(r.name) + ": " + esc(typeof d.log[0] === "string" ? d.log[0] : d.log[0].text || JSON.stringify(d.log[0]));
    else a = `<b>${esc(r.name)}</b>: ${esc(b)} Lv ${s.level} · Str ${st.str} Vit ${st.vit} Dex ${st.dex} Int ${st.int} Mag ${st.mag} · HP ${s.hp}/${s.maxHp} · MP ${s.mp}/${s.maxMp}`;
    say(0, a);
  };
  $("qa").querySelector("button").onclick = ask; inp.onkeydown = e => { if (e.key === "Enter") ask(); };
}
function paintAll() { loadObs(); paintRoster(true); paintInfo(true); paintStats(); paintGlob(); paintSumm(); paintChars(); paintPvp(); }

// ---- observaciones (0.85.60): mini tickets del propietario; viven en docs/observaciones.json vía /api/admin/obs ----
const ST = { nueva: ["🆕 Nueva", "🆕 New"], analizada: ["💡 Analizada", "💡 Analysed"], aprobada: ["✅ Aprobada", "✅ Approved"], corregir: ["✏ Corregir", "✏ Amend"], hecha: ["🏁 Hecha", "🏁 Done"] };
let obsDb = { tickets: [] }, obsKey = "", showDone = false, obsQ = ""; const doneOpen = new Set();
const obsPost = async o => { try { obsDb = await (await fetch((await apiBase()) + "/api/admin/obs", { method: "POST", body: JSON.stringify(o) })).json(); paintObs(true); } catch { /* servidor fuera */ } };
function obsInit() {
  const e = $("obs"); e.innerHTML = `<h3><b>📝 ${L("Observaciones", "Notes")}</b><span class="cnt"></span><span class="sp"><button data-o="all" data-s="analizada" title="${L("Marca todas las nuevas como analizadas (análisis conjunto)", "Mark all new as analysed (joint analysis)")}">🔎 ${L("Analizar todas", "Analyse all")}</button> <button data-o="all" data-s="aprobada">✅ ${L("Aprobar todas", "Approve all")}</button> <button data-o="all" data-s="dev" title="${L("Manda las aprobadas a desarrollo (docs/COLA.md)", "Sends approved ones to development (docs/COLA.md)")}">🚀 ${L("A desarrollo", "To dev")}</button><button data-o="tog" title="${L('Mostrar/ocultar las hechas', 'Show/hide done')}">🏁</button></span></h3><div style="padding:5px 7px;display:flex;gap:4px"><textarea rows="2" placeholder="${L("Escribe lo que ves…", "Write what you see…")}" style="flex:1;min-width:0;background:#1b1810;color:inherit;border:1px solid #6b5a33;border-radius:6px;font:inherit"></textarea><button data-o="add">+</button></div><div class="body"></div>`;
  e.querySelector("h3 .sp").insertAdjacentHTML("afterbegin", `<input data-o="q" placeholder="🔍 ${L("buscar notas, soluciones, versión…", "search notes, solutions, version…")}" style="width:170px"> `);   // v0.85.97 (obs. 82): buscador; los comentarios llevan «vX.Y.Z: solución»
  e.addEventListener("input", ev => { if (ev.target.dataset?.o === "q") { obsQ = ev.target.value.trim().toLowerCase(); paintObs(true); } });
  e.addEventListener("keydown", ev => { if (ev.ctrlKey && ev.key === "Enter" && ev.target.tagName === "TEXTAREA") { ev.preventDefault(); e.querySelector("[data-o=add]").click(); } });
  e.onclick = async ev => { const d = ev.target.dataset || {}, t = d.id && +d.id;
    if (d.o === "add") { const ta = e.querySelector("textarea"); if (ta.value.trim()) { await obsPost({ op: "add", text: ta.value }); ta.value = ""; } }
    else if (d.o === "open") { doneOpen.add(t); paintObs(true); }
    else if (d.o === "tog") { showDone = !showDone; paintObs(true); }
    else if (d.o === "all") obsPost({ op: "all", state: d.s });
    else if (d.o === "state") obsPost({ op: "state", id: t, state: d.s });
    else if (d.o === "del") { if (confirm(L("¿Borrar?", "Delete?"))) obsPost({ op: "del", id: t }); }
    else if (d.o === "com") { const i = e.querySelector('input[data-c="' + t + '"]'); if (i?.value.trim()) obsPost({ op: "comment", id: t, text: i.value }); } };
}
// v0.85.98 (nota 69): valores de bonus que usan los bots para equiparse. sub = multiplicador por tipo de bonus secundario (3 DR, 4 HP, 5 SP, 6 MP, 7 MR, 8 PA, 9 MA, 10 golpes seguidos, 11 exp, 12 oro); item = puntos extra por id de objeto
async function botValuesInit() {
  const e = $("obs"); if (!e || e.querySelector("#bv")) return;
  const d = document.createElement("details"); d.id = "bv"; d.style.cssText = "padding:5px 7px;border-top:1px solid #3a2f18";
  d.innerHTML = `<summary style="cursor:pointer"><b>⚖ ${L("Valor de objetos para bots", "Item values for bots")}</b></summary><div style="color:#998;margin:3px 0">${L("JSON: sub = multiplicador por tipo de bonus (6 = recuperar MP, 4 = HP…), item = puntos extra por id de objeto. Ej.: {\"sub\":{\"6\":2},\"item\":{\"405\":30}}", "JSON: sub = multiplier per bonus type (6 = MP recovery, 4 = HP…), item = extra points per item id. E.g. {\"sub\":{\"6\":2},\"item\":{\"405\":30}}")}</div><textarea rows="4" style="width:100%;box-sizing:border-box;background:#1b1810;color:inherit;border:1px solid #6b5a33;border-radius:6px;font:inherit"></textarea><button>${L("Guardar", "Save")}</button> <span class="m" style="color:#998"></span>`;
  e.appendChild(d);
  const ta = d.querySelector("textarea"), m = d.querySelector(".m");
  try { ta.value = JSON.stringify(await (await api("/api/admin/botvalues")).json()); } catch { /* servidor fuera */ }
  d.querySelector("button").onclick = async () => { try { const r = await fetch((await apiBase()) + "/api/admin/botvalues", { method: "POST", body: JSON.stringify(JSON.parse(ta.value || "{}")) }); m.textContent = r.ok ? "✔" : "✖"; } catch { m.textContent = "✖ JSON"; } };
}
async function loadObs() { botValuesInit(); try { obsDb = await (await api("/api/admin/obs")).json(); paintObs(); } catch { /* idem */ } }
function paintObs(force) {
  const el = $("obs"), body = el?.querySelector(".body"); if (!body || el.style.display === "none") return;
  const k = JSON.stringify(obsDb) + getLang() + obsQ; if (!force && k === obsKey) return; obsKey = k;
  const all = obsDb.tickets || [], ts = obsQ ? all.filter(t => JSON.stringify([t.id, t.text, t.proposal, t.comments]).toLowerCase().includes(obsQ)) : all, keep = [...body.querySelectorAll("input")].map(i => [i.dataset.c, i.value]), top = body.scrollTop;
  el.querySelector(".cnt").textContent = ts.length;
  body.innerHTML = ts.slice().reverse().map(t => t.state === "hecha" && !showDone && !obsQ && !doneOpen.has(t.id) ? `<div style="border-bottom:1px solid #3a2f18;padding:3px 0;color:#998;cursor:pointer" data-o="open" data-id="${t.id}">🏁 #${t.id} ${esc((t.text || "").slice(0, 70))}</div>` : `<div style="border-bottom:1px solid #3a2f18;padding:5px 0"><div><b style="color:#ffd76a">#${t.id}</b> <span style="color:#998">${(ST[t.state] || ST.nueva)[getLang() === "en" ? 1 : 0]}</span> <a data-o="del" data-id="${t.id}" style="cursor:pointer;float:right;color:#998">✕</a></div><div>${esc(t.text)}</div>${t.proposal ? `<div style="color:#9cf;margin:3px 0">💡 ${esc(t.proposal)}</div>` : ""}${(t.comments || []).map(c => `<div style="color:#bba">💬 ${esc(c.text)}</div>`).join("")}<div style="display:flex;gap:3px;margin-top:3px"><input data-c="${t.id}" placeholder="${L("comentar…", "comment…")}" style="flex:1;min-width:0"><button data-o="com" data-id="${t.id}">💬</button></div><div style="margin-top:3px">${Object.entries(ST).map(([s, n]) => `<a data-o="state" data-id="${t.id}" data-s="${s}" style="cursor:pointer;margin-right:6px;${t.state === s ? "color:#ffd76a" : "color:#998"}">${n[getLang() === "en" ? 1 : 0]}</a>`).join("")}</div></div>`).join("") || `<span style="color:#998">${L("Sin observaciones", "No notes yet")}</span>`;
  for (const [c, v] of keep) { const i = body.querySelector('input[data-c="' + c + '"]'); if (i) i.value = v; }
  body.scrollTop = top;
}
// ---- arranque ----
// Dirección del servidor como en main.js#findServer: ?server=URL > data/server.json (GitHub Pages -> PC que aloja) > mismo origen.
let baseP;
const apiBase = () => baseP ||= (async () => {
  const q = new URLSearchParams(location.search).get("server");
  if (q) return q.replace(/[/]+$/, "");
  try { const j = await fetch("data/server.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null); const u = String(j?.url || "").replace(/[/]+$/, ""); if (u) { const ok = await fetch(u + "/api/info", { cache: "no-store" }).then(r => r.ok, () => false); if (ok) return u; const same = await fetch("api/info", { cache: "no-store" }).then(r => r.ok, () => false); if (!same) return u; } } catch { /* mismo origen */ }
  return "";
})();
const api = async p => fetch((await apiBase()) + p, { cache: "no-store", headers: { "ngrok-skip-browser-warning": "1" } });

async function poll() {
  try { roster = (await (await api("/api/bots")).json()).list || []; sample(); paintRoster(); paintStats(); paintChars(); paintPvp(); } catch { /* servidor un momento fuera: se reintenta */ }
  try { st = await (await api("/api/stats")).json(); paintGlob(); paintSumm(); } catch { /* idem */ }
}
addEventListener("message", e => {
  if (e.origin === location.origin && e.data?.hbPick) { show(+e.data.hbPick); return; }                  // clic sobre un personaje dentro del marco (obs. 32)
  if (e.origin !== location.origin || !e.data || !("hbBrain" in e.data) || e.data.id !== sel) return;
  brain = e.data.hbBrain; if (brain) { paintInfo(); $("game").querySelector(".who").textContent = brain.name + " · " + (MODES[brain.mode]?.[getLang() === "en" ? 1 : 0] || brain.mode) + " · " + brain.map; }
});
splitters(); game(); rosterInit(); infoInit(); statsInit(); globInit(); summInit(); charsInit(); pvpInit(); obsInit(); qaInit(); place(); addEventListener("resize", layout); new ResizeObserver(layout).observe($("app"));
loadObs(); poll().then(() => { if (sel) show(sel); else if (roster.length) show(order()[0].id); });
setInterval(poll, POLL);
