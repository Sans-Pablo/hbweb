// CENTRO DE OBSERVACIÓN (INVENTO del port): paneles que acompañan al modo observar. A la izquierda el plantel (todos los habitantes agrupados por party,
// con qué hacen); arriba la barra con anterior/siguiente; a la derecha la ficha completa del observado (Resumen, Mente, Ficha, Social).
// Cambiar de habitante recarga con #observar=ID (el id del cliente se fija al cargar) y entra solo, sin pasar por la lista.
import { getLang } from "./i18n.js";
import { L, esc, SIDE, ARCH, MODES, act } from "./observer.js";

export const watchTo = id => { location.hash = "#observar=" + id; location.reload(); };
let roster = [];                                                                  // última lista del servidor (la comparten barra y plantel)
export const modeName = b => MODES[b.mode]?.[getLang() === "en" ? 1 : 0] || b.mode;
export const dot = m => ({ dead: "💀", fight: "⚔", rest: "💤", follow: "🐾", delve: "⛏", "delve-go": "⛏", trip: "🧭", pit: "🏴", travel: "🚶", flee: "💨", pet: "🩹" }[m] || "·");

// Grupos: party formal o líder con sus seguidores (campo `grp` del servidor); el resto va «en solitario».
export function groups(list, q) {
  q = q.trim().toLowerCase();
  const ok = b => !q || b.name.toLowerCase().includes(q) || b.map.toLowerCase().includes(q) || (b.guild || "").toLowerCase().includes(q);
  const g = new Map(), solo = [];
  for (const b of list) { if (!ok(b)) continue; if (b.grp) { if (!g.has(b.grp)) g.set(b.grp, []); g.get(b.grp).push(b); } else solo.push(b); }
  const out = [...g.values()].map(m => { m.sort((a, c) => (c.lead === c.name) - (a.lead === a.name) || c.lv - a.lv); return { m, lead: m[0].lead || m[0].name }; })
    .sort((a, c) => c.m.length - a.m.length || a.lead.localeCompare(c.lead));
  return { out, solo: solo.sort((a, c) => (a.side - c.side) || c.lv - a.lv) };
}
const ordered = list => { const { out, solo } = groups(list, ""); return [...out.flatMap(x => x.m), ...solo]; };

// Barra superior: nombre, anterior/siguiente (también teclas [ y ]), tabla completa y salir.
export function observerBar(conn) {
  const bar = document.createElement("div");
  bar.style.cssText = "position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:55;background:rgba(20,15,6,.92);color:#f0e2b8;border:1px solid #6b5a33;border-top:0;border-radius:0 0 8px 8px;padding:4px 12px;font:13px system-ui;display:flex;gap:8px;align-items:center";
  bar.innerHTML = `<button data-a="prev" title="[">◀</button><span>👁 ${L("Observando a", "Watching")} <b style="color:#ffd76a">${esc(conn.watchName)}</b></span><button data-a="next" title="]">▶</button><button data-a="split">${L("Panel dividido", "Split view")}</button><button data-a="list">${L("Tabla completa", "Full table")}</button><button data-a="exit">${L("Salir", "Exit")}</button>`;
  for (const b of bar.querySelectorAll("button")) b.style.cssText = "background:#2c2417;color:#f0e2b8;border:1px solid #6b5a33;border-radius:6px;padding:2px 8px;cursor:pointer";
  const step = d => { const l = ordered(roster); if (l.length < 2) return; const i = l.findIndex(b => b.id === conn.pid); watchTo(l[(i + d + l.length) % l.length].id); };
  bar.onclick = e => { const a = e.target.dataset?.a; if (a === "split") location.href = "observador.html#" + conn.pid; else if (a === "list") { location.hash = "#observar"; location.reload(); } else if (a === "exit") { location.hash = ""; location.reload(); } else if (a === "prev") step(-1); else if (a === "next") step(1); };
  addEventListener("keydown", e => { if (/^F([2-9]|1[01])$/.test(e.key) && e.target.tagName !== "CANVAS") { e.preventDefault(); return; }      // observador: una F pulsada fuera de la pantalla del juego no hace nada (F5 refrescaba la web sin querer)
    if (e.target.closest?.("input,textarea,select")) return; if (e.key === "[") step(-1); else if (e.key === "]") step(1); });
  document.body.appendChild(bar);
}

