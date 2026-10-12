// Cuadro «Puesto» (id 48): tiendas de jugador (INVENTO del port; lógica en shared/systems/stall.js). Tres vistas:
//   - ver: clic en el puesto de otro jugador → lista de objetos con precio, clic en una fila = comprar 1 (Ctrl = toda la pila).
//   - mío: tu puesto → lo mismo pero con «Recoger oro» y «Cerrar puesto».
//   - montar: «/puesto» dentro de shop, warehouse o herrería → tu mochila; clic en un objeto = ponerlo (pide el precio), «Abrir puesto» lo monta.
import { ClassicDialog, INK, RED } from "./classicdialog.js";
import { itemName, itemDef } from "./names.js";
import { t as tr } from "./i18n.js";
import { MAPS } from "../shared/systems/stall.js";

const GOLD = 90;
// Mini-cuadro propio (window.prompt está bloqueado en muchos navegadores/webviews y es feo): devuelve Promise<string|null>.
function ask(label, def, numeric) {
  return new Promise(res => {
    const bg = document.createElement("div"); bg.style.cssText = "position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#0008";
    const box = document.createElement("div"); box.style.cssText = "background:#3a2a1a;border:2px solid #c8a96a;border-radius:4px;padding:12px 14px;color:#f0e0b8;font:13px sans-serif;display:grid;gap:8px;min-width:240px";
    const t = document.createElement("div"); t.textContent = tr(label);
    const inp = document.createElement("input"); inp.value = def; inp.style.cssText = "font:14px sans-serif;padding:4px;background:#f0e0b8;color:#2d1919;border:1px solid #2d1919"; if (numeric) { inp.inputMode = "numeric"; inp.maxLength = 9; }
    const row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;justify-content:flex-end";
    const done = v => { bg.remove(); res(v); };
    const mk = (txt, ok) => { const b = document.createElement("button"); b.textContent = tr(txt); b.style.cssText = "padding:3px 12px;cursor:pointer"; b.onclick = () => done(ok ? inp.value : null); return b; };
    row.append(mk("Cancelar", false), mk("Ok", true)); box.append(t, inp, row); bg.append(box); document.body.append(bg);
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === "Enter") done(inp.value); else if (e.key === "Escape") done(null); };
    inp.focus(); inp.select();
  });
}
const comma = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export function registerStall(gui, api) {
  const dlg = new class extends ClassicDialog {
    constructor() { super({ id: 48, title: "Puesto", w: 520, x: 140, top: 84, rowH: 16, footer: "Clic en una fila para comprar (Ctrl = toda la pila). Comisión 0." }); this.mode = "off"; this.hov = null; this.st = null; this.set = []; this.ctrl = false; }
    bagItems(me) {
      const worn = new Set(Object.values(me?.equip || {}));
      return (me?.bag || []).filter(it => !worn.has(it.uid) && !it.comp && it.id !== GOLD);
    }
    label(it) { return itemName(it.id, it.attr) + (it.count > 1 ? " x" + it.count : ""); }
    rows(me) {
      if (this.mode === "setup") {
        const chosen = new Map(this.set.map(s => [s.uid, s]));
        return [...this.bagItems(me).map(it => ({ it, text: (chosen.has(it.uid) ? "✔ " : "") + this.label(it), right: chosen.has(it.uid) ? comma(chosen.get(it.uid).price) : "", tip: "Clic: poner a la venta (pide el precio por unidad); otro clic lo quita" }))];
      }
      if (!this.st) return [];
      const r = this.st.items.map(it => ({ it, text: this.label(it), right: comma(it.price), tip: this.st.mine ? "Tu objeto a la venta (precio por unidad)" : "Clic: comprar 1 · Ctrl: toda la pila (" + comma(it.price) + " c/u)" }));
      if (this.st.mine) r.push({ act: "take", text: "Recoger oro (" + comma(this.st.gold) + ")", color: "#1a6b1a" }, { act: "close", text: "Cerrar puesto", color: RED, tip: "Recuperas objetos y oro" });
      return r;
    }
    // Ventana doble: a la izquierda la lista (marco clásico de 258 px), a la derecha la ficha del objeto bajo el ratón (sprite, estadísticas y
    // comparación con lo equipado, como al comprar en Diablo II). La lógica de filas sigue midiendo el marco izquierdo.
    draw(g, me) {
      const W = this.w; this.w = 258; this.hovered(g, me); super.draw(g, me); this.w = W;
      g.put("gamedialog_1", 2, 262, 0); this.card(g, me);
    }
    hovered(g, me) {
      const lx = g.mouse.x - this.x, ly = g.mouse.y - this.y, i = Math.floor((ly - this.top) / this.rowH);
      if (ly >= this.top && i >= 0 && i < this.visible && lx > this.mx - 4 && lx < this.w - 12) { const r = (this.rows(me) || [])[i + this.view]; if (r?.it) this.hov = r.it; }
    }
    card(g, me) {
      const X = 262, it = this.hov;
      g.aligned(X, X + 258, 22, "Ficha del objeto", INK, { bold: true });
      const info = it && g.describeDef && g.describeDef(it.id, it);
      if (!info) { this.wrap(g, "Pasa el ratón sobre un objeto para ver su sprite, sus estadísticas y cómo se compara con lo que llevas puesto.", 226, 11).forEach((l, i) => g.text(X + 16, 90 + i * 14, l, INK, { size: 11 })); return; }
      if (info.sprite) g.putGame(info.sprite[0], info.sprite[1], X + 129, 82);
      g.aligned(X, X + 258, 120, info.name, INK, { bold: true, size: 11 });
      const price = this.st && !this.st.mine ? it.price : this.set.find(s => s.uid === it.uid)?.price;
      let y = 138;
      const put = (t, c) => { for (const l of this.wrap(g, tr(t), 226, 10)) { if (y > 276) return; g.text(X + 16, y, l, c || INK, { size: 10 }); y += 12; } };
      if (price) put((this.st && !this.st.mine ? tr("Precio:") : tr("Tu precio:")) + " " + comma(price) + " " + tr("c/u") + (this.st && !this.st.mine ? " · " + tr("Tienes") + " " + comma(me?.gold || 0) : ""), this.st && !this.st.mine && (me?.gold || 0) < price ? RED : "#1a6b1a");
      for (const l of info.lines) put(l.t, l.c === "#9fe39a" ? "#1a6b1a" : l.c === "#e39a9a" ? RED : l.c ? INK : null);
    }
    drawBody(g, me, lx, ly) {
      if (this.mode === "setup") { g.text(this.mx, 58, "1. Clic en un objeto: pon su precio (✔).", INK, { size: 10 }); g.text(this.mx, 70, "2. Pulsa «Abrir tienda». Ok cierra sin abrir.", INK, { size: 10 });
        const on = lx >= 22 && lx <= 122 && ly >= 292 && ly <= 312, c = g.ctx, ready = this.set.length > 0;
        c.fillStyle = !ready ? "#5a5040" : on ? "#2f7a2f" : "#1a6b1a"; c.fillRect(22, 292, 100, 20); c.strokeStyle = "#2d1919"; c.lineWidth = 1; c.strokeRect(22.5, 292.5, 99, 19);
        g.aligned(22, 122, 297, "Abrir tienda", "#fff", { size: 10, bold: true }); }
      else if (this.st) g.text(this.mx, 62, this.st.title + " · " + this.st.owner, INK, { size: 11, bold: true });
      if (this.mode === "view" && this.st && !this.st.items.length) g.aligned(0, this.w, 120, "No queda nada a la venta.", INK);
    }
    click(g, lx, ly, me) {
      if (lx > 262) return this.fixed === true;
      if (this.mode === "setup" && lx >= 22 && lx <= 122 && ly >= 292 && ly <= 312) { this.pick({ act: "go" }, me); return true; }
      const W = this.w; this.w = 258; try { return super.click(g, lx, ly, me); } finally { this.w = W; }
    }
    pick(r, me) {
      if (r.act === "go") {
        if (!this.set.length) { api.log("Primero elige algún objeto de la lista y ponle precio."); return; }
        ask("Rótulo del puesto (máx. 24 letras):", "En venta").then(v => {
          if (v === null) return;
          api.send({ t: "stallopen", title: (v.trim() || "En venta").slice(0, 24), items: this.set.map(s => ({ uid: s.uid, price: s.price, count: s.count })) });
        }); return;
      }
      if (r.act === "take") { api.send({ t: "stalltake" }); return; }
      if (r.act === "close") { api.send({ t: "stallclose" }); return; }
      if (this.mode === "setup") {
        const i = this.set.findIndex(s => s.uid === r.it.uid);
        if (i >= 0) { this.set.splice(i, 1); return; }
        if (this.set.length >= 8) { api.log("Un puesto admite hasta 8 objetos."); return; }
        ask("Precio por unidad de " + this.label(r.it) + ":", "100", true).then(v => {
          const price = Math.floor(+v);
          if (price >= 1 && !this.set.some(s => s.uid === r.it.uid)) this.set.push({ uid: r.it.uid, price, count: r.it.count || 1 });
        });
        return;
      }
      if (this.st && !this.st.mine) api.send({ t: "stallbuy", sid: this.st.sid, uid: r.it.uid, count: (window.event?.ctrlKey || this.ctrl) ? r.it.count : 1 });
    }
    onClose() { this.hov = null; this.mode = "off"; this.st = null; this.set = []; }
  }();
  gui.register(dlg);
  const show = () => { if (!gui.isOpen(48)) gui.open(48); };
  return {
    setup() { if (api.mapId && !MAPS.has(api.mapId())) { api.log("Los puestos solo se pueden montar dentro de un warehouse.", "bad"); return; } dlg.mode = "setup"; dlg.set = []; dlg.st = null; dlg.title = "Montar un puesto"; dlg.footer = "Clic: poner a la venta (pide el precio por unidad); otro clic lo quita."; dlg.view = 0; show(); },
    view(cit) { api.send({ t: "stallview", sid: cit.stall.sid }); },
    setCtrl(v) { dlg.ctrl = v; },
    onEvent(ev, me) {
      if (ev.id !== me?.id) return;
      if (ev.t === "stallsale") { api.log("Compras " + (ev.count > 1 ? ev.count + " × " : "") + itemName(ev.item) + " a " + ev.owner + " por " + comma(ev.price) + " de oro.", "gold"); return; }
      if (ev.t !== "stall") return;
      switch (ev.k) {
        case "view": dlg.mode = ev.mine ? "mine" : "view"; dlg.st = ev; dlg.title = ev.mine ? "Tu puesto" : ev.owner; dlg.footer = ev.mine ? "Cobras con «Recoger oro». Seguirá abierto aunque te desconectes." : "Clic en una fila para comprar (Ctrl = toda la pila). Comisión 0."; show(); break;
        case "opened": gui.close(48); api.log("Tu puesto está abierto: sigue vendiendo aunque te desconectes.", "gold"); break;
        case "closed": gui.close(48); api.log("Puesto cerrado." + (ev.gold ? " Recoges " + comma(ev.gold) + " de oro." : ""), "gold"); break;
        case "expired": api.log("Tu puesto se ha cerrado: lo que quedaba (objetos y oro) vuelve a ti.", "gold"); break;
        case "took": api.log("Recoges " + comma(ev.gold) + " de oro del puesto.", "gold"); break;
        case "nogold": api.log("No tienes oro suficiente.", "bad"); break;
        case "cantcarry": api.log("No cabe en tu mochila.", "bad"); break;
      }
    },
  };
}
