// Carga de datos y gráficos, y funciones para dibujar sprites con su pivote
// (CSprite::PutSpriteFast, PutShadowSprite, PutTransSprite del cliente original).

import { GameData } from "../shared/data.js";
import { Grid } from "../shared/grid.js";
import { setData } from "./names.js";
import { coreKeys } from "./bundles.js";
import { DUNGEON_ASSETS, DUNGEON_FLOORS } from "../shared/dungeon.js";

const ASSET_VERSION = "crypt-v2";
const spriteUrl = png => "data/sprites/" + png + "?v=" + ASSET_VERSION;

// Reintenta una descarga fallida; nunca da por cargada una imagen rota.
export async function loadSpriteImage(png, timeoutMs = 20000) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        const timer = setTimeout(() => { img.onload = img.onerror = null; reject(new Error("tiempo de espera")); }, timeoutMs);
        img.onload = () => { clearTimeout(timer); resolve(img); };
        img.onerror = () => { clearTimeout(timer); reject(new Error("descarga fallida")); };
        img.src = spriteUrl(png) + (attempt ? "&retry=1" : "");
      });
    } catch (err) {
      if (attempt === 1) throw new Error("No se pudo cargar data/sprites/" + png + ". Recarga la página para reintentar.", { cause: err });
    }
  }
}

export function validateDungeonAssets(manifest, npcDb) {
  if (npcDb.Skeleton?.sprite !== "ske") throw new Error("Faltan los datos de Skeleton. Recarga la página.");
  for (const k of DUNGEON_ASSETS) {
    if (!manifest[k]?.png || !manifest[k]?.frames?.length) throw new Error("Falta el gráfico " + k + ". Recarga la página.");
    if (k.startsWith("ske") && manifest[k].frames.length < 4) throw new Error("Animación incompleta: " + k);
  }
  for (const floor of DUNGEON_FLOORS) for (const f of floor.frames) if (!manifest["t" + floor.spr].frames[f]) throw new Error("Falta el suelo de la cripta: " + floor.spr + "/" + f);
}

export async function loadAssets(onProgress) {
  const response = async u => {
    const r = await fetch(u, { cache: "no-cache" });
    if (!r.ok) throw new Error("No se pudo cargar " + u + " (HTTP " + r.status + ")");
    return r;
  };
  const json = async u => (await response(u)).json();
  const meta = await json("data/map.json");
  const [buf, manifest, npcDb, spawns, items, magic] = await Promise.all([
    response("data/" + meta.map + ".bin").then(r => r.arrayBuffer()),
    json("data/sprites.json"),
    json("data/npc.json"),
    json("data/" + meta.map + ".spawns.json").catch(() => []),
    json("data/items.json"),
    json("data/magic.json"),
  ]);
  const shops = await json("data/shops.json").catch(() => ({}));
  const talk = await json("data/talk.json").catch(() => ({}));
  validateDungeonAssets(manifest, npcDb);
  // mapas de la ciudad (data/maps/<id>.json): los metadatos van siempre; la rejilla (.bin, hasta 2,7 MB) se baja al hacer falta
  // con m.ensure(). Adventure.teleport pide el mapa y, si aún no está, rechaza el salto y se reintenta al llegar.
  const maps = {};
  const index = await json("data/maps/index.json").catch(() => ({}));
  await Promise.all(Object.keys(index).map(async id => {
    const mapMeta = await json("data/maps/" + id + ".json");
    const m = maps[id] = { meta: mapMeta, grid: null };
    if (id === "arefarm") return;
    m.ensure = () => m.loading || (m.loading = response("data/maps/" + id + ".bin").then(r => r.arrayBuffer()).then(bytes => { m.grid = new Grid(mapMeta.w, mapMeta.h, new Uint8Array(bytes)); return m; }).catch(err => { m.loading = null; throw err; }));
  }));
  const data = new GameData({ items, magic, npcs: npcDb });
  setData(data);
  // Solo se descarga lo común (objetos del suelo, interfaz del mundo); losetas y monstruos llegan por mapa (streaming.js).
  const images = {}, core = coreKeys(manifest, npcDb);
  let done = 0, next = 0;
  await Promise.all(Array.from({ length: Math.min(8, core.length) }, async () => {
    while (next < core.length) {
      const k = core[next++];
      images[k] = await loadSpriteImage(manifest[k].png);
      done++; onProgress?.(done / core.length);
    }
  }));
  // sprites de personaje (pieles, peinados, ropa interior): se descargan cuando hacen falta
  const players = await json("data/players.json").catch(() => ({}));
  Object.assign(manifest, players);
  // ropa, armas, escudos y objetos (se descargan al usarse)
  const equip = await json("data/equip.json").catch(() => ({}));
  for (const k of Object.keys(equip)) equip[k].png = "../equip/" + equip[k].png;
  Object.assign(manifest, equip);
  const hd = await json("data/sprites_hd.json").catch(() => ({}));
  const sprites = new Sprites(manifest, images, hd);
    return { meta, mapBytes: new Uint8Array(buf), sprites, npcDb, spawns, data, maps, shops, talk };
}

