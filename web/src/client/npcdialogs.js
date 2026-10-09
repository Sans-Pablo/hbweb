// Cuadros de diálogo de los NPC de ciudad, como en el cliente original (Game.cpp):
//   20 menú del NPC (DrawDialogBox_NpcActionQuery)   11 tienda (DrawDialogBox_Shop)
//   14 almacén (DrawDialogBox_Bank)                  23 vender / reparar (DrawDialogBox_SellorRepairItem)
//   31 lista de venta (DrawDialogBox_SellList)       17 cantidad (DrawDialogBox_QueryDropItemAmount)
// Todo el estado de la compra-venta vive aquí; la simulación (shared/systems/shopsys.js) hace de servidor.
import { itemDef, itemName, itemSet, packKey } from "./names.js";
import { EQUIP, ITYPE, isStack } from "../shared/items.js";
import { listPrice, NPC, MAX_BANK, MAX_SELL_LIST } from "../shared/systems/shopsys.js";
import { attrLines } from "../shared/attributes.js";
import { ClassicDialog } from "./classicdialog.js";
import { SPECIES, HOSPITAL, treatCost, hpOf, maxOf } from "../shared/systems/companion.js";

const INK = "#2d1919", DARK = "#040032", WHITE = "#fff", RED = "#c31919", ALERT = "#7d1919";
const BTN = { w: 74, h: 20, left: 30, right: 154, y: 292 };                          // DEF_BTNSZX/Y, DEF_LBTNPOSX, DEF_RBTNPOSX, DEF_BTNPOSY
const NPC_NAMES = { [NPC.SHOP]: "Shop Keeper", [NPC.MAGE]: "Sorcerer", [NPC.WAREHOUSE]: "Warehouse Keeper", [NPC.BLACKSMITH]: "BlackSmith Keeper" };
// NpcTalkHandler: iWho 2 tienda, 3 herrería, 5 almacén, 6 mago -> texto contents{iWho+150}
const TALK_ID = { [NPC.SHOP]: 152, [NPC.BLACKSMITH]: 153, [NPC.WAREHOUSE]: 155, [NPC.MAGE]: 156 };
const SHOP_ROWS = 13, SHOP_ROW_H = 18, BANK_ROWS = 13, BANK_ROW_H = 15;
const MAX_ITEMS = 50;

const inside = (lx, ly, x1, x2, y1, y2) => lx > x1 && lx < x2 && ly > y1 && ly < y2;
const within = (lx, ly, x1, x2, y1, y2) => lx >= x1 && lx <= x2 && ly >= y1 && ly <= y2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const stat = (me, k) => (me.stats ? me.stats[k] : 10);

