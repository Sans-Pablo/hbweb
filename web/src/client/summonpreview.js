// Vista previa de un summon antes de comprar su bola en el hospital de compañeros (INVENTO del port): estadísticas, hechizos,
// una leyenda corta y, abajo, las siluetas de sus evoluciones (¿quién es ese Pokémon?) para anunciar que hay más al llegar al nivel máximo.
import { ClassicDialog, INK, DARK, RED, WHITE } from "./classicdialog.js";
import { infoOf } from "../shared/systems/summoninfo.js";
import { HOSPITAL, TASTE } from "../shared/systems/companion.js";
import { mobSprite, DUMMY_SPRITE } from "./anim.js";
import { DUMMY_NAMES } from "../shared/systems/talents.js";
import { ACT } from "../shared/const.js";
import { t } from "./i18n.js";

const BUY = { x: 14, y: 264, w: 150, h: 18 };
const SCALES = [0.62, 0.74, 0.87, 1];                       // crecimiento aproximado de las etapas (renderer.js)

export function registerSummonPreview(gui, api) {
  const dlg = new class extends ClassicDialog {
    constructor() { super({ id: 45, title: "Summon", footer: "" }); this.sp = null; this.npc = null; }
    show(sp, npc, cls) { this.sp = sp; this.npc = npc; this.cls = cls || null; this.title = DUMMY_NAMES[cls] || sp.replace(/-/g, " "); gui.open(45); }
    // sprite de reposo de la especie, escalado para caber en `box` y anclado a los pies (ax, ay); `sil`: solo silueta
    sprite(g, sp, ax, ay, box, k = 1, sil = false, cls = null) {
      const cfg = api.npc(sp); if (!cfg || !g.spr) return;
      for (let i = 0; i < 40; i++) api.want?.((DUMMY_SPRITE[cls] || (sp === "Dummy" ? "usorceress" : cfg.sprite)) + i);
      const e = { kind: "npc", comp: sp === "Dummy", type: cfg.type, cfg, dcls: cls, dir: 5, act: ACT.STOP, actStart: 0, actDur: 0, phase: 0, dur: { stopFrame: 200 } };
      const { key, f } = mobSprite(e, 0, n => g.spr.frames(n)), fr = g.spr.frame(key, f);
      if (!fr || !g.spr.ready(key)) return;
      const [sx, sy, w, h, px, py] = fr, s = Math.min(1.4, box / Math.max(w, h, 20)) * k, c = g.ctx;
      if (sil) { c.filter = "brightness(0)"; c.globalAlpha = 0.72; }
      c.drawImage(g.spr.img[key], sx, sy, w, h, ax + px * s, ay + py * s, w * s, h * s);
      if (sil) { c.filter = "none"; c.globalAlpha = 1; }
    }
    drawBody(g, me, lx, ly) {
      if (!this.sp || !me) return;
      const i = infoOf(me, this.sp, api.magic), X = 112, W = this.w - 24, a = (v, b) => v + " → " + b;
      g.ctx.fillStyle = "rgba(0,0,0,.15)"; g.ctx.beginPath(); g.ctx.ellipse(58, 100, 26, 7, 0, 0, 7); g.ctx.fill();
      this.sprite(g, this.sp, 58, 100, 50, 1, false, this.cls);
      g.text(X, 60, i.schoolName ? t("Escuela") + ": " + t(i.schoolName) : t("Combatiente"), RED, { size: 11, bold: true });
      g.text(X, 74, t("Vida") + " " + a(i.lo.hp, i.hi.hp), INK, { size: 10 });
      g.text(X, 86, t("Daño") + " " + a(i.lo.dmg, i.hi.dmg), INK, { size: 10 });
      g.text(X, 98, t("Maná") + " " + a(i.lo.mp, i.hi.mp), INK, { size: 10 });
      g.text(X - 80, 108, t("Nivel 1 → nivel 50"), DARK, { size: 9 });
      g.text(14, 122, t("Habilidades"), DARK, { size: 10, bold: true });
      if (!i.spells.length) g.text(14, 135, t("Pelea cuerpo a cuerpo y comparte tu experiencia."), INK, { size: 10 });
      else {
        const shown = i.spells.slice(0, 6);
        shown.forEach((s, n) => g.text(14 + (n % 2) * 118, 135 + Math.floor(n / 2) * 11, "Lv" + s.lvl + " " + s.name, INK, { size: 9 }));
        if (i.spells.length > 6) g.text(this.w - 70, 157, "+" + (i.spells.length - 6) + " " + t("más"), DARK, { size: 9 });
      }
      this.wrap(g, t(i.lore), W, 10).slice(0, 3).forEach((l, n) => g.text(14, 172 + n * 11, l, INK, { size: 10 }));
      g.text(14, 207, t("Evoluciones"), DARK, { size: 10, bold: true });
      const cols = i.evo.stages.map((s, n) => ({ sp: s.sp, k: SCALES[n], lbl: "Lv" + s.lvl })).concat(i.evo.tier2 ? [{ sp: i.evo.tier2.sp, k: 1.1, lbl: "Lv" + i.evo.tier2.lvl + " ★", mystery: true }] : []);
      const pitch = Math.floor(W / cols.length);
      cols.forEach((c, n) => {
        const cx = 14 + pitch * n + pitch / 2;
        this.sprite(g, c.sp, cx, 244, 30, c.k, true);
        if (c.mystery) g.aligned(cx - 12, cx + 12, 226, "?", WHITE, { size: 14, bold: true });
        g.aligned(cx - pitch / 2, cx + pitch / 2, 247, c.lbl, DARK, { size: 8 });
      });
      { const ts = TASTE[this.sp], nm = ids => ids.map(id => api.item?.(id)?.name || id).join(", ");
        if (ts) g.text(14, 253, t("Le gusta") + ": " + nm(ts.love) + (ts.hate.length ? "  ·  " + t("No come") + ": " + nm(ts.hate) : ""), "#2f7a2f", { size: 8 }); }
      const over = this.inBuy(lx, ly);
      g.ctx.fillStyle = over ? "#7a5a30" : "#5a4020"; g.ctx.fillRect(BUY.x, BUY.y, BUY.w, BUY.h);
      g.ctx.strokeStyle = "#e8d6a0"; g.ctx.strokeRect(BUY.x + 0.5, BUY.y + 0.5, BUY.w - 1, BUY.h - 1);
      g.aligned(BUY.x, BUY.x + BUY.w, BUY.y + 3, t("Comprar bola") + " · " + HOSPITAL.ballPrice, WHITE, { size: 11, bold: true });
    }
    inBuy(lx, ly) { return lx >= BUY.x && lx <= BUY.x + BUY.w && ly >= BUY.y && ly <= BUY.y + BUY.h; }
    click(g, lx, ly, me) {
      if (this.inBuy(lx, ly)) { api.send({ t: "petbuy", npc: this.npc, sp: this.sp, cls: this.cls }); g.close(this.id); return true; }
      return super.click(g, lx, ly, me);
    }
  }();
  gui.register(dlg);
  return dlg;
}
