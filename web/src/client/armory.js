// Armería: editor de sprites de objetos (armeria.html). Recolorea el sprite de mochila de cualquier objeto de Item.cfg
// (matiz, saturación, brillo, contraste y reemplazo de un color) para preparar variantes. No toca el juego: exporta PNG
// y, con el servidor local, los guarda en art/armory/ junto a su receta.
import { loadAssets } from "./assets.js";
import { packKey } from "./names.js";

const $ = id => document.getElementById(id);
const assets = await loadAssets(() => {});
const spr = assets.sprites;
const ITEMS = [...assets.data.items.entries()].map(([id, d]) => ({ id: +id, d })).filter(o => o.d && o.d.sprite);
const CATS = { 1: "Armas", 3: "Báculos/varios", 5: "Arcos", 6: "Armaduras", 8: "Escudos", 11: "Botas", 12: "Capas", 13: "Cascos", 21: "Pociones/comida", 31: "Materiales", 42: "Pergaminos", 46: "Joyas/otros" };
const cats = [...new Set(ITEMS.map(o => o.d.category))].sort((a, b) => a - b);
$("cat").innerHTML = '<option value="">Todas</option>' + cats.map(c => `<option value="${c}">${CATS[c] || "Categoría " + c} (${ITEMS.filter(o => o.d.category === c).length})</option>`).join("");

