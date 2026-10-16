// Base unificada con los sprites reales del juego (gamedialog_1 marco, dialogtext_0 cabeceras, dialogtext_1 botones de piedra).
// Genera base-original.html autocontenido. Uso: node docs/diseno/build-base.mjs
import { readFileSync, writeFileSync } from "node:fs";
const D = new URL("../../web/data/", import.meta.url);
const ui = JSON.parse(readFileSync(new URL("ui.json", D)));
// hojas recortadas a webp (copias de web/data/ui/*.png, solo para el prototipo; así el html pesa ~450 KB)
const uri = n => "data:image/webp;base64," + readFileSync(new URL(`sprites/${n}.webp`, import.meta.url)).toString("base64");
const fr = (sheet, i) => ui[sheet].frames[i];
// cabeceras (dialogtext_0): índice del frame
const BAN = { quest: 4, storage: 21, skills: 1, magic: 7, system: 6, party: 3 };
// botones (dialogtext_1): índice normal (hover = +1)
const BTN = { ok: 0, no: 2, quest: 4, cancel: 16, yes: 18, accept: 32, sell: 38, repair: 42, party: 44, change: 20 };
let css = "";
const used = new Set();
const sprite = (cls, sheet, i) => { if (used.has(cls)) return; used.add(cls); const [x, y, w, h] = fr(sheet, i); css += `.${cls}{width:${w}px;height:${h}px;background:var(--${sheet}) -${x}px -${y}px}`; };
const ban = k => { sprite("ban-" + k, "dialogtext_0", BAN[k]); return `<div class="sp ban-${k}" style="left:0;top:0"></div>`; };
const btn = (k, x, y) => { sprite("bn-" + k, "dialogtext_1", BTN[k]); sprite("bh-" + k, "dialogtext_1", BTN[k] + 1); return `<div class="sp bt bn-${k}" data-h="bh-${k}" style="left:${x}px;top:${y}px"></div>`; };
const frame = (extra = "") => `<div class="sp frm"></div><div class="sp strip"></div>${extra}`;
const slots = (cols, rows, x0, y0, items) => { let s = ""; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const it = items[r * cols + c]; s += `<div class="slot" style="left:${x0 + c * 40}px;top:${y0 + r * 40}px">${it ? `<span>${it}</span>` : ""}</div>`; } return s; };
const win = (w, h, inner, o = {}) => `<div class="win" style="width:${w}px;height:${h}px">${o.mini ? `<div class="sp mfrm"></div>` : frame()}${inner}<div class="ball min">–</div><div class="ball cls">✕</div></div>`;
const BODY = `
${win(258, 339, slots(6, 5, 8, 50, ["⚔", "🛡", "", "", "", "", "", "", "R", "B"]) + `<div class="mut" style="left:30px;top:268px">Weight 42/120</div>` + btn("ok", 30, 300) + btn("change", 154, 300))}
${win(258, 339, ban("storage") + `<div class="row" style="top:110px">Select the item.</div><div class="row sel" style="top:130px">Long Sword</div><div class="row" style="top:145px">Red Potion (25)</div><div class="row" style="top:160px">Ruby (3)</div><div class="row" style="top:175px">Gold (12400)</div>` + btn("cancel", 154, 300))}
${win(258, 339, ban("quest") + `<div class="row sel" style="top:50px">Slime Hunt  3/10</div><div class="row" style="top:65px">Amphis Ridge  0/5</div><div style="left:30px;top:110px;width:196px;line-height:1.4">Kill 10 slimes in the Aresden fields and return to the guard.</div><div class="bar" style="left:30px;top:220px;width:196px"><i style="width:30%"></i></div>` + btn("accept", 30, 300) + btn("cancel", 154, 300))}
${win(215, 87, `<div style="left:0;right:0;top:8px;text-align:center;font-weight:700;color:#3a2810">Auto Hunt</div><div style="left:24px;top:30px">Status: <b>ACTIVE</b></div><div class="bar" style="left:24px;top:50px;width:165px"><i style="width:64%"></i></div>`, { mini: 1 })}
`;
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Base original · ventanas</title>
<style>
:root{--gamedialog_1:url(${uri("gamedialog_1")});--dialogtext_0:url(${uri("dialogtext_0")});--dialogtext_1:url(${uri("dialogtext_1")})}
body{margin:0;padding:24px;font:12px Tahoma,Verdana,sans-serif;background:#12100b;color:#e6d6ac}
h1{font:600 16px Tahoma;margin:0 0 4px;color:#f2c14e}p{margin:0 0 20px;color:#b9a67a;max-width:900px}
.wrap{display:flex;flex-wrap:wrap;gap:30px;align-items:flex-start}
.win{position:relative;color:#000;font-size:11px}.win *{position:absolute}
.sp{background-repeat:no-repeat}
.frm{left:0;top:0;width:258px;height:339px;background:var(--gamedialog_1) -287px -2px}
.strip{left:235px;top:0;width:23px;height:339px;background:var(--gamedialog_1) -547px -2px}
.mfrm{left:0;top:0;width:215px;height:87px;background:var(--gamedialog_1) -366px -343px}
.bt{cursor:pointer}${css}
.slot{width:38px;height:38px;border:1px solid #5a431f;background:rgba(60,40,15,.3);display:grid;place-items:center;font-weight:700;color:#3a2810}
.row{left:30px;width:196px;height:15px;line-height:15px;padding:0 3px}.sel{background:rgba(90,67,31,.45);color:#fff}
.mut{color:#4a3a1c}.bar{height:8px;background:#5a431f;border:1px solid #20160a}.bar i{display:block;height:100%;background:#e0b84a;position:static}
.ball{top:3px;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;font-size:9px;color:#f0e2bd;background:#3a2c14;border:1px solid #c9a95c;cursor:pointer}
.ball.min{left:3px}.ball.cls{right:3px;background:#6a2218}
</style><body>
<h1>Nueva base: sprites reales del juego</h1>
<p>Marco gamedialog_1 (frame 2), cabeceras de dialogtext_0, botones de piedra de dialogtext_1 (pasa el ratón: se iluminan como en el juego) y texto negro sobre pergamino, como en el cliente original. Contenido simulado; es el kit sobre el que se unificarán las ventanas.</p>
<div class="wrap">
${BODY}
</div>
<script>document.querySelectorAll(".bt").forEach(b=>{const n=b.className.split(" ").pop();const h=b.dataset.h;b.onmouseenter=()=>{b.classList.replace(n,h)};b.onmouseleave=()=>{b.classList.replace(h,n)}})</script>
</body></html>`;
writeFileSync(new URL("base-original.html", import.meta.url), html);
