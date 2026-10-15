// MENÚ AUTO (INVENTO del port; el original no trae modo automático): ventana del lienzo (window.js) con dos pestañas.
//   Caza: elige zona (spawns de la granja) y criatura; muestra su sprite de ataque en las 8 direcciones y su ficha (NPC.cfg + botín).
//         «Empezar» llama a controller.setAuto({kind:"hunt", mob, zone}) (shared/systems/autoplay.js): corre a la zona, caza y recoge;
//         con la mochila llena vuelve a la granja y termina el ciclo (vaciar en el almacén y repetir: pendiente).
//   Ir:   granja, almacén, tienda, herrería, mago, granjero, hospital y hechicero de mascotas: entra al edificio y abre el diálogo.
import { Win, THEME } from "./window.js";
import { mobSprite } from "./anim.js";
import { ACT } from "../shared/const.js";
import { t } from "./i18n.js";
import { PLACES, FARM } from "../shared/systems/autoplay.js";
import { dropInfo } from "../shared/drops.js";

export const AUTO_ID = 74;
const GO = ["farm", "warehouse", "shop", "smith", "mage", "farmer", "hospital", "petmage"];
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const CHANGE_MS = 1800;                                   // cada cuánto gira el modelo a la siguiente dirección

export class AutoWin extends Win {
  constructor(api) { super({ id: AUTO_ID, title: "Menú automático", w: 460, h: 420, x: 170, y: 50 }); this.api = api; this.tab = "hunt"; this.zi = 0; this.mi = 0; }
  zones() {                                                 // zonas = spawns agrupados por criatura (id/rect del JSON de la granja)
    return (this.api.spawns() || []).filter(s => s.name && this.api.npcDb[s.name]);
  }
  body(ui, me, world) {
    const I = this.inner, api = this.api, on = api.ctl().auto;
    ui.btn(I.x, I.y, 100, "Cazar", () => { this.tab = "hunt"; }, { active: this.tab === "hunt" });
    ui.btn(I.x + 106, I.y, 100, "Ir a…", () => { this.tab = "go"; }, { active: this.tab === "go" });
    if (on) ui.btn(I.x + I.w - 110, I.y, 110, "Parar", () => { api.ctl().setAuto(null); api.log(["Modo automático detenido.", "Auto mode stopped."]); }, { color: THEME.bad });
    ui.rule(I.x, I.y + 26, I.w);
    this.tab === "hunt" ? this.hunt(ui, me, I, on) : this.go(ui, me, I);
  }
  go(ui, me, I) {
    ui.para(I.x, I.y + 36, I.w, "Corre hasta el sitio, entra en el edificio si hace falta y abre su diálogo. Un clic cancela.", THEME.txt);
    const api = this.api;
    GO.forEach((k, i) => ui.btn(I.x + (i % 2) * 215, I.y + 76 + Math.floor(i / 2) * 30, 205, PLACES[k].es[0].toUpperCase() + PLACES[k].es.slice(1), () => api.start({ kind: "run", place: k })));
    ui.para(I.x, I.y + 206, I.w, "Almacén, tienda y herrería se alcanzan desde la granja de Aresden.", THEME.txt, { size: 11 });
  }
  hunt(ui, me, I, on) {
    const zs = this.zones(), api = this.api;
    if (!zs.length) { ui.para(I.x, I.y + 40, I.w, "Esta cuenta no tiene zonas de caza disponibles.", THEME.txt); return; }
    this.zi = Math.min(this.zi, zs.length - 1);
    const z = zs[this.zi], cfg = api.npcDb[z.name];
    ui.text(I.x, I.y + 36, "Mapa: Granja de Aresden", THEME.head);
    ui.text(I.x, I.y + 56, "Zona", THEME.txt);
    ui.btn(I.x + 44, I.y + 52, 24, "<", () => { this.zi = (this.zi + zs.length - 1) % zs.length; });
    ui.text(I.x + 76, I.y + 56, (this.zi + 1) + "/" + zs.length + "  " + z.name + " (" + z.rect.join(",") + ")", THEME.txt);
    ui.btn(I.x + I.w - 24, I.y + 52, 24, ">", () => { this.zi = (this.zi + 1) % zs.length; });
    // sprite animado: ataque en las 8 direcciones
    const bx = I.x, by = I.y + 84, bw = 170, bh = 150, c = ui.c;
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(bx, by, bw, bh); c.strokeStyle = THEME.line; c.strokeRect(bx + .5, by + .5, bw - 1, bh - 1);
    this.model(ui, cfg, z.name, bx + bw / 2, by + bh - 40);
    // ficha
    const hd = cfg.hitDice, hp = hd <= 5 ? 2 * hd + "–" + 5 * hd : 5 * hd + 1 + "–" + 6 * hd, d = dropInfo(cfg.type);
    const names = d.items.slice(0, 8).map(id => api.itemName(id)).join(", ");
    let x = I.x + 182, y = by;
    const row = (k, v, col) => { ui.text(x, y, k, THEME.head); ui.text(x + 92, y, v, col || THEME.txt); y += 16; };
    row("Criatura", z.name); row("Vida (aprox.)", hp); row("Daño", cfg.attackDiceThrow + "d" + cfg.attackDiceRange);
    row("Experiencia", cfg.expMin + "–" + cfg.expMax); row("Nivel de botín", d.gen ? String(d.gen) : "—");
    row("Oro", cfg.goldMin + "–" + cfg.goldMax); row("Apariciones", String(z.max));
    ui.head(I.x, by + bh + 8, "Botín posible");
    ui.para(I.x, by + bh + 26, I.w, d.items.length ? names + (d.weak ? " (" + "suelta poco" + ")" : "") : "Casi nada", THEME.txt, { size: 11 });
    ui.para(I.x, I.y + I.h - 52, I.w, "Corre a la zona, caza, recoge el botín y, con la mochila llena, vuelve a la granja y termina.", THEME.txt, { size: 11 });
    ui.btn(I.x, I.h - 22 + I.y, 150, on ? "Reiniciar caza" : "Empezar", () => api.start({ kind: "hunt", mob: z.name, zone: { map: FARM, rect: z.rect } }), { primary: true });
  }
  // criatura atacando, girando por las 8 direcciones (misma ruta de dibujo que summonpreview.js)
  model(ui, cfg, name, ax, ay) {
    const g = ui.g, t = performance.now(), dir = Math.floor(t / CHANGE_MS) % 8 + 1, api = this.api;
    if (!g.spr) return;
    for (let i = 0; i < 40; i++) api.want(cfg.sprite + i);
    const dur = 600, start = t - (t % dur), e = { kind: "npc", type: cfg.type, cfg, dir, act: ACT.ATTACK, actStart: start, actDur: dur, phase: 0, dur: { stopFrame: 200 } };
    const { key, f } = mobSprite(e, t, n => g.spr.frames(n)), fr = g.spr.frame(key, f);
    ui.text(ax - 6, ay + 44, DIRS[dir - 1], THEME.txt);
    if (!fr || !g.spr.ready(key)) return;
    const [sx, sy, w, h, px, py] = fr, s = Math.min(1.4, 110 / Math.max(w, h, 20)), c = ui.c;
    c.drawImage(g.spr.img[key], sx, sy, w, h, ax + px * s, ay + py * s, w * s, h * s);
  }
}
export function registerAutoWin(gui, api) { const w = new AutoWin(api); gui.register(w); return w; }
