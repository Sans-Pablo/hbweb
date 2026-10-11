// Cuadro «Trade» (id 33): comercio con otros jugadores y habitantes. INVENTO del port, a partir del intercambio del original
// (DEF_COMMONTYPE_EXCHANGEITEMTOCHAR / SETEXCHANGEITEM / CONFIRMEXCHANGEITEM). La lógica está en shared/systems/trade.js.
//   - T sobre un jugador (o el más cercano) o «/trade nombre»: pide comerciar. El otro acepta o rechaza.
//   - Ventana: tu oferta (clic en un objeto = quitarlo), lo que ofrece el otro, y tu mochila (clic en un objeto = ofrecerlo). Oro con los botones.
//   - Cuando los dos pulsan Confirm se hace el cambio entero. Cualquier cambio quita las confirmaciones.
import { ClassicDialog, INK, RED, WHITE } from "./classicdialog.js";
import { itemName, itemDef, packKey } from "./names.js";
import { attrLines } from "../shared/attributes.js";
import { itemLevel } from "../shared/itemlevel.js";

const GOLD = 90;
const inside = (lx, ly, x1, x2, y1, y2) => lx >= x1 && lx <= x2 && ly >= y1 && ly <= y2;
const STEPS = [["-100", -100], ["-10", -10], ["+10", 10], ["+100", 100], ["+1k", 1000]];
const comma = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const label = it => itemName(it.id, it.attr) + (it.count > 1 ? " x" + it.count : "") + "  (iLvl " + (it.ilvl ?? itemLevel(itemDef(it.id), it.attr, it.id)) + ")";

