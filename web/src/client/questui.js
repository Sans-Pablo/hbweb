// Rastreador de misiones del HUD (v0.63.0; v0.84: el diario pasó a una ventana del lienzo, questwin.js). Todo sale del estado propio (me.quests).
import * as Quests from "../shared/systems/quests.js";
import { getLang, t } from "./i18n.js";
import { GOAL } from "./questwin.js";
import { THEME } from "./window.js";
import { FONT_FAMILY } from "./uistyle.js";

const loc = o => (o && (getLang() === "en" ? o.en : o.es)) || "";
const CSS = `#qtrack{position:absolute;right:8px;top:150px;max-width:min(240px,42vw);padding:0 0 6px;background:#1b130a;border:2px solid #6b5835;box-shadow:0 0 0 1px #000,inset 0 0 0 1px #3a2c16;color:${THEME.txt};font:12px ${FONT_FAMILY};cursor:pointer;z-index:20;line-height:1.35;user-select:none;touch-action:none}
#qtrack .qh{display:flex;align-items:center;gap:6px;padding:3px 8px;background:${THEME.title};border-bottom:1px solid #6b5835;color:${THEME.head};font-weight:bold;cursor:move}
#qtrack .qb{padding:5px 9px 0;color:${THEME.txt}}#qtrack i{font-style:normal;color:${THEME.good}}#qtrack u{margin-left:auto;text-decoration:none;color:${THEME.dim};cursor:pointer;padding-left:8px}
@media (max-height:500px){#qtrack{top:8px}}`;
const KEY = "hbweb.qtrack";
const lsGet = () => { try { return localStorage.getItem(KEY) === "0"; } catch { return false; } };
const lsSet = v => { try { localStorage.setItem(KEY, v ? "0" : "1"); } catch {} };

// openDiary: abre/cierra la ventana del diario. El «▾/▸» del rastreador lo pliega a una línea (se recuerda).
export function createQuestUi(getMe, openDiary) {
  const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
  const track = document.createElement("div"); track.id = "qtrack"; document.body.append(track);
  let folded = lsGet(), sig = "", enabled = true, pos = null;
  try { pos = JSON.parse(localStorage.getItem("hbweb.qtrackpos") || "null"); } catch {}
  const render = () => {
    const me = getMe();
    if (!enabled || !me?.quests) { track.style.display = "none"; sig = ""; return; }
    const line = Quests.lineOf(me), q = me.quests, cur = line[q.n] || null, pr = cur ? Quests.progress(me, cur.goal) : [0, 0];
    const key = [q.n, pr[0], pr[1], folded, getLang()].join(); if (key === sig) return; sig = key;
    track.style.display = "block";
    const head = cur ? `${t("Misión")} ${q.n + 1}/${line.length} · ${loc(cur.title)}` : t("Línea de misiones completada");
    track.innerHTML = `<div class="qh"><span>${head}</span><u id="qfold" title="${t("Plegar")}">${folded ? "▸" : "▾"}</u></div>` + (folded ? "" : `<div class="qb">` + (cur ? `${loc(cur.text)}<br><i>${GOAL[cur.goal.k]?.(cur.goal, pr) || ""}</i>` : t("Eres un maestro de tu camino.")) + `</div>`);
    track.querySelector("#qfold").onclick = e => { e.stopPropagation(); folded = !folded; lsSet(folded); sig = ""; render(); };
  };
  // Arrastrable hasta cualquier borde de la pantalla (la posición se recuerda); un clic sin mover abre el diario
  let dr = null, moved = false;
  const place = () => { if (pos) { track.style.left = pos.x + "px"; track.style.top = pos.y + "px"; track.style.right = "auto"; } };
  place();
  track.addEventListener("pointerdown", e => { if (e.target.id === "qfold") return; const r = track.getBoundingClientRect(); dr = { dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY }; moved = false; });
  addEventListener("pointermove", e => {
    if (!dr) return;
    if (!moved && Math.hypot(e.clientX - dr.x, e.clientY - dr.y) < 4) return;
    moved = true;
    const w = track.offsetWidth;
    pos = { x: Math.round(Math.max(40 - w, Math.min(innerWidth - 40, e.clientX - dr.dx))), y: Math.round(Math.max(0, Math.min(innerHeight - 20, e.clientY - dr.dy))) };
    place();
  });
  addEventListener("pointerup", () => { if (dr && moved) { try { localStorage.setItem("hbweb.qtrackpos", JSON.stringify(pos)); } catch {} } dr = null; });
  track.onclick = () => { if (moved) { moved = false; return; } openDiary(); };
  addEventListener("keydown", e => { if ((e.key === "j" || e.key === "J") && document.activeElement?.tagName !== "INPUT" && !e.ctrlKey && !e.metaKey) openDiary(); });
  return {
    toggle: openDiary, render,
    setEnabled(v) { if (enabled !== !!v) { enabled = !!v; sig = ""; render(); } },
    avoid(m) {                                                         // m = {right,bottom} del minimapa en píxeles de ventana (o null): si se solapan, el rastreador baja
      if (pos) return;                                                 // movido por el jugador: no se recoloca
      const w = track.offsetWidth, left = innerWidth - 8 - w, base = innerHeight <= 500 ? 8 : 150;
      const top = m && m.right > left && m.bottom > base ? Math.round(m.bottom) : base;
      if (top !== this.lastTop) { this.lastTop = top; track.style.top = top + "px"; }
    },
    onEvent(ev, me, hud) {
      if (ev.id !== me?.id) return;
      if (ev.t === "questdone") {
        const m = Quests.lineOf(me)[ev.n - 1] || null, r = ev.rew || {};
        hud.toast(t("Misión cumplida") + (m ? ": " + loc(m.title) : ""));
        hud.log(t("Misión cumplida") + (m ? ": " + loc(m.title) : "") + (r.gold ? " · +" + r.gold + " " + t("de oro") : ""), "gold");
      }
    },
  };
}
