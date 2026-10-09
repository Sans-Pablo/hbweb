// Texto de ayuda de administración y página del panel (/admin, solo desde el PC del servidor).
export const helpText = () => [
  "Comandos de administración (en el chat con /, en la consola del servidor o en el panel):",
  "who · kick <jugador> [motivo] · mute <jugador> [min] · unmute <jugador> · ban <cuenta> [motivo] · unban <cuenta> · banip <ip>",
  "say <texto> · resetpass <cuenta> <clave> · save · restart · stop",
].join("\n");

export const ADMIN_PAGE = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Helbreath Web · Administración</title>
<style>
:root{color-scheme:dark;--bg:#14110d;--card:#211b14;--line:#4a3d2a;--gold:#f0d27a;--txt:#e8dcc3}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:15px system-ui,sans-serif;padding:16px}
h1{color:var(--gold);font:600 22px Georgia,serif;margin:0 0 4px}.sub{opacity:.7;margin-bottom:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:14px;overflow:auto}
table{border-collapse:collapse;width:100%}th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #3a3022;white-space:nowrap}th{color:var(--gold);font-weight:600}
button,input{font:inherit;color:var(--txt);background:#2c2418;border:1px solid var(--line);border-radius:6px;padding:5px 10px}button{cursor:pointer}button:hover{border-color:var(--gold)}
button.bad{border-color:#8a3b2b}.row{display:flex;gap:8px;flex-wrap:wrap}.row input{flex:1;min-width:180px}pre{margin:8px 0 0;white-space:pre-wrap;color:#b9d6a5}
</style></head><body>
<h1>Helbreath Web · Administración</h1><div class="sub" id="sub">…</div>
<div class="card"><table id="pl"><thead><tr><th>Jugador</th><th>Cuenta</th><th>Nv</th><th>Mapa</th><th>IP</th><th>Ping</th><th>Tiempo</th><th></th></tr></thead><tbody></tbody></table><div id="none" style="opacity:.6;padding:8px">Nadie conectado.</div></div>
<div class="card"><div class="row"><input id="say" placeholder="Anuncio para todos los jugadores"><button id="bsay">Anunciar</button></div>
<div class="row" style="margin-top:8px"><input id="cmd" placeholder="Comando (help para ver la lista)"><button id="bcmd">Ejecutar</button><button id="bsave">Guardar</button><button id="brest" class="bad">Reiniciar</button></div><pre id="out"></pre></div>
<div class="card" id="bans" style="opacity:.8"></div>
<script>
const tok=new URLSearchParams(location.search).get("token");
const $=s=>document.querySelector(s), out=$("#out");
async function run(line){const r=await fetch("/api/admin/cmd?token="+tok,{method:"POST",body:JSON.stringify({line})}).then(r=>r.json());out.textContent=r.out;refresh()}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
async function refresh(){const r=await fetch("/api/admin/state?token="+tok);if(!r.ok){$("#sub").textContent="Sin acceso";return}const s=await r.json();
$("#sub").textContent="v"+s.version+" «"+s.name+"» · puerto "+s.port+" · "+s.players.length+"/"+s.max+" jugadores · "+s.accounts+" cuentas · activo "+Math.round(s.uptime/60)+" min"+(s.publicUrl?" · "+s.publicUrl:"");
$("#none").style.display=s.players.length?"none":"";
$("#pl tbody").innerHTML=s.players.map(p=>"<tr><td>"+esc(p.name)+(p.muted?" 🔇":"")+"</td><td>"+esc(p.account)+"</td><td>"+(p.level??"")+"</td><td>"+esc(p.map)+"</td><td>"+esc(p.ip)+"</td><td>"+p.ping+" ms</td><td>"+Math.round(p.secs/60)+" min</td><td><button data-c=\\"kick "+esc(p.account)+"\\">Expulsar</button> <button data-c=\\"mute "+esc(p.account)+" 10\\">Silenciar 10 min</button> <button class=\\"bad\\" data-c=\\"ban "+esc(p.account)+"\\">Bloquear</button></td></tr>").join("");
$("#bans").textContent="Cuentas bloqueadas: "+(s.bans.accounts.join(", ")||"ninguna")+" · IP bloqueadas: "+(s.bans.ips.join(", ")||"ninguna")+" (desbloquear: unban <cuenta o ip>)"}
document.addEventListener("click",e=>{const b=e.target.closest("[data-c]");if(b&&(!/^ban /.test(b.dataset.c)||confirm("¿Bloquear esta cuenta?")))run(b.dataset.c)});
$("#bsay").onclick=()=>{const v=$("#say").value.trim();if(v){run("say "+v);$("#say").value=""}};$("#bcmd").onclick=()=>run($("#cmd").value);
$("#cmd").onkeydown=e=>{if(e.key==="Enter")run($("#cmd").value)};$("#bsave").onclick=()=>run("save");$("#brest").onclick=()=>{if(confirm("¿Reiniciar el servidor? Los jugadores serán desconectados."))run("restart")};
refresh();setInterval(refresh,4000);
</script></body></html>`;
