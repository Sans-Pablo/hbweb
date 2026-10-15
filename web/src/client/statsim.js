// Simulador de estadísticas (comando /stats, o botón en el cuadro de Level Up): reparte puntos de prueba y mira vida, maná, aguante y carga
// sin gastar nada. Lógica en shared/systems/statsim.js. Ventana del lienzo (window.js).
import { Win, THEME } from "./window.js";
import { KEYS, simulate, spent, bump, STAT_MAX, LEVEL_MAX } from "../shared/systems/statsim.js";

export const STATSIM_ID = 73;
let ctrl = false; if (typeof addEventListener === "function") { addEventListener("keydown", e => { ctrl = e.ctrlKey; }); addEventListener("keyup", e => { ctrl = e.ctrlKey; }); addEventListener("blur", () => { ctrl = false; }); }
const NAMES = { str: "Strength", vit: "Vitality", dex: "Dexterity", int: "Intelligence", mag: "Magic", chr: "Charisma" };
export class StatSimWin extends Win {
  constructor() { super({ id: STATSIM_ID, title: "Simulador de estadísticas", w: 400, h: 442, x: 200, y: 60 }); this.add = {}; this.free = false; this.lvl = 0; }
  opened() { this.add = {}; this.free = false; this.lvl = 0; }
  body(ui, me) {
    const I = this.inner, base = me.stats, lvl = this.lvl || me.level, budget = this.free ? Infinity : me.pool | 0;
    const cur = simulate(base, {}, me.level), sim = simulate(base, this.add, lvl);
    const left = budget - spent(this.add);
    ui.para(I.x, I.y, I.w, "Prueba cómo quedaría tu personaje sin gastar puntos. Ctrl = de 5 en 5.", THEME.txt);
    ui.text(I.x, I.y + 30, "Puntos sin gastar:", THEME.txt); ui.text(I.x + 130, I.y + 30, this.free ? "∞" : String(left), left > 0 || this.free ? THEME.good : THEME.txt, { bold: true });
    ui.check(I.x + 190, I.y + 29, "Sin límite", this.free, v => { this.free = v; if (!v) this.add = {}; });
    const step = () => (ctrl ? 5 : 1);
    let y = I.y + 62;
    ui.text(I.x + 110, y - 14, "Ahora", THEME.head); ui.text(I.x + 175, y - 14, "Prueba", THEME.head);
    for (const k of KEYS) {
      ui.text(I.x, y + 2, NAMES[k], THEME.txt); ui.text(I.x + 112, y + 2, String(base[k]), THEME.txt);
      ui.text(I.x + 177, y + 2, String(sim.stats[k]), (this.add[k] | 0) ? THEME.bad : THEME.txt, { bold: true });
      ui.btn(I.x + 225, y, 28, "−", () => bump(base, this.add, k, -step(), budget), { disabled: !(this.add[k] | 0) });
      ui.btn(I.x + 258, y, 28, "+", () => bump(base, this.add, k, step(), budget), { disabled: left <= 0 || base[k] + (this.add[k] | 0) >= STAT_MAX });
      y += 26;
    }
    ui.rule(I.x, y + 2, I.w); y += 12;
    ui.text(I.x, y + 2, "Nivel", THEME.txt); ui.text(I.x + 112, y + 2, String(me.level), THEME.txt); ui.text(I.x + 177, y + 2, String(lvl), lvl !== me.level ? THEME.bad : THEME.txt, { bold: true });
    ui.btn(I.x + 225, y, 28, "−", () => { this.lvl = Math.max(1, lvl - step()); }, { disabled: lvl <= 1 }); ui.btn(I.x + 258, y, 28, "+", () => { this.lvl = Math.min(LEVEL_MAX, lvl + step()); }, { disabled: lvl >= LEVEL_MAX });
    y += 30; ui.rule(I.x, y - 4, I.w);
    const row = (label, a, b) => { ui.text(I.x, y, label, THEME.txt); ui.text(I.x + 112, y, String(a), THEME.txt); ui.text(I.x + 177, y, String(b), b > a ? THEME.good : b < a ? THEME.bad : THEME.txt, { bold: true }); if (b !== a) ui.text(I.x + 225, y, (b > a ? "+" : "") + (b - a), b > a ? THEME.good : THEME.bad); y += 18; };
    row("HP", cur.hp, sim.hp); row("MP", cur.mp, sim.mp); row("SP", cur.sp, sim.sp); row("Carga", Math.floor(cur.load / 100), Math.floor(sim.load / 100));
    const by = this.h - 52; ui.btn(I.x, by, 110, "Reiniciar", () => { this.add = {}; this.lvl = 0; });
    ui.text(I.x + 122, by + 4, "Solo cuenta atributos base (sin equipo).", THEME.txt);
  }
}
export function registerStatSim(gui) { gui.register(new StatSimWin()); }
