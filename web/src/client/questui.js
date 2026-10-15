// Rastreador de misiones del HUD (v0.63.0; v0.84: el diario pasó a una ventana del lienzo, questwin.js). Todo sale del estado propio (me.quests).
import * as Quests from "../shared/systems/quests.js";
import { getLang, t } from "./i18n.js";
import { GOAL } from "./questwin.js";

const loc = o => (o && (getLang() === "en" ? o.en : o.es)) || "";
const CSS = `#qtrack{position:absolute;right:8px;top:150px;max-width:min(230px,42vw);padding:6px 9px;background:rgba(20,16,22,.72);border:1px solid #756959;color:#e8dcc3;font:12px Tahoma,Verdana,sans-serif;cursor:pointer;z-index:20;line-height:1.35}
#qtrack b{display:block;color:#f2d98a;font-size:12px}#qtrack i{font-style:normal;color:#a9d3a0}#qtrack u{float:right;text-decoration:none;color:#b9a77f;padding-left:8px}
@media (max-height:500px){#qtrack{top:8px}}`;
const KEY = "hbweb.qtrack";
const lsGet = () => { try { return localStorage.getItem(KEY) === "0"; } catch { return false; } };
const lsSet = v => { try { localStorage.setItem(KEY, v ? "0" : "1"); } catch {} };

// openDiary: abre/cierra la ventana del diario. El «▾/▸» del rastreador lo pliega a una línea (se recuerda).
export function createQuestUi(getMe, openDiary) {
  const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
  const track = document.createElement("div"); track.id = "qtrack"; document.body.append(track);
  let folded = lsGet(), sig = "";
  const render = () => {
    const me = getMe();
    if (!me?.quests) { track.style.display = "none"; return; }
    const line = Quests.lineOf(me), q = me.quests, cur = line[q.n] || null, pr = cur ? Quests.progress(me, cur.goal) : [0, 0];
    const key = [q.n, pr[0], pr[1], folded, getLang()].join(); if (key === sig) return; sig = key;
    track.style.display = "block";
    const head = cur ? `${t("Misión")} ${q.n + 1}/${line.length} · ${loc(cur.title)}` : t("Línea de misiones completada");
    track.innerHTML = `<u id="qfold" title="${t("Plegar")}">${folded ? "▸" : "▾"}</u><b>${head}</b>` + (folded ? "" : cur ? `${loc(cur.text)}<br><i>${GOAL[cur.goal.k]?.(cur.goal, pr) || ""}</i>` : t("Eres un maestro de tu camino."));
    track.querySelector("#qfold").onclick = e => { e.stopPropagation(); folded = !folded; lsSet(folded); sig = ""; render(); };
  };
  track.onclick = () => openDiary();
  addEventListener("keydown", e => { if ((e.key === "j" || e.key === "J") && document.activeElement?.tagName !== "INPUT" && !e.ctrlKey && !e.metaKey) openDiary(); });
  return {
    toggle: openDiary, render,
    avoid(m) {                                                         // m = {right,bottom} del minimapa en píxeles de ventana (o null): si se solapan, el rastreador baja
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
