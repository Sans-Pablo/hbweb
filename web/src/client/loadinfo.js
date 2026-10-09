// Pantalla de carga: versión de la compilación (data/version.json) y últimas novedades (data/news.json), para saber qué se está probando.
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
let lang = "es";
try { lang = localStorage.getItem("hbweb.lang") || (/^en/i.test(navigator.language || "") ? "en" : "es"); } catch {}
const L = o => (o && (o[lang] || o.es)) || "";
export async function showLoadInfo(box, fold = false) {
  try {
    const [v, n] = await Promise.all([fetch("data/version.json", { cache: "no-cache" }).then(r => r.json()), fetch("data/news.json", { cache: "no-cache" }).then(r => r.json())]);
    let h = `<p class="ver">v${esc(v.version)} · ${esc(v.name)} <small>${esc(v.date || "")}</small></p>${fold ? "" : '<div class="log">'}`;
    if (!fold) for (const e of (n.news || []).slice(0, 3)) h += `<h4>${esc(L(e.title))}</h4><ul>${e.items.map(i => `<li>${esc(L(i))}</li>`).join("")}</ul>`;
    box.innerHTML = h + (fold ? "" : "</div>");
  } catch {}
}
