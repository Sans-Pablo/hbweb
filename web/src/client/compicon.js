// Icono de las bolas de compañero: un sprite pequeño de la especie (reposo, de frente) sobre la bola de Item.cfg.
import { mobSprite } from "./anim.js";
import { ACT } from "../shared/const.js";
import { BALL_COLORS } from "../shared/systems/talents.js";
let NPC = {};
export const setNpcDb = db => { NPC = db || {}; };
const cache = new Map();
export function miniOf(sp, frames, cls) {
  const cfg = NPC[sp]; if (!cfg) return null;
  const e = { kind: "npc", type: cfg.type, cfg, dir: 5, act: ACT.STOP, actStart: 0, actDur: 0, phase: 0, dur: { stopFrame: 200 } };
  return mobSprite(e, 0, frames);
}
// Color de la bola de cada especie: el complementario del color medio de su sprite (contraste), o uno fijo si el sprite es gris/blanco/negro
const tints = new Map();
function tintOf(g, sp, m) {
  if (sp === "Liche") return "#1c0630";                                      // el Liche es nigromante: bola en tonos oscuros, casi negro violáceo
  if (tints.has(sp)) return tints.get(sp);
  const f = g.spr.frame(m.key, m.f); if (!f || !g.spr.ready(m.key)) return null;
  const [sx, sy, w, h] = f, c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(g.spr.img[m.key], sx, sy, w, h, 0, 0, w, h);
  let r = 0, gg = 0, b = 0, n = 0;
  try { const d = x.getImageData(0, 0, w, h).data; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } } catch { return null; }
  if (!n) return null;
  r /= n; gg /= n; b /= n;
  const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 510, s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
  let hue = 0;
  if (mx !== mn) { const dlt = mx - mn; hue = mx === r ? ((gg - b) / dlt) % 6 : mx === gg ? (b - r) / dlt + 2 : (r - gg) / dlt + 4; hue = (hue * 60 + 360) % 360; }
  const col = s < 0.18 ? (l < 0.5 ? "#ffd23a" : "#e0302a") : "hsl(" + Math.round((hue + 180) % 360) + ",95%,55%)";
  tints.set(sp, col); return col;
}
const ballCache = new Map();
const BALL_SPRITE = 23;                               // sprite de Item.cfg que no existe: la hoja ip20 la hornea tools/ballitems.mjs
// bola de la mochila: tamaño de un objeto normal (el sprite horneado mide 48 px con margen; a 0,85 la bola ocupa ~34 px), con el color de su especie
// y la criatura DENTRO de la esfera (46 % del ancho), suavizada en alta calidad (se reduce desde el sprite original, sin pixelar)
export const BALL_SCALE = 0.62, BALL_INNER = 0.46;
export function drawBall(g, it, d, key, x, y, alpha = 1, scale = BALL_SCALE) {
  const fr = g.spr.frame(key, d.spriteFrame); if (!fr || !g.spr.ready(key)) return;
  const [sx, sy, w, h, px, py] = fr, sp = it.comp.sp;
  const mk = sp + ":" + (it.comp.cls || ""); let m = cache.get(mk); if (!m) { m = miniOf(sp, k => g.spr.frames(k), it.comp.cls); cache.set(mk, m); }
  const baked = d.sprite === BALL_SPRITE;                                // la hoja ip20 ya trae esfera + criatura: se dibuja sola, sin teñir ni repintar la criatura (si no sale doble y de otro tamaño)
  const tint = baked ? null : it.comp.cls ? BALL_COLORS[it.comp.cls] : m && tintOf(g, sp, m);          // Dummy: la bola toma el color de su clase
  let src = g.spr.img[key], ox = sx, oy = sy;
  if (tint) {
    const ck = key + ":" + d.spriteFrame + ":" + sp + ":" + (it.comp.cls || "");
    let c = ballCache.get(ck);
    if (!c) {
      c = document.createElement("canvas"); c.width = w; c.height = h;
      const x2 = c.getContext("2d"); x2.drawImage(g.spr.img[key], sx, sy, w, h, 0, 0, w, h);
      x2.globalCompositeOperation = "source-atop"; x2.globalAlpha = it.comp.cls ? 0.85 : 0.6; x2.fillStyle = tint; x2.fillRect(0, 0, w, h);
      ballCache.set(ck, c);
    }
    src = c; ox = 0; oy = 0;
  }
  const cx = x + px + w / 2, cy = y + py + h / 2;
  const gray = !!it.comp.down;                       // compañero caído: la bola se ve en escala de grises hasta revivirlo
  if (gray) g.ctx.filter = "grayscale(1) brightness(.8)";
  if (alpha !== 1) g.ctx.globalAlpha = alpha;
  g.ctx.drawImage(src, ox, oy, w, h, cx - w * scale / 2, cy - h * scale / 2, w * scale, h * scale);
  if (alpha !== 1) g.ctx.globalAlpha = 1;
  if (m) {
    const f = g.spr.frame(m.key, m.f);
    if (!f) { if (gray) g.ctx.filter = "none"; return; }
    if (!g.spr.ready(m.key)) { g.spr.img[m.key]; if (gray) g.ctx.filter = "none"; return; }
    const [mx, my, mw, mh] = f, k = Math.min(1, BALL_INNER * w * scale / Math.max(mw, mh));
    g.ctx.imageSmoothingEnabled = true; g.ctx.imageSmoothingQuality = "high";
    g.ctx.drawImage(g.spr.img[m.key], mx, my, mw, mh, cx - mw * k / 2, cy - mh * k / 2, mw * k, mh * k);
  }
  if (gray) g.ctx.filter = "none";
  if (it.comp.on) g.text(x + px, y + py + 10, "★", "#ffd34d", { shadow: true, size: 11 });
}
// bola centrada en (cx, cy) y de unos `size` px (filas de lista, tiendas): misma bola con su sprite dentro
export function drawBallIcon(g, it, d, key, cx, cy, size = 16) {
  const fr = g.spr.frame(key, d.spriteFrame); if (!fr) return;
  const [, , w, h, px, py] = fr, sc = size / Math.max(w, h);
  drawBall(g, it, d, key, cx - px - w / 2, cy - py - h / 2, 1, sc);
}
