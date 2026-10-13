// Sprite Tool (antes Bestiario; bestiario.html): página de pruebas visuales. Dibuja cualquier criatura, los personajes M y W y cualquier hoja suelta del juego con el mismo drawEntity del juego,
// por etapas de evolución (niveles 1, 10, 25, 40, 50) y direcciones, para revisar efectos sin entrar a jugar.
import { loadAssets } from "./assets.js";
import { look } from "../shared/systems/evolutions.js";
import { Grid } from "../shared/grid.js";
import { Renderer, CAST_CFG } from "./renderer.js";
import { Streamer } from "./streaming.js";
import { SpellFx } from "./spellfx.js";
import { ACT, PLAYER, mobDurations } from "../shared/const.js";
import { DEFAULT_LOOK, HAIR_COLORS, SKIN_NAMES, UNDER_NAMES } from "./look.js";
import { imgUrl } from "./imgurl.js";
import { SIZE_STAGES } from "../shared/systems/companion.js";
import { CLS_OF, DUMMY_NAMES } from "../shared/systems/talents.js";

const $ = id => document.getElementById(id);
const STAGES = [1, ...SIZE_STAGES];
const ACTS = { stop: ACT.STOP, move: ACT.MOVE, attack: ACT.ATTACK, damage: ACT.DAMAGE, dying: ACT.DYING };
const FEATURED = ["Demon", "Frost", "Liche", "Healer", "Buffer", "Aura"];

const assets = await loadAssets(() => {});
const grid = new Grid(assets.meta.w, assets.meta.h, assets.mapBytes);
const r = new Renderer($("game"), assets, grid);
const stream = new Streamer(assets.sprites);
const cv = $("cv"), ctx = cv.getContext("2d");
const names = Object.keys(assets.npcDb).filter(n => assets.npcDb[n].sprite).sort((a, b) => (FEATURED.includes(b) - FEATURED.includes(a)) || a.localeCompare(b));
// Unidades que no son enemigos (Crusade/Heldenian, guardias, ángeles): tools/convert_units.py -> data/units.json. No están en npc.json.
const units = await fetch("data/units.json").then(r => r.json()).catch(() => ({}));
const unitNames = Object.keys(units).filter(n => assets.sprites.has(units[n].sprite + "0"));
const cfgOf = n => assets.npcDb[n] || units[n];
$("sp").innerHTML = `<optgroup label="Personajes jugables"><option value="@M">M · Hombre (sin equipo)</option><option value="@W">W · Mujer (sin equipo)</option></optgroup><optgroup label="Criaturas">${names.map(n => `<option value="${n}">${n === "Tutelary-Angel" ? "Pixie (Tutelary-Angel)" : CLS_OF[n] ? n + " (" + DUMMY_NAMES[CLS_OF[n]] + ")" : n}</option>`).join("")}</optgroup><optgroup label="Unidades (no enemigos)">${unitNames.map(n => `<option>${n}</option>`).join("")}</optgroup>`;
$("lvl").innerHTML = '<option value="0">Todas (Evolución)</option>' + [...new Set([...STAGES, 10, 20, 30, 40, 45])].sort((a, b) => a - b).map(l => `<option>${l}</option>`).join("");
$("lvl").value = "0";
for (let d = 1; d <= 8; d++) $("dir").insertAdjacentHTML("beforeend", `<option value="${d}">${["", "Arriba", "Arriba-der.", "Derecha", "Abajo-der.", "Abajo", "Abajo-izq.", "Izquierda", "Arriba-izq."][d]}</option>`);
$("dir").value = "5";

