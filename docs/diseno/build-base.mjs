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
const win = (w, h, inner, o = {}) => `<div class="win" style="width:${w}px;height:${h}px">${o.mini ? `<div class="sp mfrm"></div>` : frame()}${inner}<div class="ball min">&#8211;</div><div class="ball cls">&#10005;</div></div>`;
const mwin = (w, h, inner) => { let mid = ""; for (let y = 30; y < h - 43; y += 14) mid += `<div class="sp mm" style="top:${y}px;height:${Math.min(14, h - 43 - y)}px"></div>`; return `<div class="win" style="width:${w}px;height:${h}px"><div class="sp mt" style="height:30px"></div>${mid}<div class="sp mb" style="top:${h - 43}px"></div>${inner}<div class="ball min">&#8211;</div><div class="ball cls">&#10005;</div></div>`; };
const BODY = `
<div class="cell"><div class="lbl">1 · Inventario</div>${win(258, 339, slots(5, 5, 22, 44, ["⚔", "🛡", "", "", "", "", "", "", "R", "B"]) + `<div class="mut" style="left:22px;top:252px">Weight 42/120</div>` + btn("ok", 22, 300) + btn("change", 152, 300))}</div>
<div class="cell"><div class="lbl">2 · Almacén</div>${win(258, 339, ban("storage") + `<div class="row" style="top:110px">Select the item.</div><div class="row sel" style="top:130px">Long Sword</div><div class="row" style="top:145px">Red Potion (25)</div><div class="row" style="top:160px">Ruby (3)</div><div class="row" style="top:175px">Gold (12400)</div>` + btn("cancel", 152, 300))}</div>
<div class="cell"><div class="lbl">3 · Quests</div>${win(258, 339, ban("quest") + `<div class="row sel" style="top:50px">Slime Hunt  3/10</div><div class="row" style="top:65px">Amphis Ridge  0/5</div><div style="left:22px;top:110px;width:204px;line-height:1.4">Kill 10 slimes in the Aresden fields and return to the guard.</div><div class="bar" style="left:22px;top:220px;width:204px"><i style="width:30%"></i></div>` + btn("accept", 22, 300) + btn("cancel", 152, 300))}</div>
<div class="cell"><div class="lbl">4 · Auto Hunt (mini)</div>${mwin(215, 150, `<div style="left:22px;top:26px;font-weight:700;color:#3a2810">Slime  (Pozo 3)</div>` + [["Muertes","38","b"],["Tiempo","12:40",""],["Ritmo","180 /h",""],["Experiencia","+4210","b"],["Cazando","",""]].map(([k,v,b],n)=>`<div style="left:22px;top:${46+n*16}px">${k}</div><div style="left:112px;top:${46+n*16}px;${b?"font-weight:700;color:#7a4a00":""}">${v}</div>`).join(""))}
<div class="cell"><div class="lbl">5 · Menú automático (grande, 2 marcos, contenido real de autowin.js)</div><div style="position:relative;display:flex">${win(258, 339, `<div class="tab on" style="left:22px;top:30px;width:98px">Cazar</div><div class="tab" style="left:124px;top:30px;width:98px">Ir a…</div><div style="left:22px;top:56px;font-weight:700;color:#3a2810">Mapa: Granja de Aresden</div><div style="left:22px;top:74px">Zona  &lt; 1/6 Pozo 3 · Slime (40,52,60,70) &gt;</div><div class="mbox" style="left:22px;top:96px;width:86px;height:100px">SPRITE<br>N</div>` + ["Criatura|Slime","Vida (aprox.)|10–30","Daño|1d6","Experiencia|8–20","Nivel de botín|1","Oro|0–12","Apariciones|8"].map((r,n)=>{const [a,b]=r.split("|");return `<div style="left:116px;top:${96+n*14}px;font-weight:700;color:#3a2810;font-size:10px">${a}</div><div style="left:186px;top:${96+n*14}px;font-size:10px">${b}</div>`}).join("") + `<div style="left:22px;top:210px;font-weight:700;color:#3a2810">Botín posible</div><div style="left:22px;top:226px;width:204px;font-size:10px">Red Potion, Short Sword, Leather Armor, Gold…</div>` + btn("ok", 22, 300))}${win(258, 339, `<div style="left:22px;top:44px;font-weight:700;color:#3a2810">Objetos del suelo según su rareza</div>` + ["Normal: ignorar","Mágico: vender","Raro: guardar","Único: guardar"].map((r,n)=>`<div class="tab" style="left:${22+(n%2)*104}px;top:${64+Math.floor(n/2)*24}px;width:100px">${r}</div>`).join("") + `<div style="left:22px;top:124px"><span class="cb"></span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;No recoger objetos</div><div style="left:22px;top:144px"><span class="cb on"></span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Tomar pociones con poca vida</div>` + btn("accept", 22, 300) + btn("cancel", 152, 300))}</div></div>
`;
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Editor de ventanas</title>
<style>
:root{--gamedialog_1:url(${uri("gamedialog_1")});--dialogtext_0:url(${uri("dialogtext_0")});--dialogtext_1:url(${uri("dialogtext_1")})}
body{margin:0;padding:24px;font:12px Tahoma,Verdana,sans-serif;background:#12100b;color:#e6d6ac}
h1{font:600 16px Tahoma;margin:0 0 4px;color:#f2c14e}p{margin:0 0 20px;color:#b9a67a;max-width:900px}
.wrap{display:flex;flex-wrap:wrap;gap:30px;align-items:flex-start}
.win{position:relative;color:#000;font-size:11px}.win *{position:absolute}
.sp{background-repeat:no-repeat}
.frm{left:0;top:0;width:258px;height:339px;background:var(--gamedialog_1) -287px -2px}
.strip{left:235px;top:0;width:23px;height:339px;background:var(--gamedialog_1) -547px -2px}
.mt,.mm,.mb{left:0;width:215px}.mt{background:var(--gamedialog_1) -366px -343px}.mm{background:var(--gamedialog_1) -366px -373px}.mb{height:43px;background:var(--gamedialog_1) -366px -387px}
.mfrm{left:0;top:0;width:215px;height:87px;background:var(--gamedialog_1) -366px -343px}
.bt{cursor:pointer}${css}
.slot{width:38px;height:38px;border:1px solid #5a431f;background:rgba(60,40,15,.3);display:grid;place-items:center;font-weight:700;color:#3a2810}
.row{left:22px;width:204px;height:15px;line-height:15px;padding:0 3px}.sel{background:rgba(90,67,31,.45);color:#fff}
.tab{height:18px;line-height:18px;text-align:center;border:1px solid #5a431f;background:rgba(60,40,15,.25);color:#3a2810;font-size:10px}.tab.on{background:rgba(90,67,31,.6);color:#fff}.mbox{border:1px solid #5a431f;background:rgba(0,0,0,.3);color:#e6d6ac;text-align:center;padding-top:36px;box-sizing:border-box}.cb{position:absolute;left:0;top:1px;width:11px;height:11px;border:1px solid #5a431f;background:rgba(0,0,0,.2)}.cb.on{background:#e0b84a}
.mut{color:#4a3a1c}.bar{height:8px;background:#5a431f;border:1px solid #20160a}.bar i{display:block;height:100%;background:#e0b84a;position:static}
.ball{top:4px;width:16px;height:16px;display:grid;place-items:center;font:700 11px Tahoma;color:#e8d4a0;text-shadow:1px 1px #20160a;cursor:pointer}
.ball:hover{color:#fff;text-shadow:0 0 4px #f2c14e}
.ball.min{left:5px}.ball.cls{right:5px}
.lbl{position:static;color:#f2c14e;font:600 12px Tahoma;margin:0 0 6px}.cell{display:flex;flex-direction:column}
/* margenes utiles del marco: x 22..226 (204 px), y 44..294 */
#bar{margin:0 0 14px}#bar button{background:#3a2e1e;color:#f2c14e;border:1px solid #5a431f;padding:4px 10px;cursor:pointer}.win [data-e]{cursor:move}.win [data-e].sel{outline:1px dashed #f2c14e}.win [data-e]:hover{outline:1px dashed #6fd16f}
</style><body>
<h1>Editor de ventanas (sprites reales)</h1>
<div id="bar"><button onclick="hbExport()">Exportar diseño (JSON)</button> <button onclick="hbReset()">Restablecer</button> <span id="sel">Arrastra cualquier elemento · doble clic edita el texto · flechas = 1 px (Shift = 10)</span></div>
<textarea id="out" rows="8" style="display:none;width:100%"></textarea>
<p>Marco gamedialog_1 (frame 2), cabeceras de dialogtext_0, botones de piedra de dialogtext_1 (pasa el ratón: se iluminan como en el juego) y texto negro sobre pergamino, como en el cliente original. Contenido simulado; es el kit sobre el que se unificarán las ventanas.</p>
<div class="wrap">
${BODY}
</div>
<script>document.querySelectorAll(".bt").forEach(b=>{const n=b.className.split(" ").pop();const h=b.dataset.h;b.onmouseenter=()=>{b.classList.replace(n,h)};b.onmouseleave=()=>{b.classList.replace(h,n)}})</script>
<script>
(()=>{const els=[...document.querySelectorAll('.win')].flatMap((w,wi)=>[...w.children].filter(e=>!/(frm|strip|mfrm|mt|mm|mb|ball)/.test(e.className)).map((e,i)=>{e.dataset.e=wi+'.'+i;e.dataset.x=e.offsetLeft;e.dataset.y=e.offsetTop;e.dataset.t=e.textContent;return e}));
let cur=null;const sel=e=>{cur&&cur.classList.remove('sel');cur=e;e&&e.classList.add('sel')};
const mv=(e,x,y)=>{e.style.left=x+'px';e.style.top=y+'px'};
document.addEventListener('mousedown',ev=>{const e=ev.target.closest('[data-e]');if(!e||e.isContentEditable)return;sel(e);const sx=ev.clientX-e.offsetLeft,sy=ev.clientY-e.offsetTop;const m=a=>mv(e,a.clientX-sx,a.clientY-sy),u=()=>{removeEventListener('mousemove',m);removeEventListener('mouseup',u)};addEventListener('mousemove',m);addEventListener('mouseup',u);ev.preventDefault()});
document.addEventListener('dblclick',ev=>{const e=ev.target.closest('[data-e]');if(e){e.contentEditable=true;e.focus()}});
document.addEventListener('keydown',ev=>{if(!cur||cur.isContentEditable)return;const d=ev.shiftKey?10:1,k={ArrowLeft:[-d,0],ArrowRight:[d,0],ArrowUp:[0,-d],ArrowDown:[0,d]}[ev.key];if(k){mv(cur,cur.offsetLeft+k[0],cur.offsetTop+k[1]);ev.preventDefault()}});
window.hbExport=()=>{const o=els.map(e=>({id:e.dataset.e,x:e.offsetLeft,y:e.offsetTop,w:e.offsetWidth,h:e.offsetHeight,text:e.textContent.trim()}));const t=document.getElementById('out');t.style.display='block';t.value=JSON.stringify(o,null,1);t.select()};
window.hbReset=()=>location.reload();})();
</script>
</body></html>`;
writeFileSync(new URL("editor.html", import.meta.url), html);
