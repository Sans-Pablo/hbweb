// Cuadro «Trade» (id 33): comercio con otros jugadores y habitantes. INVENTO del port, a partir del intercambio del original
// (DEF_COMMONTYPE_EXCHANGEITEMTOCHAR / SETEXCHANGEITEM / CONFIRMEXCHANGEITEM). La lógica está en shared/systems/trade.js.
//   - T sobre un jugador (o el más cercano) o «/trade nombre»: pide comerciar. El otro acepta o rechaza.
//   - Ventana: tu oferta (clic en un objeto = quitarlo), lo que ofrece el otro, y tu mochila (clic en un objeto = ofrecerlo). Oro con los botones.
//   - Cuando los dos pulsan Confirm se hace el cambio entero. Cualquier cambio quita las confirmaciones.
import { ClassicDialog, INK, RED, WHITE } from "./classicdialog.js";
import { itemName, itemDef } from "./names.js";
import { attrLines } from "../shared/attributes.js";
import { itemLevel } from "../shared/itemlevel.js";

const GOLD = 90;
const inside = (lx, ly, x1, x2, y1, y2) => lx >= x1 && lx <= x2 && ly >= y1 && ly <= y2;
const STEPS = [["-100", -100], ["-10", -10], ["+10", 10], ["+100", 100], ["+1k", 1000]];
const label = it => itemName(it.id, it.attr) + (it.count > 1 ? " x" + it.count : "") + "  (iLvl " + (it.ilvl ?? itemLevel(itemDef(it.id), it.attr, it.id)) + ")";

