// Icono de las bolas de compañero: un sprite pequeño de la especie (reposo, de frente) sobre la bola de Item.cfg.
import { mobSprite } from "./anim.js";
import { ACT } from "../shared/const.js";
let NPC = {};
export const setNpcDb = db => { NPC = db || {}; };
const cache = new Map();
export function miniOf(sp, frames) {
  const cfg = NPC[sp]; if (!cfg) return null;
  const e = { kind: "npc", type: cfg.type, cfg, dir: 5, act: ACT.STOP, actStart: 0, actDur: 0, phase: 0, dur: { stopFrame: 200 } };
  return mobSprite(e, 0, frames);
}
// dibuja el sprite pequeño; (x, y) = origen del fotograma de la bola, fr = su fotograma [sx,sy,w,h,px,py]
export function drawMini(g, it, x, y, fr, size = 24) {
  if (!it.comp || !g.spr) return;
  let m = cache.get(it.comp.sp);
  if (!m) { m = miniOf(it.comp.sp, k => g.spr.frames(k)); cache.set(it.comp.sp, m); }
  if (!m) return;
  const f = g.spr.frame(m.key, m.f); if (!f) { g.spr.want?.(m.key); return; }
  if (!g.spr.ready(m.key)) { g.spr.has(m.key) && g.spr.img[m.key]; return; }
  const [sx, sy, w, h, px, py] = f, k = Math.min(1, size / Math.max(w, h));
  const cx = x + (fr ? fr[4] + fr[2] / 2 : 0), cy = y + (fr ? fr[5] + fr[3] / 2 : 0);
  g.ctx.drawImage(g.spr.img[m.key], sx, sy, w, h, cx - w * k / 2, cy - h * k / 2, w * k, h * k);
}