export class Sprites {
  constructor(manifest, images, hdManifest = {}) {
    this.m = manifest;
    this.hd = false;                       // modo remastered: usa las hojas HD (data/sprites_hd) cuando ya están descargadas
    this.hdm = hdManifest;
    this.hdi = {};
    // las imágenes que no se cargaron al principio (personajes) se piden la primera vez que se usan
    this.img = new Proxy(images, {
      get(t, k) {
        if (!(k in t) && typeof k === "string" && manifest[k]) { const i = new Image(); i.src = spriteUrl(manifest[k].png); t[k] = i; }
        return t[k];
      },
    });
    this.sil = {};                         // siluetas negras para las sombras
    this.tmp = document.createElement("canvas");
    this.tctx = this.tmp.getContext("2d");
  }
  // hoja a usar para este sprite: [imagen, factor]. La HD se pide la primera vez; mientras llega se usa la original.
  src(key) {
    const h = this.hd && this.hdm[key];
    if (h) {
      let i = this.hdi[key];
      if (!i) { i = this.hdi[key] = new Image(); i.src = "data/sprites_hd/" + h.png + "?v=" + ASSET_VERSION; }
      if (i.complete && i.naturalWidth > 0) return [i, h.k];
    }
    return [this.img[key], 1];
  }
  // espera a que estén listas las hojas HD de estos sprites (si las hay)
  preloadHd(keys) {
    return Promise.all(keys.filter(k => this.hdm[k]).map(k => new Promise(res => {
      const h = this.hdm[k]; let i = this.hdi[k];
      if (!i) { i = this.hdi[k] = new Image(); i.src = "data/sprites_hd/" + h.png + "?v=" + ASSET_VERSION; }
      if (i.complete) return res();
      i.addEventListener("load", res, { once: true }); i.addEventListener("error", res, { once: true });
    })));
  }
  has(key) { return !!this.m[key]; }
  ready(key) { const i = this.img[key]; return !!i && i.complete && i.naturalWidth > 0; }
  // espera a que estén descargados estos sprites (para no dibujar al personaje a medias)
  preload(keys) {
    return Promise.all(keys.filter(k => this.m[k]).map(k => new Promise(res => {
      const i = this.img[k];
      if (i.complete) return res();
      i.addEventListener("load", res, { once: true }); i.addEventListener("error", res, { once: true });
    })));
  }
  // sprites que hacen falta para dibujar a un personaje con este aspecto (todas las animaciones)
  lookKeys(gender, look) {
    const type = (gender === 2 ? 3 : 0) + look.skin, g = gender === 2 ? 1 : 0, keys = [];
    for (const grp of [0, 1, 2, 3, 4, 6, 8, 9, 10, 11]) {
      for (let d = 0; d < 8; d++) keys.push("pb" + type + "_" + (grp * 8 + d));
      keys.push("pu" + g + "_" + look.under + "_" + grp, "ph" + g + "_" + look.hair + "_" + grp);
    }
    return keys;
  }
  frames(key) { return this.m[key] ? this.m[key].frames.length : 0; }
  frame(key, f) {
    const hd = this.hd && this.hdm[key];
    // Los redibujos tienen atlas y pivotes propios. Hasta cargar la hoja,
    // usar juntos la imagen y las coordenadas originales.
    if (hd?.frames && this.src(key)[0] === this.hdi[key]) return hd.frames[f] || null;
    const s = this.m[key]; return s && f >= 0 && f < s.frames.length ? s.frames[f] : null;
  }

