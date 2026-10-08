// Carga de datos y gráficos, y funciones para dibujar sprites con su pivote
// (CSprite::PutSpriteFast, PutShadowSprite, PutTransSprite del cliente original).

import { GameData } from "../shared/data.js";
import { setData } from "./names.js";

export async function loadAssets(onProgress) {
  const json = async u => (await fetch(u)).json();
  const meta = await json("data/map.json");
  const [buf, manifest, npcDb, spawns, items, magic] = await Promise.all([
    fetch("data/" + meta.map + ".bin").then(r => r.arrayBuffer()),
    json("data/sprites.json"),
    json("data/npc.json").catch(() => ({})),
    json("data/" + meta.map + ".spawns.json").catch(() => []),
    json("data/items.json"),
    json("data/magic.json"),
  ]);
  const data = new GameData({ items, magic, npcs: npcDb });
  setData(data);
  const keys = Object.keys(manifest), images = {};
  let done = 0;
  await Promise.all(keys.map(k => new Promise(res => {
    const img = new Image();
    img.onload = img.onerror = () => { done++; onProgress?.(done / keys.length); res(); };
    img.src = "data/sprites/" + manifest[k].png;
    images[k] = img;
  })));
  return { meta, mapBytes: new Uint8Array(buf), sprites: new Sprites(manifest, images), npcDb, spawns, data };
}

export class Sprites {
  constructor(manifest, images) {
    this.m = manifest;
    this.img = images;
    this.sil = {};                         // siluetas negras para las sombras
    this.tmp = document.createElement("canvas");
    this.tctx = this.tmp.getContext("2d");
  }
  has(key) { return !!this.m[key]; }
  frames(key) { return this.m[key] ? this.m[key].frames.length : 0; }
  frame(key, f) { const s = this.m[key]; return s && f >= 0 && f < s.frames.length ? s.frames[f] : null; }

  // Fotograma f con su pivote en (x, y)
  put(ctx, key, f, x, y) {
    const fr = this.frame(key, f);
    if (!fr) return;
    const [sx, sy, w, h, pvx, pvy] = fr;
    ctx.drawImage(this.img[key], sx, sy, w, h, x + pvx, y + pvy, w, h);
  }

  silhouette(key) {
    let c = this.sil[key];
    if (c) return c;
    const img = this.img[key];
    c = document.createElement("canvas");
    c.width = img.width || 1; c.height = img.height || 1;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#000";
    g.fillRect(0, 0, c.width, c.height);
    this.sil[key] = c;
    return c;
  }

  // Sombra como el original: se aplasta a 1/3 de alto y se inclina hacia la izquierda,
  // con los pies como punto fijo (PutShadowSprite oscurece el fondo al 25 %).
  shadow(ctx, key, f, x, y, alpha) {
    const fr = this.frame(key, f);
    if (!fr) return;
    const [sx, sy, w, h, pvx, pvy] = fr;
    const X0 = x + pvx, Y0 = y + pvy;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.transform(1, 0, 1 / 3, 1 / 3, X0 - h / 3, Y0 + (2 * h) / 3);
    ctx.drawImage(this.silhouette(key), sx, sy, w, h, 0, 0, w, h);
    ctx.restore();
  }

  // Fotograma teñido de un color (destello al recibir un golpe, resaltado al pasar el ratón)
  tinted(ctx, key, f, x, y, color, alpha, op = "source-over") {
    const fr = this.frame(key, f);
    if (!fr) return;
    const [sx, sy, w, h, pvx, pvy] = fr;
    const t = this.tmp, g = this.tctx;
    if (t.width < w || t.height < h) { t.width = Math.max(t.width, w); t.height = Math.max(t.height, h); }
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, w, h);
    g.drawImage(this.img[key], sx, sy, w, h, 0, 0, w, h);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.globalCompositeOperation = op;
    ctx.drawImage(t, 0, 0, w, h, x + pvx, y + pvy, w, h);
    ctx.restore();
  }
}
