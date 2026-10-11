// Bestiario: página de pruebas visuales (bestiario.html). Dibuja cualquier criatura con el mismo drawEntity del juego,
// por etapas de evolución (niveles 1, 10, 25, 40, 50) y direcciones, para revisar efectos sin entrar a jugar.
import { loadAssets } from "./assets.js";
import { Grid } from "../shared/grid.js";
import { Renderer, CAST_CFG } from "./renderer.js";
import { Streamer } from "./streaming.js";
import { SpellFx } from "./spellfx.js";
import { ACT, mobDurations } from "../shared/const.js";
import { SIZE_STAGES } from "../shared/systems/companion.js";

const $ = id => document.getElementById(id);
const STAGES = [1, ...SIZE_STAGES];
const ACTS = { stop: ACT.STOP, move: ACT.MOVE, attack: ACT.ATTACK, damage: ACT.DAMAGE, dying: ACT.DYING };
const FEATURED = ["Demon", "Frost", "Liche"];

const assets = await loadAssets(() => {});
const grid = new Grid(assets.meta.w, assets.meta.h, assets.mapBytes);
const r = new Renderer($("game"), assets, grid);
const stream = new Streamer(assets.sprites);
const cv = $("cv"), ctx = cv.getContext("2d");
const names = Object.keys(assets.npcDb).filter(n => assets.npcDb[n].sprite).sort((a, b) => (FEATURED.includes(b) - FEATURED.includes(a)) || a.localeCompare(b));
$("sp").innerHTML = names.map(n => `<option>${n}</option>`).join("");
$("lvl").innerHTML = '<option value="0">Todas (Evolución)</option>' + [...new Set([...STAGES, 20, 30, 45])].sort((a, b) => a - b).map(l => `<option>${l}</option>`).join("");
$("lvl").value = "0";
for (let d = 1; d <= 8; d++) $("dir").insertAdjacentHTML("beforeend", `<option value="${d}">${["", "Arriba", "Arriba-der.", "Derecha", "Abajo-der.", "Abajo", "Abajo-izq.", "Izquierda", "Arriba-izq."][d]}</option>`);
$("dir").value = "5";

const fx = { flash: new Map(), evoGlow: () => 0, scast: new Map(), popScale: () => 1, sp: new SpellFx() };
r.fx = fx; fx.sp.load();      // hojas de efectos del cliente original (llamas del Fire Field para el Demon)
const world = { time: 0, map: null, ents: new Map() };
let loaded = "";
function ensure(name) {
  const sp = assets.npcDb[name].sprite;
  if (loaded === name) return;
  loaded = name;
  const keys = []; for (let k = 0; k < 40; k++) keys.push(sp + k);
  stream.wantAll(keys, 3);
}
const SAVE = ["sp", "mode", "lvl", "act", "dir", "zoom", "comp", "cast", "bg"], LS = "hb_bestiary_sel";   // la selección sobrevive a recargar la página
const store = () => { try { const o = {}; for (const id of SAVE) o[id] = $(id).type === "checkbox" ? $(id).checked : $(id).value; localStorage.setItem(LS, JSON.stringify(o)); } catch {} };
try { const o = JSON.parse(localStorage.getItem(LS) || "{}"); for (const id of SAVE) if (id in o) { if ($(id).type === "checkbox") $(id).checked = !!o[id]; else $(id).value = o[id]; } } catch {}
for (const id of SAVE) $(id).addEventListener("change", store);
$("sp").onchange = () => ensure($("sp").value);
ensure($("sp").value);

// Controles del círculo de casteo: editan CAST_CFG en vivo y "Guardar" lo escribe en web/data/cast_circle.json (solo con el servidor local)
const ccKey = () => { const n = $("sp").value, k = n[0].toUpperCase() + n.slice(1).toLowerCase().replace(/[^a-z].*/, ""); return /^(Demon|Frost|Liche)$/.test(k) ? k : "def"; };
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