const fx = { flash: new Map(), evoGlow: () => 0, scast: new Map(), popScale: () => 1, sp: new SpellFx() };
r.fx = fx; fx.sp.load();      // hojas de efectos del cliente original (llamas del Fire Field para el Demon)
const world = { time: 0, map: null, ents: new Map() };
let loaded = "";
function ensure(name) {
  if (name[0] === "@") return;
  const sp = cfgOf(name).sprite;
  if (loaded === name) return;
  loaded = name;
  const keys = []; for (let k = 0; k < (units[name]?.n || 40); k++) keys.push(sp + k);
  stream.wantAll(keys, 3);
}
// Modelos gráficos: 0 original, 1 HD actual (sprites_hd), 2 IA (sprites_ia, tools/remaster_ia.py), 3 IA + luz (filtro de contraste/borde cálido, simulado)
const spr = assets.sprites, hdIa = await fetch("data/sprites_ia.json").then(r => r.json()).catch(() => ({}));
const MODELS = [
  { name: "1 · Original", hd: false, hdm: {}, hdi: {}, fx: "" },
  { name: "2 · HD actual", hd: true, hdm: spr.hdm, hdi: spr.hdi, fx: "" },
  { name: "3 · IA (Real-ESRGAN)", hd: true, hdm: { ...spr.hdm, ...hdIa }, hdi: {}, fx: "" },
  { name: "4 · IA + luz (simulada)", hd: true, hdm: { ...spr.hdm, ...hdIa }, hdi: {}, fx: "contrast(1.12) saturate(1.08) brightness(1.04) drop-shadow(2px 0 1px #ffb86a66) drop-shadow(-2px 0 1px #6aa0ff44) drop-shadow(0 6px 5px #0009)" },
];
MODELS[3].hdi = MODELS[2].hdi;          // misma imagen cargada: solo cambia el filtro
const useModel = i => { const m = MODELS[i]; spr.hd = m.hd; spr.hdm = m.hdm; spr.hdi = m.hdi; spr.modelFx = m.fx; };
const SAVE = ["sp", "mode", "model", "lvl", "act", "dir", "zoom", "side", "comp", "cast", "bg", "rc-h", "rc-s", "rc-b", "pc-skin", "pc-hair", "pc-hcol", "pc-under", "pc-cmb", "rw-src", "rw-q", "rw-key", "rw-piv", "rw-sheet"], LS = "hb_bestiary_sel";   // la selección sobrevive a recargar la página
const store = () => { try { const o = {}; for (const id of SAVE) o[id] = $(id).type === "checkbox" ? $(id).checked : $(id).value; localStorage.setItem(LS, JSON.stringify(o)); } catch {} };
const opts = (a, cur) => a.map(([v, n]) => `<option value="${v}"${v === cur ? " selected" : ""}>${n}</option>`).join("");
$("pc-skin").innerHTML = opts([1, 2, 3].map(i => [i, SKIN_NAMES[i]]), DEFAULT_LOOK.skin);
$("pc-hair").innerHTML = opts([...Array(8).keys()].map(i => [i, "Estilo " + (i + 1)]), DEFAULT_LOOK.hair);
$("pc-hcol").innerHTML = opts(HAIR_COLORS.map((c, i) => [i, i + (c[0] ? " · " + c[0] : "")]), 0);
$("pc-under").innerHTML = opts(UNDER_NAMES.map((n, i) => [i, n]), 0);
const ACTS_C = [["stop", "Reposo"], ["move", "Andar"], ["attack", "Atacar"], ["damage", "Daño"], ["dying", "Morir"]];
const ACTS_P = [["stop", "Reposo"], ["move", "Andar"], ["run", "Correr"], ["attack", "Atacar"], ["magic", "Lanzar magia"], ["pickup", "Recoger"], ["damage", "Daño"], ["dying", "Morir"]];
let saved = {}; try { saved = JSON.parse(localStorage.getItem(LS) || "{}"); } catch {}
const isPc = () => $("sp").value[0] === "@";
const syncActs = () => { const set = isPc() ? ACTS_P : ACTS_C, cur = $("act").value || saved.act; $("act").innerHTML = opts(set, cur); if (!set.some(([v]) => v === cur)) $("act").value = "stop"; };
try { const o = saved; for (const id of SAVE) if (id in o) { if ($(id).type === "checkbox") $(id).checked = !!o[id]; else $(id).value = o[id]; } } catch {}
for (const id of SAVE) $(id).addEventListener("change", store);
syncActs();
$("sp").onchange = () => { ensure($("sp").value); syncActs(); store(); };
ensure($("sp").value);

