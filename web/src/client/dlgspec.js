// Constructor de diálogos: una ventana `Win` definida por datos. `defineDialog({id,title,w,h,tabs?,items})`.
// `items` es una lista (o `(me,world,win,tab)=>lista`) de filas que se apilan de arriba abajo con LAYOUT.gap:
//   {k:"head",s} {k:"text",s,color} {k:"para",s,color} {k:"rule"} {k:"gap",h}
//   {k:"btn",s,fn,w,primary,disabled,tip} {k:"row",items:[btn…]} (botones en fila)
//   {k:"list",rows,h,pick,empty,filter,key} lista con scroll; fila {text,right,color,tip,ball,disabled}; filter filtra por win.query
//   {k:"draw",h,fn(ui,x,y,w)} hueco de dibujo a medida
//   opción `footer` (texto o fn(win)): pie fijo; la ayuda `tip` de la fila bajo el ratón lo sustituye
//   {k:"check",s,get,set} {k:"slider",s,get,set,min,max,w} {k:"input",id,s,w,num,min,max,def} {k:"combo",id,s,options,w} {k:"search",id,w}
// Ficha: docs/sistemas/dlgspec.md. Test: tests/dlgspec.test.mjs.
import { Win, THEME, drawSlot } from "./window.js";
import { LAYOUT } from "./uistyle.js";
import { drawBallIcon } from "./compicon.js";
import { itemDef, packKey } from "./names.js";

const ROW = 20;
const LIST_ROW = 18;
// Lista con scroll de filas {text,right,color,tip,ball,disabled}: resalte al pasar, casilla con icono de bola,
// columna derecha y ayuda (tip) en win.tip. Devuelve el alto ocupado.
function listRows(ui, win, it, x0, y, w) {
  const h = it.h ?? 170, q = it.filter ? win.query : "";
  const rows = (it.rows || []).filter(r => !q || String(r.text).toLowerCase().includes(q));
  if (!rows.length && it.empty) ui.para(x0, y + 6, w, it.empty, THEME.dim);
  ui.scroll("list:" + (it.key || ""), x0 - 2, y, w + 4, h, (u, iw) => {
    rows.forEach((r, i) => {
      const ry = i * LIST_ROW, over = !r.disabled && u.hov(0, ry, iw, LIST_ROW);
      const col = r.disabled ? THEME.dim : over ? THEME.hi : r.color || THEME.txt;
      if (over) { u.c.fillStyle = THEME.sel; u.c.fillRect(0, ry, iw, LIST_ROW - 1); if (r.tip) win.tip = r.tip; }
      let tx = 4;
      if (r.ball) {
        drawSlot(u.c, 1, ry, LIST_ROW - 1, over);
        const d = itemDef(r.ball.id); if (d) drawBallIcon(u.g, r.ball, d, packKey(d), 9, ry + 9, 14);
        tx = LIST_ROW + 4;
      }
      u.text(tx, ry + 2, r.text, col, { size: 11 });
      if (r.right != null) u.text(iw - u.tw(String(r.right), 11) - 4, ry + 2, String(r.right), col, { size: 11 });
      if (!r.disabled) u.hit(0, ry, iw, LIST_ROW, { fn: () => it.pick?.(r) });
    });
    return rows.length * LIST_ROW;
  });
  return h;
}
export function layoutItems(ui, win, items, x0, y0, w) {
  let y = y0;
  for (const it of items) {
    if (!it) continue;
    const s = typeof it.s === "function" ? it.s() : it.s;
    switch (it.k) {
      case "head": ui.head(x0, y, s); y += LAYOUT.rowH; break;
      case "text": ui.text(x0, y, s, it.color); y += LAYOUT.rowH - 4; break;
      case "para": y += ui.para(x0, y, w, s, it.color) + LAYOUT.gap; break;
      case "rule": ui.rule(x0, y + 2, w); y += 8; break;
      case "gap": y += it.h ?? LAYOUT.gap; break;
      case "btn": ui.btn(x0, y, it.w ?? Math.min(w, ui.tw(s) + 28), s, it.fn, it); y += ROW + LAYOUT.gap; break;
      case "row": { let x = x0; for (const b of it.items) { const bw = b.w ?? ui.tw(b.s) + 28; ui.btn(x, y, bw, b.s, b.fn, b); x += bw + LAYOUT.gap; } y += ROW + LAYOUT.gap; break; }
      case "check": ui.check(x0, y, s, !!it.get(), it.set, it); y += LAYOUT.rowH - 4; break;
      case "slider": ui.text(x0, y + 3, s); ui.slider(x0 + 90, y, it.w ?? w - 90, it.get(), it.min ?? 0, it.max ?? 100, it.set, it); y += LAYOUT.rowH; break;
      case "input": ui.text(x0, y + 4, s); ui.input(it.id, x0 + 90, y, it.w ?? w - 90, it); y += ROW + LAYOUT.gap; break;
      case "combo": ui.text(x0, y + 4, s); ui.combo(it.id, x0 + 90, y, it.w ?? w - 90, it.options, it); y += ROW + LAYOUT.gap; break;
      case "search": win.query = ui.search(it.id, x0, y, it.w ?? w); y += ROW + LAYOUT.gap; break;
      case "draw": it.fn(ui, x0, y, w); y += it.h ?? ROW; break;
      case "list": y += listRows(ui, win, it, x0, y, w) + LAYOUT.gap; break;
      default: throw new Error("dlgspec: fila desconocida " + it.k);
    }
  }
  return y;
}

export function defineDialog(spec) {
  const { items, tabs, footer, ...opt } = spec;
  const win = new Win({ w: 320, h: 240, ...opt });
  win.tab = 0; win.query = ""; win.tip = "";
  win.body = (ui, me, world) => {
    const inn = win.inner, w = win.w - inn.x * 2;
    let y = inn.y;
    if (tabs) {
      let x = inn.x; const tw = Math.floor((w - (tabs.length - 1) * 4) / tabs.length);
      tabs.forEach((n, i) => { ui.btn(x, y, tw, n, () => { win.tab = i; }, { active: win.tab === i }); x += tw + 4; });
      y += ROW + LAYOUT.gap;
    }
    const list = typeof items === "function" ? items(me, world, win, win.tab) : items;
    const tip = win.tip; win.tip = "";   // la ayuda de la fila bajo el ratón se fija al dibujar la lista
    layoutItems(ui, win, list, inn.x, y, w);
    const foot = tip || (typeof footer === "function" ? footer(win) : footer);
    if (foot) ui.para(inn.x, win.h - LAYOUT.padBottom - 24, w, foot, THEME.dim, { size: 10 });
  };
  return win;
}