let nextId = 5000;
function ent(name, lvl, dir, act, t) {
  const cfg = assets.npcDb[name], dur = mobDurations(cfg.type);
  const a = ACTS[act], d = act === "stop" ? 0 : dur[act] || 800, period = act === "dying" ? d + 700 : d + (act === "damage" ? 500 : 300);
  const start = act === "stop" ? 0 : t - (t % period);
  return { id: 1 + ((nextId++) % 4000), name, cfg, type: cfg.type, kind: "npc", dir, comp: $("comp").checked, clvl: lvl, dead: false, hp: 100, maxHp: 100,
    act: a, actStart: start, actDur: d, phase: 0, dur, x: 0, y: 0, fx: 0, fy: 0, master: -1 };
}

function frame(t) {
  requestAnimationFrame(frame);
  const name = $("sp").value, zoom = +$("zoom").value, mode = $("mode").value, act = $("act").value, one = +$("dir").value;
  const cw = Math.round(150 * zoom), ch = Math.round(210 * zoom);
  const lv0 = +$("lvl").value, lvls = lv0 ? [lv0] : mode === "evo" ? STAGES : [50];
  const dirs = one ? [one] : [1, 2, 3, 4, 5, 6, 7, 8];
  const W = cw * dirs.length, H = ch * lvls.length;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  ctx.fillStyle = $("bg").value; ctx.fillRect(0, 0, W, H);
  world.time = t;
  r.ctx = ctx;
  const gridCell = (c0, r0) => { ctx.strokeStyle = "#ffffff12"; ctx.strokeRect(c0 * cw + .5, r0 * ch + .5, cw - 1, ch - 1); };
  lvls.forEach((lv, ri) => dirs.forEach((d, ci) => {
    gridCell(ci, ri);
    const e = ent(name, lv, d, act, t); e.id = 100 + ri * 10 + d;     // id estable: los efectos aleatorios no saltan de un fotograma a otro
    if ($("cast").checked) fx.scast.set(e.id, { at: performance.now() - (t % 1700), sc: /^(Demon|Frost|Liche)/i.test(name) ? name[0].toUpperCase() + name.slice(1).toLowerCase().replace(/[^a-z].*/, "") : "" });
    ctx.save(); ctx.beginPath(); ctx.rect(ci * cw, ri * ch, cw, ch); ctx.clip();
    ctx.translate(ci * cw + cw / 2, ri * ch + ch * 0.8); ctx.scale(zoom, zoom);
    const ov = [];
    try { r.drawEntity(e, 0, 0, { world, fx, hoverEnt: null, bubbles: null, pid: -1 }, ov); } catch (er) { $("info").textContent = "Error: " + er.message; }
    ctx.restore();
    ctx.fillStyle = "#ffffffaa"; ctx.font = "11px sans-serif";
    ctx.fillText((mode === "evo" || lv0 ? "Lv " + lv + " · " : "") + "dir " + d, ci * cw + 4, ri * ch + 12);
  }));
  r.ctx = r.canvas.getContext("2d");
  if (!$("info").textContent.startsWith("Error")) $("info").textContent = `${name} · tipo ${assets.npcDb[name].type} · hojas ${stream.done}/${stream.total} cargadas · etapas de tamaño en los niveles ${SIZE_STAGES.join(", ")}; Demon: ceniza <10, ojos rojos y estela de fuego al caminar 10, pulso de brasa y grietas 20, brillo en el borde, venas y Tremor de fuego 30, ondas de calor y chispas 40, máximo y grietas de lava 50. Frost: gris azulado <10, huellas y vaho 10, nieve y niebla 20, ojos azules, báculo, brillo y nova de hielo 30, cristales 40, viento en espiral, halo y venas 50. Liche: tamaño Lv 10, báculo 20, humo y círculo 30, ojos 50.`;
}
requestAnimationFrame(frame);