  // Fotograma f con su pivote en (x, y)
  put(ctx, key, f, x, y) {
    const fr = this.frame(key, f);
    if (!fr) return;
    if (!this.ready(key)) return;
    const [sx, sy, w, h, pvx, pvy] = fr, [img, k] = this.src(key);
    ctx.drawImage(img, sx * k, sy * k, w * k, h * k, x + pvx, y + pvy, w, h);
  }

  // Pelo teñido: el color del original se suma a los píxeles (PutSpriteRGB); aquí se mezcla con el tono base
  tintedHair(ctx, key, f, x, y, rgb) {
    const fr = this.frame(key, f);
    if (!fr || !this.ready(key)) return;
    const [sx, sy, w, h, pvx, pvy] = fr, [img, k] = this.src(key), W = w * k, H = h * k;
    const t = this.tmp, g = this.tctx;
    if (t.width < W || t.height < H) { t.width = Math.max(t.width, W); t.height = Math.max(t.height, H); }
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, W, H);
    g.drawImage(img, sx * k, sy * k, W, H, 0, 0, W, H);
    g.globalCompositeOperation = "multiply";        // oscurece/colorea el pelo gris original
    g.fillStyle = rgb;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "destination-in";  // y recorta de nuevo a la forma del pelo
    g.drawImage(img, sx * k, sy * k, W, H, 0, 0, W, H);
    ctx.drawImage(t, 0, 0, W, H, x + pvx, y + pvy, w, h);
  }

  silhouette(key) {
    const [img, k] = this.src(key), cacheKey = key + "@" + k;
    let c = this.sil[cacheKey];
    if (c) return c;
    c = document.createElement("canvas");
    c.width = img.width || 1; c.height = img.height || 1;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#000";
    g.fillRect(0, 0, c.width, c.height);
    this.sil[cacheKey] = c;
    return c;
  }

  // Sombra como el original: se aplasta a 1/3 de alto y se inclina hacia la izquierda,
  // con los pies como punto fijo (PutShadowSprite oscurece el fondo al 25 %).
  shadow(ctx, key, f, x, y, alpha) {
    const fr = this.frame(key, f);
    if (!fr || !this.ready(key)) return;
    const [sx, sy, w, h, pvx, pvy] = fr, [, k] = this.src(key);
    const X0 = x + pvx, Y0 = y + pvy;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.transform(1, 0, 1 / 3, 1 / 3, X0 - h / 3, Y0 + (2 * h) / 3);
    ctx.drawImage(this.silhouette(key), sx * k, sy * k, w * k, h * k, 0, 0, w, h);
    ctx.restore();
  }

  // Fotograma teñido de un color (destello al recibir un golpe, resaltado al pasar el ratón)
  tinted(ctx, key, f, x, y, color, alpha, op = "source-over") {
    const fr = this.frame(key, f);
    if (!fr || !this.ready(key)) return;
    const [sx, sy, w, h, pvx, pvy] = fr, [img, k] = this.src(key), W = w * k, H = h * k;
    const t = this.tmp, g = this.tctx;
    if (t.width < W || t.height < H) { t.width = Math.max(t.width, W); t.height = Math.max(t.height, H); }
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, W, H);
    g.drawImage(img, sx * k, sy * k, W, H, 0, 0, W, H);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.globalCompositeOperation = op;
    ctx.drawImage(t, 0, 0, W, H, x + pvx, y + pvy, w, h);
    ctx.restore();
  }
}