// Controles del círculo de casteo: editan CAST_CFG en vivo y "Guardar" lo escribe en web/data/cast_circle.json (solo con el servidor local)
const ccKey = () => { const n = $("sp").value, k = n[0].toUpperCase() + n.slice(1).toLowerCase().replace(/[^a-z].*/, ""); return /^(Demon|Beholder|Frost|Liche)$/.test(k) ? look(k) : "def"; };
const ccShow = () => {
  const c = CAST_CFG[ccKey()]; $("cc").style.display = $("cast").checked ? "flex" : "none";
  $("cc-color").value = c.color; $("cc-core").value = c.core; $("cc-bright").value = c.bright; $("cc-size").value = c.size; $("cc-bo").textContent = (+c.bright).toFixed(2); $("cc-so").textContent = c.size;
};
const ccSet = () => { const c = CAST_CFG[ccKey()]; c.color = $("cc-color").value; c.core = $("cc-core").value; c.bright = +$("cc-bright").value; c.size = +$("cc-size").value; $("cc-bo").textContent = c.bright.toFixed(2); $("cc-so").textContent = c.size; };
for (const id of ["cc-color", "cc-core", "cc-bright", "cc-size"]) $(id).addEventListener("input", ccSet);
$("cast").addEventListener("change", ccShow); $("sp").addEventListener("change", ccShow); setTimeout(ccShow, 600); ccShow();
$("cc-save").onclick = async () => {
  try { const r = await fetch("/api/dev/cast", { method: "POST", body: JSON.stringify(CAST_CFG, null, 1) }); $("cc-save").textContent = r.ok ? "¡Guardado!" : "Error " + r.status; }
  catch { $("cc-save").textContent = "Error"; }
  setTimeout(() => $("cc-save").textContent = "Guardar círculo", 1500);
};

// Recolor de prueba: filtro CSS (hue-rotate/saturate/brightness) sobre el cuerpo; el texto de al lado se copia tal cual para fijar una paleta
const rcApply = () => {
  const h = +$("rc-h").value, s = +$("rc-s").value, b = +$("rc-b").value;
  $("rc-ho").textContent = h + "°"; $("rc-so").textContent = s + "%"; $("rc-bo").textContent = b + "%";
  const f = h === 0 && s === 100 && b === 100 ? "" : `hue-rotate(${h}deg) saturate(${s}%) brightness(${b}%)`;
  assets.sprites.recolor = f; $("rc-css").textContent = f;
};
for (const id of ["rc-h", "rc-s", "rc-b"]) $(id).addEventListener("input", rcApply);
$("rc-reset").onclick = () => { $("rc-h").value = 0; $("rc-s").value = 100; $("rc-b").value = 100; rcApply(); store(); };
rcApply();

let nextId = 5000;
function ent(name, lvl, dir, act, t) {
  const cfg = cfgOf(name), dur = mobDurations(cfg.type);
  const a = ACTS[act], d = act === "stop" ? 0 : dur[act] || 800, period = act === "dying" ? d + 700 : d + (act === "damage" ? 500 : 300);
  const start = act === "stop" ? 0 : t - (t % period);
  return { id: 1 + ((nextId++) % 4000), name, cfg, type: cfg.type, kind: "npc", dcls: CLS_OF[name] || null, dir, comp: $("comp").checked, clvl: lvl, dead: false, hp: 100, maxHp: 100,
    act: a, actStart: start, actDur: d, phase: 0, dur, x: 0, y: 0, fx: 0, fy: 0, master: -1 };
}

// ---- Personajes M y W (sin equipo): mismo drawEntity del juego, todas las acciones del jugador ----
const PACT = { stop: [ACT.STOP, 0], move: [ACT.MOVE, PLAYER.walkMs], run: [ACT.RUN, PLAYER.runMs], attack: [ACT.ATTACK, PLAYER.attackMs], magic: [ACT.MAGIC, 800],
  pickup: [ACT.GETITEM, PLAYER.getItemMs], damage: [ACT.DAMAGE, PLAYER.damageMs], dying: [ACT.DYING, PLAYER.dyingMs] };
