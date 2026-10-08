// Cuadros de diálogo del cliente original (Game.cpp, DrawDialogBox_*). Cada uno: { id, x, y, w, h, draw(g, me, world), click(g, x, y, me) }
// con coordenadas relativas a la esquina del cuadro. Posición inicial = m_stDialogBoxInfo[n] (+ SCREENX 80, SCREENY 60).
import { itemDef } from "./names.js";
import { EQUIP, ITYPE } from "../shared/items.js";
import { packKey } from "./names.js";
import { HAIR_COLORS } from "./look.js";
import { castChance, manaCost } from "../shared/magic.js";

const INK = "#2d1919";                         // RGB(45,25,25): texto del cliente sobre fondo de pergamino
const comma = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// sprite de equipo del cliente (item-equipM/W): pivote + sprite del objeto -> hoja de item-equip
const EQ_M = { 0: "em_0", 1: "em_1", 2: "em_2", 3: "em_3", 4: "em_4", 5: "em_5", 7: "em_6", 8: "em_7", 9: "em_8", 15: "em_11", 17: "em_12", 18: "em_9", 19: "em_10", 20: "em_13", 21: "em_14", 16: "pk_15", 22: "pk_19" };
const EQ_W = { 40: "ew_0", 41: "ew_1", 42: "ew_2", 43: "ew_3", 45: "ew_4", 50: "ew_5", 51: "ew_6", 52: "ew_7", 53: "ew_8", 55: "ew_11", 57: "ew_12", 58: "ew_9", 59: "ew_10", 60: "ew_13", 61: "ew_14", 56: "pk_15", 62: "pk_19" };
const eqKey = (female, spr) => (female ? EQ_W[spr + 40] : EQ_M[spr]);

// posición de cada pieza en el muñeco (DrawDialogBox_Character); [x, y] de hombre y de mujer
const SLOT_POS = {
  [EQUIP.BACK]: [[41, 137], [45, 143]], [EQUIP.PANTS]: [[171, 290], [171, 290]], [EQUIP.ARMS]: [[171, 290], [171, 290]],
  [EQUIP.LEGGINGS]: [[171, 290], [171, 290]], [EQUIP.BODY]: [[171, 290], [171, 290]], [EQUIP.FULLBODY]: [[171, 290], [171, 290]],
  [EQUIP.LHAND]: [[90, 170], [84, 175]], [EQUIP.RHAND]: [[57, 186], [60, 191]], [EQUIP.TWOHAND]: [[57, 186], [60, 191]],
  [EQUIP.NECK]: [[35, 120], [35, 120]], [EQUIP.RFINGER]: [[32, 193], [32, 193]], [EQUIP.LFINGER]: [[98, 182], [98, 182]], [EQUIP.HEAD]: [[72, 135], [72, 135]],
};
const ORDER = [EQUIP.BACK, EQUIP.PANTS, EQUIP.ARMS, EQUIP.LEGGINGS, EQUIP.BODY, EQUIP.FULLBODY, EQUIP.LHAND, EQUIP.RHAND, EQUIP.TWOHAND, EQUIP.NECK, EQUIP.RFINGER, EQUIP.LFINGER, EQUIP.HEAD];

