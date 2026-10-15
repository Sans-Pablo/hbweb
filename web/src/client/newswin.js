// F1 dentro del juego: novedades, lista de pruebas, notas y herramientas de prueba (data/news.json + herramientas de prueba). Ventana del lienzo (window.js).
import { Win, Flow, THEME } from "./window.js";
import { getLang } from "./i18n.js";
import { SPECIES as ALL_SPECIES } from "../shared/systems/companion.js";

export const NEWS_ID = 70;
const KEY = "hbweb.tested";
const read = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
const write = s => { try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch {} };
const L = o => (o && (o[getLang()] || o.es)) || "";
const TABS = [["news", "Novedades", "News"], ["tools", "Herramientas", "Tools"]];
const KITS = {
  potions: [["RedPotion", 50], ["BluePotion", 50], ["GreenPotion", 50]], arrows: [["Arrow", 500]],
  dyes: [["Dye(Red)", 1], ["Dye(Blue)", 1], ["Dye(Green)", 1], ["ArmorDye(Red)", 1], ["ArmorDye(Blue)", 1], ["ArmorDye(Gold)", 1]],
  bone: [["SkeletonBones", 5]], manuals: [["ArcheryManual", 1]],
};
const SPECIES = Object.keys(ALL_SPECIES);

export class NewsWin extends Win {
  constructor() {
    super({ id: NEWS_ID, title: "Novedades y pruebas", w: 580, h: 530, x: 110, y: 8 });
    this.tab = "news"; this.data = null; this.done = read();
    fetch("data/news.json", { cache: "no-cache" }).then(r => r.json()).then(d => { this.data = d; }).catch(() => {});
  }
  opened() { this.done = read(); }
  send(c) { window.hbDev?.send({ t: "dbg", ...c }); }

