// Cuadro «Puesto» (id 48): tiendas de jugador (INVENTO del port; lógica en shared/systems/stall.js). Tres vistas:
//   - ver: clic en el puesto de otro jugador → lista de objetos con precio, clic en una fila = comprar 1 (Ctrl = toda la pila).
//   - mío: tu puesto → lo mismo pero con «Recoger oro» y «Cerrar puesto».
//   - montar: «/puesto» dentro de shop, warehouse o herrería → tu mochila; clic en un objeto = ponerlo (pide el precio), «Abrir puesto» lo monta.
import { ClassicDialog, INK, RED } from "./classicdialog.js";
import { itemName, itemDef } from "./names.js";

const GOLD = 90;
const comma = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export function registerStall(gui, api) {
  const dlg = new class extends ClassicDialog {
    constructor() { super({ id: 48, title: "Puesto", top: 84, rowH: 16, footer: "Clic en una fila para comprar (Ctrl = toda la pila). Comisión 0." }); this.mode = "off"; this.st = null; this.set = []; this.ctrl = false; }
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
    drawBody(g, me, lx, ly) {
      if (this.mode === "setup") { g.text(this.mx, 58, "1. Clic en un objeto: pon su precio (✔).", INK, { size: 10 }); g.text(this.mx, 70, "2. Pulsa «Abrir tienda». Ok cierra sin abrir.", INK, { size: 10 });
        const on = lx >= 22 && lx <= 122 && ly >= 292 && ly <= 312, c = g.ctx, ready = this.set.length > 0;
        c.fillStyle = !ready ? "#5a5040" : on ? "#2f7a2f" : "#1a6b1a"; c.fillRect(22, 292, 100, 20); c.strokeStyle = "#2d1919"; c.lineWidth = 1; c.strokeRect(22.5, 292.5, 99, 19);
        g.aligned(22, 122, 297, "Abrir tienda", "#fff", { size: 10, bold: true }); }
      else if (this.st) g.text(this.mx, 62, this.st.title + " · " + this.st.owner, INK, { size: 11, bold: true });
      if (this.mode === "view" && this.st && !this.st.items.length) g.aligned(0, this.w, 120, "No queda nada a la venta.", INK);
    }
    click(g, lx, ly, me) {
      if (this.mode === "setup" && lx >= 22 && lx <= 122 && ly >= 292 && ly <= 312) { this.pick({ act: "go" }, me); return true; }
      return super.click(g, lx, ly, me);
    }
    pick(r, me) {
      if (r.act === "go") {
        if (!this.set.length) { api.log("Primero elige algún objeto de la lista y ponle precio."); return; }
        const title = (window.prompt("Rótulo del puesto (máx. 24 letras):", "En venta") || "En venta").slice(0, 24);
        api.send({ t: "stallopen", title, items: this.set.map(s => ({ uid: s.uid, price: s.price, count: s.count })) }); return;
      }
      if (r.act === "take") { api.send({ t: "stalltake" }); return; }
      if (r.act === "close") { api.send({ t: "stallclose" }); return; }
      if (this.mode === "setup") {
        const i = this.set.findIndex(s => s.uid === r.it.uid);
        if (i >= 0) { this.set.splice(i, 1); return; }
        if (this.set.length >= 8) { api.log("Un puesto admite hasta 8 objetos."); return; }
        const price = Math.floor(+window.prompt("Precio por unidad de " + this.label(r.it) + ":", "100"));
        if (price >= 1) this.set.push({ uid: r.it.uid, price, count: r.it.count || 1 });
        return;
      }
      if (this.st && !this.st.mine) api.send({ t: "stallbuy", sid: this.st.sid, uid: r.it.uid, count: (window.event?.ctrlKey || this.ctrl) ? r.it.count : 1 });
    }
    onClose() { this.mode = "off"; this.st = null; this.set = []; }
  }();
  gui.register(dlg);
  const show = () => { if (!gui.isOpen(48)) gui.open(48); };
  return {
    setup() { dlg.mode = "setup"; dlg.set = []; dlg.st = null; dlg.title = "Montar un puesto"; dlg.view = 0; show(); },
    view(cit) { api.send({ t: "stallview", sid: cit.stall.sid }); },
    setCtrl(v) { dlg.ctrl = v; },
    onEvent(ev, me) {
      if (ev.id !== me?.id) return;
      if (ev.t === "stallsale") { api.log("Compras " + (ev.count > 1 ? ev.count + " × " : "") + itemName(ev.item) + " a " + ev.owner + " por " + comma(ev.price) + " de oro.", "gold"); return; }
      if (ev.t !== "stall") return;
      switch (ev.k) {
        case "view": dlg.mode = ev.mine ? "mine" : "view"; dlg.st = ev; dlg.title = ev.mine ? "Tu puesto" : "Puesto de " + ev.owner; dlg.footer = ev.mine ? "Cobras con «Recoger oro». Seguirá abierto aunque te desconectes." : "Clic en una fila para comprar (Ctrl = toda la pila). Comisión 0."; show(); break;
        case "opened": gui.close(48); api.log("Tu puesto está abierto: sigue vendiendo aunque te desconectes.", "gold"); break;
        case "closed": gui.close(48); api.log("Puesto cerrado." + (ev.gold ? " Recoges " + comma(ev.gold) + " de oro." : ""), "gold"); break;
        case "took": api.log("Recoges " + comma(ev.gold) + " de oro del puesto.", "gold"); break;
        case "nogold": api.log("No tienes oro suficiente.", "bad"); break;
        case "cantcarry": api.log("No cabe en tu mochila.", "bad"); break;
      }
    },
  };
}
