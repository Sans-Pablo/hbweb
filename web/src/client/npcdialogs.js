// Cuadros de diálogo de los NPC de ciudad, como en el cliente original (Game.cpp):
//   20 menú del NPC (DrawDialogBox_NpcActionQuery)   11 tienda (DrawDialogBox_Shop)
//   14 almacén (DrawDialogBox_Bank)                  23 vender / reparar (DrawDialogBox_SellorRepairItem)
//   31 lista de venta (DrawDialogBox_SellList)       17 cantidad (DrawDialogBox_QueryDropItemAmount)
// Todo el estado de la compra-venta vive aquí; la simulación (shared/systems/shopsys.js) hace de servidor.
import { itemDef, itemName, itemSet, packKey, iconKey } from "./names.js";
import { shown } from "../shared/systems/evolutions.js";
import { EQUIP, ITYPE, isStack } from "../shared/items.js";
import { listPrice, NPC, MAX_BANK, MAX_SELL_LIST } from "../shared/systems/shopsys.js";
import { attrLines } from "../shared/attributes.js";
import { defineDialog } from "./dlgspec.js";
import { THEME } from "./window.js";
import { DlgSearch } from "./dlgsearch.js";
import { DialogBox } from "./dialogbox.js";
import { SPECIES, HOSPITAL, CANDY_PRICE, treatCost, hpOf, maxOf } from "../shared/systems/companion.js";
import { isTier2, TIER2, TRADE_LEVEL } from "../shared/systems/schools.js";
import { ARENA } from "../shared/systems/arena.js";
import { BRANCH_NAMES, DUMMY_NAMES, DUMMY_COLORS, CLS_OF } from "../shared/systems/talents.js";
import { getLang, t } from "./i18n.js";

const INK = "#2d1919", QINK = "#371919", DARK = "#040032", WHITE = "#fff", RED = "#c31919", ALERT = "#c31919";
const BTN = { w: 74, h: 20, left: 30, right: 154, y: 292 };                          // DEF_BTNSZX/Y, DEF_LBTNPOSX, DEF_RBTNPOSX, DEF_BTNPOSY
const NPC_NAMES = { [NPC.SHOP]: "Shop Keeper", [NPC.MAGE]: "Sorcerer", [NPC.WAREHOUSE]: "Warehouse Keeper", [NPC.BLACKSMITH]: "BlackSmith Keeper" };
// modo 4 de DrawDialogBox_NpcActionQuery: Guard 21, Unicorn 32, Mcgaffin 67, Perry 68, Devlin 69 -> nombre y texto de TALKTONPC (lan_eng.h)
const TOWN = { 21: ["Guard", "Talking to Guard..."], 32: ["Unicorn", "Talking to Unicorn..."], 67: ["Mcgaffin", "Talking to a town man..."], 68: ["Perry", "Talking to a town maiden..."], 69: ["Devlin", "Talking to a town magician..."] };
// TALKING_TO_* (lan_eng.h) del botón Talk de los modos 0/5
const TALKING = { [NPC.SHOP]: "Talking to Shop Keeper...", [NPC.BLACKSMITH]: "Talking to Blacksmith Keeper...", [NPC.WAREHOUSE]: "Talking to Warehouse Keeper...", [NPC.MAGE]: "Talking to Sorcerer..." };
const MENU_TITLE = { 7: ["Blacksmith Keeper", 65, 61], 8: ["Shop Keeper", 70, 66], 9: ["Cityhall Officer", 70, 66] };   // DRAW_BLACKSMITH / DRAW_SHOP / DRAW_CITYHALL
// subcatálogos del original (tipos de tienda 1 pociones, 2 varios, 3 ropa; 4 armas/varios, 5 armadura M, 6 armadura W): aquí un catálogo por NPC, se filtra
const SUBSHOP = {
  1: (r, api) => r.type === 3 && /Potion/.test(r.name),
  2: (r, api) => !(r.type === 3 && /Potion/.test(r.name)) && r.type !== 1,
  3: (r, api) => r.type === 1,
  4: (r, api) => r.type !== 1 || [7, 8, 9].includes(r.equipPos),
  5: (r, api) => r.type === 1 && ![7, 8, 9].includes(r.equipPos) && (api.itemByName(r.name)?.gender || 0) !== 2,
  6: (r, api) => r.type === 1 && ![7, 8, 9].includes(r.equipPos) && (api.itemByName(r.name)?.gender || 0) !== 1,
};
// NpcTalkHandler: iWho 2 tienda, 3 herrería, 5 almacén, 6 mago -> texto contents{iWho+150}
const TALK_ID = { [NPC.SHOP]: 152, [NPC.BLACKSMITH]: 153, [NPC.WAREHOUSE]: 155, [NPC.MAGE]: 156 };
const SHOP_ROWS = 13, SHOP_ROW_H = 18, BANK_ROWS = 13, BANK_ROW_H = 15;
const MAX_ITEMS = 50;

const inside = (lx, ly, x1, x2, y1, y2) => lx > x1 && lx < x2 && ly > y1 && ly < y2;
const within = (lx, ly, x1, x2, y1, y2) => lx >= x1 && lx <= x2 && ly >= y1 && ly <= y2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const stat = (me, k) => (me.stats ? me.stats[k] : 10);

