// Cuadros de diálogo del cliente original (Game.cpp, DrawDialogBox_*). Cada uno: { id, x, y, w, h, draw(g, me, world), click(g, x, y, me) }
// con coordenadas relativas a la esquina del cuadro. Posición inicial = m_stDialogBoxInfo[n] (+ SCREENX 80, SCREENY 60).
import { itemDef } from "./names.js";
import { EQUIP } from "../shared/items.js";
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
}