// Plantel a la izquierda, plegable, con búsqueda y filtro de bando.
export function rosterPanel(conn) {
  const el = document.createElement("div"); el.id = "roster";
  el.style.cssText = "position:fixed;top:0;left:0;bottom:0;z-index:54;width:262px;display:flex;flex-direction:column;background:rgba(14,11,5,.93);color:#f0e2b8;border-right:1px solid #6b5a33;font:12px/1.35 system-ui,sans-serif;transition:transform .15s";
  el.innerHTML = `<style>#roster .r{display:grid;grid-template-columns:16px 1fr auto;gap:0 5px;padding:3px 7px;cursor:pointer;border-left:3px solid transparent;align-items:center}#roster .r:hover{background:#3a2f18}#roster .r.me{background:#4a3a14;border-left-color:#ffd76a}
    #roster .hp{height:3px;background:#3a1f1a;border-radius:2px;grid-column:2/4}#roster .hp i{display:block;height:100%;background:#c0392b;border-radius:2px}#roster .g{padding:4px 7px 2px;color:#b9a572;font-size:11px;text-transform:uppercase;background:#1b1608;position:sticky;top:0;display:flex;justify-content:space-between}
    #roster .d{color:#998;font-size:11px;grid-column:2/4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#roster .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style>
    <div style="padding:34px 7px 6px;display:flex;gap:6px;align-items:center"><b style="color:#ffd76a">${L("Habitantes", "Residents")}</b><span class="cnt" style="color:#998"></span><a data-a="tog" style="margin-left:auto;cursor:pointer;color:#b9a572;padding:0 4px">◀</a></div>
    <div style="padding:0 7px 6px;display:flex;gap:4px"><input class="q" placeholder="${L("buscar nombre, mapa, guild…", "search name, map, guild…")}" style="flex:1;min-width:0;background:#1b1810;color:#f0e2b8;border:1px solid #6b5a33;border-radius:6px;padding:3px 6px"><select class="s" style="background:#1b1810;color:#f0e2b8;border:1px solid #6b5a33;border-radius:6px"><option value="0">∗</option><option value="1">A</option><option value="2">E</option></select></div>
    <div class="list" style="overflow:auto;flex:1"></div>`;
  document.body.appendChild(el);
  let open = true, key = "";
  const $ = s => el.querySelector(s);
  const row = b => {
    const sc = (SIDE[b.side] || SIDE[0])[1];
    return `<div class="r${b.id === conn.pid ? " me" : ""}" data-id="${b.id}" title="${esc(act(b.act))}"><span>${dot(b.mode)}</span><span class="n"><b style="color:${sc}">${esc(b.name)}</b> <span style="color:#998">${L("Nv", "Lv")}${b.lv}</span>${b.grp && b.lead === b.name ? " 👑" : ""}</span><span style="color:#998">${b.guild ? "⚑" + esc(b.guild.slice(0, 6)) : ""}</span>` +
      `<span class="hp"><i style="width:${Math.max(0, Math.round(100 * b.hp / Math.max(1, b.mh)))}%"></i></span><span class="d">${esc(modeName(b))} · ${esc(b.map)}${b.floor ? " " + b.floor : ""}</span></div>`;
  };
  const render = () => {
    const f = +$(".s").value, list = roster.filter(b => !f || b.side === f), { out, solo } = groups(list, $(".q").value);
    const k = JSON.stringify([out, solo, conn.pid, getLang()]); if (k === key) return; key = k;
    $(".cnt").textContent = list.length;
    $(".list").innerHTML = out.map(g => `<div class="g"><span>👥 ${L("Grupo de", "Party of")} ${esc(g.lead)}</span><span>${g.m.length}</span></div>` + g.m.map(row).join("")).join("")
      + (solo.length ? `<div class="g"><span>${L("En solitario", "Solo")}</span><span>${solo.length}</span></div>` + solo.map(row).join("") : "");
  };
  const load = async () => { try { roster = await conn.listBots(); render(); } catch { /* sin red un momento: se reintenta */ } };
  el.onclick = e => {
    if (e.target.dataset?.a === "tog") { open = !open; el.style.transform = open ? "" : "translateX(-232px)"; e.target.textContent = open ? "◀" : "▶"; return; }
    const r = e.target.closest(".r"); if (r && +r.dataset.id !== conn.pid) watchTo(+r.dataset.id);
  };
  $(".q").oninput = $(".s").onchange = () => { key = ""; render(); };
  load(); setInterval(load, 2000);
}

