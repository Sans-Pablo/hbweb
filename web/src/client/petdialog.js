// Cuadro «Summons» (F10 y botón de la barra, entre Personaje y Mochila): todo lo de la bola/compañero en un sitio.
// Pestañas: Info (nombre, modo, hechizos, reinicio) y las 3 ramas de talentos (shared/systems/talents.js). INVENTO del port.
import { ClassicDialog, INK, RED } from "./classicdialog.js";
import * as Tal from "../shared/systems/talents.js";
import * as Sch from "../shared/systems/schools.js";
import { activeBall, statsOf, hpOf, need, MAX_COMP_LEVEL } from "../shared/systems/companion.js";
import { mobSprite } from "./anim.js";
import { ACT, mobDurations } from "../shared/const.js";

const BUTTONS = [["summons_icon", "Info", "Name, mode, spells and talent reset."], ["pet_support", "Support", "Support talents: healing and protection."], ["pet_damage", "Damage", "Damage talents: more attack power."], ["pet_warrior", "Warrior", "Warrior talents: more health and defence."]];
const DUMMY_HINTS = ["Healer (green): Heal, Great Heal. The first spell you learn fixes the class.", "Buffer (yellow): shields, Protection From Magic, Berserk.", "Aura (blue): regeneration, experience, defence and mana auras."];
const BX = 14, BY = 108, BPITCH = 52;

