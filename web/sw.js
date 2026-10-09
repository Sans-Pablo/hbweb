// Caché persistente de recursos (Cache API). Imágenes, sonidos y música no cambian entre versiones
// (la URL lleva ?v=<ASSET_VERSION>), así que se sirven de caché primero; los JSON y mapas van red primero.
const CACHE = "hbweb-assets-v1";
const BIG = /\/data\/(sprites|sprites_hd|equip|fx|ui|sfx|music|help)\//;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("hbweb-assets-") && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || !u.pathname.includes("/data/") || r.headers.has("range")) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE), hit = await c.match(r);
    if (BIG.test(u.pathname)) {                                   // cache-first
      if (hit) return hit;
      const res = await fetch(r); if (res.ok) c.put(r, res.clone()); return res;
    }
    try { const res = await fetch(r); if (res.ok) c.put(r, res.clone()); return res; }      // JSON y .bin: red primero (siempre al día), caché si no hay conexión
    catch (err) { if (hit) return hit; throw err; }
  })());
});