export function registerNpcDialogs(gui, api) {
  const g0 = gui;
  const trade = {                     // lo que se está comprando / vendiendo ahora mismo
    npc: null,                        // { id, type, x, y } del NPC con el que se habla
    sellList: [],                     // [{ uid, count }] (hasta 12)
    busy: new Set(),                  // objetos "desactivados" mientras esperan una operación (m_bIsItemDisabled)
  };
  const bagCount = me => me.bag.length;
  const bagItem = (me, uid) => me.bag.find(i => i.uid === uid);

  // texto "en negrita" del original: se dibuja dos veces con un píxel de diferencia
  const shadowed = (g, x, y, s, color) => { g.text(x, y, s, color); g.text(x + 1, y, s, color); };
  // botón de texto del menú del NPC: blanco bajo el cursor, azul oscuro en reposo
  const link = (g, lx, ly, x, y, s, x1, x2) => shadowed(g, x, y, s, inside(lx, ly, x1, x2, y - 5, y + 15) ? WHITE : DARK);
  const button = (g, lx, ly, x, norm, hover) => g.put("dialogtext_1", within(lx, ly, x, x + BTN.w, BTN.y, BTN.y + BTN.h) ? hover : norm, x, BTN.y);
  const onButton = (lx, ly, x) => within(lx, ly, x, x + BTN.w, BTN.y, BTN.y + BTN.h);
  const rel = (g, d) => [g.mouse.x - d.x, g.mouse.y - d.y];

  // ------------------------------------------------------------ 17: cantidad
  // Se abre al soltar una pila: tirarla, dársela a un NPC, ponerla en la lista de venta o en el almacén.
  const quantity = {
    id: 17, x: 0, y: 0, w: 215, h: 87, fixed: false, text: "", ask: null,
    open(ask, mx, my) {
      this.ask = ask; this.text = "";
      this.x = clamp(mx - 140, 0, 800 - this.w); this.y = clamp(my - 70, 0, 600 - 150);
      trade.busy.add(ask.uid);
      gui.open(17);
    },
    onClose() { if (this.ask) trade.busy.delete(this.ask.uid); },
    draw(g, me) {
      g.put("gamedialog_1", 5, 0, 0);
      const it = this.ask && bagItem(me, this.ask.uid);
      if (!it) return;
      const name = itemName(it.id, it.attr, it.comp), a = this.ask;
      if (a.kind !== "list" && a.kind !== "deposit") g.text(30, 20, a.target ? name + ": give to " + a.target + "." : " Dropping " + name + ".", INK);
      g.text(30, 35, "Decide the quantity.", INK);
      g.text(40, 52, this.text, WHITE, { bold: true });
      g.text(38, 57, "__________ (0 ~ " + it.count + ")", "#192319");
    },
    // el teclado va a este cuadro mientras esté abierto (Enter confirma, Esc cancela)
    key(e, g) {
      const me = api.me(), it = me && this.ask && bagItem(me, this.ask.uid);
      if (e.key === "Escape") { g.close(17); return true; }
      if (e.key === "Backspace") { this.text = this.text.slice(0, -1); return true; }
      if (/^\d$/.test(e.key) && this.text.length < 6) { this.text += e.key; return true; }
      if (e.key !== "Enter") return e.key.length === 1;
      const n = parseInt(this.text || "0", 10), a = this.ask;
      if (!it) { g.close(17); return true; }
      if (n <= 0) { api.log("You entered 0. Cancelled."); return true; }
      if (n > it.count) { api.log("You entered more quantity than you carry."); return true; }
      g.close(17, true); trade.busy.delete(a.uid); this.ask = null;
      a.then(n);
      return true;
    },
    click() { return false; },
  };
  gui.register(quantity);

  // ------------------------------------------------------------ 21: conversación (DrawDialogBox_NpcTalk)
  const talkText = {
    id: 21, x: 200, y: 100, w: 258, h: 339, lines: [], view: 0, drag: false,
    begin(n) { this.lines = (api.talk || {})[n] || []; this.view = 0; gui.open(21); },
    draw(g) {
      const [lx, ly] = rel(g, this), n = this.lines.length;
      g.put("gamedialog_1", 2, 0, 0);
      button(g, lx, ly, BTN.right, 0, 1);
      if (n > 17) {
        g.put("gamedialog_1", 3, 0, 0);
        g.put("gamedialog_1", 7, 242, Math.floor((274 * this.view) / (n - 17)) + 35);
        if (this.drag && g.mouse.down) this.view = clamp(Math.floor(((ly - 40) * (n - 17)) / 274), 0, n - 17); else this.drag = false;
      }
      for (let i = 0; i < 17; i++) { const s = this.lines[i + this.view]; if (s != null) g.aligned(0, this.w, 57 + i * 15, s, INK); }
    },
    click(g, lx, ly) {
      if (onButton(lx, ly, BTN.right)) { g.close(21); return true; }
      if (this.lines.length > 17 && within(lx, ly, 240, 260, 40, 320)) { this.drag = true; return true; }
      return false;
    },
  };
  gui.register(talkText);

  // ------------------------------------------------------------ 20: menú del NPC
  // modo 0: Learn / Withdraw / Offer / Trade + Talk · 2: objeto a la tienda o herrería · 3: objeto al almacén · 5: Trade / Sell / Talk
  const query = {
    id: 20, x: 317, y: 117, w: 215, h: 87, mode: 0, npcType: 0, link: 0, shop: 0, uid: 0, count: 1, who: "",
    draw(g, me) {
      const [lx, ly] = rel(g, this);
      g.put("gamedialog_1", this.w === 252 ? 6 : 5, 0, 0);
      const m = this.mode;
      if (m === 0 || m === 5) {
        const name = NPC_NAMES[this.npcType] || "";
        g.text(33, 23, name, INK); g.text(32, 22, name, WHITE);
      }
      if (m === 0) {
        const first = { 20: "Withdraw", 19: "Learn" }[this.npcType] || "Trade";
        link(g, lx, ly, 28, 55, first, 25, 100);
        link(g, lx, ly, 125, 55, "Talk", 125, 180);
      } else if (m === 5) {
        link(g, lx, ly, 28, 55, "Trade", 25, 100);
        link(g, lx, ly, 103, 55, "Sell", 104, 155);
        link(g, lx, ly, 155, 55, "Talk", 155, 210);
      } else if (m === 2 || m === 3) {
        const it = bagItem(me, this.uid);
        if (!it) return;
        g.aligned(0, this.w, 20, this.count + " " + itemName(it.id, it.attr, it.comp) + " to", INK);
        g.aligned(0, this.w, 35, this.who, INK);
        if (m === 3) link(g, lx, ly, 28, 55, "Deposit", 25, 105);
        else {
          link(g, lx, ly, 28, 55, "Sell", 25, 100);
          const d = itemDef(it.id);
          if (d.type !== ITYPE.CONSUME && d.type !== ITYPE.ARROW) link(g, lx, ly, 125, 55, "Repair", 125, 180);
        }
      }
    },
    click(g, lx, ly) {
      const me = api.me(), npc = trade.npc, m = this.mode;
      if (m === 0 || m === 5) {
        if (inside(lx, ly, 25, 100, 55, 70)) {                    // Trade / Learn / Withdraw
          if (m === 5) g.open(11), shop.begin(this.shop); else g.open(this.link);
          g.close(20); return true;
        }
        if (m === 5 && inside(lx, ly, 104, 155, 55, 70)) { g.open(31); g.close(20); return true; }
        const talk = m === 5 ? [155, 210] : [125, 180];
        if (inside(lx, ly, talk[0], talk[1], 55, 70)) { talkText.begin(TALK_ID[this.npcType]); g.close(20); return true; }
      } else if (m === 2) {
        if (inside(lx, ly, 25, 100, 55, 70)) { api.send({ t: "sellreq", uid: this.uid, count: this.count, whom: this.npcType }); g.close(20); return true; }
        const it = bagItem(me, this.uid), d = it && itemDef(it.id);
        if (d && d.type !== ITYPE.CONSUME && d.type !== ITYPE.ARROW && this.count === 1 && inside(lx, ly, 125, 180, 55, 70)) {
          api.send({ t: "repairreq", uid: this.uid, whom: this.npcType }); g.close(20); return true;
        }
      } else if (m === 3 && inside(lx, ly, 25, 105, 55, 70)) {
        if (!npc || Math.max(Math.abs(npc.x - me.x), Math.abs(npc.y - me.y)) > 8) api.log("Too far to give the item.");
        else if ((me.bank || []).length >= MAX_BANK - 1) api.log("There is no empty space left in warehouse.");
        else api.send({ t: "deposit", uid: this.uid, count: this.count });
        g.close(20); return true;
      }
      return false;
    },
    onClose() { trade.busy.delete(this.uid); },
  };
  gui.register(query);

  // hacia dónde se abre el menú: pegado al cursor (tX = msX - 117, tY = msY - 50)
  const place = (mx, my) => { query.x = clamp(mx - 117, 0, 799 - 235); query.y = clamp(my - 50, 0, 599 - 100); };
  const MENU = {          // qué abre cada NPC (Game.cpp, CommandProcessor)
    [NPC.SHOP]: { mode: 5, link: 11, shop: 1 }, [NPC.BLACKSMITH]: { mode: 5, link: 11, shop: 2 },
    [NPC.MAGE]: { mode: 0, link: 16 }, [NPC.WAREHOUSE]: { mode: 0, link: 14 },
  };

  // clic en un NPC de ciudad
  function clickNpc(e, mx, my) {
    if (e.role === HOSPITAL.role) { trade.npc = { id: e.id, type: e.type, x: e.x, y: e.y }; hospital.tab = 0; hospital.view = 0; gui.open(41); return true; }
    const cfg = MENU[e.type]; if (!cfg) return false;
    trade.npc = { id: e.id, type: e.type, x: e.x, y: e.y };
    Object.assign(query, { mode: cfg.mode, npcType: e.type, link: cfg.link, shop: cfg.shop || 0, w: cfg.mode === 5 ? 252 : 215 });
    place(mx, my);
    gui.open(20);
    return true;
  }

  // objeto soltado sobre un NPC (bItemDrop_ExternalScreen): a la tienda / herrería se vende o repara, al almacén se deposita
  function dropOnNpc(e, uid, mx, my) {
    const me = api.me(), it = me && bagItem(me, uid), d = it && itemDef(it.id);
    if (!d || trade.busy.has(uid)) return false;
    if (e.type !== NPC.SHOP && e.type !== NPC.BLACKSMITH && e.type !== NPC.WAREHOUSE) return false;
    trade.npc = { id: e.id, type: e.type, x: e.x, y: e.y };
    if (gui.isOpen(17) || gui.isOpen(23)) { api.log("Item transaction not finished."); return false; }
    const ask = count => {
      const wh = e.type === NPC.WAREHOUSE;
      Object.assign(query, { mode: wh ? 3 : 2, npcType: e.type, uid, count, who: NPC_NAMES[e.type], w: wh ? 252 : 215 });
      place(mx, my); trade.busy.add(uid); gui.open(20);
    };
    if (isStack(d) && it.count > 1) quantity.open({ uid, kind: "give", target: NPC_NAMES[e.type], then: ask }, mx, my);
    else ask(1);
    return true;
  }

  // ------------------------------------------------------------ 11: tienda
  const shop = {
    id: 11, x: 150, y: 110, w: 258, h: 339, type: 1, view: 0, mode: 0, qty: 1, rows: [], drag: false,
    begin(type) { Object.assign(this, { type, rows: (api.shops[type] || []).filter(r => !/^(Big|Super|Power)(Red|Blue|Green)Potion$/.test(r.name)), view: 0, mode: 0, qty: 1 }); },
    onOpen() { if (!this.rows.length) this.begin(this.type); },
    maxQty(me) { return Math.max(1, MAX_ITEMS - bagCount(me)); },
    price(me, row) { return listPrice(stat(me, "chr"), row.price); },
    scrollTo(my, n) { this.view = clamp(Math.round(((my - 35) * (n - SHOP_ROWS)) / 274), 0, Math.max(0, n - SHOP_ROWS)); },
    draw(g, me) {
      const [lx, ly] = rel(g, this), n = this.rows.length;
      g.put("gamedialog_1", 2, 0, 0); g.put("dialogtext_0", 11, 0, 0);
      if (this.mode === 0) {
        if (n > SHOP_ROWS) {
          g.put("gamedialog_1", 3, 0, 0);
          g.put("gamedialog_1", 7, 242, Math.floor((274 * this.view) / (n - SHOP_ROWS)) + 35);
          if (this.drag && g.mouse.down) this.scrollTo(ly, n); else this.drag = false;
        }
        this.view = clamp(this.view, 0, Math.max(0, n - SHOP_ROWS));
        shadowed(g, 23, 45, "ITEM", INK); shadowed(g, 191, 45, "PRICE", INK);
        for (let i = 0; i < SHOP_ROWS; i++) {
          const row = this.rows[i + this.view]; if (!row) break;
          const over = within(lx, ly, 20, 220, i * SHOP_ROW_H + 65, i * SHOP_ROW_H + 79), col = over ? WHITE : DARK;
          g.aligned(10, 190, i * SHOP_ROW_H + 65, row.display, col);
          g.aligned(148, 260, i * SHOP_ROW_H + 65, String(this.price(me, row)).padStart(6, " "), col);
        }
        return;
      }
      this.drawDetail(g, me, this.rows[this.mode - 1], lx, ly);
    },
    drawDetail(g, me, row, lx, ly) {
      if (!row) { this.mode = 0; return; }
      const real = api.itemByName(row.name.replace(/^(10|100)Arrows$/, "Arrow")) || {};
      g.putGame("ip" + itemSet(row.sprite), row.spriteFrame, 57, 104);
      g.aligned(25, 240, 50, row.display, WHITE); g.aligned(26, 241, 50, row.display, WHITE);
      const lab = (x, y, s) => shadowed(g, x, y, s, "#280a0a");
      lab(90, 98, "PRICE"); lab(90, 113, "Weight");
      g.text(140, 98, ": " + this.price(me, row) + " Gold", INK);
      g.text(140, 113, ": " + Math.trunc(row.weight / 100) + " Stone", INK);
      let warn = null;
      const str = stat(me, "str"), center = (s, y, c) => g.aligned(25, 240, y, s, c);
      const weightWarn = () => { if (Math.trunc(row.weight / 100) > str) warn = ["*Your STR should be at least " + Math.trunc(row.weight / 100) + " to use this item.", ALERT]; };
      switch (row.equipPos) {
        case EQUIP.RHAND: case EQUIP.TWOHAND: {
          lab(90, 145, "Damage"); lab(40, 175, "Speed(Min.~Max.)");
          g.text(140, 145, `: ${row.v1}D${row.v2}${row.v3 ? "+" + row.v3 : ""} (S-M)`, INK);
          g.text(140, 160, `: ${row.v4}D${row.v5}${row.v6 ? "+" + row.v6 : ""} (L)`, INK);
          g.text(140, 175, row.speed === 0 ? ": 0(10~10)" : `: ${row.speed}(${Math.trunc(row.weight / 100)} ~ ${row.speed * 13})`, INK);
          weightWarn(); break;
        }
        case EQUIP.LHAND:
          lab(90, 145, "Defence"); g.text(140, 145, ": +" + row.v1 + "%", INK); weightWarn(); break;
        case EQUIP.HEAD: case EQUIP.BODY: case EQUIP.LEGGINGS: case EQUIP.ARMS: case EQUIP.PANTS: {
          lab(90, 145, "Defence"); g.text(140, 145, ": +" + row.v1 + "%", INK);
          const need = { 10: ["Str", "str"], 11: ["Dex", "dex"], 12: ["Vit", "vit"], 13: ["Int", "int"], 14: ["Mag", "mag"], 15: ["Chr", "chr"] }[row.v4];
          let low = false;
          if (need) {
            const ok = stat(me, need[1]) >= row.v5;
            center("Available for above " + need[0] + " " + row.v5, 160, ok ? INK : "#7d1919");
            low = !ok;
          }
          if (low) warn = ["(Warning!) Your stat is too low for this item.", ALERT];
          else weightWarn();
          break;
        }
      }
      if (real.gender === 1 && me.gender === 2 && !warn) warn = ["(Warning!) only for male.", ALERT];
      if (real.gender === 2 && me.gender === 1 && !warn) warn = ["(Warning!) only for female.", ALERT];
      if (row.levelLimit) {
        const ok = me.level >= row.levelLimit;
        lab(90, 190, "Level"); g.text(140, 190, ": above " + row.levelLimit, ok ? INK : RED);
        if (!ok && !warn) warn = ["(Warning!) Your level is too low for this item.", ALERT];
      }
      if (warn) center(warn[0], 258, warn[1]);
      // cantidad: dos flechas (+10 / +1) y dos (-10 / -1)
      g.put("gamedialog_1", 19, 156, 219); g.put("gamedialog_1", 19, 170, 219);
      lab(88, 227, "Quantity:");
      const q = clamp(this.qty, 1, this.maxQty(me)); this.qty = q;
      shadowed(g, 151, 227, q >= 10 ? String(q)[0] : "0", "#280a0a");
      shadowed(g, 165, 227, q >= 10 ? String(q)[1] : String(q), "#280a0a");
      g.put("gamedialog_1", 20, 156, 244); g.put("gamedialog_1", 20, 170, 244);
      button(g, lx, ly, BTN.left, 30, 31); button(g, lx, ly, BTN.right, 16, 17);
    },
    click(g, lx, ly, me) {
      me = api.me();
      if (this.mode === 0) {
        if (this.rows.length > SHOP_ROWS && within(lx, ly, 235, 260, 10, 330)) { this.drag = true; this.scrollTo(ly, this.rows.length); return true; }
        for (let i = 0; i < SHOP_ROWS; i++) {
          if (!within(lx, ly, 20, 220, i * SHOP_ROW_H + 65, i * SHOP_ROW_H + 79)) continue;
          if (bagCount(me) >= MAX_ITEMS) { api.log("You cannot buy anything because your bag is full."); return true; }
          if (this.rows[this.view + i]) { this.mode = this.view + i + 1; this.qty = 1; }
          return true;
        }
        return false;
      }
      const max = this.maxQty(me), step = (d) => { this.qty = clamp(this.qty + d, 1, max); return true; };
      if (within(lx, ly, 145, 162, 209, 230)) return step(10);
      if (within(lx, ly, 145, 162, 234, 251)) return step(-10);
      if (within(lx, ly, 163, 180, 209, 230)) return step(1);
      if (within(lx, ly, 163, 180, 234, 251)) return step(-1);
      if (onButton(lx, ly, BTN.left)) {
        if (MAX_ITEMS - bagCount(me) < this.qty) api.log("You cannot buy anything because your bag is full.");
        else api.send({ t: "buy", name: this.rows[this.mode - 1].name, count: this.qty });
        this.mode = 0; this.qty = 1; return true;
      }
      if (onButton(lx, ly, BTN.right)) { this.mode = 0; this.qty = 1; return true; }
      return false;
    },
    wheel(g, dir) {
      if (this.mode === 0) this.view = clamp(this.view - dir, 0, Math.max(0, this.rows.length - SHOP_ROWS));
      else this.qty = clamp(this.qty + dir, 1, this.maxQty(api.me()));
    },
  };
  gui.register(shop);

  // ------------------------------------------------------------ 23: ¿vender? / ¿reparar?
  const confirm = {
    id: 23, x: 417, y: 117, w: 258, h: 339, mode: 1, uid: 0, life: 0, price: 0, count: 1,
    draw(g, me) {
      const [lx, ly] = rel(g, this), it = bagItem(me, this.uid), d = it && itemDef(it.id);
      g.put("gamedialog_1", 2, 0, 0); g.put("dialogtext_0", this.mode === 1 ? 11 : 10, 0, 0);
      if (!d) return;
      g.putGame(packKey(d), d.spriteFrame, 77, 114);
      const nm = itemName(it.id, it.attr, it.comp), title = this.mode === 1 && this.count > 1 ? this.count + " " + nm : nm;
      const tc = it.attr ? "#00ff32" : INK;
      g.aligned(25, 240, 60, title, tc); g.aligned(26, 241, 60, title, tc);
      g.text(110, 113, "Endurance: " + this.life, INK);
      g.text(110, 128, this.mode === 1 ? "Value: " + this.price + " Gold" : "Cost: " + this.price + " Gold", INK);
      g.text(55, 190, this.mode === 1 ? "Do you want to sell?" : "Do you want to repair?", INK);
      button(g, lx, ly, BTN.left, this.mode === 1 ? 38 : 42, this.mode === 1 ? 39 : 43); button(g, lx, ly, BTN.right, 16, 17);
    },
    click(g, lx, ly) {
      if (onButton(lx, ly, BTN.left)) {
        api.send(this.mode === 1 ? { t: "sellconfirm", uid: this.uid, count: this.count } : { t: "repairconfirm", uid: this.uid });
        g.close(23); return true;
      }
      if (onButton(lx, ly, BTN.right)) { g.close(23); return true; }
      return false;
    },
    onClose() { trade.busy.delete(this.uid); },
  };
  gui.register(confirm);

  // ------------------------------------------------------------ 31: lista de venta
  const sellList = {
    id: 31, x: 250, y: 130, w: 258, h: 339,
    onClose() { for (const e of trade.sellList) trade.busy.delete(e.uid); trade.sellList = []; },
    draw(g, me) {
      const [lx, ly] = rel(g, this);
      g.put("gamedialog_1", 2, 0, 0); g.put("dialogtext_0", 11, 0, 0);
      trade.sellList = trade.sellList.filter(e => bagItem(me, e.uid));
      trade.sellList.forEach((e, i) => {
        const it = bagItem(me, e.uid), nm = itemName(it.id, it.attr, it.comp), s = e.count > 1 ? e.count + " " + nm : nm;
        const over = inside(lx, ly, 25, 250, 55 + i * 15, 55 + 14 + i * 15);
        g.aligned(0, this.w, 55 + i * 15, s, over ? WHITE : it.attr ? "#00ff32" : INK);
      });
      if (!trade.sellList.length) {
        ["Drag the item that you want to", "sell from your bag. You can sell", "up to 12 items simultaneously.", "You cannot sell exhausted items."].forEach((s, i) => g.aligned(0, this.w, 55 + 30 + i * 15 - 5, s, INK));
        ["If you want to remove sel-", "ected item from the list, ", "click the name of the item."].forEach((s, i) => g.aligned(0, this.w, 55 + 95 + i * 15 - 5, s, INK));
        g.aligned(0, this.w, 55 + 155 - 5, "* Drop the items to sell here! *", INK);
      }
      const can = trade.sellList.length > 0;
      g.put("dialogtext_1", can && onButton(lx, ly, BTN.left) ? 39 : 38, BTN.left, BTN.y);
      g.put("dialogtext_1", onButton(lx, ly, BTN.right) ? 17 : 16, BTN.right, BTN.y);
    },
    click(g, lx, ly) {
      for (let i = 0; i < trade.sellList.length; i++) {
        if (inside(lx, ly, 25, 250, 55 + i * 15, 55 + 14 + i * 15)) { trade.busy.delete(trade.sellList[i].uid); trade.sellList.splice(i, 1); return true; }
      }
      if (onButton(lx, ly, BTN.left)) {
        if (trade.sellList.length) api.send({ t: "selllist", items: trade.sellList.map(e => ({ uid: e.uid, count: e.count })) });
        g.close(31); return true;
      }
      if (onButton(lx, ly, BTN.right)) { g.close(31); return true; }
      return false;
    },
    // bItemDrop_SellList
    drop(uid, mx, my) {
      const me = api.me(), it = me && bagItem(me, uid), d = it && itemDef(it.id);
      if (!d || trade.busy.has(uid)) return;
      if (trade.sellList.some(e => e.uid === uid)) { api.log("That is already on the list."); return; }
      if (!(it.life > 0)) { api.log("Item " + itemName(it.id, it.attr, it.comp) + ": You can't sell an exhausted item."); return; }
      if (trade.sellList.length >= MAX_SELL_LIST) { api.log("You cannot sell more than 12 items at the same time."); return; }
      const add = count => { trade.sellList.push({ uid, count }); trade.busy.add(uid); };
      if (isStack(d) && it.count > 1) quantity.open({ uid, kind: "list", then: add }, mx, my); else add(1);
    },
  };
  gui.register(sellList);

  // ------------------------------------------------------------ 14: almacén
  const bank = {
    id: 14, x: 140, y: 110, w: 258, h: 339, view: 0, drag: false,
    list() { return api.me()?.bank || []; },
    scrollTo(my, n) { this.view = clamp(Math.round(((my - 35) * (n - BANK_ROWS)) / 274), 0, Math.max(0, n - BANK_ROWS)); },
    draw(g, me) {
      const [lx, ly] = rel(g, this), list = this.list(), n = list.length;
      g.put("gamedialog_1", 2, 0, 0); g.put("dialogtext_0", 21, 0, 0);
      this.view = clamp(this.view, 0, Math.max(0, n - BANK_ROWS));
      let hovered = false, y = 45;
      for (let i = 0; i < BANK_ROWS; i++) {
        const it = list[i + this.view]; if (!it) break;
        const d = itemDef(it.id), nm = itemName(it.id, it.attr, it.comp) + (it.count > 1 ? " x" + it.count : "");
        if (inside(lx, ly, 30, 210, 110 + i * BANK_ROW_H, 124 + i * BANK_ROW_H + 1)) {
          hovered = true;
          g.aligned(0, 253, 110 + i * BANK_ROW_H, nm, WHITE);
          g.aligned(70, 253, y, nm, WHITE);
          for (const l of attrLines(it.attr)) g.aligned(70, 253, (y += 15), l, "#969696");
          if (d.levelLimit && it.attr) g.aligned(70, 253, (y += 15), "Level: " + d.levelLimit, "#969696");
          if (d.equipPos !== EQUIP.NONE && d.weight >= 1100) g.aligned(70, 253, (y += 15), "Available for above Str " + Math.ceil(d.weight / 100), "#969696");
          g.putGame(packKey(d), d.spriteFrame, 60, 68);
        } else g.aligned(0, 253, 110 + i * BANK_ROW_H, nm, "#000");
      }
      if (n > BANK_ROWS) {
        g.put("gamedialog_1", 3, 0, 0);
        g.put("gamedialog_1", 7, 242, Math.floor((274 * this.view) / (n - BANK_ROWS)) + 35);
        if (this.drag && g.mouse.down) this.scrollTo(ly, n); else this.drag = false;
      }
      if (!hovered) {
        g.aligned(0, 253, 45, "Either drag an item to restore from bag", INK);
        g.aligned(0, 253, 60, "or click an item to take out on the list.", INK);
        g.aligned(0, 253, 75, "item to take out on the list.", INK);
      }
    },
    click(g, lx, ly) {
      const me = api.me(), list = this.list();
      if (list.length > BANK_ROWS && within(lx, ly, 230, 260, 10, 330)) { this.drag = true; if (ly >= 40) this.scrollTo(ly, list.length); else this.view = 0; return true; }
      for (let i = 0; i < BANK_ROWS; i++) {
        if (!inside(lx, ly, 30, 210, 110 + i * BANK_ROW_H - 1, 124 + i * BANK_ROW_H + 1)) continue;
        if (!list[this.view + i]) return true;
        if (bagCount(me) >= MAX_ITEMS) { api.log("You cannot withdraw the item because your bag is full."); return true; }
        api.send({ t: "withdraw", index: this.view + i });
        return true;
      }
      return false;
    },
    wheel(g, dir) { this.view = clamp(this.view - dir * (this.list().length > 50 ? 2 : 1), 0, Math.max(0, this.list().length - BANK_ROWS)); },
    // bItemDrop_Bank: soltar un objeto de la mochila sobre el almacén lo deposita
    drop(uid, mx, my) {
      const me = api.me(), it = me && bagItem(me, uid), d = it && itemDef(it.id);
      if (!d || trade.busy.has(uid)) return;
      if (gui.isOpen(17) || gui.isOpen(23) || (gui.isOpen(20) && (query.mode === 2 || query.mode === 3))) { api.log("Item transaction not finished."); return; }
      if (this.list().length >= MAX_BANK - 1) { api.log("There is no empty space left in warehouse."); return; }
      const send = count => api.send({ t: "deposit", uid, count });
      if (isStack(d) && it.count > 1) quantity.open({ uid, kind: "deposit", then: send }, mx, my); else send(1);
    },
  };
  gui.register(bank);

  // ------------------------------------------------------------ 41: hospital de compañeros (invento del port, ver shared/systems/companion.js)
  const hospital = new class extends ClassicDialog {
    constructor() { super({ id: 41, title: "Hospital de compañeros", tabs: ["Cuidados", "Bolas"], footer: "Un caído no se invoca hasta revivirlo." }); }
    rows(me) {
      if (this.tab === 1) return Object.keys(SPECIES).map(sp => ({ sp, text: sp.replace(/-/g, " ") + " (bola nivel 1)", right: HOSPITAL.ballPrice, tip: "Bola de prueba" }));
      return me.bag.filter(i => i.comp).map(i => {
        const c = i.comp, st = c.down ? "Inconsciente" : hpOf(me, c) < maxOf(me, c) ? "Herido" : "Sano";
        return { uid: i.uid, text: (c.nm || c.sp) + " (" + c.sp.replace(/-/g, " ") + " nv " + c.lvl + ") · " + st, right: treatCost(me, c), color: c.down ? RED : null, tip: c.down ? "Revivir es caro" : "Curar: 2 de oro por punto de vida" };
      });
    }
    drawBody(g, me) {
      g.text(14, 62, this.tab ? "Bolas de prueba" : "Curar o revivir compañeros", INK, { size: 10 }); g.text(this.w - 44, 62, "Oro", INK, { size: 10 });
      if (!this.rows(me).length) g.aligned(0, this.w, 120, "No llevas ninguna bola de compañero.", INK);
    }
    pick(r) {
      if (this.tab === 1) api.send({ t: "petbuy", npc: trade.npc.id, sp: r.sp });
      else api.send({ t: "petheal", npc: trade.npc.id, uid: r.uid });
    }
  }();
  gui.register(hospital);

  // ------------------------------------------------------------ notificaciones del servidor
  function onEvent(ev, world) {
    const me = api.pid;
    if (ev.id !== me) return;
    const mine = api.me(), nm = id => itemName(id);
    switch (ev.t) {
      case "sellprice": {                                              // NotifyMsg_SellItemPrice
        const it = mine && bagItem(mine, ev.uid); if (!it) break;
        Object.assign(confirm, { mode: 1, uid: ev.uid, life: ev.life, price: ev.price, count: ev.count });
        gui.close(23, true); trade.busy.add(ev.uid); gui.open(23);
        break;
      }
      case "repairprice": {                                            // NotifyMsg_RepairItemPrice (se abre sobre la tienda)
        const it = mine && bagItem(mine, ev.uid); if (!it) break;
        Object.assign(confirm, { mode: 2, uid: ev.uid, life: ev.life, price: ev.price, count: 1, x: shop.x, y: shop.y });
        gui.close(23, true); trade.busy.add(ev.uid); gui.open(23);
        break;
      }
      case "purchased": api.log("You bought a " + nm(ev.item) + " with " + ev.price + " Gold."); break;
      case "nogold": api.log("Not enough Gold."); gui.close(23); break;
      case "cantcarry": api.log("You can't carry anymore items."); api.log(" Your bag is full."); break;
      case "sold": gui.close(23); break;
      case "repaired": gui.close(23); api.log("Item " + nm(ev.item) + ": repaired."); break;
      case "pettreated": api.log((ev.revived ? "Has revivido a " : "Has curado a ") + (ev.nm || ev.sp) + " por " + ev.cost + " de oro.", "gold"); break;
      case "petbought": api.log("Compras la bola de " + ev.sp.replace(/-/g, " ") + " (" + ev.nm + ") por " + ev.price + " de oro."); break;
      case "bankfull": api.log("There is no empty space left in warehouse."); break;
      case "cantsell": {
        const it = mine && bagItem(mine, ev.uid), name = it ? itemName(it.id, it.attr, it.comp) : nm(ev.item);
        if (ev.why === 1) api.log("Item " + name + ": You can't sell this item here.");
        else if (ev.why === 2) api.log("Item " + name + ": You can't sell an exhausted item.");
        else if (ev.why === 3) { api.log("Item " + name + ": You can't sell this item."); api.log("You should get a citizenship to sell this item."); }
        else { api.log("You can't sell anymore items because your bag is full."); api.log("Try again after removing weight off your bag."); }
        trade.busy.delete(ev.uid);
        break;
      }
      case "cantrepair": {
        const it = mine && bagItem(mine, ev.uid), name = it ? itemName(it.id, it.attr, it.comp) : nm(ev.item);
        api.log("Item " + name + (ev.why === 1 ? ": You don't have to repair this item." : ": You can't repair this item here."));
        trade.busy.delete(ev.uid);
        break;
      }
    }
  }

  const bag = { disabled: uid => trade.busy.has(uid) };
  return {
    clickNpc, dropOnNpc, onEvent, trade, bag,
    // cierra los cuadros cuyo objeto ya no está en la mochila (vendido, soltado...); se llama una vez por fotograma
    sweep() {
      const me = api.me(); if (!me) return;
      const gone = uid => !bagItem(me, uid);
      if (gui.isOpen(17) && gone(quantity.ask?.uid)) gui.close(17);
      if (gui.isOpen(23) && gone(confirm.uid)) gui.close(23);
      if (gui.isOpen(20) && (query.mode === 2 || query.mode === 3) && gone(query.uid)) gui.close(20);
      for (const u of [...trade.busy]) if (gone(u) && !(gui.isOpen(17) && quantity.ask?.uid === u)) trade.busy.delete(u);
    },
    dropOn(dlg, uid, mx, my) {                                          // objeto soltado sobre un cuadro de NPC
      if (dlg.id === 31) { sellList.drop(uid, mx, my); return true; }
      if (dlg.id === 14) { bank.drop(uid, mx, my); return true; }
      return false;
    },
    // el teclado lo recibe antes el cuadro de cantidad
    key(e) { return gui.isOpen(17) ? quantity.key(e, gui) : false; },
  };
}