export function registerDialogs(gui, api) {
  // ------------------------------------------------------------ 1: personaje (F5)
  gui.register({
    id: 1, x: 110, y: 90, w: 270, h: 376,
    draw(g, me) {
      g.put("dialogtext_0", 0, 0, 0);
      const side = me.side, name = me.name + " : Contribution (0)";
      g.aligned(24, 252, 52, name, INK);
      g.aligned(0, 275, 69, side === 1 ? "Aresden Civilian" : side === 2 ? "Elvine Civilian" : "Traveller", INK);
      const L = (v, y, x1 = 180, x2 = 250) => g.aligned(x1, x2, y, String(v), INK);
      const s = me.stats;
      L(me.level, 106); L(comma(me.exp), 125); L(comma(me.nextExp), 142);
      L(me.hp + "/" + me.maxHp, 173); L(me.mp + "/" + me.maxMp, 191); L(me.sp + "/" + me.maxSp, 208);
      L(Math.floor(me.weight / 100) + "/" + Math.floor(me.maxLoad / 100), 240);
      L(me.kills, 257);
      L(s.str, 285, 48, 82); L(s.dex, 302, 48, 82); L(s.vit, 285, 218, 251); L(s.int, 285, 135, 167); L(s.mag, 302, 135, 167); L(s.chr, 302, 218, 251);
      this.paperdoll(g, me);
      const m = g.mouse, lx = m.x - this.x, ly = m.y - this.y, on = (a) => lx >= a && lx <= a + 74 && ly >= 340 && ly <= 360;
      g.put("dialogtext_1", on(15) ? 5 : 4, 15, 340);           // Quest
      g.put("dialogtext_1", on(98) ? 45 : 44, 98, 340);         // Party
      g.put("dialogtext_1", on(180) ? 11 : 10, 180, 340);       // Level Up
    },
    click(g, lx, ly) {
      const hit = a => lx >= a && lx <= a + 74 && ly >= 340 && ly <= 360;
      if (hit(15)) api.log("No hay misiones en esta versión.");
      else if (hit(98)) api.log("No hay grupos en esta versión.");
      else if (hit(180)) { g.close(1); g.open(12); return true; }
      return false;
    },
    // coger una pieza equipada del muñeco (para soltarla en la mochila y quitársela)
    press(g, lx, ly, me) {
      const female = me.gender === 2;
      for (let i = ORDER.length - 1; i >= 0; i--) {
        const pos = ORDER[i], uid = me.equip && me.equip[pos], it = uid && me.bag.find(b => b.uid === uid), d = it && itemDef(it.id);
        if (!d) continue;
        const key = eqKey(female, d.sprite); if (!key) continue;
        const [x, y] = SLOT_POS[pos][female ? 1 : 0];
        if (g.hitUi(key, d.spriteFrame, x, y, lx, ly)) {
          g.item = { uid, from: 1, dx: 0, dy: 0, draw: (gg, mx, my) => gg.putGame(packKey(d), d.spriteFrame, mx, my, 0.9) };
          return true;
        }
      }
      return false;
    },
    paperdoll(g, me) {
      const female = me.gender === 2, look = me.look || { skin: 2, hair: 0, hairCol: 0, under: 0 };
      const worn = {};
      for (const [pos, uid] of Object.entries(me.equip || {})) { const it = me.bag.find(i => i.uid === uid); if (it) worn[pos] = it; }
      const body = female ? "ew_0" : "em_0", hair = female ? "ew_9" : "em_9", under = female ? "ew_10" : "em_10";
      g.put(body, look.skin - 1, 171, 290);
      if (!worn[EQUIP.HEAD]) {
        const col = HAIR_COLORS[look.hairCol][1];
        if (col) g.mul(hair, look.hair, 171, 290, col); else g.put(hair, look.hair, 171, 290);
      }
      g.put(under, look.under, 171, 290);
      const skirt = female && worn[EQUIP.PANTS] && itemDef(worn[EQUIP.PANTS].id)?.sprite === 12 && itemDef(worn[EQUIP.PANTS].id)?.spriteFrame === 0;
      for (const pos of ORDER) {
        const it = worn[pos]; if (!it) continue;
        const d = itemDef(it.id); if (!d) continue;
        const key = eqKey(female, d.sprite); if (!key) continue;
        const [x, y] = SLOT_POS[pos][female ? 1 : 0];
        g.put(key, d.spriteFrame, x, y, null, false, it.life === 0 ? 0.5 : 1);
      }
      void skirt;
    },
  });

  // ------------------------------------------------------------ 2: inventario (F6)
  // Los objetos están en posiciones libres (x 0..170, y -10..95 desde (32, 44) del cuadro), como en el original.
  // Los equipados no se dibujan aquí. Nuevos: (40, 30). El último de `order` queda encima.
  const inv = {
    id: 2, x: 460, y: 270, w: 225, h: 185, order: [],
    sync(me) {
      const ids = new Set(me.bag.map(i => i.uid));
      this.order = this.order.filter(u => ids.has(u));
      for (const i of me.bag) if (!this.order.includes(i.uid)) this.order.push(i.uid);
    },
    pos(it) { return [32 + (it.x ?? 40), 44 + (it.y ?? 30)]; },
    equipped(me, uid) { return Object.values(me.equip || {}).includes(uid); },
    draw(g, me) {
      this.sync(me);
      g.put("gamedialog_7", 0, 0, 0);
      for (const uid of this.order) {
        const it = me.bag.find(i => i.uid === uid), d = it && itemDef(it.id);
        if (!d || this.equipped(me, uid) || (g.item && g.item.uid === uid)) continue;
        const [x, y] = this.pos(it);
        g.putGame(packKey(d), d.spriteFrame, x, y, api.disabled?.(uid) ? 0.5 : 1);
        if (d.type === ITYPE.CONSUME || d.type === ITYPE.ARROW) g.text(x + 10, y + 10, comma(it.count), "#c8c8c8", { shadow: true, size: 11 });
      }
      const m = g.mouse, lx = m.x - this.x, ly = m.y - this.y;
      if (lx >= 23 && lx <= 76 && ly >= 172 && ly <= 184) g.put("gamedialog_7", 1, 23, 172);
      if (lx >= 140 && lx <= 212 && ly >= 172 && ly <= 184) g.put("gamedialog_7", 2, 140, 172);
    },
    // objeto bajo el cursor (de arriba abajo), con colisión por píxel
    pick(g, lx, ly, me) {
      this.sync(me);
      for (let i = this.order.length - 1; i >= 0; i--) {
        const it = me.bag.find(b => b.uid === this.order[i]), d = it && itemDef(it.id);
        if (!d || this.equipped(me, it.uid)) continue;
        const [x, y] = this.pos(it);
        if (g.hitGame(packKey(d), d.spriteFrame, x, y, lx, ly)) return { it, d, x, y };
      }
      return null;
    },
    press(g, lx, ly, me) {
      const h = this.pick(g, lx, ly, me); if (!h) return false;
      this.order = this.order.filter(u => u !== h.it.uid); this.order.push(h.it.uid);
      const fr = g.spr.frame(packKey(h.d), h.d.spriteFrame);
      g.item = { uid: h.it.uid, from: 2, dx: lx - h.x, dy: ly - h.y, draw: (gg, mx, my) => gg.putGame(packKey(h.d), h.d.spriteFrame, mx - (lx - h.x) + 0, my - (ly - h.y) + 0, 0.9), fr };
      return true;
    },
    dbl(g, lx, ly, me) {
      const h = this.pick(g, lx, ly, me); if (!h) return false;
      g.item = null;
      api.primary(h.it.uid);
      return true;
    },
    click(g, lx, ly) {
      if (lx >= 23 && lx <= 76 && ly >= 172 && ly <= 184) { api.log("No hay mejora de objetos en esta versión."); return true; }
      if (lx >= 140 && lx <= 212 && ly >= 172 && ly <= 184) { api.log("Aprende la habilidad de fabricación para usar el manual."); return true; }
      return false;
    },
  };
  gui.register(inv);
  gui.inv = inv;

  // ------------------------------------------------------------ 3: magia (F7, Ctrl+0..9 = círculo)
  const CIRCLES = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const TAB_X = [30, 43, 61, 86, 106, 121, 142, 169, 202, 222];                // posiciones de la marca del círculo (sprfonts 20..29)
  const TAB_HIT = [[16, 38], [39, 56], [57, 81], [82, 101], [102, 116], [117, 137], [138, 165], [166, 197], [198, 217], [218, 239]];
  const asCaster = me => ({ skills: me.skills || {}, stats: me.stats, level: me.level, eff: me.eff || {} });
  const spellsOf = (me, view) => {
    const out = [];
    for (let i = 0; i < 9; i++) { const id = view * 10 + i, m = api.magic[id]; if (me.magic && me.magic[id] && m) out.push([id, m]); }
    return out;
  };
  const mg = {
    id: 3, x: 417, y: 117, w: 258, h: 328, view: 0,
    draw(g, me) {
      g.put("gamedialog_0", 1, 0, 0);
      g.put("dialogtext_0", 7, 0, 0);
      g.aligned(3, 256, 50, "Circle " + CIRCLES[this.view], "#000", { bold: true });
      const list = spellsOf(me, this.view), caster = asCaster(me);
      let y = 0;
      for (const [id, m] of list) {
        const cost = manaCost(caster, m), name = m.name.replace(/-/g, " ");
        const over = g.mouse.x - this.x >= 30 && g.mouse.x - this.x <= 240 && g.mouse.y - this.y >= 70 + y && g.mouse.y - this.y <= 84 + y;
        const col = cost > me.mp ? "rgb(41,16,41)" : over ? "#fff" : "rgb(8,0,66)";
        g.text(30, 72 + y, name, col, { bold: true }); g.text(206, 72 + y, String(cost).padStart(3, " "), col, { bold: true });
        y += 18;
      }
      if (!list.length) {
        ["You have not learned any magic.", "You can learn magic at the Wizard", "Tower in town. To learn a spell", "you need sufficient gold and INT."].forEach((t, i) => g.aligned(3, 256, 100 + 15 * i, t, "#000"));
      }
      g.put("interface_1", 19, 30, 250);
      g.put("interface_1", 20 + this.view, TAB_X[this.view], 250);
      let r = castChance(caster, this.view * 10), total = r;
      void total;
      r = Math.min(100, r);
      if (me.sp < 1) r = Math.floor(r * 9 / 10);
      r = Math.max(1, r);
      const t = "Casting Probability: " + r + "%";
      g.aligned(0, 256, 267, t, "#000", { bold: true });
      const over = g.mouse.x - this.x >= 154 && g.mouse.x - this.x <= 228 && g.mouse.y - this.y >= 285 && g.mouse.y - this.y <= 305;
      g.put("dialogtext_1", over ? 49 : 48, 154, 285);
    },
    click(g, lx, ly, me) {
      let y = 0;
      for (const [id] of spellsOf(me, this.view)) {
        if (lx >= 30 && lx <= 240 && ly >= 70 + y && ly <= 88 + y) { api.useMagic(id); g.close(3); return true; }
        y += 18;
      }
      TAB_HIT.forEach(([a, b], i) => { if (lx >= a && lx <= b && ly >= 240 && ly <= 268) this.view = i; });
      if (lx >= 154 && lx <= 228 && ly >= 285 && ly <= 305) api.log("You should learn alchemy skill to use this item.");
      return false;
    },
    wheel(g, dir) { this.view = (this.view + (dir > 0 ? -1 : 1) + 10) % 10; },
  };
  gui.register(mg);

  // ------------------------------------------------------------ 16: tienda de magia (Mago de la torre)
  const SHOP_TAB = [[44, 52, 0], [57, 70, 1], [75, 95, 2], [100, 115, 3], [120, 131, 4], [135, 152, 5], [156, 179, 6], [183, 212, 7], [216, 232, 8], [236, 247, 9]];
  const shop = {
    id: 16, x: 110, y: 90, w: 304, h: 328, view: 0,
    list(me) { const out = []; for (let i = 0; i < 9; i++) { const id = this.view * 10 + i, m = api.magic[id]; if (m && m.cost >= 0) out.push([id, m]); } return out; },
    draw(g, me) {
      g.put("gamedialog_3", 1, 0, 0); g.put("dialogtext_0", 14, 0, 0);
      g.text(23, 55, "Spell Name", INK); g.text(192, 55, "Int", INK); g.text(250, 55, "Cost", INK);
      let y = 0;
      for (const [id, m] of this.list(me)) {
        const known = me.magic && me.magic[id], name = m.name.replace(/-/g, " ");
        const over = g.mouse.x - this.x >= 24 && g.mouse.x - this.x <= 159 && g.mouse.y - this.y >= 70 + y && g.mouse.y - this.y <= 84 + y;
        const col = known ? "rgb(41,16,41)" : over ? "#fff" : "rgb(8,0,66)";
        g.text(24, 72 + y, name, col, { bold: true }); g.text(200, 72 + y, String(m.reqInt).padStart(3, " "), col, { bold: true }); g.text(241, 72 + y, String(m.cost).padStart(3, " "), col, { bold: true });
        y += 18;
      }
      g.put("interface_1", 19, 55, 250);
      g.put("interface_1", 20 + this.view, SHOP_TAB[this.view][0] - 20 + 31 - 0, 250);
      g.aligned(0, 304, 275, "Select a magic which you want to learn.", INK);
    },
    click(g, lx, ly, me) {
      let y = 0;
      for (const [id] of this.list(me)) {
        if (lx >= 24 && lx <= 159 && ly >= 70 + y && ly <= 84 + y) { if (!(me.magic && me.magic[id])) api.learn(id); return true; }
        y += 18;
      }
      for (const [a, b, v] of SHOP_TAB) if (lx >= a + 11 && lx <= b + 11 && ly >= 248 && ly <= 260) this.view = v;
      return false;
    },
    wheel(g, dir) { this.view = (this.view + (dir > 0 ? -1 : 1) + 10) % 10; },
  };
  gui.register(shop);

  // ------------------------------------------------------------ 12: reparto de puntos al subir de nivel (cuadro de "Level Up")
  const LU = [["Strength", "str", 125], ["Vitality", "vit", 144], ["Dexterity", "dex", 163], ["Intelligence", "int", 182], ["Magic", "mag", 201], ["Charisma", "chr", 220]];
  const lu = {
    id: 12, x: 80, y: 60, w: 258, h: 339, d: {},
    onOpen() { this.d = {}; },
    left(me) { return me.pool - Object.values(this.d).reduce((a, b) => a + b, 0); },
    draw(g, me) {
      g.put("gamedialog_1", 0, 0, 0); g.put("dialogtext_0", 2, 0, 0); g.put("gamedialog_3", 4, 16, 100);
      g.aligned(0, 258, 50, "When level up, your specific stats", INK); g.aligned(0, 258, 65, "will be increased by setting.", INK);
      g.text(20, 85, "* Points left:", "#000");
      const left = this.left(me);
      g.text(73, 102, String(left), left > 0 ? "#00ff00" : "#000", { bold: true });
      const m = g.mouse, lx = m.x - this.x, ly = m.y - this.y;
      for (const [name, k, y] of LU) {
        g.text(24, y, name, "rgb(5,5,5)");
        g.text(109, y, String(me.stats[k]), "rgb(25,35,25)");
        const nv = me.stats[k] + (this.d[k] || 0);
        g.text(162, y, String(nv), nv !== me.stats[k] ? "#f00" : "rgb(25,35,25)");
        if (lx >= 195 && lx <= 205 && ly >= y + 2 && ly <= y + 8 && left > 0 && me.stats[k] < 200) g.put("gamedialog_3", 5, 195, y + 2);
        if (lx >= 210 && lx <= 220 && ly >= y + 2 && ly <= y + 8 && (this.d[k] || 0) > 0) g.put("gamedialog_3", 6, 210, y + 2);
      }
      g.put("dialogtext_1", lx >= 154 && lx <= 228 && ly > 292 && ly < 312 ? 1 : 0, 154, 292);
    },
    click(g, lx, ly, me, e) {
      const step = g.info?.ctrl ? 5 : 1;
      for (const [, k, y] of LU) {
        if (lx >= 195 && lx <= 205 && ly >= y + 2 && ly <= y + 8 && this.left(me) > 0) {
          const n = step === 5 && this.left(me) < 5 ? 0 : step;
          if (n) this.d[k] = (this.d[k] || 0) + n;
          return true;
        }
        if (lx >= 210 && lx <= 220 && ly >= y + 2 && ly <= y + 8 && (this.d[k] || 0) > 0) {
          const n = step === 5 && this.d[k] < 5 ? 0 : step;
          if (n) this.d[k] -= n;
          return true;
        }
      }
      if (lx >= 154 && lx <= 228 && ly > 292 && ly < 312) {
        for (const [, k] of LU) for (let i = 0; i < (this.d[k] || 0); i++) api.stat(k);
        g.close(12);
        return true;
      }
      return false;
    },
  };
  gui.register(lu);

  // ------------------------------------------------------------ 19: menú del sistema (F12)
  const sys = {
    id: 19, x: 417, y: 167, w: 258, h: 268,
    draw(g, me) {
      const S = api.sys();
      g.put("gamedialog_0", 0, 0, 0); g.put("dialogtext_0", 6, 0, 0);
      const label = (x, y, t) => { g.text(x, y, t, INK); g.text(x + 1, y, t, INK); };
      const val = (x, y, t, c) => g.text(x, y, t, c);
      const W_ = "#fff", GR = "#c8c8c8";
      label(23, 63, "Detail Level");
      ["Low", "Normal", "High"].forEach((t, i) => val([121, 153, 205][i], 63, t, S.detail === i ? W_ : INK));
      label(23, 84, "Sound"); S.sound ? val(85, 85, "On", W_) : val(83, 85, "Off", GR);
      label(123, 84, "Music"); S.music ? val(180, 85, "On", W_) : val(178, 85, "Off", GR);
      label(23, 106, "Whisper"); S.whisper ? val(85, 106, "On", W_) : val(82, 106, "Off", GR);
      label(123, 106, "Shout"); S.shout ? val(180, 106, "On", W_) : val(177, 106, "Off", GR);
      label(23, 124, "Sound Volume"); g.put("gamedialog_1", 8, 130 + S.soundVol, 129);
      label(23, 141, "Music Volume"); g.put("gamedialog_1", 8, 130 + S.musicVol, 145);
      label(23, 158, "Dialog Box Transparency"); S.trans ? val(208, 158, "On", W_) : val(207, 158, "Off", GR);
      label(23, 180, "Guide Map"); g.isOpen(9) ? val(99, 180, "On", W_) : val(98, 180, "Off", GR);
      const d = new Date();
      label(23, 204, `${d.getMonth() + 1}:${d.getDate()}:${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`);
      label(23, 41, "Helbreath Web");
      const m = g.mouse, lx = m.x - this.x, ly = m.y - this.y;
      const over = (a) => lx >= a && lx <= a + 74 && ly >= 225 && ly <= 245;
      if (S.logoutCount === null) g.put("dialogtext_1", over(30) ? 9 : 8, 30, 225); else g.put("dialogtext_1", over(30) ? 7 : 6, 30, 225);
      if (me.dead) g.put("dialogtext_1", over(154) ? 37 : 36, 154, 225);
      else { label(133, 214, "Coded by Cleroth,"); label(125, 229, "Diuuude & Snoopy81"); }
      // control deslizante de volumen (mantener pulsado)
      if (m.down && g.order[g.order.length - 1] === 19) {
        if (lx >= 127 && lx <= 238 && ly >= 122 && ly <= 138) api.setSys({ soundVol: Math.max(0, Math.min(100, Math.round(lx - 127))) });
        if (lx >= 127 && lx <= 238 && ly >= 139 && ly <= 155) api.setSys({ musicVol: Math.max(0, Math.min(100, Math.round(lx - 127))) });
      }
    },
    click(g, lx, ly, me) {
      const S = api.sys(), inb = (x1, x2, y1, y2) => lx >= x1 && lx <= x2 && ly >= y1 && ly <= y2;
      if (inb(120, 150, 63, 74)) api.setSys({ detail: 0 });
      else if (inb(151, 200, 63, 74)) api.setSys({ detail: 1 });
      else if (inb(201, 234, 63, 74)) api.setSys({ detail: 2 });
      else if (inb(24, 115, 81, 100)) api.setSys({ sound: !S.sound });
      else if (inb(116, 202, 81, 100)) api.setSys({ music: !S.music });
      else if (inb(23, 108, 108, 119)) api.setSys({ whisper: !S.whisper });
      else if (inb(123, 203, 108, 119)) api.setSys({ shout: !S.shout });
      else if (inb(28, 235, 156, 171)) api.setSys({ trans: !S.trans });
      else if (inb(28, 127, 178, 193)) g.toggle(9);
      else if (inb(30, 104, 225, 245)) { api.logout(); if (S.logoutCount === null) g.close(19); }
      else if (me.dead && inb(154, 228, 225, 245)) { api.restart(); g.close(19); }
      else if (inb(127, 238, 122, 138) || inb(127, 238, 139, 155)) return true;
      else return false;
      return true;
    },
  };
  gui.register(sys);
}