  body(ui) {
    const d = this.data, lang = getLang(), I = this.inner, w = I.w;
    if (!d) { ui.text(I.x, I.y, "Cargando…", THEME.dim); return; }
    ui.text(I.x, I.y, L(d.build), THEME.head, { bold: true, shadow: true });
    const ih = ui.para(I.x, I.y + 16, w, L(d.intro), THEME.txt);
    const ty = I.y + 20 + ih; let tx = I.x;
    for (const [k, es, en] of TABS) {
      const label = lang === "en" ? en : es, bw = Math.max(90, Math.ceil(ui.tw(label)) + 24);
      ui.btn(tx, ty, bw, label, () => { this.tab = k; this.blur(); }, { active: this.tab === k });
      tx += bw + 4;
    }
    this.q = ui.search("q", I.x + w - 170, ty, 170);                 // buscador (ticket 3): filtra las novedades por texto
    const sy = ty + 28, sh = I.y + I.h - sy;
    ui.scroll(this.tab, I.x, sy, w, sh, (u, cw) => this["tab_" + this.tab](u, cw));
  }
  tab_news(u, cw) {
    let y = 0;
    const q = this.q, hit = s => !q || L(s).toLowerCase().includes(q);
    for (const n of this.data.news) {
      if (q && !hit(n.title) && !n.items.some(hit)) continue;
      u.head(0, y, L(n.title)); u.text(cw - u.tw(n.date), y, n.date, THEME.dim); y += 18;
      for (const i of n.items) { if (q && !hit(i) && !hit(n.title)) continue; u.text(4, y, "•", THEME.head); y += u.para(16, y, cw - 16, L(i)) + 2; }
      y += 8;
    }
    return y;
  }
  tab_notes(u, cw) {
    let y = 0;
    for (const n of this.data.notes) { u.text(4, y, "•", THEME.head); y += u.para(16, y, cw - 16, L(n)) + 4; }
    return y;
  }
  tab_tests(u, cw) {
    const d = this.data, ok = d.tests.filter(t => this.done.has(t.id)).length;
    let y = 0, group = null;
    u.text(0, y, `${ok}/${d.tests.length}`, ok === d.tests.length ? THEME.good : THEME.dim, { bold: true }); y += 20;
    for (const t of d.tests) {
      const g = L(t.group); if (g !== group) { y += group === null ? 0 : 6; u.head(0, y, g); y += 18; group = g; }
      const text = L(t.text), h = Math.max(16, u.para(20, y, cw - 20, text, this.done.has(t.id) ? THEME.dim : THEME.txt));
      u.check(0, y, "", this.done.has(t.id), on => { on ? this.done.add(t.id) : this.done.delete(t.id); write(this.done); });
      u.hit(20, y, cw - 20, h, { fn: () => { const on = !this.done.has(t.id); on ? this.done.add(t.id) : this.done.delete(t.id); write(this.done); } });
      y += h + 4;
    }
    y += 8; u.btn(0, y, 130, getLang() === "en" ? "Clear marks" : "Borrar marcas", () => { this.done.clear(); write(this.done); }); return y + 28;
  }
  tab_tools(u, cw) {
    const hb = window.hbDev;
    if (!hb) return u.para(0, 0, cw, "Las herramientas aparecen al entrar en el juego.", THEME.dim);
    const lang = getLang(), es = (a, b) => (lang === "en" ? b : a), s = c => () => this.send(c);
    this.lists ||= { items: [...hb.data.items.values()].map(i => i.name).filter(Boolean).sort(), mobs: Object.keys(hb.npcDb).sort(), maps: ["arefarm", ...hb.mapIds.filter(m => m !== "arefarm")] };
    let y = u.para(0, 0, cw, "Solo para pruebas: lo que hagas aquí se guarda con la partida. Los mensajes salen en el chat.", THEME.dim) + 6;
    const sec = (title, fn) => { u.head(0, y, title); y += 16; const f = new Flow(u, 0, y, cw, { rh: 24 }); fn(f); y = f.bottom + 6; };
    const n = id => this.n(id), v = id => this.v(id);
    const num = (f, id, def, min, max, wd = 56) => f.input(id, wd, { num: true, def, min, max });
    sec(es("Personaje", "Character"), f => {
      f.text("Lv"); num(f, "lvl", 30, 1, 50); f.btn("Set level", () => this.send({ op: "level", n: n("lvl") }));
      f.btn("+1000 exp", s({ op: "exp", n: 1000 })); f.btn("+100k gold", s({ op: "gold", n: 100000 })); f.btn("+5 points", s({ op: "points", n: 5 }));
      f.btn("Heal all", s({ op: "heal" })); f.btn(es("Reset all (todos a nivel 1)", "Reset all (everyone to level 1)"), async () => { if (await this.g.confirm("Reset all?")) this.send({ op: "resetall" }); });
      f.btn("Full mage on/off", s({ op: "fullmage" })); f.btn("Invulnerable on/off", s({ op: "god" })); f.btn(es("0 restricciones on/off", "0 restrictions on/off"), s({ op: "free" })); f.btn("Skills 100", s({ op: "skills", n: 100 }));
      f.nl(); f.combo("stat", 70, ["str", "vit", "dex", "int", "mag", "chr"], { def: "str" }); num(f, "statv", 50, 1, 500); f.btn("Set stat", () => this.send({ op: "stat", key: v("stat"), n: n("statv") }));
    });
    sec(es("Ir a", "Go to"), f => {
      f.combo("map", 130, this.lists.maps, { def: "arefarm" }); f.btn("Go", () => this.send({ op: "goto", map: v("map") }));
      f.text(es("Cripta nivel", "Crypt level")); num(f, "clv", 1, 1, 20, 48); f.btn("Jump", () => this.send({ op: "crypt", level: n("clv") })); f.btn("Clear level (open portal)", s({ op: "clear" }));
      f.nl(); f.text("x"); num(f, "tx", 60, 0, 999); f.text("y"); num(f, "ty", 60, 0, 999); f.btn("Move", () => this.send({ op: "teleportxy", x: n("tx"), y: n("ty") }));
    });
    sec(es("Objetos", "Items"), f => {
      f.combo("item", 200, this.lists.items, { def: "", strict: false, ph: es("nombre del objeto", "item name") }); f.text("x"); num(f, "icount", 1, 1, 10000, 64);
      f.btn("Give", () => this.send({ op: "give", name: v("item"), count: n("icount") }));
      f.nl();
      for (const [k, label] of [["potions", "Potions"], ["arrows", "Arrows"], ["dyes", "Dyes"], ["bone", "Skeleton bones"], ["manuals", "Manual"]]) f.btn(label, () => { for (const [name, count] of KITS[k]) this.send({ op: "give", name, count }); });
    });
    sec("Bots", f => {
      num(f, "bn", 1, 1, 10, 44); f.text("Lv"); num(f, "blv", 1, 1, 50, 52);
      f.btn(es("Invocar bot (en tu grupo)", "Summon bot (joins your party)"), () => this.send({ op: "bot", n: n("bn"), level: n("blv") }));
      f.btn(es("Bot suelto", "Solo bot"), () => this.send({ op: "bot", n: n("bn"), level: n("blv"), solo: true }));
      f.btn(es("Reiniciar bots desde 0", "Restart all bots from scratch"), async () => { if (await this.g.confirm("Restart all bots from scratch?")) this.send({ op: "botsnew" }); });
      f.btn(es("Quitar bots", "Remove bots"), s({ op: "botclear" }));
    });
    sec(es("Enemigos", "Enemies"), f => {
      f.combo("mob", 150, this.lists.mobs, { def: "Skeleton" }); f.text("x"); num(f, "mcount", 1, 1, 30, 48); f.text(es("fuerza", "power")); num(f, "mmult", 1, 1, 50, 48);
      f.text(es("jefe", "boss")); f.combo("boss", 50, ["0", "1", "2", "3", "4"], { def: "0" });
      f.btn("Spawn", () => this.send({ op: "spawn", name: v("mob"), count: n("mcount"), mult: n("mmult"), boss: +v("boss") || 0 }));
      f.btn("Kill all", s({ op: "killall" })); f.btn("Freeze monsters on/off", s({ op: "freeze" }));
      f.nl(); f.text(es("vida del jefe", "boss life")); num(f, "bhp", 50, 1, 100, 48); f.text("%"); f.btn("Set", () => this.send({ op: "bosshp", n: n("bhp") }));
    });
    sec("Summons", f => {
      f.combo("sp", 130, SPECIES, { def: "Orc" }); f.text("Lv"); num(f, "plv", 1, 1, 50, 48); f.btn("Give ball", () => this.send({ op: "ball", sp: v("sp"), lvl: n("plv") }));
      f.nl(); f.text("Lv"); num(f, "pl", 20, 1, 50, 48); f.btn("Set active summon level", () => this.send({ op: "petlvl", n: n("pl") })); f.btn("Heal + mana", s({ op: "petheal" }));
      f.nl(); f.btn("Support build", s({ op: "petspec", br: "support" })); f.btn("Damage build", s({ op: "petspec", br: "damage" })); f.btn("Warrior build", s({ op: "petspec", br: "tank" })); f.btn("Reset talents (F10)", s({ op: "petreset" }));
    });
    sec(es("Mundo", "World"), f => {
      const wx = () => +v("wx") || 0;
      f.btn("Day", () => this.send({ op: "sky", day: 1, weather: wx() })); f.btn("Night", () => this.send({ op: "sky", day: 2, weather: wx() })); f.btn("Auto", () => this.send({ op: "sky", day: 0, weather: wx() }));
      f.text(es("clima", "weather")); f.combo("wx", 50, ["0", "1", "2", "3"], { def: "0" }); f.text(es("(0 = despejado, 1-3 = lluvia)", "(0 = clear, 1-3 = rain)"), THEME.dim);
    });
    return y + 90;                                   // margen para que las listas desplegables de abajo no queden cortadas
  }
}
export function registerNews(gui) { gui.register(new NewsWin()); }