export function registerNpcDialogs(gui, api) {
  const hooks = {};                   // petMage: cuadro del Hechicero de mascotas (client/petmage.js), lo pone main.js
  const g0 = gui;
  const trade = {                     // lo que se está comprando / vendiendo ahora mismo
    npc: null,                        // { id, type, x, y } del NPC con el que se habla
    sellList: [],                     // [{ uid, count }] (hasta 12)
    stamp: new Map(),                 // desde cuándo está desactivado cada objeto (para liberar los que se quedan colgados)
    busy: new Set(),                  // objetos "desactivados" mientras esperan una operación (m_bIsItemDisabled)
  };
  const bagCount = me => me.bag.length;
  const bagItem = (me, uid) => me.bag.find(i => i.uid === uid);

  // texto "en negrita" del original: se dibuja dos veces con un píxel de diferencia
  const shadowed = (g, x, y, s, color) => { g.text(x, y, s, color); g.text(x + 1, y, s, color); };
  // botón de texto del menú del NPC: blanco bajo el cursor, azul oscuro en reposo
  const link = (g, lx, ly, x, y, s, x1, x2) => shadowed(g, x, y, s, inside(lx, ly, x1, x2, y, y + 15) ? WHITE : DARK);      // msY > sY+y && msY < sY+y+15 (Game.cpp:34250)
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
      if (a.kind !== "list" && a.kind !== "deposit") g.text(30, 20, a.target ? name + ": give to " + a.target + "." : " Dropping " + name + ".", QINK);
      g.text(30, 35, "Decide the quantity.", QINK);
      g.text(40, 57, this.text, WHITE, { bold: true });
      g.text(38, 62, "__________ (0 ~ " + it.count + ")", "#192319");
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
  // v0.84.5: DialogBox (ventana de piedra); el texto es el contents{iWho+150} del original, unido en párrafo
  const talkText = new DialogBox({
    id: 21, w: 520, place: (g, b) => { b.x = Math.round((g.W - b.w) / 2); b.y = Math.max(8, Math.round((g.H - b.h) / 2) - 40); },
    spec: () => talkText.lines.length ? {
      title: NPC_NAMES[trade.npc?.type] || "", text: talkText.lines.join(" ").replace(/\s+/g, " ").trim(),
      options: [{ label: "Ok", primary: true, fn: () => gui.close(21) }], click: null,
    } : null,
  });
  talkText.lines = [];
  talkText.begin = function (n) { this.lines = (api.talk || {})[n] || []; gui.open(21); };
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
      } else if (m === 4) {
        const name = (TOWN[this.npcType] || [""])[0];
        g.text(35, 25, name, INK); g.text(34, 24, name, WHITE);
      } else if (m === 6) { g.text(33, 23, "Heldenian staff officer", INK); g.text(32, 22, "Heldenian staff officer", WHITE); }
      else if (m >= 7 && m <= 9) {
        const [title, tx, ux] = MENU_TITLE[m];
        g.text(tx, 5, title, "#000"); g.text(tx - 1, 4, title, WHITE);      // RGB(0,0,0) y subrayado negro (modos 7-9)
        g.text(ux, 5, m === 7 ? "________________" : "____________", "#000");
      }
      if (m === 0) {
        const first = { 20: "Withdraw", 19: "Learn" }[this.npcType] || "Trade";
        link(g, lx, ly, 28, 55, first, 25, 100);
        if (!gui.isOpen(21)) link(g, lx, ly, 125, 55, "Talk", 125, 180);      // solo con NpcTalk cerrado (m_bIsDialogEnabled[21] == FALSE)
      } else if (m === 5) {
        link(g, lx, ly, 28, 55, "Trade", 25, 100);
        link(g, lx, ly, 103, 55, "Sell", 104, 155);
        if (!gui.isOpen(21)) link(g, lx, ly, 155, 55, "Talk", 155, 210);
        if (this.npcType === NPC.BLACKSMITH) link(g, lx, ly, 28, 72, "Repair all", 25, 100);
      } else if (m === 4) { if (!gui.isOpen(21)) link(g, lx, ly, 125, 55, "Talk", 125, 180); }
      else if (m === 6) link(g, lx, ly, 28, 55, "Trade", 25, 100);
      else if (m === 7) {      // cajas x 25..100 / 125..175 (Game.cpp DrawDialogBox_NpcActionQuery modos 7-9)
        link(g, lx, ly, 25, 30, "Buy Weapons/Misc", 25, 100); link(g, lx, ly, 125, 30, "Buy (M) Armor", 125, 175);
        link(g, lx, ly, 125, 50, "Buy (W) Armor", 125, 175); link(g, lx, ly, 25, 50, "Sell Items", 25, 100);
      } else if (m === 8) {
        link(g, lx, ly, 25, 30, "Buy Potions", 25, 100); link(g, lx, ly, 125, 30, "Buy Misc.", 125, 175);
        link(g, lx, ly, 125, 50, "Buy Outfits", 125, 175); link(g, lx, ly, 25, 50, "Sell Items", 25, 100);
      } else if (m === 9) {
        link(g, lx, ly, 25, 30, "Offer", 25, 100); link(g, lx, ly, 125, 50, "Buy Weapons", 125, 175); link(g, lx, ly, 25, 50, "Talk", 25, 100);
      } else if (m === 2 || m === 3) {
        const it = bagItem(me, this.uid);
        if (!it) return;
        const put = m === 3 ? (y, s) => g.aligned(0, 240, y, s, INK) : (y, s) => g.text(24, y, s, INK);      // modo 2: alineado a la izquierda (24,20)/(24,35)
        put(20, this.count + " " + itemName(it.id, it.attr, it.comp) + " to");
        put(35, this.who);
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
      if (gui.isOpen(33)) { api.log("Item transaction not finished."); return false; }      // m_bIsDialogEnabled[27] (intercambio): BITEMDROP_SKILLDIALOG1
      if (m === 0 || m === 5) {
        if (inside(lx, ly, 25, 100, 55, 70)) {                    // Trade / Learn / Withdraw
          if (m === 5) g.open(11), shop.begin(this.shop); else g.open(this.link);
          g.close(20); return true;
        }
        if (m === 5 && this.npcType === NPC.BLACKSMITH && inside(lx, ly, 25, 100, 72, 87)) { api.send({ t: "repairall", whom: this.npcType }); g.close(20); return true; }
        if (m === 5 && inside(lx, ly, 104, 155, 55, 70)) { g.open(31); g.close(20); return true; }
        const talk = m === 5 ? [155, 210] : [125, 180];
        if (!g.isOpen(21) && inside(lx, ly, talk[0], talk[1], 55, 70)) { api.log(TALKING[this.npcType] || ""); talkText.begin(TALK_ID[this.npcType]); g.close(20); return true; }
      } else if (m === 4) {
        if (!g.isOpen(21) && inside(lx, ly, 125, 180, 55, 70)) api.log((TOWN[this.npcType] || [])[1] || "");
        g.close(20); return true;      // DlgBoxClick_NpcActionQuery modo 4: cualquier clic cierra el cuadro
      } else if (m === 6) { if (inside(lx, ly, 25, 100, 55, 70)) { g.open(51); g.close(20); return true; } return false; }
      else if (m === 7 || m === 8) {
        const pick = t => { g.open(11); shop.begin(this.shop, false, t); g.close(20); return true; };      // Buy Weapons|Potions / (M) Armor|Misc. / (W) Armor|Outfits
        if (inside(lx, ly, 25, 100, 30, 45)) return pick(m === 7 ? 4 : 1);
        if (inside(lx, ly, 125, 175, 30, 45)) return pick(m === 7 ? 5 : 2);
        if (inside(lx, ly, 125, 175, 50, 65)) return pick(m === 7 ? 6 : 3);
        if (inside(lx, ly, 25, 100, 50, 65)) { g.open(31); g.close(20); return true; }
        return false;
      } else if (m === 9) {
        if (inside(lx, ly, 25, 100, 30, 45)) { g.open(13); g.close(20); return true; }
        if (inside(lx, ly, 125, 175, 50, 65)) { g.open(53); g.close(20); return true; }
        if (inside(lx, ly, 25, 100, 50, 65)) { api.log("Talking to Cityhall Officer..."); talkText.begin(154); return true; }      // TALKTONPC 4 (el diálogo 20 sigue abierto)
        return false;
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
  query.silent = true;      // DlgBoxClick_NpcActionQuery no llama a PlaySound (el resto de cuadros sí: E,14,5)
  gui.register(query);

  // ------------------------------------------------------------ 26: alquimia (DrawDialogBox_SkillDlg modos 1/2, DlgBoxClick_SkillDlg, bItemDrop_SkillDialog)
  // Cuenco de alquimia (AlchemyBowl, spriteFrame 55). Seis huecos de ingredientes; «Try Now!» -> «Creating...» 3 s -> orden alchemy (ReqCreatePortionHandler).
  // Fabricación (modos 3-8, BuildItem.cfg / CraftItem.cfg) sin portar: el servidor del port no la tiene (docs/AUDITORIA-2026-10-19.md).
  const SLOT_XY = [[55, 55], [100, 55], [145, 55], [55, 100], [100, 100], [145, 100]];       // sX+iAdjX+55+45*i, sY+iAdjY+55|100
  const rgb8 = (r, g, b) => "rgb(" + r * 8 + "," + g * 8 + "," + b * 8 + ")";                 // PutString_SprFont: valores 0..31 -> 0..255
  const alchemy = {
    id: 26, x: 180, y: 120, w: 195, h: 215, mode: 1, slots: [], t1: 0, step: 0,
    // Alquimia por el cuenco o por el botón del libro de magia
    begin(fromBook) {
      const me = api.me(); if (!me) return false;
      if (!(me.skills && me.skills[12])) { api.log(fromBook ? "You should learn alchemy skill to use alchemy skill. Alchemy manual is purchasable in Shop." : "You should learn alchemy skill to use this item."); return false; }
      if (fromBook && !me.bag.some(i => { const d = itemDef(i.id); return d && d.type === ITYPE.USE_SKILL_DLG && d.spriteFrame === 55; })) return false;
      if (!gui.isOpen(26)) { gui.close(17); gui.close(20); gui.close(23); }                  // EnableDialogBox(26,1): DisableDialogBox(17/20/23)
      this.mode = 1; this.slots = []; this.step = 0;
      gui.open(26); api.log("Using alchemy skill...");
      return true;
    },
    onClose() { for (const u of this.slots) trade.busy.delete(u); this.slots = []; },
    draw(g, me) {
      const c = this.step, sh = c ? () => c - Math.floor(Math.random() * c * 2) : () => 0;
      const ox = c ? 5 + sh() : 0, oy = c ? 8 + sh() : 0;
      g.put("interface2_0", 1, ox, oy);
      const jit = () => 1 - Math.floor(Math.random() * 3);
      this.slots.forEach((uid, i) => {
        const it = bagItem(me, uid), d = it && itemDef(it.id); if (!d) return;
        g.putGame(iconKey(d), d.spriteFrame, ox + 5 + SLOT_XY[i][0] + jit(), oy + 8 + SLOT_XY[i][1] + jit(), 0.5);      // PutTransSprite50
      });
      const [lx, ly] = rel(g, this), hov = within(lx, ly, 65, 158, 183, 203);
      if (this.mode === 1) g.text(ox + 65, oy + 183, "Try Now!", hov ? rgb8(16, 16, 30) : rgb8(6, 6, 20), { bold: true, size: 14 });
      else g.text(ox + 65, oy + 183, "Creating...", rgb8(20, 6, 6), { bold: true, size: 14 });
    },
    click(g, lx, ly) {
      if (this.mode !== 1 || !within(lx, ly, 65, 158, 183, 203)) return false;
      this.mode = 2; this.step = 1; this.t1 = performance.now();
      api.log("Mixing a potion..."); g.onSound?.(41);
      return true;
    },
    // bItemDrop_SkillDialog (modo 1)
    drop(uid) {
      const me = api.me(), it = me && bagItem(me, uid), d = it && itemDef(it.id);
      if (!d || this.mode !== 1 || trade.busy.has(uid)) return;
      if (gui.isOpen(17) || gui.isOpen(23) || (gui.isOpen(20) && (query.mode === 1 || query.mode === 2))) { api.log("Item transaction not finished."); return; }
      const stack = d.type === ITYPE.CONSUME;
      if (stack && this.slots.filter(u => u === uid).length >= it.count) return;
      if (d.type !== ITYPE.EAT && d.type !== ITYPE.CONSUME && d.type !== ITYPE.NONE) return;
      if (this.slots.length >= 6) { api.log("There is no more space for ingredients."); return; }
      this.slots.push(uid);
      if (!(stack && it.count > 1)) trade.busy.add(uid);
    },
    // por fotograma (regla 4: nada se cierra dentro de draw): cuenta 1 s por paso; al cuarto envía y cierra
    tick(me) {
      this.slots = this.slots.filter(u => bagItem(me, u));
      if (this.mode !== 2) return;
      const now = performance.now();
      if (now - this.t1 > 1000) { this.t1 = now; this.step++; }
      if (this.step >= 4) {
        const uids = this.slots.slice();
        gui.close(26); api.send({ t: "alchemy", uids }); gui.onSound?.(42);
      }
    },
  };
  gui.register(alchemy);

  // hacia dónde se abre el menú: pegado al cursor (tX = msX - 117, tY = msY - 50)
  const place = (mx, my) => { query.x = clamp(mx - 117, 0, 799 - 235); query.y = clamp(my - 50, 0, 599 - 100); };
  const FARMER_HELP = [
    "Granjero: aquí tienes todas las semillas y el Manual de Cultivo.",
    "Usa el manual para aprender Farming; la azada se compra en la herrería. Siembra la bolsa de semillas en tierra libre y cosecha con la azada.",
  ];
  const MENU = {          // qué abre cada NPC (Game.cpp, CommandProcessor)
    [NPC.SHOP]: { mode: 8, link: 11, shop: 1 }, [NPC.BLACKSMITH]: { mode: 7, link: 11, shop: 2 },
    21: { mode: 4 }, 32: { mode: 4 }, 67: { mode: 4 }, 68: { mode: 4 }, 69: { mode: 4 }, 25: { mode: 9 }, 90: { mode: 6 },
    [NPC.MAGE]: { mode: 0, link: 16 }, [NPC.WAREHOUSE]: { mode: 0, link: 14 },
  };

  // clic en un NPC de ciudad
  function clickNpc(e, mx, my) {
    if (e.role === ARENA.role) { trade.npc = { id: e.id, type: e.type, x: e.x, y: e.y }; arena.open(); return true; }
    if (e.role === "farmer") {      // BUG-013: granjero de Aresfarm: todas las semillas y el manual, con explicación
      trade.npc = { id: e.id, type: e.type, x: e.x, y: e.y };
      for (const l of FARMER_HELP) api.log(l);
      shop.begin(1, true); gui.open(11); return true;
    }
    if (e.role === "petmage") { hooks.petMage?.open(e); return true; }
    if (e.role === HOSPITAL.role) { trade.npc = { id: e.id, type: e.type, x: e.x, y: e.y }; hospital.tab = 0; hospital.view = 0; gui.open(41); return true; }
    const cfg = MENU[e.type]; if (!cfg) return false;
    trade.npc = { id: e.id, type: e.type, x: e.x, y: e.y };
    Object.assign(query, { mode: cfg.mode, npcType: e.type, link: cfg.link, shop: cfg.shop || 0, w: cfg.mode === 5 ? 252 : 215 });
    if (cfg.mode === 8 || cfg.mode === 7) query.w = 215;
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
    id: 11, x: 150, y: 110, w: 258, h: 339, type: 1, view: 0, mode: 0, qty: 1, rows: [], drag: false, s: new DlgSearch(34, 33, 190),
    vis() { return this.rows.map((row, idx) => ({ row, idx })).filter(e => this.s.match(e.row.display)); },      // buscador: filtra por nombre y conserva el índice real (el detalle usa this.mode - 1)
    key(e) { return this.s.key(e); },
    get focus() { return this.s.on; },                   // el tutorial cede el teclado mientras se escribe en el buscador
    onClose() { this.s.reset(); },
    begin(type, farm = false, sub = 0) { Object.assign(this, { type, rows: (api.shops[type] || []).filter(r => !/^Master|(Master)/.test(r.name)).filter(r => sub && !SUBSHOP[sub](r, api) ? false : farm ? /^(SeedBag[(]|FarmingManual$)/.test(r.name) : !/^(Big|Super|Power)(Red|Blue|Green)Potion$/.test(r.name)), view: 0, mode: 0, qty: 1 }); },
    onOpen() { if (!this.rows.length) this.begin(this.type); },
    maxQty(me) { return Math.max(1, MAX_ITEMS - bagCount(me)); },
    price(me, row) { return listPrice(stat(me, "chr"), row.price); },
    scrollTo(my, n) { this.view = clamp(Math.round(((my - 35) * (n - SHOP_ROWS)) / 274), 0, Math.max(0, n - SHOP_ROWS)); },
    draw(g, me) {
      const L = this.vis(), [lx, ly] = rel(g, this), n = L.length;
      g.put("gamedialog_1", 2, 0, 0); g.put("dialogtext_0", 11, 0, 0);
      if (this.mode === 0) {
        this.s.draw(g);
        if (n > SHOP_ROWS) {
          g.put("gamedialog_1", 3, 0, 0);
          g.put("gamedialog_1", 7, 242, Math.floor((274 * this.view) / (n - SHOP_ROWS)) + 35);
          if (this.drag && g.mouse.down) this.scrollTo(ly, n); else this.drag = false;
        }
        this.view = clamp(this.view, 0, Math.max(0, n - SHOP_ROWS));
        shadowed(g, 23, 55, "ITEM", INK); shadowed(g, 191, 55, "PRICE", INK);
        for (let i = 0; i < SHOP_ROWS; i++) {
          const row = L[i + this.view]?.row; if (!row) break;
          const over = within(lx, ly, 20, 220, i * SHOP_ROW_H + 73, i * SHOP_ROW_H + 87), col = over ? WHITE : DARK;
          if (over) { const real = api.itemByName(row.name.replace(/^(10|100)Arrows$/, "Arrow")); if (real) g.hoverDef = real.id; }      // BUG-009: ficha al pasar el cursor
          g.aligned(10, 190, i * SHOP_ROW_H + 73, row.display, col);
          g.aligned(148, 260, i * SHOP_ROW_H + 73, String(this.price(me, row)).padStart(6, " "), col);
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
        lab(90, 190, "Level"); g.text(140, 190, ": above " + row.levelLimit, ok ? INK : "#7d1919");
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
        if (this.s.click(lx, ly)) return true;
        const L = this.vis();
        if (L.length > SHOP_ROWS && within(lx, ly, 235, 260, 10, 330)) { this.drag = true; this.scrollTo(ly, L.length); return true; }
        for (let i = 0; i < SHOP_ROWS; i++) {
          if (!within(lx, ly, 20, 220, i * SHOP_ROW_H + 73, i * SHOP_ROW_H + 87)) continue;
          if (bagCount(me) >= MAX_ITEMS) { api.log("You cannot buy anything because your bag is full."); return true; }
          if (L[this.view + i]) { this.mode = L[this.view + i].idx + 1; this.qty = 1; }
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
      if (this.mode === 0) this.view = clamp(this.view - dir, 0, Math.max(0, this.vis().length - SHOP_ROWS));
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
      g.putGame(iconKey(d), d.spriteFrame, 77, 114);
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
    id: 14, x: 140, y: 110, w: 258, h: 339, view: 0, drag: false, s: new DlgSearch(34, 33, 190),
    list() { return api.me()?.bank || []; },
    vis() { return this.list().map((it, idx) => ({ it, idx })).filter(e => this.s.match(itemName(e.it.id, e.it.attr, e.it.comp))); },      // buscador: índice real para retirar
    key(e) { return this.s.key(e); },
    get focus() { return this.s.on; },                   // el tutorial cede el teclado mientras se escribe en el buscador
    onClose() { this.s.reset(); },
    scrollTo(my, n) { this.view = clamp(Math.round(((my - 35) * (n - BANK_ROWS)) / 274), 0, Math.max(0, n - BANK_ROWS)); },
    draw(g, me) {
      const [lx, ly] = rel(g, this), list = this.vis().map(e => e.it), n = list.length;
      g.put("gamedialog_1", 2, 0, 0); g.put("dialogtext_0", 21, 0, 0); this.s.draw(g);
      this.view = clamp(this.view, 0, Math.max(0, n - BANK_ROWS));
      let hovered = false, y = 58;
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
          g.putGame(iconKey(d), d.spriteFrame, 60, 68);
        } else g.aligned(0, 253, 110 + i * BANK_ROW_H, nm, "#000");
      }
      if (n > BANK_ROWS) {
        g.put("gamedialog_1", 3, 0, 0);
        g.put("gamedialog_1", 7, 242, Math.floor((274 * this.view) / (n - BANK_ROWS)) + 35);
        if (this.drag && g.mouse.down) this.scrollTo(ly, n); else this.drag = false;
      }
      // oro: «Deposit gold» guarda todo el oro de la bolsa, «Withdraw gold» saca todo el del almacén
      this.goldBtn(g, lx, ly, 30, t("Guardar oro"));
      this.goldBtn(g, lx, ly, 140, t("Sacar oro") + " (" + (me?.bankGold | 0) + ")");
      if (!hovered) {
        // DRAW_DIALOGBOX_BANK3..6 (lan_eng.h): sY+35/50/65 y, en blanco, «Space Used %d Of %d Items» a sY+85
        g.aligned(0, 253, 35, "Drop an item from your bag to the", INK);
        g.aligned(0, 253, 50, "bank window to deposit.", INK);
        g.aligned(0, 253, 65, "Click an item to withdraw it.", INK);
        g.aligned(0, 253, 85, "Space Used " + n + " Of " + (MAX_BANK - 1) + " Items", WHITE);
      }
    },
    goldBtn(g, lx, ly, x, label) { g.text(x, 318, label, inside(lx, ly, x, x + 90, 316, 330) ? WHITE : INK); },
    click(g, lx, ly) {
      const me = api.me(), V = this.vis(), list = V.map(e => e.it);
      if (inside(lx, ly, 30, 120, 316, 330)) { api.send({ t: "depositgold", amount: me.gold | 0 }); return true; }
      if (inside(lx, ly, 140, 250, 316, 330)) { api.send({ t: "withdrawgold", amount: me.bankGold | 0 }); return true; }
      if (this.s.click(lx, ly)) return true;
      if (list.length > BANK_ROWS && within(lx, ly, 230, 260, 10, 330)) { this.drag = true; if (ly >= 40) this.scrollTo(ly, list.length); else this.view = 0; return true; }
      for (let i = 0; i < BANK_ROWS; i++) {
        if (!inside(lx, ly, 30, 210, 110 + i * BANK_ROW_H - 1, 124 + i * BANK_ROW_H + 1)) continue;
        if (!list[this.view + i]) return true;
        if (bagCount(me) >= MAX_ITEMS) { api.log("You cannot withdraw the item because your bag is full."); return true; }
        api.send({ t: "withdraw", index: V[this.view + i].idx });
        return true;
      }
      return false;
    },
    wheel(g, dir) { this.view = clamp(this.view - dir * (this.list().length > 50 ? 2 : 1), 0, Math.max(0, this.vis().length - BANK_ROWS)); },
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
  const HELP = ["CUIDADOS: cura a los heridos (2 de oro por punto de vida) o revive a los caídos (más caro).",   // BUG-008: pestaña de ayuda, un párrafo por elemento
    "EVOLUCIÓN: Orc, Pixie y Skeleton nivel 50+ pasan a Demon, Frost y Liche (nivel 1).",
    "BOLAS: compra una bola de nivel 1; previsualiza antes.",
    "CARAMELOS: rojo vida, azul maná, verde revive. Arrástralos al compañero.",
    "COMIDA: el pescado da mejoras permanentes y la granja cura; arrástrala al compañero o a su bola.",
    "DOOMY: Healer (verde) cura, Buff (amarillo) protege, Aura (azul) regenera."];
  const hospRows = (tab, me) => {
    if (tab === 3) return [];
    if (tab === 2) return Object.entries(CANDY_PRICE).map(([id, price]) => ({ candy: +id, text: api.itemName?.(+id) || ({ 780: "Red Candy", 781: "Blue Candy", 782: "Green Candy" })[id], right: price, tip: ({ 780: "Restores life to your summon", 781: "Restores mana to your summon (school summons need it)", 782: "Revives an unconscious summon" })[id] }));
    if (tab === 1) return Object.keys(SPECIES).filter(sp => !isTier2(sp) && (api.hasNpc?.(sp) ?? true)).map(sp => ({ sp, ball: { id: SPECIES[sp][1], comp: { sp, ...(CLS_OF[sp] ? { cls: CLS_OF[sp] } : {}) } }, text: (CLS_OF[sp] ? DUMMY_NAMES[CLS_OF[sp]] : shown(sp)) + " (bola nivel 1)", right: HOSPITAL.ballPrice, tip: "Bola de prueba" }));
    const ups = me.bag.filter(i => i.comp && TIER2[i.comp.sp] && i.comp.lvl >= TRADE_LEVEL && !i.comp.down).map(i => ({ up: i.uid, text: "Evolve " + (i.comp.nm || shown(i.comp.sp)) + " → " + TIER2[i.comp.sp], right: "Lv1", color: THEME.good, tip: "Trade this level-50 summon for a level-1 " + TIER2[i.comp.sp] + " (more life, mana and damage). Keep it stored first." }));
    return ups.concat(me.bag.filter(i => i.comp).map(i => {
      const c = i.comp, hp = hpOf(me, c), mx = maxOf(me, c), st = c.down ? "Inconsciente" : hp < mx ? "Herido " + hp + "/" + mx : "Sano";
      const kind = c.cls && DUMMY_NAMES[c.cls] ? DUMMY_NAMES[c.cls] : shown(c.sp);
      return { uid: i.uid, ball: i, text: (c.nm || c.sp) + " (" + kind + " nv " + c.lvl + ") · " + st, right: treatCost(me, c), color: c.down ? THEME.bad : DUMMY_COLORS[c.cls] ? DUMMY_COLORS[c.cls] : null, tip: c.down ? "Revivir es caro" : "Curar: 2 de oro por punto de vida" };
    }));
  };
  const hospPick = r => {
    const tab = hospital.tab;
    if (tab === 2) api.send({ t: "candybuy", npc: trade.npc.id, item: r.candy, count: 1 });
    else if (tab === 1) api.preview(r.sp, trade.npc.id);
    else if (r.up) api.send({ t: "petup", npc: trade.npc.id, uid: r.up });
    else api.send({ t: "petheal", npc: trade.npc.id, uid: r.uid });
  };
  const hospital = defineDialog({
    id: 41, title: "Hospital de compañeros", w: 300, h: 340, tabs: ["Cuidados", "Bolas", "Caramelos", "Ayuda"], footer: "Un caído no se invoca hasta revivirlo.",
    items: (me, world, win, tab) => {
      if (tab === 3) return HELP.map(p => ({ k: "para", s: p }));
      return [{ k: "search", id: "q" },
        { k: "draw", h: 14, fn: (ui, x, y, w) => { ui.text(x, y, tab === 2 ? "Caramelos" : tab ? "Bolas de prueba" : "Curar o revivir compañeros", THEME.dim, { size: 10 }); ui.text(x + w - 24, y, "Oro", THEME.dim, { size: 10 }); } },
        { k: "list", key: "h" + tab, rows: hospRows(tab, me), h: 200, filter: true, pick: hospPick, empty: "No llevas ninguna bola de compañero." }];
    },
  });
  hospital.HELP = HELP; hospital.rows = me => hospRows(hospital.tab, me); hospital.pick = hospPick;
  gui.register(hospital);

  // ------------------------------------------------------------ 44: arena de apuestas (invento del port, ver shared/systems/arena.js)
  const arenaRole = r => r === "none" ? "sin rama" : BRANCH_NAMES[r] || r;
  const arenaRows = (win, tab) => {
    const o = win.o;
    if (tab === 1) return (o?.hist || []).slice().reverse().map(h => ({ text: (h.win ? "Ganada · " : "Perdida · ") + h.a + " vs " + h.b, right: (h.net >= 0 ? "+" : "") + h.net, color: h.win ? THEME.good : THEME.bad, tip: "Apostaste " + h.amount + " por " + (h.side === "a" ? h.a : h.b) }));
    if (!o || o.none || o.busy || win.wait) return [];
    const f = (k, side) => ({ side, text: "Apostar por " + k.nm, right: "x" + (side === "a" ? o.oa : o.ob).toFixed(2), tip: "Si gana, cobras " + Math.round(win.amount * (side === "a" ? o.oa : o.ob)) + " de oro" });
    const rows = [f(o.a, "a"), f(o.b, "b"),
      { act: "+100", text: "Subir apuesta", right: "+100" }, { act: "+1000", text: "Subir apuesta", right: "+1000" }, { act: "-100", text: "Bajar apuesta", right: "-100" },
      { act: "max", text: "Apuesta máxima", right: String(o.max) }, { act: "new", text: "Otro retador", tip: "Se genera otro combate" }];
    if ((o.balls || []).length > 1) rows.push({ act: "ball", text: "Cambiar de compañero", tip: "Elige otro de tus compañeros" });
    return rows;
  };
  const arenaPick = r => {
    const o = arena.o, me = arena.me || api.me(); if (!o) return;
    if (r.side) { api.send({ t: "arenabet", npc: trade.npc.id, offer: o.offer, side: r.side, amount: arena.amount }); return; }
    const step = { "+100": 100, "+1000": 1000, "-100": -100 }[r.act];
    if (step) arena.amount = clamp(arena.amount + step, o.min, Math.min(o.max, Math.max(o.min, me.gold ?? o.max)));
    else if (r.act === "max") arena.amount = Math.min(o.max, Math.max(o.min, me.gold ?? o.max));
    else if (r.act === "new") { arena.wait = true; api.send({ t: "arenainfo", npc: trade.npc.id, uid: o.uid }); }
    else if (r.act === "ball") { const bs = o.balls, i = bs.findIndex(b => b.uid === o.uid); arena.wait = true; api.send({ t: "arenainfo", npc: trade.npc.id, uid: bs[(i + 1) % bs.length].uid }); }
  };
  const arena = defineDialog({
    id: 44, title: "Apuestas · Arena", w: 300, h: 340, tabs: ["Combate", "Historial"], footer: "Solo miras: la casa se queda un 10 %.",
    items: (me, world, win, tab) => {
      win.me = me;
      const o = win.o, hdr = (a, b) => ({ k: "draw", h: 14, fn: (ui, x, y, w) => { ui.text(x, y, a, THEME.dim, { size: 10 }); ui.text(x + w - 24, y, b, THEME.dim, { size: 10 }); } });
      if (tab === 1) return [hdr("Últimos combates", "Neto"), { k: "list", key: "hist", rows: arenaRows(win, 1), h: 230, pick: arenaPick, empty: "Aún no has apostado." }];
      if (win.wait) return [{ k: "text", s: "…" }];
      if (!o || o.none) return [{ k: "para", s: "Necesitas un compañero (bola) sano para combatir." }];
      if (o.busy) return [{ k: "para", s: "Hay un combate en curso…" }];
      const line = (k, p) => ({ k: "draw", h: 30, fn: (ui, x, y) => { ui.text(x, y, k.nm + (k.champion ? " ★" : ""), THEME.hi, { size: 11, bold: true }); ui.text(x, y + 13, shown(k.sp) + " nv " + k.lvl + " · " + arenaRole(k.role) + " · " + Math.round(p * 100) + " %", THEME.dim, { size: 10 }); } });
      return [line(o.a, o.pa), { k: "draw", h: 14, fn: (ui, x, y, w) => ui.text(x + w - 24, y, "VS", THEME.bad, { size: 11, bold: true }) }, line(o.b, o.pb),
        { k: "text", s: "Apuesta: " + win.amount + " de oro  (" + o.min + " – " + o.max + ")", color: THEME.dim },
        { k: "list", key: "bet", rows: arenaRows(win, 0), h: 130, pick: arenaPick }];
    },
  });
  arena.o = null; arena.amount = 500; arena.wait = false;
  arena.open = () => { arena.tab = 0; arena.wait = true; arena.o = null; api.send({ t: "arenainfo", npc: trade.npc.id }); gui.open(44); };
  arena.got = ev => { arena.o = ev; arena.wait = false; arena.amount = clamp(arena.amount, ev.min, ev.max); };
  arena.rows = () => arenaRows(arena, arena.tab); arena.pick = arenaPick;
  gui.register(arena);

  // ------------------------------------------------------------ notificaciones del servidor
  function onEvent(ev, world) {
    const me = api.pid;
    if (ev.id !== me) return;
    const mine = api.me(), nm = id => itemName(id);
    switch (ev.t) {
      case "arenaoffer": arena.got(ev); break;
      case "arenastart": gui.close(44); api.log("Apuestas " + ev.amount + " de oro por " + (ev.side === "a" ? ev.a.nm : ev.b.nm) + " (x" + ev.odds.toFixed(2) + "). ¡Que empiece el combate!", "gold"); break;
      case "arenamsg": api.log(getLang() === "en" ? ev.en : ev.es, ev.big ? "gold" : ""); break;
      case "arenaend":
        api.log(ev.win ? "¡Has ganado " + ev.net + " de oro! (" + (ev.quiet ? "apuesta pendiente cobrada" : ev.a + " vs " + ev.b) + ")" : "Has perdido " + ev.amount + " de oro. (" + ev.a + " vs " + ev.b + ")", ev.win ? "gold" : "bad");
        if (ev.bonus) api.log("Premio de la casa por la victoria de tu compañero: +" + ev.bonus + " de oro.", "gold");
        if (ev.xp) api.log((ev.nm || "Tu compañero") + " entrena en la arena: +" + ev.xp + " de experiencia.", "gold");
        break;
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
      case "sold": gui.close(23); api.log("You sold " + (ev.count > 1 ? ev.count + " " : "") + nm(ev.item) + " for " + ev.price + " Gold.", "gold"); break;   // el original no avisa; invento del port
      case "bankgold": api.log(t("Oro en el almacén") + ": " + ev.gold, "gold"); break;
      case "repairedall": api.log(ev.count ? t("Reparados {n} objetos por {p} de oro.").replace("{n}", ev.count).replace("{p}", ev.price) : t("No hay nada que reparar."), "gold"); break;
      case "repaired": gui.close(23); api.log("Item " + nm(ev.item) + ": repaired."); break;
      case "pettreated": api.log((ev.revived ? "Has revivido a " : "Has curado a ") + (ev.nm || ev.sp) + " por " + ev.cost + " de oro.", "gold"); break;
      case "candybought": api.log("Compras " + ev.count + " × " + ev.name + " por " + ev.price + " de oro."); break;
      case "petupgraded": api.log(ev.nm + " ha evolucionado: " + shown(ev.from) + " → " + ev.to + " (nivel 1)."); break;
      case "petbought": api.log("Compras la bola de " + (DUMMY_NAMES[ev.cls] || shown(ev.sp)) + " (" + ev.nm + ") por " + ev.price + " de oro."); break;
      case "bounty": api.log("Recompensa por derrotar a " + ev.victim + ": " + ev.gold + " de oro.", "gold"); break;
      case "bankfull": api.log("There is no empty space left in warehouse."); break;
      // NOTIFY_PORTIONSUCCESS / PORTIONFAIL / LOWPORTIONSKILL / NOMATCHINGPORTION (NOTIFY_MSG_HANDLER46-49)
      case "potion-ok": api.log("You successfully mixed a potion!"); break;
      case "potion-fail": api.log("You failed on mixing a potion."); break;
      case "potion-lowskill": api.log("Your alchemy level is too low to mix the potion."); break;
      case "potion-nomatch": api.log("Incorrect ingredients to mix the potion."); break;
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
    clickNpc, dropOnNpc, onEvent, trade, bag, hooks, alchemy,
    // cierra los cuadros cuyo objeto ya no está en la mochila (vendido, soltado...); se llama una vez por fotograma
    sweep() {
      const me = api.me(); if (!me) return;
      const gone = uid => !bagItem(me, uid);
      if (gui.isOpen(17) && gone(quantity.ask?.uid)) gui.close(17);
      if (gui.isOpen(26)) alchemy.tick(me);
      if (gui.isOpen(23) && gone(confirm.uid)) gui.close(23);
      if (gui.isOpen(20) && (query.mode === 2 || query.mode === 3) && gone(query.uid)) gui.close(20);
      for (const u of [...trade.busy]) if (gone(u) && !(gui.isOpen(17) && quantity.ask?.uid === u)) trade.busy.delete(u);
      // objetos que se quedaron «desactivados» sin ningún cuadro que los espere (cierre silencioso, respuesta perdida): se liberan
      if (!gui.isOpen(31) && trade.sellList.length) trade.sellList = [];
      const waiting = gui.isOpen(17) || gui.isOpen(20) || gui.isOpen(23) || gui.isOpen(31), now = performance.now();
      for (const u of [...trade.busy]) {
        const t = trade.stamp.get(u) ?? (trade.stamp.set(u, now), now);
        if (!waiting && now - t > 2500) { trade.busy.delete(u); trade.stamp.delete(u); }
      }
      for (const u of [...trade.stamp.keys()]) if (!trade.busy.has(u)) trade.stamp.delete(u);
    },
    dropOn(dlg, uid, mx, my) {                                          // objeto soltado sobre un cuadro de NPC
      if (dlg.id === 26) { alchemy.drop(uid); return true; }
      if (dlg.id === 31) { sellList.drop(uid, mx, my); return true; }
      if (dlg.id === 14) { bank.drop(uid, mx, my); return true; }
      return false;
    },
    // el teclado lo recibe antes el cuadro de cantidad
    key(e) { return gui.isOpen(17) ? quantity.key(e, gui) : false; },
  };
}