let pcLoaded = "";
function pcFrame(t) {
  const zoom = +$("zoom").value, act = $("act").value, one = +$("dir").value, gender = $("sp").value === "@W" ? 2 : 1;
  const look = { skin: +$("pc-skin").value, hair: +$("pc-hair").value, hairCol: +$("pc-hcol").value, under: +$("pc-under").value };
  const key = gender + JSON.stringify(look);
  if (key !== pcLoaded) { pcLoaded = key; stream.wantAll(spr.lookKeys(gender, look), 3); }
  const cw = Math.round(150 * zoom), ch = Math.round(210 * zoom), dirs = one ? [one] : [1, 2, 3, 4, 5, 6, 7, 8];
  const cmp = $("model").value === "cmp", rows = cmp ? [0, 1, 2, 3] : [+$("model").value];
  const side = $("side").checked && !cmp && rows[0] !== 0, cols = side ? dirs.length * 2 : dirs.length;   // «Original al lado», igual que con los monstruos
  const W = cw * cols, H = ch * rows.length;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  ctx.fillStyle = $("bg").value; ctx.fillRect(0, 0, W, H);
  world.time = t; r.ctx = ctx;
  const [a, d] = PACT[act] || PACT.stop, period = d + (act === "dying" ? 700 : 300), combat = $("pc-cmb").checked;
  rows.forEach((mi, ri) => dirs.forEach((dir, di) => (side ? [0, mi] : [mi]).forEach((m, k) => {
    const ci = side ? di * 2 + k : di; useModel(m);
    const e = { id: 200 + dir, name: "", kind: "player", gender, look, ap: null, dir, dead: false, hp: 100, maxHp: 100, x: 0, y: 0, fx: 0, fy: 0,
      act: a, actStart: d ? t - (t % period) : 0, actDur: d, lastCombat: combat ? t : -1e9 };
    ctx.strokeStyle = "#ffffff12"; ctx.strokeRect(ci * cw + .5, ri * ch + .5, cw - 1, ch - 1);
    ctx.save(); ctx.beginPath(); ctx.rect(ci * cw, ri * ch, cw, ch); ctx.clip();
    ctx.translate(ci * cw + cw / 2, ri * ch + ch * 0.8); ctx.scale(zoom, zoom);
    try { r.drawEntity(e, 0, 0, { world, fx, hoverEnt: null, bubbles: null, pid: -1 }, []); } catch (er) { $("info").textContent = "Error: " + er.message; }
    ctx.restore();
    ctx.fillStyle = "#ffffffaa"; ctx.font = "11px sans-serif"; ctx.fillText((cmp || side ? MODELS[m].name + " · " : "") + "dir " + dir, ci * cw + 4, ri * ch + 12);
  })));
  r.ctx = r.canvas.getContext("2d");
  if (!$("info").textContent.startsWith("Error")) $("info").textContent = `Personaje ${gender === 2 ? "W (mujer)" : "M (hombre)"} · sin equipo · hojas ${stream.done}/${stream.total} cargadas · el modelo IA existe solo para W. El equipo se ve en «Hojas sueltas» → Equipo.`;
}

// ---- Hojas sueltas: cualquier hoja de cualquier manifiesto, fotograma a fotograma (tamaño real × zoom) con su pivote ----
const RAW = { sprites: ["data/sprites.json", "data/sprites/"], players: ["data/players.json", "data/sprites/"], equip: ["data/equip.json", "data/equip/"],
  mod: ["data/sprites_mod.json", "data/sprites_mod/"], fx: ["data/fx.json", "data/fx/"], ui: ["data/ui.json", "data/ui/"] };
