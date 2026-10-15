// Paneles DOM (línea de chat y registro de eventos) arrastrables hasta cualquier borde, con el formato de las ventanas nuevas
// (barra de título oscura, marco latón; mismos colores que THEME). La posición se recuerda por navegador.
import { THEME } from "./window.js";
import { FONT_FAMILY } from "./uistyle.js";

const CSS = `.dh{display:flex;align-items:center;gap:6px;height:18px;padding:0 8px;background:${THEME.title};border:1px solid ${THEME.line};color:${THEME.head};font:bold 11px ${FONT_FAMILY};cursor:move;user-select:none;touch-action:none;pointer-events:auto}
#chat .dh{border-bottom:0;border-radius:6px 6px 0 0}#chat{background:#1b130a;border-radius:6px;box-shadow:0 0 0 1px #000}
#chat input{margin-top:0!important;border-radius:0 0 6px 6px!important;border:1px solid ${THEME.line}!important;background:${THEME.field}!important;color:${THEME.txt}!important;font-family:${FONT_FAMILY}!important}
#chat input:focus{border-color:${THEME.lineOn}!important}
#log .dh{width:max-content;min-width:60px;opacity:.45;border-radius:4px}#log .dh:hover{opacity:1}
body.mobile .dh{display:none}`;
const read = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// el: panel que se mueve; title: texto de la barra; key: clave de localStorage. Devuelve la barra (asa).
export function makeDraggable(el, title, key) {
  const h = document.createElement("div"); h.className = "dh"; h.textContent = title; el.prepend(h);
  let pos = read(key);
  const clampPos = (x, y) => ({ x: Math.round(Math.max(40 - el.offsetWidth, Math.min(innerWidth - 40, x))), y: Math.round(Math.max(0, Math.min(innerHeight - 18, y))) });
  const place = () => { if (!pos || document.body.classList.contains("mobile")) return; const p = clampPos(pos.x, pos.y); Object.assign(el.style, { left: p.x + "px", top: p.y + "px", right: "auto", bottom: "auto", transform: "none" }); };
  let dr = null;
  h.addEventListener("pointerdown", e => { const r = el.getBoundingClientRect(); dr = { dx: e.clientX - r.left, dy: e.clientY - r.top }; h.setPointerCapture(e.pointerId); e.preventDefault(); });
  h.addEventListener("pointermove", e => { if (!dr) return; pos = clampPos(e.clientX - dr.dx, e.clientY - dr.dy); place(); });
  h.addEventListener("pointerup", () => { if (dr && pos) write(key, pos); dr = null; });
  h.addEventListener("dblclick", () => { pos = null; try { localStorage.removeItem(key); } catch {} for (const k of ["left", "top", "right", "bottom", "transform"]) el.style[k] = ""; });   // doble clic: posición original
  addEventListener("resize", place);
  place();
  return h;
}
export function initDomDrag() {
  const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
  const chat = document.getElementById("chat"), log = document.getElementById("log");
  if (chat) makeDraggable(chat, "Chat", "hbweb.pos.chat");
  if (log) makeDraggable(log, "Log", "hbweb.pos.log");
}
