import { imgUrl } from "./imgurl.js";
import { MAGIC_MODE } from "../shared/magic.js";
import { talent as talentDef } from "../shared/systems/talents.js";
const talentName = id => talentDef(id)?.name || id;
// Interfaz en HTML encima del lienzo. Cambia de aspecto con el modo (clase en <body>):
// clásico = barra de piedra estrecha como el original; remastered = orbes y paneles modernos.
import * as R from "../shared/rules.js";
import { itemDef, itemName, packKey } from "./names.js";
import { statsOf as companionStats, need as companionNeed } from "../shared/systems/companion.js";
import { SCHOOL_OF, spellSchool, spellLevel, spellInt, spellGold, spellMana, taught } from "../shared/systems/schools.js";
import { SKILL_NAMES } from "../shared/skills.js";
import { EQUIP, ITYPE, EFFECT, isStack } from "../shared/items.js";
import { PROT_CAP, PROT_OVERRIDE } from "../shared/rarity.js";
import { damageRange } from "../shared/combat.js";
import { realStats, attrLines } from "../shared/attributes.js";

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
    $("#book .list").addEventListener("click", e => {
      const b = e.target.closest("[data-learn],[data-pick]"); if (!b) return;
      if (b.dataset.learn) conn.send({ t: "learn", spell: +b.dataset.learn });
      else { this.spell = +b.dataset.pick; this.bookKey = ""; this.onSpell?.(this.spell); }
    });
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
    this.onLog?.(text, cls);
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
      case "companion": if (ev.id === me) this.log(ev.on ? (ev.nm || ev.sp.replace(/-/g, " ")) + " te acompaña." : (ev.nm || ev.sp.replace(/-/g, " ")) + " vuelve a la bola."); break;
      case "penalty": if (ev.id === me) this.log("Mueres: pierdes " + ev.loss + " de experiencia" + (ev.lost ? " y bajas al nivel " + ev.level : "") + ".", "bad"); break;
      case "dbg": if (ev.id === me) this.log("[test] " + ev.msg, "gold"); break;
      case "talent": if (ev.id === me) this.log(ev.nm + " aprende " + (talentName(ev.talent)) + " (" + ev.rank + ").", "gold"); break;
      case "talentreset": if (ev.id === me) this.log("Has reiniciado los talentos de " + ev.nm + " por " + ev.cost + " de oro.", "gold"); break;
      case "recalling": if (ev.id === me) this.log("Recall: quédate quieto " + Math.round(ev.ms / 1000) + " segundos…", "gold"); break;
      case "recalled": if (ev.id === me) this.log("Recall: vuelves a la granja.", "gold"); break;
      case "recallfail": if (ev.id === me) this.log(ev.why === "cancel" ? "Recall cancelado." : "Recall interrumpido: te moviste o entraste en combate.", "bad"); break;
      case "petname": if (ev.id === me) this.log("Tu compañero se llama ahora " + ev.nm + "."); break;
      case "petmode": if (ev.id === me) this.log((ev.nm || "Tu compañero") + (ev.mode === "peace" ? " está en paz: solo te sigue." : " ataca todo lo que ve.")); break;
      case "pettarget": if (ev.id === me) this.log("Ordenas a " + (ev.nm || "tu compañero") + " atacar a " + (ev.tn || "el objetivo") + "."); break;
      case "candy": if (ev.id === me) this.log(ev.kind === "revive" ? (ev.nm || ev.sp) + " vuelve en sí con " + ev.amount + " de vida." : (ev.nm || ev.sp) + " recupera " + ev.amount + (ev.kind === "hp" ? " de vida." : " de maná."), "gold"); break;
      case "companion-lost": if (ev.id === me) this.log((ev.nm || ev.sp.replace(/-/g, " ")) + " ha caído: pierde experiencia (nivel " + ev.lvl + ").", "bad"); break;
      case "companion-evolve": if (ev.id === me) this.log((ev.nm || ev.sp.replace(/-/g, " ")) + " está a punto de cambiar de tamaño…", "gold"); break;
      case "companion-resummon": if (ev.id === me) this.log((ev.nm || ev.sp.replace(/-/g, " ")) + " vuelve más grande.", "gold"); break;
      case "companion-lvl": if (ev.id === me) this.log((ev.nm || ev.sp.replace(/-/g, " ")) + " sube al nivel " + ev.lvl + ".", "gold"); break;
      case "levelup": if (ev.id === me) { this.log("¡Subes al nivel " + ev.level + "! Tienes 3 puntos para repartir (botón Level Up).", "gold"); this.toast("Nivel " + ev.level); } break;
      case "death":
        if (ev.id === me) this.log("Has muerto.", "bad");
        else if (ev.by === me) this.log("Has matado a " + (who(ev.id)?.name || "un monstruo") + ".");
        break;
      case "drop": if (ev.r >= 2) {                                       // aviso del botín raro/único cercano
        const m = this.conn.state.ents.get(me);
        if (m && Math.max(Math.abs(m.x - ev.x), Math.abs(m.y - ev.y)) <= 14) this.log((ev.r === 3 ? "¡Objeto único! " : "¡Objeto raro! ") + itemName(ev.item, ev.attr) + ".");
      } break;
      case "pickup": if (ev.id === me) this.log(ev.item === 90 ? "Recoges " + ev.count + " de oro." : "Recoges: " + itemName(ev.item, ev.attr, ev.comp) + (ev.count > 1 ? " x" + ev.count : "") + "."); break;
      case "skilllearn": if (ev.id === me) this.log("Aprendes la habilidad " + (SKILL_NAMES[ev.skill] || ev.skill) + " (" + ev.level + "%).", "gold"); break;
      case "use": if (ev.id === me) this.log("Usas " + itemName(ev.item) + (ev.amount ? " (+" + ev.amount + ")" : "") + "."); break;
      case "equip": if (ev.id === me) this.log("Equipas " + itemName(world.ents.get(me)?.bag?.find(i => i.uid === ev.uid)?.id) + "."); break;
      case "unequip": if (ev.id === me) this.log("Te quitas " + itemName(world.ents.get(me)?.bag?.find(i => i.uid === ev.uid)?.id) + "."); break;
      case "equipfail": if (ev.id === me) this.log("No puedes equiparlo: " + ev.why + ".", "bad"); break;
      case "cantcarry": if (ev.id === me) this.log(ev.why === "weight" ? "Pesa demasiado para llevarlo." : "No tienes sitio en la mochila.", "bad"); break;
      case "broken": if (ev.id === me) this.log("Un objeto se ha gastado del todo: hay que repararlo.", "bad"); break;
      case "learned": if (ev.id === me) { this.log((ev.nm ? ev.nm + " aprende " : "Aprendes ") + this.magicData?.[ev.spell]?.name + ".", "gold"); this.bookKey = ""; if (this.spell == null) this.spell = ev.spell; } break;
      case "reject": if (ev.id === me && (ev.cmd === "cast" || ev.cmd === "prepare")) this.log("No puedes lanzarlo: " + ev.why + ".", "bad"); else if (ev.id === me && ev.cmd === "portal") this.log("No puedes usar el portal: " + ev.why + ".", "bad"); else if (ev.id === me && ev.cmd === "learn") this.log("No puedes aprenderlo: " + ev.why + ".", "bad"); else if (ev.id === me && (ev.cmd === "talent" || ev.cmd === "use" || ev.cmd === "petgo" || ev.cmd === "petup" || ev.cmd === "candybuy" ||  ev.cmd === "talreset" || ev.cmd === "petname" || ev.cmd === "teleport" || ev.cmd === "recall" || ev.cmd === "arenabet" || ev.cmd === "arenainfo")) this.log("No se puede: " + ev.why + ".", "bad"); break;
      case "mapchange": if (ev.id === me) { this.log("Entras en " + ev.name + ".", "gold"); this.toast(ev.name); } break;
      case "dungeon-cleared": if (ev.id === me) { this.log("¡Nivel despejado! Recoge el botín y baja por el portal (E).", "gold"); this.toast("¡Nivel despejado!"); } break;
      case "bossmsg": if (ev.id === me) { this.log(ev.text, "gold"); this.toast?.(ev.text); } break;
      case "scan": if (ev.id === me) this.log(ev.text.trim(), "gold"); break;
      case "teleport": if (ev.id === me) this.log("Vuelves al punto de inicio."); break;
      case "status": if (ev.id === me) {
        const names = { hold: "paralizado", ice: "congelado", protect: "protegido", invis: "invisible", berserk: "en furia", poison: "envenenado", confuse: "confuso" };
        const bad = ev.key === "hold" || ev.key === "ice" || ev.key === "poison" || ev.key === "confuse";
        this.log(ev.on ? "Estás " + names[ev.key] + "." : "Ya no estás " + names[ev.key] + ".", ev.on && bad ? "bad" : "");
      } break;
      case "respawn": if (ev.id === me) this.log("Vuelves a la granja con el HP lleno."); break;
      case "chat": this.log(ev.system ? ev.text : (ev.ch === "shout" ? "[Shout] " : ev.ch === "side" ? "[Side] " : "") + ev.name + ": " + ev.text, ev.system ? "gold" : ev.ch === "shout" ? "shout" : ev.ch === "side" ? "side" : "chat"); break;
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
    else this.log("No tienes " + { hp: "pociones de HP", mp: "pociones de MP", sp: "pociones de SP" }[kind] + ".", "bad");
  }
  isEquipped(me, uid) { return Object.values(me.equip || {}).includes(uid); }
  primary(uid) {
    const me = this.conn.state.ents.get(this.conn.pid), it = me?.bag.find(i => i.uid === uid), d = it && itemDef(it.id);
    if (!d) return;
    if (it.comp) this.act("use", uid);
    else if (d.type === ITYPE.EQUIP) this.act(this.isEquipped(me, uid) ? "unequip" : "equip", uid);
    else if (d.type === ITYPE.EAT || d.type === ITYPE.USE_DEPLETE) this.act("use", uid);
  }
  // atajo F2/F3 de un objeto: equipar/quitar el equipo o usar el consumible
  useItemId(id) {
    const me = this.conn.state.ents.get(this.conn.pid), it = me?.bag.find(i => i.id === id);
    if (!it) { this.log("No tienes ese objeto.", "bad"); return; }
    this.primary(it.uid);
  }
  act(a, uid) {
    const me0 = this.conn.state.ents.get(this.conn.pid), it0 = me0?.bag.find(i => i.uid === uid);
    if (it0 && (a === "use" || a === "equip" || a === "unequip")) this.onItem?.(it0.id);
    if (a === "drop") { const me = this.conn.state.ents.get(this.conn.pid), it = me?.bag.find(i => i.uid === uid); this.conn.send({ t: "drop", uid, count: it && isStack(itemDef(it.id)) ? it.count : 0 }); }
    else this.conn.send({ t: a, uid });
  }

  describe(it, me) {
    const d = itemDef(it.id), L = [];
    if (it.comp) return this.describeBall(it, me);
    const pos = ["", "Cabeza", "Cuerpo", "Brazos", "Pantalón", "Calzado", "Cuello", "Mano izquierda", "Mano derecha", "Dos manos", "Anillo dcho.", "Anillo izdo.", "Espalda", "Cuerpo completo"][d.equipPos];
    if (d.type === ITYPE.EQUIP) {
      if (d.effectType === EFFECT.ATTACK || d.effectType === EFFECT.ATTACK_MANASAVE || d.effectType === EFFECT.ATTACK_ARROW) {
        L.push("Daño " + d.v1 + "d" + d.v2 + (d.v3 ? "+" + d.v3 : "") + " (grandes " + d.v4 + "d" + d.v5 + (d.v6 ? "+" + d.v6 : "") + ")");
        if (d.skill >= 0) L.push("Habilidad: " + (SKILL_NAMES[d.skill] || d.skill) + " · velocidad " + realStats(d, it).speed);
      } else if (d.effectType === EFFECT.DEFENSE || d.effectType === EFFECT.DEFENSE_SPECABLTY) {
        L.push("Defensa +" + d.v1 + (d.equipPos === EQUIP.LHAND ? " · bloqueo " + (d.v1 - Math.floor(d.v1 / 3)) + " %" : d.v2 ? " · absorbe " + d.v2 + " %" : ""));
      }
      L.push(pos + (d.levelLimit ? " · nivel " + d.levelLimit : "") + (d.gender === 1 ? " · hombre" : d.gender === 2 ? " · mujer" : ""));
      const rs = realStats(d, it);
      L.push("Fuerza necesaria " + Math.ceil(rs.weight / 100) + " · durabilidad " + it.life + "/" + rs.maxLife);
      for (const l of attrLines(it.attr)) L.push('<span style="color:#9fe39a">' + l + "</span>");
      const fxl = this.effectLine(d, it); if (fxl) L.push('<span style="color:#9fe39a">' + fxl + "</span>");
    } else if (/Candy$/.test(d.name)) L.push(d.effectType === 4 ? "Caramelo: cura la vida de tu compañero." : d.effectType === 5 ? "Caramelo: devuelve maná a tu compañero." : "Caramelo: revive a tu compañero inconsciente.");
    else L.push(d.type === ITYPE.EAT ? "Consumible" : "Objeto");
    L.push("Peso " + (realStats(d, it).weight / 100).toFixed(2) + (isStack(d) ? " c/u" : ""));
    return L;
  }

  // efecto especial de collares y anillos (ADDEFFECT de Item.cfg; mismos casos que shared/inventory.js recalc)
  effectLine(d, it) {
    if (d.effectType !== EFFECT.ADDEFFECT) return "";
    const v = d.v2, E = { 7: "luz", 9: "fuego", 10: "hielo", 11: "veneno" };
    switch (d.v1) {
      case 1: return "Resistencia mágica +" + v + " %";
      case 2: return "Ahorro de maná " + v + " %";
      case 3: return "Daño físico +" + v;
      case 4: return "Defensa +" + v;
      case 12: return "Probabilidad de acierto +" + v;
    }
    if (E[d.v1]) return "Protección contra " + E[d.v1] + " " + Math.min(PROT_CAP, PROT_OVERRIDE[d.id] ?? v) + " %";
    return "";
  }

  // bola de compañero (shared/systems/companion.js): especie, nivel, experiencia y daño compartido con el dueño
  describeBall(it, me) {
    const c = it.comp, st = companionStats(me, c), nx = companionNeed(c.lvl);
    return [
      "Compañero: " + (c.nm ? c.nm + " (" + c.sp.replace(/-/g, " ") + ")" : c.sp.replace(/-/g, " ")) + " · nivel " + c.lvl + (c.on ? " · <b>activo</b>" : ""),
      "Experiencia " + c.exp + " / " + nx + (c.lvl >= Math.min(60, me.level) ? " (tope: tu nivel)" : ""),
      "Daño ≈ " + st.dmg + " por golpe (" + Math.round(st.share * 100) + " % del tuyo) · vida " + st.hp,
    ];
  }

  renderInv(me) {
    const key = [me.bag.map(i => i.uid + ":" + i.count + ":" + i.life).join(","), JSON.stringify(me.equip), this.sel, me.weight, me.maxLoad, me.gold, me.bag.map(i => (i.attr || 0) + (i.comp ? "c" + i.comp.lvl + i.comp.exp + i.comp.on : "")).join(",")].join("|");
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
        ico = `<span class="ico" style="width:${w}px;height:${h}px;background:url(${imgUrl("data/sprites/" + this.sprites.m[packKey(d)].png)}) -${sx}px -${sy}px;transform:scale(${k})"></span>`;
      }
      const eq = this.isEquipped(me, it.uid), dead = d.type === ITYPE.EQUIP && it.life === 0;
      html += `<button class="cell${eq ? " eq" : ""}${this.sel === it.uid ? " sel" : ""}${dead ? " broken" : ""}" data-uid="${it.uid}" title="${itemName(it.id, it.attr, it.comp)}">${ico}${it.count > 1 ? "<b>" + it.count + "</b>" : ""}</button>`;
    }
    $("#inv .grid").innerHTML = html;
    const it = me.bag.find(i => i.uid === this.sel);
    if (!it) { $("#inv .detail").innerHTML = "<p>Clic en un objeto para verlo. Doble clic: equipar o usar.</p>"; return; }
    const d = itemDef(it.id), eq = this.isEquipped(me, it.uid);
    let acts = "";
    if (d.type === ITYPE.EQUIP) acts += `<button data-act="${eq ? "unequip" : "equip"}">${eq ? "Quitar" : "Equipar"}</button>`;
    if (it.comp) acts += `<button data-act="use">${it.comp.on ? "Guardar" : "Invocar"}</button>`;
    else if (d.type === ITYPE.EAT || d.type === ITYPE.USE_DEPLETE) acts += '<button data-act="use">Usar</button>';
    acts += '<button data-act="drop">Tirar</button>';
    $("#inv .detail").innerHTML = `<h4${it.attr ? ' style="color:#9fe39a"' : ""}>${itemName(it.id, it.attr, it.comp)}${it.count > 1 ? " x" + it.count : ""}</h4>${this.describe(it, me).map(l => "<p>" + l + "</p>").join("")}<div class="acts">${acts}</div>`;
  }

  renderBook(me) {
    const M = this.magicData || {};
    const ball = me.bag && me.bag.find(i => i.comp && i.comp.on), c = ball && ball.comp, school = c && SCHOOL_OF[c.sp];
    const key = [JSON.stringify(c && [c.sp, c.lvl, c.spells]), me.gold, me.stats.int, this.spell].join("|");
    if (this.bookKey === key) return;
    this.bookKey = key;
    // el libro es del summon elegido: sus hechizos aprendidos (Elegir) y los que el personaje puede enseñarle (Aprender: Int y oro)
    let html = school ? "" : "<p>Elige un summon de escuela (Orc fuego, Tentocle hielo, Cannibal-Plant rayo) y enséñale hechizos con tu Int y tu oro.</p>";
    for (const id of Object.keys(M).map(Number).sort((a, b) => a - b)) {
      const m = M[id]; if (!school || spellSchool(m) !== school) continue;
      const need = spellLevel(M, school, id, c.sp); if (need == null) continue;
      const known = taught(c, id), int = spellInt(M, school, id), gold = spellGold(M, school, id), ok = c.lvl >= need && me.stats.int >= int && me.gold >= gold;
      const act = known ? `<button data-pick="${id}"${this.spell === id ? " class=on" : ""}>${this.spell === id ? "Elegido" : "Elegir"}</button>`
        : `<button data-learn="${id}"${ok ? "" : " class=dis"}>Enseñar ${gold}</button>`;
      html += `<div class="sp${known ? " known" : ""}"><span>${m.name}<small> Lv ${need} · MP ${spellMana(M, school, id)} · Int ${int}</small></span>${act}</div>`;
    }
    $("#book .list").innerHTML = html;
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
    // avisos de carga (QA de los habitantes: 26 de 26 no vieron nunca avisos de peso ni de mochila llena); se repiten solo tras bajar de la marca
    if (me.weight > me.maxLoad * 0.9) { if (!this.warnLoad) { this.warnLoad = true; this.log("Vas casi al límite de peso (" + (me.weight / 100).toFixed(1) + " / " + (me.maxLoad / 100).toFixed(0) + "): vende o tira lo que no uses.", "bad"); } } else if (me.weight < me.maxLoad * 0.8) this.warnLoad = false;
    if (me.bag.length >= 46) { if (!this.warnBag) { this.warnBag = true; this.log("Tu mochila está casi llena (" + me.bag.length + "/50): vende o tira lo que no uses.", "bad"); } } else if (me.bag.length < 42) this.warnBag = false;
    this.set("loadwarn", $("#inv .load"), "color", me.weight > me.maxLoad * 0.9 || me.bag.length >= 46 ? "#ff8a7a" : "");
    if ($("#inv").classList.contains("open")) this.renderInv(me);
    if ($("#book").classList.contains("open")) this.renderBook(me);
    this.set("pool", $("#poolbadge"), "text", me.pool ? String(me.pool) : "");
    this.set("dead", $("#death"), "display", "none");          // al morir se abre el menú del sistema original (diálogo 19) con su botón Restart
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
      const e = me.eff || {}, ar = Object.values(e.armor || {}).reduce((a, b) => a + b, 0);
      const SEC = [["Probabilidad de acierto", e.addAR, ""], ["Defensa añadida", e.addDR, ""], ["Recuperación de HP", e.addHP, " %"],
        ["Recuperación de SP", e.addSP, " %"], ["Recuperación de MP", e.addMP, " %"], ["Resistencia mágica", e.addMR, " %"],
        ["Resistencia al veneno", e.addPR, " %"], ["Absorción física", ar, " %"], ["Absorción mágica", e.addAbsMD, " %"],
        ["Daño de ataques seguidos", e.addCD, ""], ["Experiencia", e.addExp, " %"], ["Oro", e.addGold, " %"],
        ["Ahorro de MP", e.manaSave, " %"], ["Probabilidad de lanzar magia", e.castBonus, " %"],
        ["Daño convertido en MP", e.transMana, " %"], ["Probabilidad de crítico", e.chargeCrit, " %"]];
      const sec = SEC.filter(r => r[1]).map(([n, v, u]) => `<div class="row"><span>${n}</span><b>+${v}${u}</b><i></i></div>`).join("");
      const html = `<h3>${me.name} <small>nivel ${me.level}</small></h3>
        <p class="pool">${me.pool ? "Puntos para repartir: <b>" + me.pool + "</b>" : "Sin puntos para repartir"}</p>
        ${rows}
        <hr><div class="row"><span>HP</span><b>${me.hp}/${me.maxHp}</b><i></i></div>
        <div class="row"><span>MP</span><b>${me.mp}/${me.maxMp}</b><i></i></div>
        <div class="row"><span>SP</span><b>${me.sp}/${me.maxSp}</b><i></i></div>
        <div class="row"><span>Hambre</span><b>${me.hunger}%</b><i></i></div>
        <div class="row"><span>Defensa</span><b>${me.defense}</b><i></i></div>
        <div class="row"><span>Daño</span><b>${lo}–${hi}</b><i></i></div>
        <div class="row"><span>Monstruos muertos</span><b>${me.kills}</b><i></i></div>
        ${sec ? "<hr><p class=\"pool\">Bonos del equipo</p>" + sec : ""}
        <hr>${skills}`;
      this.set("char", $("#charpanel .body"), "html", html);
    }
  }
}

