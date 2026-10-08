// Interfaz en HTML encima del lienzo. Cambia de aspecto con el modo (clase en <body>):
// clásico = barra de piedra estrecha como el original; remastered = orbes y paneles modernos.
import { ITEM_NAMES } from "./fx.js";
import * as R from "../shared/rules.js";

const $ = s => document.querySelector(s);
const STAT_NAMES = { str: "Fuerza", vit: "Vitalidad", dex: "Destreza", int: "Inteligencia", mag: "Magia", chr: "Carisma" };

export class Hud {
  constructor(conn) {
    this.conn = conn;
    this.root = $("#ui");
    this.cache = {};
    this.logEl = $("#log");
    $("#death button").onclick = () => conn.send({ t: "respawn" });
    for (const b of document.querySelectorAll("[data-key]")) b.onclick = () => this.onButton?.(b.dataset.key);
    $("#charpanel").addEventListener("click", e => {
      const s = e.target.closest("[data-stat]");
      if (s) conn.send({ t: "stat", stat: s.dataset.stat });
    });
    for (const b of document.querySelectorAll("[data-use]")) b.onclick = () => conn.send({ t: "use", item: b.dataset.use });
  }

  place(rect) {
    const r = this.root.style;
    r.left = rect.x + "px"; r.top = rect.y + "px"; r.width = rect.w + "px"; r.height = rect.h + "px";
  }

  set(key, el, prop, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    if (prop === "text") el.textContent = value;
    else if (prop === "html") el.innerHTML = value;
    else el.style.setProperty(prop, value);
  }

  log(text, cls = "") {
    const d = document.createElement("div");
    d.textContent = text;
    if (cls) d.className = cls;
    this.logEl.appendChild(d);
    while (this.logEl.children.length > 7) this.logEl.firstChild.remove();
    setTimeout(() => d.classList.add("old"), 7000);
  }

  toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.remove("show");
    void t.offsetWidth;
    t.classList.add("show");
  }

  onEvent(ev, world) {
    const me = this.conn.pid;
    const who = id => world.ents.get(id);
    switch (ev.t) {
      case "levelup": if (ev.id === me) { this.log("¡Subes al nivel " + ev.level + "! Tienes 3 puntos para repartir (C).", "gold"); this.toast("Nivel " + ev.level); } break;
      case "death":
        if (ev.id === me) this.log("Has muerto.", "bad");
        else if (ev.by === me) this.log("Has matado a " + (who(ev.id)?.name || "un monstruo") + ".");
        break;
      case "pickup": if (ev.id === me) this.log(ev.item === "gold" ? "Recoges " + ev.count + " de oro." : "Recoges: " + ITEM_NAMES[ev.item] + "."); break;
      case "use": if (ev.id === me) this.log("Bebes " + ITEM_NAMES[ev.item] + " (+" + ev.amount + ")."); break;
      case "reject": if (ev.id === me && ev.cmd === "use") this.log("No te quedan pociones de ese tipo.", "bad"); break;
      case "respawn": if (ev.id === me) this.log("Vuelves a la granja con la vida llena."); break;
      case "chat": this.log(ev.system ? ev.text : ev.name + ": " + ev.text, ev.system ? "gold" : "chat"); break;
      case "disconnected": this.log("Se ha perdido la conexión con el servidor.", "bad"); break;
    }
  }

  update(world, hoverEnt) {
    const me = world.ents.get(this.conn.pid);
    if (!me) return;
    const pct = (a, b) => Math.max(0, Math.min(100, (100 * a) / Math.max(1, b))).toFixed(1) + "%";
    this.set("hp", $("#hp .fill"), "--k", pct(me.hp, me.maxHp));
    this.set("hpt", $("#hp .val"), "text", me.hp + " / " + me.maxHp);
    this.set("mp", $("#mp .fill"), "--k", pct(me.mp, me.maxMp));
    this.set("mpt", $("#mp .val"), "text", me.mp + " / " + me.maxMp);
    this.set("xp", $("#xp .fill"), "--k", pct(me.exp - me.prevExp, me.nextExp - me.prevExp));
    this.set("xpt", $("#xp .val"), "text", "Nivel " + me.level + " · " + (me.exp - me.prevExp) + " / " + (me.nextExp - me.prevExp) + " exp");
    this.set("gold", $("#gold"), "text", me.gold.toLocaleString("es"));
    for (const k of ["red", "blue", "bigred"]) this.set("inv" + k, $("[data-use=" + k + "] b"), "text", String(me.inv[k] || 0));
    this.set("pool", $("#poolbadge"), "text", me.pool ? String(me.pool) : "");
    this.set("dead", $("#death"), "display", me.dead ? "grid" : "none");
    this.set("low", document.body, "--low", me.hp < me.maxHp * 0.3 && !me.dead ? "1" : "0");

    // objetivo bajo el cursor
    const t = hoverEnt && !hoverEnt.dead ? hoverEnt : null;
    this.set("tg", $("#target"), "display", t ? "block" : "none");
    if (t) {
      this.set("tgn", $("#target .name"), "text", t.name + (t.special ? " (especial)" : ""));
      this.set("tgh", $("#target .fill"), "--k", pct(t.hp, t.maxHp));
    }

    // panel de personaje
    if ($("#charpanel").classList.contains("open")) {
      const c = { ...me.stats, level: me.level, skills: me.skills };
      const w = me.weapon;
      const lo = R.playerMelee(() => 0, c, w).damage, hi = R.playerMelee(() => 0.9999, c, w).damage;
      const vs = t ? t : null;
      const hit = vs ? R.hitChance(R.playerMelee(() => 0, c, w).hitRatio, vs.cfg.defenseRatio, false) + "% contra " + vs.name : "—";
      const rows = Object.entries(STAT_NAMES).map(([k, n]) =>
        `<div class="row"><span>${n}</span><b>${me.stats[k]}</b>${me.pool ? `<button data-stat="${k}" title="Subir ${n}">+</button>` : "<i></i>"}</div>`).join("");
      const html = `<h3>${me.name} <small>nivel ${me.level}</small></h3>
        <p class="pool">${me.pool ? "Puntos para repartir: <b>" + me.pool + "</b>" : "Sin puntos para repartir"}</p>
        ${rows}
        <hr><div class="row"><span>Vida</span><b>${me.maxHp}</b><i></i></div>
        <div class="row"><span>Maná</span><b>${me.maxMp}</b><i></i></div>
        <div class="row"><span>Defensa</span><b>${me.defense}</b><i></i></div>
        <div class="row"><span>Arma</span><b>${w.name} ${lo}–${hi}</b><i></i></div>
        <div class="row"><span>Acierto</span><b>${hit}</b><i></i></div>
        <div class="row"><span>Monstruos muertos</span><b>${me.kills}</b><i></i></div>`;
      this.set("char", $("#charpanel .body"), "html", html);
    }
  }
}
