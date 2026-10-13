// Terreno: visor de las losetas y objetos de mapa (hojas tN de sprites.json) con el modelo Original / HD / IA, por hoja y sobre mapas reales.
// Independiente del juego: lee los manifiestos y las hojas directamente.
const $ = id => document.getElementById(id);
const J = u => fetch(u, { cache: "no-cache" }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
const [man, hd, ia, index] = await Promise.all([J("data/sprites.json"), J("data/sprites_hd.json"), J("data/sprites_ia.json"), J("data/maps/index.json")]);
const SHEETS = Object.keys(man).filter(k => /^t\d+$/.test(k)).sort((a, b) => a.slice(1) - b.slice(1));
const LS = "hb_terreno_sel", RV = "hb_terreno_rev", SAVE = ["view", "model", "key", "map", "mx", "my", "obj", "zoom", "bg", "flt"];
let rev = {}; try { rev = JSON.parse(localStorage.getItem(RV) || "{}"); } catch {}   // revisión por hoja: "ok" | "mal" (solo en este navegador; «Copiar revisión» la exporta)
const mapIds = Array.isArray(index) ? index.map(m => m.id ?? m) : Object.keys(index.maps || index);
const mark = k => rev[k] === "ok" ? " ✔" : rev[k] === "mal" ? " ✘" : "";
function fillKeys() {
  const f = $("flt").value, cur = $("key").value;
  const list = SHEETS.filter(k => !f || (f === "ia" ? ia[k] : f === "noia" ? !ia[k] : f === "pend" ? ia[k] && !rev[k] : rev[k] === f));
  $("key").innerHTML = list.map(k => `<option value="${k}">${k} · ${man[k].frames.length} fot.${ia[k] ? " · IA" : hd[k] ? " · HD" : ""}${mark(k)}</option>`).join("");
  if (list.includes(cur)) $("key").value = cur;
  return list;
}
$("map").innerHTML = mapIds.map(id => `<option value="${id}">${id}</option>`).join("");
let saved = {}; try { saved = JSON.parse(localStorage.getItem(LS) || "{}"); } catch {}
const restore = ids => { for (const id of ids) if (id in saved) { if ($(id).type === "checkbox") $(id).checked = saved[id]; else $(id).value = saved[id]; } };
restore(["flt"]); fillKeys(); restore(SAVE.filter(id => id !== "flt"));
const store = () => { try { const o = {}; for (const id of SAVE) o[id] = $(id).type === "checkbox" ? $(id).checked : $(id).value; localStorage.setItem(LS, JSON.stringify(o)); } catch {} };

// Hoja a usar según el modelo. La IA cae a HD y la HD al original si falta.
const imgs = new Map();
const load = u => { let i = imgs.get(u); if (!i) { i = new Image(); i.src = u; imgs.set(u, i); } return i; };
function sheet(key) {
  const m = +$("model").value, e = m === 2 ? ia[key] || hd[key] : m === 1 ? hd[key] : null;
  const img = e ? load("data/" + (e.dir || "sprites_hd") + "/" + e.png) : load("data/sprites/" + man[key].png);
  return { img, k: e ? e.k : 1, own: e && e.frames, from: e ? (m === 2 && ia[key] ? "IA" : "HD") : "Original", ok: img.complete && img.naturalWidth > 0 };
}
// Dibuja el fotograma f con el pivote en (x, y). false si la imagen aún no cargó.
function put(ctx, key, f, x, y, z) {
  const fr = man[key].frames[f]; if (!fr) return true;
  const s = sheet(key); if (!s.ok) return false;
  const [sx, sy, w, h, ox = 0, oy = 0] = fr, r = s.own ? s.own[f] : [sx * s.k, sy * s.k, w * s.k, h * s.k];
  ctx.drawImage(s.img, r[0], r[1], r[2], r[3], x + ox * z, y + oy * z, w * z, h * z);
  return true;
}
const smooth = ctx => { ctx.imageSmoothingEnabled = +$("model").value > 0; ctx.imageSmoothingQuality = "high"; };
const bgFill = (ctx, w, h) => { ctx.fillStyle = $("bg").value; ctx.fillRect(0, 0, w, h); };

// ---- Hojas: todos los fotogramas en cuadrícula + prueba de costuras del elegido ----
let sel = 0;
function drawSheet() {
  const key = $("key").value, z = +$("zoom").value, fs = man[key].frames, n = fs.length, cv = $("cv");
  const cw = Math.max(32, ...fs.map(f => f[2])), ch = Math.max(32, ...fs.map(f => f[3])), cellW = cw * z + 2, cellH = ch * z + 2;
  const cols = Math.max(1, Math.min(20, Math.floor((innerWidth - 460) / cellW))), rows = Math.ceil(n / cols);
  cv.width = cols * cellW; cv.height = rows * cellH; const ctx = cv.getContext("2d"); smooth(ctx); bgFill(ctx, cv.width, cv.height);
  let ok = true;
  for (let f = 0; f < n; f++) {
    const x = (f % cols) * cellW + 1, y = Math.floor(f / cols) * cellH + 1;
    ok = put(ctx, key, f, x - fs[f][4] * z, y - fs[f][5] * z, z) && ok;
    if (f === sel) { ctx.strokeStyle = "#d4ab52"; ctx.strokeRect(x - .5, y - .5, fs[f][2] * z + 1, fs[f][3] * z + 1); }
  }
  cv.onclick = e => { const r = cv.getBoundingClientRect(), s = cv.width / r.width, f = Math.floor((e.clientY - r.top) * s / cellH) * cols + Math.floor((e.clientX - r.left) * s / cellW); if (f >= 0 && f < n) { sel = f; drawSheet(); } };
  // costuras: la loseta elegida repetida 4×4
  const fr = fs[sel] || [0, 0, 32, 32, 0, 0], t = 4, w = fr[2], h = fr[3];
  $("side").innerHTML = `<div style="color:var(--muted);font-size:12px">Fotograma ${sel} repetido ${t}×${t} (costuras)</div><canvas id="seam"></canvas>`;
  const sc = $("seam"); sc.width = w * z * t; sc.height = h * z * t;
  const c2 = sc.getContext("2d"); smooth(c2); bgFill(c2, sc.width, sc.height);
  for (let j = 0; j < t; j++) for (let i = 0; i < t; i++) put(c2, key, sel, i * w * z - fr[4] * z, j * h * z - fr[5] * z, z);
  const s = sheet(key), mm = +$("model").value;
  $("info").textContent = `${key} · ${n} fotogramas · mostrando: ${s.from}${s.k > 1 ? " ×" + s.k : ""}${mm && s.from === "Original" ? " (esta hoja aún no tiene versión " + (mm === 2 ? "IA ni HD" : "HD") + ")" : mm === 2 && s.from === "HD" ? " (aún sin IA, se usa la HD)" : ""} · clic en un fotograma para ver sus costuras`;
  if (!ok) setTimeout(() => $("view").value === "sheet" && drawSheet(), 400);
}

// ---- Mapa: región de losetas y objetos de un mapa real ----
const grids = new Map();
async function grid(id) {
  if (grids.has(id)) return grids.get(id);
  const [meta, buf] = await Promise.all([J("data/maps/" + id + ".json"), fetch("data/maps/" + id + ".bin").then(r => r.arrayBuffer())]);
  const g = { w: meta.w, h: meta.h, dv: new DataView(buf) }; grids.set(id, g); return g;
}
let busy = false;
async function drawMap() {
  if (busy) return; busy = true;
  try {
    const g = await grid($("map").value), z = +$("zoom").value, T = 32 * z, cv = $("cv");
    const cols = Math.min(g.w, Math.max(4, Math.floor((innerWidth - 40) / T))), rows = Math.min(g.h, Math.max(4, Math.floor((innerHeight - 170) / T)));
    const x0 = Math.max(0, Math.min(g.w - cols, +$("mx").value | 0)), y0 = Math.max(0, Math.min(g.h - rows, +$("my").value | 0)); $("mx").value = x0; $("my").value = y0;
    cv.width = cols * T; cv.height = rows * T; const ctx = cv.getContext("2d"); smooth(ctx); bgFill(ctx, cv.width, cv.height);
    let ok = true; const used = new Set(), at = (x, y) => (y * g.w + x) * 10;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const o = at(x0 + i, y0 + j), spr = g.dv.getInt16(o, true), fr = g.dv.getInt16(o + 2, true);
      if (spr > 0 && man["t" + spr]) { used.add("t" + spr); ok = put(ctx, "t" + spr, fr, i * T, j * T, z) && ok; }
    }
    if ($("obj").checked) for (let j = 0; j < rows + 6; j++) for (let i = -4; i < cols + 4; i++) {
      const x = x0 + i, y = y0 + j; if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      const o = at(x, y), obj = g.dv.getInt16(o + 4, true), of = g.dv.getInt16(o + 6, true); if (obj <= 0 || !man["t" + obj]) continue;
      used.add("t" + obj);
      if (obj >= 100 && obj < 150 && man["t" + (obj + 50)]) { ctx.globalAlpha = .45; ok = put(ctx, "t" + (obj + 50), of, i * T + T / 2, j * T + T / 2, z) && ok; ctx.globalAlpha = 1; }
      ok = put(ctx, "t" + obj, of, i * T, j * T, z) && ok;
    }
    const m = +$("model").value, n = [...used].filter(k => m === 2 ? ia[k] : m === 1 ? hd[k] : true).length;
    $("side").innerHTML = "";
    $("info").textContent = `${$("map").value} (${g.w}×${g.h}) · región ${x0},${y0} · ${cols}×${rows} casillas · hojas usadas ${used.size}, con ${["original", "HD", "IA"][m]}: ${n}${m ? " (el resto se ve en original)" : ""} · arrastra el mapa para moverte`;
    if (!ok) setTimeout(() => $("view").value === "map" && drawMap(), 400);
  } finally { busy = false; }
}
// arrastrar para moverse por el mapa
let drag = null;
$("cv").onpointerdown = e => { if ($("view").value === "map") { drag = [e.clientX, e.clientY, +$("mx").value, +$("my").value]; $("cv").setPointerCapture(e.pointerId); } };
$("cv").onpointermove = e => { if (!drag) return; const T = 32 * +$("zoom").value; $("mx").value = drag[2] - Math.round((e.clientX - drag[0]) / T); $("my").value = drag[3] - Math.round((e.clientY - drag[1]) / T); draw(); };
$("cv").onpointerup = () => { drag = null; store(); };