// Modelo gráfico: 0 original, 1 HD actual (sprites_hd), 2 IA (sprites_ia, tools/remaster_ia.py; solo las hojas ya remasterizadas)
const hdIa = await fetch("data/sprites_ia.json").then(r => r.json()).catch(() => ({}));
const sheets = new Map();   // "ruta" -> Image
const sheet = h => { const u = "data/" + (h.dir || "sprites_hd") + "/" + h.png; let i = sheets.get(u); if (!i) { i = new Image(); i.src = u + "?v=" + Date.now(); sheets.set(u, i); } return i; };
const model = () => +$("model").value;
const hdOf = key => { const m = model(); return m === 2 ? hdIa[key] : m === 1 ? spr.hdm[key] : null; };
// recorte del fotograma de un objeto a un canvas propio (nulo mientras la hoja no esté descargada). Con HD/IA el canvas es k veces mayor (c.k).
function cut(d) {
  const key = packKey(d), h = hdOf(key);
  if (model() && !h) return null;
  const o = !h && spr.frame(key, d.spriteFrame), fr = h ? (h.frames ? h.frames[d.spriteFrame] : (spr.frame(key, d.spriteFrame) || []).map(v => v * h.k)) : o;
  const img = h ? sheet(h) : spr.img[key];
  if (!fr || !fr.length || (h ? !(img.complete && img.naturalWidth) : !spr.ready(key))) return null;
  const [sx, sy, w, hh] = fr, c = document.createElement("canvas"); c.width = w; c.height = hh; c.k = h ? h.k : 1;
  c.getContext("2d").drawImage(img, sx, sy, w, hh, 0, 0, w, hh); return c;
}
let cur = null, base = null;
const R = { h: 0, s: 100, b: 100, k: 100, on: false, src: "#808080", dst: "#c03030", tol: 60 };
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}
// Receta -> píxeles. Orden: reemplazo de color, luego matiz/saturación/brillo/contraste. Conserva el alfa.
function render(src) {
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const x = c.getContext("2d"), im = x.createImageData(c.width, c.height);
  const o = src.getContext("2d").getImageData(0, 0, c.width, c.height).data, out = im.data;
  const sc = hex(R.src), dc = hex(R.dst), dh = rgb2hsl(...dc), sh = rgb2hsl(...sc);
  for (let i = 0; i < o.length; i += 4) {
    let r = o[i], g = o[i + 1], b = o[i + 2]; const a = o[i + 3];
    if (a) {
      if (R.on) {
        const dist = Math.hypot(r - sc[0], g - sc[1], b - sc[2]);
        if (dist <= R.tol) {            // toma matiz/saturación del destino y conserva la luz del píxel; se funde hacia el borde de la tolerancia
          const t = Math.min(1, (1 - dist / (R.tol + 1)) * 1.6), l0 = rgb2hsl(r, g, b)[2];
          const n = hsl2rgb(dh[0], dh[1], Math.min(1, Math.max(0, l0 + (dh[2] - sh[2]) * .6)));
          r += (n[0] - r) * t; g += (n[1] - g) * t; b += (n[2] - b) * t;
        }
      }
      let [h, s, l] = rgb2hsl(r, g, b);
      h = (h + R.h / 360) % 1; s = Math.min(1, s * R.s / 100); l = Math.min(1, l * R.b / 100);
      const k = R.k / 100, q = hsl2rgb(h, s, l).map(v => Math.max(0, Math.min(255, (v - 128) * k + 128)));
      r = q[0]; g = q[1]; b = q[2];
    }
    out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a;
  }
  x.putImageData(im, 0, 0); return c;
}
function paint() {
  if (!base) return;
  const z = +$("zoom").value, bg = $("bg").value, ed = render(base);
  for (const [id, img, s] of [["c0", base, z], ["c1", ed, z], ["c2", ed, 1]]) {
    const cv = $(id), k = base.k || 1; cv.width = Math.round(base.width / k * s); cv.height = Math.round(base.height / k * s);
    const x = cv.getContext("2d"); x.imageSmoothingEnabled = k > 1; x.imageSmoothingQuality = "high"; x.fillStyle = bg; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height);
  }
}
const label = o => o.d.display || o.d.name;
function select(o, rename = true) {
  const c = cut(o.d); if (!c) { $("info").textContent = model() && !hdOf(packKey(o.d)) ? `${label(o)} no tiene hoja ${model() === 2 ? "IA" : "HD"} todavía (hoja ${packKey(o.d)}).` : "Cargando la hoja de " + label(o) + "…"; if (model() && !hdOf(packKey(o.d))) return; setTimeout(() => select(o, rename), 300); return; }
  cur = o; base = c;
  for (const e of document.querySelectorAll("#list canvas")) e.classList.toggle("sel", +e.dataset.id === o.id);
  $("info").textContent = `#${o.id} ${label(o)} · hoja ${packKey(o.d)} fotograma ${o.d.spriteFrame} · ${c.width / (c.k || 1)}×${c.height / (c.k || 1)}px${c.k > 1 ? " (modelo ×" + c.k + ")" : ""}`;
  if (rename) $("nm").value = label(o).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-2";
  paint();
}
function buildList() {
  const q = $("q").value.trim().toLowerCase(), cat = $("cat").value, L = $("list"); L.innerHTML = "";
  for (const o of ITEMS) {
    if (cat && o.d.category !== +cat) continue;
    if (q && !(label(o).toLowerCase().includes(q) || String(o.id) === q)) continue;
    const cv = document.createElement("canvas"); cv.width = cv.height = 48; cv.dataset.id = o.id; cv.title = `#${o.id} ${label(o)}`;
    cv.onclick = () => select(o);
    L.appendChild(cv); o.cv = cv; draw(o);
  }
}
function draw(o) {   // miniatura; si la hoja aún no está lista, reintenta
  const c = cut(o.d); if (!c) { if (!model() || hdOf(packKey(o.d))) setTimeout(() => o.cv.isConnected && draw(o), 400); else o.cv.getContext("2d").clearRect(0, 0, 48, 48); return; }
  const x = o.cv.getContext("2d"), k = Math.min(1, 44 / Math.max(c.width, c.height)); x.clearRect(0, 0, 48, 48);
  x.drawImage(c, 24 - c.width * k / 2, 24 - c.height * k / 2, c.width * k, c.height * k);
}
for (const [id, out, f] of [["h", "ho", v => v + "°"], ["s", "so", v => v + "%"], ["b", "bo", v => v + "%"], ["k", "ko", v => v + "%"], ["tol", "to", v => v]]) {
  $(id).addEventListener("input", () => { R[id] = +$(id).value; $(out).textContent = f($(id).value); paint(); });
}
for (const id of ["src", "dst"]) $(id).addEventListener("input", () => { R[id] = $(id).value; paint(); });
$("on").onchange = () => { R.on = $("on").checked; paint(); };
$("c0").onclick = e => {          // cuentagotas: toma el color del píxel pulsado del original
  if (!base) return; const cv = $("c0"), r = cv.getBoundingClientRect();
  const px = Math.floor((e.clientX - r.left) / r.width * base.width), py = Math.floor((e.clientY - r.top) / r.height * base.height);
  const d = base.getContext("2d").getImageData(px, py, 1, 1).data; if (!d[3]) return;
  R.src = "#" + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, "0")).join(""); $("src").value = R.src; $("on").checked = R.on = true; paint();
};
$("reset").onclick = () => { for (const [id, v] of [["h", 0], ["s", 100], ["b", 100], ["k", 100]]) { $(id).value = v; $(id).dispatchEvent(new Event("input")); } $("on").checked = R.on = false; paint(); };
for (const id of ["q", "cat"]) $(id).addEventListener("input", buildList);
for (const id of ["bg", "zoom"]) $(id).addEventListener("change", paint);
$("model").addEventListener("change", () => { buildList(); if (cur) select(cur, false); });
const flat = () => render(base).toDataURL("image/png");
const slug = () => $("nm").value.replace(/[^A-Za-z0-9_-]/g, "");
$("dl").onclick = () => { if (!base || !slug()) return; const a = document.createElement("a"); a.href = flat(); a.download = slug() + ".png"; a.click(); };
$("save").onclick = async () => {
  if (!base || !slug()) { $("msg").textContent = "Pon un nombre"; return; }
  try {
    const r = await fetch("/api/dev/armory", { method: "POST", body: JSON.stringify({ name: slug(), png: flat(), base: { id: cur.id, sheet: packKey(cur.d), frame: cur.d.spriteFrame }, recipe: { ...R } }) });
    const j = await r.json().catch(() => ({})); $("msg").textContent = r.ok ? "Guardado en " + j.file : "Error: " + (j.error || r.status);
  } catch { $("msg").textContent = "Error: solo funciona con el servidor local"; }
};
buildList(); const first = ITEMS.find(o => o.id === 1) || ITEMS[0]; if (first) select(first);
