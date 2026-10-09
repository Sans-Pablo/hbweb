// WebP opcional: tools/to_webp.py genera data/**/*.webp (sin pérdida) y data/webp.json; esos binarios NO se versionan.
// Sin ese marcador (p. ej. en GitHub Pages) se sirven los PNG de siempre.
let on = false;
export const setWebp = v => { on = !!v; };
export const imgUrl = p => (on && /^data\/(sprites|fx)\//.test(p) ? p.replace(/\.png$/, ".webp") : p);
export async function detectWebp() {
  try { const r = await fetch("data/webp.json", { cache: "no-cache" }); setWebp(r.ok); } catch { setWebp(false); }
}
