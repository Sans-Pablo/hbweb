// Historial de chat (F9, botón "Chat Log"): ventana del lienzo con el formato común (marco, pestañas de piedra, desplazamiento).
// Sustituye al panel translúcido propio. api.chatLog: más nuevo primero, {t, type}.
import { Win, THEME, wrap } from "./window.js";
import { t } from "./i18n.js";

export const CHAT_ID = 10;
const COL = { 0: "#e1e1e1", 1: "#82c882", 2: "#ff8282", 3: "#8282ff", 4: "#e6e682", 5: "#7fc2ff", 6: "#ffa060", 7: "#8fe08f", 8: "#d6a0ff", 10: "#b4ffb4" };
const TABS = [["Todo", null], ["Chat", [0, 6, 7]], ["Grupo", [5]], ["Clan", [8]], ["Sistema", [1, 2, 3, 4, 10]]];
const LH = 15;

export class ChatWin extends Win {
  constructor(api) { super({ id: CHAT_ID, title: "Chat Log", w: 540, h: 340, x: 130, y: 190, esc: true }); this.api = api; this.tab = 0; this.cache = { key: "", rows: [] }; }
  rows(c, tab, wpx) {
    const log = this.api.chatLog, key = tab + "|" + log.length + "|" + (log[0]?.t || "") + "|" + wpx;
    if (this.cache.key === key) return this.cache.rows;
    const types = TABS[tab][1], rows = [];
    for (const e of log) {                                             // de más nuevo a más viejo; luego se invierte para pintar el último abajo
      if (types && !types.includes(e.type)) continue;
      const lines = wrap(c, String(e.t), wpx, 12, false);
      for (let i = lines.length - 1; i >= 0; i--) rows.push({ s: i ? "  " + lines[i] : lines[i], col: COL[e.type] || COL[0] });
      if (rows.length > 800) break;
    }
    rows.reverse();
    this.cache = { key, rows };
    return rows;
  }
  body(ui) {
    const I = this.inner; let x = I.x;
    TABS.forEach(([n], i) => {
      const w = Math.ceil(ui.tw(n)) + 22;
      ui.btn(x, I.y, w, t(n), () => { this.tab = i; delete this.sc.log; }, { active: i === this.tab }); x += w + 4;
    });
    const top = I.y + 28, h = I.h - 28, rows = this.rows(ui.c, this.tab, I.w - 22);
    const s0 = this.sc.log, stick = !s0 || s0.off >= s0.h - h - 4;     // pegado al final: lo nuevo aparece abajo
    const s = ui.scroll("log", I.x, top, I.w, h, (u) => {
      rows.forEach((r, i) => u.text(0, i * LH, r.s, r.col));
      return rows.length * LH + 4;
    });
    if (stick) s.off = Math.max(0, s.h - h);
    if (!rows.length) ui.text(I.x + 4, top + 4, t("Sin mensajes."), THEME.dim);
  }
}
export function registerChat(gui, api) { gui.register(new ChatWin(api)); }