const rawMan = {}, rawImg = new Map(), natural = (a, b) => a.localeCompare(b, "en", { numeric: true });
let rawKeys = [], rawBusy = false, rawSrc = "", rawQ = null, rawSig = "";
async function rawList() {
  const src = $("rw-src").value, q = $("rw-q").value.trim().toLowerCase();
  if (src !== rawSrc) {
    if (rawBusy) return; rawBusy = true;   // rawFrame() llama cada fotograma: sin esto una segunda llamada se cuela mientras carga el manifiesto
    try { if (!rawMan[src]) rawMan[src] = await fetch(RAW[src][0]).then(r => r.json()).catch(() => ({})); } finally { rawBusy = false; }
    rawSrc = src; rawQ = null; rawKeys = Object.keys(rawMan[src]).sort(natural);
  }
  if (q === rawQ) return; rawQ = q;
  const hit = rawKeys.filter(k => !q || k.toLowerCase().includes(q)), prev = $("rw-key").value || saved["rw-key"];
  $("rw-key").innerHTML = hit.slice(0, 600).map(k => `<option>${k}</option>`).join("");
  if (hit.includes(prev) && hit.indexOf(prev) < 600) $("rw-key").value = prev;
  $("rawinfo").textContent = `${hit.length} de ${rawKeys.length} hojas${hit.length > 600 ? " (se listan 600: afina el filtro)" : ""}`;
  rawSig = "";
}
$("rw-src").addEventListener("change", () => { $("rw-q").value = ""; $("rw-key").innerHTML = ""; saved["rw-key"] = ""; rawList(); });
$("rw-q").addEventListener("input", rawList);
$("rw-prev").onclick = () => { const k = $("rw-key"); k.selectedIndex = Math.max(0, k.selectedIndex - 1); store(); };
$("rw-next").onclick = () => { const k = $("rw-key"); k.selectedIndex = Math.min(k.options.length - 1, k.selectedIndex + 1); store(); };
function rawFrame() {
  rawList();
  const src = $("rw-src").value, key = $("rw-key").value, m = rawMan[src]?.[key];
  if (!m) { $("info").textContent = "Elige una hoja."; return; }
  let url = imgUrl(RAW[src][1] + m.png); if (src === "equip") url = RAW[src][1] + m.png;
  let img = rawImg.get(url); if (!img) { img = new Image(); img.src = url; rawImg.set(url, img); }
  const zoom = +$("zoom").value, piv = $("rw-piv").checked, whole = $("rw-sheet").checked, ok = img.complete && img.naturalWidth > 0;
  const sig = [src, key, zoom, piv, whole, ok, $("bg").value].join("|");
  if (sig === rawSig) return; rawSig = sig;
  const fr = m.frames, z = zoom;
  $("info").textContent = ok ? `${src}/${key} · ${fr.length} fotogramas · hoja ${img.naturalWidth}×${img.naturalHeight}px (${m.png})` : `${src}/${key} · cargando…`;
  if (!ok) { img.onload = () => { rawSig = ""; }; return; }
  const pad = 14, cap = 1700;
  if (whole) { cv.width = Math.min(16000, Math.ceil(img.naturalWidth * z)); cv.height = Math.min(16000, Math.ceil(img.naturalHeight * z)); }
  else {
    const cwid = Math.max(...fr.map(f => f[2])) * z + pad, chei = Math.max(...fr.map(f => f[3])) * z + pad + 12, cols = Math.max(1, Math.floor(cap / cwid));
    cv.width = Math.min(cap, cwid * fr.length) | 0; cv.height = Math.ceil(fr.length / cols) * chei | 0; cv._g = { cwid, chei, cols };
  }
  ctx.imageSmoothingEnabled = false; ctx.fillStyle = $("bg").value; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.font = "10px sans-serif";
  if (whole) {
    ctx.drawImage(img, 0, 0, img.naturalWidth * z, img.naturalHeight * z);
    ctx.strokeStyle = "#ffcc4488"; fr.forEach(([x, y, w, h], i) => { ctx.strokeRect(x * z + .5, y * z + .5, w * z, h * z); ctx.fillStyle = "#ffcc44"; ctx.fillText(i, x * z + 2, y * z + 10); });
    return;
  }
  const { cwid, chei, cols } = cv._g;
  fr.forEach(([sx, sy, w, h, ox, oy], i) => {
    const cx = (i % cols) * cwid + pad / 2, cy = Math.floor(i / cols) * chei + 12;
    ctx.strokeStyle = "#ffffff14"; ctx.strokeRect(cx - pad / 2 + .5, cy - 12 + .5, cwid - 1, chei - 1);
    ctx.drawImage(img, sx, sy, w, h, cx, cy, w * z, h * z);
    if (piv) { const px = cx - ox * z, py = cy - oy * z; ctx.strokeStyle = "#ff3355"; ctx.beginPath(); ctx.moveTo(px - 5, py); ctx.lineTo(px + 5, py); ctx.moveTo(px, py - 5); ctx.lineTo(px, py + 5); ctx.stroke(); }
    ctx.fillStyle = "#ffffffaa"; ctx.fillText(`${i} · ${w}×${h}`, cx - pad / 2 + 3, cy - 2);
  });
}

