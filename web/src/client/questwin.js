// Diario de misiones (ticket 6): ventana del lienzo con el aspecto clásico; sustituye al panel DOM. Todo sale de me.quests + systems/quests.js.
import { Win, THEME } from "./window.js";
import * as Quests from "../shared/systems/quests.js";
import { getLang, t } from "./i18n.js";

export const QUEST_ID = 49;
const loc = o => (o && (getLang() === "en" ? o.en : o.es)) || "";
const CHAPTERS = [["", ""], ["Capítulo 1 · Despertar", "Chapter 1 · Awakening"], ["Capítulo 2 · El pacto", "Chapter 2 · The pact"], ["Capítulo 3 · Ascensión", "Chapter 3 · Ascension"], ["Epílogo", "Epilogue"]];
export const GOAL = {
  lvl: (g, [a]) => t("Nivel") + " " + a + "/" + g.n, kill: (g, [a]) => a + "/" + g.n, kinds: (g, [a]) => a + "/" + g.n, depth: (g, [a]) => t("Cripta nivel") + " " + a + "/" + g.n,
  boss: (g, [a]) => a + "/" + g.n, ek: (g, [a]) => a + "/" + g.n, pet: (g, [a]) => t("Nivel del compañero") + " " + a + "/" + g.n, staff: (g, [a]) => a + "/1", trade: (g, [a]) => a + "/1",
  final: (g, [a]) => t("Nivel del summon") + " " + a + "/" + g.n, king: (g, [a]) => a + "/" + g.n, gold: (g, [a]) => a + "/" + g.n,
};

export class QuestWin extends Win {
  constructor() { super({ id: QUEST_ID, title: "Diario de misiones", w: 420, h: 400, x: 190, y: 60, esc: true }); }
  body(ui, me) {
    const I = this.inner;
    if (!me?.quests) { ui.text(I.x, I.y, t("No hay misiones en esta versión."), THEME.dim); return; }
    const line = Quests.lineOf(me), q = me.quests, cur = line[q.n] || null, pr = cur ? Quests.progress(me, cur.goal) : [0, 0];
    ui.text(I.x, I.y, t("Misión") + " " + Math.min(q.n + 1, line.length) + "/" + line.length, THEME.head, { bold: true, shadow: true });
    ui.scroll("q", I.x, I.y + 20, I.w, I.h - 20, (u, cw) => {
      let y = 0, ch = -1;
      line.forEach((m, i) => {
        const done = i < q.n, now = i === q.n;
        if (!done && !now && i > q.n + 1) return;
        if (m.ch !== ch) { ch = m.ch; y += y ? 6 : 0; u.head(0, y, CHAPTERS[ch]?.[getLang() === "en" ? 1 : 0] || ""); y += 18; }
        const mins = done && q.t[i] != null ? "  · " + Math.floor(q.t[i] / 60) + " min" : "";
        const col = done ? THEME.good : now ? THEME.head : THEME.dim;
        u.text(0, y, done ? "✔" : now ? "▶" : "·", col, { bold: true });
        u.text(16, y, (done || now ? loc(m.title) : "???") + mins, col, { bold: now });
        y += 16;
        if (now) { y += u.para(16, y, cw - 16, loc(m.text), THEME.txt) + 2; u.text(16, y, GOAL[m.goal.k]?.(m.goal, pr) || "", THEME.good, { bold: true }); y += 18; }
        y += 4;
      });
      if (!cur) { u.text(0, y, t("Línea de misiones completada"), THEME.good, { bold: true }); y += 20; }
      return y;
    });
  }
}
export function registerQuests(gui) { gui.register(new QuestWin()); }