export function registerTrade(gui, api) {
  const dlg = new class extends ClassicDialog {
    constructor() { super({ id: 33, x: 120, y: 80, title: "Trade", rowH: 15, top: 58, visible: 12 }); this.mx = 16; this.mode = "off"; this.st = null; this.name = ""; }
    rows(me) {
      if (this.mode !== "trade" || !this.st) return [];
      const { mine, theirs } = this.st, out = [];
      out.push({ text: "Your offer · gold " + mine.gold + (mine.ok ? "  ✔" : ""), color: RED, disabled: true });
      for (const it of mine.items) out.push({ text: "  " + label(it), act: "unset", uid: it.uid, tip: itemTip(it, "Click to take it back.") });
      out.push({ text: this.name + " offers · gold " + theirs.gold + (theirs.ok ? "  ✔" : ""), color: RED, disabled: true });
      for (const it of theirs.items) out.push({ text: "  " + label(it), disabled: true, tip: itemTip(it, "") });
      const offered = new Set(mine.items.map(i => i.uid)), worn = new Set(Object.values(me?.equip || {}));
      out.push({ text: "Your bag (click to offer)", color: RED, disabled: true });
      for (const it of me?.bag || []) if (!offered.has(it.uid) && !worn.has(it.uid) && !it.comp && it.id !== GOLD) out.push({ text: "  " + label(it), act: "set", uid: it.uid, tip: itemTip(it, "Click to offer it.") });
      return out;
    }
    pick(r) { if (r.act === "set") api.send({ t: "tradeset", uid: r.uid }); else if (r.act === "unset") api.send({ t: "tradeunset", uid: r.uid }); }
    drawBody(g, me, lx, ly) {
      const line = (y, s, c = INK) => g.aligned(0, this.w, y, s, c);
      if (this.mode === "query") { line(110, this.name + " wants to trade"); line(125, "with you."); this.btns(g, lx, ly, [[24, 170, "Accept"], [140, 170, "Decline"]]); return; }
      if (this.mode === "wait") { line(110, "Waiting for " + this.name + " to answer…"); this.btns(g, lx, ly, [[80, 170, "Cancel"]]); return; }
      if (this.mode !== "trade" || !this.st) return;
      g.text(16, 236, "Gold:", INK, { size: 11 });
      STEPS.forEach(([s], i) => g.text(52 + i * 38, 236, "[" + s + "]", inside(lx, ly, 50 + i * 38, 86 + i * 38, 232, 250) ? WHITE : "#040032", { size: 11 }));
      this.btns(g, lx, ly, [[16, 276, this.st.mine.ok ? "Confirmed ✔" : "Confirm"], [130, 276, "Cancel"]]);
    }
    btns(g, lx, ly, list) { for (const [x, y, s] of list) g.text(x, y, "[ " + s + " ]", inside(lx, ly, x - 4, x + 90, y - 3, y + 14) ? WHITE : RED, { size: 12, bold: true }); }
    hoverOk() { return false; }                                  // no hay botón «Ok»: se cierra cancelando
    click(g, lx, ly, me) {
      const hit = (x, y, w = 90) => inside(lx, ly, x - 4, x + w, y - 3, y + 14);
      if (this.mode === "query") { if (hit(24, 170)) { api.send({ t: "tradeanswer", r: 1 }); this.mode = "off"; g.close(this.id); } else if (hit(140, 170)) { api.send({ t: "tradeanswer", r: 0 }); this.mode = "off"; g.close(this.id); } return true; }
      if (this.mode === "wait") { if (hit(80, 170)) { api.send({ t: "tradecancel" }); this.mode = "off"; g.close(this.id); } return true; }
      if (this.mode === "trade" && this.st) {
        if (hit(16, 276)) { api.send({ t: "tradeok" }); return true; }
        if (hit(130, 276, 60)) { api.send({ t: "tradecancel" }); return true; }
        STEPS.forEach(([, d], i) => { if (inside(lx, ly, 50 + i * 38, 86 + i * 38, 232, 250)) api.send({ t: "tradegold", n: Math.max(0, Math.min(me?.gold || 0, this.st.mine.gold + d)) }); });
      }
      return super.click(g, lx, ly, me);
    }
    onClose() { if (this.mode === "trade") api.send({ t: "tradecancel" }); else if (this.mode === "wait") api.send({ t: "tradecancel" }); else if (this.mode === "query") api.send({ t: "tradeanswer", r: 0 }); this.mode = "off"; }
  }();
  const itemTip = (it, extra) => { const d = itemDef(it.id); return [d && d.price > 0 ? "Worth " + Math.floor(d.price / 2) : "", ...attrLines(it.attr), extra].filter(Boolean).join(" · "); };
  gui.register(dlg);
  const open = () => { if (!gui.isOpen(33)) gui.open(33); else gui.front?.(33); };
  return {
    start(name) { api.send({ t: "tradereq", name }); dlg.mode = "wait"; dlg.name = name; open(); },
    onEvent(ev, me) {
      if (ev.id !== me?.id) return;
      if (ev.t === "tradequery") { if (ev.from == null) { if (dlg.mode === "query") { dlg.mode = "off"; gui.close(33); } } else { dlg.mode = "query"; dlg.name = ev.from; open(); } return; }
      if (ev.t !== "trade") return;
      switch (ev.k) {
        case "open": dlg.mode = "trade"; dlg.name = ev.name; dlg.st = null; open(); break;
        case "state": dlg.mode = "trade"; dlg.name = ev.name; dlg.st = { mine: ev.mine, theirs: ev.theirs }; break;
        case "done": {
          const f = s => [...s.items.map(i => itemName(i.id) + (i.count > 1 ? " x" + i.count : "")), s.gold ? s.gold + " gold" : ""].filter(Boolean).join(", ") || "nothing";
          api.log("Trade with " + ev.name + " done. You gave: " + f(ev.gave) + ". You got: " + f(ev.got) + ".", "gold"); dlg.mode = "off"; dlg.st = null; gui.close(33); break;
        }
        case "cancel": api.log("The trade was cancelled."); dlg.mode = "off"; dlg.st = null; gui.close(33); break;
        case "refused": api.log(ev.name + " does not want to trade."); dlg.mode = "off"; gui.close(33); break;
        case "nofit": api.log("It doesn't fit: weight or bag space.", "bad"); break;
      }
    },
  };
}
