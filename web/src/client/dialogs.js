// Cuadros de diálogo del cliente original (Game.cpp, DrawDialogBox_*). Cada uno: { id, x, y, w, h, draw(g, me, world), click(g, x, y, me) }
// con coordenadas relativas a la esquina del cuadro. Posición inicial = m_stDialogBoxInfo[n] (+ SCREENX 80, SCREENY 60).
import { itemDef } from "./names.js";
import { EQUIP, ITYPE } from "../shared/items.js";
import { packKey } from "./names.js";
import { HAIR_COLORS } from "./look.js";

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
}