function draw() { document.body.dataset.v = $("view").value; if ($("view").value === "map") drawMap(); else drawSheet(); }
for (const id of SAVE) $(id).addEventListener("change", () => { if (id === "key") sel = 0; if (id === "flt") fillKeys(); store(); draw(); });
const setRev = v => { const k = $("key").value; if (!k) return; if (rev[k] === v) delete rev[k]; else rev[k] = v; try { localStorage.setItem(RV, JSON.stringify(rev)); } catch {} const o = $("key").selectedOptions[0]; if (o) o.textContent = o.textContent.replace(/ [✔✘]$/, "") + mark(k); draw(); };
$("okb").onclick = () => setRev("ok"); $("malb").onclick = () => setRev("mal");
$("exp").onclick = () => { const t = JSON.stringify(rev); navigator.clipboard?.writeText(t); $("info").textContent = "Revisión copiada: " + Object.keys(rev).length + " hojas (" + t.slice(0, 80) + "…)"; };
// primer mapa y casilla donde aparece cada hoja (suelo u objeto; la sombra de árbol cuenta para obj+50)
let where = null;
async function findWhere() {
  if (where) return where; where = {};
  for (const id of mapIds) {
    const g = await grid(id);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const o = (y * g.w + x) * 10;
      for (const [off, sh] of [[0, 0], [4, 0], [4, 50]]) { const s = g.dv.getInt16(o + off, true); if (s <= 0) continue; const k = "t" + (s + sh); if (sh && !(s >= 100 && s < 150)) continue; if (!where[k]) where[k] = [id, x, y]; }
    }
  }
  return where;
}
$("where").onclick = async () => { $("info").textContent = "Buscando la hoja en los mapas…"; const w = (await findWhere())[$("key").value]; if (!w) { $("info").textContent = $("key").value + " no aparece en ningún mapa."; return; } $("view").value = "map"; $("map").value = w[0]; $("mx").value = Math.max(0, w[1] - 6); $("my").value = Math.max(0, w[2] - 4); store(); draw(); };
for (const id of ["mx", "my"]) $(id).addEventListener("input", draw);
const step = d => { const l = [...$("key").options].map(o => o.value); $("key").value = l[Math.max(0, Math.min(l.length - 1, l.indexOf($("key").value) + d))]; sel = 0; store(); draw(); };
$("prev").onclick = () => step(-1); $("next").onclick = () => step(1);
draw();