function frame(t) {
  requestAnimationFrame(frame);
  const view = $("mode").value === "raw" ? "raw" : isPc() ? "pc" : "mo"; document.body.dataset.v = view;
  if (view === "raw") return rawFrame();
  rawSig = "";
  if (view === "pc") return pcFrame(t);
  const name = $("sp").value, zoom = +$("zoom").value, mode = $("mode").value, act = $("act").value, one = +$("dir").value;
  const cw = Math.round(150 * zoom), ch = Math.round(210 * zoom);
  const lv0 = +$("lvl").value, lvls = lv0 ? [lv0] : mode === "evo" ? (name === "Cyclops" || name === "Tutelary-Angel" || CLS_OF[name] ? [1, 10, 20, 30, 40, 50] : STAGES) : [50];
  const dirs = one ? [one] : [1, 2, 3, 4, 5, 6, 7, 8];
  const cmp = $("model").value === "cmp", rows = cmp ? [[lv0 || 50, 0], [lv0 || 50, 1], [lv0 || 50, 2], [lv0 || 50, 3]] : lvls.map(l => [l, +$("model").value]);
  const side = $("side").checked && !cmp && +$("model").value !== 0, cols = side ? dirs.length * 2 : dirs.length;   // «Original al lado»: cada fotograma lleva su original a la izquierda
  const W = cw * cols, H = ch * rows.length;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  ctx.fillStyle = $("bg").value; ctx.fillRect(0, 0, W, H);
  world.time = t;
  r.ctx = ctx;
  const gridCell = (c0, r0) => { ctx.strokeStyle = "#ffffff12"; ctx.strokeRect(c0 * cw + .5, r0 * ch + .5, cw - 1, ch - 1); };
  const cells = []; rows.forEach(([lv, mi], ri) => dirs.forEach((d, di) => { if (side) cells.push([lv, 0, ri, d, di * 2]); cells.push([lv, mi, ri, d, side ? di * 2 + 1 : di]); }));
  cells.forEach(([lv, mi, ri, d, ci]) => {
    gridCell(ci, ri); useModel(mi);
    const e = ent(name, lv, d, act, t); e.id = 100 + ri * 10 + d;        // id estable: los efectos aleatorios no saltan de un fotograma a otro
    if ($("cast").checked) fx.scast.set(e.id, { at: performance.now() - (t % 1700), sc: /^(Demon|Beholder|Frost|Liche)/i.test(name) ? name[0].toUpperCase() + name.slice(1).toLowerCase().replace(/[^a-z].*/, "") : "" });
    ctx.save(); ctx.beginPath(); ctx.rect(ci * cw, ri * ch, cw, ch); ctx.clip();
    ctx.translate(ci * cw + cw / 2, ri * ch + ch * 0.8); ctx.scale(zoom, zoom);
    const ov = [];
    try { r.drawEntity(e, 0, 0, { world, fx, hoverEnt: null, bubbles: null, pid: -1 }, ov); } catch (er) { $("info").textContent = "Error: " + er.message; }
    ctx.restore();
    ctx.fillStyle = "#ffffffaa"; ctx.font = "11px sans-serif";
    ctx.fillText((cmp || side ? MODELS[mi].name + " · " : mode === "evo" || lv0 ? "Lv " + lv + " · " : "") + "dir " + d, ci * cw + 4, ri * ch + 12);
  });
  r.ctx = r.canvas.getContext("2d");
  if (!$("info").textContent.startsWith("Error")) $("info").textContent = `${name} · tipo ${cfgOf(name).type} · hojas ${stream.done}/${stream.total} cargadas · etapas de tamaño en los niveles ${SIZE_STAGES.join(", ")}; Demon: ceniza <10, ojos rojos y estela de fuego al caminar 10, pulso de brasa y grietas 20, brillo en el borde, venas y Tremor de fuego 30, ondas de calor y chispas 40, máximo 50 (fisuras de lava al castear desde 30). Frost: gris azulado <10, huellas y vaho 10, nieve y niebla 20, ojos azules, báculo, brillo y nova de hielo con copo de nieve bajo los pies 30, cristales 40, viento en espiral, halo y venas 50. Liche: tamaño Lv 10, báculo 20, humo y círculo 30, ojos 50. Cyclops: electricidad en las pinzas en el nivel 50. Pixie: tamaño 10, 20 y 30; destellos en las alas 30, brillo y motas 40, halo y copos 50. Healer (verde): motas 30, cruces de curación 40, halo, pulso de curación en el suelo y brillo 50. Buffer (amarillo): motas 30, escudos-rombo en órbita 40, runa hexagonal giratoria y rayos 50. Aura (azul): ondas en el suelo 30, volutas 40, tres ondas, resplandor y rayos 50.`;
}
requestAnimationFrame(frame);