// Ficha completa del observado. Llega del servidor cada segundo (mensaje "brain").
const KIND = { ally: "🟢", enemy: "🔴", mob: "👹", pet: "🐾" };
const SLOT = { 1: ["Cabeza", "Head"], 2: ["Cuerpo", "Body"], 3: ["Brazos", "Arms"], 4: ["Pantalón", "Pants"], 5: ["Botas", "Boots"], 6: ["Cuello", "Neck"], 7: ["Mano izq.", "Left hand"], 8: ["Mano der.", "Right hand"], 9: ["Dos manos", "Two-hand"], 10: ["Anillo D", "Ring R"], 11: ["Anillo I", "Ring L"], 12: ["Espalda", "Back"], 13: ["Cuerpo entero", "Full body"] };
const SK = { 0: ["Minería", "Mining"], 1: ["Pesca", "Fishing"], 2: ["Agricultura", "Farming"], 3: ["Res. mágica", "Magic res."], 4: ["Magia", "Magic"], 5: ["Sin armas", "Hand"], 6: ["Arquería", "Archery"], 7: ["Espada corta", "Short sword"], 8: ["Espada larga", "Long sword"], 9: ["Esgrima", "Fencing"], 10: ["Hacha", "Axe"], 11: ["Escudo", "Shield"], 12: ["Alquimia", "Alchemy"], 13: ["Fabricación", "Crafting"], 14: ["Martillo", "Hammer"], 19: ["Fingir muerte", "Pretend dead"], 21: ["Bastón", "Staff"], 23: ["Res. veneno", "Poison res."] };
const CLS = { warrior: ["Guerrero", "Warrior"], mage: ["Mago", "Mage"], summoner: ["Invocador", "Summoner"] };
export const TABS = [["res", "Resumen", "Summary"], ["mind", "Mente", "Mind"], ["gear", "Ficha", "Sheet"], ["soc", "Social", "Social"], ["talk", "Charlas", "Talk"]];
let tab = "res";
export function brainPanel(conn) {
  let el = document.getElementById("brain");
  if (!el) {
    el = document.createElement("div"); el.id = "brain"; el.dataset.open = "1";
    el.style.cssText = "position:fixed;top:34px;right:6px;z-index:54;width:340px;max-height:calc(100vh - 44px);overflow:auto;background:rgba(20,15,6,.93);color:#f0e2b8;border:1px solid #6b5a33;border-radius:8px;padding:6px 10px;font:12px/1.4 sans-serif";
    el.onclick = e => {
      const a = e.target.dataset?.a;
      if (a === "tog") { el.dataset.open = el.dataset.open === "1" ? "0" : "1"; el._k = ""; }
      else if (a === "tab") { tab = e.target.dataset.t; el._k = ""; brainPanel(conn); }
      else if (a === "go" && +e.target.dataset.id !== conn.pid) watchTo(+e.target.dataset.id);
    };
    document.body.appendChild(el);
  }
  const b = conn.brain; if (!b) return;
  const key = JSON.stringify(b) + el.dataset.open + getLang() + tab; if (el._k === key) return; el._k = key;
  el.innerHTML = brainHtml(b, tab, el.dataset.open === "1");
}
// Ficha en HTML (la usan el panel flotante y el panel dividido). data-a="tog|tab|go" lo atiende quien la pinte.
export function brainHtml(b, tab, open = true) {
  const lang = getLang() === "en" ? 1 : 0, T = o => esc(o?.[lang ? "en" : "es"] ?? "");
  const P = (v, m, c, w = 70) => `<span style="display:inline-block;width:${w}px;height:7px;background:#3a2f1a;border-radius:3px;vertical-align:middle"><i style="display:block;height:100%;width:${Math.max(0, Math.min(100, 100 * v / Math.max(1, m)))}%;background:${c};border-radius:3px"></i></span>`;
  const [sn, sc] = SIDE[b.side] || SIDE[0];
  const head = `<div style="display:flex;justify-content:space-between"><b style="color:#ffd76a">🧠 ${esc(b.name)} <span style="color:${sc};font-weight:400">${sn}</span></b><a data-a="tog" style="cursor:pointer;color:#b9a572">${open ? "▾" : "▸"}</a></div>`;
  if (!open) return head;
  const sec = t => `<div style="margin-top:7px;color:#b9a572;font-size:11px;text-transform:uppercase;border-bottom:1px solid #3a2f18">${t}</div>`;
  const kv = (k, v) => `<div style="display:flex;justify-content:space-between;gap:8px"><span style="color:#998">${k}</span><span style="text-align:right">${v}</span></div>`;
  let h = head + `<div>${dot(b.mode)} <b>${MODES[b.mode]?.[lang] || b.mode}</b> · ${L("Nv", "Lv")} ${b.lv} ${esc(CLS[b.cls]?.[lang] || b.cls)} · ${esc(b.map)}${b.floor ? " (" + L("piso", "floor") + " " + b.floor + ")" : ""}</div>`;
  h += `<div>❤ ${P(b.hp, b.mhp, "#c33")} ${b.hp}/${b.mhp} &nbsp;✦ ${P(b.mp, b.mmp, "#38c")} ${b.mp}/${b.mmp}</div><div>XP ${P(b.exp, 100, "#cb3", 120)} ${b.exp}%</div>`;
  h += `<div style="display:flex;gap:4px;margin:6px 0">` + TABS.map(([k, es, en]) => `<a data-a="tab" data-t="${k}" style="cursor:pointer;padding:2px 8px;border-radius:5px;border:1px solid #6b5a33;background:${tab === k ? "#6b5a33" : "#2c2417"}">${L(es, en)}</a>`).join("") + "</div>";
  if (tab === "res") {
    h += sec(L("Objetivo", "Goal")) + `<div>${T(b.goal) || "—"}</div>`;
    if (b.quest) h += `<div>📜 ${T(b.quest)} <span style="color:#9c9">${b.quest.pr.join("/")}</span></div>`;
    if (b.delve) h += `<div>⛏ ${L("Expedición: quedan", "Expedition: left")} ${b.delve.until}s</div>`;
    if (b.wish) h += `<div>💭 ${esc(b.wish)}</div>`;
    h += sec(L("Mira", "Looking at")) + (b.target ? `<div>🎯 ${esc(b.target.n)} · ${b.target.hp}% · ${b.target.d} ${L("casillas", "tiles")}</div>` : "") + (b.near.length ? b.near.map(n => `<div>${KIND[n.k] || ""} ${esc(n.n)} ${n.hp}% · ${n.d}</div>`).join("") : `<div>${L("nada cerca", "nothing near")}</div>`);
    h += sec(L("Piensa (diario)", "Thinking (log)")) + b.log.slice().reverse().map(l => `<div style="opacity:.9">${esc(l)}</div>`).join("");
  } else if (tab === "mind") {
    h += sec(L("Personalidad", "Personality")) + kv(L("Arquetipo", "Archetype"), esc(ARCH[b.arch] ? L(ARCH[b.arch][0], ARCH[b.arch][1]) : b.arch)) + kv(L("Idioma", "Language"), b.lang === "en" ? "EN" : "ES") + kv(L("Origen", "Origin"), esc(b.origin)) + kv(L("Motivo", "Motive"), esc(b.motive)) + kv(L("Miedo", "Fear"), esc(b.fear)) + kv(L("Manía", "Quirk"), esc(b.quirk));
    if (b.bio) h += `<div style="margin-top:4px;opacity:.85">${esc(b.bio)}</div>`;
    h += sec(L("Meta y misiones", "Goal and quests")) + `<div>${T(b.goal) || "—"}</div>`;
    h += b.quests.map((q, i) => `<div style="opacity:${q.st === 0 ? 0.45 : 1}">${q.st === 2 ? "✔" : q.st === 1 ? "▶" : "·"} ${i + 1}. ${T(q)}${q.st === 1 && b.quest ? ' <span style="color:#9c9">' + b.quest.pr.join("/") + "</span>" : ""}</div>`).join("");
    h += sec(L("Recuerdos", "Memories")) + (b.mem.length ? b.mem.slice().reverse().map(m => `<div>${T(m)}</div>`).join("") : "—");
    h += sec(L("Charlas", "Chats")) + `<div>${b.chats} ${L("mensajes con el modelo", "model-written messages")}</div>`;
  } else if (tab === "gear") {
    h += sec(L("Atributos", "Stats")) + `<div style="display:flex;gap:10px;flex-wrap:wrap">` + ["str", "vit", "dex", "int", "mag", "chr"].map(k => `<span><span style="color:#998">${k.toUpperCase()}</span> ${b.st[k] ?? "-"}</span>`).join("") + "</div>"
      + kv(L("Nivel medio de objetos", "Average item level"), b.ilvl) + kv(L("Oro / pociones", "Gold / potions"), b.gold + " / " + b.pots) + kv(L("Bolsa", "Bag"), b.bagN + " " + L("objetos", "items"));
    h += sec(L("Equipo", "Equipment")) + (b.equip.length ? b.equip.map(([sl, n]) => kv(SLOT[sl]?.[lang] || sl, esc(n))).join("") : "—");
    h += sec(L("Habilidades", "Skills")) + (b.skills.length ? b.skills.map(([k, v]) => `<div style="display:flex;gap:6px;align-items:center"><span style="width:100px;color:#998">${SK[k]?.[lang] || k}</span>${P(v, 100, "#6a9", 110)} ${v}</div>`).join("") : "—");
    const nm = a => a.map(([n, v]) => esc(String(n).replace(/-/g, " ")) + " " + v).join(", ");
    h += sec(L("Historial", "Record")) + kv(L("Bajas / muertes", "Kills / deaths"), b.kills + " / " + b.deaths) + kv("PvP", b.qa.pvp.k + " / " + b.qa.pvp.d + " · ek " + b.ek);
    if (b.qa.kills.length) h += kv(L("Más cazados", "Most hunted"), nm(b.qa.kills));
    if (b.qa.deaths.length) h += kv(L("Le matan", "Killed by"), nm(b.qa.deaths));
    if (b.delveInfo) h += kv(L("Cripta: más profundo / reyes", "Crypt: deepest / kings"), b.delveInfo.deepest + " / " + b.delveInfo.king);
    if (b.pet || b.qa.pet.kills || b.qa.pet.lost) h += kv("Summon", (b.pet ? "✔ " : "") + b.qa.pet.kills + " " + L("bajas", "kills") + " · " + b.qa.pet.lost + " " + L("caídas", "lost"));
  } else if (tab === "talk") {
    h += sec(L("Con quién habla más", "Talks most with")) + ((b.talkN || []).length ? b.talkN.map(([n, v]) => kv(esc(n), v)).join("") : "—");
    h += sec(L("Memoria de conversaciones", "Conversation memory")) + ((b.talk || []).length ? b.talk.slice().reverse().map(t => `<div style="opacity:.92"><span style="color:#998">${t.ch === "g" ? "⚑" : "💬"}</span> <b style="color:${t.me ? "#ffd76a" : "#9cf"}">${esc(t.who)}</b>: ${esc(t.text)}</div>`).join("") : "—");
  } else {
    h += sec(L("Grupo", "Party")) + (b.mates.length ? b.mates.map(m => `<div><a data-a="go" data-id="${m.id}" style="cursor:pointer;color:${m.id === b.id ? "#ffd76a" : "#9cf"}">${m.lead ? "👑 " : ""}${esc(m.n)}</a> ${L("Nv", "Lv")}${m.lv} ${P(m.hp, 100, "#c33", 40)}</div>`).join("") : `<div>${L("En solitario", "Solo")}</div>`);
    h += sec("Guild") + (b.guild ? `<div>⚑ <b>${esc(b.guild.name)}</b> · ${b.guild.rank === 0 ? "Guildmaster" : "Guildsman"}</div>` + kv(L("Líder", "Master"), esc(b.guild.master)) + kv(L("Miembros", "Members"), b.guild.n) : "<div>—</div>");
    h += sec(L("Amistades", "Relationships")) + (b.rel.length ? b.rel.map(([n, v]) => kv(esc(n), v)).join("") : "—");
  }
  return h;
}
