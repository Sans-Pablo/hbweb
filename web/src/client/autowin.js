// MENÚ AUTO (INVENTO del port; el original no trae modo automático): ventana del lienzo (window.js) con dos pestañas.
//   Caza: elige zona (spawns de la granja) y criatura; muestra su sprite de ataque en las 8 direcciones y su ficha (NPC.cfg + botín).
//         «Empezar» llama a controller.setAuto({kind:"hunt", mob, zone}) (shared/systems/autoplay.js): corre a la zona, caza y recoge;
//         con la mochila llena vuelve a la granja y termina el ciclo (vaciar en el almacén y repetir: pendiente).
//   Ir:   granja, almacén, tienda, herrería, mago, granjero, hospital y hechicero de mascotas: entra al edificio y abre el diálogo.
import { Win, THEME } from "./window.js";
import { MiniWin } from "./miniwin.js";
import { mobSprite } from "./anim.js";
import { ACT } from "../shared/const.js";
import { t } from "./i18n.js";
import { PLACES, cityOf, DEFAULT_RULES } from "../shared/systems/autoplay.js";
import { dropInfo } from "../shared/drops.js";

export const AUTO_ID = 74, AUTO_MINI_ID = 75;
const GO = ["farm", "warehouse", "shop", "smith", "mage", "farmer", "hospital", "petmage"];
const RARITY = ["Normal", "Mágico", "Raro", "Único"], ACTIONS = { ignore: "ignorar", sell: "vender", store: "guardar" }, NEXT = { ignore: "sell", sell: "store", store: "ignore" };
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const CHANGE_MS = 1800;                                   // cada cuánto gira el modelo a la siguiente dirección

