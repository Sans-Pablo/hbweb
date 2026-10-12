// Diario de misiones y rastreador del HUD (v0.63.0). Todo sale del estado propio (me.quests) con las funciones compartidas de systems/quests.js.
import * as Quests from "../shared/systems/quests.js";
import { getLang, t } from "./i18n.js";

const loc = o => (o && (getLang() === "en" ? o.en : o.es)) || "";
const GOAL = {
  lvl: (g, [a]) => t("Nivel") + " " + a + "/" + g.n, kill: (g, [a]) => a + "/" + g.n, kinds: (g, [a]) => a + "/" + g.n, depth: (g, [a]) => t("Cripta nivel") + " " + a + "/" + g.n,
  boss: (g, [a]) => a + "/" + g.n, ek: (g, [a]) => a + "/" + g.n, pet: (g, [a]) => t("Nivel del compañero") + " " + a + "/" + g.n, staff: (g, [a]) => a + "/1", trade: (g, [a]) => a + "/1",
  final: (g, [a]) => t("Nivel del summon") + " " + a + "/" + g.n, king: (g, [a]) => a + "/" + g.n, gold: (g, [a]) => a + "/" + g.n,
};
const CSS = `#qtrack{position:absolute;right:8px;top:92px;max-width:230px;padding:6px 9px;background:rgba(20,16,22,.72);border:1px solid #756959;color:#e8dcc3;font:12px Tahoma,Verdana,sans-serif;cursor:pointer;z-index:20;line-height:1.35}
#qtrack b{display:block;color:#f2d98a;font-size:12px}#qtrack i{font-style:normal;color:#a9d3a0}
#qpanel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,94vw);max-height:80vh;overflow:auto;padding:16px 18px;background:#211d22;border:1px solid #756959;color:#e8dcc3;font:13px Tahoma,Verdana,sans-serif;z-index:60;display:none}
#qpanel h2{margin:0 0 6px;font-size:17px;color:#f2d98a}#qpanel .row{padding:5px 0;border-top:1px solid #3a3138}#qpanel .done{color:#8b8;opacity:.8}#qpanel .cur{color:#fff;background:#2f2733;padding:6px}#qpanel .ch{margin:10px 0 2px;color:#b9a77f;font-weight:700}
#qpanel button{float:right;background:#393039;color:#e8dcc3;border:1px solid #756959;padding:3px 9px;cursor:pointer}`;
const CHAPTERS = [["", ""], ["Capítulo 1 · Despertar", "Chapter 1 · Awakening"], ["Capítulo 2 · El pacto", "Chapter 2 · The pact"], ["Capítulo 3 · Ascensión", "Chapter 3 · Ascension"], ["Epílogo", "Epilogue"]];

export function createQuestUi(getMe) {
  const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
  const track = document.createElement("div"); track.id = "qtrack";
  const panel = document.createElement("div"); panel.id = "qpanel";
  document.body.append(track, panel);
  let open = false, sig = "";
  const stop = e => e.stopPropagation();
  panel.addEventListener("keydown", stop);
  const state = me => {
    if (!me?.quests) return null;
    const line = Quests.lineOf(me), q = me.quests, cur = line[q.n] || null;
    return { line, q, cur, pr: cur ? Quests.progress(me, cur.goal) : [0, 0] };
  };
  const render = () => {
    const me = getMe(), s = state(me);
    if (!s) { track.style.display = "none"; return; }
    const { line, q, cur, pr } = s, key = [q.n, pr[0], pr[1], open, getLang()].join();
    if (key === sig) return; sig = key;
    track.style.display = "block";
    track.innerHTML = cur
      ? `<b>${t("Misión")} ${q.n + 1}/${line.length} · ${loc(cur.title)}</b>${loc(cur.text)}<br><i>${GOAL[cur.goal.k]?.(cur.goal, pr) || ""}</i>`
      : `<b>${t("Línea de misiones completada")}</b>${t("Eres un maestro de tu camino.")}`;
    if (!open) { panel.style.display = "none"; return; }
    let h = `<button id="qclose">✕</button><h2>${t("Diario de misiones")}</h2>`, ch = -1;
    line.forEach((m, i) => {
      if (m.ch !== ch) { ch = m.ch; h += `<div class="ch">${CHAPTERS[ch]?.[getLang() === "en" ? 1 : 0] || ""}</div>`; }
      const done = i < q.n, now = i === q.n;
      if (!done && !now && i > q.n + 1) return;
      const g = now ? GOAL[m.goal.k]?.(m.goal, pr) : "";
      const mins = done && q.t[i] != null ? ` · ${Math.floor(q.t[i] / 60)} min` : "";
      h += `<div class="row ${done ? "done" : now ? "cur" : ""}">${done ? "✔ " : now ? "▶ " : "· "}<b>${(done || now) ? loc(m.title) : "???"}</b>${mins}${now ? `<br>${loc(m.text)}<br><i>${g}</i>` : ""}</div>`;
    });
    panel.innerHTML = h; panel.style.display = "block";
    panel.querySelector("#qclose").onclick = () => toggle(false);
  };
  const toggle = v => { open = v ?? !open; sig = ""; render(); };
  track.onclick = () => toggle();
  addEventListener("keydown", e => { if (e.key === "j" || e.key === "J") { if (document.activeElement?.tagName === "INPUT") return; toggle(); } else if (e.key === "Escape" && open) toggle(false); });
  return {
    toggle, render,
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
