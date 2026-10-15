// F11 en el juego: reporte rápido de un fallo (solo texto) + envío automático de errores de JavaScript. Va a /api/bug (server/bugs.mjs);
// el panel web de errores es web/menu.html. Ventana del lienzo (window.js).
import { Win, THEME } from "./window.js";

export const BUG_ID = 72;
let ctx = () => ({}), ver = "";
fetch("data/version.json", { cache: "no-cache" }).then(r => r.json()).then(v => { ver = v.version; }).catch(() => {});
export function sendBug(kind, text) {
  const c = ctx();
  try { fetch("/api/bug", { method: "POST", body: JSON.stringify({ kind, text, ver, ...c }), keepalive: true }).catch(() => {}); } catch {}
}

export class BugWin extends Win {
  constructor() { super({ id: BUG_ID, title: "Informar de un fallo", w: 420, h: 190, x: 190, y: 150 }); this.state = ""; }
  opened() { this.vals.text = ""; this.state = ""; this.focusOn("text"); }
  body(ui) {
    const I = this.inner;
    const h = ui.para(I.x, I.y, I.w, "Cuenta qué ha pasado y dónde (solo texto). Se envía con tu nombre, versión, mapa y posición.", THEME.txt);
    ui.input("text", I.x, I.y + h + 6, I.w, { maxLen: 600, enter: () => this.submit() });
    const by = I.y + h + 34;
    ui.btn(I.x, by, 110, "Enviar", () => this.submit());
    if (this.state) ui.text(I.x + 120, by + 5, this.state, THEME.good);
  }
  submit() {
    const t = this.v("text").trim(); if (!t) return;
    sendBug("report", t); this.vals.text = ""; this.state = "Enviado. ¡Gracias!";
  }
}
// getCtx: () => {user, map, x, y}. Los errores de JS se mandan limitados (1 cada 5 s; el servidor además agrupa los repetidos).
export function registerBug(gui, getCtx) {
  ctx = getCtx; gui.register(new BugWin());
  let last = 0;
  const err = m => { const n = Date.now(); if (n - last < 5000) return; last = n; sendBug("error", String(m)); };
  addEventListener("error", e => err((e.message || "error") + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno));
  addEventListener("unhandledrejection", e => err("promesa: " + (e.reason?.stack || e.reason)));
}