export function registerPetDialog(gui, api) {
  const dlg = new class extends ClassicDialog {
    constructor() { super({ id: 43, title: "Summons", tabs: [], rowH: 20, top: 156, visible: 5 }); this.mx = 24; }
    ball(me) { return me && (activeBall(me) || me.bag.find(i => i.comp)); }
    rows(me) {
      const b = this.ball(me); if (!b) return [];
      const c = b.comp;
      if (this.tab === 0) {
        const out = [
          { act: "rename", text: "Rename", right: "", tip: "Opens the chat with /petname so you can type the new name." },
          Tal.isDummy(c)
            ? { act: "mode", text: "Mode", right: c.mode === "peace" ? "Stay" : "Follow", tip: "Click to switch between Stay (it holds its position) and Follow." }
            : { act: "mode", text: "Mode", right: c.mode === "peace" ? "Peace" : "Attack", tip: "Click to switch between Peace and Attack." },
          { act: "reset", text: "Reset talents", right: String(Tal.resetCost(c)), tip: "Only near the pet nurse (Gail, in the Shop). Costs gold." },
        ];
        const sc = Sch.schoolOfSpecies(c.sp);
        if (sc) out.push({ act: "school", text: "School: " + Sch.SCHOOL_NAMES[sc], right: "MP " + (c.mp ?? Tal.maxMp(c)) + "/" + Tal.maxMp(c), color: RED, tip: "Casts your " + Sch.SCHOOL_NAMES[sc] + " attack spells with its own mana. No natural regeneration: feed it Blue Candies." + (Sch.TIER2[c.sp] ? " At level " + Sch.TRADE_LEVEL + " it can evolve into a " + Sch.TIER2[c.sp] + " at the pet nurse." : "") });
        else if (!Tal.isDummy(c)) out.push({ act: "school", text: "General school", right: "combat", tip: "Combat summon only: it casts no magic." });
        for (const t of Tal.TALENTS) if (t.spell != null && Tal.rankOf(c, t.id) > 0) out.push({ act: "spell", text: t.name, right: "spell", color: RED, tip: t.desc });
        return out;
      }
      const br = Tal.branchesOf(c)[this.tab - 1];
      return Tal.TALENTS.filter(t => t.br === br).map(t => {
        const r = Tal.rankOf(c, t.id);
        if (t.dummy) {
          const lockCls = c.cls && c.cls !== br, lockLvl = t.lvl && c.lvl < t.lvl;
          return { id: t.id, text: t.name + (t.spell != null ? " *" : ""), right: lockLvl ? "Lv " + t.lvl : r + "/" + t.max, color: lockCls || lockLvl ? "#5a4636" : r >= t.max ? RED : null, tip: t.desc + (lockCls ? " (this Dummy is already another class)" : lockLvl ? " (needs level " + t.lvl + ")" : "") };
        }
        const locked = Tal.spent(c, br) < Tal.TIER_COST * t.tier;
        return { id: t.id, text: t.name + (t.spell != null ? " *" : ""), right: r + "/" + t.max, color: locked ? "#5a4636" : r >= t.max ? RED : null, tip: t.desc + (locked ? " (needs " + Tal.TIER_COST * t.tier + " points in this branch)" : "") };
      });
    }
    // Cabecera: el monstruo caminando (sprite original de su especie) con su nombre debajo, nivel, vida y experiencia a la derecha
    drawBody(g, me, lx, ly) {
      const b = this.ball(me);
      if (!b) { g.aligned(0, this.w, 130, "You have no companion ball.", INK); return; }
      const c = b.comp, sp = Tal.spec(c), p = api.me(), cfg = api.npc?.(c.sp);
      this.walker(g, cfg, c, 56, 85);
      g.aligned(this.mx - 8, 104, 99, c.nm || c.sp, INK, { size: 10, bold: true });
      const X = 112;
      g.text(X, 44, "Level " + c.lvl + (c.lvl >= MAX_COMP_LEVEL ? " (max)" : ""), INK, { size: 11, bold: true });
      g.text(X, 58, "HP " + (p ? hpOf(p, c) + "/" + statsOf(p, c).hp : ""), INK, { size: 10 });
      const nd = need(c.lvl || 1), k = c.lvl >= MAX_COMP_LEVEL ? 1 : Math.max(0, Math.min(1, (c.exp || 0) / nd)), cx = g.ctx, bw = this.w - X - 26;
      cx.fillStyle = "rgba(10,8,4,.75)"; cx.fillRect(X - 1, 72, bw + 2, 9); cx.fillStyle = "#6aa8ff"; cx.fillRect(X, 73, Math.round(bw * k), 7);
      g.text(X, 84, c.lvl >= MAX_COMP_LEVEL ? "EXP MAX" : "EXP " + (c.exp || 0) + " / " + nd + "  (" + Math.floor(k * 100) + "%)", INK, { size: 9 });
      g.text(X, 96, "Points: " + Tal.pointsFree(c) + "  " + (sp ? Tal.branchName(c, sp) : Tal.isDummy(c) ? "No class" : "No specialty"), INK, { size: 9 });
      BUTTONS.forEach(([key, , ], i) => {
        const x = BX + i * BPITCH, over = lx >= x && lx < x + 37 && ly >= BY && ly < BY + 41;
        g.put(key, over || this.tab === i ? 1 : 0, x, BY);
      });
    }
    // sprite en marcha: fotograma de la hoja de movimiento de la especie, escalado para caber en 64x60 y anclado a los pies
    walker(g, cfg, c, ax, ay) {
      if (!cfg || !g.spr) return;
      const D = mobDurations(cfg.type), dur = Math.max(300, D.move), t = performance.now();
      const e = { kind: "npc", type: cfg.type, cfg, dir: 5, act: ACT.MOVE, actStart: Math.floor(t / dur) * dur, actDur: dur, phase: 0, dur: D };
      for (let k = 0; k < 40; k++) api.want?.(cfg.sprite + k);
      const { key, f } = mobSprite(e, t, k => g.spr.frames(k)), fr = g.spr.frame(key, f);
      if (!fr || !g.spr.ready(key)) { g.put("summons_icon", 0, ax - 18, ay - 44); return; }
      const st = mobSprite({ ...e, act: ACT.STOP }, 0, k => g.spr.frames(k)), sf = g.spr.frame(st.key, st.f) || fr;      // tamaño de referencia: el de reposo
      const s = Math.min(1.5, 60 / Math.max(sf[3], 20), 64 / Math.max(sf[2], 20)), [sx, sy, w, h, px, py] = fr, cx = g.ctx;
      cx.fillStyle = "rgba(0,0,0,.18)"; cx.beginPath(); cx.ellipse(ax, ay, 20, 6, 0, 0, 7); cx.fill();
      cx.drawImage(g.spr.img[key], sx, sy, w, h, ax + px * s, ay + py * s, w * s, h * s);
    }
    hintOver(lx, ly) {
      const c = this.ball(api.me())?.comp, dm = c && Tal.isDummy(c);
      for (let i = 0; i < BUTTONS.length; i++) { const x = BX + i * BPITCH; if (lx >= x && lx < x + 37 && ly >= BY && ly < BY + 41) return dm && i ? DUMMY_HINTS[i - 1] : BUTTONS[i][1] + ": " + BUTTONS[i][2]; }
      return "";
    }
    click(g, lx, ly, me) {
      for (let i = 0; i < BUTTONS.length; i++) { const x = BX + i * BPITCH; if (lx >= x && lx < x + 37 && ly >= BY && ly < BY + 41) { this.tab = i; this.view = 0; return true; } }
      return super.click(g, lx, ly, me);
    }
    pick(r, me) {
      const b = this.ball(me); if (!b) return;
      if (r.act === "rename") api.action("petname");
      else if (r.act === "mode") api.action("petmode");
      else if (r.act === "reset") api.send({ t: "talreset", uid: b.uid, npc: api.nurse?.()?.id });
      else if (r.id) api.send({ t: "talent", uid: b.uid, talent: r.id });
    }
  }();
  gui.register(dlg);
  return dlg;
}
