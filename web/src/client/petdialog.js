// Cuadro «Summons» (F10 y botón de la barra, entre Personaje y Mochila): todo lo de la bola/compañero en un sitio.
// Pestañas: Info (nombre, modo, hechizos, reinicio) y las 3 ramas de talentos (shared/systems/talents.js). INVENTO del port.
import { ClassicDialog, INK, RED } from "./classicdialog.js";
import * as Tal from "../shared/systems/talents.js";
import { activeBall, statsOf, hpOf, need, MAX_COMP_LEVEL } from "../shared/systems/companion.js";

export function registerPetDialog(gui, api) {
  const dlg = new class extends ClassicDialog {
    constructor() { super({ id: 43, title: "Summons", tabs: ["Info", "Support", "Damage", "Warrior"], rowH: 22, top: 98, visible: 7 }); }
    ball(me) { return me && (activeBall(me) || me.bag.find(i => i.comp)); }
    rows(me) {
      const b = this.ball(me); if (!b) return [];
      const c = b.comp;
      if (this.tab === 0) {
        const out = [
          { act: "rename", text: "Rename", right: "", tip: "Opens the chat with /petname so you can type the new name." },
          { act: "mode", text: "Mode", right: c.mode === "peace" ? "Peace" : "Attack", tip: "Click to switch between Peace and Attack." },
          { act: "reset", text: "Reset talents", right: String(Tal.resetCost(c)), tip: "Only near the pet nurse (Gail, in the Shop). Costs gold." },
        ];
        for (const t of Tal.TALENTS) if (t.spell != null && Tal.rankOf(c, t.id) > 0) out.push({ act: "spell", text: t.name, right: "spell", color: RED, tip: t.desc });
        return out;
      }
      const br = Tal.BRANCHES[this.tab - 1];
      return Tal.TALENTS.filter(t => t.br === br).map(t => {
        const r = Tal.rankOf(c, t.id), locked = Tal.spent(c, br) < Tal.TIER_COST * t.tier;
        return { id: t.id, text: t.name + (t.spell != null ? " *" : ""), right: r + "/" + t.max, color: locked ? "#5a4636" : r >= t.max ? RED : null, tip: t.desc + (locked ? " (needs " + Tal.TIER_COST * t.tier + " points in this branch)" : "") };
      });
    }
    drawBody(g, me) {
      const b = this.ball(me);
      if (!b) { g.aligned(0, this.w, 130, "You have no companion ball.", INK); return; }
      const c = b.comp, sp = Tal.spec(c), p = api.me();
      g.text(14, 62, (c.nm || c.sp) + "  lv " + c.lvl + (c.lvl >= MAX_COMP_LEVEL ? " (max)" : ""), INK, { size: 11, bold: true });
      const hp = p ? hpOf(p, c) + "/" + statsOf(p, c).hp : "";
      g.text(14, 78, "HP " + hp + "   Points: " + Tal.pointsFree(c) + "   " + (sp ? Tal.BRANCH_NAMES[sp] : "No specialty"), INK, { size: 10 });
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