// Ventana como el intercambio del original (DrawDialogBox_Exchange: sprite GameDialog 10 «Exchange Item»): 4 casillas tuyas a la izquierda y 4 del otro a la
// derecha (posiciones 48+58·i y +20 en la mitad derecha, y = 130), nombres arriba, ficha del objeto bajo el cursor abajo a la izquierda y botones Exchange / Cancel.
// Añadidos del port: oro con botones, tu mochila para elegir qué ofrecer (clic = ofrecer, clic en tu casilla = retirar) y el estado de cada lado.
const SLOT_X = j => 48 + 58 * j, SLOT_Y = 130, THEIR_X = j => SLOT_X(j) + 20 + 4 * 58;
const BAG = { x: 200, y: 240, cols: 9, cell: 34, rows: 2 };
export function registerTrade(gui, api) {
  const dlg = new class extends ClassicDialog {
    constructor() { super({ id: 33, x: 135, y: 70, w: 523, h: 356, title: "" }); this.mode = "off"; this.st = null; this.name = ""; this.bagView = 0; this.fixed = false; }
    bagItems(me) {
      const offered = new Set((this.st?.mine.items || []).map(i => i.uid)), worn = new Set(Object.values(me?.equip || {}));
      return (me?.bag || []).filter(it => !offered.has(it.uid) && !worn.has(it.uid) && !it.comp && it.id !== GOLD);
    }
    icon(g, it, x, y, alpha = 1) {
      const d = itemDef(it.id); if (!d) return;
      g.putGame(packKey(d), d.spriteFrame, x, y, alpha);
      if (it.count > 1) g.text(x + 8, y + 10, it.count > 999 ? Math.floor(it.count / 1000) + "k" : String(it.count), "#c8c8c8", { shadow: true, size: 10 });
    }
    draw(g, me) {
      const lx = g.mouse.x - this.x, ly = g.mouse.y - this.y, st = this.st, trade = this.mode === "trade" && st;
      g.put("gamedialog_10", 0, 0, 0);
      g.aligned(25, 250, 40, me?.name || "", "#233723", { bold: true, size: 12 });
      if (this.name) g.aligned(278, 500, 40, this.name, "#233723", { bold: true, size: 12 });
      let hover = null;
      const mine = trade ? st.mine.items : [], theirs = trade ? st.theirs.items : [];
      for (let j = 0; j < 4; j++) {
        const a = mine[j], b = theirs[j];
        if (a) { this.icon(g, a, SLOT_X(j), SLOT_Y); if (inside(lx, ly, SLOT_X(j) - 6, SLOT_X(j) + 42, 61, 200)) hover = a; }
        if (b) { this.icon(g, b, THEIR_X(j), SLOT_Y); if (inside(lx, ly, THEIR_X(j) - 6, THEIR_X(j) + 42, 61, 200)) hover = b; }
      }
      if (trade) {
        g.text(30, 214, "Gold: " + comma(st.mine.gold), INK, { size: 11, bold: true });
        STEPS.forEach(([s], i) => g.text(112 + i * 30, 214, s, inside(lx, ly, 110 + i * 30, 138 + i * 30, 210, 226) ? WHITE : "#040032", { size: 10 }));
        g.text(285, 214, "Gold: " + comma(st.theirs.gold), INK, { size: 11, bold: true });
        if (st.mine.ok) g.text(220, 214, "✔", "#1a6b1a", { size: 13, bold: true });
        if (st.theirs.ok) g.text(470, 214, "✔", "#1a6b1a", { size: 13, bold: true });
        // tu mochila (clic = ofrecer)
        const items = this.bagItems(me), per = BAG.cols * BAG.rows, maxView = Math.max(0, Math.ceil(items.length / BAG.cols) - BAG.rows);
        this.bagView = Math.max(0, Math.min(this.bagView, maxView));
        g.text(BAG.x, BAG.y - 14, "Your bag - click an item to offer it", INK, { size: 10 });
        for (let k = 0; k < per; k++) {
          const it = items[this.bagView * BAG.cols + k]; if (!it) break;
          const x = BAG.x + (k % BAG.cols) * BAG.cell + 8, y = BAG.y + Math.floor(k / BAG.cols) * BAG.cell + 6;
          this.icon(g, it, x, y);
          if (inside(lx, ly, x - 8, x + 24, y - 6, y + 26)) hover = it;
        }
        if (maxView) g.text(BAG.x + BAG.cols * BAG.cell + 4, BAG.y, this.bagView > 0 ? "▲" : " ", INK, { size: 9 }), g.text(BAG.x + BAG.cols * BAG.cell + 4, BAG.y + 40, this.bagView < maxView ? "▼" : " ", INK, { size: 9 });
      }
      // ficha del objeto (abajo a la izquierda, como el original)
      if (hover) {
        const d = itemDef(hover.id), lines = [itemName(hover.id, hover.attr) + (hover.count > 1 ? "  x" + hover.count : ""), "Item level " + (hover.ilvl ?? itemLevel(d, hover.attr, hover.id)), d && d.price > 0 ? "Worth " + Math.floor(d.price / 2) + " gold" : "", ...attrLines(hover.attr)].filter(Boolean);
        lines.slice(0, 7).forEach((t, i) => g.text(15, 232 + i * 13, t, i === 0 ? "#233723" : INK, { size: i === 0 ? 11 : 10, bold: i === 0 }));
      } else {
        const msg = this.mode === "query" ? [this.name + " wants to trade", "with you."] : this.mode === "wait" ? ["Waiting for " + this.name, "to answer..."]
          : !trade ? [] : !mine.length && !theirs.length && !st.mine.gold && !st.theirs.gold ? ["Choose what to offer from your", "bag. Both press Exchange to swap."]
          : st.mine.ok && !st.theirs.ok ? ["Waiting for " + this.name + " to confirm.", "Press Cancel to stop the trade."]
          : st.theirs.ok && !st.mine.ok ? [this.name + " is ready.", "Press Exchange to accept."] : ["Any change cancels the confirmations.", "Press Exchange when you agree."];
        msg.forEach((t, i) => g.text(15, 236 + i * 14, t, "#371919", { size: 10 }));
      }
      this.hov = hover ? hover.uid : null;
      // botones (Exchange en 200,310 y Cancel en 450,310 como el original)
      const ex = this.mode === "query" ? "Accept" : trade ? (st.mine.ok ? "Confirmed" : "Exchange") : "", cn = this.mode === "query" ? "Decline" : "Cancel";
      if (ex) g.text(220, 322, ex, inside(lx, ly, 200, 330, 316, 340) ? "#06061f" : "#00000a", { bold: true, size: 14 });
      if (this.mode !== "off") g.text(450, 322, cn, inside(lx, ly, 450, 560, 316, 340) ? "#06061f" : "#00000a", { bold: true, size: 14 });
    }
    hoverOk() { return false; }
    click(g, lx, ly, me) {
      const st = this.st, trade = this.mode === "trade" && st;
      if (inside(lx, ly, 450, 520, 316, 340)) { api.send(this.mode === "query" ? { t: "tradeanswer", r: 0 } : { t: "tradecancel" }); if (this.mode !== "trade") { this.mode = "off"; g.close(this.id); } return true; }
      if (inside(lx, ly, 200, 330, 316, 340)) { if (this.mode === "query") { api.send({ t: "tradeanswer", r: 1 }); this.mode = "off"; g.close(this.id); } else if (trade) api.send({ t: "tradeok" }); return true; }
      if (trade) {
        for (let j = 0; j < Math.min(4, st.mine.items.length); j++) if (inside(lx, ly, SLOT_X(j) - 6, SLOT_X(j) + 42, 61, 200)) { api.send({ t: "tradeunset", uid: st.mine.items[j].uid }); return true; }
        STEPS.forEach(([, d], i) => { if (inside(lx, ly, 110 + i * 30, 138 + i * 30, 210, 226)) api.send({ t: "tradegold", n: Math.max(0, Math.min(me?.gold || 0, st.mine.gold + d)) }); });
        const items = this.bagItems(me);
        for (let k = 0; k < BAG.cols * BAG.rows; k++) {
          const it = items[this.bagView * BAG.cols + k]; if (!it) break;
          const x = BAG.x + (k % BAG.cols) * BAG.cell, y = BAG.y + Math.floor(k / BAG.cols) * BAG.cell;
          if (inside(lx, ly, x, x + BAG.cell, y, y + BAG.cell) && st.mine.items.length < 4) { api.send({ t: "tradeset", uid: it.uid }); return true; }
        }
      }
      return false;                                            // clic en un hueco: se agarra el cuadro para moverlo (gui.down)
    }
    wheel(g, d) { this.bagView -= d; }
    onClose() { if (this.mode === "trade" || this.mode === "wait") api.send({ t: "tradecancel" }); else if (this.mode === "query") api.send({ t: "tradeanswer", r: 0 }); this.mode = "off"; }
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