export class AutoWin extends Win {
  constructor(api) { super({ id: AUTO_ID, title: "Menú automático", w: 460, h: 470, x: 170, y: 40 }); this.api = api; this.tab = "hunt"; this.zi = 0; this.mi = 0; this.nopick = false; this.potions = true; this.rules = [...DEFAULT_RULES]; }
  // arranca la caza; la mini ventana (contador) se abre sola y sigue la misma orden aunque termine
  startHunt(z) {
    const a = { kind: "hunt", mob: z.name, zone: { map: cityOf({ side: this.side }).farm, rect: z.rect }, nopick: this.nopick, potions: this.potions, rules: [...this.rules], kills: 0, exp: 0, t0: performance.now(), pit: z.id };
    this.api.start(a); this.g?.open(AUTO_MINI_ID);
    if (this.mini) this.mini.run = a;
  }
  // v0.85.82 (obs. 43): cada bando caza en su granja; las zonas salen de los spawns del mapa de esa ciudad (Aresden: arefarm.spawns.json; Elvine: maps/elvfarm.json)
  zones() {                                                 // zonas = spawns agrupados por criatura (id/rect del JSON de la granja)
    const sp = this.side === 2 ? this.api.citySpawns?.("elvfarm") : this.api.spawns();
    return (sp || []).filter(s => s.name && this.api.npcDb[s.name]);
  }
  body(ui, me, world) {
    this.side = me?.side === 2 ? 2 : 1;
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
    ui.para(I.x, I.y + 206, I.w, this.side === 2 ? "Almacén, tienda y herrería se alcanzan desde la granja de Elvine." : "Almacén, tienda y herrería se alcanzan desde la granja de Aresden.", THEME.txt, { size: 11 });
  }
  hunt(ui, me, I, on) {
    const zs = this.zones(), api = this.api;
    if (!zs.length) { ui.para(I.x, I.y + 40, I.w, "Esta cuenta no tiene zonas de caza disponibles.", THEME.txt); return; }
    this.zi = Math.min(this.zi, zs.length - 1);
    const z = zs[this.zi], cfg = api.npcDb[z.name];
    ui.text(I.x, I.y + 36, this.side === 2 ? "Mapa: Granja de Elvine" : "Mapa: Granja de Aresden", THEME.head);
    ui.text(I.x, I.y + 56, "Zona", THEME.txt);
    ui.btn(I.x + 44, I.y + 52, 24, "<", () => { this.zi = (this.zi + zs.length - 1) % zs.length; });
    ui.text(I.x + 76, I.y + 56, (this.zi + 1) + "/" + zs.length + "  " + pitName(z) + " (" + z.rect.join(",") + ")", THEME.txt);
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
    // qué hacer con cada objeto del suelo según su rareza: ignorar (se queda), vender (tienda al llenarse la mochila) o guardar (almacén)
    ui.text(I.x, I.y + I.h - 94, "Objetos del suelo según su rareza", THEME.head);
    RARITY.forEach((r, i) => ui.btn(I.x + i * 109, I.y + I.h - 76, 103, t(r) + ": " + t(ACTIONS[this.rules[i]]), () => { this.rules[i] = NEXT[this.rules[i]]; }));
    ui.check(I.x, I.y + I.h - 48, "No recoger objetos", this.nopick, v => { this.nopick = v; });
    ui.check(I.x + 200, I.y + I.h - 48, "Tomar pociones con poca vida", this.potions, v => { this.potions = v; });
    ui.btn(I.x, I.h - 22 + I.y, 150, on ? "Reiniciar caza" : "Empezar", () => this.startHunt(z), { primary: true });
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
// nombre del pozo (zona de aparición): su número del fichero de spawns más la criatura, p. ej. «Pozo 3 · Slime»
const pitName = z => t("Pozo") + " " + z.id + " · " + z.name;

// Experiencia ganada desde el inicio de la caza: se mide por fotograma con la experiencia del jugador (no depende del evento «exp», que
// no llega en todos los modos) y suma lo que faltaba del nivel anterior si sube de nivel. Lo llama main.js cada fotograma.
export function trackExp(a, me) {
  if (!a || a.kind !== "hunt" || !me) return;
  const p = a.xp;
  if (p) a.exp = (a.exp || 0) + (me.level > p.level ? Math.max(0, p.next - p.exp) + me.exp : Math.max(0, me.exp - p.exp));
  a.xp = { level: me.level, exp: me.exp, next: me.nextExp };
}

// Mini ventana del auto hunt (formato común de miniwin.js): criatura, pozo, muertes, tiempo, ritmo y experiencia. Sigue la orden `run`
// (la de la caza actual o la última); parada, ofrece «Reiniciar» para repetir la misma caza.
export class AutoMini extends MiniWin {
  constructor(api) { super({ id: AUTO_MINI_ID, title: "Auto hunt", x: 560, y: 60 }); this.api = api; this.run = null; }
  restart(a) {
    const b = { ...a, rules: [...(a.rules || DEFAULT_RULES)], kills: 0, exp: 0, xp: null, t0: performance.now(), t1: 0 };
    this.api.start(b); this.run = b;
  }
  // «Continuar»: retoma la misma caza conservando muertes, experiencia y tiempo acumulado (el reloj no corre mientras estuvo detenida)
  resume(a) {
    const now = performance.now(), b = { ...a, xp: null, t0: a.t0 + (a.t1 ? now - a.t1 : 0), t1: 0, idle: null, full: false, said: false };
    this.api.start(b); this.run = b;
  }
  rows() {
    const ctl = this.api.ctl(), a = ctl.auto?.kind === "hunt" ? ctl.auto : this.run;
    if (ctl.auto?.kind === "hunt") this.run = a;
    if (!a) return [{ k: "text", text: "Sin caza activa. Empieza una desde el menú AUTO." }];
    const on = ctl.auto === a, secs = Math.max(1, Math.round((on ? performance.now() : (a.t1 ||= performance.now())) - a.t0) / 1000), k = a.kills || 0;
    const mm = Math.floor(secs / 60), ss = String(Math.floor(secs % 60)).padStart(2, "0");
    return [
      { k: "head", text: a.mob + (a.pit ? "  (" + t("Pozo") + " " + a.pit + ")" : "") },
      { k: "kv", label: "Muertes", value: String(k), color: THEME.head, bold: true },
      { k: "kv", label: "Tiempo", value: mm + ":" + ss },
      { k: "kv", label: "Ritmo", value: (k * 3600 / secs).toFixed(0) + " /h" },
      { k: "kv", label: "Experiencia", value: "+" + (a.exp || 0), color: THEME.head, bold: true },
      { k: "kv", label: on ? (a.nopick ? "Cazando (sin recoger)" : "Cazando") : "Detenido", value: "", color: on ? THEME.txt : THEME.bad },
      ...(on ? [] : [{ k: "btn", label: "Continuar", fn: () => this.resume(a), primary: true }, { k: "btn", label: "Reiniciar", fn: () => this.restart(a) }]),
    ];
  }
}
export function registerAutoWin(gui, api) { const w = new AutoWin(api), m = new AutoMini(api); w.mini = m; gui.register(w); gui.register(m); return w; }
