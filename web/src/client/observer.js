// MODO OBSERVAR (INVENTO del port): desde la pantalla de entrada se ve la lista de habitantes del servidor (bando, nivel, mapa, atributos...) y se
// entra a verlos jugar en vivo; el chat muestra lo que piensan y hacen. No hace falta cuenta y no se puede actuar. La lista se refresca sola.
import { getLang } from "./i18n.js";

const L = (es, en) => (getLang() === "en" ? en : es);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SIDE = { 1: ["Aresden", "#e07a5f"], 2: ["Elvine", "#6fa8dc"], 0: ["—", "#bba"] };
const ACT = { "muerto": "dead", "viaja": "travelling", "descansa": "resting", "sigue al líder": "following leader", "pasea": "wandering" };
const ARCH = { warrior: ["Guerrero", "Warrior"], hunter: ["Cazador", "Hunter"], trader: ["Comerciante", "Trader"], wanderer: ["Viajero", "Wanderer"], scholar: ["Mago", "Mage"] };
const act = a => (getLang() === "en" ? (a.startsWith("lucha: ") ? "fighting: " + a.slice(7) : ACT[a] || a) : a);

export function pickBot(conn, { onCancel } = {}) {
  return new Promise(resolve => {
    const box = document.createElement("div");
    box.id = "observer";
    box.innerHTML = `<style>
      #observer { position: fixed; inset: 0; z-index: 60; background: rgba(8,6,3,.94); color: #f0e2b8; font: 13px system-ui, sans-serif; display: flex; flex-direction: column; padding: 12px; box-sizing: border-box; }
      #observer h2 { margin: 0 0 6px; color: #ffd76a; font-size: 18px; } #observer .bar { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
      #observer button, #observer select { background: #2c2417; color: #f0e2b8; border: 1px solid #6b5a33; border-radius: 6px; padding: 5px 10px; cursor: pointer; }
      #observer .wrap { overflow: auto; flex: 1; border: 1px solid #4a3f28; border-radius: 6px; } #observer table { border-collapse: collapse; width: 100%; min-width: 900px; }
      #observer th { position: sticky; top: 0; background: #1b1810; text-align: left; padding: 5px 7px; color: #ffd76a; cursor: pointer; white-space: nowrap; }
      #observer td { padding: 4px 7px; border-top: 1px solid #2d2618; white-space: nowrap; } #observer tr.row:hover { background: #3a2f18; cursor: pointer; }
      #observer .hp { display: inline-block; width: 60px; height: 7px; background: #3a1f1a; border-radius: 4px; vertical-align: middle; } #observer .hp i { display: block; height: 100%; background: #c0392b; border-radius: 4px; }
      #observer .dim { color: #998; } #observer .msg { color: #e8a; margin-left: 8px; }
    </style>
    <h2>👁 ${L("Observar habitantes", "Watch residents")}</h2>
    <div class="bar"><span class="dim">${L("Elige uno para verlo jugar en vivo (solo se mira; su chat interno aparece en la ventana de chat).", "Pick one to watch live (view only; its inner log shows in the chat window).")}</span>
      <select class="side"><option value="0">${L("Todos los bandos", "All sides")}</option><option value="1">Aresden</option><option value="2">Elvine</option></select>
      <input class="q" placeholder="${L("buscar…", "search…")}" style="background:#1b1810;color:#f0e2b8;border:1px solid #6b5a33;border-radius:6px;padding:5px 8px;width:120px">
      <button class="refresh">↻ ${L("Actualizar", "Refresh")}</button><button class="back">${L("Volver", "Back")}</button><span class="msg"></span></div>
    <div class="wrap"><table><thead><tr></tr></thead><tbody></tbody></table></div>`;
    document.body.appendChild(box);
    const $ = s => box.querySelector(s), msg = $(".msg");
    const COLS = [["name", "Nombre", "Name"], ["side", "Bando", "Side"], ["lv", "Nv", "Lv"], ["map", "Mapa", "Map"], ["hp", "Vida", "HP"], ["str", "FUE", "STR"], ["vit", "VIT", "VIT"], ["dex", "DES", "DEX"], ["int", "INT", "INT"], ["mag", "MAG", "MAG"],
      ["gold", "Oro", "Gold"], ["kills", "Bajas", "Kills"], ["ek", "PvP", "PvP"], ["arch", "Personalidad", "Personality"], ["guild", "Guild", "Guild"], ["party", "Grupo", "Party"], ["lang", "Idioma", "Lang"], ["act", "Haciendo", "Doing"], ["goal", "Meta", "Goal"]];
    let list = [], sort = "side", dir = 1, timer = 0;
    $("thead tr").innerHTML = COLS.map(([k, es, en]) => `<th data-k="${k}">${L(es, en)}</th>`).join("");
    const val = (b, k) => k === "hp" ? b.hp / Math.max(1, b.mh) : ["str", "vit", "dex", "int", "mag"].includes(k) ? b.st[k] : b[k];
    const render = () => {
      const f = +$(".side").value, q = $(".q").value.trim().toLowerCase();
      const rows = list.filter(b => (!f || b.side === f) && (!q || b.name.toLowerCase().includes(q) || b.map.toLowerCase().includes(q))).sort((a, b) => { const x = val(a, sort), y = val(b, sort); return (x > y ? 1 : x < y ? -1 : 0) * dir || a.name.localeCompare(b.name); });
      $("tbody").innerHTML = rows.map(b => { const [sn, sc] = SIDE[b.side] || SIDE[0];
        return `<tr class="row" data-id="${b.id}"><td><b>${esc(b.name)}</b></td><td style="color:${sc}">${sn}</td><td>${b.lv}</td><td>${esc(b.map)}</td><td><span class="hp"><i style="width:${Math.max(0, Math.round(100 * b.hp / Math.max(1, b.mh)))}%"></i></span> ${b.hp}/${b.mh}</td>` +
          ["str", "vit", "dex", "int", "mag"].map(k => `<td>${b.st[k]}</td>`).join("") + `<td>${b.gold}</td><td>${b.kills}</td><td>${b.ek}</td><td>${esc(ARCH[b.arch] ? L(ARCH[b.arch][0], ARCH[b.arch][1]) : b.arch || "")}</td><td>${esc(b.guild || "—")}</td><td>${b.party || "—"}</td><td>${b.lang === "en" ? "EN" : b.lang === "es" ? "ES" : ""}</td><td>${esc(act(b.act))}</td><td class="dim">${esc(b.goal)}</td></tr>`; }).join("");
      msg.textContent = rows.length + "/" + list.length;
    };
    const load = async () => { try { list = await conn.listBots(); render(); msg.style.color = ""; } catch (e) { msg.style.color = "#e8a"; msg.textContent = e.message; } };
    const close = () => { clearInterval(timer); box.remove(); };
    $("thead").onclick = e => { const k = e.target.dataset?.k; if (!k) return; dir = sort === k ? -dir : 1; sort = k; render(); };
    $(".side").onchange = $(".q").oninput = render;
    $(".refresh").onclick = load;
    $(".back").onclick = () => { close(); onCancel?.(); };
    $("tbody").onclick = async e => {
      const tr = e.target.closest("tr.row"); if (!tr) return;
      msg.textContent = "…";
      try { const id = await conn.watch(+tr.dataset.id); close(); resolve(id); } catch (err) { msg.style.color = "#e8a"; msg.textContent = err.message; load(); }
    };
    load(); timer = setInterval(load, 3000);
  });
}

// Barra superior durante la observación: nombre del habitante, volver a la lista y salir.
export function observerBar(conn) {
  const bar = document.createElement("div");
  bar.style.cssText = "position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:55;background:rgba(20,15,6,.92);color:#f0e2b8;border:1px solid #6b5a33;border-top:0;border-radius:0 0 8px 8px;padding:4px 12px;font:13px system-ui;display:flex;gap:10px;align-items:center";
  bar.innerHTML = `<span>👁 ${L("Observando a", "Watching")} <b style="color:#ffd76a">${esc(conn.watchName)}</b></span><button data-a="list">${L("Lista de habitantes", "Resident list")}</button><button data-a="exit">${L("Salir", "Exit")}</button>`;
  for (const b of bar.querySelectorAll("button")) b.style.cssText = "background:#2c2417;color:#f0e2b8;border:1px solid #6b5a33;border-radius:6px;padding:2px 8px;cursor:pointer";
  bar.onclick = e => { const a = e.target.dataset?.a; if (a === "list") { location.hash = "#observar"; location.reload(); } else if (a === "exit") { location.hash = ""; location.reload(); } };
  document.body.appendChild(bar);
}
