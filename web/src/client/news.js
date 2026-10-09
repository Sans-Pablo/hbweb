// F1: novedades, lista de pruebas y notas para los testers (data/news.json). Sustituye a la ayuda original.
import { getLang, onLang } from "./i18n.js";
import { devHtml, devClick } from "./devtools.js";

const KEY = "hbweb.tested";
const read = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
const write = s => { try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch {} };
const L = (o, lang) => (o && (o[lang] || o.es)) || "";
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export async function setupNews(root) {
  let data;
  try { data = await (await fetch("data/news.json", { cache: "no-cache" })).json(); } catch { return; }
  const done = read();
  let tab = "news";
  const body = root.querySelector(".body");
  const T = { news: { es: "Novedades", en: "News" }, tests: { es: "Para probar", en: "To test" }, notes: { es: "A tener en cuenta", en: "Keep in mind" }, tools: { es: "Herramientas", en: "Tools" } };

  const render = () => {
    const lang = getLang();
    const total = data.tests.length, ok = data.tests.filter(t => done.has(t.id)).length;
    let h = `<p class="build">${esc(L(data.build, lang))}</p><p class="intro">${esc(L(data.intro, lang))}</p><nav>`;
    for (const k of Object.keys(T)) h += `<button data-tab="${k}"${k === tab ? ' class="on"' : ""}>${esc(L(T[k], lang))}${k === "tests" ? ` <small>${ok}/${total}</small>` : ""}</button>`;
    h += "</nav><div class=\"scroll\">";
    if (tab === "news") {
      for (const n of data.news) h += `<section><h4>${esc(L(n.title, lang))} <small>${esc(n.date)}</small></h4><ul>${n.items.map(i => `<li>${esc(L(i, lang))}</li>`).join("")}</ul></section>`;
    } else if (tab === "tests") {
      let group = null;
      for (const t of data.tests) {
        const g = L(t.group, lang);
        if (g !== group) { if (group !== null) h += "</ul></section>"; h += `<section><h4>${esc(g)}</h4><ul class="checks">`; group = g; }
        h += `<li><label><input type="checkbox" data-test="${esc(t.id)}"${done.has(t.id) ? " checked" : ""}> <span>${esc(L(t.text, lang))}</span></label></li>`;
      }
      h += `</ul></section><button class="reset" data-reset>${lang === "en" ? "Clear marks" : "Borrar marcas"}</button>`;
    } else if (tab === "tools") {
      h += devHtml(lang);
    } else {
      h += `<ul>${data.notes.map(n => `<li>${esc(L(n, lang))}</li>`).join("")}</ul>`;
    }
    body.innerHTML = h + "</div>";
  };

  body.addEventListener("click", e => {
    if (devClick(e)) return;
    const b = e.target.closest("[data-tab]");
    if (b) { tab = b.dataset.tab; render(); return; }
    if (e.target.closest("[data-reset]")) { done.clear(); write(done); render(); }
  });
  body.addEventListener("change", e => {
    const c = e.target.closest("[data-test]");
    if (!c) return;
    c.checked ? done.add(c.dataset.test) : done.delete(c.dataset.test);
    write(done);
    const small = body.querySelector('[data-tab="tests"] small');
    if (small) small.textContent = data.tests.filter(t => done.has(t.id)).length + "/" + data.tests.length;
  });
  onLang(render);
  render();
}
