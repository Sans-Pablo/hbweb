// Interfaz en HTML encima del lienzo. Cambia de aspecto con el modo (clase en <body>):
// clásico = barra de piedra estrecha como el original; remastered = orbes y paneles modernos.
import * as R from "../shared/rules.js";
import { itemDef, itemName, packKey } from "./names.js";
import { SKILL_NAMES } from "../shared/skills.js";
import { EQUIP, ITYPE, EFFECT, isStack } from "../shared/items.js";
import { damageRange } from "../shared/combat.js";

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
    for (const b of document.querySelectorAll("[data-use]")) b.onclick = () => this.quickUse(b.dataset.use);
    this.sel = null;
    $("#inv .grid").addEventListener("click", e => { const c = e.target.closest("[data-uid]"); if (c) { this.sel = +c.dataset.uid; this.invKey = ""; } });
    $("#inv .grid").addEventListener("dblclick", e => { const c = e.target.closest("[data-uid]"); if (c) this.primary(+c.dataset.uid); });
    $("#inv .detail").addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b || this.sel == null) return;
      this.act(b.dataset.act, this.sel);
    });
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
      case "pickup": if (ev.id === me) this.log(ev.item === 90 ? "Recoges " + ev.count + " de oro." : "Recoges: " + itemName(ev.item) + (ev.count > 1 ? " x" + ev.count : "") + "."); break;
      case "use": if (ev.id === me) this.log("Usas " + itemName(ev.item) + (ev.amount ? " (+" + ev.amount + ")" : "") + "."); break;
      case "equip": if (ev.id === me) this.log("Equipas " + itemName(world.ents.get(me)?.bag?.find(i => i.uid === ev.uid)?.id) + "."); break;
      case "unequip": if (ev.id === me) this.log("Te quitas " + itemName(world.ents.get(me)?.bag?.find(i => i.uid === ev.uid)?.id) + "."); break;
      case "equipfail": if (ev.id === me) this.log("No puedes equiparlo: " + ev.why + ".", "bad"); break;
      case "cantcarry": if (ev.id === me) this.log(ev.why === "weight" ? "Pesa demasiado para llevarlo." : "No tienes sitio en la mochila.", "bad"); break;
      case "broken": if (ev.id === me) this.log("Un objeto se ha gastado del todo: hay que repararlo.", "bad"); break;
      case "reject": if (ev.id === me && ev.cmd === "use") this.log("No puedes usar eso.", "bad"); break;
      case "respawn": if (ev.id === me) this.log("Vuelves a la granja con la vida llena."); break;
      case "chat": this.log(ev.system ? ev.text : ev.name + ": " + ev.text, ev.system ? "gold" : "chat"); break;
      case "disconnected": this.log("Se ha perdido la conexión con el servidor.", "bad"); break;
    }
  }

  // atajos de pociones: la de menor id del tipo pedido (la pequeña antes que la grande)
  quickItem(kind) {
    const me = this.conn.state.ents.get(this.conn.pid);
    if (!me || !me.bag) return null;
    const eff = { hp: EFFECT.HP, mp: EFFECT.MP, sp: EFFECT.SP }[kind];
    let best = null;
    for (const i of me.bag) {
      const d = itemDef(i.id);
      if (d && d.type === ITYPE.EAT && d.effectType === eff && (!best || i.id < best.id)) best = i;
    }
    return best;
  }
  quickUse(kind) {
    const it = this.quickItem(kind);
    if (it) this.conn.send({ t: "use", uid: it.uid });
    else this.log("No tienes " + { hp: "pociones de vida", mp: "pociones de maná", sp: "pociones de resistencia" }[kind] + ".", "bad");
  }
  isEquipped(me, uid) { return Object.values(me.equip || {}).includes(uid); }
  primary(uid) {
    const me = this.conn.state.ents.get(this.conn.pid), it = me?.bag.find(i => i.uid === uid), d = it && itemDef(it.id);
    if (!d) return;
    if (d.type === ITYPE.EQUIP) this.act(this.isEquipped(me, uid) ? "unequip" : "equip", uid);
    else if (d.type === ITYPE.EAT || d.type === ITYPE.USE_DEPLETE) this.act("use", uid);
  }
  act(a, uid) {
    if (a === "drop") { const me = this.conn.state.ents.get(this.conn.pid), it = me?.bag.find(i => i.uid === uid); this.conn.send({ t: "drop", uid, count: it && isStack(itemDef(it.id)) ? it.count : 0 }); }
    else this.conn.send({ t: a, uid });
  }

  describe(it, me) {
    const d = itemDef(it.id), L = [];
    const pos = ["", "Cabeza", "Cuerpo", "Brazos", "Pantalón", "Calzado", "Cuello", "Mano izquierda", "Mano derecha", "Dos manos", "Anillo dcho.", "Anillo izdo.", "Espalda", "Cuerpo completo"][d.equipPos];
    if (d.type === ITYPE.EQUIP) {
      if (d.effectType === EFFECT.ATTACK || d.effectType === EFFECT.ATTACK_MANASAVE || d.effectType === EFFECT.ATTACK_ARROW) {
        L.push("Daño " + d.v1 + "d" + d.v2 + (d.v3 ? "+" + d.v3 : "") + " (grandes " + d.v4 + "d" + d.v5 + (d.v6 ? "+" + d.v6 : "") + ")");
        if (d.skill >= 0) L.push("Habilidad: " + (SKILL_NAMES[d.skill] || d.skill) + " · velocidad " + d.speed);
      } else if (d.effectType === EFFECT.DEFENSE || d.effectType === EFFECT.DEFENSE_SPECABLTY) {
        L.push("Defensa +" + d.v1 + (d.equipPos === EQUIP.LHAND ? " · bloqueo " + (d.v1 - Math.floor(d.v1 / 3)) + " %" : d.v2 ? " · absorbe " + d.v2 + " %" : ""));
      }
      L.push(pos + (d.levelLimit ? " · nivel " + d.levelLimit : "") + (d.gender === 1 ? " · hombre" : d.gender === 2 ? " · mujer" : ""));
      L.push("Fuerza necesaria " + Math.ceil(d.weight / 100) + " · durabilidad " + it.life + "/" + d.maxLife);
    } else L.push(d.type === ITYPE.EAT ? "Consumible" : "Objeto");
    L.push("Peso " + (d.weight / 100).toFixed(2) + (isStack(d) ? " c/u" : ""));
    return L;
  }

  renderInv(me) {
    const key = [me.bag.map(i => i.uid + ":" + i.count + ":" + i.life).join(","), JSON.stringify(me.equip), this.sel, me.weight, me.maxLoad, me.gold].join("|");
    if (this.invKey === key) return;
    this.invKey = key;
    $("#inv .load").textContent = "Peso " + (me.weight / 100).toFixed(1) + " / " + (me.maxLoad / 100).toFixed(0) + " · oro " + me.gold.toLocaleString("es") + " · " + me.bag.length + "/50";
    let html = "";
    for (const it of me.bag) {
      const d = itemDef(it.id); if (!d) continue;
      const fr = this.sprites?.frame(packKey(d), d.spriteFrame);
      let ico = "";
      if (fr) {
        const [sx, sy, w, h] = fr, k = Math.min(1, 40 / Math.max(w, h));
        ico = `<span class="ico" style="width:${w}px;height:${h}px;background:url(data/sprites/${this.sprites.m[packKey(d)].png}) -${sx}px -${sy}px;transform:scale(${k})"></span>`;
      }
      const eq = this.isEquipped(me, it.uid), dead = d.type === ITYPE.EQUIP && it.life === 0;
      html += `<button class="cell${eq ? " eq" : ""}${this.sel === it.uid ? " sel" : ""}${dead ? " broken" : ""}" data-uid="${it.uid}" title="${itemName(it.id)}">${ico}${it.count > 1 ? "<b>" + it.count + "</b>" : ""}</button>`;
    }
    $("#inv .grid").innerHTML = html;
    const it = me.bag.find(i => i.uid === this.sel);
    if (!it) { $("#inv .detail").innerHTML = "<p>Clic en un objeto para verlo. Doble clic: equipar o usar.</p>"; return; }
    const d = itemDef(it.id), eq = this.isEquipped(me, it.uid);
    let acts = "";
    if (d.type === ITYPE.EQUIP) acts += `<button data-act="${eq ? "unequip" : "equip"}">${eq ? "Quitar" : "Equipar"}</button>`;
    if (d.type === ITYPE.EAT || d.type === ITYPE.USE_DEPLETE) acts += '<button data-act="use">Usar</button>';
    acts += '<button data-act="drop">Tirar</button>';
    $("#inv .detail").innerHTML = `<h4>${itemName(it.id)}${it.count > 1 ? " x" + it.count : ""}</h4>${this.describe(it, me).map(l => "<p>" + l + "</p>").join("")}<div class="acts">${acts}</div>`;
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
    for (const k of ["hp", "mp", "sp"]) {
      const eff = { hp: EFFECT.HP, mp: EFFECT.MP, sp: EFFECT.SP }[k];
      this.set("q" + k, $("[data-use=" + k + "] b"), "text", String(me.bag.filter(i => { const d = itemDef(i.id); return d && d.type === ITYPE.EAT && d.effectType === eff; }).length));
    }
    this.set("spf", $("#sp .fill"), "--k", pct(me.sp, me.maxSp));
    if ($("#inv").classList.contains("open")) this.renderInv(me);
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
      const vs = t ? t : null;
      const [lo, hi] = me.dmg || (me.eff ? damageRange(me) : [1, 1]);
      const rows = Object.entries(STAT_NAMES).map(([k, n]) =>
        `<div class="row"><span>${n}</span><b>${me.stats[k]}</b>${me.pool ? `<button data-stat="${k}" title="Subir ${n}">+</button>` : "<i></i>"}</div>`).join("");
      const skills = Object.entries(me.skills).filter(([, v]) => v > 0).map(([k, v]) => `<div class="sk"><span>${SKILL_NAMES[k] || "Habilidad " + k}</span><b>${v}%</b></div>`).join("");
      const html = `<h3>${me.name} <small>nivel ${me.level}</small></h3>
        <p class="pool">${me.pool ? "Puntos para repartir: <b>" + me.pool + "</b>" : "Sin puntos para repartir"}</p>
        ${rows}
        <hr><div class="row"><span>Vida</span><b>${me.hp}/${me.maxHp}</b><i></i></div>
        <div class="row"><span>Maná</span><b>${me.mp}/${me.maxMp}</b><i></i></div>
        <div class="row"><span>Resistencia</span><b>${me.sp}/${me.maxSp}</b><i></i></div>
        <div class="row"><span>Hambre</span><b>${me.hunger}%</b><i></i></div>
        <div class="row"><span>Defensa</span><b>${me.defense}</b><i></i></div>
        <div class="row"><span>Daño</span><b>${lo}–${hi}</b><i></i></div>
        <div class="row"><span>Monstruos muertos</span><b>${me.kills}</b><i></i></div>
        <hr>${skills}`;
      this.set("char", $("#charpanel .body"), "html", html);
    }
  }
}
