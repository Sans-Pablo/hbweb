// Hechicero de mascotas (rol "petmage"): menú propio para enseñar hechizos al summon de escuela y elegir el que lanza.
// Sistema aparte de la magia del jugador (libro, id 3): ver shared/systems/petgrimoire.js.
import { ClassicDialog } from "./classicdialog.js";
import { activeBall } from "../shared/systems/companion.js";
import * as PG from "../shared/systems/petgrimoire.js";
import { t } from "./i18n.js";

export const PETMAGE_DIALOG = 46;
const INK = "#2d1919", RED = "#c31919";

export function registerPetMage(gui, api) {
  const npc = { id: 0 };
  const dlg = new class extends ClassicDialog {
    constructor() { super({ id: PETMAGE_DIALOG, title: "Hechicero de mascotas", tabs: ["Enseñar", "Grimorio"], footer: "Hechizos de la escuela de tu summon." }); }
    ctx(me) {
      const ball = me && activeBall(me), c = ball?.comp, school = c && PG.schoolOf(c.sp), magic = api.magic();
      return { c, school, magic, ok: !!(c && school && magic) };
    }
    rows(me) {
      const { c, school, magic, ok } = this.ctx(me);
      if (!ok) return [];
      const ids = Object.keys(PG.catalog(magic, school)).map(Number);
      if (this.tab === 1) return PG.grimOf(c).map(id => ({ cast: id, text: magic[id].name.replace(/-/g, " "), right: PG.manaCost(magic, school, id) + " MP", tip: "Elegir y apuntar: lo lanza tu summon" }));
      return ids.map(id => {
        const need = PG.needLevel(magic, school, id, c.sp), known = PG.knows(c, id), lock = c.lvl < need;
        return { learn: id, text: magic[id].name.replace(/-/g, " ") + " · Lv " + need + " · Int " + PG.intNeeded(magic, school, id), right: known ? "✔" : PG.goldCost(magic, school, id),
          color: known ? "#1a6b1a" : lock ? "#5a4636" : null, tip: known ? "Tu summon ya la conoce" : lock ? "Tu summon necesita nivel " + need : "Comprar: " + PG.goldCost(magic, school, id) + " de oro" };
      }).sort((a, b) => PG.needLevel(magic, school, a.learn, c.sp) - PG.needLevel(magic, school, b.learn, c.sp));
    }
    drawBody(g, me) {
      const { c, school, ok } = this.ctx(me);
      if (!ok) { g.aligned(0, this.w, 120, t(c ? "Tu summon no es de escuela (fuego, hielo o rayo)." : "Saca una bola de summon de escuela."), INK); return; }
      g.text(14, 62, (c.nm || c.sp) + " · " + PG.SCHOOL_NAMES[school] + " · nv " + c.lvl, INK, { size: 10 });
      g.text(this.w - 44, 62, this.tab ? "MP" : "Oro", INK, { size: 10 });
    }
    pick(r) {
      if (r.cast != null) { gui.close(this.id); api.petCast(r.cast); }
      else if (r.learn != null) api.send({ t: "pgteach", npc: npc.id, spell: r.learn });
    }
  }();
  gui.register(dlg);
  return { open(e) { npc.id = e.id; dlg.tab = 0; dlg.view = 0; gui.open(PETMAGE_DIALOG); } };
}
